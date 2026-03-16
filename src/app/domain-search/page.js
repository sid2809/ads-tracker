"use client";

import { useState, useEffect } from "react";
import { AccountSelector, DataTable } from "@/components";
import { downloadCsv } from "@/lib/csv";

export default function DomainSearchPage() {
  // ─── Accounts State ───
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);

  // ─── Search State ───
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // ─── Load Accounts on Mount ───
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAccounts(data.accounts || []);
      })
      .catch((err) => setAccountsError(err.message))
      .finally(() => setAccountsLoading(false));
  }, []);

  // ─── Account Selection Handlers ───
  const toggleAccount = (id) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllAccounts = () => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(accounts.map((a) => a.id)));
    }
  };

  // ─── Search ───
  const runSearch = async () => {
    if (!domain.trim()) return setSearchError("Enter a domain name");
    if (selectedAccounts.size === 0)
      return setSearchError("Select at least one account");

    setSearching(true);
    setSearchError(null);
    setResults(null);

    try {
      const res = await fetch("/api/domain-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: Array.from(selectedAccounts),
          domain: domain.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  // ─── CSV Download ───
  const handleDownload = () => {
    if (!results?.results?.length) return;
    downloadCsv(results.results, columns, `domain_${domain.replace(/\./g, "_")}_campaigns.csv`);
  };

  const columns = [
    "campaignName",
    "campaignStatus",
    "adGroupName",
    "finalUrl",
  ];

  const columnLabels = {
    campaignName: "Campaign",
    campaignStatus: "Status",
    adGroupName: "Ad Group",
    finalUrl: "Final URL",
  };

  // ─── Render ───
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-900 tracking-tight">
          Domain Search
        </h1>
        <p className="text-surface-700 mt-1">
          Find all campaigns pointing to a specific domain across your accounts
        </p>
      </div>

      {/* Domain Input */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 mb-5">
        <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
          Domain
        </label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="w-full px-4 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
      </div>

      {/* Accounts */}
      <AccountSelector
        accounts={accounts}
        selectedAccounts={selectedAccounts}
        onToggle={toggleAccount}
        onToggleAll={toggleAllAccounts}
        loading={accountsLoading}
        error={accountsError}
      />

      {/* Search Button */}
      <button
        onClick={runSearch}
        disabled={searching || accountsLoading}
        className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-surface-300 text-white font-semibold text-sm transition shadow-sm shadow-blue-200 disabled:shadow-none mb-6"
      >
        {searching ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Searching...
          </span>
        ) : (
          "Search Domain"
        )}
      </button>

      {/* Error */}
      {searchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm mb-6 fade-in">
          {searchError}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="fade-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-surface-700">
              {results.totalCampaigns} campaign{results.totalCampaigns !== 1 ? "s" : ""} found
              for <span className="text-blue-600">{domain}</span>
            </p>
            {results.results.length > 0 && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-700 text-sm font-medium transition"
              >
                Download CSV
              </button>
            )}
          </div>

          {results.results.length > 0 ? (
            <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <DataTable
                  rows={results.results}
                  columns={columns}
                  columnLabels={columnLabels}
                />
              </div>
            </div>
          ) : (
            <div className="bg-surface-50 border border-surface-200 rounded-xl px-5 py-8 text-center text-sm text-surface-600">
              No campaigns found with final URLs pointing to {domain}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
