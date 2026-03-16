const COOKIE_NAME = "ads_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET env var is required");
  return s;
}

async function hmacSign(payload) {
  const secret = getSecret();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(payload, signature) {
  const expected = await hmacSign(payload);
  return expected === signature;
}

export async function createSessionCookie(username, role) {
  const exp = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = JSON.stringify({ username, role, exp });
  const b64 = btoa(payload);
  const sig = await hmacSign(b64);
  const value = `${b64}.${sig}`;

  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    },
  };
}

export async function verifySession(cookieValue) {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;

  const [b64, sig] = parts;
  const valid = await hmacVerify(b64, sig);
  if (!valid) return null;

  try {
    const payload = JSON.parse(atob(b64));
    if (payload.exp < Date.now()) return null;
    return { username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export function checkCredentials(username, password) {
  // Check admin
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return { username, role: "admin" };
  }

  // Check viewers
  try {
    const viewers = JSON.parse(process.env.VIEWER_ACCOUNTS || "[]");
    const match = viewers.find(
      (v) => v.username === username && v.password === password
    );
    if (match) return { username: match.username, role: "viewer" };
  } catch {
    // malformed JSON — ignore
  }

  return null;
}

export function isAdmin(user) {
  return user?.role === "admin";
}

export { COOKIE_NAME };
