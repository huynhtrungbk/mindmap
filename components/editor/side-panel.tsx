"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";
import { NoteEditor } from "./note-editor";
import { VersionPanel } from "./version-panel";
import { DEPTH_COLORS } from "@/lib/constants/depth-colors";

type Tab = "note" | "versions";

export function SidePanel() {
    const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
    const sidePanelMode = useMindmapStore((s) => s.sidePanelMode);
    const notePanelForced = useMindmapStore((s) => s.notePanelForced);
    const nodes = useMindmapStore((s) => s.nodes);
    const { selectNode } = useMindmapStore();
    const [tab, setTab] = useState<Tab>("note");
    const [panelWidth, setPanelWidth] = useState(380);
    const isResizing = useRef(false);
    const panelRef = useRef<HTMLElement>(null);

    // Determine visibility based on mode
    const shouldShow = (() => {
        if (sidePanelMode === "always") return true;
        if (sidePanelMode === "click-node") return !!selectedNodeId;
        if (sidePanelMode === "click-button") return notePanelForced && !!selectedNodeId;
        return !!selectedNodeId;
    })();

    // Resize handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newWidth = window.innerWidth - e.clientX;
            setPanelWidth(Math.max(250, Math.min(700, newWidth)));
        };
        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            }
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    if (!shouldShow) return null;

    // Build breadcrumb path for selected node
    const breadcrumb: Array<{ id: string; title: string; depth: number }> = [];
    if (selectedNodeId) {
        let current = nodes.find((n) => n.id === selectedNodeId);
        while (current) {
            breadcrumb.unshift({ id: current.id, title: current.title || "Untitled", depth: 0 });
            current = current.parentId ? nodes.find((n) => n.id === current!.parentId) : undefined;
        }
        breadcrumb.forEach((b, i) => { b.depth = i; });
    }

    const currentDepth = breadcrumb.length > 0 ? breadcrumb.length - 1 : 0;
    const depthColor = DEPTH_COLORS[Math.min(currentDepth, 5)];

    function handleClose() {
        selectNode(null);
        useMindmapStore.setState({ notePanelForced: false });
        setTab("note");
    }

    function handleBreadcrumbClick(nodeId: string) {
        selectNode(nodeId);
    }

    return (
        <aside className="side-panel" ref={panelRef} style={{ width: panelWidth }}>
            {/* Resize drag handle — left edge */}
            <div className="side-panel-resize" onMouseDown={handleMouseDown} />

            <div className="side-panel-header">
                <div className="side-panel-tabs">
                    <button
                        className={`side-tab ${tab === "note" ? "active" : ""}`}
                        onClick={() => setTab("note")}
                    >
                        📝 Note
                    </button>
                    <button
                        className={`side-tab ${tab === "versions" ? "active" : ""}`}
                        onClick={() => setTab("versions")}
                    >
                        📦 Versions
                    </button>
                </div>
                <div className="side-panel-right">
                    {selectedNodeId && (
                        <span className="depth-badge-inline" style={{ background: depthColor }}>
                            Level {currentDepth}
                        </span>
                    )}
                    <button className="side-panel-close" onClick={handleClose}>✕</button>
                </div>
            </div>

            {breadcrumb.length > 1 && tab === "note" && (
                <div className="side-panel-breadcrumb">
                    {breadcrumb.map((b, i) => (
                        <span key={b.id}>
                            <button
                                className={`breadcrumb-item ${i === breadcrumb.length - 1 ? "current" : ""}`}
                                onClick={() => handleBreadcrumbClick(b.id)}
                                style={{ color: DEPTH_COLORS[Math.min(b.depth, 5)] }}
                            >
                                {b.title}
                            </button>
                            {i < breadcrumb.length - 1 && <span className="breadcrumb-sep">→</span>}
                        </span>
                    ))}
                </div>
            )}

            <div className="side-panel-body">
                {tab === "note" && <NoteEditor />}
                {tab === "versions" && <VersionPanel />}
            </div>
        </aside>
    );
}
