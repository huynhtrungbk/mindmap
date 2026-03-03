import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

/**
 * POST /api/attachments/commit — Commit an uploaded attachment to DB.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await req.json();
        const { nodeId, objectKey, filename, mime, size } = body;

        if (!nodeId || !objectKey || !filename || !mime || !size) {
            return NextResponse.json({ error: "All fields required" }, { status: 400 });
        }

        // Verify node ownership
        const node = await prisma.mindmapNode.findUnique({
            where: { id: nodeId },
            include: { mindmap: { select: { ownerId: true } } },
        });
        if (!node || node.mindmap.ownerId !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const attachment = await prisma.attachment.create({
            data: { nodeId, objectKey, filename, mime, size },
        });

        return NextResponse.json(attachment, { status: 201 });
    } catch (error) {
        console.error("Commit error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
