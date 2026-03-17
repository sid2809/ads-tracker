"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";
import DeleteDomainModal from "@/components/DeleteDomainModal";

export default function DomainSettingsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [domain, setDomain] = useState(null);
  const [domains, setDomains] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState("");

  // Form state
  const [domainName, setDomainName] = useState("");
  const [pinned, setPinned] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [worksheetName, setWorksheetName] = useState("");
  const [urlColumn, setUrlColumn] = useState("Final_URL");
  const [sparklineMetric, setSparklineMetric] = useState("clicks");
  const [outputSheetUrl, setOutputSheetUrl] = useState("");
  const [outputWorksheetName, setOutputWorksheetName] = useState("");
  const [columnMappings, setColumnMappings] = useState([]);
  const [sourceColumns, setSourceColumns] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/domains/${id}`).then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
      fetch(`/api/domains/${id}/cache`).then(r => r.json()),
    ])
      .then(([d, all, accs, cache]) => {
        setDomain(d);
        setDomains(Array.isArray(all) ? all : []);
        setAccounts(Array.isArray(accs?.accounts) ? accs.accounts : Array.isArray(accs) ? accs : []);

        // Populate form
        setDomainName(d.domain_name || "");
        setPinned(d.pinned || false);
        setSelectedAccounts(d.account_ids || []);

        const sourceSheet = d.sheets?.find((s) => s.sheet_type === "source");
        if (sourceSheet) {
          setSheetUrl(sourceSheet.sheet_url || "");
          setWorksheetName(sourceSheet.worksheet_name || "");
          setUrlColumn(sourceSheet.url_column || "Final_URL");
        }

        setSparklineMetric(d.settings?.dashboard_sparkline_metric || "clicks");

        const outputSheet = d.sheets?.find((s) => s.sheet_type === "output");
        if (outputSheet) {
          setOutputSheetUrl(outputSheet.sheet_url || "");
          setOutputWorksheetName(outputSheet.worksheet_name || "");
        }

        // Load column mapping
        const savedMapping = d.settings?.output_column_map;
        if (savedMapping) {
          try {
            const parsed = typeof savedMapping === "string" ? JSON.parse(savedMapping) : savedMapping;
            setColumnMappings(Object.entries(parsed).map(([source, target]) => ({ source, target })));
          } catch { /* ignore */ }
        }

        // Extract source columns from cached reconciliation data
        const cacheData = cache?.data;
        if (cacheData?.missing?.[0]) {
          setSourceColumns(Object.keys(cacheData.missing[0]));
        } else if (cacheData?.active?.[0]) {
          setSourceColumns(Object.keys(cacheData.active[0]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      // Update domain
      await fetch(`/api/domains/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_name: domainName,
          pinned,
          account_ids: selectedAccounts,
        }),
      });

      // Upsert source sheet
      if (sheetUrl) {
        await fetch(`/api/domains/${id}/sheets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheet_type: "source",
            sheet_url: sheetUrl,
            worksheet_name: worksheetName,
            url_column: urlColumn,
          }),
        });
      }

      // Upsert output sheet
      if (outputSheetUrl) {
        await fetch(`/api/domains/${id}/sheets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheet_type: "output",
            sheet_url: outputSheetUrl,
            worksheet_name: outputWorksheetName,
          }),
        });
      }

      // Save column mapping
      if (columnMappings.length > 0) {
        const mapObj = {};
        for (const m of columnMappings) {
          if (m.source && m.target) mapObj[m.source] = m.target;
        }
        await fetch(`/api/domains/${id}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ output_column_map: JSON.stringify(mapObj) }),
        });
      }

      // Save sparkline metric setting
      await fetch(`/api/domains/${id}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_sparkline_metric: sparklineMetric }),
      });

      setToast("Settings saved");
      setTimeout(() => setToast(""), 3000);
    } catch {
      setToast("Error saving");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <span className="spinner" />
        </div>
      </div>
    );
  }

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

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button
            onClick={() => router.push(`/domains/${id}`)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 500 }}>
            Settings
          </h1>
        </div>

        {/* Section 1: General */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16 }}>General</h2>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Domain name</label>
            <input
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              style={{ width: "100%", fontFamily: "'JetBrains Mono', monospace" }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pinned to dashboard
          </label>
        </div>

        {/* Section 2: Ad Accounts */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16 }}>Ad Accounts</h2>
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
                    else setSelectedAccounts(selectedAccounts.filter((i) => i !== acc.id));
                  }}
                />
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{acc.name || acc.id}</span>
              </label>
            ))}
            {accounts.length === 0 && (
              <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Loading accounts...</p>
            )}
          </div>
        </div>

        {/* Section 3: Source Sheet */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16 }}>Source Sheet</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Sheet URL</label>
              <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." style={{ width: "100%" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Worksheet</label>
                <input value={worksheetName} onChange={(e) => setWorksheetName(e.target.value)} placeholder="Sheet1" style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>URL Column</label>
                <input value={urlColumn} onChange={(e) => setUrlColumn(e.target.value)} style={{ width: "100%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Dashboard Sparkline */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16 }}>Dashboard Sparkline</h2>
          <select
            value={sparklineMetric}
            onChange={(e) => setSparklineMetric(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="clicks">Clicks</option>
            <option value="impressions">Impressions</option>
            <option value="ctr">CTR</option>
            <option value="cpc">CPC</option>
            <option value="cost">Cost</option>
          </select>
        </div>

        {/* Section 5: Output Sheet */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16 }}>Output Sheet</h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 12 }}>
            Missing URLs will be pushed to this sheet. Map source columns to output columns below.
          </p>
          <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Sheet URL</label>
              <input value={outputSheetUrl} onChange={(e) => setOutputSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..." style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Worksheet</label>
              <input value={outputWorksheetName} onChange={(e) => setOutputWorksheetName(e.target.value)}
                placeholder="Sheet1" style={{ width: "100%" }} />
            </div>
          </div>

          {/* Column Mapping */}
          <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Column Mapping</h3>
              <button className="btn btn-secondary" onClick={() => setColumnMappings([...columnMappings, { source: "", target: "" }])}
                style={{ padding: "3px 8px", fontSize: 11 }}>
                + Add Mapping
              </button>
            </div>

            {sourceColumns.length > 0 && columnMappings.length === 0 && (
              <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 12 }}>
                Source columns available: {sourceColumns.map(c => (
                  <span key={c} style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-secondary)", marginRight: 8 }}>{c}</span>
                ))}
              </p>
            )}

            {columnMappings.length === 0 && (
              <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                No mappings configured — all source columns will be pushed as-is.
              </p>
            )}

            {columnMappings.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {sourceColumns.length > 0 ? (
                  <select
                    value={m.source}
                    onChange={(e) => {
                      const updated = [...columnMappings];
                      updated[i] = { ...updated[i], source: e.target.value };
                      setColumnMappings(updated);
                    }}
                    style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
                  >
                    <option value="">Select source column</option>
                    {sourceColumns.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={m.source}
                    onChange={(e) => {
                      const updated = [...columnMappings];
                      updated[i] = { ...updated[i], source: e.target.value };
                      setColumnMappings(updated);
                    }}
                    placeholder="Source column name"
                    style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                )}

                <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>→</span>

                <input
                  value={m.target}
                  onChange={(e) => {
                    const updated = [...columnMappings];
                    updated[i] = { ...updated[i], target: e.target.value };
                    setColumnMappings(updated);
                  }}
                  placeholder="Output column name"
                  style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                />

                <button onClick={() => setColumnMappings(columnMappings.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4, display: "flex" }}
                  title="Remove mapping">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete Domain
          </button>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><span className="spinner" /> Saving...</> : "Save"}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fade-in" style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13,
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-md)",
          }}>
            {toast}
          </div>
        )}
      </main>

      {showDeleteModal && domain && (
        <DeleteDomainModal
          domain={domain}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
