import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { appendToSheet } from "@/lib/google-sheets-write";

// POST /api/domains/[id]/push-campaigns
// Body: { rows: [{ Title: "...", Final_URL: "..." }, ...] }
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const { rows } = await request.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    // Read output sheet config
    const { rows: sheets } = await query(
      "SELECT * FROM domain_sheets WHERE domain_id = $1 AND sheet_type = 'output'",
      [id]
    );

    if (sheets.length === 0) {
      return NextResponse.json(
        { error: "No output sheet configured. Go to Settings to add one." },
        { status: 400 }
      );
    }

    const outputSheet = sheets[0];

    // Read column mapping from settings (optional)
    const { rows: settingsRows } = await query(
      "SELECT setting_value FROM domain_settings WHERE domain_id = $1 AND setting_key = 'output_column_map'",
      [id]
    );

    let columnMap = null;
    if (settingsRows.length > 0) {
      try {
        columnMap = JSON.parse(settingsRows[0].setting_value);
      } catch { /* ignore */ }
    }

    // Convert rows to 2D array for Sheets API
    // If column mapping exists, use it to order columns
    // Otherwise, use all keys from the first row
    const keys = columnMap
      ? Object.keys(columnMap)
      : Object.keys(rows[0]);

    const sheetRows = rows.map((row) =>
      keys.map((key) => row[key] || "")
    );

    // Append to sheet
    const result = await appendToSheet(
      outputSheet.sheet_url,
      outputSheet.worksheet_name || "Sheet1",
      sheetRows
    );

    return NextResponse.json({
      ok: true,
      rowsAppended: rows.length,
      updatedRange: result.updates?.updatedRange || null,
    });
  } catch (err) {
    console.error("[api/push-campaigns]", err);
    return NextResponse.json(
      { error: err.message || "Failed to push campaigns" },
      { status: 500 }
    );
  }
}
