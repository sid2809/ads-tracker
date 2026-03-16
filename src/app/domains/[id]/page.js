"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";

export default function DomainHubPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [domain, setDomain] = useState(null);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/domains/${id}`).then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
    ])
      .then(([d, all]) => {
        setDomain(d);
        setDomains(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <span className="spinner" />
        </div>
      </div>
    );
  }

  if (!domain || domain.error) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <NavBar user={user} domains={domains} />
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--text-tertiary)" }}>Domain not found</p>
        </main>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <NavBar user={user} domains={domains} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{
              color: "var(--text-primary)", fontSize: 20, fontWeight: 500,
              fontFamily: "'JetBrains Mono', monospace", marginBottom: 4,
            }}>
              {domain.domain_name}
            </h1>
            <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              Domain hub — reconciliation & search tabs coming in Phase 2
            </p>
          </div>

          {isAdmin && (
            <a
              href={`/domains/${id}/settings`}
              className="btn btn-secondary"
              style={{ textDecoration: "none" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </a>
          )}
        </div>

        {/* Placeholder stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {["Sheet URLs", "Active", "Missing", "Extra"].map((label) => (
            <div key={label} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono', monospace" }}>—</div>
            </div>
          ))}
        </div>

        {/* Phase 2 placeholder */}
        <div style={{
          textAlign: "center",
          padding: "64px 24px",
          border: "1px dashed var(--border-primary)",
          borderRadius: 12,
          color: "var(--text-tertiary)",
          fontSize: 13,
        }}>
          <p style={{ marginBottom: 8 }}>Reconciliation & Search tabs will be wired in Phase 2</p>
          <p style={{ fontSize: 12 }}>Configure this domain's accounts and source sheet in Settings first.</p>
        </div>
      </main>
    </div>
  );
}
