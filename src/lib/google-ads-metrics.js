/**
 * Google Ads metrics helper for sparkline data.
 * Uses the same REST API v23 pattern as the existing google-ads.js.
 */

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

async function gaqlQuery(customerId, query, accessToken) {
  const cleanId = customerId.replace(/-/g, "");
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "");

  let allRows = [];
  let pageToken = null;

  do {
    const body = { query };
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

/**
 * Fetch 30-day daily metrics for given account IDs.
 * Returns an object: { [date]: { clicks, impressions, cost, ctr, cpc } }
 */
export async function fetch30DayMetrics(accountIds) {
  if (!accountIds || accountIds.length === 0) return {};

  const accessToken = await getAccessToken();

  const query = `
    SELECT
      segments.date,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status = 'ENABLED'
  `;

  const dailyMap = {};

  for (const accountId of accountIds) {
    try {
      const rows = await gaqlQuery(accountId, query, accessToken);

      for (const row of rows) {
        const date = row.segments?.date;
        if (!date) continue;

        if (!dailyMap[date]) {
          dailyMap[date] = { clicks: 0, impressions: 0, costMicros: 0 };
        }

        dailyMap[date].clicks += parseInt(row.metrics?.clicks || 0);
        dailyMap[date].impressions += parseInt(row.metrics?.impressions || 0);
        dailyMap[date].costMicros += parseInt(row.metrics?.costMicros || 0);
      }
    } catch (err) {
      console.error(`[metrics] Error fetching account ${accountId}:`, err.message);
    }
  }

  // Sort by date and compute derived metrics
  const sorted = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, m]) => ({
      date,
      clicks: m.clicks,
      impressions: m.impressions,
      cost: m.costMicros / 1_000_000, // micros → dollars
      ctr: m.impressions > 0 ? m.clicks / m.impressions : 0,
      cpc: m.clicks > 0 ? m.costMicros / 1_000_000 / m.clicks : 0,
    }));

  return sorted;
}

/**
 * Extract sparkline data array for a given metric from daily metrics.
 */
export function extractSparklineData(dailyMetrics, metric = "clicks") {
  return dailyMetrics.map((d) => {
    switch (metric) {
      case "clicks": return d.clicks;
      case "impressions": return d.impressions;
      case "cost": return Math.round(d.cost * 100) / 100;
      case "ctr": return Math.round(d.ctr * 10000) / 100; // percentage
      case "cpc": return Math.round(d.cpc * 100) / 100;
      default: return d.clicks;
    }
  });
}
