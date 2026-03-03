import mammoth from "mammoth";
import type { DifNode } from "./dif";

/**
 * Parse DOCX buffer → DIF tree.
 * Uses headings for structure, content between headings as notes.
 */
export async function docxToDif(buffer: Buffer): Promise<{ title: string; roots: DifNode[] }> {
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;

    // Simple HTML parsing via regex (sufficient for structured docs)
    const elements: Array<{ type: "heading"; level: number; text: string } | { type: "text"; text: string }> = [];

    const tagRegex = /<(h[1-6]|p|li)[^>]*>(.*?)<\/\1>/gi;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const text = match[2].replace(/<[^>]+>/g, "").trim();
        if (!text) continue;

        if (tag.startsWith("h")) {
            const level = parseInt(tag[1]);
            elements.push({ type: "heading", level, text });
        } else {
            elements.push({ type: "text", text });
        }
    }

    // Build tree from headings
    const roots: DifNode[] = [];
    const stack: { node: DifNode; level: number }[] = [];
    let title = "Imported Document";

    for (const el of elements) {
        if (el.type === "heading") {
            if (roots.length === 0 && stack.length === 0) {
                title = el.text;
            }

            const newNode: DifNode = {
                title: el.text,
                note: { doc: null, plain: "", html: "" },
                children: [],
            };

            while (stack.length > 0 && stack[stack.length - 1].level >= el.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                roots.push(newNode);
            } else {
                stack[stack.length - 1].node.children.push(newNode);
            }

            stack.push({ node: newNode, level: el.level });
        } else if (el.type === "text" && stack.length > 0) {
            // Append to last heading's note
            const last = stack[stack.length - 1];
            if (last.node.note.plain) {
                last.node.note.plain += "\n" + el.text;
            } else {
                last.node.note.plain = el.text;
            }
        }
    }

    // If no headings, create single root with all text
    if (roots.length === 0) {
        const allText = elements.map((e) => e.text).join("\n");
        roots.push({
            title,
            note: { doc: null, plain: allText, html: "" },
            children: [],
        });
    }

    return { title, roots };
}
