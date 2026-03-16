/**
 * Download an array of objects as a CSV file.
 * @param {Object[]} rows - Array of row objects
 * @param {string[]} columns - Column keys to include
 * @param {string} filename - Output filename
 */
export function downloadCsv(rows, columns, filename) {
  const header = columns.join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = String(row[col] || "").replace(/"/g, '""');
          return val.includes(",") || val.includes('"') || val.includes("\n")
            ? `"${val}"`
            : val;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
