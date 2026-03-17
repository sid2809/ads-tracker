"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Sparkline from "./Sparkline";

function timeAgo(dateStr) {
  if (!dateStr) return "No data";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const METRIC_LABELS = {
  clicks: "Clicks",
  impressions: "Impr",
  ctr: "CTR",
  cpc: "CPC",
  cost: "Cost",
};

export default function DomainCard({ domain, stats, updatedAt, isAdmin, onRefresh }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const metric = stats?.sparkline?.metric || "clicks";

  async function handleRefresh(e) {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await fetch(`/api/domains/${domain.id}/stats`, { method: "POST" });
      if (onRefresh) onRefresh();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      className="card fade-in"
      onClick={() => router.push(`/domains/${domain.id}`)}
      style={{
        cursor: "pointer",
        transition: "border-color 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--text-tertiary)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h3 style={{
            color: "var(--text-primary)",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 2,
          }}>
            {domain.domain_name}
          </h3>
          <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
            {timeAgo(updatedAt)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="badge" style={{
            background: "var(--bg-tertiary)",
            color: "var(--text-tertiary)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {METRIC_LABELS[metric] || "Clicks"}
          </span>

          {isAdmin && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                background: "none",
                border: "none",
                cursor: refreshing ? "default" : "pointer",
                color: "var(--text-tertiary)",
                padding: 2,
                display: "flex",
                opacity: refreshing ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
              title="Refresh stats"
            >
              {refreshing ? (
                <span className="spinner" style={{ width: 14, height: 14 }} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ marginBottom: 12 }}>
        <Sparkline
          data={stats?.sparkline?.data || []}
          metric={metric}
          width={248}
          height={40}
        />
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
        <span>
          <span style={{ color: "var(--status-green)", fontWeight: 500 }}>
            {stats?.active ?? "—"}
          </span>{" "}
          <span style={{ color: "var(--text-tertiary)" }}>active</span>
        </span>
        <span>
          <span style={{ color: "var(--status-red)", fontWeight: 500 }}>
            {stats?.missing ?? "—"}
          </span>{" "}
          <span style={{ color: "var(--text-tertiary)" }}>missing</span>
        </span>
        <span>
          <span style={{ color: "var(--status-amber)", fontWeight: 500 }}>
            {stats?.extra ?? "—"}
          </span>{" "}
          <span style={{ color: "var(--text-tertiary)" }}>extra</span>
        </span>
      </div>
    </div>
  );
}
