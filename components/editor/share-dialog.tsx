"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/ui/toast";

interface Collaborator {
    id: string;
    email: string;
    role: string;
    accepted: boolean;
    token: string;
    expiresAt: string | null;
    createdAt: string;
}

interface ShareDialogProps {
    mapId: string;
    isOwner: boolean;
    onClose: () => void;
}

export function ShareDialog({ mapId, isOwner, onClose }: ShareDialogProps) {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [loading, setLoading] = useState(false);
    const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
    const [generatedLink, setGeneratedLink] = useState("");
    const [copied, setCopied] = useState(false);

    const fetchCollaborators = useCallback(async () => {
        if (!isOwner) return;
        try {
            const res = await fetch(`/api/maps/${mapId}/share`);
            if (res.ok) {
                const data = await res.json();
                setCollaborators(data.collaborators || []);
            }
        } catch (err) {
            console.error("Fetch collaborators error:", err);
        }
    }, [mapId, isOwner]);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        fetchCollaborators();
    }, [fetchCollaborators]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleGenerateLink = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/maps/${mapId}/share`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: inviteRole }),
            });
            if (res.ok) {
                const data = await res.json();
                setGeneratedLink(data.url);
                fetchCollaborators();
                showToast("Invite link generated", "success");
            } else {
                showToast("Failed to generate link", "error");
            }
        } catch {
            showToast("Network error", "error");
        }
        setLoading(false);
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(generatedLink);
            setCopied(true);
            showToast("Link copied!", "success");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast("Copy failed", "error");
        }
    };

    const handleRemove = async (collabId: string) => {
        try {
            const res = await fetch(`/api/maps/${mapId}/share`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ collaboratorId: collabId }),
            });
            if (res.ok) {
                fetchCollaborators();
                showToast("Collaborator removed", "success");
            }
        } catch {
            showToast("Remove failed", "error");
        }
    };

    return (
        <div className="share-overlay" onClick={onClose}>
            <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="share-header">
                    <h3>🔗 Share Mindmap</h3>
                    <button className="share-close" onClick={onClose}>✕</button>
                </div>

                {isOwner ? (
                    <>
                        {/* Generate invite link */}
                        <div className="share-section">
                            <label className="share-label">Generate Invite Link</label>
                            <div className="share-generate-row">
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                                    className="share-role-select"
                                >
                                    <option value="editor">✏️ Editor</option>
                                    <option value="viewer">👁 Viewer</option>
                                </select>
                                <button
                                    className="share-btn share-btn-primary"
                                    onClick={handleGenerateLink}
                                    disabled={loading}
                                >
                                    {loading ? "Generating…" : "🔑 Generate Link"}
                                </button>
                            </div>

                            {generatedLink && (
                                <div className="share-link-box">
                                    <input
                                        type="text"
                                        readOnly
                                        value={generatedLink}
                                        className="share-link-input"
                                    />
                                    <button className="share-btn share-btn-copy" onClick={handleCopyLink}>
                                        {copied ? "✅ Copied" : "📋 Copy"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Collaborators list */}
                        <div className="share-section">
                            <label className="share-label">
                                Collaborators ({collaborators.length})
                            </label>
                            {collaborators.length === 0 ? (
                                <p className="share-empty">No collaborators yet. Generate an invite link above.</p>
                            ) : (
                                <div className="share-collab-list">
                                    {collaborators.map((c) => (
                                        <div key={c.id} className="share-collab-item">
                                            <div className="share-collab-info">
                                                <span className="share-collab-email">{c.email}</span>
                                                <span className={`share-collab-badge ${c.role}`}>
                                                    {c.role}
                                                </span>
                                                {!c.accepted && (
                                                    <span className="share-collab-badge pending">pending</span>
                                                )}
                                                {c.expiresAt && !c.accepted && (
                                                    <span className="share-collab-expiry">
                                                        expires {new Date(c.expiresAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                className="share-btn share-btn-remove"
                                                onClick={() => handleRemove(c.id)}
                                                title="Remove"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="share-section">
                        <p className="share-empty">
                            You are a collaborator on this map. Only the owner can manage sharing.
                        </p>
                        <button
                            className="share-btn share-btn-remove"
                            style={{ marginTop: "8px", width: "100%" }}
                            onClick={async () => {
                                try {
                                    const res = await fetch(`/api/maps/${mapId}/share`, {
                                        method: "DELETE",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ leaveMap: true }),
                                    });
                                    if (res.ok) {
                                        showToast("Left the map", "success");
                                        window.location.href = "/dashboard";
                                    }
                                } catch {
                                    showToast("Failed to leave", "error");
                                }
                            }}
                        >
                            🚪 Leave this map
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
