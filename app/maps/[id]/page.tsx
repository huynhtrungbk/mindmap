import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMapRole } from "@/lib/collab";
import { redirect } from "next/navigation";
import { MapEditorClient } from "./editor-client";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function MapEditorPage({ params }: PageProps) {
    const session = await getSession();
    if (!session) redirect("/login");

    const { id } = await params;

    // Check access (owner or collaborator)
    const role = await getMapRole(session.userId, id);
    if (!role) {
        redirect("/dashboard");
    }

    const map = await prisma.mindmap.findUnique({
        where: { id },
        include: {
            nodes: { orderBy: { sortIndex: "asc" } },
            edges: true,
        },
    });

    if (!map) {
        redirect("/dashboard");
    }

    const initialNodes = map.nodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        title: n.title,
        positionX: n.positionX,
        positionY: n.positionY,
        sortIndex: n.sortIndex,
        collapsed: n.collapsed,
        noteDoc: n.noteDoc,
        notePlain: n.notePlain,
    }));

    const initialEdges = map.edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        type: e.type,
    }));

    const initialViewport = {
        x: map.viewportX,
        y: map.viewportY,
        zoom: map.viewportZoom,
    };

    return (
        <MapEditorClient
            mapId={id}
            mapTitle={map.title}
            role={role}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            initialViewport={initialViewport}
        />
    );
}
