import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/api-auth";

// GET /api/domains/[id]/cache — read cached reconciliation
export async function GET(request, { params }) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = params;
    const { rows } = await query(
      `SELECT cache_data, created_at FROM domain_cache
       WHERE domain_id = $1 AND cache_type = 'reconciliation'`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: rows[0].cache_data,
      updated_at: rows[0].created_at,
    });
  } catch (err) {
    console.error("[api/domains/[id]/cache GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/domains/[id]/cache — save reconciliation results to cache
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const body = await request.json();

    const { rows } = await query(
      `INSERT INTO domain_cache (domain_id, cache_type, cache_data)
       VALUES ($1, 'reconciliation', $2)
       ON CONFLICT (domain_id, cache_type)
       DO UPDATE SET cache_data = $2, created_at = NOW()
       RETURNING *`,
      [id, JSON.stringify(body)]
    );

    return NextResponse.json({
      data: rows[0].cache_data,
      updated_at: rows[0].created_at,
    });
  } catch (err) {
    console.error("[api/domains/[id]/cache POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
