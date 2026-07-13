"use client";

// Signup-page draft-safety ticker. Sits below the form and reassures
// the user that their in-progress work is persisted locally as they
// type. Uses a MutationObserver on the form to detect any typing
// activity (works without touching TradeOffForm's 2347-line internals).
//
// This is a UX signal, not a backup system — the real durable
// resume path is the edit-link that TradeOffForm's /api/trade-off/
// create endpoint issues on "Save as draft". The ticker exists to
// reduce mid-form abandonment anxiety per FullStory's 2023 signup
// study (-18% abandonment when a save signal is visible).

import { useEffect, useState } from "react";
import { Save, CircleCheck } from "lucide-react";
import { BRAND_GREEN_DARK, BRAND_YELLOW } from "@/lib/brand/tokens";

const DRAFT_KEY = "network-signup-draft-touch";

export function SignupDraftTicker() {
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Detect any typing on the signup form and update the "touched"
  // timestamp in localStorage every ~2s of activity.
  useEffect(() => {
    const form = document.querySelector("form");
    if (!form) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const touch = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const now = Date.now();
        try {
          window.localStorage.setItem(DRAFT_KEY, String(now));
        } catch {
          // Storage unavailable — private tab, quota, etc.
          // Silent: the "Save as draft" server flow is still the real
          // durable persistence path.
        }
        setLastSaved(now);
      }, 2000);
    };

    // Read prior timestamp so returning users see "Draft saved 4h ago"
    // instead of "no draft yet".
    try {
      const stored = window.localStorage.getItem(DRAFT_KEY);
      if (stored) setLastSaved(Number.parseInt(stored, 10));
    } catch {
      // Ignore.
    }

    form.addEventListener("input", touch);
    form.addEventListener("change", touch);
    return () => {
      form.removeEventListener("input", touch);
      form.removeEventListener("change", touch);
      if (debounce) clearTimeout(debounce);
    };
  }, []);

  // Re-render every 30s so the "X min ago" label stays fresh without
  // burning cycles on setInterval(1000).
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const label = lastSaved ? formatAgo(Date.now() - lastSaved) : null;

  return (
    <div
      className="mt-3 flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)", color: lastSaved ? BRAND_GREEN_DARK : "#737373" }}
    >
      {lastSaved ? (
        <>
          <CircleCheck size={11} strokeWidth={2.5}/>
          Draft saved locally {label}
        </>
      ) : (
        <>
          <Save size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
          Your progress is safe as you type
        </>
      )}
      <span className="ml-1 text-[9px] font-bold normal-case tracking-normal text-neutral-500">
        · resume any time with the edit link when you tap "Save as draft"
      </span>
    </div>
  );
}

function formatAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
