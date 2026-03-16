"use client";

/**
 * Reusable data table with optional row selection checkboxes.
 *
 * @param {Object[]} rows - Data rows
 * @param {string[]} columns - Column keys to display
 * @param {Object} [columnLabels] - Optional display labels for columns (key -> label)
 * @param {Set} [selectedRows] - Set of selected row indices (enables checkboxes)
 * @param {Function} [onToggleRow] - Callback when a row checkbox is toggled
 * @param {Function} [onToggleAll] - Callback when select-all is toggled
 */
export default function DataTable({
  rows,
  columns,
  columnLabels = {},
  selectedRows,
  onToggleRow,
  onToggleAll,
}) {
  const hasSelection = selectedRows !== undefined;

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-50 border-b border-surface-200">
            {hasSelection && (
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedRows.size === rows.length}
                  onChange={onToggleAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-semibold text-surface-700 uppercase tracking-wider"
              >
                {columnLabels[col] || col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-surface-100 table-row-hover transition"
            >
              {hasSelection && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(i)}
                    onChange={() => onToggleRow(i)}
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col} className="px-4 py-3 text-surface-800 max-w-md truncate">
                  {row[col] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
