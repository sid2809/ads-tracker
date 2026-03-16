import { NextResponse } from "next/server";
import { fetchActiveFinalUrls } from "@/lib/google-ads";
import { fetchSheetData } from "@/lib/google-sheets";
import { normalizeUrl } from "@/lib/utils";

export async function POST(request) {
  try {
    const body = await request.json();
    const { accountIds, sheetUrl, worksheetName, urlColumn } = body;

    if (!accountIds?.length) {
      return NextResponse.json({ error: "No accounts selected" }, { status: 400 });
    }
    if (!sheetUrl) {
      return NextResponse.json({ error: "No sheet URL provided" }, { status: 400 });
    }

    // 1. Fetch Google Ads data from all selected accounts
    const allAdsRows = [];
    for (const accountId of accountIds) {
      try {
        const rows = await fetchActiveFinalUrls(accountId);
        for (const row of rows) {
          allAdsRows.push({ ...row, accountId });
        }
      } catch (err) {
        console.error(`Error fetching account ${accountId}:`, err.message);
      }
    }

    // 2. Fetch Sheet data
    const sheetRows = await fetchSheetData(sheetUrl, worksheetName);
    if (!sheetRows.length) {
      return NextResponse.json({ error: "Sheet is empty or could not be read" }, { status: 400 });
    }

    const col = urlColumn || "Final URL";
    if (!sheetRows[0].hasOwnProperty(col)) {
      const available = Object.keys(sheetRows[0]).join(", ");
      return NextResponse.json(
        { error: `Column "${col}" not found. Available: ${available}` },
        { status: 400 }
      );
    }

    // 3. Normalize & match
    const sheetUrlSet = new Map(); // normalized -> sheet row(s)
    for (const row of sheetRows) {
      const norm = normalizeUrl(row[col]);
      if (norm) {
        if (!sheetUrlSet.has(norm)) sheetUrlSet.set(norm, []);
        sheetUrlSet.get(norm).push(row);
      }
    }

    const adsUrlSet = new Map(); // normalized -> ads row(s)
    for (const row of allAdsRows) {
      const norm = normalizeUrl(row.finalUrl);
      if (norm) {
        if (!adsUrlSet.has(norm)) adsUrlSet.set(norm, []);
        adsUrlSet.get(norm).push(row);
      }
    }

    const sheetNorms = new Set(sheetUrlSet.keys());
    const adsNorms = new Set(adsUrlSet.keys());

    // Active: in both
    const activeUrls = [...sheetNorms].filter((u) => adsNorms.has(u));
    const active = activeUrls.flatMap((u) => adsUrlSet.get(u));

    // Missing: in sheet but not in ads
    const missingUrls = [...sheetNorms].filter((u) => !adsNorms.has(u));
    const missing = missingUrls.flatMap((u) => sheetUrlSet.get(u));

    // Extra: in ads but not in sheet
    const extraUrls = [...adsNorms].filter((u) => !sheetNorms.has(u));
    const extra = extraUrls.flatMap((u) => adsUrlSet.get(u));

    return NextResponse.json({
      stats: {
        sheetUrls: sheetNorms.size,
        active: activeUrls.length,
        missing: missingUrls.length,
        extra: extraUrls.length,
      },
      active,
      missing,
      extra,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
