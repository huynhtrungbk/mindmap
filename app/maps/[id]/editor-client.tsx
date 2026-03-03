"use client";

import { useEffect, useRef } from "react";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { MindmapCanvas } from "@/components/editor/mindmap-canvas";
import { SidePanel } from "@/components/editor/side-panel";
import { MarkdownView } from "@/components/editor/markdown-view";
import { DocumentView } from "@/components/editor/document-view";

import { ToastContainer, showToast } from "@/components/ui/toast";
import { useMindmapStore } from "@/stores/mindmap-store";
import type { MindmapNodeData, MindmapEdgeData } from "@/stores/mindmap-store";
import { ThemeInitializer } from "@/components/editor/theme-picker";
import { useCollabSync } from "@/hooks/use-collab-sync";
import { reloadMapFromServer } from "@/lib/reload-map";

interface Props {
    mapId: string;
    mapTitle: string;
    role: "owner" | "editor" | "viewer";
    initialNodes: MindmapNodeData[];
    initialEdges: MindmapEdgeData[];
    initialViewport: { x: number; y: number; zoom: number };
}

export function MapEditorClient({ mapId, mapTitle, role, initialNodes, initialEdges, initialViewport }: Props) {
    const isViewer = role === "viewer";
    const viewMode = useMindmapStore((s) => s.viewMode);
    const isDirty = useMindmapStore((s) => s.isDirty);
    const storeNodes = useMindmapStore((s) => s.nodes);
    const storeEdges = useMindmapStore((s) => s.edges);
    const viewport = useMindmapStore((s) => s.viewport);
    const initialized = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Real-time collaboration sync
    const { onlineUsers } = useCollabSync(mapId);

    // Initialize store ONCE on page load — never re-init
    useEffect(() => {
        if (!initialized.current) {
            useMindmapStore.getState().setMapData(mapId, initialNodes, initialEdges, initialViewport);
            useMindmapStore.setState({ mapTitle, mapRole: role });
            initialized.current = true;
        }
    }, [mapId, mapTitle, role, initialNodes, initialEdges, initialViewport]);

    const lastSavedAtRef = useRef<string | null>(null);

    // Global autosave — works in ALL view modes (disabled for viewers)
    useEffect(() => {
        if (isViewer || !isDirty || !mapId) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const s = useMindmapStore.getState();
            s.setSaving(true);
            try {
                const res = await fetch(`/api/maps/${mapId}/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lastSavedAt: lastSavedAtRef.current,
                        viewport: s.viewport,
                        nodes: s.nodes,
                        edges: s.edges,
                    }),
                });

                if (res.status === 409) {
                    showToast("⚠️ Conflict: someone else saved. Reloading…", "error");
                    await reloadMapFromServer(mapId);
                    s.setSaving(false);
                    return;
                }

                const result = await res.json();
                lastSavedAtRef.current = result.savedAt || new Date().toISOString();
                s.markSaved();
            } catch (err) {
                console.error("Autosave failed:", err);
                s.setSaving(false);
            }
        }, 2000);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [isViewer, isDirty, mapId, storeNodes, storeEdges, viewport]);

    // Warn on unsaved changes before leaving
    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            if (useMindmapStore.getState().isDirty) {
                e.preventDefault();
            }
        }
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    return (
        <div className={`editor-layout ${isViewer ? "viewer-mode" : ""}`}>
            <EditorToolbar />
            {isViewer && (
                <div className="viewer-banner">
                    👁 Read-only — You have view-only access to this mindmap
                </div>
            )}
            {onlineUsers.length > 1 && (
                <div className="collab-presence-bar">
                    <span className="presence-label">👥 Online:</span>
                    {onlineUsers.map((u) => (
                        <span key={u.userId} className="presence-user" title={u.email}>
                            <span className="presence-dot" />
                            {u.email.split("@")[0]}
                        </span>
                    ))}
                </div>
            )}
            <div className="editor-main">
                {/* MindmapCanvas stays mounted, hidden via CSS when not active */}
                <div className="mindmap-wrapper" style={{ display: viewMode === "mindmap" ? "contents" : "none" }}>
                    <MindmapCanvas />
                    <SidePanel />
                </div>
                {viewMode === "markdown" && <MarkdownView />}
                {viewMode === "document" && <DocumentView />}

            </div>
            <ThemeInitializer />
            <ToastContainer />
        </div>
    );
}
