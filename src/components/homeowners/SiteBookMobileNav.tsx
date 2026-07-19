"use client";

// SiteBookMobileNav — fixed bottom nav bar for /sitebook and the
// mock showcase page.
//
// Only rendered on mobile (md:hidden). Five tabs:
//   • Home     — scroll to top / close all sheets
//   • Trades   — pull-up sheet with the Trades & Suppliers panel
//   • Photos   — pull-up sheet with the Photo library grid
//   • + Post   — focuses the composer (scrolls to it + expands sheet)
//   • More     — pull-up sheet with App Store / How it works / Settings / Log out
//
// Style follows Philip's UI language: off-white bg, small rounded
// corners, yellow active tab, black text, 44px+ tap targets (WCAG).

import { useEffect } from "react";
import { Home, Users, Camera, Plus, X, MoreHorizontal } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

export type MobileSheetKey = null | "trades" | "photos" | "compose" | "more";

export function SiteBookMobileNav({
  openSheet,
  onSheetChange,
  onComposeFocus,
  tradesContent,
  photosContent,
  moreContent
}: {
  openSheet:       MobileSheetKey;
  onSheetChange:   (next: MobileSheetKey) => void;
  /** Called when the user taps +Post — parent scrolls to composer. */
  onComposeFocus:  () => void;
  tradesContent:   React.ReactNode;
  photosContent:   React.ReactNode;
  moreContent:     React.ReactNode;
}) {
  // Lock body scroll while a sheet is open — feels native
  useEffect(() => {
    if (openSheet && openSheet !== "compose") {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
    return;
  }, [openSheet]);

  const NAV = [
    { key: "home"    as const, icon: Home,            label: "Home"   },
    { key: "trades"  as const, icon: Users,           label: "Trades" },
    { key: "post"    as const, icon: Plus,            label: "Post"   },
    { key: "photos"  as const, icon: Camera,          label: "Photos" },
    { key: "more"    as const, icon: MoreHorizontal,  label: "More"   }
  ];

  function tap(k: typeof NAV[number]["key"]) {
    if (k === "home") {
      onSheetChange(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (k === "post") {
      onSheetChange(null);
      onComposeFocus();
      return;
    }
    onSheetChange(openSheet === k ? null : k);
  }

  const sheetTitles: Record<Exclude<MobileSheetKey, null | "compose">, string> = {
    trades: "Trades & Suppliers",
    photos: "Photo library",
    more:   "More"
  };

  return (
    <>
      {/* Sheet overlay + content */}
      {openSheet && openSheet !== "compose" && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/60 md:hidden"
          onClick={() => onSheetChange(null)}
        >
          <div
            className="relative w-full max-h-[85vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Grab handle + title + close */}
            <div className="relative flex items-center justify-center border-b border-neutral-100 px-3 py-2">
              <div className="mx-auto h-1 w-10 rounded-full bg-neutral-300" aria-hidden="true"/>
              <p className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-1 text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
                {sheetTitles[openSheet]}
              </p>
              <button
                type="button"
                onClick={() => onSheetChange(null)}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
              >
                <X size={16}/>
              </button>
            </div>
            <div className="max-h-[calc(85vh-48px)] overflow-y-auto p-3">
              {openSheet === "trades" && tradesContent}
              {openSheet === "photos" && photosContent}
              {openSheet === "more"   && moreContent}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav — safe-area aware */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[70] grid grid-cols-5 border-t bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden"
        style={{
          borderColor:  "rgba(0,0,0,0.08)",
          paddingBottom: "env(safe-area-inset-bottom)"
        }}
      >
        {NAV.map(({ key, icon: Icon, label }) => {
          const active =
            (key === "home"   && openSheet === null) ||
            (key === "trades" && openSheet === "trades") ||
            (key === "photos" && openSheet === "photos") ||
            (key === "post"   && openSheet === "compose") ||
            (key === "more"   && openSheet === "more");
          const isPostCta = key === "post";
          return (
            <button
              key={key}
              type="button"
              onClick={() => tap(key)}
              className="relative inline-flex min-h-[56px] flex-col items-center justify-center gap-0.5 transition"
              style={{
                color:           isPostCta ? "#0A0A0A" : (active ? "#0A0A0A" : "#94908A"),
                backgroundColor: active && !isPostCta ? "rgba(255,179,0,0.10)" : "transparent"
              }}
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              {active && !isPostCta && (
                <span
                  className="absolute inset-x-6 top-0 h-[3px] rounded-full"
                  style={{ backgroundColor: BRAND_YELLOW }}
                  aria-hidden="true"
                />
              )}
              {isPostCta ? (
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full shadow-md"
                  style={{ backgroundColor: BRAND_YELLOW }}
                >
                  <Icon size={18} strokeWidth={2.6}/>
                </span>
              ) : (
                <Icon size={18} strokeWidth={2.4}/>
              )}
              <span className="text-[9.5px] font-black uppercase tracking-wider">{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
