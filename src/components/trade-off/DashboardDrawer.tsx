"use client";

// Trade-side dashboard drawer — burger trigger top-right that opens a
// right-side slide drawer with the dashboard nav. Mounted on every
// /trade-off/edit/[slug] sub-page so the tradesperson can hop between
// Profile, App Studio, and the live public page from anywhere.
//
// Lives outside XratedHeader because the burger only makes sense when
// the tradesperson is signed into their dashboard (token-bound). The
// shared header still renders the public marketing nav for everyone
// else.

import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  blurb: string;
  icon: React.ReactNode;
  external?: boolean;
};

export function DashboardDrawer({
  slug,
  token,
  current
}: {
  slug: string;
  token: string;
  /** Which dashboard page the user is currently on — used to dim that
   *  drawer row and skip the navigation. */
  current: "profile" | "app-studio" | "add-ons" | "sharing" | "insights";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const tokenQs = `?token=${encodeURIComponent(token)}`;
  const items: NavItem[] = [
    {
      href: `/trade-off/edit/${slug}${tokenQs}`,
      label: "Profile dashboard",
      blurb: "Identity, trust, services, hours, FAQ.",
      icon: <UserIcon />
    },
    {
      href: `/trade-off/edit/${slug}/app-studio${tokenQs}`,
      label: "App Studio",
      blurb: "Theme, hero text, animations, marquee.",
      icon: <BrushIcon />
    },
    {
      href: `/trade-off/edit/${slug}/add-ons${tokenQs}`,
      label: "Add-ons",
      blurb: "Sell products, custom domain, SMS alerts.",
      icon: <PlusIcon />
    },
    {
      href: `/trade-off/edit/${slug}/sharing${tokenQs}`,
      label: "Sharing",
      blurb: "WhatsApp business card + lead alerts.",
      icon: <ShareIcon />
    },
    {
      href: `/trade-off/edit/${slug}/insights${tokenQs}`,
      label: "Insights",
      blurb: "Trust Score, plan status, rewards.",
      icon: <ChartIcon />
    },
    {
      // Authed link to the public Yard feed — passes slug+token so the
      // flag button + reaction bar work without re-auth. Members who
      // visit /trade-off/yard from a cold link will see the icons but
      // get "Please log in to flag" until they sign in.
      href: `/trade-off/yard?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
      label: "The Yard",
      blurb: "Trades-only chat board — react, post, flag, help out.",
      icon: <YardIcon />
    },
    {
      href: `/${slug}`,
      label: "View live profile",
      blurb: "Open the page your customers see.",
      icon: <ExternalIcon />,
      external: true
    }
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 top-3 z-40 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-lg transition active:scale-95 sm:right-5 sm:top-5"
        aria-label="Open dashboard menu"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 pb-4 pt-5">
              <div className="min-w-0">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: "#FFB300" }}
                >
                  Dashboard
                </p>
                <h2 className="mt-0.5 text-base font-extrabold text-neutral-900">
                  {slug}
                </h2>
                <p className="mt-0.5 text-[13px] text-neutral-500">
                  Where do you want to go?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
              >
                ×
              </button>
            </header>

            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="grid gap-2">
                {items.map((it) => {
                  const isCurrent =
                    (current === "profile" && it.label === "Profile dashboard") ||
                    (current === "app-studio" && it.label === "App Studio") ||
                    (current === "add-ons" && it.label === "Add-ons") ||
                    (current === "sharing" && it.label === "Sharing") ||
                    (current === "insights" && it.label === "Insights");
                  return (
                    <li key={it.label}>
                      <a
                        href={it.href}
                        {...(it.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                          isCurrent
                            ? "border-[color:#FFB300] bg-[color:#FFF8E5]"
                            : "border-neutral-200 bg-white hover:border-neutral-400"
                        }`}
                      >
                        <span
                          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                          style={{ background: "rgba(255,179,0,0.15)" }}
                        >
                          {it.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-[13px] font-extrabold text-neutral-900">
                              {it.label}
                            </span>
                            {isCurrent && (
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                                style={{ background: "#FFB300" }}
                              >
                                Here
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-neutral-500">
                            {it.blurb}
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <footer className="border-t border-neutral-100 px-5 py-3 text-[12px] text-neutral-500">
              Changes save instantly. Open the live profile in a new tab to
              preview.
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function BrushIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a3 3 0 0 1 4.2 0l-9.2 9.2a3 3 0 0 1-4.2-4.2z" />
      <path d="M6 13c-2 1-3 3-3 5 2 0 4-1 5-3" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
function YardIcon() {
  // Chat-bubble cluster — reads as "community board".
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
