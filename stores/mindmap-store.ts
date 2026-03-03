import { create } from "zustand";

export interface MindmapNodeData {
    id: string;
    parentId: string | null;
    title: string;
    positionX: number;
    positionY: number;
    sortIndex: number;
    collapsed: boolean;
    noteDoc: unknown | null;
    notePlain: string;
}

export interface MindmapEdgeData {
    id: string;
    source: string;
    target: string;
    type: string;
}

interface HistoryEntry {
    nodes: MindmapNodeData[];
    edges: MindmapEdgeData[];
}

export type ViewMode = "mindmap" | "markdown" | "document" | "pdf";
export type SidePanelMode = "always" | "click-node" | "click-button";
export type LayoutMode = "auto" | "free" | "once";
export type EdgeStyle = "smoothstep" | "straight" | "bezier" | "step" | "animated" | "dashed" | "gradient" | "neon";
export type BgStyle = "dots" | "lines" | "cross" | "none"
    | "gradient-dark" | "gradient-blue" | "grid-fine" | "subtle-dots"
    | "light-clean" | "light-warm" | "light-blue" | "blueprint"
    | "sunset" | "aurora" | "paper" | "honeycomb"
    | "light-rose" | "light-mint" | "light-lavender" | "linen"
    | "topo" | "diagonal" | "confetti" | "circuit"
    | "waves" | "mosaic"
    | "dots-dense" | "dots-sparse" | "grid-thick" | "herringbone"
    | "stars" | "bubbles" | "chevron" | "zigzag" | "scales" | "terrazzo";

interface MindmapState {
    mapId: string | null;
    mapTitle: string;
    mapRole: "owner" | "editor" | "viewer";
    viewMode: ViewMode;
    nodes: MindmapNodeData[];
    edges: MindmapEdgeData[];
    viewport: { x: number; y: number; zoom: number };
    selectedNodeId: string | null;
    sidePanelMode: SidePanelMode;
    notePanelForced: boolean;
    isDirty: boolean;
    isSaving: boolean;
    lastSaved: Date | null;
    layoutMode: LayoutMode;
    edgeStyle: EdgeStyle;
    bgStyle: BgStyle;
    bgTone: string;
    bgColor: string;
    nodeColor: string;
    nodeTextColor: string;
    nodeBorderColor: string;
    nodePaddingV: number;
    nodePaddingH: number;
    nodeFontSize: number;
    btnSize: number;
    badgePadding: number;
    borderWidth: number;
    edgeWidth: number;
    nodeGapX: number;
    nodeGapY: number;

    // History
    history: HistoryEntry[];
    historyIndex: number;

    // Actions
    setMapData: (id: string, nodes: MindmapNodeData[], edges: MindmapEdgeData[], viewport: { x: number; y: number; zoom: number }) => void;
    selectNode: (id: string | null) => void;
    updateNodeTitle: (id: string, title: string) => void;
    updateNodePosition: (id: string, x: number, y: number) => void;
    updateNodeNote: (id: string, noteDoc: unknown, notePlain: string) => void;
    setMapTitle: (title: string) => void;
    setViewMode: (mode: ViewMode) => void;
    replaceAllFromDif: (nodes: MindmapNodeData[], edges: MindmapEdgeData[]) => void;
    addNode: (parentId: string | null, title?: string) => MindmapNodeData;
    addChildAbove: (parentId: string) => MindmapNodeData;
    addSibling: (nodeId: string) => MindmapNodeData | null;
    addSiblingAbove: (nodeId: string) => MindmapNodeData | null;
    moveNode: (nodeId: string, newParentId: string, insertIndex?: number) => void;
    deleteNode: (id: string) => void;
    setViewport: (v: { x: number; y: number; zoom: number }) => void;
    setSaving: (v: boolean) => void;
    markSaved: () => void;
    undo: () => void;
    redo: () => void;
    pushHistory: () => void;
    setSidePanelMode: (mode: SidePanelMode) => void;
    toggleCollapse: (nodeId: string) => void;
    forceOpenNote: (nodeId: string) => void;
    expandAll: () => void;
    collapseAll: () => void;
    setLayoutMode: (mode: LayoutMode) => void;
    setEdgeStyle: (style: EdgeStyle) => void;
    triggerAutoLayout: () => void;
    setNodePaddingV: (v: number) => void;
    setNodePaddingH: (v: number) => void;
    setNodeFontSize: (v: number) => void;
    setBtnSize: (v: number) => void;
    setBadgePadding: (v: number) => void;
    setBorderWidth: (v: number) => void;
    setEdgeWidth: (v: number) => void;
    setNodeGapX: (v: number) => void;
    setNodeGapY: (v: number) => void;
    setBgStyle: (style: BgStyle) => void;
    setBgTone: (tone: string) => void;
    setBgColor: (c: string) => void;
    setNodeColor: (c: string) => void;
    setNodeTextColor: (c: string) => void;
    setNodeBorderColor: (c: string) => void;
}

function generateId(): string {
    return crypto.randomUUID();
}

function autoLayout(inputNodes: MindmapNodeData[]): MindmapNodeData[] {
    const nodes = inputNodes.map((n) => ({ ...n }));
    const childrenMap = new Map<string | null, MindmapNodeData[]>();
    for (const n of nodes) {
        const pid = n.parentId;
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(n);
    }

    let yCounter = 0;
    const state = useMindmapStore.getState();
    const X_GAP = state.nodeGapX;
    const Y_GAP = state.nodeGapY;

    function layoutSubtree(nodeId: string, depth: number) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const children = childrenMap.get(nodeId) || [];
        children.sort((a, b) => a.sortIndex - b.sortIndex);

        if (children.length === 0) {
            node.positionX = depth * X_GAP;
            node.positionY = yCounter * Y_GAP;
            yCounter++;
        } else {
            const startY = yCounter;
            for (const child of children) {
                layoutSubtree(child.id, depth + 1);
            }
            const endY = yCounter - 1;
            node.positionX = depth * X_GAP;
            node.positionY = ((startY + endY) / 2) * Y_GAP;
        }
    }

    const roots = childrenMap.get(null) || [];
    roots.sort((a, b) => a.sortIndex - b.sortIndex);
    for (const root of roots) {
        layoutSubtree(root.id, 0);
    }

    return nodes;
}

export const useMindmapStore = create<MindmapState>((set, get) => ({
    mapId: null,
    mapTitle: "",
    mapRole: "owner" as const,
    viewMode: "mindmap" as ViewMode,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    sidePanelMode: "click-button" as SidePanelMode,
    notePanelForced: false,
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    layoutMode: "auto" as LayoutMode,
    edgeStyle: "smoothstep" as EdgeStyle,
    bgStyle: "dots" as BgStyle,
    bgTone: "",
    bgColor: "",
    nodeColor: "",
    nodeTextColor: "",
    nodeBorderColor: "",
    nodePaddingV: 3,
    nodePaddingH: 6,
    nodeFontSize: 13,
    btnSize: 8,
    badgePadding: 1,
    borderWidth: 1,
    edgeWidth: 1,
    nodeGapX: 180,
    nodeGapY: 50,
    history: [],
    historyIndex: -1,

    setMapData: (id, nodes, edges, viewport) =>
        set({ mapId: id, nodes, edges, viewport, isDirty: false, history: [{ nodes: [...nodes], edges: [...edges] }], historyIndex: 0 }),

    selectNode: (id) => set({ selectedNodeId: id }),

    setMapTitle: (title) => set({ mapTitle: title, isDirty: true }),
    setViewMode: (mode) => set({ viewMode: mode }),
    replaceAllFromDif: (nodes, edges) => set({ nodes, edges, isDirty: true }),

    updateNodeTitle: (id, title) => {
        set((s) => ({
            nodes: s.nodes.map((n) => (n.id === id ? { ...n, title } : n)),
            isDirty: true,
        }));
    },

    updateNodePosition: (id, x, y) => {
        set((s) => ({
            nodes: s.nodes.map((n) => (n.id === id ? { ...n, positionX: x, positionY: y } : n)),
            isDirty: true,
        }));
    },

    updateNodeNote: (id, noteDoc, notePlain) => {
        set((s) => ({
            nodes: s.nodes.map((n) => (n.id === id ? { ...n, noteDoc, notePlain } : n)),
            isDirty: true,
        }));
    },

    addNode: (parentId, title = "") => {
        const { nodes, edges } = get();
        const siblings = nodes.filter((n) => n.parentId === parentId);
        const newNode: MindmapNodeData = {
            id: generateId(),
            parentId,
            title,
            positionX: 0,
            positionY: 0,
            sortIndex: siblings.length,
            collapsed: false,
            noteDoc: null,
            notePlain: "",
        };

        const updatedNodes = autoLayout([...nodes, newNode]);
        const newEdges = parentId
            ? [...edges, { id: generateId(), source: parentId, target: newNode.id, type: "default" }]
            : edges;

        set({ nodes: updatedNodes, edges: newEdges, selectedNodeId: newNode.id, isDirty: true });
        return newNode;
    },

    addChildAbove: (parentId) => {
        const { nodes, edges } = get();
        const newNode: MindmapNodeData = {
            id: generateId(),
            parentId,
            title: "",
            positionX: 0,
            positionY: 0,
            sortIndex: 0,
            collapsed: false,
            noteDoc: null,
            notePlain: "",
        };
        // Insert right after parent in the array so it appears first among children
        const parentIdx = nodes.findIndex((n) => n.id === parentId);
        const newNodes = [...nodes];
        newNodes.splice(parentIdx >= 0 ? parentIdx + 1 : nodes.length, 0, newNode);
        const updatedNodes = autoLayout(newNodes);
        const newEdges = [...edges, { id: generateId(), source: parentId, target: newNode.id, type: "default" }];
        set({ nodes: updatedNodes, edges: newEdges, selectedNodeId: newNode.id, isDirty: true });
        return newNode;
    },

    addSibling: (nodeId) => {
        const { nodes } = get();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return null;
        return get().addNode(node.parentId, "");
    },

    addSiblingAbove: (nodeId) => {
        const { nodes, edges } = get();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return null;
        const newNode: MindmapNodeData = {
            id: generateId(),
            parentId: node.parentId,
            title: "",
            positionX: 0,
            positionY: 0,
            sortIndex: Math.max(0, node.sortIndex - 1),
            collapsed: false,
            noteDoc: null,
            notePlain: "",
        };
        // Insert before the reference node
        const idx = nodes.findIndex((n) => n.id === nodeId);
        const newNodes = [...nodes];
        newNodes.splice(idx, 0, newNode);
        const updatedNodes = autoLayout(newNodes);
        const newEdges = node.parentId
            ? [...edges, { id: generateId(), source: node.parentId, target: newNode.id, type: "default" }]
            : edges;
        set({ nodes: updatedNodes, edges: newEdges, selectedNodeId: newNode.id, isDirty: true });
        return newNode;
    },

    deleteNode: (id) => {
        const { nodes, edges } = get();
        const node = nodes.find((n) => n.id === id);
        if (!node) return;

        // Index of deleted node among all same-parent nodes (for above/below logic)
        const sameParent = nodes.filter((n) => n.parentId === node.parentId);
        const myIdx = sameParent.findIndex((n) => n.id === id);

        // Pick sibling above first, then below, then parent
        let nextSelected: string | null = null;
        if (myIdx > 0) {
            nextSelected = sameParent[myIdx - 1].id; // sibling above
        } else if (myIdx < sameParent.length - 1) {
            nextSelected = sameParent[myIdx + 1].id; // sibling below
        } else {
            nextSelected = node.parentId; // parent
        }

        // Collect all descendant IDs
        const toDelete = new Set<string>();
        function collectChildren(pid: string) {
            toDelete.add(pid);
            for (const n of nodes) {
                if (n.parentId === pid) collectChildren(n.id);
            }
        }
        collectChildren(id);

        const filteredNodes = nodes.filter((n) => !toDelete.has(n.id));
        const filteredEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));

        set({
            nodes: autoLayout(filteredNodes),
            edges: filteredEdges,
            selectedNodeId: nextSelected,
            isDirty: true,
        });
    },

    moveNode: (nodeId, newParentId, insertIndex) => {
        const { nodes, edges } = get();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node || nodeId === newParentId) return;
        if (node.parentId === newParentId) {
            // Same parent — reorder siblings
            if (insertIndex === undefined) return;
            const siblings = nodes.filter((n) => n.parentId === newParentId);
            siblings.sort((a, b) => a.sortIndex - b.sortIndex);
            // Remove moved node from list, insert at new position
            const without = siblings.filter((n) => n.id !== nodeId);
            without.splice(insertIndex, 0, node);
            const updatedNodes = nodes.map((n) => {
                if (n.parentId !== newParentId) return n;
                const idx = without.findIndex((s) => s.id === n.id);
                return idx >= 0 ? { ...n, sortIndex: idx } : n;
            });
            set({ nodes: autoLayout(updatedNodes), isDirty: true });
            return;
        }

        // Prevent circular: can't move into own descendant
        const descendants = new Set<string>();
        function collectDesc(pid: string) {
            for (const n of nodes) {
                if (n.parentId === pid) { descendants.add(n.id); collectDesc(n.id); }
            }
        }
        collectDesc(nodeId);
        if (descendants.has(newParentId)) return;

        // Remove old edge (to this node)
        let newEdges = edges.filter((e) => e.target !== nodeId);
        // Add new edge from new parent
        newEdges = [...newEdges, { id: generateId(), source: newParentId, target: nodeId, type: "default" }];

        // Update parentId and sortIndex
        const newSiblings = nodes.filter((n) => n.parentId === newParentId && n.id !== nodeId);
        const idx = insertIndex !== undefined ? insertIndex : newSiblings.length;
        const updatedNodes = nodes.map((n) => {
            if (n.id === nodeId) return { ...n, parentId: newParentId, sortIndex: idx };
            return n;
        });

        set({ nodes: autoLayout(updatedNodes), edges: newEdges, isDirty: true });
    },

    setViewport: (v) => set({ viewport: v }),
    setSaving: (v) => set({ isSaving: v }),
    markSaved: () => set({ isDirty: false, isSaving: false, lastSaved: new Date() }),

    pushHistory: () => {
        const { nodes, edges, history, historyIndex } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
        if (newHistory.length > 50) newHistory.shift();
        set({ history: newHistory, historyIndex: newHistory.length - 1 });
    },

    undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;
        const prev = history[historyIndex - 1];
        set({ nodes: structuredClone(prev.nodes), edges: structuredClone(prev.edges), historyIndex: historyIndex - 1, isDirty: true });
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const next = history[historyIndex + 1];
        set({ nodes: structuredClone(next.nodes), edges: structuredClone(next.edges), historyIndex: historyIndex + 1, isDirty: true });
    },

    setSidePanelMode: (mode) => set({ sidePanelMode: mode }),

    toggleCollapse: (nodeId) => {
        set((s) => ({
            nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n)),
            isDirty: true,
        }));
    },

    forceOpenNote: (nodeId) => {
        set({ selectedNodeId: nodeId, notePanelForced: true });
    },

    expandAll: () => {
        set((s) => ({
            nodes: s.nodes.map((n) => ({ ...n, collapsed: false })),
            isDirty: true,
        }));
    },

    collapseAll: () => {
        set((s) => ({
            nodes: s.nodes.map((n) => {
                const hasChildren = s.nodes.some((c) => c.parentId === n.id);
                return hasChildren ? { ...n, collapsed: true } : n;
            }),
            isDirty: true,
        }));
    },

    setLayoutMode: (mode) => set({ layoutMode: mode }),

    setEdgeStyle: (style) => set({ edgeStyle: style, isDirty: true }),

    triggerAutoLayout: () => {
        const { nodes } = get();
        const layouted = autoLayout(nodes);
        set({ nodes: layouted, isDirty: true });
    },

    setNodePaddingV: (v) => set({ nodePaddingV: v }),
    setNodePaddingH: (v) => set({ nodePaddingH: v }),
    setNodeFontSize: (v) => set({ nodeFontSize: v }),
    setBtnSize: (v) => set({ btnSize: v }),
    setBadgePadding: (v) => set({ badgePadding: v }),
    setBorderWidth: (v) => set({ borderWidth: v }),
    setEdgeWidth: (v) => set({ edgeWidth: v }),
    setNodeGapX: (v) => set({ nodeGapX: v }),
    setNodeGapY: (v) => set({ nodeGapY: v }),
    setBgStyle: (style) => {
        set({ bgStyle: style });
        try { localStorage.setItem("mindmap-appearance-bgStyle", style); } catch { }
    },
    setBgTone: (tone) => {
        set({ bgTone: tone });
        try { localStorage.setItem("mindmap-appearance-bgTone", tone); } catch { }
    },
    setBgColor: (c) => {
        set({ bgColor: c });
        try { localStorage.setItem("mindmap-appearance-bgColor", c); } catch { }
    },
    setNodeColor: (c) => {
        set({ nodeColor: c });
        try { localStorage.setItem("mindmap-appearance-nodeColor", c); } catch { }
    },
    setNodeTextColor: (c) => {
        set({ nodeTextColor: c });
        try { localStorage.setItem("mindmap-appearance-nodeTextColor", c); } catch { }
    },
    setNodeBorderColor: (c) => {
        set({ nodeBorderColor: c });
        try { localStorage.setItem("mindmap-appearance-nodeBorderColor", c); } catch { }
    },
}));
