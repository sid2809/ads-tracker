// Google Ads REST API v23 helper — pure fetch, no gRPC
const ADS_API_VERSION = "v23";
const ADS_BASE = `https://googleads.googleapis.com/${ADS_API_VERSION}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Get a fresh OAuth2 access token using the refresh token.
 */
export async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth token error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Execute a GAQL query against the Google Ads REST API.
 * Handles pagination automatically.
 */
export async function adsSearch(customerId, query, accessToken) {
  const cid = customerId.replace(/-/g, "");
  const loginId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");
  const url = `${ADS_BASE}/customers/${cid}/googleAds:search`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "login-customer-id": loginId,
    "Content-Type": "application/json",
  };

  let allResults = [];
  let body = { query };

  while (true) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Google Ads API ${res.status}: ${txt.slice(0, 800)}`);
    }

    const data = await res.json();
    const results = data.results || [];
    allResults = allResults.concat(results);

    if (!data.nextPageToken) break;
    body.pageToken = data.nextPageToken;
  }

  return allResults;
}

/**
 * Fetch all enabled child (non-manager) accounts under the MCC.
 */
export async function fetchChildAccounts() {
  const accessToken = await getAccessToken();
  const loginId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

  const query = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.manager,
      customer_client.status
    FROM customer_client
    WHERE customer_client.manager = false
      AND customer_client.status = 'ENABLED'
  `;

  const results = await adsSearch(loginId, query, accessToken);

  return results
    .map((row) => {
      const cc = row.customerClient || {};
      return {
        id: String(cc.id || ""),
        name: cc.descriptiveName || `Account ${cc.id}`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch active final URLs + keywords from enabled search campaigns.
 * Merges keyword-level and ad-level data.
 */
export async function fetchActiveFinalUrls(customerId) {
  const accessToken = await getAccessToken();

  // Query 1: Keyword-level
  const kwQuery = `
    SELECT
      campaign.id, campaign.name,
      ad_group.id, ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.final_urls
    FROM keyword_view
    WHERE campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_criterion.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
  `;

  let keywordRows = [];
  try {
    const results = await adsSearch(customerId, kwQuery, accessToken);
    keywordRows = results.map((row) => {
      const campaign = row.campaign || {};
      const adGroup = row.adGroup || {};
      const criterion = row.adGroupCriterion || {};
      const keyword = criterion.keyword || {};
      const finalUrls = criterion.finalUrls || [];
      return {
        campaignId: String(campaign.id || ""),
        campaignName: campaign.name || "",
        adGroupId: String(adGroup.id || ""),
        adGroupName: adGroup.name || "",
        keyword: keyword.text || "",
        matchType: keyword.matchType || "",
        finalUrl: finalUrls[0] || "",
        source: "keyword",
      };
    });
  } catch (err) {
    console.error("Keyword query error:", err.message);
  }

  // Query 2: Ad-level
  const adQuery = `
    SELECT
      campaign.id, campaign.name,
      ad_group.id, ad_group.name,
      ad_group_ad.ad.final_urls
    FROM ad_group_ad
    WHERE campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_ad.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
  `;

  let adRows = [];
  try {
    const results = await adsSearch(customerId, adQuery, accessToken);
    adRows = results.map((row) => {
      const campaign = row.campaign || {};
      const adGroup = row.adGroup || {};
      const ad = (row.adGroupAd || {}).ad || {};
      const finalUrls = ad.finalUrls || [];
      return {
        campaignId: String(campaign.id || ""),
        campaignName: campaign.name || "",
        adGroupId: String(adGroup.id || ""),
        adGroupName: adGroup.name || "",
        keyword: "",
        matchType: "",
        finalUrl: finalUrls[0] || "",
        source: "ad",
      };
    });
  } catch (err) {
    console.error("Ad query error:", err.message);
  }

  // Merge: keyword rows often have empty finalUrl; ad rows have URL but no keywords
  const adUrlMap = new Map();
  for (const row of adRows) {
    const key = `${row.campaignId}::${row.adGroupId}`;
    if (row.finalUrl && !adUrlMap.has(key)) {
      adUrlMap.set(key, row.finalUrl);
    }
  }

  // Fill keyword rows with ad-level URLs when missing
  for (const row of keywordRows) {
    if (!row.finalUrl) {
      const key = `${row.campaignId}::${row.adGroupId}`;
      row.finalUrl = adUrlMap.get(key) || "";
    }
  }

  // Group keywords by campaign+adGroup+finalUrl
  const grouped = new Map();
  for (const row of keywordRows) {
    const key = `${row.campaignId}::${row.adGroupId}::${row.finalUrl}`;
    if (!grouped.has(key)) {
      grouped.set(key, { ...row, keywords: [] });
    }
    if (row.keyword) {
      grouped.get(key).keywords.push(row.keyword);
    }
  }

  // Add ad-only rows (campaigns that had no keywords)
  const kwCampaignKeys = new Set(keywordRows.map((r) => `${r.campaignId}::${r.adGroupId}`));
  for (const row of adRows) {
    const ck = `${row.campaignId}::${row.adGroupId}`;
    if (!kwCampaignKeys.has(ck) && row.finalUrl) {
      const key = `${row.campaignId}::${row.adGroupId}::${row.finalUrl}`;
      if (!grouped.has(key)) {
        grouped.set(key, { ...row, keywords: [] });
      }
    }
  }

  return Array.from(grouped.values()).map((row) => ({
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    adGroupName: row.adGroupName,
    keywords: row.keywords.sort().join(", "),
    finalUrl: row.finalUrl,
  }));
}
