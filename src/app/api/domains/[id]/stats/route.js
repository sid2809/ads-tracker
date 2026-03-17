import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { fetchMetrics, getDateRange, extractSparklineData } from "@/lib/google-ads-metrics";

// GET /api/domains/[id]/stats — read cached stats
export async function GET(request, { params }) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = params;
    const { rows } = await query(
      `SELECT cache_data, created_at FROM domain_cache
       WHERE domain_id = $1 AND cache_type = 'stats'`,
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
    console.error("[api/domains/[id]/stats GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/domains/[id]/stats — refresh stats from Google Ads
// Body: { days?: number, startDate?: string, endDate?: string }
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));

    // 1. Determine date range
    let startDate, endDate, rangeDays;
    if (body.startDate && body.endDate) {
      startDate = body.startDate;
      endDate = body.endDate;
      // Calculate days between
      rangeDays = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    } else {
      rangeDays = body.days || 30;
      const range = getDateRange(rangeDays);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    // 2. Read domain config
    const { rows: domainRows } = await query("SELECT * FROM domains WHERE id = $1", [id]);
    if (domainRows.length === 0) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }
    const domain = domainRows[0];
    const accountIds = Array.isArray(domain.account_ids) ? domain.account_ids : [];

    // 3. Read sparkline metric setting
    const { rows: settingsRows } = await query(
      "SELECT setting_value FROM domain_settings WHERE domain_id = $1 AND setting_key = 'dashboard_sparkline_metric'",
      [id]
    );
    const sparklineMetric = settingsRows[0]?.setting_value || "clicks";

    // 4. Read existing reconciliation cache for counts
    let reconStats = { sheetUrls: 0, active: 0, missing: 0, extra: 0 };
    const { rows: cacheRows } = await query(
      "SELECT cache_data FROM domain_cache WHERE domain_id = $1 AND cache_type = 'reconciliation'",
      [id]
    );
    if (cacheRows.length > 0 && cacheRows[0].cache_data?.stats) {
      reconStats = cacheRows[0].cache_data.stats;
    }

    // 5. Fetch metrics from Google Ads
    let dailyMetrics = [];
    let sparklineData = [];
    let totals = { clicks: 0, impressions: 0, cost: 0, avgCtr: 0, avgCpc: 0 };

    if (accountIds.length > 0) {
      try {
        dailyMetrics = await fetchMetrics(accountIds, startDate, endDate);
        sparklineData = extractSparklineData(dailyMetrics, sparklineMetric);

        if (dailyMetrics.length > 0) {
          totals.clicks = dailyMetrics.reduce((s, d) => s + d.clicks, 0);
          totals.impressions = dailyMetrics.reduce((s, d) => s + d.impressions, 0);
          totals.cost = Math.round(dailyMetrics.reduce((s, d) => s + d.cost, 0) * 100) / 100;
          totals.avgCtr = totals.impressions > 0
            ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0;
          totals.avgCpc = totals.clicks > 0
            ? Math.round((totals.cost / totals.clicks) * 100) / 100 : 0;
        }
      } catch (err) {
        console.error("[stats refresh] metrics fetch error:", err.message);
      }
    }

    // 6. Build all sparkline series
    const allSparklines = {
      clicks: extractSparklineData(dailyMetrics, "clicks"),
      impressions: extractSparklineData(dailyMetrics, "impressions"),
      cost: extractSparklineData(dailyMetrics, "cost"),
      ctr: extractSparklineData(dailyMetrics, "ctr"),
      cpc: extractSparklineData(dailyMetrics, "cpc"),
    };

    // 7. Build stats object
    const statsData = {
      ...reconStats,
      totals,
      sparkline: { metric: sparklineMetric, data: sparklineData },
      allSparklines,
      dailyMetrics,
      dateRange: { startDate, endDate, days: rangeDays },
    };

    // 8. Cache it
    const { rows: saved } = await query(
      `INSERT INTO domain_cache (domain_id, cache_type, cache_data)
       VALUES ($1, 'stats', $2)
       ON CONFLICT (domain_id, cache_type)
       DO UPDATE SET cache_data = $2, created_at = NOW()
       RETURNING *`,
      [id, JSON.stringify(statsData)]
    );

    return NextResponse.json({
      data: saved[0].cache_data,
      updated_at: saved[0].created_at,
    });
  } catch (err) {
    console.error("[api/domains/[id]/stats POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
