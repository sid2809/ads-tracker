import { NextResponse } from "next/server";
import { checkCredentials, createSessionCookie } from "@/lib/auth";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const user = checkCredentials(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Incorrect credentials" },
        { status: 401 }
      );
    }

    const cookie = await createSessionCookie(user.username, user.role);
    const res = NextResponse.json({ username: user.username, role: user.role });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
