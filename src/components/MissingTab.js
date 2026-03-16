"use client";

import { useMemo } from "react";
import DataTable from "./DataTable";
import { downloadCsv } from "@/lib/csv";

export default function MissingTab({ rows, selectedRows, onToggleRow, onToggleAll }) {
  const columns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const handleDownload = () => {
    const selected = rows.filter((_, i) => selectedRows.has(i));
    downloadCsv(selected, columns, "missing_campaigns.csv");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-surface-900">Campaigns to Create</h3>
          <p className="text-xs text-surface-700 mt-0.5">
            These Final URLs exist in your Sheet but have no active campaign
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-surface-700">
              {selectedRows.size} of {rows.length} selected
            </span>
            <button
              onClick={handleDownload}
              disabled={selectedRows.size === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-surface-300 text-white text-xs font-semibold transition"
            >
              ⬇ Download CSV ({selectedRows.size})
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
          All sheet URLs have active campaigns!
        </div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          selectedRows={selectedRows}
          onToggleRow={onToggleRow}
          onToggleAll={onToggleAll}
        />
      )}
    </div>
  );
}
