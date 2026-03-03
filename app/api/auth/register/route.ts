import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signJwt } from "@/lib/auth";
import { buildSessionCookie } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    try {
        // Rate limit
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
        const rl = checkRateLimit(`register:${ip}`);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "Too many registration attempts. Try again later." },
                { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
            );
        }

        // Validate input
        const body = await req.json();
        const parsed = registerSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid input" },
                { status: 400 }
            );
        }
        const { email, password } = parsed.data;

        // Check existing
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: "Email already registered" }, { status: 409 });
        }

        // Create user
        const passwordHash = await hashPassword(password);
        const user = await prisma.user.create({ data: { email, passwordHash } });

        // Sign JWT + set cookie
        const token = await signJwt({ userId: user.id, email: user.email });
        const res = NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
        res.headers.set("Set-Cookie", buildSessionCookie(token));
        return res;
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
