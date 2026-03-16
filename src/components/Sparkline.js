"use client";

const METRIC_COLORS = {
  clicks: "var(--sparkline-clicks)",
  impressions: "var(--sparkline-impressions)",
  ctr: "var(--sparkline-ctr)",
  cpc: "var(--sparkline-cpc)",
  cost: "var(--sparkline-cost)",
};

export default function Sparkline({ data = [], metric = "clicks", width = 200, height = 40 }) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height}>
        <line
          x1="0" y1={height / 2} x2={width} y2={height / 2}
          stroke="var(--border-primary)" strokeWidth="1" strokeDasharray="4 4"
        />
      </svg>
    );
  }

  const color = METRIC_COLORS[metric] || METRIC_COLORS.clicks;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableH = height - padding * 2;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padding + usableH - ((val - min) / range) * usableH;
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#fill-${metric})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
