"use client";

import type { MindmapNodeData, MindmapEdgeData } from "@/stores/mindmap-store";
import type { DifNode } from "./dif";
import { tiptapJsonToHtml, htmlToMarkdown } from "./tiptap-html";

/**
 * Convert store nodes (flat) → DIF tree. Client-safe version.
 */
export function storeToDif(nodes: MindmapNodeData[]): DifNode[] {
    const childrenMap = new Map<string | null, MindmapNodeData[]>();
    for (const n of nodes) {
        const pid = n.parentId;
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(n);
    }

    function buildTree(parentId: string | null): DifNode[] {
        const children = childrenMap.get(parentId) || [];
        children.sort((a, b) => a.sortIndex - b.sortIndex);
        return children.map((n) => ({
            title: n.title,
            note: {
                doc: n.noteDoc,
                plain: n.notePlain,
                html: n.noteDoc ? tiptapJsonToHtml(n.noteDoc) : "",
            },
            children: buildTree(n.id),
        }));
    }

    return buildTree(null);
}

/**
 * Convert DIF tree → flat store nodes + edges. Client-safe version.
 */
export function difToStore(difRoots: DifNode[]): {
    nodes: MindmapNodeData[];
    edges: MindmapEdgeData[];
} {
    const nodes: MindmapNodeData[] = [];
    const edges: MindmapEdgeData[] = [];
    let yCounter = 0;
    const X_GAP = 280;
    const Y_GAP = 80;

    function flattenSingle(n: DifNode, parentId: string | null, depth: number, sortIdx: number) {
        const id = crypto.randomUUID();
        const childStartY = yCounter;

        n.children.forEach((child, ci) => {
            flattenSingle(child, id, depth + 1, ci);
        });

        const childEndY = yCounter;
        const posY = n.children.length > 0
            ? ((childStartY + (childEndY > childStartY ? childEndY - 1 : childStartY)) / 2) * Y_GAP
            : yCounter++ * Y_GAP;

        nodes.push({
            id,
            parentId,
            sortIndex: sortIdx,
            title: n.title,
            positionX: depth * X_GAP,
            positionY: posY,
            collapsed: false,
            noteDoc: n.note.doc,
            notePlain: n.note.plain || "",
        });

        if (parentId) {
            edges.push({ id: crypto.randomUUID(), source: parentId, target: id, type: "default" });
        }
    }

    difRoots.forEach((n, i) => {
        flattenSingle(n, null, 0, i);
    });

    return { nodes, edges };
}

/**
 * Convert DIF → Markdown string (client-safe)
 * Uses rich HTML notes when available, falls back to plain text.
 */
export function difToMd(roots: DifNode[]): string {
    const lines: string[] = [];
    function render(nodes: DifNode[], depth: number) {
        for (const node of nodes) {
            const level = Math.min(depth + 1, 6);
            lines.push(`${"#".repeat(level)} ${node.title}`);
            lines.push("");

            // Prefer rich HTML → markdown, fallback to plain text
            const noteContent = node.note.html
                ? htmlToMarkdown(node.note.html)
                : node.note.plain.trim();

            if (noteContent) {
                lines.push(":::note");
                lines.push(noteContent);
                lines.push(":::");
                lines.push("");
            }
            render(node.children, depth + 1);
        }
    }
    render(roots, 0);
    return lines.join("\n");
}

/**
 * Parse MD → DIF (client-safe)
 */
export function mdToDif(md: string): DifNode[] {
    const lines = md.split("\n");
    const roots: DifNode[] = [];
    const stack: { node: DifNode; level: number }[] = [];
    let inNote = false;
    let noteLines: string[] = [];

    for (const line of lines) {
        if (line.trim() === ":::note") { inNote = true; noteLines = []; continue; }
        if (line.trim() === ":::" && inNote) {
            inNote = false;
            const last = stack[stack.length - 1];
            if (last) last.node.note.plain = noteLines.join("\n");
            continue;
        }
        if (inNote) { noteLines.push(line); continue; }

        const m = line.match(/^(#{1,6})\s+(.+)/);
        if (m) {
            const level = m[1].length;
            const newNode: DifNode = { title: m[2].trim(), note: { doc: null, plain: "", html: "" }, children: [] };
            while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
            if (stack.length === 0) roots.push(newNode);
            else stack[stack.length - 1].node.children.push(newNode);
            stack.push({ node: newNode, level });
        }
    }

    // Fallback: bullet lists
    if (roots.length === 0 && lines.some((l) => l.match(/^[\s]*[-*+]\s+/))) {
        for (const line of lines) {
            const m = line.match(/^(\s*)([-*+])\s+(.+)/);
            if (!m) continue;
            const indent = m[1].length;
            const newNode: DifNode = { title: m[3].trim(), note: { doc: null, plain: "", html: "" }, children: [] };
            while (stack.length > 0 && stack[stack.length - 1].level >= indent) stack.pop();
            if (stack.length === 0) roots.push(newNode);
            else stack[stack.length - 1].node.children.push(newNode);
            stack.push({ node: newNode, level: indent });
        }
    }

    return roots;
}

