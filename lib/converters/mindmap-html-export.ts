"use client";

import type { MindmapNodeData } from "@/stores/mindmap-store";

/**
 * Generate a standalone interactive HTML file from mindmap data.
 * Features: collapse/expand, right-side note panel with close button, pan/zoom, depth colors, edge lines.
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
    notePlain: string; noteDoc: unknown;
    hasNote: boolean;
    children: TreeNode[];
  }

  function buildTree(parentId: string | null): TreeNode[] {
    const children = childrenMap.get(parentId) || [];
    children.sort((a, b) => a.sortIndex - b.sortIndex);
    return children.map((n) => ({
      id: n.id,
      title: n.title || "Untitled",
      notePlain: n.notePlain || "",
      noteDoc: n.noteDoc || null,
      hasNote: !!(n.notePlain && n.notePlain.trim()) || !!(n.noteDoc),
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
<title>${esc(title || "Mindmap")}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:${bgColor};color:${nodeTextColor};height:100vh;overflow:hidden;display:flex;flex-direction:column}
.header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:rgba(15,15,35,0.95);border-bottom:1px solid rgba(108,99,255,0.2);flex-shrink:0;z-index:100}
.header h1{font-size:0.95rem;font-weight:600}
.header-actions{display:flex;gap:6px}
.header-actions button{padding:4px 10px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:${nodeTextColor};border-radius:6px;cursor:pointer;font-size:0.75rem;transition:all 0.15s}
.header-actions button:hover{background:rgba(108,99,255,0.2);border-color:#6c63ff}
.main{display:flex;flex:1;overflow:hidden;position:relative}
#viewport{flex:1;overflow:hidden;position:relative;cursor:grab}
#viewport.dragging{cursor:grabbing}
#canvas{position:absolute;top:0;left:0;transform-origin:0 0}
svg.edges{position:absolute;top:0;left:0;pointer-events:none;overflow:visible}
.node{position:absolute;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:${nodeColor};border:1.2px solid #6c63ff;border-radius:6px;cursor:default;white-space:nowrap;font-size:13px;font-weight:500;transition:box-shadow 0.15s}
.node:hover{box-shadow:0 0 12px rgba(108,99,255,0.3)}
.node .btn{width:16px;height:16px;border-radius:50%;border:none;font-size:9px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.12s;line-height:1}
.collapse-btn{background:rgba(108,99,255,0.3);color:#fff}
.collapse-btn:hover{background:#6c63ff}
.note-btn{background:rgba(245,158,11,0.3);color:#f59e0b}
.note-btn:hover{background:rgba(245,158,11,0.6)}
.child-count{font-size:9px;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.08);padding:0 5px;border-radius:8px}
.d0{border-color:#6c63ff}.d1{border-color:#06b6d4}.d2{border-color:#10b981}.d3{border-color:#f59e0b}.d4{border-color:#ec4899}.d5{border-color:#8b5cf6}
/* Note panel */
.note-panel{width:0;background:rgba(20,20,45,0.98);border-left:1px solid rgba(108,99,255,0.2);display:flex;flex-direction:column;flex-shrink:0;transition:width 0.2s;overflow:hidden}
.note-panel.open{width:360px}
.note-panel-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0}
.note-panel-header span{font-size:0.85rem;font-weight:600;color:#f59e0b}
.note-panel-close{background:transparent;border:1px solid rgba(255,255,255,0.15);color:#fff;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
.note-panel-close:hover{background:rgba(255,50,50,0.3);border-color:#f44}
.note-panel-title{padding:10px 14px 4px;font-size:0.8rem;font-weight:600;color:var(--color-primary,#6c63ff);border-bottom:1px solid rgba(255,255,255,0.05)}
.note-panel-body{flex:1;overflow-y:auto;padding:12px 14px;font-size:0.82rem;line-height:1.7;white-space:pre-wrap;color:rgba(255,255,255,0.8)}
.note-panel-body img{max-width:100%;border-radius:6px;margin:8px 0}
/* Zoom controls */
.zoom-controls{position:absolute;bottom:12px;right:12px;display:flex;flex-direction:column;gap:4px;z-index:50}
.zoom-controls button{width:28px;height:28px;border-radius:6px;background:rgba(30,30,58,0.9);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:14px;cursor:pointer}
.zoom-controls button:hover{background:rgba(108,99,255,0.4)}
</style>
</head>
<body>
<div class="header">
  <h1>\u{1F9E0} ${esc(title || "Mindmap")}</h1>
  <div class="header-actions">
    <button onclick="expandAll()">\u229E Expand All</button>
    <button onclick="collapseAll()">\u229F Collapse All</button>
    <button onclick="fitView()">\u229E Fit View</button>
  </div>
</div>
<div class="main">
  <div id="viewport">
    <div id="canvas"></div>
    <div class="zoom-controls">
      <button onclick="zoomIn()">+</button>
      <button onclick="zoomOut()">\u2212</button>
      <button onclick="fitView()">\u229E</button>
    </div>
  </div>
  <div class="note-panel" id="notePanel">
    <div class="note-panel-header">
      <span>\u{1F4DD} Note</span>
      <button class="note-panel-close" onclick="closeNote()">\u00D7</button>
    </div>
    <div class="note-panel-title" id="notePanelTitle"></div>
    <div class="note-panel-body" id="notePanelBody"></div>
  </div>
</div>
<script>
const TREE=${treeJson};
const DC=["#6c63ff","#06b6d4","#10b981","#f59e0b","#ec4899","#8b5cf6"];
const XGAP=200,YGAP=50,NH=28;
let pan={x:60,y:60},zoom=1,collapsed={},dragging=false,ds={x:0,y:0};

function layout(nodes,depth,yStart){
  let y=yStart;const r=[];
  for(const n of nodes){
    let kids=[];
    if(n.children.length>0&&!collapsed[n.id]){
      kids=layout(n.children,depth+1,y);
      y=kids.length>0?kids[kids.length-1]._bottom:y+YGAP;
    }else{y+=YGAP}
    const cy=kids.length>0?(kids[0]._y+kids[kids.length-1]._y)/2:(y-YGAP);
    r.push({...n,_x:depth*XGAP,_y:cy,_bottom:y,_depth:depth,_kids:kids});
  }
  return r;
}

function flat(arr){
  const r=[];
  for(const n of arr){r.push(n);if(n._kids)r.push(...flat(n._kids))}
  return r;
}

function render(){
  const canvas=document.getElementById("canvas");
  const tree=layout(TREE,0,0);
  const all=flat(tree);

  // Edges SVG
  let svg='<svg class="edges" xmlns="http://www.w3.org/2000/svg" style="width:9999px;height:9999px">';
  function edges(nodes){
    for(const n of nodes){
      if(n._kids&&n._kids.length>0){
        for(const c of n._kids){
          const x1=n._x+150,y1=n._y+NH/2;
          const x2=c._x,y2=c._y+NH/2;
          const mx=(x1+x2)/2;
          const col=DC[Math.min(c._depth,5)];
          svg+='<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+col+'" stroke-width="1.5" opacity="0.5"/>';
        }
        edges(n._kids);
      }
    }
  }
  edges(tree);
  svg+='</svg>';

  // Nodes HTML
  let h='';
  for(const n of all){
    const dc='d'+Math.min(n._depth,5);
    const hc=n.children.length>0;
    h+='<div class="node '+dc+'" style="left:'+n._x+'px;top:'+n._y+'px">';
    if(hc)h+='<button class="btn collapse-btn" onclick="tog(\\''+n.id+'\\')">'+(collapsed[n.id]?'\\u25B8':'\\u25BE')+'</button>';
    h+='<span>'+esc(n.title)+'</span>';
    if(n.hasNote)h+='<button class="btn note-btn" onclick="event.stopPropagation();showNote(\\''+n.id+'\\')">\\u{1F4DD}</button>';
    if(hc&&collapsed[n.id])h+='<span class="child-count">+'+n.children.length+'</span>';
    h+='</div>';
  }
  canvas.innerHTML=svg+h;
  canvas.style.transform='translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')';
}

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

// Node map for quick lookup
const nodeMap={};
function buildMap(nodes){for(const n of nodes){nodeMap[n.id]=n;if(n.children)buildMap(n.children)}}
buildMap(TREE);

function tog(id){collapsed[id]=!collapsed[id];render()}
function expandAll(){collapsed={};render()}
function collapseAll(){function m(ns){for(const n of ns){if(n.children.length>0){collapsed[n.id]=true;m(n.children)}}}m(TREE);render()}

function showNote(id){
  const n=nodeMap[id];if(!n)return;
  const panel=document.getElementById("notePanel");
  const titleEl=document.getElementById("notePanelTitle");
  const bodyEl=document.getElementById("notePanelBody");
  titleEl.textContent=n.title;
  // Render note content — extract images from noteDoc if available
  let content='';
  if(n.noteDoc&&typeof n.noteDoc==='object'){
    content=renderDoc(n.noteDoc);
  }else if(n.notePlain){
    content='<div>'+esc(n.notePlain)+'</div>';
  }else{
    content='<div style="color:rgba(255,255,255,0.4);font-style:italic">No note content</div>';
  }
  bodyEl.innerHTML=content;
  panel.classList.add("open");
}

function closeNote(){document.getElementById("notePanel").classList.remove("open")}

// Render TipTap JSON doc to HTML
function renderDoc(doc){
  if(!doc||!doc.content)return'';
  let h='';
  for(const block of doc.content){
    h+=renderBlock(block);
  }
  return h;
}

function renderBlock(b){
  if(!b)return'';
  if(b.type==='paragraph'){
    const inner=renderInline(b.content);
    return'<p style="margin:0.4em 0">'+(inner||'<br>')+'</p>';
  }
  if(b.type==='heading'){
    const lvl=b.attrs&&b.attrs.level||2;
    const inner=renderInline(b.content);
    return'<h'+lvl+' style="margin:0.6em 0 0.3em;font-size:'+(1.3-lvl*0.1)+'rem">'+inner+'</h'+lvl+'>';
  }
  if(b.type==='image'){
    const src=b.attrs&&b.attrs.src||'';
    const alt=b.attrs&&b.attrs.alt||'';
    return'<img src="'+esc(src)+'" alt="'+esc(alt)+'" style="max-width:100%;border-radius:6px;margin:6px 0"/>';
  }
  if(b.type==='bulletList'||b.type==='orderedList'){
    const tag=b.type==='bulletList'?'ul':'ol';
    let items='';
    if(b.content){for(const li of b.content){
      if(li.content){let inner='';for(const c of li.content)inner+=renderBlock(c);items+='<li>'+inner+'</li>';}
    }}
    return'<'+tag+' style="padding-left:1.4em;margin:0.3em 0">'+items+'</'+tag+'>';
  }
  if(b.type==='blockquote'){
    let inner='';if(b.content)for(const c of b.content)inner+=renderBlock(c);
    return'<blockquote style="border-left:3px solid #6c63ff;padding-left:10px;margin:0.4em 0;color:rgba(255,255,255,0.6);font-style:italic">'+inner+'</blockquote>';
  }
  if(b.type==='codeBlock'){
    const inner=renderInline(b.content);
    return'<pre style="background:rgba(0,0,0,0.3);padding:8px 12px;border-radius:6px;font-family:monospace;font-size:0.85em;overflow-x:auto">'+inner+'</pre>';
  }
  // Fallback
  if(b.content){let inner='';for(const c of b.content)inner+=renderBlock(c);return inner}
  return'';
}

function renderInline(content){
  if(!content)return'';
  let h='';
  for(const node of content){
    if(node.type==='text'){
      let t=esc(node.text||'');
      if(node.marks){
        for(const m of node.marks){
          if(m.type==='bold')t='<strong>'+t+'</strong>';
          if(m.type==='italic')t='<em>'+t+'</em>';
          if(m.type==='underline')t='<u>'+t+'</u>';
          if(m.type==='strike')t='<s>'+t+'</s>';
          if(m.type==='code')t='<code style="background:rgba(108,99,255,0.15);padding:1px 4px;border-radius:3px">'+t+'</code>';
          if(m.type==='link'&&m.attrs&&m.attrs.href)t='<a href="'+esc(m.attrs.href)+'" target="_blank" style="color:#6c63ff">'+t+'</a>';
        }
      }
      h+=t;
    }
    if(node.type==='image'){
      const src=node.attrs&&node.attrs.src||'';
      h+='<img src="'+esc(src)+'" style="max-width:100%;border-radius:6px;margin:4px 0"/>';
    }
    if(node.type==='hardBreak')h+='<br>';
  }
  return h;
}

function zoomIn(){zoom=Math.min(zoom*1.2,3);applyTransform()}
function zoomOut(){zoom=Math.max(zoom/1.2,0.2);applyTransform()}
function fitView(){pan={x:60,y:60};zoom=1;applyTransform()}
function applyTransform(){document.getElementById("canvas").style.transform='translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')'}

// Pan
const vp=document.getElementById("viewport");
vp.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;dragging=true;ds={x:e.clientX-pan.x,y:e.clientY-pan.y};vp.classList.add("dragging")});
window.addEventListener("pointermove",e=>{if(!dragging)return;pan.x=e.clientX-ds.x;pan.y=e.clientY-ds.y;applyTransform()});
window.addEventListener("pointerup",()=>{dragging=false;vp.classList.remove("dragging")});
vp.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(0.2,Math.min(3,zoom*(e.deltaY>0?0.9:1.1)));applyTransform()},{passive:false});

render();
</script>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
