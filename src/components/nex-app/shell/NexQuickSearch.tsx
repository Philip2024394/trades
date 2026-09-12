"use client";

// NexQuickSearch — magnifying-glass icon that lives beside the sections
// menu on every /nex-app/* page. Click (or press "/") opens a full-width
// search bar overlay. Submit navigates to /nex-app/directory?q=<query>
// which renders the landscape-card directory (Doctrine #6 chips on every
// result · expand-in-place products · Ask drop-down · truth-in-advertising
// honesty audit).
//
// Founder Phase 29 (2026-09-10) — this is the "search icon in the header
// that activates the search text field" the founder asked for.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

const HIDDEN_PATHS: Array<(p: string) => boolean> = [
  (p) => p === "/nex-app/enter",
  (p) => p.startsWith("/nex-app/staircase-library"),
  (p) => p.startsWith("/nex-appchat"),
  (p) => p === "/nexapp/enter",
  (p) => p.startsWith("/nexapp/staircase-library"),
];

export function NexQuickSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut "/" focuses search from anywhere (except
  // when the user is already typing into a field). Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) { setOpen(false); return; }
      if (e.key !== "/") return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  const submit = useCallback(() => {
    const query = q.trim();
    if (!query) return;
    setOpen(false);
    // Founder Phase 30 · canonical path is /nexapp. Route the search
    // to /nexapp/directory when launched from any /nexapp/* page;
    // keep the /nex-app mirror behavior for the legacy layout.
    const canonicalPrefix = pathname.startsWith("/nexapp") ? "/nexapp" : "/nex-app";
    router.push(`${canonicalPrefix}/directory?q=${encodeURIComponent(query)}`);
  }, [q, router, pathname]);

  const hidden = HIDDEN_PATHS.some((match) => match(pathname));
  if (hidden) return null;

  return (
    <>
      {/* Fixed top-right icon · sits to the LEFT of the sections Menu
          button which is at right-3/right-4. We offset by 56/64px so
          both icons are visible without overlap. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open NEX directory search"
        title="Search NEX directory (press /)"
        data-nex-quick-search-trigger="true"
        className="fixed top-3 right-16 sm:top-4 sm:right-[4.5rem] z-30 w-11 h-11 grid place-items-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
      >
        <Search className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="NEX directory search"
          data-nex-quick-search-overlay="true"
          className="fixed inset-0 z-[60] flex items-start justify-center pt-16 sm:pt-24 bg-foreground/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-[92vw] max-w-[720px] bg-card text-foreground border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submit(); }
                }}
                placeholder="Search hotels, restaurants, services… any topic"
                className="flex-1 bg-transparent outline-none text-body-lg placeholder:text-muted-foreground"
                aria-label="Search topic"
                data-nex-quick-search-input="true"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!q.trim()}
                className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-caption font-medium disabled:opacity-50"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="w-8 h-8 grid place-items-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-3 text-caption text-muted-foreground bg-muted/30">
              Opens the NEX Directory · every result carries a{" "}
              <strong className="text-foreground">Verified</strong> or{" "}
              <strong className="text-foreground">Unconfirmed</strong> chip (Doctrine #6).
              Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-caption">/</kbd> from any page to reopen.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
