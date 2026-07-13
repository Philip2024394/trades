// GlobalTradeCenterLink — persistent "jump to Trade Center" pill.
//
// Mounted on every route via the root layout. Auto-hides when the
// user is already inside /tc/* (where the main header already carries
// the Trade Center wordmark). Follows the yellow-dot brand pattern.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDE_ON_PREFIXES = [
  "/tc/",             // already inside Trade Center
  "/auth/",           // OAuth callback screens
  "/api/",            // never on API surfaces (won't render there anyway)
  "/hero-swap-demo",  // developer sandbox
  "/live-edit-demo",
  "/trade-off/yard",  // Yard has its own in-line app jumps
  "/canteen"          // canteen pages have their own header wordmark + direct link in AppShell
];

export function GlobalTradeCenterLink() {
  const pathname = usePathname() ?? "/";
  // Hide on the main landing — the AppShell header carries the
  // Yard / Marketplace / Trade Center links inline so the floating
  // pill would just overlap the wordmark.
  if (pathname === "/") return null;
  for (const p of HIDE_ON_PREFIXES) {
    if (pathname === p.replace(/\/$/, "") || pathname.startsWith(p)) return null;
  }

  return (
    <Link
      href="/tc/hub"
      aria-label="Open Trade Center"
      className="fixed right-3 top-3 z-[55] inline-flex min-h-[36px] items-center gap-2 rounded-full border bg-white/95 pl-3 pr-3 text-neutral-900 shadow-md backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg sm:right-4 sm:top-4"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
      title="Open Trade Center"
    >
      <span
        className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: "#FFB300" }}
        aria-hidden
      />
      <span className="text-[10.5px] font-black uppercase tracking-[0.14em]">
        Trade Center
      </span>
    </Link>
  );
}
