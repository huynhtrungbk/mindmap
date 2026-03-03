"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { useMindmapStore } from "@/stores/mindmap-store";
import { storeToDif, difToStore } from "@/lib/converters/dif-client";
import { NoteToolbar } from "./note-toolbar";
import type { DifNode } from "@/lib/converters/dif";
import { TocSidebar } from "./toc-sidebar";

export function DocumentView() {
    const nodes = useMindmapStore((s) => s.nodes);
    const mapTitle = useMindmapStore((s) => s.mapTitle);
    const { replaceAllFromDif, pushHistory } = useMindmapStore();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInternalUpdate = useRef(false);

    // Force re-render on cursor movement so level buttons update instantly
    const [, setSelTick] = useState(0);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: "Start writing your document…" }),
            Underline,
            Link.configure({ openOnClick: false, HTMLAttributes: { class: "tiptap-link" } }),
            Highlight.configure({ multicolor: false }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Color,
            TextStyle,
        ],
        content: "",
        immediatelyRender: false,
        editorProps: {
            attributes: { class: "doc-tiptap-editor" },
        },
        onSelectionUpdate: () => {
            setSelTick((t) => t + 1);
        },
        onUpdate: ({ editor: ed }) => {
            setSelTick((t) => t + 1);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                isInternalUpdate.current = true;
                const difTree = tiptapJsonToDif(ed.getJSON());
                const { nodes: newNodes, edges: newEdges } = difToStore(difTree);
                replaceAllFromDif(newNodes, newEdges);
                pushHistory();
            }, 800);
        },
    });

    // Sync store → TipTap editor (external system, not React state)
    useEffect(() => {
        if (!editor || isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }
        const difTree = storeToDif(nodes);
        const tiptapJson = difToTiptapJson(difTree);
        editor.commands.setContent(tiptapJson);
    }, [editor, nodes]);

    // Word count
    const wordCount = editor?.getText().split(/\s+/).filter(Boolean).length ?? 0;

    // Extract headings from DIF tree for TOC sidebar
    const tocHeadings = useMemo(() => {
        const headings: { title: string; depth: number }[] = [];
        function walk(items: DifNode[], depth: number) {
            for (const item of items) {
                headings.push({ title: item.title, depth });
                walk(item.children, depth + 1);
            }
        }
        walk(storeToDif(nodes), 0);
        return headings;
    }, [nodes]);

    const handleTocClick = useCallback((index: number) => {
        if (!editor) return;
        const doc = editor.state.doc;
        let headingIdx = 0;
        let pos = 0;
        doc.descendants((node, nodePos) => {
            if (node.type.name === "heading") {
                if (headingIdx === index) {
                    pos = nodePos;
                    return false;
                }
                headingIdx++;
            }
        });
        editor.chain().focus().setTextSelection(pos + 1).run();
        // Scroll into view
        const domNode = editor.view.domAtPos(pos + 1)?.node;
        if (domNode instanceof HTMLElement) {
            domNode.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [editor]);

    // Resizable paper width
    const [paperWidth, setPaperWidth] = useState(780);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartWidth = useRef(780);
    const dragSide = useRef<"left" | "right">("right");

    const handleResizeStart = useCallback((e: React.PointerEvent, side: "left" | "right") => {
        e.preventDefault();
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartWidth.current = paperWidth;
        dragSide.current = side;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";

        const handleMove = (ev: PointerEvent) => {
            if (!isDragging.current) return;
            const dx = ev.clientX - dragStartX.current;
            // Symmetric: dragging right side right = wider, left side left = wider
            const delta = dragSide.current === "right" ? dx : -dx;
            // Multiply by 2 for symmetric expansion from center
            const newW = Math.max(400, Math.min(1400, dragStartWidth.current + delta * 2));
            setPaperWidth(newW);
        };
        const handleUp = () => {
            isDragging.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("pointermove", handleMove);
            document.removeEventListener("pointerup", handleUp);
        };
        document.addEventListener("pointermove", handleMove);
        document.addEventListener("pointerup", handleUp);
    }, [paperWidth]);

    return (
        <div className="doc-view">
            <div className="doc-view-toolbar">
                <span className="doc-view-title">📄 {mapTitle || "Untitled Document"}</span>
                <div className="doc-view-stats">
                    <span>{wordCount} words</span>
                </div>
            </div>
            {/* Level heading toolbar */}
            <div className="doc-level-bar">
                {[
                    { label: "LR", level: 1 as const, title: "Root Level (H1)" },
                    { label: "L1", level: 2 as const, title: "Level 1 (H2)" },
                    { label: "L2", level: 3 as const, title: "Level 2 (H3)" },
                    { label: "L3", level: 4 as const, title: "Level 3 (H4)" },
                    { label: "L4", level: 5 as const, title: "Level 4 (H5)" },
                    { label: "L5", level: 6 as const, title: "Level 5 (H6)" },
                ].map((lv) => (
                    <button key={lv.label}
                        className={`doc-level-btn ${editor?.isActive("heading", { level: lv.level }) ? "active" : ""}`}
                        title={lv.title}
                        onClick={() => editor?.chain().focus().toggleHeading({ level: lv.level }).run()}
                    >{lv.label}</button>
                ))}
                <button className="doc-level-btn"
                    title="Normal text"
                    onClick={() => editor?.chain().focus().setParagraph().run()}
                >¶</button>
                <button className={`doc-level-btn ${editor?.isActive("blockquote") ? "active" : ""}`}
                    title="Note / Blockquote"
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                >📝</button>
            </div>
            {/* Formatting toolbar */}
            <NoteToolbar editor={editor} />
            <div className="doc-view-body">
                <TocSidebar headings={tocHeadings} onItemClick={handleTocClick} />
                <div className="doc-view-scroll">
                    <div className="doc-paper-wrap">
                        <div
                            className="doc-resize-handle doc-resize-left"
                            onPointerDown={(e) => handleResizeStart(e, "left")}
                            title="Drag to resize"
                        />
                        <div className="doc-paper" style={{ maxWidth: paperWidth }}>
                            <EditorContent editor={editor} />
                        </div>
                        <div
                            className="doc-resize-handle doc-resize-right"
                            onPointerDown={(e) => handleResizeStart(e, "right")}
                            title="Drag to resize"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Convert DIF tree → Tiptap JSON document.
 * Embeds rich note content (from noteDoc) directly as Tiptap JSON nodes.
 * Falls back to plain text paragraphs if no rich doc available.
 * Adds depth-colored horizontal rule markers between heading levels.
 */
function difToTiptapJson(roots: DifNode[]): Record<string, unknown> {
    const content: Record<string, unknown>[] = [];

    function render(nodes: DifNode[], depth: number) {
        for (const n of nodes) {
            const level = Math.min(depth + 1, 6);

            // Heading with depth color marker
            content.push({
                type: "heading",
                attrs: { level },
                content: [{ type: "text", text: n.title || "Untitled" }],
            });

            // Note content — prefer rich Tiptap JSON, fallback to plain text
            if (n.note.doc && typeof n.note.doc === "object") {
                const noteDoc = n.note.doc as { content?: any[] };
                if (noteDoc.content && noteDoc.content.length > 0) {
                    // Wrap note content in a blockquote for visual distinction
                    const noteContent = noteDoc.content.filter(
                        (block: any) => block.type !== "doc"
                    );
                    if (noteContent.length > 0) {
                        content.push({
                            type: "blockquote",
                            content: noteContent,
                        });
                    }
                }
            } else if (n.note.plain.trim()) {
                // Fallback: plain text as blockquote paragraphs
                const blockContent: any[] = [];
                for (const line of n.note.plain.trim().split("\n")) {
                    blockContent.push({
                        type: "paragraph",
                        content: line.trim() ? [{ type: "text", text: line }] : undefined,
                    });
                }
                content.push({
                    type: "blockquote",
                    content: blockContent,
                });
            }

            render(n.children, depth + 1);
        }
    }

    render(roots, 0);

    return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

function tiptapJsonToDif(json: Record<string, unknown>): DifNode[] {
    const content = (json.content || []) as Array<{
        type: string;
        attrs?: { level?: number };
        content?: Array<{ text?: string; type?: string; content?: any[] }>;
    }>;
    const roots: DifNode[] = [];
    const stack: { node: DifNode; level: number }[] = [];

    for (let i = 0; i < content.length; i++) {
        const item = content[i];
        if (item.type === "heading" && item.attrs?.level) {
            const level = item.attrs.level;
            const title = item.content?.map((c) => c.text || "").join("") || "";
            const newNode: DifNode = { title, note: { doc: null, plain: "", html: "" }, children: [] };

            // Look ahead for note content (blockquotes or paragraphs before next heading)
            const noteBlocks: any[] = [];
            const noteLines: string[] = [];
            let j = i + 1;
            while (j < content.length && content[j].type !== "heading") {
                const block = content[j];
                if (block.type === "blockquote" && block.content) {
                    // Rich note — store as Tiptap doc
                    noteBlocks.push(...block.content);
                    // Also extract plain text
                    for (const innerBlock of block.content) {
                        if (innerBlock.content) {
                            const text = innerBlock.content.map((c: any) => c.text || "").join("");
                            if (text.trim()) noteLines.push(text);
                        }
                    }
                } else if (block.type === "paragraph") {
                    const text = block.content?.map((c) => c.text || "").join("") || "";
                    if (text.trim()) {
                        noteLines.push(text);
                        noteBlocks.push(block);
                    }
                }
                j++;
            }

            if (noteBlocks.length > 0) {
                newNode.note.doc = { type: "doc", content: noteBlocks };
                newNode.note.plain = noteLines.join("\n");
            }

            while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
            if (stack.length === 0) roots.push(newNode);
            else stack[stack.length - 1].node.children.push(newNode);
            stack.push({ node: newNode, level });
        }
    }
    return roots;
}
