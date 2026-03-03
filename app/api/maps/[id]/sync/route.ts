import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canAccessMap } from "@/lib/collab";
import { syncHub } from "@/lib/sync-hub";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/maps/:id/sync — SSE stream for real-time collaboration.
 * Clients subscribe to receive: save events, presence updates, heartbeats.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    const session = await getSession();
    if (!session) {
        return new Response("Not authenticated", { status: 401 });
    }

    const { id } = await params;
    if (!(await canAccessMap(session.userId, id))) {
        return new Response("Forbidden", { status: 403 });
    }

    const stream = new ReadableStream({
        start(controller) {
            // Register client
            syncHub.subscribe(id, session.userId, session.email, controller);

            // Send initial presence
            const presence = syncHub.getPresence(id);
            const event = `event: presence\ndata: ${JSON.stringify({ users: presence })}\n\n`;
            controller.enqueue(new TextEncoder().encode(event));

            // Heartbeat every 15s
            const heartbeatInterval = setInterval(() => {
                syncHub.heartbeat(id);
            }, 15000);

            // Cleanup on close
            _req.signal.addEventListener("abort", () => {
                clearInterval(heartbeatInterval);
                syncHub.unsubscribe(id, session.userId);
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
