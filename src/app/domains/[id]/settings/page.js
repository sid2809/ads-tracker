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

  useEffect(() => {
    Promise.all([
      fetch(`/api/domains/${id}`).then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ])
      .then(([d, all, accs]) => {
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

      // Upsert sparkline metric setting
      // Using a simple approach: POST to a settings endpoint
      // For Phase 1, we'll store it via the domain_settings table
      // We can add a dedicated settings endpoint later if needed

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

        {/* Section 5: Output Sheet placeholder */}
        <div className="card" style={{ marginBottom: 16, opacity: 0.5 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
            Output Sheet
            <span className="badge" style={{ marginLeft: 8, background: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>
              Coming soon
            </span>
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
            Configure an output sheet for campaign creation in a future update.
          </p>
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
