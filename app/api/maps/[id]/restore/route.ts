import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

type RouteParams = { params: Promise<{ id: string }> };

interface SnapshotNode {
    id: string;
    parentId: string | null;
    sortIndex: number;
    positionX: number;
    positionY: number;
    title: string;
    collapsed: boolean;
    noteDoc: unknown;
    notePlain: string;
}

interface SnapshotEdge {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
}

interface Snapshot {
    title: string;
    viewport: { x: number; y: number; zoom: number };
    nodes: SnapshotNode[];
    edges: SnapshotEdge[];
}

/**
 * POST /api/maps/:id/restore — Restore from a version snapshot.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { versionId } = body;

        if (!versionId) {
            return NextResponse.json({ error: "versionId is required" }, { status: 400 });
        }

        const map = await prisma.mindmap.findUnique({ where: { id } });
        if (!map || map.ownerId !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const version = await prisma.mindmapVersion.findUnique({ where: { id: versionId } });
        if (!version || version.mindmapId !== id) {
            return NextResponse.json({ error: "Version not found" }, { status: 404 });
        }

        const snapshot = version.snapshotJson as unknown as Snapshot;

        await prisma.$transaction(async (tx) => {
            // Clear current nodes and edges
            await tx.mindmapEdge.deleteMany({ where: { mindmapId: id } });
            await tx.mindmapNode.deleteMany({ where: { mindmapId: id } });

            // Update map meta
            await tx.mindmap.update({
                where: { id },
                data: {
                    title: snapshot.title,
                    viewportX: snapshot.viewport.x,
                    viewportY: snapshot.viewport.y,
                    viewportZoom: snapshot.viewport.zoom,
                },
            });

            // Restore nodes
            for (const node of snapshot.nodes) {
                await tx.mindmapNode.create({
                    data: {
                        id: node.id,
                        mindmapId: id,
                        parentId: node.parentId,
                        sortIndex: node.sortIndex,
                        positionX: node.positionX,
                        positionY: node.positionY,
                        title: node.title,
                        collapsed: node.collapsed,
                        noteDoc: node.noteDoc as object ?? undefined,
                        notePlain: node.notePlain,
                    },
                });
            }

            // Restore edges
            if (snapshot.edges.length > 0) {
                await tx.mindmapEdge.createMany({
                    data: snapshot.edges.map((e) => ({
                        id: e.id,
                        mindmapId: id,
                        sourceId: e.sourceId,
                        targetId: e.targetId,
                        type: e.type,
                    })),
                });
            }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Restore error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
