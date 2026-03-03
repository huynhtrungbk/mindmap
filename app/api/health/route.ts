import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health — Health check endpoint.
 * Returns DB connectivity status for liveness/readiness probes.
 */
export async function GET() {
    try {
        // Test DB connectivity
        await prisma.$queryRawUnsafe("SELECT 1");
        return NextResponse.json({
            status: "ok",
            db: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Health check failed:", error);
        return NextResponse.json(
            { status: "error", db: "disconnected" },
            { status: 503 }
        );
    }
}
