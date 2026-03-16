import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

// PUT /api/domains/[id]/sheets/[sheetId]
export async function PUT(request, { params }) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const { sheetId } = params;
    const body = await request.json();
    const { rows } = await query(
      `UPDATE domain_sheets
       SET sheet_url = COALESCE($1, sheet_url),
           worksheet_name = COALESCE($2, worksheet_name),
           url_column = COALESCE($3, url_column),
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [body.sheet_url, body.worksheet_name, body.url_column, sheetId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[sheets/[sheetId] PUT]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/domains/[id]/sheets/[sheetId]
export async function DELETE(request, { params }) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const { sheetId } = params;
    const { rowCount } = await query("DELETE FROM domain_sheets WHERE id = $1", [sheetId]);
    if (rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sheets/[sheetId] DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
