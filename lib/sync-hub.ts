/**
 * In-memory sync hub for real-time collaboration.
 * Manages SSE connections and broadcasts changes across clients.
 */

type SyncClient = {
    userId: string;
    email: string;
    controller: ReadableStreamDefaultController;
    lastActive: number;
};

type MapChannel = {
    clients: Map<string, SyncClient>; // keyed by `userId`
    lastUpdate: number;
};

class SyncHub {
    private channels = new Map<string, MapChannel>();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Clean up stale clients every 30s
        this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }

    /**
     * Subscribe a client to a map channel.
     */
    subscribe(mapId: string, userId: string, email: string, controller: ReadableStreamDefaultController): void {
        if (!this.channels.has(mapId)) {
            this.channels.set(mapId, { clients: new Map(), lastUpdate: Date.now() });
        }

        const channel = this.channels.get(mapId)!;

        // Close existing connection for this user (reconnect)
        const existing = channel.clients.get(userId);
        if (existing) {
            try { existing.controller.close(); } catch { /* ignore */ }
        }

        channel.clients.set(userId, {
            userId,
            email,
            controller,
            lastActive: Date.now(),
        });

        // Notify other clients about new presence
        this.broadcastPresence(mapId);
    }

    /**
     * Unsubscribe a client from a map channel.
     */
    unsubscribe(mapId: string, userId: string): void {
        const channel = this.channels.get(mapId);
        if (!channel) return;

        channel.clients.delete(userId);
        if (channel.clients.size === 0) {
            this.channels.delete(mapId);
        } else {
            this.broadcastPresence(mapId);
        }
    }

    /**
     * Broadcast a save event to all OTHER clients on the same map.
     */
    broadcastSave(mapId: string, senderUserId: string, savedAt: string): void {
        const channel = this.channels.get(mapId);
        if (!channel) return;

        channel.lastUpdate = Date.now();
        const event = `event: save\ndata: ${JSON.stringify({ savedBy: senderUserId, savedAt })}\n\n`;

        for (const [uid, client] of channel.clients) {
            if (uid === senderUserId) continue;
            try {
                client.controller.enqueue(new TextEncoder().encode(event));
            } catch {
                channel.clients.delete(uid);
            }
        }
    }

    /**
     * Broadcast current presence (online users) to all clients on a map.
     */
    broadcastPresence(mapId: string): void {
        const channel = this.channels.get(mapId);
        if (!channel) return;

        const users = Array.from(channel.clients.values()).map(c => ({
            userId: c.userId,
            email: c.email,
        }));

        const event = `event: presence\ndata: ${JSON.stringify({ users })}\n\n`;

        for (const [, client] of channel.clients) {
            try {
                client.controller.enqueue(new TextEncoder().encode(event));
            } catch {
                channel.clients.delete(client.userId);
            }
        }
    }

    /**
     * Send a heartbeat to keep connections alive.
     */
    heartbeat(mapId: string): void {
        const channel = this.channels.get(mapId);
        if (!channel) return;

        const ping = `: heartbeat\n\n`;
        for (const [uid, client] of channel.clients) {
            try {
                client.controller.enqueue(new TextEncoder().encode(ping));
                client.lastActive = Date.now();
            } catch {
                channel.clients.delete(uid);
            }
        }
    }

    /**
     * Get online users for a map.
     */
    getPresence(mapId: string): { userId: string; email: string }[] {
        const channel = this.channels.get(mapId);
        if (!channel) return [];
        return Array.from(channel.clients.values()).map(c => ({
            userId: c.userId,
            email: c.email,
        }));
    }

    private cleanup(): void {
        const now = Date.now();
        const STALE_MS = 60000; // 60s

        for (const [mapId, channel] of this.channels) {
            for (const [uid, client] of channel.clients) {
                if (now - client.lastActive > STALE_MS) {
                    try { client.controller.close(); } catch { /* ignore */ }
                    channel.clients.delete(uid);
                }
            }
            if (channel.clients.size === 0) {
                this.channels.delete(mapId);
            }
        }
    }

    destroy(): void {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }
}

// Global singleton
export const syncHub = new SyncHub();
