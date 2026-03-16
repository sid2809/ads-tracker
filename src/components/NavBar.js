"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Reconciliation" },
    { href: "/domain-search", label: "Domain Search" },
  ];

  return (
    <nav className="bg-white border-b border-surface-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 flex items-center h-14 gap-1">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-surface-600 hover:text-surface-900 hover:bg-surface-50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
