// CategoriesEdgeRail — Trade Center category slider.
//
// Persistent left-edge tab labelled "Categories". Tapping opens a
// slide-out drawer with the 18 marketplace category links. Replaces
// the Notebook LeftMenuRail on /tc/trade-center* routes so category
// browsing is one tap from anywhere in the section.
//
// Desktop still has the inline `CategoryRail` visible on the left of
// the page layout — this edge tab is the mobile-friendly access point,
// and a keyboard shortcut on desktop.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  X,
  ChevronRight
} from "lucide-react";
import { RAIL_CATEGORIES, type RailCategorySlug } from "@/apps/tradecenter/data/categoryTaxonomy";

export function CategoriesEdgeRail() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const params = useSearchParams();

  // Derive the active slug from the current pathname. Root
  // `/tc/trade-center` renders All Products, so activeSlug is null
  // there and only a real category slug lights up a row.
  const activeSlug: RailCategorySlug | null = (() => {
    const parts = pathname.split("/").filter(Boolean);
    // parts[0] === "tc", parts[1] === "trade-center", parts[2] === slug
    if (parts[0] !== "tc" || parts[1] !== "trade-center") return null;
    if (!parts[2]) return null;
    const found = RAIL_CATEGORIES.find((c) => c.slug === parts[2]);
    return (found?.slug as RailCategorySlug) ?? null;
  })();

  // Auto-close when the pathname changes (i.e. after user picks a
  // category the drawer dismisses without needing a second tap).
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params?.toString()]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Persistent left-edge tab — mobile only. Desktop has the
          inline CategoryRail in the page layout so the edge tab is
          redundant above md. */}
      <aside
        className="fixed left-0 top-1/2 z-20 -translate-y-1/2 md:hidden"
        aria-label="Trade Center categories"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="group flex items-center gap-1 rounded-r-2xl border py-4 pl-1.5 pr-2 shadow-lg backdrop-blur transition-transform hover:translate-x-0.5"
          style={{
            backgroundColor: "#0A0A0A",
            color: "#FFB300",
            borderColor: "rgba(255,179,0,0.3)"
          }}
          title="Open Categories"
        >
          <ChevronRight size={12} className="opacity-60 group-hover:opacity-100"/>
          <div className="flex flex-col items-center gap-2">
            <LayoutGrid size={17} strokeWidth={2.2}/>
            <div
              className="rotate-180 text-[9px] font-black uppercase tracking-[0.16em]"
              style={{ writingMode: "vertical-rl", color: "#FFB300" }}
            >
              Categories
            </div>
          </div>
        </button>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Categories"
        >
          <aside
            className="relative z-10 flex h-full w-full max-w-sm flex-col overflow-hidden shadow-2xl"
            style={{ backgroundColor: "#FBF6EC" }}
          >
            {/* Sticky header — cream surface, yellow dot + wordmark. */}
            <header
              className="flex items-center justify-between border-b px-4 py-4"
              style={{
                backgroundColor: "#FBF6EC",
                borderColor: "rgba(139,69,19,0.15)"
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "#FFB300" }}
                />
                <span className="text-[13px] font-black text-neutral-900">
                  Product Categories
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5"
                aria-label="Close categories"
              >
                <X size={16}/>
              </button>
            </header>

            {/* Category list */}
            <nav
              className="flex-1 overflow-y-auto py-2"
              aria-label="All categories"
            >
              <ul className="flex flex-col">
                {/* "All Products" — landing default. */}
                <li>
                  <Link
                    href="/tc/trade-center"
                    onClick={() => setOpen(false)}
                    className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-bold transition"
                    style={{
                      backgroundColor: activeSlug === null ? "#FEF3C7" : "transparent",
                      color: activeSlug === null ? "#0A0A0A" : "#374151"
                    }}
                  >
                    <LayoutGrid
                      size={16}
                      strokeWidth={1.9}
                      className="flex-shrink-0"
                      style={{ color: activeSlug === null ? "#0A0A0A" : "#6B7280" }}
                      aria-hidden
                    />
                    <span className="truncate">All Products</span>
                    {activeSlug === null && (
                      <span
                        className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                        style={{
                          backgroundColor: "#0A0A0A",
                          color: "#FFB300"
                        }}
                      >
                        Now
                      </span>
                    )}
                  </Link>
                  <div
                    className="mx-4 my-2 border-t"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  />
                </li>
                {RAIL_CATEGORIES.map((c, i) => {
                  const active = c.slug === activeSlug;
                  const showSeparator =
                    c.bottomGroup && !RAIL_CATEGORIES[i - 1]?.bottomGroup;
                  return (
                    <li key={c.slug}>
                      {showSeparator && (
                        <div
                          className="mx-4 my-2 border-t"
                          style={{ borderColor: "rgba(139,69,19,0.15)" }}
                        />
                      )}
                      <Link
                        href={`/tc/trade-center/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-bold transition"
                        style={{
                          backgroundColor: active ? "#FEF3C7" : "transparent",
                          color: active ? "#0A0A0A" : "#374151"
                        }}
                      >
                        <c.icon
                          size={16}
                          strokeWidth={1.9}
                          className="flex-shrink-0"
                          style={{ color: active ? "#0A0A0A" : "#6B7280" }}
                          aria-hidden
                        />
                        <span className="truncate">{c.label}</span>
                        {active && (
                          <span
                            className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                            style={{
                              backgroundColor: "#0A0A0A",
                              color: "#FFB300"
                            }}
                          >
                            Now
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close categories"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
