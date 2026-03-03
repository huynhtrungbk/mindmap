"use client";

import { useEffect, useState, useRef } from "react";
import { showToast } from "@/components/ui/toast";
import { reloadMapFromServer } from "@/lib/reload-map";

interface OnlineUser {
    userId: string;
    email: string;
}

/**
 * Real-time collaboration sync hook.
 * Connects to SSE endpoint, handles:
 * - Presence (who's online)
 * - Remote save events (auto-reload map data)
 */
export function useCollabSync(mapId: string | null) {
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!mapId) return;

        const es = new EventSource(`/api/maps/${mapId}/sync`);
        eventSourceRef.current = es;

        es.addEventListener("presence", (e) => {
            try {
                const data = JSON.parse(e.data);
                setOnlineUsers(data.users || []);
            } catch { /* ignore */ }
        });

        es.addEventListener("save", (e) => {
            try {
                const data = JSON.parse(e.data);
                showToast(`Map updated by a collaborator`, "info");
                // Reload map data from server
                reloadMapFromServer(mapId);
                console.log("[collab] Remote save by:", data.savedBy, "at:", data.savedAt);
            } catch { /* ignore */ }
        });

        es.onerror = () => {
            // EventSource auto-reconnects
            console.warn("[collab] SSE connection error, reconnecting...");
        };

        return () => {
            es.close();
            eventSourceRef.current = null;
        };
    }, [mapId]);

    return { onlineUsers };
}
