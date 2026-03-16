"use client";

const DOT_COLORS = {
  red: "bg-red-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
};

export default function TabButton({ active, label, count, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
        active
          ? "border-blue-600 text-blue-700 bg-white"
          : "border-transparent text-surface-700 hover:text-surface-900 hover:bg-surface-100"
      }`}
    >
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${DOT_COLORS[color] || ""}`} />
      {label} ({count})
    </button>
  );
}
