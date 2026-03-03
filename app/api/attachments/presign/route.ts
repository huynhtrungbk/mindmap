import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Client as MinioClient } from "minio";

let _minio: MinioClient | null = null;
function getMinio(): MinioClient {
    if (!_minio) {
        const ep = (process.env.MINIO_ENDPOINT ?? "localhost").replace(/https?:\/\//, "");
        _minio = new MinioClient({
            endPoint: ep,
            port: parseInt(process.env.MINIO_PORT ?? "9000"),
            useSSL: false,
            accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
            secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
        });
    }
    return _minio;
}

const BUCKET = "mindmap";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MIME_ALLOWLIST = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf", "text/plain", "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await req.json();
        const { nodeId, filename, mime, size } = body;

        if (!nodeId || !filename || !mime || !size) {
            return NextResponse.json({ error: "nodeId, filename, mime, size required" }, { status: 400 });
        }

        if (size > MAX_SIZE) {
            return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
        }

        if (!MIME_ALLOWLIST.includes(mime)) {
            return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
        }

        const node = await prisma.mindmapNode.findUnique({
            where: { id: nodeId },
            include: { mindmap: { select: { ownerId: true } } },
        });
        if (!node || node.mindmap.ownerId !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const minio = getMinio();
        const bucketExists = await minio.bucketExists(BUCKET);
        if (!bucketExists) {
            await minio.makeBucket(BUCKET);
        }

        const objectKey = `${session.userId}/${nodeId}/${Date.now()}-${filename}`;
        const uploadUrl = await minio.presignedPutObject(BUCKET, objectKey, 15 * 60);

        return NextResponse.json({ uploadUrl, objectKey, publicUrl: `/api/attachments/${objectKey}` });
    } catch (error) {
        console.error("Presign error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
