"use client";

// Floating burger button (top-right) + right-side slide-in drawer that
// lists every plant hire page. Links are filtered by the merchant's
// feature toggles so disabled features are hidden. Uses inline SVG
// icons (Feather-style, stroked, single-weight) inside yellow-tinted
// rounded squares — never emoji.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { PlantHireConfig } from "@/lib/plantHire";

type IconKey =
  | "home"
  | "grid"
  | "calendar"
  | "target"
  | "compare"
  | "cart"
  | "pin"
  | "truck"
  | "shield"
  | "alert"
  | "box"
  | "card"
  | "briefcase"
  | "user"
  | "clock"
  | "camera"
  | "wrench"
  | "verified"
  | "video"
  | "calc";

type NavLink = { href: string; label: string; icon: IconKey; hint?: string };

const S = {
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none" as const,
  stroke: "currentColor"
};

const ICONS: Record<IconKey, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  compare: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M12 3v18" />
      <path d="M5 8l-3 4 3 4" />
      <path d="M19 8l3 4-3 4" />
      <path d="M2 12h8" />
      <path d="M14 12h8" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  verified: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <path d="M12 2l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 9l6-1z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  calc: (
    <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="12" y2="10" />
      <line x1="16" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" />
      <line x1="12" y1="14" x2="12" y2="14" />
      <line x1="16" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  )
};

function Icon({ k }: { k: IconKey }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-900 transition group-hover:brightness-95"
      style={{ background: "#FFB300" }}
    >
      {ICONS[k]}
    </span>
  );
}

export function PlantHireQuickNav({
  merchantSlug,
  cfg
}: {
  merchantSlug: string;
  cfg: PlantHireConfig;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const sub = `/${merchantSlug}/plant-hire`;

  const fleet: NavLink[] = [
    { href: `${sub}`, label: "Plant hire home", icon: "home", hint: "All 31 machine categories" },
    { href: `${sub}/machines`, label: "All machines", icon: "grid", hint: "Grid + search + filter" },
    { href: `${sub}/book`, label: "Book a machine", icon: "calendar", hint: "3-step wizard + deposit" },
    ...(cfg.machine_finder.enabled
      ? [{ href: `${sub}/finder`, label: "Machine finder", icon: "target" as IconKey, hint: "5-question shortlist" }]
      : []),
    { href: `${sub}/compare`, label: "Compare machines", icon: "compare", hint: "Up to 4 side by side" },
    { href: `${sub}/cart`, label: "Hire list (cart)", icon: "cart", hint: "Multi-machine WhatsApp" },
    ...(cfg.video_center.enabled && cfg.video_center.videos.length > 0
      ? [{
          href: `${sub}/video`,
          label: "Video centre",
          icon: "video" as IconKey,
          hint: "Watch the fleet on-site"
        }]
      : []),
    ...(cfg.site_calculator.enabled
      ? [{
          href: `${sub}/calculator`,
          label: "Site calculator",
          icon: "calc" as IconKey,
          hint: "Live aggregate + concrete pricing"
        }]
      : [])
  ];

  const delivery: NavLink[] = [
    { href: `${sub}/delivery-zones`, label: "Delivery zones", icon: "pin", hint: "Postcode + rates" },
    ...(cfg.haulage_service.enabled
      ? [{ href: `${sub}/haulage`, label: "Haulage wizard", icon: "truck" as IconKey, hint: "Hire OR move your own" }]
      : []),
    ...(cfg.compliance_info.enabled
      ? [{ href: `${sub}/compliance`, label: "Compliance", icon: "shield" as IconKey, hint: "STGO / VR1 / wide-load" }]
      : [])
  ];

  const services: NavLink[] = [
    ...(cfg.breakdown_service.enabled
      ? [{ href: `${sub}/breakdown`, label: "24/7 breakdown", icon: "alert" as IconKey, hint: "Report a fault" }]
      : []),
    ...(cfg.parts_counter.enabled
      ? [{ href: `${sub}/parts`, label: "Trade counter", icon: "box" as IconKey, hint: "Parts + spares catalogue" }]
      : []),
    ...(cfg.trade_accounts.enabled
      ? [{ href: `${sub}/trade-accounts`, label: "Open a trade account", icon: "card" as IconKey, hint: "30 days from invoice" }]
      : []),
    ...(cfg.driver_recruitment.enabled
      ? [{ href: `${sub}/careers`, label: "We're hiring", icon: "briefcase" as IconKey, hint: "Drivers · mechanics · office" }]
      : []),
    ...(cfg.trust_signals.enabled
      ? [{
          href: `${sub}/credentials`,
          label: "Vetted · Insured · Audited",
          icon: "verified" as IconKey,
          hint: "Accreditations, insurance + awards"
        }]
      : [])
  ];

  const portal: NavLink[] = [
    { href: `${sub}/my-hires`, label: "My hires (portal)", icon: "user", hint: "Phone lookup — no login" },
    { href: `${sub}/extend`, label: "Extend / off-hire", icon: "clock", hint: "Change a live hire" },
    { href: `${sub}/delivery-report`, label: "Delivery confirmation", icon: "camera", hint: "Sign for the machine" },
    { href: `${sub}/damage-report`, label: "Damage report", icon: "wrench", hint: "Pre or post hire" }
  ];

  const groups: { title: string; items: NavLink[] }[] = [
    { title: "Fleet", items: fleet },
    { title: "Delivery + haulage", items: delivery },
    { title: "Services", items: services },
    { title: "Your hires", items: portal }
  ].filter((g) => g.items.length > 0);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open plant hire menu"
          className="fixed right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white shadow-lg transition hover:border-[#FFB300] hover:shadow-xl sm:right-6 sm:top-6"
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden="true" className="flex flex-col gap-[3px]">
            <span className="block h-[2.5px] w-5 rounded-full" style={{ background: "#FFB300" }} />
            <span className="block h-[2.5px] w-5 rounded-full" style={{ background: "#0A0A0A" }} />
            <span className="block h-[2.5px] w-5 rounded-full" style={{ background: "#0A0A0A" }} />
          </span>
        </button>
      )}

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Plant hire navigation" className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition"
          />
          <aside
            className="absolute right-0 top-0 flex h-full w-[90vw] max-w-[400px] flex-col overflow-hidden bg-white shadow-2xl"
            style={{ animation: "phDrawerSlide 260ms cubic-bezier(0.22,1,0.36,1)" }}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                  Plant Hire · Menu
                </p>
                <p className="mt-0.5 text-[16px] font-extrabold leading-tight text-neutral-900">
                  Where do you want to go?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-white transition hover:border-[#FFB300] hover:bg-neutral-50"
              >
                <span aria-hidden="true" className="text-[20px] font-extrabold text-neutral-900">
                  ×
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {groups.map((g) => (
                <section key={g.title} className="mb-5">
                  <p className="px-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
                    {g.title}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {g.items.map((it) => (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          onClick={() => setOpen(false)}
                          className="group flex items-start gap-3 rounded-xl border border-transparent px-2 py-2.5 transition hover:border-[#FFB300] hover:bg-neutral-50"
                        >
                          <Icon k={it.icon} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-extrabold leading-tight text-neutral-900">
                              {it.label}
                            </span>
                            {it.hint && (
                              <span className="mt-0.5 block text-[11px] leading-tight text-neutral-500">
                                {it.hint}
                              </span>
                            )}
                          </span>
                          <span
                            aria-hidden="true"
                            className="mt-1 text-[12px] font-extrabold text-neutral-300 transition group-hover:text-neutral-900"
                          >
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="border-t border-neutral-200 px-5 py-3">
              <Link
                href={`/${merchantSlug}`}
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white hover:bg-black"
              >
                ← Back to profile
              </Link>
            </div>
          </aside>

          <style>{`
            @keyframes phDrawerSlide {
              from { transform: translateX(100%); }
              to   { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
