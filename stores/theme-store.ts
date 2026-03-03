import { create } from "zustand";

export interface ThemeColors {
    primary: string;
    surface: string;
    bg: string;
    text: string;
    textMuted: string;
    border: string;
    nodeGradientFrom: string;
    nodeGradientTo: string;
    nodeBorder: string;
    edgeColor: string;
}

export interface Theme {
    id: string;
    name: string;
    emoji: string;
    colors: ThemeColors;
}

export const THEMES: Theme[] = [
    {
        id: "default-dark",
        name: "Default Dark",
        emoji: "🌙",
        colors: {
            primary: "#6c63ff",
            surface: "#1e1e2e",
            bg: "#0f0f1a",
            text: "#e0e0e0",
            textMuted: "#888",
            border: "rgba(255,255,255,0.08)",
            nodeGradientFrom: "#1e1e2e",
            nodeGradientTo: "#252540",
            nodeBorder: "rgba(108,99,255,0.3)",
            edgeColor: "#6c63ff",
        },
    },
    {
        id: "ocean",
        name: "Ocean Blue",
        emoji: "🌊",
        colors: {
            primary: "#0ea5e9",
            surface: "#0c1929",
            bg: "#060f1a",
            text: "#cbd5e1",
            textMuted: "#64748b",
            border: "rgba(14,165,233,0.15)",
            nodeGradientFrom: "#0c1929",
            nodeGradientTo: "#0f2440",
            nodeBorder: "rgba(14,165,233,0.35)",
            edgeColor: "#0ea5e9",
        },
    },
    {
        id: "forest",
        name: "Forest Green",
        emoji: "🌿",
        colors: {
            primary: "#22c55e",
            surface: "#0f1f15",
            bg: "#080f0a",
            text: "#d1e7d6",
            textMuted: "#6b8f7a",
            border: "rgba(34,197,94,0.15)",
            nodeGradientFrom: "#0f1f15",
            nodeGradientTo: "#152e1d",
            nodeBorder: "rgba(34,197,94,0.35)",
            edgeColor: "#22c55e",
        },
    },
    {
        id: "sunset",
        name: "Sunset Amber",
        emoji: "🌅",
        colors: {
            primary: "#f59e0b",
            surface: "#1f1710",
            bg: "#130e08",
            text: "#e8dcc8",
            textMuted: "#9a8565",
            border: "rgba(245,158,11,0.15)",
            nodeGradientFrom: "#1f1710",
            nodeGradientTo: "#2e2118",
            nodeBorder: "rgba(245,158,11,0.35)",
            edgeColor: "#f59e0b",
        },
    },
    {
        id: "monochrome",
        name: "Monochrome",
        emoji: "⚪",
        colors: {
            primary: "#a0a0a0",
            surface: "#1a1a1a",
            bg: "#0d0d0d",
            text: "#d4d4d4",
            textMuted: "#737373",
            border: "rgba(255,255,255,0.1)",
            nodeGradientFrom: "#1a1a1a",
            nodeGradientTo: "#242424",
            nodeBorder: "rgba(160,160,160,0.3)",
            edgeColor: "#a0a0a0",
        },
    },
    {
        id: "neon",
        name: "Neon Purple",
        emoji: "💜",
        colors: {
            primary: "#c084fc",
            surface: "#1a0f2e",
            bg: "#0d0720",
            text: "#e2d4f0",
            textMuted: "#8b73a8",
            border: "rgba(192,132,252,0.15)",
            nodeGradientFrom: "#1a0f2e",
            nodeGradientTo: "#251545",
            nodeBorder: "rgba(192,132,252,0.4)",
            edgeColor: "#c084fc",
        },
    },
];

interface ThemeState {
    activeThemeId: string;
    setTheme: (id: string) => void;
    getTheme: () => Theme;
    applyTheme: (id: string) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    activeThemeId: "default-dark",

    setTheme: (id) => {
        set({ activeThemeId: id });
        get().applyTheme(id);
        try { localStorage.setItem("mindmap-theme", id); } catch { }
    },

    getTheme: () => THEMES.find((t) => t.id === get().activeThemeId) || THEMES[0],

    applyTheme: (id) => {
        const theme = THEMES.find((t) => t.id === id) || THEMES[0];
        const root = document.documentElement;
        const c = theme.colors;
        root.style.setProperty("--color-primary", c.primary);
        root.style.setProperty("--color-surface", c.surface);
        root.style.setProperty("--color-bg", c.bg);
        root.style.setProperty("--color-text", c.text);
        root.style.setProperty("--color-text-muted", c.textMuted);
        root.style.setProperty("--color-border", c.border);
        root.style.setProperty("--node-gradient-from", c.nodeGradientFrom);
        root.style.setProperty("--node-gradient-to", c.nodeGradientTo);
        root.style.setProperty("--node-border", c.nodeBorder);
        root.style.setProperty("--edge-color", c.edgeColor);
    },
}));
