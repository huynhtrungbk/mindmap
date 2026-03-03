import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW ?? "dev-secret");
const JWT_EXPIRES_IN = "24h";

// ─── Password ────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain);
}

export async function verifyPassword(
    hash: string,
    plain: string
): Promise<boolean> {
    try {
        return await argon2.verify(hash, plain);
    } catch {
        return false;
    }
}

// ─── JWT ─────────────────────────────────────────────

export interface JwtPayload {
    userId: string;
    email: string;
}

export async function signJwt(payload: JwtPayload): Promise<string> {
    return new SignJWT(payload as unknown as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(JWT_EXPIRES_IN)
        .setIssuedAt()
        .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as JwtPayload;
    } catch {
        return null;
    }
}

