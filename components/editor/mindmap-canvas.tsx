"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type Viewport,
    Handle,
    Position,
    ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMindmapStore, type MindmapNodeData } from "@/stores/mindmap-store";
import { CustomNode } from "./custom-node";

// Wrap custom node with handles
function MindmapNodeWrapper(props: { data: Record<string, unknown>; selected?: boolean }) {
    return (
        <div>
            <Handle type="target" position={Position.Left} />
            <CustomNode data={props.data as { label: string; nodeId: string; hasNote: boolean; hasChildren: boolean; isCollapsed: boolean; depth: number; noteExcerpt: string }} selected={props.selected} />
            <Handle type="source" position={Position.Right} />
        </div>
    );
}

const nodeTypes = { mindmap: MindmapNodeWrapper };

// Get all descendant IDs of collapsed nodes (to hide them)
function getHiddenNodeIds(nodes: MindmapNodeData[]): Set<string> {
    const hidden = new Set<string>();
    const collapsedIds = new Set(nodes.filter((n) => n.collapsed).map((n) => n.id));

    function hideChildren(parentId: string) {
        for (const n of nodes) {
            if (n.parentId === parentId && !hidden.has(n.id)) {
                hidden.add(n.id);
                hideChildren(n.id);
            }
        }
    }

    for (const id of collapsedIds) {
        hideChildren(id);
    }
    return hidden;
}

// Compute depth for each node by traversing parentId chain
function getNodeDepths(allNodes: MindmapNodeData[]): Map<string, number> {
    const parentMap = new Map<string, string | null>();
    for (const n of allNodes) parentMap.set(n.id, n.parentId);
    const depthCache = new Map<string, number>();

    function calcDepth(id: string): number {
        if (depthCache.has(id)) return depthCache.get(id)!;
        const pid = parentMap.get(id);
        const d = pid ? calcDepth(pid) + 1 : 0;
        depthCache.set(id, d);
        return d;
    }

    for (const n of allNodes) calcDepth(n.id);
    return depthCache;
}

function toFlowNodes(nodes: MindmapNodeData[], selectedId: string | null, allNodes: MindmapNodeData[]): Node[] {
    const depths = getNodeDepths(allNodes);
    return nodes.map((n) => {
        const excerpt = n.notePlain?.trim() || "";
        return {
            id: n.id,
            type: "mindmap" as const,
            position: { x: n.positionX, y: n.positionY },
            data: {
                label: n.title,
                nodeId: n.id,
                hasNote: !!(n.notePlain && n.notePlain.trim()),
                hasChildren: allNodes.some((c) => c.parentId === n.id),
                isCollapsed: n.collapsed,
                depth: depths.get(n.id) ?? 0,
                noteExcerpt: excerpt.length > 120 ? excerpt.slice(0, 120) + "…" : excerpt,
            },
            selected: n.id === selectedId,
        };
    });
}

function toFlowEdges(edges: { id: string; source: string; target: string }[], edgeStyle: string, edgeWidth: number): Edge[] {
    const w = edgeWidth;
    const styleMap: Record<string, { type: string; animated: boolean; style: Record<string, string | number> }> = {
        smoothstep: { type: "smoothstep", animated: false, style: { stroke: "var(--edge-color, #6c63ff)", strokeWidth: w } },
        straight: { type: "straight", animated: false, style: { stroke: "var(--edge-color, #6c63ff)", strokeWidth: w } },
        bezier: { type: "default", animated: false, style: { stroke: "var(--edge-color, #6c63ff)", strokeWidth: w } },
        step: { type: "step", animated: false, style: { stroke: "var(--edge-color, #6c63ff)", strokeWidth: w } },
        animated: { type: "smoothstep", animated: true, style: { stroke: "var(--edge-color, #6c63ff)", strokeWidth: w } },
        dashed: { type: "smoothstep", animated: false, style: { stroke: "var(--edge-color, #6c63ff)", strokeWidth: w, strokeDasharray: "6 3" } },
        gradient: { type: "smoothstep", animated: false, style: { stroke: "url(#edge-gradient)", strokeWidth: w + 0.5 } },
        neon: { type: "smoothstep", animated: true, style: { stroke: "#00ff88", strokeWidth: w + 0.5, filter: "drop-shadow(0 0 4px #00ff88)" } },
    };

    const preset = styleMap[edgeStyle] || styleMap.smoothstep;

    return edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: preset.type,
        animated: preset.animated,
        style: preset.style,
    }));
}

export function MindmapCanvas() {
    const store = useMindmapStore();

    const storeNodes = useMindmapStore((s) => s.nodes);
    const storeEdges = useMindmapStore((s) => s.edges);
    const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
    const edgeStyle = useMindmapStore((s) => s.edgeStyle);
    const layoutMode = useMindmapStore((s) => s.layoutMode);
    const edgeWidth = useMindmapStore((s) => s.edgeWidth);
    const bgStyle = useMindmapStore((s) => s.bgStyle);
    const bgTone = useMindmapStore((s) => s.bgTone);
    const bgColor = useMindmapStore((s) => s.bgColor);

    // Filter out hidden (collapsed) nodes and edges
    const hiddenIds = useMemo(() => getHiddenNodeIds(storeNodes), [storeNodes]);
    const visibleNodes = useMemo(() => storeNodes.filter((n) => !hiddenIds.has(n.id)), [storeNodes, hiddenIds]);
    const visibleEdges = useMemo(() => storeEdges.filter((e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target)), [storeEdges, hiddenIds]);

    const flowNodes = useMemo(() => toFlowNodes(visibleNodes, selectedNodeId, storeNodes), [visibleNodes, selectedNodeId, storeNodes]);
    const flowEdges = useMemo(() => toFlowEdges(visibleEdges, edgeStyle, edgeWidth), [visibleEdges, edgeStyle, edgeWidth]);

    const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

    useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
    useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        onNodesChange(changes);
        for (const change of changes) {
            if (change.type === "position" && "position" in change && change.position && !change.dragging) {
                if (layoutMode === "auto") {
                    // Auto mode: re-layout after drag (snap back)
                    store.triggerAutoLayout();
                    store.pushHistory();
                } else {
                    // Free/once mode: allow free drag
                    store.updateNodePosition(change.id, change.position.x, change.position.y);
                    store.pushHistory();
                }
            }
        }
    }, [onNodesChange, store, layoutMode]);

    const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
        onEdgesChange(changes);
    }, [onEdgesChange]);

    const handleMoveEnd = useCallback((_: unknown, vp: Viewport) => {
        store.setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
    }, [store]);

    // Unified drop target calculator: decides sibling-insert vs reparent-as-child
    const calcDropTarget = useCallback((draggedId: string, dx: number, dy: number) => {
        const storeState = useMindmapStore.getState();
        const allNodes = storeState.nodes;
        const draggedStoreNode = allNodes.find((n) => n.id === draggedId);
        if (!draggedStoreNode || !draggedStoreNode.parentId) return null;

        // Collect descendants
        const descendants = new Set<string>();
        function collectDesc(pid: string) {
            for (const n of allNodes) {
                if (n.parentId === pid) { descendants.add(n.id); collectDesc(n.id); }
            }
        }
        collectDesc(draggedId);

        // Find closest non-descendant node
        let closest: (typeof nodes)[0] | null = null;
        let closestDist = Infinity;
        for (const n of nodes) {
            if (n.id === draggedId || descendants.has(n.id)) continue;
            const dist = Math.sqrt((n.position.x - dx) ** 2 + (n.position.y - dy) ** 2);
            if (dist < closestDist) {
                closestDist = dist;
                closest = n;
            }
        }

        if (!closest || closestDist > storeState.nodeGapX * 1.2) return null;

        const closestStoreNode = allNodes.find((n) => n.id === closest!.id);
        if (!closestStoreNode) return null;

        const xOffset = dx - closest.position.x;
        const halfGap = storeState.nodeGapX * 0.35;

        // Decision: if dragged X is significantly to the RIGHT of closest → become CHILD
        // Otherwise → become SIBLING (share closest's parent)
        if (xOffset > halfGap) {
            // Reparent as child of closest
            const targetChildren = allNodes
                .filter((n) => n.parentId === closest!.id && n.id !== draggedId)
                .sort((a, b) => a.sortIndex - b.sortIndex);
            let insertIdx = targetChildren.length;
            for (let i = 0; i < targetChildren.length; i++) {
                const childNode = nodes.find((n) => n.id === targetChildren[i].id);
                if (childNode && dy < childNode.position.y) { insertIdx = i; break; }
            }
            return { parentId: closest.id, insertIdx, mode: "child" as const };
        } else {
            // Insert as sibling of closest (share its parent)
            const targetParentId = closestStoreNode.parentId;
            if (!targetParentId) return null;
            const sortedSiblings = allNodes
                .filter((n) => n.parentId === targetParentId && n.id !== draggedId)
                .sort((a, b) => a.sortIndex - b.sortIndex);
            const targetIdx = sortedSiblings.findIndex((n) => n.id === closest!.id);
            const insertBefore = dy < closest.position.y;
            const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
            return { parentId: targetParentId, insertIdx, mode: "sibling" as const };
        }
    }, [nodes]);

    // Live edge preview during drag
    const handleNodeDrag = useCallback((_: unknown, draggedNode: Node) => {
        const draggedId = draggedNode.id;
        const target = calcDropTarget(draggedId, draggedNode.position.x, draggedNode.position.y);

        setEdges(() => {
            const base = flowEdges.filter((e) => e.target !== draggedId);
            if (target) {
                return [
                    ...base,
                    {
                        id: `preview-${draggedId}`,
                        source: target.parentId,
                        target: draggedId,
                        type: "default",
                        style: { strokeDasharray: "6 3", opacity: 0.6 },
                        animated: true,
                    },
                ];
            }
            return flowEdges;
        });
    }, [calcDropTarget, flowEdges, setEdges]);

    // Commit on drag stop
    const handleNodeDragStop = useCallback((_: unknown, draggedNode: Node) => {
        // Restore edges first
        setEdges(flowEdges);

        const draggedId = draggedNode.id;
        const target = calcDropTarget(draggedId, draggedNode.position.x, draggedNode.position.y);

        if (target) {
            store.moveNode(draggedId, target.parentId, target.insertIdx);
            store.pushHistory();
        } else {
            if (layoutMode === "auto") {
                store.triggerAutoLayout();
            }
        }
    }, [calcDropTarget, store, layoutMode, flowEdges, setEdges]);

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

            // Only process in mindmap view
            const s = useMindmapStore.getState();
            if (s.viewMode !== "mindmap") return;

            const ctrl = e.ctrlKey || e.metaKey;

            // Ctrl+Shift+Enter → Add child node (above existing children)
            if (ctrl && e.shiftKey && e.key === "Enter" && s.selectedNodeId) {
                e.preventDefault();
                s.addChildAbove(s.selectedNodeId);
                s.pushHistory();
            }
            // Ctrl+Enter → Add child node (below existing children)
            else if (ctrl && !e.shiftKey && e.key === "Enter" && s.selectedNodeId) {
                e.preventDefault();
                s.addNode(s.selectedNodeId, "");
                s.pushHistory();
            }
            // Enter → Add sibling below
            else if (!ctrl && e.key === "Enter" && s.selectedNodeId) {
                e.preventDefault();
                s.addSibling(s.selectedNodeId);
                s.pushHistory();
            }
            // Tab → Add child (alt shortcut)
            else if (e.key === "Tab" && !e.shiftKey && s.selectedNodeId) {
                e.preventDefault();
                s.addNode(s.selectedNodeId, "");
                s.pushHistory();
            }
            // Ctrl+E → Collapse
            else if (ctrl && e.key === "e") {
                e.preventDefault();
                if (s.selectedNodeId) {
                    const node = s.nodes.find((n) => n.id === s.selectedNodeId);
                    if (node && !node.collapsed) { s.toggleCollapse(s.selectedNodeId); s.pushHistory(); }
                }
            }
            // Ctrl+D → Expand
            else if (ctrl && e.key === "d") {
                e.preventDefault();
                if (s.selectedNodeId) {
                    const node = s.nodes.find((n) => n.id === s.selectedNodeId);
                    if (node && node.collapsed) { s.toggleCollapse(s.selectedNodeId); s.pushHistory(); }
                }
            }
            // Ctrl+S → Save
            else if (ctrl && e.key === "s") {
                e.preventDefault();
                // Save is handled by the toolbar
                document.querySelector<HTMLButtonElement>(".btn-save")?.click();
            }
            // Delete/Backspace
            else if ((e.key === "Delete" || e.key === "Backspace") && s.selectedNodeId) {
                e.preventDefault();
                s.deleteNode(s.selectedNodeId);
                s.pushHistory();
            }
            // Ctrl+Z → Undo
            else if (ctrl && e.key === "z") {
                e.preventDefault();
                s.undo();
            }
            // Ctrl+Y → Redo
            else if (ctrl && e.key === "y") {
                e.preventDefault();
                s.redo();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const nodeColor = useMindmapStore((s) => s.nodeColor);
    const nodeTextColor = useMindmapStore((s) => s.nodeTextColor);
    const nodeBorderColor = useMindmapStore((s) => s.nodeBorderColor);
    const nodePaddingV = useMindmapStore((s) => s.nodePaddingV);
    const nodePaddingH = useMindmapStore((s) => s.nodePaddingH);
    const nodeFontSize = useMindmapStore((s) => s.nodeFontSize);
    const btnSize = useMindmapStore((s) => s.btnSize);
    const badgePadding = useMindmapStore((s) => s.badgePadding);
    const borderWidth = useMindmapStore((s) => s.borderWidth);

    return (
        <div
            className="mindmap-canvas-container"
            style={{
                "--node-padding-v": `${nodePaddingV}px`,
                "--node-padding-h": `${nodePaddingH}px`,
                "--node-font-size": `${nodeFontSize}px`,
                "--btn-size": `${btnSize}px`,
                "--badge-padding": `${badgePadding}px`,
                "--node-border-width": `${borderWidth}px`,
                "--edge-width": `${edgeWidth}`,
                ...(nodeColor ? { "--node-custom-color": nodeColor } : {}),
                ...(nodeTextColor ? { "--node-custom-text": nodeTextColor } : {}),
                ...(nodeBorderColor ? { "--node-custom-border": nodeBorderColor } : {}),
                ...(bgColor ? { "--canvas-bg-color": bgColor } : {}),
            } as React.CSSProperties}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onMoveEnd={handleMoveEnd}
                onNodeDragStop={handleNodeDragStop}
                onNodeDrag={handleNodeDrag}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                defaultViewport={store.viewport}
                fitView={storeNodes.length > 0}
                fitViewOptions={{ padding: 0.3 }}
                proOptions={{ hideAttribution: true }}
            >
                {/* Dynamic background */}
                {(() => {
                    const cssBgs = new Set([
                        "gradient-dark", "gradient-blue", "light-clean", "light-warm", "light-blue",
                        "blueprint", "sunset", "aurora", "paper", "honeycomb",
                        "light-rose", "light-mint", "light-lavender", "linen",
                        "topo", "diagonal", "confetti", "circuit", "waves", "mosaic",
                        "dots-dense", "dots-sparse", "grid-thick", "herringbone",
                        "stars", "bubbles", "chevron", "zigzag", "scales", "terrazzo",
                    ]);
                    if (bgStyle === "none") return null;
                    if (cssBgs.has(bgStyle)) return <div className={`rf-bg rf-bg-${bgStyle}`} />;
                    if (bgStyle === "grid-fine") return <Background variant={BackgroundVariant.Lines} gap={12} size={0.5} color="rgba(255,255,255,0.04)" />;
                    if (bgStyle === "subtle-dots") return <Background variant={BackgroundVariant.Dots} gap={30} size={0.5} color="rgba(255,255,255,0.06)" />;
                    if (bgStyle === "lines") return <Background variant={BackgroundVariant.Lines} gap={20} size={1} />;
                    if (bgStyle === "cross") return <Background variant={BackgroundVariant.Cross} gap={20} size={1} />;
                    return <Background variant={BackgroundVariant.Dots} gap={20} size={1} />;
                })()}
                {/* Background tone overlay */}
                {bgTone && <div className="rf-bg-tint" style={{ background: bgTone }} />}
                <Controls />
                {/* SVG gradient for "gradient" edge style */}
                <svg style={{ position: "absolute", width: 0, height: 0 }}>
                    <defs>
                        <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6c63ff" />
                            <stop offset="50%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                    </defs>
                </svg>
            </ReactFlow>
        </div>
    );
}
