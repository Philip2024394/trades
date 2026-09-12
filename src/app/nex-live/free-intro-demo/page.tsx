// src/app/nex-live/free-intro-demo/page.tsx
//
// NEX LIVE · Phase 3 · Free-user Live intro · experience-test route
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 3
//
// PURPOSE (§61 experience-test discipline)
//   Renders the FreeContentLiveIntro against a real Tonight fixture
//   picked by the decision engine. Anchored under /nex-live/ so the
//   surface is discoverable without leaking into normal user flow.
//
// TRUTH RULE (§4 · §17 · §41)
//   Uses real Tonight fixtures · zero synthetic clips · when the
//   fixture roster is empty, the page renders an honest empty state
//   explaining what would happen if a clip were available.
//
// This is a THIN client page. The decision engine + the intro
// component do the substantive work.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FreeContentLiveIntro } from "@/components/nex-app/live/FreeContentLiveIntro";
import {
  decideFreeIntro,
  type FreeIntroCandidate,
  type FreeIntroDecision,
  type UserTier,
  type IntroFrequency,
} from "@/lib/nex/live/free-content-intro-policy";

// Matches /api/nex-live/tonight items shape (only fields we need)
type TonightApiItem = {
  media_id: string;
  entity_name: string | null;
  city_slug: string | null;
  title: string | null;
  playback_url: string | null;
  poster_url: string | null;
  is_mock_fixture: boolean;
};

const DEMO_CITY = "yogyakarta";

export default function FreeIntroDemoPage() {
  const [userTier, setUserTier] = useState<UserTier>("FREE");
  const [frequency, setFrequency] = useState<IntroFrequency>("HIGH");
  const [candidates, setCandidates] = useState<FreeIntroCandidate[]>([]);
  const [decision, setDecision] = useState<FreeIntroDecision | null>(null);
  const [open, setOpen] = useState(false);
  const [introShownThisSession, setIntroShownThisSession] = useState(false);
  const [continued, setContinued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("city", DEMO_CITY);
        params.set("status", "LIVE_NOW,STARTING_SOON,TONIGHT");
        params.set("limit", "5");
        const r = await fetch(`/api/nex-live/tonight?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        const items: TonightApiItem[] = Array.isArray(j?.items) ? j.items : [];
        setCandidates(items.map((it) => ({
          media_id: it.media_id,
          entity_name: it.entity_name ?? "Unknown entity",
          city_label: it.city_slug,
          title: it.title,
          playback_url: it.playback_url,
          poster_url: it.poster_url,
          duration_hint_sec: 10,
          is_mock_fixture: it.is_mock_fixture,
        })));
      } catch {
        if (!cancelled) setCandidates([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const evaluate = useCallback(() => {
    const d = decideFreeIntro({
      user_tier: userTier,
      intro_frequency: frequency,
      last_intro_shown_at_ms: null,
      now_ms: Date.now(),
      reduced_motion: false,
      intro_shown_this_session: introShownThisSession,
      candidates,
    });
    setDecision(d);
    if (d.action === "SHOW") {
      setOpen(true);
      setIntroShownThisSession(true);
    }
    return d;
  }, [userTier, frequency, candidates, introShownThisSession]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-neutral-950 text-white p-6">
      <div className="mb-4 text-[10px] uppercase tracking-widest text-white/50">
        Experience-test route · §61
      </div>
      <h1 className="text-2xl font-semibold mb-2">Free Live intro demo</h1>
      <p className="text-sm text-white/60 mb-6">
        Simulates a free user about to consume free content. The decision
        engine gates whether a short Live clip is shown first.
      </p>

      <section className="mb-6 rounded-xl border border-white/10 p-4">
        <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">User</div>
        <div className="flex gap-2 mb-3">
          {(["FREE", "PAID"] as UserTier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setUserTier(t)}
              className={`px-3 py-1.5 rounded-full text-xs ${userTier === t ? "bg-white text-black" : "bg-white/10"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Frequency</div>
        <div className="flex gap-2">
          {(["OFF", "LOW", "MEDIUM", "HIGH"] as IntroFrequency[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={`px-3 py-1.5 rounded-full text-xs ${frequency === f ? "bg-white text-black" : "bg-white/10"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-white/10 p-4">
        <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Fixtures loaded</div>
        <div className="text-sm mb-2">
          {candidates.length} candidate{candidates.length === 1 ? "" : "s"} from
          <code className="mx-1 px-1 py-0.5 rounded bg-white/10 text-[11px]">/api/nex-live/tonight?city={DEMO_CITY}</code>
        </div>
        {candidates.length === 0 && (
          <div className="text-[11px] text-white/50">
            Honest empty state · seed the mock fixture roster to populate this list.
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={evaluate}
        className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold hover:bg-orange-600"
        data-testid="nex-live-free-intro-evaluate"
      >
        Run decision + attempt to show intro
      </button>

      {decision && (
        <div className="mt-4 rounded-xl border border-white/10 p-3 text-xs" data-testid="nex-live-free-intro-decision">
          <div className="text-white/60 mb-1">Decision</div>
          <pre className="whitespace-pre-wrap break-words text-white/90">{JSON.stringify(decision, null, 2)}</pre>
        </div>
      )}

      {continued && (
        <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          Continue was tapped · free content would now play.
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/nex-live" className="text-white/50 underline text-xs">
          ← Back to /nex-live
        </Link>
      </div>

      <FreeContentLiveIntro
        open={open}
        clip={decision?.action === "SHOW" ? decision.clip : null}
        onContinue={() => { setOpen(false); setContinued(true); }}
        onWatchLive={() => { setOpen(false); }}
        onClose={() => { setOpen(false); }}
      />
    </div>
  );
}
