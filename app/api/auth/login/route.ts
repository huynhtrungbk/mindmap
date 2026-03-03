import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signJwt } from "@/lib/auth";
import { buildSessionCookie } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    try {
        // Rate limit
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
        const rl = checkRateLimit(`login:${ip}`);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "Too many login attempts. Try again later." },
                { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
            );
        }

        // Validate input
        const body = await req.json();
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid input" },
                { status: 400 }
            );
        }
        const { email, password } = parsed.data;

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // Verify password
        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // Sign JWT + set cookie
        const token = await signJwt({ userId: user.id, email: user.email });
        const res = NextResponse.json({ id: user.id, email: user.email });
        res.headers.set("Set-Cookie", buildSessionCookie(token));
        return res;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
