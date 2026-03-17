import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

// POST /api/domains/[id]/settings — upsert one or more settings
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const body = await request.json();

    // body is { key: value, key2: value2, ... }
    const entries = Object.entries(body);
    if (entries.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    for (const [key, value] of entries) {
      await query(
        `INSERT INTO domain_settings (domain_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (domain_id, setting_key)
         DO UPDATE SET setting_value = $3, updated_at = NOW()`,
        [id, key, typeof value === "string" ? value : JSON.stringify(value)]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/domains/[id]/settings POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
