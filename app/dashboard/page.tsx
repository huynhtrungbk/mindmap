"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useConfirm } from "@/components/ui/confirm-modal";

interface MindmapItem {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    role?: "owner" | "editor" | "viewer";
    ownerEmail?: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const [maps, setMaps] = useState<MindmapItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState("");
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const renameRef = useRef<HTMLInputElement>(null);
    const { confirm, modal } = useConfirm();

    const fetchMaps = useCallback(async () => {
        try {
            const res = await fetch("/api/maps");
            if (res.status === 401) { router.push("/login"); return; }
            const data = await res.json();
            // Support both paginated { maps: [...] } and legacy array response
            setMaps(Array.isArray(data) ? data : (data.maps ?? []));
        } catch (err) {
            console.error("Failed to fetch maps:", err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { fetchMaps(); }, [fetchMaps]);

    const filteredMaps = useMemo(() => {
        if (!search.trim()) return maps;
        const q = search.toLowerCase();
        return maps.filter((m) => m.title.toLowerCase().includes(q));
    }, [maps, search]);

    async function handleCreate() {
        setCreating(true);
        try {
            const res = await fetch("/api/maps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "Untitled Mindmap" }),
            });
            const map = await res.json();
            router.push(`/maps/${map.id}`);
        } catch (err) {
            console.error("Failed to create map:", err);
        } finally {
            setCreating(false);
        }
    }

    async function handleLogout() {
        const ok = await confirm("Logout", "Are you sure you want to logout?");
        if (!ok) return;
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    async function handleDelete(id: string, title: string) {
        const ok = await confirm(
            "Delete Mindmap",
            `Are you sure you want to delete "${title}"? This action cannot be undone.`,
            "danger"
        );
        if (!ok) return;
        try {
            await fetch(`/api/maps/${id}`, { method: "DELETE" });
            setMaps((prev) => prev.filter((m) => m.id !== id));
        } catch (err) {
            console.error("Failed to delete map:", err);
        }
    }

    async function handleDuplicate(id: string) {
        try {
            const res = await fetch(`/api/maps/${id}`);
            if (!res.ok) return;
            const data = await res.json();

            const createRes = await fetch("/api/maps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: `${data.title} (Copy)` }),
            });
            const newMap = await createRes.json();

            if (data.nodes?.length) {
                await fetch(`/api/maps/${newMap.id}/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        viewport: { x: data.viewportX ?? 0, y: data.viewportY ?? 0, zoom: data.viewportZoom ?? 1 },
                        nodes: data.nodes.map((n: Record<string, unknown>) => ({
                            id: n.id, parentId: n.parentId, title: n.title,
                            positionX: n.positionX, positionY: n.positionY,
                            sortIndex: n.sortIndex, collapsed: n.collapsed,
                            noteDoc: n.noteDoc ?? null, notePlain: n.notePlain ?? "",
                        })),
                        edges: (data.edges || []).map((e: Record<string, unknown>) => ({
                            id: e.id, source: e.sourceId, target: e.targetId, type: e.type ?? "default",
                        })),
                    }),
                });
            }
            fetchMaps();
        } catch (err) {
            console.error("Failed to duplicate map:", err);
        }
    }

    function startRename(map: MindmapItem) {
        setRenamingId(map.id);
        setRenameValue(map.title);
        setTimeout(() => renameRef.current?.select(), 50);
    }

    async function commitRename(id: string) {
        const trimmed = renameValue.trim();
        if (!trimmed) { setRenamingId(null); return; }
        try {
            await fetch(`/api/maps/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: trimmed }),
            });
            setMaps((prev) => prev.map((m) => m.id === id ? { ...m, title: trimmed } : m));
        } catch (err) {
            console.error("Rename failed:", err);
        }
        setRenamingId(null);
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("vi-VN", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <h1>🧠 My Mindmaps</h1>
                <div className="dashboard-actions">
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Search mindmaps…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="btn-primary" onClick={handleCreate} disabled={creating}>
                        {creating ? "Creating…" : "+ New Mindmap"}
                    </button>
                    <button className="btn-secondary" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {loading ? (
                <div className="maps-grid">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="map-card skeleton">
                            <div className="skeleton-title" />
                            <div className="skeleton-date" />
                        </div>
                    ))}
                </div>
            ) : filteredMaps.length === 0 ? (
                <div className="empty-state">
                    {search ? (
                        <p>No maps matching &quot;{search}&quot;</p>
                    ) : (
                        <>
                            <div className="empty-illustration">
                                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                                    <circle cx="60" cy="60" r="50" stroke="#6c63ff" strokeWidth="2" strokeDasharray="8 4" opacity="0.3" />
                                    <circle cx="60" cy="40" r="12" fill="#6c63ff" opacity="0.2" />
                                    <circle cx="35" cy="75" r="8" fill="#6c63ff" opacity="0.15" />
                                    <circle cx="85" cy="75" r="8" fill="#6c63ff" opacity="0.15" />
                                    <line x1="60" y1="52" x2="35" y2="67" stroke="#6c63ff" strokeWidth="1.5" opacity="0.2" />
                                    <line x1="60" y1="52" x2="85" y2="67" stroke="#6c63ff" strokeWidth="1.5" opacity="0.2" />
                                    <text x="60" y="44" textAnchor="middle" fill="#6c63ff" fontSize="14" opacity="0.5">🧠</text>
                                </svg>
                            </div>
                            <p>No mindmaps yet. Create your first one!</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="maps-grid">
                    {filteredMaps.map((map) => (
                        <div key={map.id} className="map-card">
                            <div className="map-card-body" onClick={() => router.push(`/maps/${map.id}`)}>
                                <h3>
                                    {renamingId === map.id ? (
                                        <input
                                            ref={renameRef}
                                            className="rename-input"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={() => commitRename(map.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") commitRename(map.id);
                                                if (e.key === "Escape") setRenamingId(null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    ) : (
                                        <>
                                            <span
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!map.role || map.role === "owner") startRename(map);
                                                }}
                                                title={(!map.role || map.role === "owner") ? "Double-click to rename" : ""}
                                            >
                                                {map.title}
                                            </span>
                                            {map.role && map.role !== "owner" && (
                                                <span className={`map-role-badge ${map.role}`}>{map.role}</span>
                                            )}
                                        </>
                                    )}
                                </h3>
                                <p className="map-date">Updated: {formatDate(map.updatedAt)}</p>
                                {map.ownerEmail && (
                                    <p className="map-owner-label">By: {map.ownerEmail}</p>
                                )}
                            </div>
                            <div className="map-card-actions">
                                {(!map.role || map.role === "owner") && (
                                    <>
                                        <button
                                            className="btn-icon-sm"
                                            onClick={(e) => { e.stopPropagation(); handleDuplicate(map.id); }}
                                            title="Duplicate"
                                        >📋</button>
                                        <button
                                            className="btn-danger-sm"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(map.id, map.title); }}
                                            title="Delete"
                                        >🗑</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {modal}
        </main>
    );
}
