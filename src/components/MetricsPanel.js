"use client";
import { useState } from "react";
import Sparkline from "./Sparkline";

function formatNum(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMoney(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(2)}`;
}

function formatPct(n) {
  if (n == null || isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function getRangeLabel(dateRange) {
  if (!dateRange) return "";
  if (dateRange.days === 7) return "Last 7 days";
  if (dateRange.days === 14) return "Last 14 days";
  if (dateRange.days === 30) return "Last 30 days";
  if (dateRange.startDate && dateRange.endDate) {
    return `${dateRange.startDate} → ${dateRange.endDate}`;
  }
  return `Last ${dateRange.days} days`;
}

const METRICS = [
  { key: "clicks", label: "Clicks", color: "var(--sparkline-clicks)", format: formatNum, totalKey: "clicks" },
  { key: "impressions", label: "Impressions", color: "var(--sparkline-impressions)", format: formatNum, totalKey: "impressions" },
  { key: "ctr", label: "Avg CTR", color: "var(--sparkline-ctr)", format: formatPct, totalKey: "avgCtr" },
  { key: "cpc", label: "Avg CPC", color: "var(--sparkline-cpc)", format: formatMoney, totalKey: "avgCpc" },
  { key: "cost", label: "Total Cost", color: "var(--sparkline-cost)", format: formatMoney, totalKey: "cost" },
];

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

export default function MetricsPanel({ stats, updatedAt, domainId, isAdmin, onRefresh }) {
  const [selectedMetric, setSelectedMetric] = useState("clicks");
  const [activeDays, setActiveDays] = useState(stats?.dateRange?.days || 30);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const totals = stats?.totals;
  const allSparklines = stats?.allSparklines;
  const dateRange = stats?.dateRange;

  const activeMetricDef = METRICS.find((m) => m.key === selectedMetric) || METRICS[0];

  async function refreshWithDays(days, forceRefresh = false) {
    setActiveDays(days);
    setShowCustom(false);

    if (!forceRefresh) {
      // Just switch the active range — no API call
      // Data will show from server cache if it matches, otherwise show "no data"
      return;
    }

    // Only reaches here when refresh button is clicked
    setRefreshing(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (res.ok && onRefresh) onRefresh();
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  }

  async function refreshWithCustomRange() {
    if (!customStart || !customEnd) return;
    setShowCustom(false);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: customStart, endDate: customEnd }),
      });
      if (res.ok && onRefresh) onRefresh();
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Date range bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {dateRange ? getRangeLabel(dateRange) : "No metrics data"}
          </span>
          {updatedAt && (
            <span style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4,
              background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)",
              color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono', monospace",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              Cached · {timeAgo(updatedAt)}
            </span>
          )}
          {refreshing && <span className="spinner" style={{ width: 12, height: 12 }} />}
        </div>

        {isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => refreshWithDays(p.days)}
                disabled={refreshing}
                style={{
                  padding: "4px 10px", fontSize: 11, border: "1px solid var(--border-primary)",
                  borderRadius: 4, cursor: refreshing ? "default" : "pointer",
                  background: activeDays === p.days && !showCustom ? "var(--bg-tertiary)" : "transparent",
                  color: activeDays === p.days && !showCustom ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(!showCustom)}
              disabled={refreshing}
              style={{
                padding: "4px 10px", fontSize: 11, border: "1px solid var(--border-primary)",
                borderRadius: 4, cursor: refreshing ? "default" : "pointer",
                background: showCustom ? "var(--bg-tertiary)" : "transparent",
                color: showCustom ? "var(--text-primary)" : "var(--text-tertiary)",
                transition: "all 0.15s",
              }}
            >
              Custom
            </button>
            <button
              onClick={() => refreshWithDays(activeDays, true)}
              disabled={refreshing}
              title="Force refresh from Google Ads"
              style={{
                padding: "4px 6px", fontSize: 11, border: "1px solid var(--border-primary)",
                borderRadius: 4, cursor: refreshing ? "default" : "pointer",
                background: "transparent", color: "var(--text-tertiary)",
                display: "inline-flex", alignItems: "center",
                transition: "all 0.15s",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Custom date range picker */}
      {showCustom && isAdmin && (
        <div className="card fade-in" style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px", marginBottom: 12,
        }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Start</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", fontFamily: "'JetBrains Mono', monospace" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>End</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", fontFamily: "'JetBrains Mono', monospace" }} />
          </div>
          <button
            className="btn btn-primary"
            onClick={refreshWithCustomRange}
            disabled={!customStart || !customEnd || refreshing}
            style={{ padding: "5px 12px", fontSize: 12, marginTop: 16 }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Metric summary cards */}
      {(totals || allSparklines) && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
            {METRICS.map((m) => {
              const isActive = selectedMetric === m.key;
              return (
                <div
                  key={m.key}
                  onClick={() => setSelectedMetric(m.key)}
                  className="card"
                  style={{
                    textAlign: "center", cursor: "pointer",
                    borderColor: isActive ? m.color : "var(--border-primary)",
                    transition: "border-color 0.15s", padding: "12px 8px",
                  }}
                >
                  <div style={{ fontSize: 11, color: isActive ? m.color : "var(--text-tertiary)", marginBottom: 4, fontWeight: 500 }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontSize: 18, fontWeight: 500,
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {totals ? m.format(totals[m.totalKey]) : "—"}
                  </div>
                  {allSparklines?.[m.key]?.length > 1 && (
                    <div style={{ marginTop: 8, opacity: isActive ? 1 : 0.4, transition: "opacity 0.15s" }}>
                      <Sparkline data={allSparklines[m.key]} metric={m.key} width={120} height={24} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Large sparkline chart */}
          {allSparklines?.[selectedMetric]?.length > 1 && (
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: activeMetricDef.color, fontWeight: 500 }}>
                  {activeMetricDef.label} — {dateRange ? getRangeLabel(dateRange) : "30 days"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {allSparklines[selectedMetric].length} days
                </span>
              </div>
              <Sparkline data={allSparklines[selectedMetric]} metric={selectedMetric} width={1100} height={80} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
