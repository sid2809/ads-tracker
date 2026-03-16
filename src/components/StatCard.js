"use client";

const COLOR_MAP = {
  blue: "border-l-blue-500 bg-blue-50/50 text-blue-700",
  green: "border-l-emerald-500 bg-emerald-50/50 text-emerald-700",
  red: "border-l-red-500 bg-red-50/50 text-red-700",
  amber: "border-l-amber-500 bg-amber-50/50 text-amber-700",
};

export default function StatCard({ label, value, color }) {
  return (
    <div className={`border-l-4 rounded-lg p-5 ${COLOR_MAP[color] || ""}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-70 font-medium">{label}</div>
    </div>
  );
}
