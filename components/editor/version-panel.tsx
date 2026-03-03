/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useMindmapStore } from "@/stores/mindmap-store";
import { showToast } from "@/components/ui/toast";

export function VersionPanel() {
    const mapId = useMindmapStore((s) => s.mapId);
    const [versions, setVersions] = useState<Array<{ id: string; versionNo: number; createdAt: string }>>([]);
    const [loading, setLoading] = useState(false);

    const fetchVersions = useCallback(async () => {
        if (!mapId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/maps/${mapId}/versions`);
            const data = await res.json();
            setVersions(Array.isArray(data) ? data : []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [mapId]);

    useEffect(() => { fetchVersions(); }, [fetchVersions]);

    async function handlePublish() {
        if (!mapId) return;
        try {
            const res = await fetch(`/api/maps/${mapId}/publish`, { method: "POST" });
            const data = await res.json();
            showToast(`Published v${data.versionNo}`, "success");
            fetchVersions();
        } catch {
            showToast("Failed to publish", "error");
        }
    }

    async function handleRestore(versionId: string, vno: number) {
        if (!mapId || !confirm(`Restore to v${vno}? Current changes will be overwritten.`)) return;
        try {
            await fetch(`/api/maps/${mapId}/restore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ versionId }),
            });
            showToast(`Restored to v${vno}`, "success");
            window.location.reload();
        } catch {
            showToast("Failed to restore", "error");
        }
    }

    return (
        <div className="version-panel">
            <div className="version-header">
                <h4>📦 Versions</h4>
                <button className="btn-primary btn-sm" onClick={handlePublish}>Publish</button>
            </div>
            {loading ? (
                <p className="version-loading">Loading…</p>
            ) : versions.length === 0 ? (
                <p className="version-empty">No versions yet</p>
            ) : (
                <ul className="version-list">
                    {versions.map((v) => (
                        <li key={v.id} className="version-item">
                            <span>v{v.versionNo}</span>
                            <span className="version-date">
                                {new Date(v.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <button className="version-restore" onClick={() => handleRestore(v.id, v.versionNo)}>
                                Restore
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
