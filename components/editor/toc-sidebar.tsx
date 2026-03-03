"use client";

import { useMemo } from "react";

export interface TocItem {
    id: string;
    title: string;
    level: number;
    number: string; // e.g. "1", "1.1", "1.1.2"
}

/**
 * Extract headings from a flat list of { title, depth } items.
 * Returns a numbered TOC with hierarchical numbering like 1, 1.1, 1.1.1, etc.
 */
export function buildToc(
    headings: { title: string; depth: number }[]
): TocItem[] {
    const counters: number[] = [0, 0, 0, 0, 0, 0]; // 6 levels
    const items: TocItem[] = [];

    for (const h of headings) {
        const lvl = Math.min(Math.max(h.depth, 0), 5);

        // Increment counter at this level
        counters[lvl]++;

        // Reset all deeper counters
        for (let i = lvl + 1; i < 6; i++) counters[i] = 0;

        // Build number string: join all non-zero counters up to this level
        const parts: number[] = [];
        for (let i = 0; i <= lvl; i++) {
            if (counters[i] > 0) parts.push(counters[i]);
        }
        const number = parts.join(".");

        items.push({
            id: `toc-${items.length}`,
            title: h.title || "Untitled",
            level: lvl,
            number,
        });
    }

    return items;
}

interface TocSidebarProps {
    headings: { title: string; depth: number }[];
    onItemClick?: (index: number) => void;
    activeIndex?: number;
}

export function TocSidebar({ headings, onItemClick, activeIndex }: TocSidebarProps) {
    const items = useMemo(() => buildToc(headings), [headings]);

    if (items.length === 0) {
        return (
            <div className="toc-sidebar">
                <div className="toc-header">📑 Table of Contents</div>
                <div className="toc-empty">No headings found</div>
            </div>
        );
    }

    return (
        <div className="toc-sidebar">
            <div className="toc-header">📑 Table of Contents</div>
            <nav className="toc-nav">
                {items.map((item, i) => (
                    <button
                        key={item.id}
                        className={`toc-item toc-level-${item.level} ${activeIndex === i ? "active" : ""}`}
                        style={{ paddingLeft: `${12 + item.level * 14}px` }}
                        onClick={() => onItemClick?.(i)}
                        title={`${item.number} ${item.title}`}
                    >
                        <span className="toc-number">{item.number}</span>
                        <span className="toc-title">{item.title}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}
