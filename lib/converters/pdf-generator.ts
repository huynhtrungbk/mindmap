/**
 * Shared PDF generation utility.
 * Used by both PdfView (preview) and toolbar export.
 */
import type { DifNode } from "@/lib/converters/dif";
import { htmlToPlainText } from "./tiptap-html";
import { DEPTH_COLORS_RGB } from "@/lib/constants/depth-colors";

export async function generateMindmapPdf(
    difTree: DifNode[],
    title: string
): Promise<{ blob: Blob; pageCount: number }> {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = 210;
    const margin = 25;
    const maxWidth = pageWidth - margin * 2;
    let y = margin + 5;

    // Title
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(40, 40, 40);
    pdf.text(title || "Mindmap Document", margin, y);
    y += 10;

    // Accent line
    pdf.setDrawColor(100, 90, 220);
    pdf.setLineWidth(0.8);
    pdf.line(margin, y, margin + 40, y);
    y += 3;

    // Date
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(130, 130, 130);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    y += 12;

    function checkPage() {
        if (y > 272) { pdf.addPage(); y = margin; }
    }

    function renderNode(node: DifNode, depth: number) {
        checkPage();
        const indent = margin + depth * 10;
        const availWidth = maxWidth - depth * 10;

        // Depth-aware styling
        const sizes = [18, 14, 12, 11, 10, 10];
        const fontSize = sizes[Math.min(depth, 5)];
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", depth < 2 ? "bold" : "normal");

        const [r, g, b] = DEPTH_COLORS_RGB[Math.min(depth, 5)];
        pdf.setTextColor(r, g, b);

        // Depth indicator bar
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(0.8);
        pdf.line(indent - 3, y - 3, indent - 3, y + 1);

        const prefix = depth >= 2 ? "• " : "";
        const titleLines = pdf.splitTextToSize(`${prefix}${node.title}`, availWidth);
        for (const line of titleLines) {
            checkPage();
            pdf.text(line, indent, y);
            y += fontSize * 0.45 + 1.5;
        }

        if (depth === 0) {
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.3);
            pdf.line(indent, y, indent + Math.min(availWidth, 100), y);
            y += 3;
        }

        // Note content — extract from TipTap JSON doc, fallback to notePlain
        let noteText = "";
        if (node.note.doc && typeof node.note.doc === "object") {
            noteText = extractPlainFromDoc(node.note.doc as { content?: unknown[] });
        }
        if (!noteText && node.note.html) {
            noteText = htmlToPlainText(node.note.html);
        }
        if (!noteText) {
            noteText = node.note.plain.trim();
        }

        if (noteText) {
            y += 1;
            pdf.setFontSize(9.5);
            pdf.setFont("helvetica", "italic");
            pdf.setTextColor(100, 100, 100);

            const noteStartY = y;
            const noteLines = pdf.splitTextToSize(noteText, availWidth - 6);
            const maxLines = Math.min(noteLines.length, 8);
            for (let i = 0; i < maxLines; i++) {
                checkPage();
                pdf.text(noteLines[i], indent + 5, y);
                y += 4;
            }
            if (noteLines.length > 8) {
                pdf.text(`… (${noteLines.length - 8} more lines)`, indent + 5, y);
                y += 4;
            }

            // Note accent line using depth color
            pdf.setDrawColor(r, g, b);
            pdf.setLineWidth(0.5);
            pdf.line(indent + 1.5, noteStartY - 3, indent + 1.5, y - 1);
            y += 3;
        }

        y += depth === 0 ? 5 : 2;

        for (const child of node.children) {
            renderNode(child, depth + 1);
        }
    }

    for (const root of difTree) {
        renderNode(root, 0);
    }

    // Footer
    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(160, 160, 160);
        pdf.text(`${title || "Mindmap"} — Page ${p} of ${pages}`, pageWidth / 2, 290, { align: "center" });
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.2);
        pdf.line(margin, margin - 3, pageWidth - margin, margin - 3);
    }

    return { blob: pdf.output("blob"), pageCount: pages };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Recursively extract plain text from a TipTap JSON document */
function extractPlainFromDoc(doc: { content?: unknown[] }): string {
    if (!doc || !doc.content) return "";
    const lines: string[] = [];
    function walk(nodes: any[]) {
        for (const node of nodes) {
            if (node.type === "text" && node.text) {
                lines.push(node.text);
            } else if (node.content) {
                walk(node.content);
                lines.push("\n");
            }
        }
    }
    walk(doc.content as any[]);
    return lines.join("").replace(/\n{3,}/g, "\n\n").trim();
}
