import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!login|api/auth|_next|favicon\\.ico|.*\\.).*)"],
};

export async function middleware(request) {
  const cookie = request.cookies.get("ads_session");
  if (!cookie?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
