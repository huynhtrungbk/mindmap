import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { docxToDif } from "@/lib/converters/docx-import";
import { difToMindmapNodes } from "@/lib/converters/dif";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const { title, roots } = await docxToDif(buffer);
        const flatNodes = difToMindmapNodes(roots);

        const map = await prisma.$transaction(async (tx) => {
            const newMap = await tx.mindmap.create({
                data: { ownerId: session.userId, title },
            });

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
        console.error("Import DOCX error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
