import type { DifNode } from "./dif";
import { tiptapJsonToHtml, htmlToMarkdown } from "./tiptap-html";

/**
 * Convert DIF tree → Markdown with `:::note` blocks.
 * Uses rich HTML notes when available, falls back to plain text.
 * Depth maps to heading levels: root children = #, next = ##, etc.
 */
export function difToMarkdown(roots: DifNode[]): string {
    const lines: string[] = [];

    function render(nodes: DifNode[], depth: number) {
        for (const node of nodes) {
            const level = Math.min(depth + 1, 6);
            const prefix = "#".repeat(level);
            lines.push(`${prefix} ${node.title}`);
            lines.push("");

            // Prefer rich HTML → markdown, fallback to plain text
            const noteContent = node.note.doc
                ? htmlToMarkdown(tiptapJsonToHtml(node.note.doc))
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
 * Parse Markdown → DIF tree.
 * Priority: headings define structure. `:::note ... :::` blocks attach to nearest node.
 */
export function markdownToDif(md: string): DifNode[] {
    const lines = md.split("\n");
    const roots: DifNode[] = [];
    const stack: { node: DifNode; level: number }[] = [];

    let inNote = false;
    let noteLines: string[] = [];

    for (const line of lines) {
        if (line.trim() === ":::note") {
            inNote = true;
            noteLines = [];
            continue;
        }

        if (line.trim() === ":::" && inNote) {
            inNote = false;
            // Attach note to last node
            const last = stack[stack.length - 1];
            if (last) {
                last.node.note.plain = noteLines.join("\n");
            }
            continue;
        }

        if (inNote) {
            noteLines.push(line);
            continue;
        }

        // Parse heading
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const title = headingMatch[2].trim();
            const newNode: DifNode = {
                title,
                note: { doc: null, plain: "", html: "" },
                children: [],
            };

            // Find parent: pop stack until we find a level < current
            while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }

            if (stack.length === 0) {
                roots.push(newNode);
            } else {
                stack[stack.length - 1].node.children.push(newNode);
            }

            stack.push({ node: newNode, level });
        }
    }

    // If no headings found, try parsing bullet list outlines
    if (roots.length === 0 && lines.some((l) => l.match(/^[\s]*[-*+]\s+/))) {
        return parseBulletList(lines);
    }

    return roots;
}

function parseBulletList(lines: string[]): DifNode[] {
    const roots: DifNode[] = [];
    const stack: { node: DifNode; indent: number }[] = [];

    for (const line of lines) {
        const match = line.match(/^(\s*)([-*+])\s+(.+)/);
        if (!match) continue;

        const indent = match[1].length;
        const title = match[3].trim();
        const newNode: DifNode = {
            title,
            note: { doc: null, plain: "", html: "" },
            children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        if (stack.length === 0) {
            roots.push(newNode);
        } else {
            stack[stack.length - 1].node.children.push(newNode);
        }

        stack.push({ node: newNode, indent });
    }

    return roots;
}
