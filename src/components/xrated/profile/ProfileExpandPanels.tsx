"use client";

// Xrated Trades — premium-tier inline expand panels (anchor-driven).
//
// Server components can't pass functions across the client boundary, so this
// component now uses URL hashes as triggers:
//   - Any link with href="#contact-panel" opens the contact panel
//   - Any link with href="#visit-panel"   opens the visit panel
//   - href="#close-panel" (or pressing ESC, or the X) closes whichever is open
//
// Triggers can live anywhere on the page — banner overlay buttons, profile
// container CTA, inline text links — they're just plain anchor tags rendered
// by the server. This client component owns the open/closed state and the
// panel-mount markup that sits below the profile container.

import { useEffect, useRef, useState, type ReactNode } from "react";

type PanelKey = "contact" | "visit";

export function ProfileExpandPanels({
  contactPanel,
  visitPanel
}: {
  contactPanel: ReactNode;
  visitPanel: ReactNode;
}) {
  const [open, setOpen] = useState<PanelKey | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Sync open-state with the URL hash. Tapping any <a href="#contact-panel">
  // anywhere on the page fires hashchange, and we toggle here.
  useEffect(() => {
    function applyFromHash() {
      const h = window.location.hash;
      if (h === "#contact-panel") setOpen("contact");
      else if (h === "#visit-panel") setOpen("visit");
      else if (h === "#close-panel") {
        setOpen(null);
        // Strip the hash without scroll-jump.
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    applyFromHash();
    window.addEventListener("hashchange", applyFromHash);
    return () => window.removeEventListener("hashchange", applyFromHash);
  }, []);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(null);
        if (window.location.hash) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Scroll the freshly-opened panel into view so it appears just below the
  // profile container in the viewport.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const node = panelRef.current;
    const t = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const isOpen = open !== null;
  const label = open === "contact" ? "Contact" : open === "visit" ? "Visit us" : undefined;

  return (
    <section className="mx-auto max-w-6xl px-4">
      <div
        ref={panelRef}
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
          isOpen ? "mt-4 max-h-[3000px] opacity-100" : "mt-0 max-h-0 opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <div
          role="region"
          aria-label={label}
          className="rounded-2xl border border-brand-line bg-brand-surface/60 p-1"
        >
          <div className="flex items-center justify-between gap-2 px-3 pt-2">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">
              {label}
            </p>
            <a
              href="#close-panel"
              aria-label="Close panel"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-brand-bg text-brand-muted transition hover:border-brand-accent hover:text-brand-accent"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </a>
          </div>
          <div className="px-1 pb-3">
            {open === "contact" ? contactPanel : open === "visit" ? visitPanel : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProfileExpandPanels;
