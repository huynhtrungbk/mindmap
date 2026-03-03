import { prisma } from "./db";

export type MapRole = "owner" | "editor" | "viewer" | null;

/**
 * Get the role of a user for a given map — single optimized query.
 * Returns "owner" | "editor" | "viewer" | null
 */
export async function getMapRole(userId: string, mapId: string): Promise<MapRole> {
    const map = await prisma.mindmap.findUnique({
        where: { id: mapId },
        select: {
            ownerId: true,
            collaborators: {
                where: { userId, accepted: true },
                select: { role: true },
                take: 1,
            },
        },
    });

    if (!map) return null;
    if (map.ownerId === userId) return "owner";
    if (map.collaborators.length > 0) return map.collaborators[0].role as "editor" | "viewer";
    return null;
}

/**
 * Check if user can access (view) a map.
 */
export async function canAccessMap(userId: string, mapId: string): Promise<boolean> {
    const role = await getMapRole(userId, mapId);
    return role !== null;
}

/**
 * Check if user can edit a map.
 */
export async function canEditMap(userId: string, mapId: string): Promise<boolean> {
    const role = await getMapRole(userId, mapId);
    return role === "owner" || role === "editor";
}

/**
 * Check if user is the owner of a map.
 */
export async function isMapOwner(userId: string, mapId: string): Promise<boolean> {
    const role = await getMapRole(userId, mapId);
    return role === "owner";
}
