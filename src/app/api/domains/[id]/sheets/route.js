import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/api-auth";

// GET /api/domains/[id]/sheets
export async function GET(request, { params }) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = params;
    const { rows } = await query(
      "SELECT * FROM domain_sheets WHERE domain_id = $1 ORDER BY sheet_type",
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/domains/[id]/sheets GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/domains/[id]/sheets — upsert by sheet_type
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const { sheet_type, sheet_url, worksheet_name, url_column } = await request.json();

    if (!sheet_type || !sheet_url) {
      return NextResponse.json(
        { error: "sheet_type and sheet_url required" },
        { status: 400 }
      );
    }

    const { rows } = await query(
      `INSERT INTO domain_sheets (domain_id, sheet_type, sheet_url, worksheet_name, url_column)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (domain_id, sheet_type)
       DO UPDATE SET sheet_url = $3, worksheet_name = $4, url_column = $5, updated_at = NOW()
       RETURNING *`,
      [id, sheet_type, sheet_url, worksheet_name || "", url_column || "Final_URL"]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[api/domains/[id]/sheets POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
