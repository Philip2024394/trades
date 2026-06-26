"use client";

// Xrated Trades — premium-tier "Services" chip row.
// Shows the first 3 (mobile) / 4 (desktop) services inline. If there are
// more, a hamburger button at the end of the first line expands the rest
// underneath. Tap again to collapse.

import { useState } from "react";

const VISIBLE_MOBILE = 3;
const VISIBLE_DESKTOP = 4;

export function ServicesChips({
  services,
  themeColor
}: {
  services: string[];
  themeColor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!services || services.length === 0) return null;

  // Use the desktop count as the truncation point; the visible-mobile
  // overflow is handled by `hidden sm:inline-flex` on the 4th chip.
  const overflowCount = Math.max(0, services.length - VISIBLE_DESKTOP);
  const hasOverflow = overflowCount > 0;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-2 pt-8">
      <h2
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: themeColor }}
      >
        Services
      </h2>
      <ul className="mt-3 flex flex-wrap items-center gap-2">
        {services.slice(0, VISIBLE_DESKTOP).map((s, i) => (
          <li key={s} className={i >= VISIBLE_MOBILE ? "hidden sm:inline-flex" : ""}>
            <span
              className="inline-flex h-11 items-center rounded-full border bg-brand-surface px-4 text-[13px] font-semibold text-brand-text"
              style={{ borderColor: themeColor }}
            >
              {s}
            </span>
          </li>
        ))}
        {hasOverflow && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Hide extra services" : "Show extra services"}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-brand-surface px-3 text-[13px] font-semibold text-brand-text transition hover:bg-brand-bg"
              style={{ borderColor: themeColor }}
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
                className={`transition-transform ${expanded ? "rotate-90" : ""}`}
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              +{overflowCount}
            </button>
          </li>
        )}
      </ul>

      {hasOverflow && (
        <ul
          className={`mt-2 flex flex-wrap gap-2 overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
          aria-hidden={!expanded}
        >
          {services.slice(VISIBLE_DESKTOP).map((s) => (
            <li key={s}>
              <span
                className="inline-flex h-11 items-center rounded-full border bg-brand-surface px-4 text-[13px] font-semibold text-brand-text"
                style={{ borderColor: themeColor }}
              >
                {s}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
