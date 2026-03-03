"use client";

import { useState } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";

interface Props {
    onClose: () => void;
}

export function NodeStyleDialog({ onClose }: Props) {
    const {
        nodePaddingV, nodePaddingH, nodeFontSize, btnSize, badgePadding, borderWidth, edgeWidth,
        nodeGapX, nodeGapY,
        setNodePaddingV, setNodePaddingH, setNodeFontSize, setBtnSize, setBadgePadding, setBorderWidth, setEdgeWidth,
        setNodeGapX, setNodeGapY, triggerAutoLayout,
    } = useMindmapStore();

    const [linked, setLinked] = useState(true);

    function handlePaddingV(v: number) {
        setNodePaddingV(v);
        if (linked) setNodePaddingH(Math.round(v * 2));
    }

    function handlePaddingH(v: number) {
        setNodePaddingH(v);
        if (linked) setNodePaddingV(Math.round(v / 2));
    }

    function handleGapX(v: number) { setNodeGapX(v); triggerAutoLayout(); }
    function handleGapY(v: number) { setNodeGapY(v); triggerAutoLayout(); }

    function resetAll() {
        setNodePaddingV(3); setNodePaddingH(6); setNodeFontSize(13); setBtnSize(8);
        setBadgePadding(1); setBorderWidth(1); setEdgeWidth(1);
        setNodeGapX(180); setNodeGapY(50); triggerAutoLayout();
    }

    const sliders: { label: string; value: number; set: (v: number) => void; min: number; max: number; step?: number; unit: string }[] = [
        { label: "Font Size", value: nodeFontSize, set: setNodeFontSize, min: 9, max: 24, unit: "px" },
        { label: "Nút (+)", value: btnSize, set: setBtnSize, min: 4, max: 24, unit: "px" },
        { label: "Badge", value: badgePadding, set: setBadgePadding, min: 0, max: 10, unit: "px" },
        { label: "Viền Node", value: borderWidth, set: setBorderWidth, min: 0.5, max: 5, step: 0.5, unit: "px" },
        { label: "Nét nối", value: edgeWidth, set: setEdgeWidth, min: 0.5, max: 6, step: 0.5, unit: "px" },
    ];

    const gapSliders = [
        { label: "↔ Ngang", value: nodeGapX, set: handleGapX, min: 100, max: 500, unit: "px" },
        { label: "↕ Dọc", value: nodeGapY, set: handleGapY, min: 20, max: 150, unit: "px" },
    ];

    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-dialog node-style-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="shortcuts-header">
                    <h3>📐 Node Style</h3>
                    <button className="shortcuts-close" onClick={onClose}>✕</button>
                </div>
                <div className="node-style-body">
                    {/* Padding section with linked toggle */}
                    <div className="node-style-section-label">
                        Padding
                        <button
                            className={`node-style-link-btn ${linked ? "linked" : ""}`}
                            onClick={() => setLinked(!linked)}
                            title={linked ? "Linked: editing one changes both" : "Unlinked: edit independently"}
                        >
                            {linked ? "🔗" : "🔓"}
                        </button>
                    </div>
                    <div className="node-style-row">
                        <label>↕ Trên/Dưới</label>
                        <input type="range" min={1} max={20} value={nodePaddingV} onChange={(e) => handlePaddingV(Number(e.target.value))} />
                        <span className="node-style-value">{nodePaddingV}px</span>
                    </div>
                    <div className="node-style-row">
                        <label>↔ Trái/Phải</label>
                        <input type="range" min={2} max={40} value={nodePaddingH} onChange={(e) => handlePaddingH(Number(e.target.value))} />
                        <span className="node-style-value">{nodePaddingH}px</span>
                    </div>

                    <div className="node-style-divider" />

                    {sliders.map((s) => (
                        <div key={s.label} className="node-style-row">
                            <label>{s.label}</label>
                            <input
                                type="range"
                                min={s.min}
                                max={s.max}
                                step={s.step ?? 1}
                                value={s.value}
                                onChange={(e) => s.set(Number(e.target.value))}
                            />
                            <span className="node-style-value">{s.value}{s.unit}</span>
                        </div>
                    ))}

                    <div className="node-style-divider" />
                    <div className="node-style-section-label">Khoảng cách Node</div>
                    {gapSliders.map((s) => (
                        <div key={s.label} className="node-style-row">
                            <label>{s.label}</label>
                            <input type="range" min={s.min} max={s.max} value={s.value} onChange={(e) => s.set(Number(e.target.value))} />
                            <span className="node-style-value">{s.value}{s.unit}</span>
                        </div>
                    ))}

                    <div className="node-style-preview">
                        <div
                            className="node-style-preview-box"
                            style={{
                                padding: `${nodePaddingV}px ${nodePaddingH}px`,
                                fontSize: `${nodeFontSize}px`,
                                borderWidth: `${borderWidth}px`,
                            }}
                        >
                            Preview Node
                        </div>
                    </div>
                    <button className="node-style-reset" onClick={resetAll}>
                        Reset to Default
                    </button>
                </div>
            </div>
        </div>
    );
}
