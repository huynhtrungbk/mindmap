import { z } from "zod";

// ─── Auth ────────────────────────────────────────────

export const registerSchema = z.object({
    email: z.string().email("Invalid email address").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

// ─── Maps ────────────────────────────────────────────

export const createMapSchema = z.object({
    title: z.string().min(1).max(200).default("Untitled"),
});

export const updateMapSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    viewportX: z.number().optional(),
    viewportY: z.number().optional(),
    viewportZoom: z.number().min(0.1).max(10).optional(),
});

// ─── Bulk Save ───────────────────────────────────────

export const saveNodeSchema = z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid().nullable(),
    sortIndex: z.number().int().min(0),
    positionX: z.number(),
    positionY: z.number(),
    title: z.string().max(1000),
    collapsed: z.boolean(),
    noteDoc: z.unknown().nullable(),
    notePlain: z.string().max(100000),
});

export const saveEdgeSchema = z.object({
    id: z.string().uuid(),
    source: z.string().uuid(),
    target: z.string().uuid(),
    type: z.string().max(50),
});

export const bulkSaveSchema = z.object({
    viewport: z.object({
        x: z.number(),
        y: z.number(),
        zoom: z.number().min(0.1).max(10),
    }).optional(),
    nodes: z.array(saveNodeSchema).max(2000, "Maximum 2000 nodes per map").optional(),
    edges: z.array(saveEdgeSchema).max(4000).optional(),
});

// ─── Attachments ─────────────────────────────────────

export const presignSchema = z.object({
    nodeId: z.string().uuid(),
    filename: z.string().min(1).max(255),
    mime: z.string().min(1).max(100),
    size: z.number().int().min(1).max(10 * 1024 * 1024, "Max 10MB"),
});

export const commitSchema = z.object({
    nodeId: z.string().uuid(),
    objectKey: z.string().min(1),
    filename: z.string().min(1).max(255),
    mime: z.string().min(1).max(100),
    size: z.number().int().min(1),
});
