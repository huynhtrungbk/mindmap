"use client";

const SHORTCUT_GROUPS = [
    {
        title: "Node Actions",
        shortcuts: [
            { keys: ["Enter"], action: "Add sibling node (below)" },
            { keys: ["Ctrl", "Enter"], action: "Add child node (below)" },
            { keys: ["Ctrl", "Shift", "Enter"], action: "Add child node (above)" },
            { keys: ["Tab"], action: "Add child node" },
            { keys: ["Delete"], action: "Delete selected node" },
            { keys: ["Double Click"], action: "Edit node title" },
        ],
    },
    {
        title: "Collapse / Expand",
        shortcuts: [
            { keys: ["Ctrl", "E"], action: "Collapse selected node" },
            { keys: ["Ctrl", "D"], action: "Expand selected node" },
        ],
    },
    {
        title: "Edit & History",
        shortcuts: [
            { keys: ["Ctrl", "Z"], action: "Undo" },
            { keys: ["Ctrl", "Y"], action: "Redo" },
            { keys: ["Ctrl", "S"], action: "Save" },
        ],
    },
];

export function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="shortcuts-header">
                    <h3>⌨️ Keyboard Shortcuts</h3>
                    <button className="shortcuts-close" onClick={onClose}>✕</button>
                </div>
                <div className="shortcuts-body">
                    {SHORTCUT_GROUPS.map((group) => (
                        <div key={group.title} className="shortcut-group">
                            <h4 className="shortcut-group-title">{group.title}</h4>
                            {group.shortcuts.map((s, i) => (
                                <div key={i} className="shortcut-row">
                                    <span className="shortcut-action">{s.action}</span>
                                    <span className="shortcut-keys">
                                        {s.keys.map((k, ki) => (
                                            <span key={ki}>
                                                <kbd className="shortcut-key">{k}</kbd>
                                                {ki < s.keys.length - 1 && <span className="shortcut-plus">+</span>}
                                            </span>
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="shortcuts-footer">
                    <span>On macOS, use ⌘ instead of Ctrl</span>
                </div>
            </div>
        </div>
    );
}
