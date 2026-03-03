"use client";

import type { MindmapNodeData } from "@/stores/mindmap-store";

/**
 * Generate a standalone interactive HTML file from mindmap data.
 * Features: collapse/expand, note toggle, pan/zoom, depth colors.
 */
export function mindmapToInteractiveHtml(
    nodes: MindmapNodeData[],
    title: string,
    opts: {
        nodeColor?: string;
        nodeTextColor?: string;
        bgColor?: string;
    } = {}
): string {
    const {
        nodeColor = "#1e1e3a",
        nodeTextColor = "#e0e0e0",
        bgColor = "#0f0f23",
    } = opts;

    // Build tree structure for JSON embedding
    const childrenMap = new Map<string | null, MindmapNodeData[]>();
    for (const n of nodes) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId)!.push(n);
    }

    interface TreeNode {
        id: string; title: string;
        notePlain: string; hasNote: boolean;
        children: TreeNode[];
    }

    function buildTree(parentId: string | null): TreeNode[] {
        const children = childrenMap.get(parentId) || [];
        children.sort((a, b) => a.sortIndex - b.sortIndex);
        return children.map((n) => ({
            id: n.id,
            title: n.title || "Untitled",
            notePlain: n.notePlain || "",
            hasNote: !!(n.notePlain && n.notePlain.trim()),
            children: buildTree(n.id),
        }));
    }

    const tree = buildTree(null);
    const treeJson = JSON.stringify(tree);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || "Mindmap")}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: ${bgColor};
  color: ${nodeTextColor};
  min-height: 100vh;
  overflow: hidden;
}
#app { width: 100vw; height: 100vh; position: relative; }
#canvas {
  position: absolute; top: 0; left: 0;
  transform-origin: 0 0;
  cursor: grab;
}
#canvas.dragging { cursor: grabbing; }

/* Header */
.header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px;
  background: rgba(15,15,35,0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(108,99,255,0.2);
}
.header h1 { font-size: 1rem; font-weight: 600; }
.header-actions { display: flex; gap: 8px; }
.header-actions button {
  padding: 4px 12px; border: 1px solid rgba(255,255,255,0.15);
  background: transparent; color: ${nodeTextColor}; border-radius: 6px;
  cursor: pointer; font-size: 0.8rem; transition: all 0.15s;
}
.header-actions button:hover { background: rgba(108,99,255,0.2); border-color: #6c63ff; }

/* Node */
.node {
  position: absolute;
  display: flex; flex-direction: column;
  min-width: 80px;
}
.node-box {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 12px;
  background: ${nodeColor};
  border: 1.2px solid #6c63ff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  white-space: nowrap;
}
.node-box:hover { box-shadow: 0 0 12px rgba(108,99,255,0.3); }
.node-title { font-size: 13px; font-weight: 500; }
.collapse-btn {
  width: 16px; height: 16px; border-radius: 50%;
  background: rgba(108,99,255,0.3); border: none;
  color: white; font-size: 10px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.15s;
}
.collapse-btn:hover { background: #6c63ff; }
.note-btn {
  width: 16px; height: 16px; border-radius: 50%;
  background: rgba(245,158,11,0.3); border: none;
  color: #f59e0b; font-size: 9px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.15s;
}
.note-btn:hover { background: rgba(245,158,11,0.6); }
.child-count {
  font-size: 9px; color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.08); padding: 1px 5px;
  border-radius: 8px; flex-shrink: 0;
}

/* Note popup */
.note-popup {
  position: absolute; top: 100%; left: 8px;
  margin-top: 6px; padding: 10px 14px;
  background: #1a1a3a; border: 1px solid rgba(245,158,11,0.3);
  border-radius: 8px; max-width: 320px; min-width: 200px;
  font-size: 12px; line-height: 1.6; color: rgba(255,255,255,0.8);
  white-space: pre-wrap; z-index: 50;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  animation: fadeIn 0.15s;
}
@keyframes fadeIn { from { opacity:0; transform: translateY(-4px); } to { opacity:1; transform: translateY(0); } }
.note-popup-header {
  font-size: 10px; font-weight: 600; color: #f59e0b;
  margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;
}

/* Edge SVG */
.edges-svg {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: visible;
}

/* Depth colors */
.depth-0 .node-box { border-color: #6c63ff; }
.depth-1 .node-box { border-color: #06b6d4; }
.depth-2 .node-box { border-color: #10b981; }
.depth-3 .node-box { border-color: #f59e0b; }
.depth-4 .node-box { border-color: #ec4899; }
.depth-5 .node-box { border-color: #8b5cf6; }

/* Collapsed state */
.node.collapsed > .children { display: none; }
.node.collapsed .collapse-btn { opacity: 0.6; }

/* Zoom controls */
.zoom-controls {
  position: fixed; bottom: 16px; right: 16px; z-index: 100;
  display: flex; gap: 4px; flex-direction: column;
}
.zoom-controls button {
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(30,30,58,0.9); border: 1px solid rgba(255,255,255,0.15);
  color: white; font-size: 16px; cursor: pointer; transition: all 0.15s;
}
.zoom-controls button:hover { background: rgba(108,99,255,0.4); }
</style>
</head>
<body>
<div class="header">
  <h1>🧠 ${escapeHtml(title || "Mindmap")}</h1>
  <div class="header-actions">
    <button onclick="expandAll()">⊞ Expand All</button>
    <button onclick="collapseAll()">⊟ Collapse All</button>
    <button onclick="fitView()">⊡ Fit View</button>
  </div>
</div>
<div id="app">
  <div id="canvas"></div>
</div>
<div class="zoom-controls">
  <button onclick="zoomIn()" title="Zoom In">+</button>
  <button onclick="zoomOut()" title="Zoom Out">−</button>
  <button onclick="fitView()" title="Fit">⊡</button>
</div>
<script>
const TREE = ${treeJson};
const DEPTH_COLORS = ["#6c63ff","#06b6d4","#10b981","#f59e0b","#ec4899","#8b5cf6"];
const X_GAP = 200, Y_GAP = 50;

let pan = { x: 60, y: 60 };
let zoom = 1;
let collapsed = {};
let openNote = null;
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// Layout engine
function layoutTree(nodes, depth, yStart) {
  let y = yStart;
  const result = [];
  for (const node of nodes) {
    const nodeY = y;
    const childPositions = [];
    if (node.children.length > 0 && !collapsed[node.id]) {
      const childResult = layoutTree(node.children, depth + 1, y);
      childPositions.push(...childResult.positions);
      y = childResult.nextY;
    } else {
      y += Y_GAP;
    }
    const centerY = childPositions.length > 0
      ? (childPositions[0].y + childPositions[childPositions.length - 1].y) / 2
      : nodeY;
    result.push({ ...node, x: depth * X_GAP, y: centerY, depth, childPositions });
  }
  return { positions: result, nextY: y };
}

function flattenPositions(positions) {
  const flat = [];
  for (const p of positions) {
    flat.push(p);
    if (p.childPositions) flat.push(...flattenPositions(p.childPositions));
  }
  return flat;
}

// Render
function render() {
  const canvas = document.getElementById("canvas");
  const { positions } = layoutTree(TREE, 0, 0);
  const allNodes = flattenPositions(positions);

  // SVG edges
  let edgesSvg = '<svg class="edges-svg" xmlns="http://www.w3.org/2000/svg">';
  function drawEdges(nodes) {
    for (const n of nodes) {
      if (n.childPositions && n.childPositions.length > 0) {
        for (const c of n.childPositions) {
          const x1 = n.x + 160, y1 = n.y + 14;
          const x2 = c.x, y2 = c.y + 14;
          const mx = (x1 + x2) / 2;
          const col = DEPTH_COLORS[Math.min(c.depth, 5)];
          edgesSvg += '<path d="M '+x1+' '+y1+' C '+mx+' '+y1+', '+mx+' '+y2+', '+x2+' '+y2+'" fill="none" stroke="'+col+'" stroke-width="1.5" opacity="0.5"/>';
        }
        drawEdges(n.childPositions);
      }
    }
  }
  drawEdges(positions);
  edgesSvg += '</svg>';

  // HTML nodes
  let nodesHtml = '';
  for (const n of allNodes) {
    const depthClass = 'depth-' + Math.min(n.depth, 5);
    const collapsedClass = collapsed[n.id] ? ' collapsed' : '';
    const hasChildren = n.children && n.children.length > 0;
    const childCount = n.children ? n.children.length : 0;

    nodesHtml += '<div class="node ' + depthClass + collapsedClass + '" style="left:'+n.x+'px;top:'+n.y+'px">';
    nodesHtml += '<div class="node-box">';
    if (hasChildren) {
      nodesHtml += '<button class="collapse-btn" onclick="toggleCollapse(\\''+n.id+'\\')">'+
        (collapsed[n.id] ? '▸' : '▾') + '</button>';
    }
    nodesHtml += '<span class="node-title">' + escapeHtml(n.title) + '</span>';
    if (n.hasNote) {
      nodesHtml += '<button class="note-btn" onclick="event.stopPropagation();toggleNote(\\''+n.id+'\\')">📝</button>';
    }
    if (hasChildren && collapsed[n.id]) {
      nodesHtml += '<span class="child-count">+' + childCount + '</span>';
    }
    nodesHtml += '</div>';
    if (openNote === n.id && n.hasNote) {
      nodesHtml += '<div class="note-popup"><div class="note-popup-header">📝 Note</div>' + escapeHtml(n.notePlain) + '</div>';
    }
    nodesHtml += '</div>';
  }

  canvas.innerHTML = edgesSvg + nodesHtml;
  canvas.style.transform = 'translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')';
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleCollapse(id) { collapsed[id] = !collapsed[id]; render(); }
function toggleNote(id) { openNote = openNote === id ? null : id; render(); }
function expandAll() { collapsed = {}; render(); }
function collapseAll() {
  function markAll(nodes) { for (const n of nodes) { if (n.children.length>0) { collapsed[n.id]=true; markAll(n.children); } } }
  markAll(TREE); render();
}

function zoomIn() { zoom = Math.min(zoom * 1.2, 3); render(); }
function zoomOut() { zoom = Math.max(zoom / 1.2, 0.2); render(); }
function fitView() { pan = { x: 60, y: 60 }; zoom = 1; render(); }

// Pan
const app = document.getElementById("app");
app.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  isDragging = true; dragStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  document.getElementById("canvas").classList.add("dragging");
});
window.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  pan.x = e.clientX - dragStart.x;
  pan.y = e.clientY - dragStart.y;
  document.getElementById("canvas").style.transform = 'translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')';
});
window.addEventListener("pointerup", () => {
  isDragging = false;
  document.getElementById("canvas").classList.remove("dragging");
});
app.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  zoom = Math.max(0.2, Math.min(3, zoom * delta));
  render();
}, { passive: false });

// Initial render
render();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
