"use client";

// Facebook-style reaction bar for a Yard post. Six emojis: like, fire,
// strong, lol, wow, dislike. One reaction per member per post. Tapping
// the active reaction removes it; tapping a different reaction switches.
//
// Posts the change to /api/trade-off/yard/posts/:id/reactions and shows
// an optimistic count update so the bar feels instant.
//
// Reactor identity comes from URL query (?slug=&token=) — same auth as
// the rest of the dashboard. Builder-grade trades skip the paid gate
// at the API; un-authed visitors get a polite prompt to upgrade.

import { useEffect, useMemo, useState } from "react";
import {
  YARD_REACTION_EMOJI,
  YARD_REACTION_KINDS,
  YARD_REACTION_LABEL,
  type ReactionCounts
} from "@/lib/yardReactions";
import type { YardReactionKind } from "@/lib/supabase";

export function YardReactionBar({
  postId,
  initialCounts
}: {
  postId: string;
  initialCounts: ReactionCounts;
}) {
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts);
  const [mine, setMine] = useState<YardReactionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read slug+token from URL on mount so the bar knows whether to
  // surface as 'tap to react' or 'sign-in nudge'.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    setAuthed(Boolean(slug && token));
  }, []);

  // Only sum reactions whose kind is still rendered in the bar
  // (currently just like + dislike). Legacy fire / strong / lol / wow
  // counts in the DB stay valid but aren't tallied in the visible
  // "X reactions" total, so the maths matches what the user can see.
  const total = useMemo(
    () =>
      YARD_REACTION_KINDS.reduce(
        (sum, kind) => sum + (counts[kind] ?? 0),
        0
      ),
    [counts]
  );

  async function react(kind: YardReactionKind) {
    if (busy) return;
    if (!authed) {
      setError("Sign in or unlock The Yard to react.");
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug") ?? "";
    const token = sp.get("token") ?? "";

    const wasActive = mine === kind;
    const next = wasActive ? null : kind;
    setBusy(true);
    setError(null);

    // Optimistic update.
    setCounts((prev) => {
      const copy: ReactionCounts = { ...prev };
      if (mine) copy[mine] = Math.max(0, (copy[mine] ?? 0) - 1);
      if (next) copy[next] = (copy[next] ?? 0) + 1;
      return copy;
    });
    setMine(next);

    try {
      const method = next ? "POST" : "DELETE";
      const body = next ? { slug, token, kind: next } : { slug, token };
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(postId)}/reactions`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!res.ok) {
        // Rollback optimistic update.
        setCounts((prev) => {
          const copy: ReactionCounts = { ...prev };
          if (next) copy[next] = Math.max(0, (copy[next] ?? 0) - 1);
          if (mine) copy[mine] = (copy[mine] ?? 0) + 1;
          return copy;
        });
        setMine(mine);
        const txt = await res.text();
        setError(`Couldn't save (${res.status}): ${txt.slice(0, 80)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {YARD_REACTION_KINDS.map((k) => {
        const n = counts[k] ?? 0;
        const active = mine === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => react(k)}
            disabled={busy}
            aria-pressed={active}
            aria-label={YARD_REACTION_LABEL[k]}
            title={YARD_REACTION_LABEL[k]}
            className="inline-flex h-8 items-center gap-1 rounded-full border bg-white px-2 text-[12px] font-extrabold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={
              active
                ? { borderColor: "#FFB300", color: "#0A0A0A", background: "#FFF7E0" }
                : { borderColor: "#e5e5e5", color: "#525252" }
            }
          >
            <span aria-hidden="true">{YARD_REACTION_EMOJI[k]}</span>
            {n > 0 && <span>{n}</span>}
          </button>
        );
      })}
      {total > 0 && (
        <span className="ml-1 text-[11px] font-bold text-neutral-400">
          {total} {total === 1 ? "reaction" : "reactions"}
        </span>
      )}
      {error && (
        <span className="basis-full text-[11px] font-bold text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

export default YardReactionBar;
