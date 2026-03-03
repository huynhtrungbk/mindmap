"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/react";

const HIGHLIGHT_COLORS = [
    { name: "Yellow", color: "#fef08a" },
    { name: "Green", color: "#bbf7d0" },
    { name: "Blue", color: "#bfdbfe" },
    { name: "Pink", color: "#fbcfe8" },
    { name: "Purple", color: "#e9d5ff" },
    { name: "Orange", color: "#fed7aa" },
    { name: "Red", color: "#fecaca" },
    { name: "Cyan", color: "#a5f3fc" },
];

interface Props {
    editor: Editor | null;
}

export function NoteToolbar({ editor }: Props) {
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const highlightRef = useRef<HTMLDivElement>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textColorRef = useRef<HTMLInputElement>(null);

    // Close highlight picker on outside click
    useEffect(() => {
        if (!showHighlightPicker) return;
        function handleClick(e: MouseEvent) {
            if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) {
                setShowHighlightPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [showHighlightPicker]);

    // Auto-focus link input
    useEffect(() => {
        if (showLinkInput && linkInputRef.current) linkInputRef.current.focus();
    }, [showLinkInput]);

    const handleAddLink = useCallback(() => {
        if (!editor) return;
        if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
        }
        setShowLinkInput(true);
        setLinkUrl("");
    }, [editor]);

    const handleInsertImage = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editor || !e.target.files?.length) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const src = reader.result as string;
            editor.chain().focus().setImage({ src }).run();
        };
        reader.readAsDataURL(file);
        // Reset so same file can be re-uploaded
        e.target.value = "";
    }, [editor]);

    const handleInsertImageUrl = useCallback(() => {
        if (!editor) return;
        const url = prompt("Enter image URL:");
        if (url?.trim()) {
            editor.chain().focus().setImage({ src: url.trim() }).run();
        }
    }, [editor]);

    const handleInsertTable = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }, [editor]);

    const handleTextColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editor) return;
        editor.chain().focus().setColor(e.target.value).run();
    }, [editor]);

    if (!editor) return null;

    function submitLink() {
        const url = linkUrl.trim();
        if (url) {
            const href = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
            editor!.chain().focus().setLink({ href }).run();
        }
        setShowLinkInput(false);
        setLinkUrl("");
    }

    function handleLinkKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") { e.preventDefault(); submitLink(); }
        if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); }
    }

    return (
        <div className="note-toolbar">
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*"
                style={{ display: "none" }} onChange={handleFileChange} />
            {/* Hidden native color input */}
            <input ref={textColorRef} type="color"
                style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                onChange={handleTextColorChange}
                defaultValue={editor.getAttributes("textStyle")?.color || "#ffffff"} />

            {/* Row 1: Text formatting + headings + alignment */}
            <div className="toolbar-row">
                <button onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive("bold") ? "active" : ""} title="Bold (Ctrl+B)">
                    <b>B</b>
                </button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive("italic") ? "active" : ""} title="Italic (Ctrl+I)">
                    <i>I</i>
                </button>
                <button onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive("underline") ? "active" : ""} title="Underline (Ctrl+U)">
                    <u>U</u>
                </button>
                <button onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={editor.isActive("strike") ? "active" : ""} title="Strikethrough">
                    <s>S</s>
                </button>
                <button onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    className={editor.isActive("superscript") ? "active" : ""} title="Superscript">
                    X²
                </button>
                <button onClick={() => editor.chain().focus().toggleSubscript().run()}
                    className={editor.isActive("subscript") ? "active" : ""} title="Subscript">
                    X₂
                </button>
                <span className="toolbar-sep" />
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive("heading", { level: 1 }) ? "active" : ""} title="Heading 1">
                    H1
                </button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive("heading", { level: 2 }) ? "active" : ""} title="Heading 2">
                    H2
                </button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={editor.isActive("heading", { level: 3 }) ? "active" : ""} title="Heading 3">
                    H3
                </button>
                <span className="toolbar-sep" />
                <button onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    className={editor.isActive({ textAlign: "left" }) ? "active" : ""} title="Align Left">
                    ⫷
                </button>
                <button onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    className={editor.isActive({ textAlign: "center" }) ? "active" : ""} title="Align Center">
                    ⫼
                </button>
                <button onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    className={editor.isActive({ textAlign: "right" }) ? "active" : ""} title="Align Right">
                    ⫸
                </button>
            </div>

            {/* Row 2: Blocks + media + extras */}
            <div className="toolbar-row">
                <button onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive("bulletList") ? "active" : ""} title="Bullet List">
                    •
                </button>
                <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive("orderedList") ? "active" : ""} title="Numbered List">
                    1.
                </button>
                <button onClick={() => editor.chain().focus().toggleTaskList().run()}
                    className={editor.isActive("taskList") ? "active" : ""} title="Task List">
                    ☑
                </button>
                <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={editor.isActive("blockquote") ? "active" : ""} title="Quote">
                    ❝
                </button>
                <button onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={editor.isActive("codeBlock") ? "active" : ""} title="Code Block">
                    {"</>"}
                </button>
                <button onClick={() => editor.chain().focus().toggleCode().run()}
                    className={editor.isActive("code") ? "active" : ""} title="Inline Code">
                    {"`c`"}
                </button>
                <span className="toolbar-sep" />

                {/* Link */}
                <button onClick={handleAddLink}
                    className={editor.isActive("link") ? "active" : ""}
                    title={editor.isActive("link") ? "Remove Link" : "Add Link"}>
                    {editor.isActive("link") ? "🔗✕" : "🔗"}
                </button>

                {/* Full text color picker — opens native color input */}
                <button onClick={() => textColorRef.current?.click()} title="Text Color"
                    style={{ color: editor.getAttributes("textStyle")?.color || "inherit" }}>
                    A<span style={{ display: "block", height: 2, background: editor.getAttributes("textStyle")?.color || "var(--color-primary)", borderRadius: 2, marginTop: 1 }} />
                </button>
                <button onClick={() => editor.chain().focus().unsetColor().run()} title="Reset Text Color"
                    style={{ fontSize: "0.6rem" }}>
                    A✕
                </button>

                {/* Highlight with color options */}
                <div className="toolbar-color-wrap" ref={highlightRef}>
                    <button onClick={() => setShowHighlightPicker(!showHighlightPicker)}
                        className={editor.isActive("highlight") ? "active" : ""}
                        title="Highlight">
                        🎨
                    </button>
                    {showHighlightPicker && (
                        <div className="color-picker-dropdown">
                            {HIGHLIGHT_COLORS.map((c) => (
                                <button key={c.color} className="color-swatch"
                                    style={{ background: c.color }} title={c.name}
                                    onClick={() => {
                                        editor.chain().focus().toggleHighlight({ color: c.color }).run();
                                        setShowHighlightPicker(false);
                                    }}
                                />
                            ))}
                            <button className="color-swatch color-reset" title="Remove Highlight"
                                onClick={() => {
                                    editor.chain().focus().unsetHighlight().run();
                                    setShowHighlightPicker(false);
                                }}>
                                ✕
                            </button>
                        </div>
                    )}
                </div>
                <span className="toolbar-sep" />

                {/* Image — file upload */}
                <button onClick={handleInsertImage} title="Upload Image">🖼️</button>
                {/* Image — from URL */}
                <button onClick={handleInsertImageUrl} title="Image from URL">🌐</button>

                {/* Table */}
                <button onClick={handleInsertTable} title="Insert Table 3×3">▦</button>

                {/* Contextual table controls */}
                {editor.isActive("table") && (
                    <>
                        <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column">+▮</button>
                        <button onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row">+▬</button>
                        <button onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">−▮</button>
                        <button onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">−▬</button>
                        <button onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">🗑️</button>
                    </>
                )}
                <span className="toolbar-sep" />
                <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">─</button>
            </div>

            {/* Inline link input */}
            {showLinkInput && (
                <div className="toolbar-link-input">
                    <input
                        ref={linkInputRef} type="url" className="link-url-input"
                        value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={handleLinkKeyDown}
                        onBlur={() => { if (!linkUrl.trim()) setShowLinkInput(false); }}
                        placeholder="https://example.com"
                    />
                    <button className="link-submit-btn" onClick={submitLink}>✓</button>
                    <button className="link-cancel-btn" onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}>✕</button>
                </div>
            )}
        </div>
    );
}
