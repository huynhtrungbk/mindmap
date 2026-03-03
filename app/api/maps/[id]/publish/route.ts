import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/maps/:id/publish — Create a snapshot version.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;

        const map = await prisma.mindmap.findUnique({
            where: { id },
            include: { nodes: true, edges: true },
        });

        if (!map || map.ownerId !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Get next version number
        const lastVersion = await prisma.mindmapVersion.findFirst({
            where: { mindmapId: id },
            orderBy: { versionNo: "desc" },
        });

        const versionNo = (lastVersion?.versionNo ?? 0) + 1;

        const snapshot = {
            title: map.title,
            viewport: { x: map.viewportX, y: map.viewportY, zoom: map.viewportZoom },
            nodes: map.nodes,
            edges: map.edges,
        };

        const version = await prisma.mindmapVersion.create({
            data: {
                mindmapId: id,
                versionNo,
                snapshotJson: snapshot,
                createdBy: session.userId,
            },
        });

        return NextResponse.json({ id: version.id, versionNo }, { status: 201 });
    } catch (error) {
        console.error("Publish error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
