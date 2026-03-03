"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";
import { storeToDif, difToStore, difToMd, mdToDif } from "@/lib/converters/dif-client";
import { sanitizeHtml } from "@/lib/sanitize";
import { TocSidebar } from "./toc-sidebar";

export function MarkdownView() {
    const nodes = useMindmapStore((s) => s.nodes);
    const { replaceAllFromDif, pushHistory } = useMindmapStore();
    // Local override: null = use derived from store, string = user is editing
    const [localMd, setLocalMd] = useState<string | null>(null);
    const [activePane, setActivePane] = useState<"split" | "editor" | "preview">("split");
    const [cursorLevel, setCursorLevel] = useState<number>(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Derive md/preview from store nodes (pure computation, no side effects)
    const derivedMd = useMemo(() => {
        const difTree = storeToDif(nodes);
        return difToMd(difTree);
    }, [nodes]);

    const mdText = localMd ?? derivedMd;
    const preview = useMemo(() => mdToHtml(mdText), [mdText]);

    const detectCursorLevel = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const lineStart = mdText.lastIndexOf("\n", pos - 1) + 1;
        const line = mdText.slice(lineStart, mdText.indexOf("\n", pos) === -1 ? undefined : mdText.indexOf("\n", pos));
        const match = line.match(/^(#{1,6})\s/);
        setCursorLevel(match ? match[1].length : 0);
    }, [mdText]);

    const handleChange = useCallback((value: string) => {
        setLocalMd(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const difTree = mdToDif(value);
            const { nodes: newNodes, edges: newEdges } = difToStore(difTree);
            replaceAllFromDif(newNodes, newEdges);
            pushHistory();
            // Clear local override — view will now derive from store
            setLocalMd(null);
        }, 800);
    }, [replaceAllFromDif, pushHistory]);

    const lineCount = mdText.split("\n").length;

    // Extract headings from markdown text for TOC sidebar
    const tocHeadings = useMemo(() => {
        const headings: { title: string; depth: number }[] = [];
        const lines = mdText.split("\n");
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)/);
            if (match) {
                headings.push({ title: match[2].trim(), depth: match[1].length - 1 });
            }
        }
        return headings;
    }, [mdText]);

    const handleTocItemClick = useCallback((index: number) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const lines = mdText.split("\n");
        let headingIdx = 0;
        let charPos = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^#{1,6}\s+/)) {
                if (headingIdx === index) {
                    ta.focus();
                    ta.setSelectionRange(charPos, charPos);
                    // Scroll textarea to position
                    const lineHeight = ta.scrollHeight / lines.length;
                    ta.scrollTop = Math.max(0, i * lineHeight - ta.clientHeight / 3);
                    detectCursorLevel();
                    return;
                }
                headingIdx++;
            }
            charPos += lines[i].length + 1;
        }
    }, [mdText, detectCursorLevel]);

    function insertWrap(marker: string) {
        const ta = textareaRef.current;
        if (!ta) return;
        const { selectionStart: s, selectionEnd: e } = ta;
        const selected = mdText.slice(s, e) || "text";
        const newVal = mdText.slice(0, s) + marker + selected + marker + mdText.slice(e);
        handleChange(newVal);
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(s + marker.length, s + marker.length + selected.length);
        }, 10);
    }

    return (
        <div className="md-view">
            {/* Toolbar */}
            <div className="md-view-toolbar">
                <div className="md-view-tabs">
                    <button className={`md-vtab ${activePane === "editor" ? "active" : ""}`} onClick={() => setActivePane("editor")}>
                        ✏️ Editor
                    </button>
                    <button className={`md-vtab ${activePane === "split" ? "active" : ""}`} onClick={() => setActivePane("split")}>
                        ⬜ Split
                    </button>
                    <button className={`md-vtab ${activePane === "preview" ? "active" : ""}`} onClick={() => setActivePane("preview")}>
                        👁 Preview
                    </button>
                </div>
                <div className="md-level-btns">
                    {[
                        { label: "LR", prefix: "# ", title: "Root Level (H1)" },
                        { label: "L1", prefix: "## ", title: "Level 1 (H2)" },
                        { label: "L2", prefix: "### ", title: "Level 2 (H3)" },
                        { label: "L3", prefix: "#### ", title: "Level 3 (H4)" },
                        { label: "L4", prefix: "##### ", title: "Level 4 (H5)" },
                        { label: "L5", prefix: "###### ", title: "Level 5 (H6)" },
                    ].map((lv, i) => (
                        <button key={lv.label}
                            className={`md-level-btn ${cursorLevel === i + 1 ? "active" : ""}`}
                            title={lv.title}
                            onClick={() => {
                                const ta = textareaRef.current;
                                if (!ta) return;
                                const start = ta.selectionStart;
                                const lineStart = mdText.lastIndexOf("\n", start - 1) + 1;
                                const before = mdText.slice(0, lineStart);
                                const after = mdText.slice(lineStart).replace(/^#{1,6}\s*/, "");
                                const newVal = before + lv.prefix + after;
                                handleChange(newVal);
                                setTimeout(() => {
                                    ta.focus();
                                    const pos = lineStart + lv.prefix.length;
                                    ta.setSelectionRange(pos, pos);
                                }, 10);
                            }}
                        >{lv.label}</button>
                    ))}
                    <span className="md-toolbar-sep" />
                    <button className="md-fmt-btn" title="Bold" onClick={() => insertWrap("**")}>B</button>
                    <button className="md-fmt-btn" title="Italic" onClick={() => insertWrap("*")}><i>I</i></button>
                    <button className="md-fmt-btn" title="Code" onClick={() => insertWrap("`")}>`c`</button>
                    <button className="md-fmt-btn" title="Link" onClick={() => {
                        const ta = textareaRef.current;
                        if (!ta) return;
                        const { selectionStart: s, selectionEnd: e } = ta;
                        const selected = mdText.slice(s, e) || "text";
                        const newVal = mdText.slice(0, s) + `[${selected}](url)` + mdText.slice(e);
                        handleChange(newVal);
                    }}>🔗</button>
                    <button className="md-fmt-btn" title="Image" onClick={() => {
                        const ta = textareaRef.current;
                        if (!ta) return;
                        const pos = ta.selectionStart;
                        const newVal = mdText.slice(0, pos) + "![alt](url)" + mdText.slice(pos);
                        handleChange(newVal);
                    }}>🖼️</button>
                    <button className="md-fmt-btn" title="Table" onClick={() => {
                        const ta = textareaRef.current;
                        if (!ta) return;
                        const pos = ta.selectionStart;
                        const tbl = "\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n";
                        const newVal = mdText.slice(0, pos) + tbl + mdText.slice(pos);
                        handleChange(newVal);
                    }}>▦</button>
                    <button className="md-fmt-btn" title="Divider" onClick={() => {
                        const ta = textareaRef.current;
                        if (!ta) return;
                        const pos = ta.selectionStart;
                        const newVal = mdText.slice(0, pos) + "\n---\n" + mdText.slice(pos);
                        handleChange(newVal);
                    }}>─</button>
                    <button className="md-fmt-btn" title="Note Block" onClick={() => {
                        const ta = textareaRef.current;
                        if (!ta) return;
                        const pos = ta.selectionStart;
                        const newVal = mdText.slice(0, pos) + "\n:::note\nYour note here\n:::\n" + mdText.slice(pos);
                        handleChange(newVal);
                    }}>📝</button>
                </div>
                <div className="md-view-info">
                    <span>{lineCount} lines</span>
                    <span>{mdText.length} chars</span>
                </div>
            </div>

            {/* Content with TOC sidebar */}
            <div className="md-view-body">
                <TocSidebar headings={tocHeadings} onItemClick={handleTocItemClick} />
                <div className={`md-view-content md-layout-${activePane}`}>
                    {activePane !== "preview" && (
                        <div className="md-editor-pane">
                            <div className="md-editor-wrap">
                                <div className="md-line-numbers" aria-hidden="true">
                                    {Array.from({ length: lineCount }, (_, i) => (
                                        <span key={i}>{i + 1}</span>
                                    ))}
                                </div>
                                <textarea
                                    ref={textareaRef}
                                    className="md-textarea"
                                    value={mdText}
                                    onChange={(e) => handleChange(e.target.value)}
                                    onSelect={detectCursorLevel}
                                    onClick={detectCursorLevel}
                                    onKeyUp={detectCursorLevel}
                                    spellCheck={false}
                                    placeholder="# Start writing your markdown here..."
                                />
                            </div>
                        </div>
                    )}
                    {activePane !== "editor" && (
                        <div className="md-preview-pane">
                            <article
                                className="md-preview-article"
                                dangerouslySetInnerHTML={{ __html: preview }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Enhanced Markdown → HTML converter.
 * Supports: headings, bold, italic, strikethrough, code, links, images,
 * fenced code blocks, tables, task lists, callouts, horizontal rules.
 */
function mdToHtml(md: string): string {
    // Pre-process callout blocks
    let html = md.replace(/:::note\n([\s\S]*?):::/g,
        '<div class="md-callout"><span class="md-callout-icon">📝</span><div>$1</div></div>'
    );

    // Fenced code blocks (```lang ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
        const langClass = lang ? ` class="lang-${lang}"` : "";
        const escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<pre><code${langClass}>${escapedCode}</code></pre>`;
    });

    // Tables
    html = html.replace(
        /^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)+)/gm,
        (_m: string, headerRow: string, _sep: string, bodyRows: string) => {
            const headers = headerRow.split("|").filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join("");
            const rows = bodyRows.trim().split("\n").map((row: string) => {
                const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join("");
                return `<tr>${cells}</tr>`;
            }).join("");
            return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
        }
    );

    // Task lists
    html = html.replace(/^[-*+]\s+\[x\]\s+(.+)$/gm, '<li class="task-item checked"><input type="checkbox" checked disabled />$1</li>');
    html = html.replace(/^[-*+]\s+\[ \]\s+(.+)$/gm, '<li class="task-item"><input type="checkbox" disabled />$1</li>');

    // Horizontal rules
    html = html.replace(/^---+$/gm, "<hr />");
    html = html.replace(/^\*\*\*+$/gm, "<hr />");

    // Headings
    html = html
        .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
        .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
        .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Inline formatting
    html = html
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/~~(.+?)~~/g, "<s>$1</s>")
        .replace(/==(.+?)==/g, "<mark>$1</mark>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, "<br />");

    // Regular bullet lists (not task items)
    html = html.replace(/^[-*+]\s+(?!\[[ x]\])(.+)$/gm, "<li>$1</li>");

    // Wrap adjacent list items
    html = html.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, "<ul>$1</ul>");
    html = html.replace(/<\/ul>\s*<ul>/g, "");

    // Paragraphs
    html = html.replace(/\n\n/g, "</p><p>");
    html = html.replace(/\n/g, "<br>");

    return sanitizeHtml(`<p>${html}</p>`);
}
