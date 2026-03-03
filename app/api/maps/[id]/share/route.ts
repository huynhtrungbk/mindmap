import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isMapOwner } from "@/lib/collab";
import { checkRateLimit } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/maps/:id/share — List collaborators (owner only).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;
        if (!(await isMapOwner(session.userId, id))) {
            return NextResponse.json({ error: "Only owner can manage sharing" }, { status: 403 });
        }

        const collaborators = await prisma.mapCollaborator.findMany({
            where: { mindmapId: id },
            include: {
                user: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            collaborators: collaborators.map((c) => ({
                id: c.id,
                email: c.user?.email || c.email || "Pending",
                role: c.role,
                accepted: c.accepted,
                token: c.token,
                expiresAt: c.expiresAt?.toISOString() || null,
                createdAt: c.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("Share GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/maps/:id/share — Create invite link (owner only).
 * Body: { role?: "editor" | "viewer" }
 * Token: crypto-random 32 bytes, expires in 7 days.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;
        if (!(await isMapOwner(session.userId, id))) {
            return NextResponse.json({ error: "Only owner can share" }, { status: 403 });
        }

        // Rate limit: 10 invites per 15 minutes
        const rl = checkRateLimit(`share:${session.userId}`);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "Too many invite requests. Try again later." },
                { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
            );
        }

        const body = await req.json().catch(() => ({}));
        const role = body.role === "viewer" ? "viewer" : "editor";
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const collab = await prisma.mapCollaborator.create({
            data: {
                mindmapId: id,
                role,
                token,
                expiresAt,
            },
        });

        const baseUrl = req.nextUrl.origin;
        const inviteUrl = `${baseUrl}/invite/${collab.token}`;

        return NextResponse.json({
            token: collab.token,
            url: inviteUrl,
            role,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error) {
        console.error("Share POST error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/maps/:id/share — Remove a collaborator (owner) or leave map (self).
 * Body: { collaboratorId: string } — owner removes collaborator
 * Body: { leaveMap: true } — collaborator leaves map
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();

        // Self-removal: collaborator leaves map
        if (body.leaveMap) {
            const deleted = await prisma.mapCollaborator.deleteMany({
                where: { mindmapId: id, userId: session.userId },
            });
            if (deleted.count === 0) {
                return NextResponse.json({ error: "Not a collaborator" }, { status: 404 });
            }
            return NextResponse.json({ ok: true });
        }

        // Owner removing a collaborator
        if (!(await isMapOwner(session.userId, id))) {
            return NextResponse.json({ error: "Only owner can remove collaborators" }, { status: 403 });
        }

        if (!body.collaboratorId) {
            return NextResponse.json({ error: "collaboratorId required" }, { status: 400 });
        }

        await prisma.mapCollaborator.delete({
            where: { id: body.collaboratorId, mindmapId: id },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Share DELETE error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
