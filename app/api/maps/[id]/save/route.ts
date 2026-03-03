import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canEditMap } from "@/lib/collab";
import { syncHub } from "@/lib/sync-hub";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

interface SaveBody {
    lastSavedAt?: string;
    viewport?: { x: number; y: number; zoom: number };
    nodes?: Array<{
        id: string;
        parentId: string | null;
        sortIndex: number;
        positionX: number;
        positionY: number;
        title: string;
        collapsed: boolean;
        noteDoc: unknown;
        notePlain: string;
    }>;
    edges?: Array<{
        id: string;
        source: string;
        target: string;
        type: string;
    }>;
}

/**
 * POST /api/maps/:id/save — Bulk save nodes, edges, viewport.
 * Includes version conflict detection via lastSavedAt.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Rate limit: 30 saves per 15min per user
        const rl = checkRateLimit(`save:${session.userId}`);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "Too many save requests. Try again later." },
                { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
            );
        }

        const { id } = await params;

        // Verify edit permission (owner or editor collaborator)
        if (!(await canEditMap(session.userId, id))) {
            return NextResponse.json({ error: "No edit permission" }, { status: 403 });
        }

        const body = (await req.json()) as SaveBody;

        // Version conflict detection
        if (body.lastSavedAt) {
            const map = await prisma.mindmap.findUnique({
                where: { id },
                select: { updatedAt: true },
            });
            if (map) {
                const serverTime = map.updatedAt.getTime();
                const clientTime = new Date(body.lastSavedAt).getTime();
                if (serverTime > clientTime) {
                    return NextResponse.json(
                        {
                            error: "conflict",
                            message: "Someone else saved changes. Reload to get the latest version.",
                            serverUpdatedAt: map.updatedAt.toISOString(),
                        },
                        { status: 409 }
                    );
                }
            }
        }

        // Transaction: upsert all nodes + edges + viewport
        await prisma.$transaction(async (tx) => {
            // Update viewport
            if (body.viewport) {
                await tx.mindmap.update({
                    where: { id },
                    data: {
                        viewportX: body.viewport.x,
                        viewportY: body.viewport.y,
                        viewportZoom: body.viewport.zoom,
                    },
                });
            }

            if (body.nodes) {
                // Get existing node IDs
                const existingNodes = await tx.mindmapNode.findMany({
                    where: { mindmapId: id },
                    select: { id: true },
                });
                const existingIds = new Set(existingNodes.map((n) => n.id));
                const incomingIds = new Set(body.nodes.map((n) => n.id));

                // Delete removed nodes
                const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid));
                if (toDelete.length > 0) {
                    await tx.mindmapNode.deleteMany({
                        where: { id: { in: toDelete }, mindmapId: id },
                    });
                }

                // Upsert nodes
                for (const node of body.nodes) {
                    await tx.mindmapNode.upsert({
                        where: { id: node.id },
                        create: {
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
                        update: {
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
            }

            if (body.edges) {
                // Delete all edges and recreate
                await tx.mindmapEdge.deleteMany({ where: { mindmapId: id } });
                if (body.edges.length > 0) {
                    await tx.mindmapEdge.createMany({
                        data: body.edges.map((e) => ({
                            id: e.id,
                            mindmapId: id,
                            sourceId: e.source,
                            targetId: e.target,
                            type: e.type,
                        })),
                    });
                }
            }
        });

        const savedAt = new Date().toISOString();

        // Broadcast save event to other connected editors
        syncHub.broadcastSave(id, session.userId, savedAt);

        return NextResponse.json({ ok: true, savedAt });
    } catch (error) {
        console.error("Save error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
