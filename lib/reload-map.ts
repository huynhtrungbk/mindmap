"use client";

import { useMindmapStore } from "@/stores/mindmap-store";

/**
 * Shared helper to reload map data from server into Zustand store.
 * Used by: autosave conflict handler, toolbar manual save, collab sync.
 */
export async function reloadMapFromServer(mapId: string): Promise<boolean> {
    try {
        const res = await fetch(`/api/maps/${mapId}`);
        if (!res.ok) return false;
        const data = await res.json();

        const nodes = (data.nodes || []).map((n: Record<string, unknown>) => ({
            id: n.id,
            parentId: n.parentId,
            title: n.title,
            positionX: n.positionX,
            positionY: n.positionY,
            sortIndex: n.sortIndex,
            collapsed: n.collapsed,
            noteDoc: n.noteDoc ?? null,
            notePlain: n.notePlain ?? "",
        }));

        const edges = (data.edges || []).map((e: Record<string, unknown>) => ({
            id: e.id,
            source: e.sourceId,
            target: e.targetId,
            type: e.type ?? "default",
        }));

        const viewport = {
            x: data.viewportX ?? 0,
            y: data.viewportY ?? 0,
            zoom: data.viewportZoom ?? 1,
        };

        useMindmapStore.getState().setMapData(mapId, nodes, edges, viewport);
        return true;
    } catch (err) {
        console.error("Map reload error:", err);
        return false;
    }
}
