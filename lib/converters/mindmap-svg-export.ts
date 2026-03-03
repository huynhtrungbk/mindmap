"use client";

import type { MindmapNodeData, MindmapEdgeData } from "@/stores/mindmap-store";

/**
 * Generate a vector SVG string from mindmap nodes and edges.
 * Used for Mindmap PDF export (vector, not raster).
 */
export function mindmapToSvg(
    nodes: MindmapNodeData[],
    edges: MindmapEdgeData[],
    opts: {
        nodeColor?: string;
        nodeTextColor?: string;
        nodeBorderColor?: string;
        bgColor?: string;
        fontSize?: number;
        paddingH?: number;
        paddingV?: number;
        edgeWidth?: number;
    } = {}
): string {
    const {
        nodeColor = "#1e1e3a",
        nodeTextColor = "#e0e0e0",
        nodeBorderColor = "#6c63ff",
        bgColor = "#0f0f23",
        fontSize = 13,
        paddingH = 12,
        paddingV = 6,
        edgeWidth = 1.5,
    } = opts;

    if (nodes.length === 0) return "<svg></svg>";

    // Measure text width (approximate: 0.6 * fontSize per char)
    const charWidth = fontSize * 0.6;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Calculate node dimensions
    interface NodeBox {
        x: number; y: number; w: number; h: number;
        cx: number; cy: number; title: string; hasNote: boolean;
        depth: number;
    }
    const childrenMap = new Map<string | null, string[]>();
    for (const n of nodes) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId)!.push(n.id);
    }
    function getDepth(id: string): number {
        const node = nodeMap.get(id);
        if (!node || !node.parentId) return 0;
        return getDepth(node.parentId) + 1;
    }

    const boxes = new Map<string, NodeBox>();
    for (const n of nodes) {
        const textW = Math.max(n.title.length * charWidth, 40);
        const w = textW + paddingH * 2;
        const h = fontSize + paddingV * 2 + 4;
        const depth = getDepth(n.id);
        boxes.set(n.id, {
            x: n.positionX, y: n.positionY,
            w, h,
            cx: n.positionX + w / 2,
            cy: n.positionY + h / 2,
            title: n.title || "Untitled",
            hasNote: !!(n.notePlain && n.notePlain.trim()),
            depth,
        });
    }

    // Bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boxes.values()) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
    }

    const pad = 40;
    const svgW = maxX - minX + pad * 2;
    const svgH = maxY - minY + pad * 2;
    const offsetX = -minX + pad;
    const offsetY = -minY + pad;

    // Depth colors for visual hierarchy
    const depthColors = ["#6c63ff", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

    // Build SVG
    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`);
    parts.push(`<rect width="100%" height="100%" fill="${bgColor}" rx="8"/>`);

    // Edges
    parts.push(`<g class="edges">`);
    for (const edge of edges) {
        const src = boxes.get(edge.source);
        const tgt = boxes.get(edge.target);
        if (!src || !tgt) continue;
        const x1 = src.x + src.w + offsetX;
        const y1 = src.cy + offsetY;
        const x2 = tgt.x + offsetX;
        const y2 = tgt.cy + offsetY;
        const mx = (x1 + x2) / 2;
        // Smooth bezier curve
        parts.push(`<path d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="${depthColors[Math.min(tgt.depth, 5)]}" stroke-width="${edgeWidth}" opacity="0.6"/>`);
    }
    parts.push(`</g>`);

    // Nodes
    parts.push(`<g class="nodes">`);
    for (const [, b] of boxes) {
        const nx = b.x + offsetX;
        const ny = b.y + offsetY;
        const borderCol = depthColors[Math.min(b.depth, 5)] || nodeBorderColor;
        // Node rect
        parts.push(`<rect x="${nx}" y="${ny}" width="${b.w}" height="${b.h}" rx="6" fill="${nodeColor}" stroke="${borderCol}" stroke-width="1.2"/>`);
        // Title text
        const textX = nx + paddingH;
        const textY = ny + paddingV + fontSize;
        parts.push(`<text x="${textX}" y="${textY}" fill="${nodeTextColor}" font-family="Inter, system-ui, sans-serif" font-size="${fontSize}">${escapeXml(b.title)}</text>`);
        // Note indicator
        if (b.hasNote) {
            parts.push(`<circle cx="${nx + b.w - 8}" cy="${ny + 8}" r="3" fill="#f59e0b" opacity="0.8"/>`);
        }
    }
    parts.push(`</g>`);
    parts.push(`</svg>`);
    return parts.join("\n");
}

function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
