"use client";

// SiteBook name-claim widget — homeowner picks a nickname for their
// SiteBook (like "The Old Rectory" or "42 Elm Road"). Mirrors the
// merchant URL-claim energy at /trade-off but adapted for private
// ownership — no public URL, but the psychological "claim your thing"
// moment survives.
//
// FLOW (2026-07-18):
//   1. Visitor types nickname + clicks "Create my SiteBook"
//   2. We POST to /api/homeowner/guest-start with the nickname
//   3. Server sets the tn_guest_sitebook cookie + returns { redirect: "/sitebook" }
//   4. Visitor lands INSIDE the workspace shell (guest view) with
//      their SiteBook name at the top
//   5. When they hit "+ New project" (or any storage action), the
//      GuestActivationModal opens — that's where full signup happens
//      (via /api/homeowner/activate which reads the guest cookie).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

const SUGGESTIONS = [
  "The Old Rectory",
  "42 Elm Road",
  "Sarah's House",
  "The Manor",
  "Rose Cottage",
  "Chez Manchester"
];

// Match the server-side baseSlugFromNickname in src/lib/homeowners/slug.ts —
// no hyphens by default (only added on collision via -2, -3 suffix).
// "The Old Rectory" → "theoldrectory".
function nicknameToSlug(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
  return (/^[a-z]/.test(s) ? s : `home${s}`).slice(0, 40);
}

export function SiteBookNameClaim({
  variant = "hero"
}: {
  variant?: "hero" | "footer";
}) {
  const router          = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed         = name.trim();
  const displayName     = trimmed || SUGGESTIONS[0];
  const canContinue     = trimmed.length >= 2 && !busy;

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (trimmed.length < 2 || busy) return;
    setBusy(true);
    const res = await fetch("/api/homeowner/guest-start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ nickname: trimmed })
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok && data.redirect) {
      router.push(data.redirect);
    } else {
      setBusy(false);
    }
  }

  return (
    <div className={variant === "hero" ? "text-white" : "text-neutral-900"}>
      <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${variant === "hero" ? "text-white/70" : "text-neutral-500"}`}>
        Name your SiteBook
      </p>

      <form
        onSubmit={onCreate}
        className={`mt-2 rounded-2xl border-2 p-2 shadow-lg ${variant === "hero" ? "border-white/25 bg-white/95" : "border-neutral-200 bg-white"}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 48))}
            placeholder={SUGGESTIONS[0]}
            className="flex-1 bg-transparent px-3 py-3 text-[16px] font-black text-neutral-900 placeholder-neutral-400 outline-none"
            aria-label="SiteBook nickname"
          />
          {canContinue || busy ? (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              {busy ? "Opening your SiteBook…" : "Create my SiteBook"}
              {!busy && <ArrowRight className="h-3.5 w-3.5"/>}
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-300 px-5 text-[12px] font-black uppercase tracking-wider text-neutral-500 cursor-not-allowed"
            >
              Type a name to continue
            </button>
          )}
        </div>
      </form>

      {/* Live URL preview + suggestions */}
      <div className={`mt-3 flex flex-wrap items-center gap-2 text-[11.5px] ${variant === "hero" ? "text-white/85" : "text-neutral-600"}`}>
        <span className={variant === "hero" ? "text-white/60" : "text-neutral-500"}>Your URL:</span>
        <span className="font-black">
          thenetworkers.app/<span style={{ color: BRAND_YELLOW }}>{nicknameToSlug(displayName) || "yourname"}</span>
        </span>
      </div>
      <p className={`mt-1 text-[10.5px] ${variant === "hero" ? "text-white/60" : "text-neutral-500"}`}>
        Same installable PWA as merchants. Private by default — only you see the projects inside.
      </p>

      <div className={`mt-2 flex flex-wrap gap-1.5 text-[10px] ${variant === "hero" ? "text-white/70" : "text-neutral-500"}`}>
        <span className={variant === "hero" ? "text-white/50" : "text-neutral-400"}>Try:</span>
        {SUGGESTIONS.slice(1, 5).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setName(s)}
            className={`rounded-full border px-2 py-0.5 font-bold transition ${variant === "hero" ? "border-white/30 text-white/85 hover:border-white/60" : "border-neutral-300 text-neutral-700 hover:border-neutral-500"}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
