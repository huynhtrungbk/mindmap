import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { markdownToDif } from "@/lib/converters/markdown";
import { difToMindmapNodes } from "@/lib/converters/dif";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await req.json();
        const mdText = body.mdText as string;

        if (!mdText) {
            return NextResponse.json({ error: "mdText is required" }, { status: 400 });
        }

        // Parse title from first heading
        const titleMatch = mdText.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : "Imported Mindmap";

        // Convert MD → DIF → nodes
        const dif = markdownToDif(mdText);
        const flatNodes = difToMindmapNodes(dif);

        // Create mindmap + nodes in a transaction
        const map = await prisma.$transaction(async (tx) => {
            const newMap = await tx.mindmap.create({
                data: { ownerId: session.userId, title },
            });

            // Build edges from parent-child relationships
            const edges: { id: string; sourceId: string; targetId: string; type: string }[] = [];

            for (const node of flatNodes) {
                await tx.mindmapNode.create({
                    data: {
                        id: node.id,
                        mindmapId: newMap.id,
                        parentId: node.parentId,
                        sortIndex: node.sortIndex,
                        title: node.title,
                        positionX: node.positionX,
                        positionY: node.positionY,
                        collapsed: false,
                        noteDoc: node.noteDoc as object ?? undefined,
                        notePlain: node.notePlain,
                    },
                });

                if (node.parentId) {
                    edges.push({
                        id: crypto.randomUUID(),
                        sourceId: node.parentId,
                        targetId: node.id,
                        type: "default",
                    });
                }
            }

            if (edges.length > 0) {
                await tx.mindmapEdge.createMany({
                    data: edges.map((e) => ({ ...e, mindmapId: newMap.id })),
                });
            }

            return newMap;
        });

        return NextResponse.json({ mindmapId: map.id }, { status: 201 });
    } catch (error) {
        console.error("Import MD error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
