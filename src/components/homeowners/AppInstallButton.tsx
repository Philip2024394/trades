"use client";

// AppInstallButton — client-side pill for install/uninstall on the
// App Store grid + inside app detail views. Optimistic update flips
// the label immediately; router.refresh reloads server state.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Minus } from "lucide-react";
import type { SiteBookAppSlug } from "@/apps/sitebook/_shared/manifest";

const BRAND_GREEN = "#166534";
const BRAND_RED   = "#B91C1C";

export function AppInstallButton({
  slug,
  installed,
  demoMode = false
}: {
  slug:      SiteBookAppSlug;
  installed: boolean;
  /** When true, skip the API call and just fire a browser event so
   *  siblings (e.g. right-rail tiles on the mock) can sync visually.
   *  Used by /sitebook-showcase where there's no real homeowner
   *  session to write to. */
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean>(installed);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const target = !optimistic;
    setOptimistic(target);

    if (demoMode) {
      // Broadcast so anything listening (mock-page's client wrapper)
      // can re-render the app's tile. No API call, no persistence.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sitebook:mock-app-toggle", {
          detail: { slug, installed: target }
        }));
      }
      return;
    }

    startTransition(async () => {
      const res  = await fetch(`/api/homeowner/apps/${slug}`, {
        method: target ? "POST" : "DELETE"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setOptimistic(!target);          // revert on failure
        setError(data.error || "Action failed");
        return;
      }
      router.refresh();
    });
  }

  if (optimistic) {
    // Installed → "Remove app" (red filled)
    return (
      <>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: BRAND_RED }}
          title="Remove this app from your SiteBook (data stays)"
        >
          {pending
            ? <><Loader2 size={12} className="animate-spin"/> Working…</>
            : <><Minus size={12} strokeWidth={2.6}/> Remove app</>}
        </button>
        {error && (
          <p className="mt-1 text-[10.5px] font-bold text-red-800">{error}</p>
        )}
      </>
    );
  }

  // Not installed → "Add app" (green filled)
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
        style={{ backgroundColor: BRAND_GREEN }}
      >
        {pending
          ? <><Loader2 size={12} className="animate-spin"/> Adding…</>
          : <><Plus size={12} strokeWidth={2.6}/> Add app</>}
      </button>
      {error && (
        <p className="mt-1 text-[10.5px] font-bold text-red-800">{error}</p>
      )}
    </>
  );
}
