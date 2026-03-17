"use client";
import { useState } from "react";

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

function formatMetricVal(metric, val) {
  if (metric === "cost" || metric === "cpc") return formatMoney(val);
  if (metric === "ctr") return formatPct(val);
  return formatNum(val);
}

function getDefaultDates(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

const METRICS = [
  { key: "clicks", label: "Clicks" },
  { key: "impressions", label: "Impressions" },
  { key: "cost", label: "Cost" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
];

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

export default function ReportsTab({ domainId, isAdmin }) {
  const defaults = getDefaultDates(7);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [metric, setMetric] = useState("clicks");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  function applyPreset(days) {
    const d = getDefaultDates(days);
    setStartDate(d.startDate);
    setEndDate(d.endDate);
  }

  async function runReport() {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${domainId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, metric, limit: 15 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to run report");
        return;
      }
      setReport(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Controls */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          {/* Presets + date pickers */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => applyPreset(p.days)}
                  style={{
                    padding: "4px 10px", fontSize: 11, border: "1px solid var(--border-primary)",
                    borderRadius: 4, cursor: "pointer",
                    background: "transparent", color: "var(--text-tertiary)",
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Start</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px", fontFamily: "'JetBrains Mono', monospace" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>End</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px", fontFamily: "'JetBrains Mono', monospace" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Metric</label>
              <select value={metric} onChange={(e) => setMetric(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px" }}>
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={runReport}
              disabled={loading || !startDate || !endDate}
              style={{ padding: "5px 14px", fontSize: 12 }}>
              {loading ? <><span className="spinner" /> Running...</> : "Run Report"}
            </button>
          </div>

          {error && <p style={{ color: "var(--status-red)", fontSize: 12 }}>{error}</p>}
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="fade-in">
          {/* Summary */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 16, padding: "8px 0",
          }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              Comparing <span style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
                {report.period.startDate}</span> → <span style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
                {report.period.endDate}</span>
              {" "}vs previous {report.period.days} days
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono', monospace" }}>
              {report.totalCampaigns} campaigns · by {report.metric}
            </span>
          </div>

          {/* Two column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Gainers */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--status-green)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                Top Gainers
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400 }}>({report.gainers.length})</span>
              </h3>

              {report.gainers.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 24, color: "var(--text-tertiary)", fontSize: 12 }}>
                  No gainers in this period
                </div>
              ) : (
                <div className="card" style={{ maxHeight: 500, overflow: "auto", padding: 0 }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Campaign</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Current</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Previous</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.gainers.map((c, i) => (
                        <tr key={c.id} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                          <td style={{ padding: "8px 12px", color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.name}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--text-primary)" }}>
                            {formatMetricVal(report.metric, c.current)}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--text-tertiary)" }}>
                            {formatMetricVal(report.metric, c.previous)}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: "var(--status-green)" }}>+{c.pctChange}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Losers */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--status-red)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Top Losers
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400 }}>({report.losers.length})</span>
              </h3>

              {report.losers.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 24, color: "var(--text-tertiary)", fontSize: 12 }}>
                  No losers in this period
                </div>
              ) : (
                <div className="card" style={{ maxHeight: 500, overflow: "auto", padding: 0 }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Campaign</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Current</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Previous</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.losers.map((c, i) => (
                        <tr key={c.id} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                          <td style={{ padding: "8px 12px", color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.name}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--text-primary)" }}>
                            {formatMetricVal(report.metric, c.current)}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--text-tertiary)" }}>
                            {formatMetricVal(report.metric, c.previous)}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: "var(--status-red)" }}>{c.pctChange}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!report && !loading && (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          border: "1px dashed var(--border-primary)", borderRadius: 12,
          color: "var(--text-tertiary)", fontSize: 13,
        }}>
          {isAdmin ? "Select a date range and run a report to see top gainers and losers" : "No report data yet"}
        </div>
      )}
    </div>
  );
}
