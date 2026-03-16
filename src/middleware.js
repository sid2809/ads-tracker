import { NextResponse } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth/*
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /public files
     */
    "/((?!login|api/auth|_next|favicon\\.ico|.*\\.).*)",
  ],
};

export async function middleware(request) {
  const cookie = request.cookies.get(COOKIE_NAME);
  const user = await verifySession(cookie?.value);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Attach user info via REQUEST headers so API routes can read via headers()
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user", JSON.stringify(user));
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
