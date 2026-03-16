"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";
import DomainCard from "@/components/DomainCard";
import AddDomainModal from "@/components/AddDomainModal";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [domains, setDomains] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data);
        // Fetch cached stats for pinned domains
        const pinned = data.filter((d) => d.pinned);
        const statResults = await Promise.all(
          pinned.map(async (d) => {
            try {
              const r = await fetch(`/api/domains/${d.id}/stats`);
              const s = await r.json();
              return [d.id, s];
            } catch {
              return [d.id, { data: null }];
            }
          })
        );
        const map = {};
        for (const [id, s] of statResults) {
          map[id] = s;
        }
        setStatsMap(map);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) fetchDomains();
  }, [authLoading, user, fetchDomains]);

  if (authLoading) return null;

  const isAdmin = user?.role === "admin";
  const pinnedDomains = domains.filter((d) => d.pinned);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <NavBar user={user} domains={domains} onDomainsChange={fetchDomains} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 500, marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            {pinnedDomains.length > 0
              ? `${pinnedDomains.length} pinned domain${pinnedDomains.length !== 1 ? "s" : ""}`
              : "Pin a domain to see it here"}
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
            <span className="spinner" />
          </div>
        ) : pinnedDomains.length === 0 ? (
          /* Empty state */
          <div style={{
            textAlign: "center",
            padding: "80px 24px",
            border: "1px dashed var(--border-primary)",
            borderRadius: 12,
          }}>
            <p style={{ color: "var(--text-tertiary)", fontSize: 14, marginBottom: 16 }}>
              No pinned domains yet
            </p>
            <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 24, maxWidth: 340, margin: "0 auto 24px" }}>
              Add a domain and pin it to your dashboard to see stats at a glance.
            </p>
            {isAdmin && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAddModal(true)}
              >
                + Add Domain
              </button>
            )}
          </div>
        ) : (
          /* Domain card grid */
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {pinnedDomains.map((d) => (
              <DomainCard
                key={d.id}
                domain={d}
                stats={statsMap[d.id]?.data}
                updatedAt={statsMap[d.id]?.updated_at}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddDomainModal
          onClose={() => {
            setShowAddModal(false);
            fetchDomains();
          }}
        />
      )}
    </div>
  );
}
