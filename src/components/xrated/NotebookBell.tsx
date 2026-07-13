"use client";

// Notebook bell — sits in the platform header next to the Log-in
// button. Silent for logged-out visitors. When the merchant has any
// action-required events in their notebook, a red dot appears on the
// bell. Click routes to their notebook.
//
// Two lightweight fetches on mount: the session probe to know who's
// looking, then the actions probe to count what needs doing. Both are
// GETs against endpoints that already exist and return empty when the
// caller isn't signed in — no auth branching here.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

export function NotebookBell() {
  const [slug, setSlug] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetch("/api/trade-off/session");
        if (!s.ok) return;
        const sData = await s.json();
        const viewerSlug = sData?.slug ?? null;
        if (cancelled || !viewerSlug) return;
        setSlug(viewerSlug);
        // Only fetch actions once we know we have a viewer.
        const a = await fetch("/api/notebook/actions");
        if (!a.ok) return;
        const aData = await a.json();
        if (!cancelled && typeof aData.count === "number") setCount(aData.count);
      } catch { /* logged-out or offline — bell stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!slug) return null;

  return (
    <Link
      href={`/trade-off/notebook/${encodeURIComponent(slug)}`}
      aria-label={count > 0 ? `Notebook — ${count} action${count === 1 ? "" : "s"} needed` : "Notebook"}
      title={count > 0 ? `${count} action${count === 1 ? "" : "s"} needed` : "Notebook"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <Bell size={16} strokeWidth={2}/>
      {count > 0 && (
        <span
          className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none shadow-sm"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
