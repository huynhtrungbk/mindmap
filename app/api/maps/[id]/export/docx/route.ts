import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { mindmapToDif } from "@/lib/converters/dif";
import { difToDocx } from "@/lib/converters/docx-export";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;

        const map = await prisma.mindmap.findUnique({
            where: { id },
            include: { nodes: { orderBy: { sortIndex: "asc" } } },
        });

        if (!map || map.ownerId !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const dif = mindmapToDif(map.nodes);
        const docxBuffer = await difToDocx(map.title, dif);

        return new NextResponse(new Uint8Array(docxBuffer), {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${map.title}.docx"`,
            },
        });
    } catch (error) {
        console.error("Export DOCX error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
