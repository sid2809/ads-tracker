"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import AddDomainModal from "./AddDomainModal";

function PinIcon({ filled }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5"/><path d="M9 2h6l-1 7h4l-7 8-1-4H6l3-11z"/>
    </svg>
  );
}

export default function NavBar({ user, domains = [], onDomainsChange }) {
  const pathname = usePathname();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const dropdownRef = useRef(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function togglePin(e, domain) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/domains/${domain.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !domain.pinned }),
      });
      if (res.ok && onDomainsChange) onDomainsChange();
    } catch {
      // ignore
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const navLinks = [
    { href: "/", label: "Dashboard" },
    ...(isAdmin
      ? [
          { href: "/reconciliation", label: "Reconciliation" },
          { href: "/domain-search", label: "Domain Search" },
        ]
      : []),
  ];

  return (
    <>
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border-primary)",
        padding: "0 24px",
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backdropFilter: "blur(8px)",
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}>
            Campaign Tracker
          </span>

          <div style={{ display: "flex", gap: 4 }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "6px 10px",
                  fontSize: 13,
                  color: pathname === link.href ? "var(--text-primary)" : "var(--text-tertiary)",
                  textDecoration: "none",
                  borderRadius: 6,
                  background: pathname === link.href ? "var(--bg-tertiary)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Domain dropdown */}
          {isAdmin && (
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="btn btn-secondary"
                style={{ padding: "5px 10px", fontSize: 12 }}
              >
                Domains
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showDropdown && (
                <div className="fade-in" style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 4px)",
                  width: 260,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 8,
                  boxShadow: "var(--shadow-md)",
                  maxHeight: 320,
                  overflow: "auto",
                }}>
                  {domains.length === 0 ? (
                    <div style={{ padding: 16, color: "var(--text-tertiary)", fontSize: 12, textAlign: "center" }}>
                      No domains yet
                    </div>
                  ) : (
                    domains.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          cursor: "pointer",
                          transition: "background 0.1s",
                          borderBottom: "1px solid var(--border-secondary)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => {
                          setShowDropdown(false);
                          window.location.href = `/domains/${d.id}`;
                        }}
                      >
                        <span style={{
                          fontSize: 13,
                          color: "var(--text-primary)",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {d.domain_name}
                        </span>
                        <button
                          onClick={(e) => togglePin(e, d)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: d.pinned ? "var(--status-amber)" : "var(--text-tertiary)",
                            padding: 4,
                            display: "flex",
                          }}
                          title={d.pinned ? "Unpin" : "Pin to dashboard"}
                        >
                          <PinIcon filled={d.pinned} />
                        </button>
                      </div>
                    ))
                  )}

                  {/* Add Domain */}
                  <div
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setShowDropdown(false);
                      setShowAddModal(true);
                    }}
                  >
                    + Add Domain
                  </div>
                </div>
              )}
            </div>
          )}

          <ThemeToggle />

          {/* User pill */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            background: "var(--bg-tertiary)",
            borderRadius: 6,
            fontSize: 12,
          }}>
            <span style={{ color: "var(--text-secondary)" }}>{user?.username}</span>
            <span className="badge" style={{
              background: user?.role === "admin" ? "var(--status-green-muted)" : "var(--status-blue-muted)",
              color: user?.role === "admin" ? "var(--status-green)" : "var(--status-blue)",
            }}>
              {user?.role}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-tertiary)",
                padding: 0,
                display: "flex",
              }}
              title="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {showAddModal && (
        <AddDomainModal
          onClose={() => {
            setShowAddModal(false);
            if (onDomainsChange) onDomainsChange();
          }}
        />
      )}
    </>
  );
}
