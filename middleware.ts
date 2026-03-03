import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

// Force Node.js runtime (Edge runtime crashes silently on CentOS 7 kernel 3.10)
export const runtime = "nodejs";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/invite", "/api/health", "/invite"];
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
const ALLOWED_ORIGIN = process.env.APP_PUBLIC_URL || "http://localhost:3000";
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5 MB

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // ─── CORS ─────────────────────────────────────────
    if (req.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204,
            headers: corsHeaders(),
        });
    }

    // ─── Request size limit (API routes only) ─────────
    if (pathname.startsWith("/api/") && req.method !== "GET") {
        const contentLength = parseInt(req.headers.get("content-length") || "0");
        if (contentLength > MAX_BODY_SIZE) {
            return NextResponse.json(
                { error: "Request body too large", maxBytes: MAX_BODY_SIZE },
                { status: 413 }
            );
        }
    }

    // ─── Allow public paths ──────────────────────────
    if (
        PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
        pathname === "/" ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon")
    ) {
        return addCors(NextResponse.next());
    }

    // ─── Check session cookie + verify JWT ───────────
    const session = req.cookies.get("session");
    if (!session?.value) {
        const loginUrl = new URL("/login", req.url);
        return NextResponse.redirect(loginUrl);
    }

    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        await jose.jwtVerify(session.value, secret);
        return addCors(NextResponse.next());
    } catch {
        // Invalid/expired JWT — clear cookie and redirect to login
        const loginUrl = new URL("/login", req.url);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete("session");
        return res;
    }
}

function corsHeaders(): HeadersInit {
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
    };
}

function addCors(res: NextResponse): NextResponse {
    const headers = corsHeaders();
    for (const [key, value] of Object.entries(headers)) {
        res.headers.set(key, value);
    }
    return res;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
