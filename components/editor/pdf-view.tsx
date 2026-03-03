/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";
import { storeToDif } from "@/lib/converters/dif-client";
import { generateMindmapPdf } from "@/lib/converters/pdf-generator";
import { showToast } from "@/components/ui/toast";
import { TocSidebar } from "./toc-sidebar";
import type { DifNode } from "@/lib/converters/dif";

export function PdfView() {
    const nodes = useMindmapStore((s) => s.nodes);
    const mapTitle = useMindmapStore((s) => s.mapTitle);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [pageCount, setPageCount] = useState(0);
    const prevUrlRef = useRef<string | null>(null);

    const generatePdf = useCallback(async () => {
        setGenerating(true);
        try {
            const difTree = storeToDif(nodes);
            const result = await generateMindmapPdf(difTree, mapTitle);
            setPageCount(result.pageCount);

            if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
            const url = URL.createObjectURL(result.blob);
            prevUrlRef.current = url;
            setPdfUrl(url);
        } catch (err) {
            console.error("PDF generation error:", err);
            showToast("PDF generation failed", "error");
        }
        setGenerating(false);
    }, [nodes, mapTitle]);

    useEffect(() => {
        generatePdf();
        return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); };
    }, [generatePdf]);

    // Extract headings from DIF tree for TOC sidebar
    const tocHeadings = useMemo(() => {
        const headings: { title: string; depth: number }[] = [];
        function walk(items: DifNode[], depth: number) {
            for (const item of items) {
                headings.push({ title: item.title, depth });
                walk(item.children, depth + 1);
            }
        }
        walk(storeToDif(nodes), 0);
        return headings;
    }, [nodes]);

    function handleDownload() {
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = `${mapTitle || "mindmap"}.pdf`;
        a.click();
        showToast("Downloaded PDF", "success");
    }

    return (
        <div className="pdf-view">
            <div className="pdf-view-toolbar">
                <div className="pdf-view-left">
                    <span className="pdf-view-title">📋 PDF Preview</span>
                    {pageCount > 0 && <span className="pdf-page-badge">{pageCount} page{pageCount > 1 ? "s" : ""}</span>}
                </div>
                <div className="pdf-view-actions">
                    <button onClick={generatePdf} disabled={generating} className="pdf-btn pdf-btn-secondary">
                        🔄 {generating ? "Generating…" : "Refresh"}
                    </button>
                    <button onClick={handleDownload} disabled={!pdfUrl || generating} className="pdf-btn pdf-btn-primary">
                        📥 Download PDF
                    </button>
                </div>
            </div>
            <div className="pdf-view-body-wrap">
                <TocSidebar headings={tocHeadings} />
                <div className="pdf-view-body">
                    {generating ? (
                        <div className="pdf-generating">
                            <div className="pdf-spinner" />
                            <p>Generating PDF…</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe src={pdfUrl} className="pdf-iframe-full" title="PDF Preview" />
                    ) : (
                        <div className="pdf-generating">
                            <p>No content to display</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
