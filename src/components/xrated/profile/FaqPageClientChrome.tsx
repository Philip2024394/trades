"use client";

// FaqPageClientChrome — small client island that adds two interactive
// behaviours to the otherwise-static dedicated FAQ page:
//
// 1. Category filter chips — when a chip other than "All" is selected,
//    every FAQ card with a `data-faq-category` attribute that doesn't
//    match is hidden via inline display:none. We do this without
//    re-rendering the cards (which are server-rendered with full
//    Schema.org markup); the client just toggles visibility so the JSON-
//    LD payload stays intact for crawlers.
// 2. Hash-anchor scroll + yellow flash — when the URL carries a #faq-NNN
//    fragment we scroll the target card into view and add a transient
//    yellow ring for 1.5s so the customer can spot which FAQ matched the
//    link they followed. Fires a track-view ping for analytics.

import { useEffect, useState } from "react";

type FaqCategory =
  | "general"
  | "pricing"
  | "process"
  | "materials"
  | "trust"
  | "warranty"
  | "aftercare";

const CATEGORY_LABEL: Record<FaqCategory, string> = {
  general: "General",
  pricing: "Pricing",
  process: "Process",
  materials: "Materials",
  trust: "Trust",
  warranty: "Warranty",
  aftercare: "Aftercare"
};

export function FaqPageClientChrome({
  slug,
  categories
}: {
  slug: string;
  /** Only categories with at least 1 live FAQ. Order is fixed (page
   *  passes them through in CATEGORY_LABEL order). */
  categories: FaqCategory[];
}) {
  const [active, setActive] = useState<FaqCategory | "all">("all");

  // Hash → scroll + flash + track. We don't depend on the chip filter
  // here; if the target is hidden by a filter we still un-hide it by
  // jumping to "all" before scrolling.
  useEffect(() => {
    function processHash() {
      const hash = window.location.hash.replace(/^#/, "").toLowerCase();
      if (!/^faq-\d{3,4}$/.test(hash)) return;
      const refCode = hash.toUpperCase();
      const node = document.querySelector<HTMLElement>(
        `[data-faq-ref="${refCode}"]`
      );
      if (!node) return;
      // Reset any active filter so the card is visible.
      setActive("all");
      // Defer the scroll/flash one tick so the filter reset paints first.
      window.setTimeout(() => {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        node.classList.add("ring-4", "ring-[#FFB300]", "ring-offset-2");
        window.setTimeout(() => {
          node.classList.remove("ring-4", "ring-[#FFB300]", "ring-offset-2");
        }, 1500);
        // Fire-and-forget view tracker.
        void fetch("/api/trade-off/faq-items/track-view", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, ref_code: refCode })
        }).catch(() => {});
      }, 50);
    }
    processHash();
    window.addEventListener("hashchange", processHash);
    return () => window.removeEventListener("hashchange", processHash);
  }, [slug]);

  // Apply / clear the filter by toggling display on each card.
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-faq-category]");
    cards.forEach((c) => {
      const cat = (c.dataset.faqCategory ?? "general") as FaqCategory;
      const show = active === "all" || cat === active;
      c.style.display = show ? "" : "none";
    });
  }, [active]);

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <ChipButton
        active={active === "all"}
        onClick={() => setActive("all")}
        label="All"
      />
      {categories.map((c) => (
        <ChipButton
          key={c}
          active={active === c}
          onClick={() => setActive(c)}
          label={CATEGORY_LABEL[c]}
        />
      ))}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center rounded-full px-4 text-xs font-extrabold uppercase tracking-wider transition active:scale-[0.97] ${
        active
          ? "border-2 border-[#FFB300] bg-[#FFB300] text-neutral-900"
          : "border border-neutral-200 bg-white text-neutral-700 hover:border-[#FFB300] hover:text-[#FFB300]"
      }`}
    >
      {label}
    </button>
  );
}
