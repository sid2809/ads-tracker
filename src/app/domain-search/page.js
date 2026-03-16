"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";

export default function DomainSearchPage() {
  const { user, loading: authLoading } = useAuth();
  const [domains, setDomains] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [searchDomain, setSearchDomain] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(data => setAccounts(Array.isArray(data) ? data : [])).catch(() => setAccounts([]));
    fetch("/api/domains").then((r) => r.json()).then(data => setDomains(Array.isArray(data) ? data : [])).catch(() => setDomains([]));
  }, []);

  async function runSearch() {
    if (!searchDomain || selectedAccounts.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/domain-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: searchDomain, accountIds: selectedAccounts }),
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
          Domain Search
        </h1>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Domain</label>
              <input
                value={searchDomain}
                onChange={(e) => setSearchDomain(e.target.value)}
                placeholder="example.com"
                style={{ width: "100%", fontFamily: "'JetBrains Mono', monospace" }}
              />
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
            onClick={runSearch}
            disabled={loading || !searchDomain || selectedAccounts.length === 0}
          >
            {loading ? <><span className="spinner" /> Searching...</> : "Search"}
          </button>
        </div>

        {/* Results */}
        {results && Array.isArray(results) && results.length > 0 && (
          <div className="card fade-in" style={{ maxHeight: 600, overflow: "auto" }}>
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
                {results.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.campaignName}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.adGroupName}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontSize: 11 }}>{row.keywords}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{row.finalUrl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results && Array.isArray(results) && results.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)" }}>
            No campaigns found for this domain
          </div>
        )}
      </main>
    </div>
  );
}
