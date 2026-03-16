"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteDomainModal({ domain, onClose }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const canDelete = input === domain.domain_name;

  async function handleDelete() {
    if (!canDelete) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/domains/${domain.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
        onClose();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: "var(--status-red)", fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
          Delete Domain
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          This will permanently delete <strong style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{domain.domain_name}</strong> and all its data.
        </p>
        <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 12 }}>
          Type the domain name to confirm:
        </p>

        <input
          type="text"
          placeholder={domain.domain_name}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          style={{ width: "100%", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={!canDelete || loading}
          >
            {loading ? <span className="spinner" /> : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
