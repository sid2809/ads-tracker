import { getAccessToken, adsSearch } from "@/lib/google-ads";

export async function POST(request) {
  try {
    const { accountIds, domain } = await request.json();

    if (!accountIds?.length || !domain) {
      return Response.json(
        { error: "accountIds and domain are required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    const targetDomain = domain.trim().toLowerCase().replace(/^www\./, "");

    const query = `
      SELECT
        campaign.id, campaign.name, campaign.status,
        ad_group.name,
        ad_group_ad.ad.final_urls
      FROM ad_group_ad
      WHERE ad_group_ad.status = 'ENABLED'
        AND campaign.advertising_channel_type = 'SEARCH'
    `;

    let allResults = [];

    for (const accountId of accountIds) {
      try {
        const rows = await adsSearch(accountId, query, accessToken);

        for (const row of rows) {
          const campaign = row.campaign || {};
          const adGroup = row.adGroup || {};
          const ad = (row.adGroupAd || {}).ad || {};
          const finalUrls = ad.finalUrls || [];

          for (const url of finalUrls) {
            try {
              const parsed = new URL(url);
              const netloc = parsed.hostname.toLowerCase().replace(/^www\./, "");
              if (netloc === targetDomain) {
                allResults.push({
                  accountId,
                  campaignId: String(campaign.id || ""),
                  campaignName: campaign.name || "",
                  campaignStatus: campaign.status || "",
                  adGroupName: adGroup.name || "",
                  finalUrl: url,
                });
              }
            } catch {
              // skip invalid URLs
            }
          }
        }
      } catch (err) {
        console.error(`Domain search error for account ${accountId}:`, err.message);
      }
    }

    // Deduplicate by campaign + adGroup + finalUrl
    const seen = new Set();
    const deduped = allResults.filter((r) => {
      const key = `${r.accountId}::${r.campaignId}::${r.adGroupName}::${r.finalUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return Response.json({
      results: deduped,
      totalCampaigns: deduped.length,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
