/**
 * Client-side CSV download helper.
 * Converts array of objects to CSV and triggers browser download.
 */
export function downloadCSV(data, filename = "export.csv") {
  if (!data || data.length === 0) return;

  const keys = Object.keys(data[0]);

  // Build CSV string
  const header = keys.map(escapeCSV).join(",");
  const rows = data.map((row) =>
    keys.map((k) => escapeCSV(row[k] ?? "")).join(",")
  );

  const csv = [header, ...rows].join("\n");

  // Trigger download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(value) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
