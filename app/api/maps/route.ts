import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createMapSchema } from "@/lib/validation";

/**
 * GET /api/maps — List all mindmaps for the current user.
 * Query params: ?page=1&limit=20&search=keyword
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const url = req.nextUrl;
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
        const search = url.searchParams.get("search")?.trim() || "";

        // Own maps
        const ownWhere = {
            ownerId: session.userId,
            ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
        };
        const ownMaps = await prisma.mindmap.findMany({
            where: ownWhere,
            select: {
                id: true,
                title: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
        });

        // Shared maps (collaborator)
        const sharedCollabs = await prisma.mapCollaborator.findMany({
            where: {
                userId: session.userId,
                accepted: true,
                ...(search ? { mindmap: { title: { contains: search, mode: "insensitive" as const } } } : {}),
            },
            include: {
                mindmap: {
                    select: {
                        id: true,
                        title: true,
                        createdAt: true,
                        updatedAt: true,
                        owner: { select: { email: true } },
                    },
                },
            },
        });

        const ownWithRole = ownMaps.map((m) => ({ ...m, role: "owner" as const }));
        const sharedWithRole = sharedCollabs.map((c) => ({
            ...c.mindmap,
            role: c.role as "editor" | "viewer",
            ownerEmail: c.mindmap.owner.email,
        }));

        // Merge, sort, and paginate
        const all = [...ownWithRole, ...sharedWithRole].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        const total = all.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const maps = all.slice(start, start + limit);

        return NextResponse.json({ maps, total, page, limit, totalPages });
    } catch (error) {
        console.error("List maps error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/maps — Create a new mindmap.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = createMapSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const map = await prisma.mindmap.create({
            data: {
                ownerId: session.userId,
                title: parsed.data.title,
            },
        });

        return NextResponse.json(map, { status: 201 });
    } catch (error) {
        console.error("Create map error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
