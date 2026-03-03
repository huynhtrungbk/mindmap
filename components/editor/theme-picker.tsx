"use client";

import { useThemeStore, THEMES } from "@/stores/theme-store";
import { useMindmapStore } from "@/stores/mindmap-store";
import type { BgStyle } from "@/stores/mindmap-store";
import { useEffect, useState } from "react";

// --- Data ---

const BG_ITEMS: { style: BgStyle; label: string; icon: string }[] = [
    { style: "dots", label: "Dots", icon: "·" },
    { style: "lines", label: "Lines", icon: "─" },
    { style: "cross", label: "Cross", icon: "┼" },
    { style: "grid-fine", label: "Grid", icon: "░" },
    { style: "subtle-dots", label: "Subtle", icon: "•" },
    { style: "gradient-dark", label: "Dark", icon: "🌑" },
    { style: "gradient-blue", label: "Ocean", icon: "🌊" },
    { style: "light-clean", label: "Light", icon: "☀️" },
    { style: "light-warm", label: "Warm", icon: "🌅" },
    { style: "light-blue", label: "Sky", icon: "🩵" },
    { style: "blueprint", label: "Blueprint", icon: "📘" },
    { style: "sunset", label: "Sunset", icon: "🌇" },
    { style: "aurora", label: "Aurora", icon: "🌌" },
    { style: "paper", label: "Paper", icon: "📄" },
    { style: "honeycomb", label: "Honey", icon: "🐝" },
    { style: "light-rose", label: "Rose", icon: "🌸" },
    { style: "light-mint", label: "Mint", icon: "🍃" },
    { style: "light-lavender", label: "Lavender", icon: "💜" },
    { style: "linen", label: "Linen", icon: "🧵" },
    { style: "topo", label: "Topo", icon: "🗺️" },
    { style: "diagonal", label: "Stripes", icon: "◧" },
    { style: "confetti", label: "Confetti", icon: "🎊" },
    { style: "circuit", label: "Circuit", icon: "⚡" },
    { style: "waves", label: "Waves", icon: "〰️" },
    { style: "mosaic", label: "Mosaic", icon: "🔷" },
    { style: "dots-dense", label: "Dense Dots", icon: "⣿" },
    { style: "dots-sparse", label: "Sparse Dots", icon: "⠂" },
    { style: "grid-thick", label: "Bold Grid", icon: "▦" },
    { style: "herringbone", label: "Herringbone", icon: "⟋" },
    { style: "stars", label: "Stars", icon: "✦" },
    { style: "bubbles", label: "Bubbles", icon: "◌" },
    { style: "chevron", label: "Chevron", icon: "❯" },
    { style: "zigzag", label: "Zigzag", icon: "⩘" },
    { style: "scales", label: "Scales", icon: "⌒" },
    { style: "terrazzo", label: "Terrazzo", icon: "⬡" },
    { style: "none", label: "None", icon: "∅" },
];

// --- Collapsible Section ---
function Section({ title, icon, defaultOpen = true, children }: {
    title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="tp-section">
            <button className="tp-section-header" onClick={() => setOpen(!open)}>
                <span className="tp-section-icon">{icon}</span>
                <span className="tp-section-title">{title}</span>
                <span className={`tp-section-chevron ${open ? "open" : ""}`}>▾</span>
            </button>
            {open && <div className="tp-section-body">{children}</div>}
        </div>
    );
}

// --- Color Picker Row (native color input + opacity slider + reset) ---
function ColorPicker({ label, value, onChange }: {
    label: string; value: string; onChange: (v: string) => void;
}) {
    // Parse value to hex + opacity
    function parseColor(v: string): { hex: string; opacity: number } {
        if (!v) return { hex: "#888888", opacity: 1 };
        const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (m) {
            const toHex = (n: number) => n.toString(16).padStart(2, "0");
            return {
                hex: `#${toHex(+m[1])}${toHex(+m[2])}${toHex(+m[3])}`,
                opacity: m[4] !== undefined ? parseFloat(m[4]) : 1,
            };
        }
        if (v.startsWith("#")) return { hex: v, opacity: 1 };
        return { hex: "#888888", opacity: 1 };
    }

    const parsed = parseColor(value);
    const [hex, setHex] = useState(parsed.hex);
    const [opacity, setOpacity] = useState(parsed.opacity);

    // Sync when parent value changes (e.g., reset)
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const p = parseColor(value);
        setHex(p.hex);
        setOpacity(p.opacity);
    }, [value]);
    /* eslint-enable react-hooks/set-state-in-effect */

    function emit(h: string, op: number) {
        if (!h) { onChange(""); return; }
        const r = parseInt(h.slice(1, 3), 16);
        const g = parseInt(h.slice(3, 5), 16);
        const b = parseInt(h.slice(5, 7), 16);
        if (op >= 1) onChange(h);
        else onChange(`rgba(${r},${g},${b},${op.toFixed(2)})`);
    }

    return (
        <div className="tp-color-picker">
            <div className="tp-color-label">{label}</div>
            <div className="tp-color-controls">
                <input
                    type="color"
                    value={hex}
                    onChange={(e) => { setHex(e.target.value); emit(e.target.value, opacity); }}
                    className="tp-color-input"
                />
                <input
                    type="range"
                    min={0} max={100} step={1}
                    value={Math.round(opacity * 100)}
                    onChange={(e) => { const op = +e.target.value / 100; setOpacity(op); emit(hex, op); }}
                    className="tp-opacity-slider"
                    title={`Opacity: ${Math.round(opacity * 100)}%`}
                />
                <span className="tp-opacity-value">{Math.round(opacity * 100)}%</span>
                <button
                    className="tp-color-reset"
                    onClick={() => { setHex("#888888"); setOpacity(1); onChange(""); }}
                    title="Reset to default"
                >↺</button>
            </div>
            {value && <div className="tp-color-preview" style={{ background: value }} />}
        </div>
    );
}

// --- Main Component ---
export function ThemePicker({ onClose }: { onClose: () => void }) {
    const { activeThemeId, setTheme } = useThemeStore();
    const {
        bgStyle, setBgStyle, bgTone, setBgTone, bgColor, setBgColor,
        nodeColor, setNodeColor, nodeTextColor, setNodeTextColor,
        nodeBorderColor, setNodeBorderColor,
    } = useMindmapStore();

    return (
        <div className="theme-overlay" onClick={onClose}>
            <div className="theme-dialog theme-dialog-wide" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="tp-header">
                    <div className="tp-header-title">
                        <span className="tp-header-icon">🎨</span>
                        <span>Theme & Appearance</span>
                    </div>
                    <button className="tp-close" onClick={onClose}>✕</button>
                </div>

                {/* Single column scrollable content */}
                <div className="tp-content">
                    <Section title="Color Theme" icon="🎭">
                        <div className="theme-grid">
                            {THEMES.map((theme) => (
                                <button
                                    key={theme.id}
                                    className={`theme-card ${activeThemeId === theme.id ? "active" : ""}`}
                                    onClick={() => setTheme(theme.id)}
                                    style={{
                                        background: `linear-gradient(135deg, ${theme.colors.bg}, ${theme.colors.surface})`,
                                        borderColor: activeThemeId === theme.id ? theme.colors.primary : "transparent",
                                    }}
                                >
                                    <div className="theme-preview">
                                        <div className="theme-node-preview" style={{
                                            background: `linear-gradient(135deg, ${theme.colors.nodeGradientFrom}, ${theme.colors.nodeGradientTo})`,
                                            borderColor: theme.colors.nodeBorder,
                                        }}>
                                            <span style={{ color: theme.colors.text, fontSize: "0.65rem" }}>Node</span>
                                        </div>
                                        <div className="theme-edge-preview" style={{ background: theme.colors.edgeColor }} />
                                        <div className="theme-node-preview theme-node-child" style={{
                                            background: `linear-gradient(135deg, ${theme.colors.nodeGradientFrom}, ${theme.colors.nodeGradientTo})`,
                                            borderColor: theme.colors.nodeBorder,
                                        }}>
                                            <span style={{ color: theme.colors.text, fontSize: "0.6rem" }}>Child</span>
                                        </div>
                                    </div>
                                    <div className="theme-info">
                                        <span className="theme-emoji">{theme.emoji}</span>
                                        <span className="theme-name" style={{ color: theme.colors.text }}>{theme.name}</span>
                                    </div>
                                    {activeThemeId === theme.id && <span className="theme-active-badge">✓</span>}
                                </button>
                            ))}
                        </div>
                    </Section>

                    <Section title="Background" icon="🖼️">
                        <div className="theme-bg-grid">
                            {BG_ITEMS.map((bg) => (
                                <button
                                    key={bg.style}
                                    className={`theme-bg-btn ${bgStyle === bg.style ? "active" : ""}`}
                                    onClick={() => { setBgStyle(bg.style); setBgTone(""); }}
                                >
                                    <span>{bg.icon}</span>
                                    <span className="theme-bg-label">{bg.label}</span>
                                </button>
                            ))}
                        </div>
                        <ColorPicker label="Background Color" value={bgColor} onChange={setBgColor} />
                        <ColorPicker label="Tone Overlay" value={bgTone} onChange={setBgTone} />
                    </Section>

                    <Section title="Node Customization" icon="📦">
                        <ColorPicker label="Fill Color" value={nodeColor} onChange={setNodeColor} />
                        <ColorPicker label="Text Color" value={nodeTextColor} onChange={setNodeTextColor} />
                        <ColorPicker label="Border Color" value={nodeBorderColor} onChange={setNodeBorderColor} />
                    </Section>
                </div>
            </div>
        </div>
    );
}

// Initialize theme + appearance from localStorage on mount
export function ThemeInitializer() {
    const { applyTheme } = useThemeStore();

    useEffect(() => {
        try {
            // Restore color theme
            const saved = localStorage.getItem("mindmap-theme");
            if (saved) {
                useThemeStore.setState({ activeThemeId: saved });
                applyTheme(saved);
            }
            // Restore all appearance settings
            const keys = ["bgStyle", "bgTone", "bgColor", "nodeColor", "nodeTextColor", "nodeBorderColor"] as const;
            const state: Record<string, string> = {};
            for (const key of keys) {
                const val = localStorage.getItem(`mindmap-appearance-${key}`);
                if (val !== null) state[key] = val;
            }
            if (Object.keys(state).length > 0) {
                useMindmapStore.setState(state);
            }
        } catch { }
    }, [applyTheme]);

    return null;
}
