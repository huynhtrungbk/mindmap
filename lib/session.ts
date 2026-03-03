import { cookies } from "next/headers";
import { verifyJwt, type JwtPayload } from "./auth";

const COOKIE_NAME = "session";
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Get current session from JWT cookie.
 * Returns the payload (userId, email) or null if not authenticated.
 */
export async function getSession(): Promise<JwtPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    return await verifyJwt(token);
}

/**
 * Build a Set-Cookie header value for setting the JWT session.
 */
export function buildSessionCookie(token: string): string {
    const maxAge = 60 * 60 * 24; // 24 hours
    const secure = IS_PROD ? "; Secure" : "";
    return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/**
 * Build a Set-Cookie header value for clearing the session.
 */
export function buildLogoutCookie(): string {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
