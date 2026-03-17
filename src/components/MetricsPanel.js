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
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPct(n) {
  if (n == null || isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

const METRICS = [
  { key: "clicks", label: "Clicks", color: "var(--sparkline-clicks)", format: formatNum, totalKey: "clicks" },
  { key: "impressions", label: "Impressions", color: "var(--sparkline-impressions)", format: formatNum, totalKey: "impressions" },
  { key: "ctr", label: "Avg CTR", color: "var(--sparkline-ctr)", format: formatPct, totalKey: "avgCtr" },
  { key: "cpc", label: "Avg CPC", color: "var(--sparkline-cpc)", format: formatMoney, totalKey: "avgCpc" },
  { key: "cost", label: "Total Cost", color: "var(--sparkline-cost)", format: formatMoney, totalKey: "cost" },
];

export default function MetricsPanel({ stats }) {
  const [selectedMetric, setSelectedMetric] = useState("clicks");
  const totals = stats?.totals;
  const allSparklines = stats?.allSparklines;

  if (!totals && !allSparklines) return null;

  const activeMetricDef = METRICS.find((m) => m.key === selectedMetric) || METRICS[0];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Metric summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        {METRICS.map((m) => {
          const isActive = selectedMetric === m.key;
          return (
            <div
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className="card"
              style={{
                textAlign: "center",
                cursor: "pointer",
                borderColor: isActive ? m.color : "var(--border-primary)",
                transition: "border-color 0.15s",
                padding: "12px 8px",
              }}
            >
              <div style={{ fontSize: 11, color: isActive ? m.color : "var(--text-tertiary)", marginBottom: 4, fontWeight: 500 }}>
                {m.label}
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 500,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {totals ? m.format(totals[m.totalKey]) : "—"}
              </div>
              {/* Mini sparkline under each card */}
              {allSparklines?.[m.key]?.length > 1 && (
                <div style={{ marginTop: 8, opacity: isActive ? 1 : 0.4, transition: "opacity 0.15s" }}>
                  <Sparkline
                    data={allSparklines[m.key]}
                    metric={m.key}
                    width={120}
                    height={24}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Large sparkline chart for selected metric */}
      {allSparklines?.[selectedMetric]?.length > 1 && (
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: activeMetricDef.color, fontWeight: 500 }}>
              {activeMetricDef.label} — Last 30 Days
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono', monospace" }}>
              {allSparklines[selectedMetric].length} days
            </span>
          </div>
          <Sparkline
            data={allSparklines[selectedMetric]}
            metric={selectedMetric}
            width={1100}
            height={80}
          />
        </div>
      )}
    </div>
  );
}
