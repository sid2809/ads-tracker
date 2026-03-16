import { NextResponse } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const user = await verifySession(cookie?.value);

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json(user);
}
