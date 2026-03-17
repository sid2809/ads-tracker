import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { query } from "@/lib/db";

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get access token");
  return data.access_token;
}

async function gaqlQuery(customerId, gaql, accessToken) {
  const cleanId = customerId.replace(/-/g, "");
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "");
  let allRows = [];
  let pageToken = null;

  do {
    const body = { query: gaql };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(
      `https://googleads.googleapis.com/v23/customers/${cleanId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          "login-customer-id": loginCustomerId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (data.results) allRows = allRows.concat(data.results);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return allRows;
}

async function fetchCampaignMetrics(accountIds, startDate, endDate, accessToken) {
  const gaql = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date >= '${startDate}'
      AND segments.date <= '${endDate}'
      AND campaign.status = 'ENABLED'
  `;

  const campaignMap = {};

  for (const accountId of accountIds) {
    try {
      const rows = await gaqlQuery(accountId, gaql, accessToken);
      for (const row of rows) {
        const cid = row.campaign?.id;
        const name = row.campaign?.name || "Unknown";
        if (!cid) continue;

        if (!campaignMap[cid]) {
          campaignMap[cid] = { id: cid, name, clicks: 0, impressions: 0, costMicros: 0 };
        }
        campaignMap[cid].clicks += parseInt(row.metrics?.clicks || 0);
        campaignMap[cid].impressions += parseInt(row.metrics?.impressions || 0);
        campaignMap[cid].costMicros += parseInt(row.metrics?.costMicros || 0);
      }
    } catch (err) {
      console.error(`[reports] Error fetching account ${accountId}:`, err.message);
    }
  }

  return Object.values(campaignMap).map((c) => ({
    id: c.id,
    name: c.name,
    clicks: c.clicks,
    impressions: c.impressions,
    cost: Math.round(c.costMicros / 10000) / 100,
    ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 100 : 0,
    cpc: c.clicks > 0 ? Math.round((c.costMicros / 1_000_000 / c.clicks) * 100) / 100 : 0,
  }));
}

// POST /api/domains/[id]/reports
// Body: { startDate, endDate, metric?: "clicks"|"cost"|"impressions"|"ctr"|"cpc", limit?: number }
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = params;
    const body = await request.json();
    const { startDate, endDate, metric = "clicks", limit = 10 } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    // Read domain config for account IDs
    const { rows: domainRows } = await query("SELECT * FROM domains WHERE id = $1", [id]);
    if (domainRows.length === 0) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }
    const accountIds = Array.isArray(domainRows[0].account_ids) ? domainRows[0].account_ids : [];

    if (accountIds.length === 0) {
      return NextResponse.json({ error: "No accounts configured" }, { status: 400 });
    }

    // Calculate previous period (same length, immediately before)
    const days = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days);
    const prevStartStr = prevStart.toISOString().split("T")[0];
    const prevEndStr = prevEnd.toISOString().split("T")[0];

    const accessToken = await getAccessToken();

    // Fetch both periods
    const [current, previous] = await Promise.all([
      fetchCampaignMetrics(accountIds, startDate, endDate, accessToken),
      fetchCampaignMetrics(accountIds, prevStartStr, prevEndStr, accessToken),
    ]);

    // Build comparison map
    const prevMap = {};
    for (const c of previous) {
      prevMap[c.id] = c;
    }

    // Compute deltas
    const compared = current.map((c) => {
      const prev = prevMap[c.id] || { clicks: 0, impressions: 0, cost: 0, ctr: 0, cpc: 0 };
      const prevVal = prev[metric] || 0;
      const currVal = c[metric] || 0;
      const delta = currVal - prevVal;
      const pctChange = prevVal > 0 ? Math.round((delta / prevVal) * 10000) / 100 : currVal > 0 ? 100 : 0;

      return {
        id: c.id,
        name: c.name,
        current: currVal,
        previous: prevVal,
        delta,
        pctChange,
        // Include all current metrics for context
        clicks: c.clicks,
        impressions: c.impressions,
        cost: c.cost,
        ctr: c.ctr,
        cpc: c.cpc,
      };
    });

    // Sort for gainers (highest positive delta) and losers (lowest negative delta)
    const gainers = [...compared]
      .filter((c) => c.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, limit);

    const losers = [...compared]
      .filter((c) => c.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, limit);

    return NextResponse.json({
      metric,
      period: { startDate, endDate, days },
      comparePeriod: { startDate: prevStartStr, endDate: prevEndStr, days },
      gainers,
      losers,
      totalCampaigns: current.length,
    });
  } catch (err) {
    console.error("[api/domains/[id]/reports POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
