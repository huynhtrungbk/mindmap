import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/maps/:id/versions — List all versions.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;

        const map = await prisma.mindmap.findUnique({ where: { id } });
        if (!map || map.ownerId !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const versions = await prisma.mindmapVersion.findMany({
            where: { mindmapId: id },
            select: { id: true, versionNo: true, createdAt: true },
            orderBy: { versionNo: "desc" },
        });

        return NextResponse.json(versions);
    } catch (error) {
        console.error("List versions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
