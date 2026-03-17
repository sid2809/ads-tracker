import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "./auth";

export async function getUser() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("ads_session");
  return await verifySession(cookie?.value);
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") return { user, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, error: null };
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, error: null };
}
