import { NextResponse } from "next/server";

export async function getUser() {
  return { username: "admin", role: "admin" };
}

export async function requireAdmin() {
  return { user: { username: "admin", role: "admin" }, error: null };
}

export async function requireAuth() {
  return { user: { username: "admin", role: "admin" }, error: null };
}
