"use client";

import { useState, useEffect } from "react";
import {
  StatCard,
  TabButton,
  ConfigPanel,
  AccountSelector,
  MissingTab,
  ActiveTab,
  ExtraTab,
} from "@/components";

export default function Home() {
  // ─── Config State ───
  const [sheetUrl, setSheetUrl] = useState("");
  const [worksheetName, setWorksheetName] = useState("");
  const [urlColumn, setUrlColumn] = useState("Final_URL");

  // ─── Accounts State ───
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);

  // ─── Results State ───
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);

  // ─── UI State ───
  const [activeTab, setActiveTab] = useState("missing");
  const [selectedMissing, setSelectedMissing] = useState(new Set());

  // ─── Load Accounts on Mount ───
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAccounts(data.accounts || []);
        setSelectedAccounts(new Set((data.accounts || []).map((a) => a.id)));
      })
      .catch((err) => setAccountsError(err.message))
      .finally(() => setAccountsLoading(false));
  }, []);

  // ─── Select All Missing When Results Change ───
  useEffect(() => {
    if (results?.missing) {
      setSelectedMissing(new Set(results.missing.map((_, i) => i)));
    }
  }, [results]);

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

  // ─── Missing Row Selection Handlers ───
  const toggleMissingRow = (idx) => {
    setSelectedMissing((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAllMissing = () => {
    if (!results?.missing) return;
    if (selectedMissing.size === results.missing.length) {
      setSelectedMissing(new Set());
    } else {
      setSelectedMissing(new Set(results.missing.map((_, i) => i)));
    }
  };

  // ─── Run Reconciliation ───
  const runReconciliation = async () => {
    if (!sheetUrl) return setRunError("Enter a Google Sheet URL");
    if (selectedAccounts.size === 0) return setRunError("Select at least one account");

    setRunning(true);
    setRunError(null);
    setResults(null);

    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: Array.from(selectedAccounts),
          sheetUrl,
          worksheetName: worksheetName || undefined,
          urlColumn: urlColumn || "Final URL",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
      setActiveTab("missing");
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  };

  // ─── Render ───
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-900 tracking-tight">
          Campaign Tracker
        </h1>
        <p className="text-surface-700 mt-1">
          Reconcile active Google Ads campaigns against your master sheet
        </p>
      </div>

      {/* Config */}
      <ConfigPanel
        sheetUrl={sheetUrl}
        setSheetUrl={setSheetUrl}
        worksheetName={worksheetName}
        setWorksheetName={setWorksheetName}
        urlColumn={urlColumn}
        setUrlColumn={setUrlColumn}
      />

      {/* Accounts */}
      <AccountSelector
        accounts={accounts}
        selectedAccounts={selectedAccounts}
        onToggle={toggleAccount}
        onToggleAll={toggleAllAccounts}
        loading={accountsLoading}
        error={accountsError}
      />

      {/* Run Button */}
      <button
        onClick={runReconciliation}
        disabled={running || accountsLoading}
        className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-surface-300 text-white font-semibold text-sm transition shadow-sm shadow-blue-200 disabled:shadow-none mb-6"
      >
        {running ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Running reconciliation...
          </span>
        ) : (
          "Run Reconciliation"
        )}
      </button>

      {/* Error */}
      {runError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm mb-6 fade-in">
          {runError}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="fade-in">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 stagger">
            <StatCard label="Sheet URLs" value={results.stats.sheetUrls} color="blue" />
            <StatCard label="Active" value={results.stats.active} color="green" />
            <StatCard label="Missing" value={results.stats.missing} color="red" />
            <StatCard label="Extra" value={results.stats.extra} color="amber" />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-surface-200 bg-surface-50">
              <TabButton
                active={activeTab === "missing"}
                label="Missing"
                count={results.stats.missing}
                color="red"
                onClick={() => setActiveTab("missing")}
              />
              <TabButton
                active={activeTab === "active"}
                label="Active"
                count={results.stats.active}
                color="green"
                onClick={() => setActiveTab("active")}
              />
              <TabButton
                active={activeTab === "extra"}
                label="Extra"
                count={results.stats.extra}
                color="amber"
                onClick={() => setActiveTab("extra")}
              />
            </div>

            <div className="p-5">
              {activeTab === "missing" && (
                <MissingTab
                  rows={results.missing}
                  selectedRows={selectedMissing}
                  onToggleRow={toggleMissingRow}
                  onToggleAll={toggleAllMissing}
                />
              )}
              {activeTab === "active" && <ActiveTab rows={results.active} />}
              {activeTab === "extra" && <ExtraTab rows={results.extra} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
