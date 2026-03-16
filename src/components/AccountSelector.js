"use client";

export default function AccountSelector({
  accounts,
  selectedAccounts,
  onToggle,
  onToggleAll,
  loading,
  error,
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-surface-900 uppercase tracking-wider">
          Ad Accounts
        </h2>
        {accounts.length > 0 && (
          <button
            onClick={onToggleAll}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {selectedAccounts.size === accounts.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-surface-700">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading accounts from MCC...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-wrap gap-2">
          {accounts.map((acc) => (
            <label
              key={acc.id}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${
                selectedAccounts.has(acc.id)
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-surface-200 bg-surface-50 text-surface-700 hover:bg-surface-100"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedAccounts.has(acc.id)}
                onChange={() => onToggle(acc.id)}
                className="rounded"
              />
              <span className="font-medium">{acc.name}</span>
              <span className="text-xs opacity-50">{acc.id}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
