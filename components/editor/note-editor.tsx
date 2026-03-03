"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { useEffect, useRef, useCallback } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";
import { NoteToolbar } from "./note-toolbar";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

export function NoteEditor() {
    const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
    const nodes = useMindmapStore((s) => s.nodes);
    const { updateNodeNote, pushHistory } = useMindmapStore();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentNodeId = useRef<string | null>(null);

    const selectedNode = nodes.find((n) => n.id === selectedNodeId);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: "Write a note…" }),
            Underline,
            Link.configure({ openOnClick: false, HTMLAttributes: { class: "tiptap-link" } }),
            Highlight.configure({ multicolor: true }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Color,
            TextStyle,
            Image.configure({ inline: false, allowBase64: true }),
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Superscript,
            Subscript,
        ],
        content: "",
        immediatelyRender: false,
        editorProps: {
            attributes: { class: "tiptap" },
        },
        onUpdate: ({ editor: ed }) => {
            if (!currentNodeId.current) return;
            const nodeId = currentNodeId.current;
            const doc = ed.getJSON();
            const plain = ed.getText();

            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                updateNodeNote(nodeId, doc, plain);
                pushHistory();
            }, 500);
        },
    });

    const syncContent = useCallback(() => {
        if (!editor) return;
        if (!selectedNode) {
            currentNodeId.current = null;
            editor.commands.setContent("");
            return;
        }
        if (currentNodeId.current === selectedNode.id) return;
        currentNodeId.current = selectedNode.id;
        const content = selectedNode.noteDoc || "";
        editor.commands.setContent(content as Parameters<typeof editor.commands.setContent>[0]);
    }, [editor, selectedNode]);

    useEffect(() => { syncContent(); }, [syncContent]);

    if (!selectedNode) {
        return (
            <div className="note-editor-empty">
                <p>Select a node to edit its note</p>
            </div>
        );
    }

    return (
        <div className="note-editor">
            <div className="note-editor-header">
                <h4>{selectedNode.title || "Untitled"}</h4>
            </div>
            <NoteToolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}
