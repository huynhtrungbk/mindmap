import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canEditMap, getMapRole } from "@/lib/collab";
import { updateMapSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/maps/:id — Get full mindmap state.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;

        const map = await prisma.mindmap.findUnique({
            where: { id },
            include: {
                nodes: { orderBy: { sortIndex: "asc" } },
                edges: true,
            },
        });

        if (!map) {
            return NextResponse.json({ error: "Map not found" }, { status: 404 });
        }

        // Check access (owner or collaborator)
        const role = await getMapRole(session.userId, id);
        if (!role) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ ...map, role });
    } catch (error) {
        console.error("Get map error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/maps/:id — Update map meta (title, viewport).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;

        // Verify edit permission
        if (!(await canEditMap(session.userId, id))) {
            return NextResponse.json({ error: "No edit permission" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = updateMapSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const updated = await prisma.mindmap.update({
            where: { id },
            data: parsed.data,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Update map error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/maps/:id — Delete a mindmap.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;

        const existing = await prisma.mindmap.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Map not found" }, { status: 404 });
        }
        if (existing.ownerId !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.mindmap.delete({ where: { id } });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Delete map error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
