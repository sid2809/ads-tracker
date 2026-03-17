"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";
import { downloadCSV } from "@/lib/csv-download";


export default function ReconciliationPage() {
  const { user, loading: authLoading } = useAuth();
  const [domains, setDomains] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [worksheetName, setWorksheetName] = useState("");
  const [urlColumn, setUrlColumn] = useState("Final_URL");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("missing");

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(data => setAccounts(Array.isArray(data?.accounts) ? data.accounts : Array.isArray(data) ? data : [])).catch(() => setAccounts([]));
    fetch("/api/domains").then((r) => r.json()).then(data => setDomains(Array.isArray(data) ? data : [])).catch(() => setDomains([]));
  }, []);

  async function runReconciliation() {
    if (!sheetUrl || selectedAccounts.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: selectedAccounts,
          sheetUrl,
          worksheetName,
          urlColumn,
        }),
      });
      const data = await res.json();
      if (res.ok) setResults(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) return null;
  if (user?.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <NavBar user={user} domains={domains} />
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--text-tertiary)" }}>Admin access required</p>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <NavBar user={user} domains={domains} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 500, marginBottom: 24 }}>
          Reconciliation
        </h1>

        {/* Config */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Sheet URL</label>
              <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Worksheet</label>
              <input value={worksheetName} onChange={(e) => setWorksheetName(e.target.value)} placeholder="Sheet1" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>URL Column</label>
              <input value={urlColumn} onChange={(e) => setUrlColumn(e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>

          {/* Account selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>Ad Accounts</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {accounts.map((acc) => (
                <label key={acc.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--border-primary)",
                  fontSize: 12, cursor: "pointer",
                  background: selectedAccounts.includes(acc.id) ? "var(--bg-tertiary)" : "transparent",
                  color: "var(--text-secondary)",
                }}>
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(acc.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedAccounts([...selectedAccounts, acc.id]);
                      else setSelectedAccounts(selectedAccounts.filter((id) => id !== acc.id));
                    }}
                  />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{acc.name || acc.id}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={runReconciliation}
            disabled={loading || !sheetUrl || selectedAccounts.length === 0}
          >
            {loading ? <><span className="spinner" /> Running...</> : "Run Reconciliation"}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="fade-in">
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Sheet URLs</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{results.stats?.sheetUrls ?? 0}</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Active</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "var(--status-green)", fontFamily: "'JetBrains Mono', monospace" }}>{results.stats?.active ?? 0}</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Missing</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "var(--status-red)", fontFamily: "'JetBrains Mono', monospace" }}>{results.stats?.missing ?? 0}</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Extra</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "var(--status-amber)", fontFamily: "'JetBrains Mono', monospace" }}>{results.stats?.extra ?? 0}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border-primary)", paddingBottom: 8 }}>
              {["missing", "active", "extra"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 12px", fontSize: 13, border: "none", borderRadius: 6, cursor: "pointer",
                    background: activeTab === tab ? "var(--bg-tertiary)" : "transparent",
                    color: activeTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span style={{
                    marginLeft: 6, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                    color: tab === "missing" ? "var(--status-red)" : tab === "active" ? "var(--status-green)" : "var(--status-amber)",
                  }}>
                    {results[tab]?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {results && (
              <div style={{ marginBottom: 8 }}>
                <button className="btn btn-secondary" onClick={() => downloadCSV(results[activeTab] || [], `standalone-${activeTab}.csv`)}
                  style={{ padding: "4px 10px", fontSize: 11 }}>
                  ↓ Download {activeTab} CSV
                </button>
              </div>
            )}

            {/* Tab content */}
            <div className="card" style={{ maxHeight: 500, overflow: "auto" }}>
              {activeTab === "missing" && (
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      {results.missing?.[0] && Object.keys(results.missing[0]).map((key) => (
                        <th key={key} style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.missing?.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === "active" && (
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Campaign</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Ad Group</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Keywords</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Final URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.active?.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.campaignName}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.adGroupName}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontSize: 11 }}>{row.keywords}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{row.finalUrl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === "extra" && (
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Campaign</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Ad Group</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Keywords</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Final URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.extra?.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.campaignName}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.adGroupName}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontSize: 11 }}>{row.keywords}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{row.finalUrl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
