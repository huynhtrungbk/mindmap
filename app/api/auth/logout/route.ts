import { NextResponse } from "next/server";
import { buildLogoutCookie } from "@/lib/session";

export async function POST() {
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", buildLogoutCookie());
    return res;
}
