import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { mindmapToDif } from "@/lib/converters/dif";
import { difToMarkdown } from "@/lib/converters/markdown";

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
        const md = `# ${map.title}\n\n${difToMarkdown(dif)}`;

        return new NextResponse(md, {
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Content-Disposition": `attachment; filename="${map.title}.md"`,
            },
        });
    } catch (error) {
        console.error("Export MD error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
