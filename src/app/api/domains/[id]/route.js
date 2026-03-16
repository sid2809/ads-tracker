import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/api-auth";

// GET /api/domains/[id]
export async function GET(request, { params }) {
  const { error } = requireAuth();
  if (error) return error;

  try {
    const { id } = params;
    const { rows } = await query(
      `SELECT d.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ds.id, 'sheet_type', ds.sheet_type,
            'sheet_url', ds.sheet_url, 'worksheet_name', ds.worksheet_name,
            'url_column', ds.url_column
          )) FROM domain_sheets ds WHERE ds.domain_id = d.id),
          '[]'
        ) AS sheets,
        COALESCE(
          (SELECT json_object_agg(s.setting_key, s.setting_value)
           FROM domain_settings s WHERE s.domain_id = d.id),
          '{}'
        ) AS settings
       FROM domains d WHERE d.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[api/domains/[id] GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT /api/domains/[id]
export async function PUT(request, { params }) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const body = await request.json();
    const fields = [];
    const values = [];
    let idx = 1;

    if (body.domain_name !== undefined) {
      fields.push(`domain_name = $${idx++}`);
      values.push(body.domain_name.trim().toLowerCase());
    }
    if (body.account_ids !== undefined) {
      fields.push(`account_ids = $${idx++}`);
      values.push(JSON.stringify(body.account_ids));
    }
    if (body.pinned !== undefined) {
      fields.push(`pinned = $${idx++}`);
      values.push(body.pinned);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await query(
      `UPDATE domains SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[api/domains/[id] PUT]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/domains/[id]
export async function DELETE(request, { params }) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const { rowCount } = await query("DELETE FROM domains WHERE id = $1", [id]);

    if (rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/domains/[id] DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
