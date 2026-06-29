"use client";

// Affiliate dashboard chrome — header with burger button + drawer with
// the nav. Marketing pack and any other Phase-2 items render as
// "Coming soon" rather than being hidden so the affiliate sees the
// roadmap.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { XRATED_BRAND } from "@/lib/xratedTrades";

type Item = {
  href: string;
  label: string;
  status: "live" | "soon";
};

const ITEMS: Item[] = [
  { href: "/affiliates/dashboard", label: "Overview", status: "live" },
  { href: "/affiliates/dashboard/referrals", label: "Referrals", status: "live" },
  { href: "/affiliates/dashboard/commissions", label: "Commissions", status: "live" },
  {
    href: "/affiliates/dashboard/marketing-pack",
    label: "Marketing pack",
    status: "live"
  },
  { href: "/affiliates/leaderboard", label: "Leaderboard", status: "live" },
  { href: "/affiliates/dashboard/links", label: "Link generator", status: "live" },
  { href: "/affiliates/dashboard/social", label: "Social tracker", status: "live" },
  {
    href: "/affiliates/dashboard/payment-details",
    label: "Payment details",
    status: "live"
  },
  {
    href: "/affiliates/dashboard/landing-pages",
    label: "Landing pages",
    status: "live"
  },
  { href: "/affiliates/dashboard/api", label: "API tokens", status: "live" },
  {
    href: "/affiliates/dashboard/tax-report",
    label: "Tax report",
    status: "live"
  },
  { href: "/affiliates/dashboard/profile", label: "My profile", status: "live" }
];

export function AffiliateDashboardChrome({
  affiliateId,
  displayName,
  avatarUrl,
  paymentDetailsCompleted,
  children
}: {
  affiliateId: number;
  displayName: string;
  avatarUrl: string | null;
  paymentDetailsCompleted: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <header className="sticky top-0 z-30 border-b border-brand-line bg-black/95 backdrop-blur">
        <div className="mx-auto flex h-[64px] max-w-6xl items-center justify-between gap-3 px-4">
          <Link
            href="/affiliates/dashboard"
            className="flex items-center gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={XRATED_BRAND.logoUrl}
              alt={XRATED_BRAND.name}
              className="block h-9 w-auto object-contain"
            />
            <span className="hidden text-[13px] font-bold text-brand-text sm:inline">
              Affiliate dashboard
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-brand-muted sm:inline">
              ID #{affiliateId} · {displayName}
            </span>
            <Link
              href="/affiliates/dashboard/profile"
              aria-label="Edit profile"
              className="hidden h-10 w-10 overflow-hidden rounded-full border border-brand-line bg-brand-surface text-brand-text hover:opacity-90 sm:inline-flex sm:items-center sm:justify-center"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 object-cover"
                />
              ) : (
                <span aria-hidden="true" className="text-[13px] font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brand-line bg-brand-surface text-brand-text hover:bg-brand-line"
            >
              <span aria-hidden="true">☰</span>
            </button>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex-1 bg-black/70"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="flex h-full w-72 flex-col bg-brand-surface p-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="self-end rounded-lg border border-brand-line px-3 py-1.5 text-[13px] font-bold text-brand-text hover:bg-brand-line"
            >
              Close
            </button>
            <p className="mt-4 text-[13px] text-brand-muted">
              ID #{affiliateId}
            </p>
            <p className="text-[13px] font-bold text-brand-text">
              {displayName}
            </p>
            <nav className="mt-6 flex flex-col gap-1">
              {ITEMS.map((item) => {
                const active = pathname === item.href;
                if (item.status === "soon") {
                  return (
                    <span
                      key={item.href}
                      className="cursor-not-allowed rounded-lg px-3 py-2 text-[13px] text-brand-muted"
                    >
                      {item.label}{" "}
                      <em className="ml-1 text-[11px] not-italic text-brand-accent">
                        soon
                      </em>
                    </span>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
                      active
                        ? "bg-brand-accent text-black"
                        : "text-brand-text hover:bg-brand-line"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-6 border-t border-brand-line pt-4">
              <a
                href="/api/affiliates/logout"
                className="block rounded-lg px-3 py-2 text-[13px] font-bold text-red-400 hover:bg-brand-line"
              >
                Log out
              </a>
            </div>
            {!paymentDetailsCompleted && (
              <p className="mt-6 rounded-lg border border-brand-accent/40 bg-brand-accent/10 p-3 text-[13px] leading-snug text-brand-text">
                Complete your payment details so we can pay you when you
                cross £50.
              </p>
            )}
          </aside>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </main>
  );
}
