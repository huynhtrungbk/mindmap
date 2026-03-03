"use client";

import { memo, useCallback, useState, useRef, useEffect } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";

interface CustomNodeProps {
    data: {
        label: string;
        nodeId: string;
        hasNote: boolean;
        hasChildren: boolean;
        isCollapsed: boolean;
        depth: number;
        noteExcerpt: string;
    };
    selected?: boolean;
}

function CustomNodeComponent({ data, selected }: CustomNodeProps) {
    const { updateNodeTitle, selectNode, pushHistory, toggleCollapse, forceOpenNote, addNode, addSibling, addSiblingAbove } = useMindmapStore();
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [showTooltip, setShowTooltip] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const depthClass = `depth-${Math.min(data.depth, 5)}`;

    // Title: show editTitle while editing, otherwise always use data.label (props)
    const title = editing ? editTitle : data.label;

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const handleDoubleClick = useCallback(() => {
        setEditTitle(data.label);
        setEditing(true);
    }, [data.label]);

    const handleBlur = useCallback(() => {
        setEditing(false);
        if (editTitle !== data.label) {
            updateNodeTitle(data.nodeId, editTitle);
            pushHistory();
        }
    }, [editTitle, data.label, data.nodeId, updateNodeTitle, pushHistory]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") { e.preventDefault(); handleBlur(); }
            if (e.key === "Escape") { setEditTitle(data.label); setEditing(false); }
        },
        [handleBlur, data.label]
    );

    const handleClick = useCallback(() => selectNode(data.nodeId), [selectNode, data.nodeId]);

    const handleNoteClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        forceOpenNote(data.nodeId);
    }, [forceOpenNote, data.nodeId]);

    const handleCollapseClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        toggleCollapse(data.nodeId);
        pushHistory();
    }, [toggleCollapse, data.nodeId, pushHistory]);

    const handleAddChild = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        addNode(data.nodeId, "");
        pushHistory();
    }, [addNode, data.nodeId, pushHistory]);

    // Top button → add sibling ABOVE
    const handleAddSiblingAbove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        addSiblingAbove(data.nodeId);
        pushHistory();
    }, [addSiblingAbove, data.nodeId, pushHistory]);

    // Bottom button → add sibling BELOW
    const handleAddSiblingBelow = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        addSibling(data.nodeId);
        pushHistory();
    }, [addSibling, data.nodeId, pushHistory]);

    return (
        <div
            className={`mindmap-node ${depthClass} ${selected ? "selected" : ""}`}
            onDoubleClick={handleDoubleClick}
            onClick={handleClick}
            onMouseEnter={() => data.noteExcerpt && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className="node-content">
                {editing ? (
                    <input
                        ref={inputRef}
                        className="node-title-input"
                        value={title}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                    />
                ) : (
                    <span className="node-title">{title || "Untitled"}</span>
                )}
                {data.hasNote && (
                    <button className="node-note-inline" onClick={handleNoteClick} title="Open note">
                        📝
                    </button>
                )}
            </div>

            {/* Collapse badge — absolute top-right, no width impact */}
            {data.hasChildren && (
                <div className="node-badges">
                    <button className="node-collapse-btn" onClick={handleCollapseClick} title={data.isCollapsed ? "Expand" : "Collapse"}>
                        {data.isCollapsed ? "▸" : "▾"}
                    </button>
                </div>
            )}

            {/* Floating add buttons — visible on hover */}
            <button className="node-add-btn node-add-child" onClick={handleAddChild} title="Add child node">
                +
            </button>
            <button className="node-add-sibling-top node-add-btn" onClick={handleAddSiblingAbove} title="Add sibling above">
                +
            </button>
            <button className="node-add-sibling-bottom node-add-btn" onClick={handleAddSiblingBelow} title="Add sibling below">
                +
            </button>

            {/* Note tooltip on hover */}
            {showTooltip && data.noteExcerpt && (
                <div className="node-tooltip">{data.noteExcerpt}</div>
            )}
        </div>
    );
}

export const CustomNode = memo(CustomNodeComponent);
