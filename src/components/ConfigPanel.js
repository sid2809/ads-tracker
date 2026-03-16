"use client";

export default function ConfigPanel({
  sheetUrl,
  setSheetUrl,
  worksheetName,
  setWorksheetName,
  urlColumn,
  setUrlColumn,
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
            Google Sheet URL
          </label>
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full px-4 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
            Worksheet Name
          </label>
          <input
            type="text"
            value={worksheetName}
            onChange={(e) => setWorksheetName(e.target.value)}
            placeholder="Sheet1"
            className="w-full px-4 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
        <div>
          <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
            Final URL Column
          </label>
          <input
            type="text"
            value={urlColumn}
            onChange={(e) => setUrlColumn(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>
      </div>
    </div>
  );
}
