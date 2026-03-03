import {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    Packer,
    AlignmentType,
    ExternalHyperlink,
    Table as DocxTable,
    TableRow as DocxTableRow,
    TableCell as DocxTableCell,
    WidthType,
    BorderStyle,
} from "docx";
import type { DifNode } from "./dif";
import { tiptapJsonToHtml } from "./tiptap-html";

const headingLevels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
];

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Convert DIF tree → DOCX buffer with rich note content.
 * Supports: bold, italic, underline, strikethrough, links, lists, tables, code, blockquotes.
 */
export async function difToDocx(title: string, roots: DifNode[]): Promise<Buffer> {
    const elements: (Paragraph | DocxTable)[] = [];

    // Title
    elements.push(
        new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        })
    );

    function render(nodes: DifNode[], depth: number) {
        for (const node of nodes) {
            const level = Math.min(depth, 5);

            // Node heading
            elements.push(
                new Paragraph({
                    text: node.title,
                    heading: headingLevels[level],
                    spacing: { before: 200, after: 100 },
                })
            );

            // Rich note content — parse HTML to DOCX elements
            const html = node.note.doc ? tiptapJsonToHtml(node.note.doc) : "";
            if (html.trim()) {
                const noteElements = htmlToDocxElements(html);
                elements.push(...noteElements);
            } else if (node.note.plain.trim()) {
                // Fallback: plain text note
                const noteLines = node.note.plain.trim().split("\n");
                for (const line of noteLines) {
                    elements.push(
                        new Paragraph({
                            children: [new TextRun({ text: line, size: 22 })],
                            spacing: { after: 60 },
                        })
                    );
                }
            }

            render(node.children, depth + 1);
        }
    }

    render(roots, 0);

    const doc = new Document({
        sections: [{ children: elements }],
    });

    return Buffer.from(await Packer.toBuffer(doc));
}

// ─── HTML → DOCX element converters ───

interface InlineRun {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
}

/**
 * Parse simple HTML string into DOCX Paragraph/Table elements.
 */
function htmlToDocxElements(html: string): (Paragraph | DocxTable)[] {
    const results: (Paragraph | DocxTable)[] = [];

    // Split by block-level tags
    const blocks = html.split(/(?=<(?:p|h[1-6]|ul|ol|blockquote|pre|table|hr)[\s>/])|(?<=<\/(?:p|h[1-6]|ul|ol|blockquote|pre|table)>)/);

    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        // Horizontal rule
        if (trimmed.match(/^<hr\s*\/?>/)) {
            results.push(new Paragraph({
                children: [new TextRun({ text: "─".repeat(50), color: "999999", size: 18 })],
                spacing: { before: 100, after: 100 },
            }));
            continue;
        }

        // Table
        const tableMatch = trimmed.match(/^<table>([\s\S]*?)<\/table>/);
        if (tableMatch) {
            const table = parseHtmlTable(tableMatch[1]);
            if (table) results.push(table);
            continue;
        }

        // Code block
        const preMatch = trimmed.match(/^<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
        if (preMatch) {
            const codeText = unescapeHtml(preMatch[1]);
            for (const line of codeText.split("\n")) {
                results.push(new Paragraph({
                    children: [new TextRun({
                        text: line || " ",
                        font: "Consolas",
                        size: 18,
                        color: "c4b5fd",
                    })],
                    spacing: { after: 20 },
                    shading: { fill: "1a1a2e" },
                }));
            }
            continue;
        }

        // Blockquote
        const bqMatch = trimmed.match(/^<blockquote>([\s\S]*?)<\/blockquote>/);
        if (bqMatch) {
            const runs = parseInlineHtml(bqMatch[1]);
            results.push(new Paragraph({
                children: runsToTextRuns(runs, { italic: true, color: "888888" }),
                indent: { left: 400 },
                border: { left: { style: BorderStyle.SINGLE, size: 6, color: "6c63ff" } },
                spacing: { before: 60, after: 60 },
            }));
            continue;
        }

        // Unordered list
        if (trimmed.startsWith("<ul")) {
            const items = trimmed.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
            for (const item of items) {
                const content = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/, "$1");
                const isChecked = content.includes('checked');
                const isTask = content.includes('type="checkbox"');
                const cleanContent = content.replace(/<input[^>]*\/?>/g, "").trim();
                const prefix = isTask ? (isChecked ? "☑ " : "☐ ") : "• ";
                const runs = parseInlineHtml(cleanContent);
                results.push(new Paragraph({
                    children: [new TextRun({ text: prefix, size: 22 }), ...runsToTextRuns(runs)],
                    indent: { left: 360 },
                    spacing: { after: 40 },
                }));
            }
            continue;
        }

        // Ordered list
        if (trimmed.startsWith("<ol")) {
            const items = trimmed.match(/<li>([\s\S]*?)<\/li>/g) || [];
            items.forEach((item, idx) => {
                const content = item.replace(/<li>([\s\S]*?)<\/li>/, "$1");
                const runs = parseInlineHtml(content);
                results.push(new Paragraph({
                    children: [new TextRun({ text: `${idx + 1}. `, size: 22 }), ...runsToTextRuns(runs)],
                    indent: { left: 360 },
                    spacing: { after: 40 },
                }));
            });
            continue;
        }

        // Headings inside notes
        const headingMatch = trimmed.match(/^<h([1-6])>([\s\S]*?)<\/h\1>/);
        if (headingMatch) {
            const lvl = Math.min(parseInt(headingMatch[1]) - 1, 5);
            results.push(new Paragraph({
                text: stripHtml(headingMatch[2]),
                heading: headingLevels[lvl],
                spacing: { before: 120, after: 60 },
            }));
            continue;
        }

        // Paragraph (default)
        const pContent = trimmed.replace(/^<p>([\s\S]*?)<\/p>$/, "$1");
        const runs = parseInlineHtml(pContent);
        if (runs.length > 0 && runs.some(r => r.text.trim())) {
            results.push(new Paragraph({
                children: runsToTextRuns(runs),
                spacing: { after: 60 },
            }));
        }
    }

    return results;
}

/**
 * Parse inline HTML (bold, italic, underline, strike, code, link, color) into InlineRun objects.
 */
function parseInlineHtml(html: string): InlineRun[] {
    const runs: InlineRun[] = [];
    // Simple regex-based inline parser
    let remaining = html;
    const inlinePattern = /<(strong|b|em|i|u|s|code|a|mark|span)([^>]*)>([\s\S]*?)<\/\1>/;

    while (remaining.length > 0) {
        const match = remaining.match(inlinePattern);
        if (!match) {
            // Plain text
            const text = stripHtml(remaining);
            if (text) runs.push({ text: unescapeHtml(text) });
            break;
        }

        // Text before match
        const before = remaining.slice(0, match.index);
        const plainBefore = stripHtml(before);
        if (plainBefore) runs.push({ text: unescapeHtml(plainBefore) });

        const tag = match[1];
        const attrs = match[2];
        const inner = match[3];
        const innerText = stripHtml(inner);

        const run: InlineRun = { text: unescapeHtml(innerText) };

        switch (tag) {
            case "strong": case "b": run.bold = true; break;
            case "em": case "i": run.italic = true; break;
            case "u": run.underline = true; break;
            case "s": run.strike = true; break;
            case "code": run.code = true; break;
            case "mark": run.bold = true; run.color = "f59e0b"; break;
            case "a": {
                const href = attrs.match(/href="([^"]+)"/);
                if (href) run.link = href[1];
                run.color = "6c63ff";
                run.underline = true;
                break;
            }
            case "span": {
                const color = attrs.match(/color:\s*([^;"]+)/);
                if (color) run.color = color[1].replace("#", "");
                break;
            }
        }

        runs.push(run);
        remaining = remaining.slice((match.index || 0) + match[0].length);
    }

    return runs;
}

/**
 * Convert InlineRun[] to TextRun[] with formatting.
 */
function runsToTextRuns(
    runs: InlineRun[],
    defaults: { italic?: boolean; color?: string } = {}
): (TextRun | ExternalHyperlink)[] {
    return runs.map(run => {
        const options: any = {
            text: run.text,
            size: 22,
            bold: run.bold,
            italics: run.italic || defaults.italic,
            underline: run.underline ? {} : undefined,
            strike: run.strike,
            color: run.color || defaults.color,
            font: run.code ? "Consolas" : undefined,
            shading: run.code ? { fill: "2d2d3f" } : undefined,
        };

        if (run.link) {
            return new ExternalHyperlink({
                children: [new TextRun(options)],
                link: run.link,
            });
        }

        return new TextRun(options);
    });
}

/**
 * Parse HTML table → DOCX Table.
 */
function parseHtmlTable(tableHtml: string): DocxTable | null {
    const rowMatches = tableHtml.match(/<tr>([\s\S]*?)<\/tr>/g);
    if (!rowMatches || rowMatches.length === 0) return null;

    const rows: DocxTableRow[] = [];
    let colCount = 0;

    for (const rowHtml of rowMatches) {
        const cellMatches = rowHtml.match(/<t[hd]>([\s\S]*?)<\/t[hd]>/g) || [];
        const cells: DocxTableCell[] = [];

        for (const cellHtml of cellMatches) {
            const content = cellHtml.replace(/<t[hd]>([\s\S]*?)<\/t[hd]>/, "$1");
            const isHeader = cellHtml.startsWith("<th>");
            cells.push(
                new DocxTableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: stripHtml(content) || " ",
                            size: 20,
                            bold: isHeader,
                        })],
                    })],
                    shading: isHeader ? { fill: "2d2d3f" } : undefined,
                })
            );
        }

        if (cells.length > colCount) colCount = cells.length;
        rows.push(new DocxTableRow({ children: cells }));
    }

    if (rows.length === 0) return null;

    return new DocxTable({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
    });
}

function stripHtml(str: string): string {
    return str.replace(/<[^>]+>/g, "").trim();
}

function unescapeHtml(str: string): string {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');
}
