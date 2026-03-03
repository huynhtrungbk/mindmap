import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

type RouteParams = { params: Promise<{ token: string }> };

/**
 * GET /api/invite/:token — Accept an invitation.
 * Associates the current user with the collaboration.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session) {
            // Redirect to login with return URL
            const { token } = await params;
            const loginUrl = `/login?redirect=/invite/${token}`;
            return NextResponse.redirect(new URL(loginUrl, _req.nextUrl.origin));
        }

        const { token } = await params;

        // Find the invitation
        const collab = await prisma.mapCollaborator.findUnique({
            where: { token },
            include: { mindmap: { select: { id: true, title: true, ownerId: true } } },
        });

        if (!collab) {
            return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
        }

        // Check expiry
        if (collab.expiresAt && new Date() > collab.expiresAt) {
            return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
        }

        // Prevent owner from accepting their own invite
        if (collab.mindmap.ownerId === session.userId) {
            return NextResponse.redirect(new URL(`/maps/${collab.mindmapId}`, _req.nextUrl.origin));
        }

        // Check if user already has access
        const existing = await prisma.mapCollaborator.findFirst({
            where: { mindmapId: collab.mindmapId, userId: session.userId, accepted: true },
        });

        if (existing) {
            return NextResponse.redirect(new URL(`/maps/${collab.mindmapId}`, _req.nextUrl.origin));
        }

        // Accept invitation — either update existing or create new record
        if (!collab.userId) {
            // This is an unclaimed invite link — claim it
            await prisma.mapCollaborator.update({
                where: { id: collab.id },
                data: {
                    userId: session.userId,
                    email: session.email,
                    accepted: true,
                },
            });
        } else if (collab.userId === session.userId) {
            // Already assigned to this user — just accept
            await prisma.mapCollaborator.update({
                where: { id: collab.id },
                data: { accepted: true },
            });
        } else {
            // This invite was already claimed by someone else
            // Create new collab record for this user
            await prisma.mapCollaborator.create({
                data: {
                    mindmapId: collab.mindmapId,
                    userId: session.userId,
                    email: session.email,
                    role: collab.role,
                    accepted: true,
                },
            });
        }

        // Redirect to the map
        return NextResponse.redirect(new URL(`/maps/${collab.mindmapId}`, _req.nextUrl.origin));
    } catch (error) {
        console.error("Invite accept error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
