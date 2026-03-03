"use client";

import { useState, useRef, useCallback } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";
import type { ViewMode, SidePanelMode, LayoutMode, EdgeStyle } from "@/stores/mindmap-store";
import { showToast } from "@/components/ui/toast";
import { storeToDif } from "@/lib/converters/dif-client";
import { generateMindmapPdf } from "@/lib/converters/pdf-generator";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";
import { ThemePicker } from "./theme-picker";
import { NodeStyleDialog } from "./node-style-dialog";
import { ShareDialog } from "./share-dialog";
import { reloadMapFromServer } from "@/lib/reload-map";

export function EditorToolbar() {
    const {
        mapId, mapTitle, mapRole, setMapTitle, viewMode, setViewMode,
        addNode, selectedNodeId, addSibling, deleteNode,
        undo, redo, isDirty, isSaving, lastSaved,
        pushHistory, sidePanelMode, setSidePanelMode,
        expandAll, collapseAll,
        layoutMode, edgeStyle, setLayoutMode, setEdgeStyle, triggerAutoLayout,
    } = useMindmapStore();

    const isOwner = mapRole === "owner";
    const isViewer = mapRole === "viewer";

    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState(mapTitle);
    const titleRef = useRef<HTMLInputElement>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showNodeStyle, setShowNodeStyle] = useState(false);
    const [showShare, setShowShare] = useState(false);

    // Export handlers
    async function handleExportMD() {
        if (!mapId) return;
        try {
            const res = await fetch(`/api/maps/${mapId}/export/md`, { method: "POST" });
            const text = await res.text();
            const blob = new Blob([text], { type: "text/markdown" });
            downloadBlob(blob, `${mapTitle || "mindmap"}.md`);
            showToast("Exported as Markdown", "success");
        } catch { showToast("Export failed", "error"); }
    }

    async function handleExportDOCX() {
        if (!mapId) return;
        try {
            const res = await fetch(`/api/maps/${mapId}/export/docx`, { method: "POST" });
            const blob = await res.blob();
            downloadBlob(blob, `${mapTitle || "mindmap"}.docx`);
            showToast("Exported as DOCX", "success");
        } catch { showToast("Export failed", "error"); }
    }

    async function handleExportPDF() {
        try {
            const { nodes } = useMindmapStore.getState();
            const difTree = storeToDif(nodes);
            const { blob } = await generateMindmapPdf(difTree, mapTitle);
            downloadBlob(blob, `${mapTitle || "mindmap"}.pdf`);
            showToast("Exported as PDF", "success");
        } catch { showToast("PDF export failed", "error"); }
    }

    function downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    // Import
    const fileRef = useRef<HTMLInputElement>(null);
    function handleImportClick() { fileRef.current?.click(); }

    const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            if (file.name.endsWith(".md") || file.type === "text/markdown") {
                const text = await file.text();
                const res = await fetch("/api/import/md", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mdText: text }),
                });
                const data = await res.json();
                showToast("Imported Markdown → new mindmap", "success");
                window.location.href = `/maps/${data.mindmapId}`;
            } else if (file.name.endsWith(".docx")) {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/import/docx", { method: "POST", body: formData });
                const data = await res.json();
                showToast("Imported DOCX → new mindmap", "success");
                window.location.href = `/maps/${data.mindmapId}`;
            } else {
                showToast("Unsupported file type. Use .md or .docx", "error");
            }
        } catch { showToast("Import failed", "error"); }
        if (fileRef.current) fileRef.current.value = "";
    }, []);

    // Title editing
    function startEditTitle() {
        setTitleInput(mapTitle);
        setEditingTitle(true);
        setTimeout(() => titleRef.current?.focus(), 50);
    }

    function saveTitle() {
        setEditingTitle(false);
        if (titleInput.trim() && titleInput !== mapTitle) {
            setMapTitle(titleInput.trim());
            pushHistory();
            if (mapId) {
                fetch(`/api/maps/${mapId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: titleInput.trim() }),
                });
            }
        }
    }

    // Node actions
    function handleAddRoot() { addNode(null, "New Topic"); pushHistory(); }
    function handleAddChild() { if (!selectedNodeId) return; addNode(selectedNodeId, ""); pushHistory(); }
    function handleAddSibling() { if (!selectedNodeId) return; addSibling(selectedNodeId); pushHistory(); }
    function handleDelete() { if (!selectedNodeId) return; deleteNode(selectedNodeId); pushHistory(); }

    // Save
    async function handleSave() {
        if (!mapId || isSaving || isViewer) return;
        const s = useMindmapStore.getState();
        s.setSaving(true);
        try {
            const res = await fetch(`/api/maps/${mapId}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ viewport: s.viewport, nodes: s.nodes, edges: s.edges }),
            });
            if (res.status === 409) {
                showToast("⚠️ Conflict: another user saved. Auto-reloading…", "error");
                await reloadMapFromServer(mapId);
                s.setSaving(false);
                return;
            }
            s.markSaved();
            showToast("Saved", "success");
        } catch { showToast("Save failed", "error"); s.setSaving(false); }
    }

    const saveStatus = isSaving ? "Saving…" : isDirty ? "Unsaved" : lastSaved ? "Saved" : "";

    const viewTabs: { mode: ViewMode; icon: string; label: string }[] = [
        { mode: "mindmap", icon: "🧠", label: "Map" },
        { mode: "markdown", icon: "📝", label: "MD" },
        { mode: "document", icon: "📄", label: "Doc" },
        { mode: "pdf", icon: "📋", label: "PDF" },
    ];

    const panelModes: { mode: SidePanelMode; label: string }[] = [
        { mode: "always", label: "Always Show" },
        { mode: "click-node", label: "On Click Node" },
        { mode: "click-button", label: "On Click Button" },
    ];

    const layoutModes: { mode: LayoutMode; label: string; icon: string }[] = [
        { mode: "auto", label: "Luôn tự sắp xếp", icon: "🔄" },
        { mode: "free", label: "Tùy chỉnh tự do", icon: "✋" },
        { mode: "once", label: "Sắp xếp → Tùy chỉnh", icon: "📐" },
    ];

    const edgeStyles: { style: EdgeStyle; label: string; icon: string }[] = [
        { style: "smoothstep", label: "Smooth Step", icon: "〰️" },
        { style: "straight", label: "Thẳng", icon: "─" },
        { style: "bezier", label: "Bezier (Cong)", icon: "⌒" },
        { style: "step", label: "Vuông góc", icon: "⌐" },
        { style: "animated", label: "Animated", icon: "⚡" },
        { style: "dashed", label: "Nét đứt", icon: "┄" },
        { style: "gradient", label: "Gradient", icon: "🌈" },
        { style: "neon", label: "Neon Glow", icon: "💚" },
    ];

    function handleLayoutChange(mode: LayoutMode) {
        setLayoutMode(mode);
        if (mode === "once") {
            triggerAutoLayout();
            pushHistory();
            // After auto-layout, switch to "free" so user can customize
            setTimeout(() => setLayoutMode("free"), 100);
        } else if (mode === "auto") {
            triggerAutoLayout();
            pushHistory();
        }
    }

    return (
        <>
            <header className="editor-toolbar">
                <a href="/dashboard" className="toolbar-back" title="Dashboard">←</a>

                {editingTitle ? (
                    <input
                        ref={titleRef}
                        className="toolbar-title-input"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    />
                ) : (
                    <span className="toolbar-title" onClick={startEditTitle} title="Click to rename">
                        {mapTitle || "Untitled"}
                    </span>
                )}

                <div className="view-switcher">
                    {viewTabs.map((t) => (
                        <button
                            key={t.mode}
                            className={`view-tab ${viewMode === t.mode ? "active" : ""}`}
                            onClick={() => setViewMode(t.mode)}
                            title={t.label}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {viewMode === "mindmap" && (
                    <div className="toolbar-actions">
                        <button onClick={handleAddRoot} title="Add root topic">➕ Root</button>
                        <button onClick={handleAddChild} disabled={!selectedNodeId} title="Add child (Ctrl+Enter)">↳ Child</button>
                        <button onClick={handleAddSibling} disabled={!selectedNodeId} title="Add sibling (Enter)">↔ Sibling</button>
                        <button onClick={handleDelete} disabled={!selectedNodeId} title="Delete (Del)">🗑</button>
                        <span className="toolbar-sep" />
                        <button onClick={undo} title="Undo (Ctrl+Z)">↩</button>
                        <button onClick={redo} title="Redo (Ctrl+Y)">↪</button>
                        <span className="toolbar-sep" />
                        <button onClick={() => { expandAll(); pushHistory(); }} title="Expand All">⊞</button>
                        <button onClick={() => { collapseAll(); pushHistory(); }} title="Collapse All">⊟</button>
                        <span className="toolbar-sep" />
                        <div className="toolbar-dropdown">
                            <button title="Export">📤 Export</button>
                            <div className="dropdown-menu">
                                <button onClick={handleExportMD}>Markdown (.md)</button>
                                <button onClick={handleExportDOCX}>Word (.docx)</button>
                                <button onClick={handleExportPDF}>PDF (.pdf)</button>
                            </div>
                        </div>
                        <button onClick={handleImportClick} title="Import .md / .docx">📥 Import</button>
                        <input ref={fileRef} type="file" accept=".md,.docx" style={{ display: "none" }} onChange={handleImportFile} />
                    </div>
                )}

                {/* Right-side utility buttons */}
                <div className="toolbar-save-group">
                    {/* Settings dropdown */}
                    <div className="toolbar-dropdown">
                        <button title="Settings">⚙️</button>
                        <div className="dropdown-menu dropdown-menu-right mega-menu">
                            <div className="mega-menu-grid">
                                <div className="mega-menu-col">
                                    <div className="dropdown-label">📝 Note Panel</div>
                                    {panelModes.map((pm) => (
                                        <button
                                            key={pm.mode}
                                            className={sidePanelMode === pm.mode ? "dropdown-active" : ""}
                                            onClick={() => setSidePanelMode(pm.mode)}
                                        >
                                            {sidePanelMode === pm.mode ? "✓ " : "  "}{pm.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="mega-menu-col">
                                    <div className="dropdown-label">📐 Layout</div>
                                    {layoutModes.map((lm) => (
                                        <button
                                            key={lm.mode}
                                            className={layoutMode === lm.mode ? "dropdown-active" : ""}
                                            onClick={() => handleLayoutChange(lm.mode)}
                                        >
                                            {layoutMode === lm.mode ? "✓ " : "  "}{lm.icon} {lm.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="mega-menu-col">
                                    <div className="dropdown-label">🔗 Edge Style</div>
                                    {edgeStyles.map((es) => (
                                        <button
                                            key={es.style}
                                            className={edgeStyle === es.style ? "dropdown-active" : ""}
                                            onClick={() => setEdgeStyle(es.style)}
                                        >
                                            {edgeStyle === es.style ? "✓ " : "  "}{es.icon} {es.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <button onClick={() => setShowNodeStyle(true)} title="Node Style">📐</button>
                    <button onClick={() => setShowThemePicker(true)} title="Theme">🎨</button>
                    <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts">❓</button>
                    <button onClick={() => setShowShare(true)} title="Share & Collaborate">🔗 Share</button>
                    <span className="toolbar-sep" />

                    <button
                        className={`btn-save ${isDirty ? "dirty" : ""}`}
                        onClick={handleSave}
                        disabled={isSaving || !isDirty}
                        title="Save now (Ctrl+S)"
                    >
                        💾 {isSaving ? "Saving…" : "Save"}
                    </button>
                    <span className={`save-status ${isDirty ? "unsaved" : "saved"}`}>{saveStatus}</span>
                </div>
            </header>

            {/* Dialogs */}
            {showShortcuts && <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} />}
            {showThemePicker && <ThemePicker onClose={() => setShowThemePicker(false)} />}
            {showNodeStyle && <NodeStyleDialog onClose={() => setShowNodeStyle(false)} />}
            {showShare && <ShareDialog mapId={mapId || ""} isOwner={isOwner} onClose={() => setShowShare(false)} />}
        </>
    );
}
