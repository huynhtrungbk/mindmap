"use client";

import { useState, useRef, useCallback } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";
import type { ViewMode, SidePanelMode, LayoutMode, EdgeStyle } from "@/stores/mindmap-store";
import { showToast } from "@/components/ui/toast";
import { storeToDif } from "@/lib/converters/dif-client";
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
            showToast("Preparing PDF…", "success");
            // Build same TipTap JSON as DOC view, then render to HTML for printing
            const { nodes } = useMindmapStore.getState();
            const difTree = storeToDif(nodes);
            const html = difToHtmlForPrint(difTree, mapTitle);
            const printWin = window.open("", "_blank");
            if (!printWin) { showToast("Please allow popups to export PDF", "error"); return; }
            printWin.document.write(html);
            printWin.document.close();
            // Wait for images to load, then print
            printWin.onload = () => {
                setTimeout(() => { printWin.print(); }, 500);
            };
        } catch { showToast("PDF export failed", "error"); }
    }

    async function handleExportMindmapPDF() {
        try {
            showToast("Generating vector PDF…", "success");
            const state = useMindmapStore.getState();
            const { jsPDF } = await import("jspdf");
            const nodes = state.nodes;
            const edges = state.edges;
            if (nodes.length === 0) { showToast("No nodes to export", "error"); return; }

            // Calculate bounding box from node positions
            const PAD_H = 12, PAD_V = 6, FONT_SIZE = 11, CH_W = FONT_SIZE * 0.55;
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const DC = ["#6c63ff", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

            function getDepth(id: string): number {
                const n = nodeMap.get(id);
                if (!n || !n.parentId) return 0;
                return getDepth(n.parentId) + 1;
            }

            // Compute node boxes
            const boxes = nodes.map(n => {
                const tw = Math.max((n.title || "Untitled").length * CH_W, 40);
                const w = tw + PAD_H * 2;
                const h = FONT_SIZE + PAD_V * 2 + 4;
                return { id: n.id, x: n.positionX, y: n.positionY, w, h, title: n.title || "Untitled", depth: getDepth(n.id) };
            });

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const b of boxes) {
                minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
            }

            const margin = 40;
            const pdfW = maxX - minX + margin * 2;
            const pdfH = maxY - minY + margin * 2;
            const ox = -minX + margin;
            const oy = -minY + margin;

            const pdf = new jsPDF({
                orientation: pdfW > pdfH ? "landscape" : "portrait",
                unit: "px", format: [pdfW, pdfH],
            });

            // Background
            pdf.setFillColor(15, 15, 35);
            pdf.rect(0, 0, pdfW, pdfH, "F");

            // Draw edges as bezier curves
            for (const edge of edges) {
                const src = boxes.find(b => b.id === edge.source);
                const tgt = boxes.find(b => b.id === edge.target);
                if (!src || !tgt) continue;
                const x1 = src.x + src.w + ox, y1 = src.y + src.h / 2 + oy;
                const x2 = tgt.x + ox, y2 = tgt.y + tgt.h / 2 + oy;
                const mx = (x1 + x2) / 2;
                const col = DC[Math.min(tgt.depth, 5)];
                const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), bl = parseInt(col.slice(5, 7), 16);
                pdf.setDrawColor(r, g, bl);
                pdf.setLineWidth(1.2);
                // Approximate bezier with line segments
                const steps = 20;
                let prevX = x1, prevY = y1;
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const t2 = t * t, t3 = t2 * t;
                    const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
                    const cx = mt3 * x1 + 3 * mt2 * t * mx + 3 * mt * t2 * mx + t3 * x2;
                    const cy = mt3 * y1 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y2;
                    pdf.line(prevX, prevY, cx, cy);
                    prevX = cx; prevY = cy;
                }
            }

            // Draw nodes
            for (const b of boxes) {
                const nx = b.x + ox, ny = b.y + oy;
                const col = DC[Math.min(b.depth, 5)];
                const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), bl = parseInt(col.slice(5, 7), 16);
                // Node background
                pdf.setFillColor(30, 30, 58);
                pdf.setDrawColor(r, g, bl);
                pdf.setLineWidth(1.2);
                pdf.roundedRect(nx, ny, b.w, b.h, 4, 4, "FD");
                // Title text
                pdf.setFontSize(FONT_SIZE);
                pdf.setTextColor(224, 224, 224);
                pdf.text(b.title, nx + PAD_H, ny + PAD_V + FONT_SIZE);
            }

            pdf.save(`${mapTitle || "mindmap"} - Mindmap.pdf`);
            showToast("Exported Mindmap PDF", "success");
        } catch (err) { console.error(err); showToast("Mindmap PDF export failed", "error"); }
    }

    function handleExportMindmapHTML() {
        try {
            const state = useMindmapStore.getState();
            const { mindmapToInteractiveHtml } = require("@/lib/converters/mindmap-html-export") as typeof import("@/lib/converters/mindmap-html-export");
            const html = mindmapToInteractiveHtml(state.nodes, mapTitle, {
                nodeColor: state.nodeColor || "#1e1e3a",
                nodeTextColor: state.nodeTextColor || "#e0e0e0",
                bgColor: "#0f0f23",
            });
            const blob = new Blob([html], { type: "text/html" });
            downloadBlob(blob, `${mapTitle || "mindmap"} - Mindmap.html`);
            showToast("Exported interactive HTML", "success");
        } catch (err) { console.error(err); showToast("HTML export failed", "error"); }
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
                                <button onClick={handleExportMD}>📝 Markdown (.md)</button>
                                <button onClick={handleExportDOCX}>📄 Word (.docx)</button>
                                <button onClick={handleExportPDF}>📋 Word PDF (.pdf)</button>
                                <hr style={{ margin: '4px 8px', border: 'none', borderTop: '1px solid var(--color-border)' }} />
                                <button onClick={handleExportMindmapPDF}>🧠 Mindmap PDF (.pdf)</button>
                                <button onClick={handleExportMindmapHTML}>🌐 Mindmap HTML (.html)</button>
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DifNode } from "@/lib/converters/dif";

const PRINT_DEPTH_COLORS = ["#6c63ff", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

/**
 * Convert DIF tree to a print-ready HTML page that matches DOC view formatting.
 * Supports headings, note blockquotes with images, depth-colored accents.
 */
function difToHtmlForPrint(roots: DifNode[], title: string): string {
    let body = "";

    function renderNode(node: DifNode, depth: number) {
        const level = Math.min(depth + 1, 6);
        const col = PRINT_DEPTH_COLORS[Math.min(depth, 5)];
        const sizes = ["2em", "1.5em", "1.25em", "1.1em", "1em", "0.95em"];
        const fontSize = sizes[Math.min(depth, 5)];
        const weight = depth < 2 ? "700" : "600";

        // Heading
        body += `<h${level} style="color:${col};font-size:${fontSize};font-weight:${weight};margin:0.8em 0 0.3em;border-left:3px solid ${col};padding-left:10px">${esc(node.title || "Untitled")}</h${level}>`;

        // Note content — render from TipTap JSON doc (with images), fallback to plain text
        if (node.note.doc && typeof node.note.doc === "object") {
            const noteDoc = node.note.doc as { content?: any[] };
            if (noteDoc.content && noteDoc.content.length > 0) {
                const filtered = noteDoc.content.filter((b: any) => b.type !== "doc");
                if (filtered.length > 0) {
                    body += `<blockquote style="border-left:3px solid ${col}33;padding-left:12px;margin:0.3em 0 0.6em;color:#555">`;
                    for (const block of filtered) {
                        body += renderBlock(block);
                    }
                    body += `</blockquote>`;
                }
            }
        } else if (node.note.plain.trim()) {
            body += `<blockquote style="border-left:3px solid ${col}33;padding-left:12px;margin:0.3em 0 0.6em;color:#555">`;
            for (const line of node.note.plain.trim().split("\n")) {
                body += `<p style="margin:0.2em 0">${esc(line)}</p>`;
            }
            body += `</blockquote>`;
        }

        for (const child of node.children) {
            renderNode(child, depth + 1);
        }
    }

    for (const root of roots) {
        renderNode(root, 0);
    }

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${esc(title || "Mindmap Document")}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;color:#222;max-width:800px;margin:0 auto;padding:40px 50px;line-height:1.7}
h1,h2,h3,h4,h5,h6{line-height:1.3}
blockquote{font-style:normal}
img{max-width:100%;height:auto;border-radius:6px;margin:8px 0}
ul,ol{padding-left:1.5em;margin:0.3em 0}
code{background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em}
pre{background:#f5f5f5;padding:12px 16px;border-radius:6px;overflow-x:auto;font-family:monospace;font-size:0.85em;margin:0.4em 0}
a{color:#6c63ff}
@media print{body{padding:20px 30px;max-width:100%}}
</style>
</head>
<body>
<div style="margin-bottom:24px;border-bottom:2px solid #6c63ff;padding-bottom:16px">
<h1 style="font-size:2.2em;color:#222;margin:0;border:none;padding:0">${esc(title || "Mindmap Document")}</h1>
<p style="color:#999;font-size:0.85em;margin-top:4px">Generated: ${new Date().toLocaleDateString()}</p>
</div>
${body}
</body></html>`;
}

function renderBlock(b: any): string {
    if (!b) return "";
    if (b.type === "paragraph") {
        const inner = renderInlineNodes(b.content);
        return `<p style="margin:0.3em 0">${inner || "<br>"}</p>`;
    }
    if (b.type === "heading") {
        const lvl = b.attrs?.level || 2;
        return `<h${lvl} style="margin:0.5em 0 0.2em">${renderInlineNodes(b.content)}</h${lvl}>`;
    }
    if (b.type === "image") {
        const src = b.attrs?.src || "";
        return `<img src="${esc(src)}" style="max-width:100%;border-radius:6px;margin:6px 0"/>`;
    }
    if (b.type === "bulletList" || b.type === "orderedList") {
        const tag = b.type === "bulletList" ? "ul" : "ol";
        let items = "";
        if (b.content) {
            for (const li of b.content) {
                if (li.content) {
                    let inner = "";
                    for (const c of li.content) inner += renderBlock(c);
                    items += `<li>${inner}</li>`;
                }
            }
        }
        return `<${tag} style="padding-left:1.5em;margin:0.3em 0">${items}</${tag}>`;
    }
    if (b.type === "blockquote") {
        let inner = "";
        if (b.content) for (const c of b.content) inner += renderBlock(c);
        return `<blockquote style="border-left:3px solid #ddd;padding-left:10px;margin:0.4em 0;color:#666;font-style:italic">${inner}</blockquote>`;
    }
    if (b.type === "codeBlock") {
        return `<pre>${renderInlineNodes(b.content)}</pre>`;
    }
    if (b.type === "taskList") {
        let items = "";
        if (b.content) {
            for (const ti of b.content) {
                const checked = ti.attrs?.checked ? "☑" : "☐";
                let inner = "";
                if (ti.content) for (const c of ti.content) inner += renderBlock(c);
                items += `<div style="margin:2px 0">${checked} ${inner}</div>`;
            }
        }
        return items;
    }
    if (b.content) {
        let inner = "";
        for (const c of b.content) inner += renderBlock(c);
        return inner;
    }
    return "";
}

function renderInlineNodes(content: any[] | undefined): string {
    if (!content) return "";
    let h = "";
    for (const node of content) {
        if (node.type === "text") {
            let t = esc(node.text || "");
            if (node.marks) {
                for (const m of node.marks) {
                    if (m.type === "bold") t = `<strong>${t}</strong>`;
                    if (m.type === "italic") t = `<em>${t}</em>`;
                    if (m.type === "underline") t = `<u>${t}</u>`;
                    if (m.type === "strike") t = `<s>${t}</s>`;
                    if (m.type === "code") t = `<code>${t}</code>`;
                    if (m.type === "link" && m.attrs?.href) t = `<a href="${esc(m.attrs.href)}">${t}</a>`;
                    if (m.type === "highlight") t = `<mark>${t}</mark>`;
                }
            }
            h += t;
        }
        if (node.type === "image") {
            h += `<img src="${esc(node.attrs?.src || "")}" style="max-width:100%;border-radius:6px;margin:4px 0"/>`;
        }
        if (node.type === "hardBreak") h += "<br>";
    }
    return h;
}

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
