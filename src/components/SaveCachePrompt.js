"use client";

export default function SaveCachePrompt({ onSave, onSkip }) {
  return (
    <div style={{
      background: "var(--bg-tertiary)",
      border: "1px solid var(--border-primary)",
      borderRadius: 8,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    }}>
      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        You ran with different settings. Save these results to cache?
      </p>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button className="btn btn-secondary" onClick={onSkip} style={{ padding: "5px 12px", fontSize: 12 }}>
          No
        </button>
        <button className="btn btn-primary" onClick={onSave} style={{ padding: "5px 12px", fontSize: 12 }}>
          Yes, save
        </button>
      </div>
    </div>
  );
}
