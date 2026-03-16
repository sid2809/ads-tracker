"use client";

import DataTable from "./DataTable";

const COLUMNS = ["campaignName", "adGroupName", "keywords", "finalUrl"];
const COLUMN_LABELS = {
  campaignName: "Campaign",
  adGroupName: "Ad Group",
  keywords: "Keywords",
  finalUrl: "Final URL",
};

export default function ActiveTab({ rows }) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="font-semibold text-surface-900">Active Campaigns</h3>
        <p className="text-xs text-surface-700 mt-0.5">
          These Final URLs exist in both your Sheet and Google Ads
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-surface-700">No active campaigns found.</p>
      ) : (
        <DataTable rows={rows} columns={COLUMNS} columnLabels={COLUMN_LABELS} />
      )}
    </div>
  );
}
