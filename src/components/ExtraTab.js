"use client";

import DataTable from "./DataTable";
import { downloadCsv } from "@/lib/csv";

const COLUMNS = ["campaignName", "adGroupName", "keywords", "finalUrl"];
const COLUMN_LABELS = {
  campaignName: "Campaign",
  adGroupName: "Ad Group",
  keywords: "Keywords",
  finalUrl: "Final URL",
};

export default function ExtraTab({ rows }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-surface-900">Extra Campaigns</h3>
          <p className="text-xs text-surface-700 mt-0.5">
            These Final URLs are in Google Ads but NOT in your Sheet
          </p>
        </div>
        {rows.length > 0 && (
          <button
            onClick={() => downloadCsv(rows, COLUMNS, "extra_campaigns.csv")}
            className="px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-900 text-white text-xs font-semibold transition"
          >
            ⬇ Download CSV
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-surface-700">No extra campaigns found.</p>
      ) : (
        <DataTable rows={rows} columns={COLUMNS} columnLabels={COLUMN_LABELS} />
      )}
    </div>
  );
}
