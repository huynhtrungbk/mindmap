import { NextResponse } from "next/server";

// Force Node.js runtime (Edge runtime crashes on CentOS 7 kernel 3.10)
export const runtime = "nodejs";

export function middleware() {
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
