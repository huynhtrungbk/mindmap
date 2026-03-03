/**
 * DIF (Document Intermediate Format) — canonical tree model for conversion.
 * Used as neutral format between Mindmap ↔ MD ↔ DOCX.
 */
export interface DifNode {
    title: string;
    note: {
        doc: unknown | null;
        plain: string;
        html: string;
    };
    children: DifNode[];
}

/**
 * Convert mindmap nodes (flat list) to DIF tree.
 */
export function mindmapToDif(
    nodes: Array<{
        id: string;
        parentId: string | null;
        sortIndex: number;
        title: string;
        noteDoc: unknown | null;
        notePlain: string;
    }>
): DifNode[] {
    const childrenMap = new Map<string | null, typeof nodes>();
    for (const n of nodes) {
        const pid = n.parentId;
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(n);
    }

    function buildTree(parentId: string | null): DifNode[] {
        const children = childrenMap.get(parentId) || [];
        children.sort((a, b) => a.sortIndex - b.sortIndex);
        return children.map((n) => ({
            title: n.title,
            note: { doc: n.noteDoc, plain: n.notePlain, html: "" },
            children: buildTree(n.id),
        }));
    }

    return buildTree(null);
}

/**
 * Convert DIF tree back to flat mindmap nodes.
 */
export function difToMindmapNodes(
    difRoots: DifNode[]
): Array<{
    id: string;
    parentId: string | null;
    sortIndex: number;
    title: string;
    positionX: number;
    positionY: number;
    collapsed: boolean;
    noteDoc: unknown | null;
    notePlain: string;
}> {
    const result: ReturnType<typeof difToMindmapNodes> = [];
    let yCounter = 0;
    const X_GAP = 280;
    const Y_GAP = 80;

    function flatten(nodes: DifNode[], parentId: string | null, depth: number) {
        nodes.forEach((n, i) => {
            const id = crypto.randomUUID();
            const startY = yCounter;
            flatten(n.children, id, depth + 1);
            const endY = yCounter > startY ? yCounter - 1 : startY;
            const posY = n.children.length > 0 ? ((startY + endY) / 2) * Y_GAP : yCounter++ * Y_GAP;

            result.push({
                id,
                parentId,
                sortIndex: i,
                title: n.title,
                positionX: depth * X_GAP,
                positionY: posY,
                collapsed: false,
                noteDoc: n.note.doc,
                notePlain: n.note.plain || n.note.html || "",
            });
        });
    }

    flatten(difRoots, null, 0);
    return result;
}
