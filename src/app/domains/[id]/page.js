"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";
import SaveCachePrompt from "@/components/SaveCachePrompt";
import MetricsPanel from "@/components/MetricsPanel";
import ReportsTab from "@/components/ReportsTab";
import { downloadCSV } from "@/lib/csv-download";

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DomainHubPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [domain, setDomain] = useState(null);
  const [domains, setDomains] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("reconciliation");

  // Cached results
  const [cachedData, setCachedData] = useState(null);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  // Stats data (metrics + sparklines)
  const [statsData, setStatsData] = useState(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState(null);

  // Reconciliation form
  const [sheetUrl, setSheetUrl] = useState("");
  const [worksheetName, setWorksheetName] = useState("");
  const [urlColumn, setUrlColumn] = useState("Final_URL");
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  // Reconciliation results
  const [reconResults, setReconResults] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconTab, setReconTab] = useState("missing");
  const [selectedRows, setSelectedRows] = useState([]);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  // Override detection
  const [showCachePrompt, setShowCachePrompt] = useState(false);
  const [pendingResults, setPendingResults] = useState(null);

  // Search form
  const [searchDomain, setSearchDomain] = useState("");
  const [searchAccounts, setSearchAccounts] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [savedConfig, setSavedConfig] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [d, all, accs, cache, stats] = await Promise.all([
        fetch(`/api/domains/${id}`).then(r => r.json()),
        fetch("/api/domains").then(r => r.json()),
        fetch("/api/accounts").then(r => r.json()),
        fetch(`/api/domains/${id}/cache`).then(r => r.json()),
        fetch(`/api/domains/${id}/stats`).then(r => r.json()),
      ]);

      setDomain(d);
      setDomains(Array.isArray(all) ? all : []);
      setAccounts(Array.isArray(accs?.accounts) ? accs.accounts : Array.isArray(accs) ? accs : []);

      const sourceSheet = d.sheets?.find(s => s.sheet_type === "source");
      const cfg = {
        sheetUrl: sourceSheet?.sheet_url || "",
        worksheetName: sourceSheet?.worksheet_name || "",
        urlColumn: sourceSheet?.url_column || "Final_URL",
        accountIds: Array.isArray(d.account_ids) ? d.account_ids : [],
      };
      setSheetUrl(cfg.sheetUrl);
      setWorksheetName(cfg.worksheetName);
      setUrlColumn(cfg.urlColumn);
      setSelectedAccounts(cfg.accountIds);
      setSavedConfig(cfg);
      setSearchDomain(d.domain_name || "");
      setSearchAccounts(cfg.accountIds);

      if (cache?.data) { setCachedData(cache.data); setCacheUpdatedAt(cache.updated_at); setReconResults(cache.data); }
      if (stats?.data) { setStatsData(stats.data); setStatsUpdatedAt(stats.updated_at); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isAdmin = user?.role === "admin";

  function isOverride() {
    if (!savedConfig) return false;
    return sheetUrl !== savedConfig.sheetUrl || worksheetName !== savedConfig.worksheetName ||
      urlColumn !== savedConfig.urlColumn ||
      JSON.stringify(selectedAccounts.slice().sort()) !== JSON.stringify(savedConfig.accountIds.slice().sort());
  }

  async function saveToCache(results) {
    try {
      await fetch(`/api/domains/${id}/cache`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(results) });
      setCachedData(results); setCacheUpdatedAt(new Date().toISOString());
    } catch { /* ignore */ }
  }

  async function runReconciliation() {
    if (!sheetUrl || selectedAccounts.length === 0) return;
    setReconLoading(true); setShowCachePrompt(false); setPendingResults(null);
    try {
      const res = await fetch("/api/reconcile", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: selectedAccounts, sheetUrl, worksheetName, urlColumn }) });
      const data = await res.json();
      if (res.ok) {
        setReconResults(data);
        if (!isOverride()) { await saveToCache(data); } else { setPendingResults(data); setShowCachePrompt(true); }
      }
    } catch { /* ignore */ }
    finally { setReconLoading(false); }
  }

  async function runSearch() {
    if (!searchDomain || searchAccounts.length === 0) return;
    setSearchLoading(true);
    try {
      const res = await fetch("/api/domain-search", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: searchDomain, accountIds: searchAccounts }) });
      const data = await res.json();
      if (res.ok) setSearchResults(Array.isArray(data) ? data : data?.results || []);
    } catch { /* ignore */ }
    finally { setSearchLoading(false); }
  }

  function toggleRowSelection(index) {
    setSelectedRows(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  }

  function toggleSelectAll(rows) {
    if (selectedRows.length === rows.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(rows.map((_, i) => i));
    }
  }

  async function pushToSheet() {
    const missing = reconResults?.missing || [];
    const selected = selectedRows.map(i => missing[i]).filter(Boolean);
    if (selected.length === 0) return;

    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch(`/api/domains/${id}/push-campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: selected }),
      });
      const data = await res.json();
      if (res.ok) {
        setPushResult({ success: true, count: data.rowsAppended });
      } else {
        setPushResult({ success: false, error: data.error });
      }
    } catch {
      setPushResult({ success: false, error: "Network error" });
    } finally {
      setPushing(false);
    }
  }

  if (authLoading || loading) {
    return <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div style={{ display: "flex", justifyContent: "center", padding: 64 }}><span className="spinner" /></div>
    </div>;
  }

  if (!domain || domain.error) {
    return <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <NavBar user={user} domains={domains} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--text-tertiary)" }}>Domain not found</p>
      </main>
    </div>;
  }

  const reconStats = reconResults?.stats || cachedData?.stats || {};

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <NavBar user={user} domains={domains} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
              {domain.domain_name}
            </h1>
            <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              {cacheUpdatedAt && `Reconciliation: ${timeAgo(cacheUpdatedAt)}`}
              {cacheUpdatedAt && statsUpdatedAt && " · "}
              {statsUpdatedAt && `Metrics: ${timeAgo(statsUpdatedAt)}`}
              {!cacheUpdatedAt && !statsUpdatedAt && "No data yet"}
            </p>
          </div>
          {isAdmin && (
            <a href={`/domains/${id}/settings`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </a>
          )}
        </div>

        {/* Metrics panel — handles its own date range + refresh */}
        <MetricsPanel stats={statsData} updatedAt={statsUpdatedAt} domainId={id} isAdmin={isAdmin} onRefresh={fetchAll} />

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border-primary)", paddingBottom: 8 }}>
          {["reconciliation", "search"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "6px 14px", fontSize: 13, border: "none", borderRadius: 6, cursor: "pointer",
              background: activeTab === tab ? "var(--bg-tertiary)" : "transparent",
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
              fontWeight: activeTab === tab ? 500 : 400,
            }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <button onClick={() => setActiveTab("reports")} style={{
            padding: "6px 14px", fontSize: 13, border: "none", borderRadius: 6, cursor: "pointer",
            background: activeTab === "reports" ? "var(--bg-tertiary)" : "transparent",
            color: activeTab === "reports" ? "var(--text-primary)" : "var(--text-tertiary)",
            fontWeight: activeTab === "reports" ? 500 : 400,
          }}>Reports</button>
        </div>

        {/* ==================== RECONCILIATION TAB ==================== */}
        {activeTab === "reconciliation" && (
          <div>
            {/* Recon stats — moved here from above */}
            {(reconStats.sheetUrls || reconStats.active || reconStats.missing || reconStats.extra) ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Sheet URLs", value: reconStats.sheetUrls, color: "var(--text-primary)" },
                  { label: "Active", value: reconStats.active, color: "var(--status-green)" },
                  { label: "Missing", value: reconStats.missing, color: "var(--status-red)" },
                  { label: "Extra", value: reconStats.extra, color: "var(--status-amber)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card" style={{ textAlign: "center", padding: "10px 8px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color, fontFamily: "'JetBrains Mono', monospace" }}>{value ?? "—"}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {isAdmin && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Sheet URL</label>
                    <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Worksheet</label>
                    <input value={worksheetName} onChange={e => setWorksheetName(e.target.value)} placeholder="Sheet1" style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>URL Column</label>
                    <input value={urlColumn} onChange={e => setUrlColumn(e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>Ad Accounts</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {accounts.map(acc => (
                      <label key={acc.id} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-primary)",
                        fontSize: 12, cursor: "pointer",
                        background: selectedAccounts.includes(acc.id) ? "var(--bg-tertiary)" : "transparent",
                        color: "var(--text-secondary)",
                      }}>
                        <input type="checkbox" checked={selectedAccounts.includes(acc.id)}
                          onChange={e => { if (e.target.checked) setSelectedAccounts([...selectedAccounts, acc.id]); else setSelectedAccounts(selectedAccounts.filter(i => i !== acc.id)); }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{acc.name || acc.id}</span>
                      </label>
                    ))}
                    {accounts.length === 0 && <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>No accounts loaded</p>}
                  </div>
                </div>

                {isOverride() && (
                  <p style={{ fontSize: 11, color: "var(--status-amber)", marginBottom: 12 }}>
                    ⚠ Settings differ from saved configuration — results won't auto-cache
                  </p>
                )}

                <button className="btn btn-primary" onClick={runReconciliation}
                  disabled={reconLoading || !sheetUrl || selectedAccounts.length === 0}>
                  {reconLoading ? <><span className="spinner" /> Running...</> : "Run Reconciliation"}
                </button>
              </div>
            )}

            {showCachePrompt && (
              <SaveCachePrompt
                onSave={async () => { if (pendingResults) await saveToCache(pendingResults); setShowCachePrompt(false); setPendingResults(null); }}
                onSkip={() => { setShowCachePrompt(false); setPendingResults(null); }}
              />
            )}

            {reconResults ? (
              <div className="fade-in">
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {["missing", "active", "extra"].map(tab => (
                    <button key={tab} onClick={() => setReconTab(tab)} style={{
                      padding: "5px 10px", fontSize: 12, border: "none", borderRadius: 6, cursor: "pointer",
                      background: reconTab === tab ? "var(--bg-tertiary)" : "transparent",
                      color: reconTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
                    }}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      <span style={{ marginLeft: 6, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                        color: tab === "missing" ? "var(--status-red)" : tab === "active" ? "var(--status-green)" : "var(--status-amber)",
                      }}>{(reconResults[tab] || []).length}</span>
                    </button>
                  ))}
                </div>
                {/* Action bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {reconTab === "missing" && reconResults?.missing?.length > 0 && (
                      <>
                        <button className="btn btn-secondary" onClick={() => downloadCSV(reconResults.missing, `${domain.domain_name}-missing.csv`)}
                          style={{ padding: "4px 10px", fontSize: 11 }}>
                          ↓ CSV
                        </button>
                        <button className="btn btn-primary" onClick={pushToSheet}
                          disabled={pushing || selectedRows.length === 0}
                          style={{ padding: "4px 10px", fontSize: 11 }}>
                          {pushing ? <><span className="spinner" style={{width:12,height:12}}/> Pushing...</> : `Push ${selectedRows.length} to Sheet`}
                        </button>
                      </>
                    )}
                    {reconTab === "active" && reconResults?.active?.length > 0 && (
                      <button className="btn btn-secondary" onClick={() => downloadCSV(reconResults.active, `${domain.domain_name}-active.csv`)}
                        style={{ padding: "4px 10px", fontSize: 11 }}>
                        ↓ CSV
                      </button>
                    )}
                    {reconTab === "extra" && reconResults?.extra?.length > 0 && (
                      <button className="btn btn-secondary" onClick={() => downloadCSV(reconResults.extra, `${domain.domain_name}-extra.csv`)}
                        style={{ padding: "4px 10px", fontSize: 11 }}>
                        ↓ CSV
                      </button>
                    )}
                  </div>
                  {pushResult && (
                    <span style={{ fontSize: 11, color: pushResult.success ? "var(--status-green)" : "var(--status-red)" }}>
                      {pushResult.success ? `✓ ${pushResult.count} rows pushed to sheet` : `✗ ${pushResult.error}`}
                    </span>
                  )}
                </div>
                <div className="card" style={{ maxHeight: 500, overflow: "auto" }}>
                  {reconTab === "missing" && renderMissingTable(reconResults.missing || [], selectedRows, toggleRowSelection, toggleSelectAll)}
                  {reconTab === "active" && renderCampaignTable(reconResults.active || [])}
                  {reconTab === "extra" && renderCampaignTable(reconResults.extra || [])}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 24px", border: "1px dashed var(--border-primary)", borderRadius: 12, color: "var(--text-tertiary)", fontSize: 13 }}>
                {isAdmin ? "Run Reconciliation to see results" : "No data yet"}
              </div>
            )}
          </div>
        )}

        {/* ==================== SEARCH TAB ==================== */}
        {activeTab === "search" && (
          <div>
            {isAdmin && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Domain</label>
                    <input value={searchDomain} onChange={e => setSearchDomain(e.target.value)} style={{ width: "100%", fontFamily: "'JetBrains Mono', monospace" }} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>Ad Accounts</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {accounts.map(acc => (
                      <label key={acc.id} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-primary)",
                        fontSize: 12, cursor: "pointer",
                        background: searchAccounts.includes(acc.id) ? "var(--bg-tertiary)" : "transparent",
                        color: "var(--text-secondary)",
                      }}>
                        <input type="checkbox" checked={searchAccounts.includes(acc.id)}
                          onChange={e => { if (e.target.checked) setSearchAccounts([...searchAccounts, acc.id]); else setSearchAccounts(searchAccounts.filter(i => i !== acc.id)); }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{acc.name || acc.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={runSearch} disabled={searchLoading || !searchDomain || searchAccounts.length === 0}>
                  {searchLoading ? <><span className="spinner" /> Searching...</> : "Search"}
                </button>
              </div>
            )}
            {searchResults && Array.isArray(searchResults) && searchResults.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <button className="btn btn-secondary" onClick={() => downloadCSV(searchResults, `${domain.domain_name}-search.csv`)}
                  style={{ padding: "4px 10px", fontSize: 11 }}>
                  ↓ CSV
                </button>
              </div>
            )}
            {searchResults && Array.isArray(searchResults) && searchResults.length > 0 && (
              <div className="card fade-in" style={{ maxHeight: 500, overflow: "auto" }}>{renderCampaignTable(searchResults)}</div>
            )}
            {searchResults && Array.isArray(searchResults) && searchResults.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 24px", border: "1px dashed var(--border-primary)", borderRadius: 12, color: "var(--text-tertiary)", fontSize: 13 }}>No campaigns found</div>
            )}
            {!searchResults && (
              <div style={{ textAlign: "center", padding: "48px 24px", border: "1px dashed var(--border-primary)", borderRadius: 12, color: "var(--text-tertiary)", fontSize: 13 }}>
                {isAdmin ? "Search to find campaigns for this domain" : "No search results yet"}
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <ReportsTab domainId={id} isAdmin={isAdmin} />
        )}
      </main>
    </div>
  );
}

function renderTable(rows) {
  if (!rows || rows.length === 0) return <p style={{ color: "var(--text-tertiary)", fontSize: 12, padding: 16 }}>No rows</p>;
  const keys = Object.keys(rows[0]);
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <thead><tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
        {keys.map(k => <th key={k} style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>{k}</th>)}
      </tr></thead>
      <tbody>{rows.map((row, i) => (
        <tr key={i} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
          {keys.map(k => <td key={k} style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{row[k]}</td>)}
        </tr>
      ))}</tbody>
    </table>
  );
}

function renderMissingTable(rows, selectedRows, toggleRow, toggleAll) {
  if (!rows || rows.length === 0) return <p style={{ color: "var(--text-tertiary)", fontSize: 12, padding: 16 }}>No rows</p>;
  const keys = Object.keys(rows[0]);
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <th style={{ padding: "8px 12px", width: 40 }}>
            <input type="checkbox" checked={selectedRows.length === rows.length && rows.length > 0}
              onChange={() => toggleAll(rows)} />
          </th>
          {keys.map(k => (
            <th key={k} style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>{k}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{
            borderBottom: "1px solid var(--border-secondary)",
            background: selectedRows.includes(i) ? "var(--bg-hover)" : "transparent",
          }}>
            <td style={{ padding: "8px 12px" }}>
              <input type="checkbox" checked={selectedRows.includes(i)} onChange={() => toggleRow(i)} />
            </td>
            {keys.map(k => (
              <td key={k} style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{row[k]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderCampaignTable(rows) {
  if (!rows || rows.length === 0) return <p style={{ color: "var(--text-tertiary)", fontSize: 12, padding: 16 }}>No rows</p>;
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <thead><tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Campaign</th>
        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Ad Group</th>
        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Keywords</th>
        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Final URL</th>
      </tr></thead>
      <tbody>{rows.map((row, i) => (
        <tr key={i} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
          <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.campaignName}</td>
          <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.adGroupName}</td>
          <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontSize: 11 }}>{row.keywords}</td>
          <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{row.finalUrl}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
