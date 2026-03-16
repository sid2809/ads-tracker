import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/api-auth";

// GET /api/domains — list all domains with sheets + settings
export async function GET() {
  const { error } = requireAuth();
  if (error) return error;

  try {
    const { rows: domains } = await query("SELECT * FROM domains ORDER BY pinned DESC, domain_name ASC");
    const { rows: sheets } = await query("SELECT * FROM domain_sheets");
    const { rows: settings } = await query("SELECT * FROM domain_settings");

    const result = domains.map(d => ({
      ...d,
      sheets: sheets.filter(s => s.domain_id === d.id),
      settings: settings
        .filter(s => s.domain_id === d.id)
        .reduce((acc, s) => ({ ...acc, [s.setting_key]: s.setting_value }), {}),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/domains GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/domains — create a new domain
export async function POST(request) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const { domain_name } = await request.json();
    if (!domain_name?.trim()) {
      return NextResponse.json({ error: "Domain name required" }, { status: 400 });
    }

    const name = domain_name.trim().toLowerCase();

    // Check if exists
    const existing = await query(
      "SELECT id FROM domains WHERE domain_name = $1",
      [name]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { id: existing.rows[0].id, exists: true },
        { status: 200 }
      );
    }

    const { rows } = await query(
      "INSERT INTO domains (domain_name) VALUES ($1) RETURNING *",
      [name]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[api/domains POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
