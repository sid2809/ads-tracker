"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddDomainModal({ onClose }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_name: name.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create");
        return;
      }

      if (data.exists) {
        // Navigate to existing domain hub
        router.push(`/domains/${data.id}`);
      } else {
        // Navigate to settings for new domain
        router.push(`/domains/${data.id}/settings`);
      }
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
          Add Domain
        </h2>
        <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 20 }}>
          Enter the domain name. You'll configure accounts and sheets next.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="example.com"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{ width: "100%", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}
          />

          {error && (
            <p style={{ color: "var(--status-red)", fontSize: 12, marginBottom: 12 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? <span className="spinner" /> : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
