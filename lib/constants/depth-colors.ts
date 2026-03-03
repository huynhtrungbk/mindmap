/**
 * Shared depth color palette used across the app.
 * 6 levels: purple → blue → cyan → emerald → amber → rose
 */
export const DEPTH_COLORS = [
    "#6c63ff", // depth-0: purple (root)
    "#3b82f6", // depth-1: blue
    "#06b6d4", // depth-2: cyan
    "#10b981", // depth-3: emerald
    "#f59e0b", // depth-4: amber
    "#f43f5e", // depth-5: rose
] as const;


/** RGB tuples for use in jsPDF and other contexts */
export const DEPTH_COLORS_RGB: [number, number, number][] = [
    [108, 99, 255],
    [59, 130, 246],
    [6, 182, 212],
    [16, 185, 129],
    [245, 158, 11],
    [244, 63, 94],
];
