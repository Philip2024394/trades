"use client";

// TrustLadderPanel — the ambition driver on the merchant launchpad.
// Shows current tier badge, points score, next-tier gap with
// direct action buttons for each missing criterion.
//
// Monetisation baked in:
//   • Missing "Pro subscription" criterion → button to /trade-off/pricing
//   • Missing "insurance verified" criterion → Skip queue for £4.99
//   • Platinum-only "custom badge" upsell → £2.99 one-time
//
// Every unmet criterion is a small task with a direct link that
// takes the merchant to the exact place they can fix it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Check, Circle, ArrowRight, Sparkles } from "lucide-react";

const BRAND_BLACK = "#0A0A0A";

type TrustResponse = {
  ok:         true;
  tier:       "bronze" | "silver" | "gold" | "platinum";
  score:      number;
  tierMeta:   { label: string; color: string; accentText: string; bumpSort: number; perks: string[] };
  allTiers:   Array<{ slug: string; label: string; color: string; accentText: string; bumpSort: number; perks: string[] }>;
  criteria:   Array<{
    slug:        string;
    label:       string;
    hint?:       string;
    requiredFor: "silver" | "gold" | "platinum";
    points:      number;
    met:         boolean;
    valueSnapshot?: unknown;
    payToSkip?:  { priceGbp: number; skus: string };
  }>;
  nextGap: null | {
    next:    "silver" | "gold" | "platinum";
    missing: TrustResponse["criteria"];
  };
  progress: {
    silver:   { met: number; total: number };
    gold:     { met: number; total: number };
    platinum: { met: number; total: number };
  };
  badgeColor: string;
};

// Direct route for each criterion — where the merchant fixes it.
const FIX_URL: Record<string, (slug: string) => string> = {
  profile_complete:     (s) => `/trade-off/edit/${s}/profile`,
  whatsapp_verified:    (s) => `/trade-off/edit/${s}/profile#whatsapp`,
  min_photos_3:         (s) => `/trade-off/edit/${s}/profile#photos`,
  min_reviews_1:        (s) => `/trade-off/edit/${s}/sharing`,
  min_reviews_10:       (s) => `/trade-off/edit/${s}/sharing`,
  min_reviews_25:       (s) => `/trade-off/edit/${s}/sharing`,
  min_avg_rating_4_0:   (s) => `/trade-off/edit/${s}/sharing`,
  min_avg_rating_4_5:   (s) => `/trade-off/edit/${s}/sharing`,
  days_active_30:       () => "#",
  tier_pro_sub:         () => "/trade-off/pricing?highlight=app_paid",
  tier_business_sub:    () => "/trade-off/pricing?highlight=verified",
  insurance_verified:   () => "/trade-off/verified?doc=insurance",
  trade_body_verified:  () => "/trade-off/verified?doc=trade-body"
};

export function TrustLadderPanel({ slug }: { slug: string }) {
  const [data, setData]     = useState<TrustResponse | null>(null);
  const [loading, setLoad]  = useState(true);
  const [err, setErr]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch("/api/merchant/trust-ladder", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
        if (!cancelled) setData(json as TrustResponse);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "load_failed");
      } finally {
        if (!cancelled) setLoad(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading && !data) {
    return <div className="h-32 animate-pulse rounded-2xl bg-neutral-100"/>;
  }
  if (err || !data) {
    return null;   // fail silently on the launchpad — not critical
  }

  const currentTierIdx = ["bronze","silver","gold","platinum"].indexOf(data.tier);

  return (
    <section
      className="rounded-2xl border-2 p-4 shadow-sm"
      style={{ borderColor: data.badgeColor, backgroundColor: "white" }}
    >
      {/* Header — current tier + score */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl shadow"
            style={{ backgroundColor: data.badgeColor, color: data.tierMeta.accentText }}
          >
            <Crown size={22} strokeWidth={2.4}/>
          </div>
          <div>
            <p className="text-[10.5px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Trust ladder · {data.score} pts
            </p>
            <p className="text-lg font-black" style={{ color: BRAND_BLACK }}>
              You&rsquo;re {data.tierMeta.label}
            </p>
          </div>
        </div>
        <Link
          href={`/trade-off/edit/${slug}/trust-ladder`}
          className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider hover:bg-neutral-50"
        >
          Full ladder →
        </Link>
      </div>

      {/* Tier progress row — 4 chips */}
      <div className="mb-4 flex gap-1">
        {data.allTiers.map((t, i) => (
          <div
            key={t.slug}
            className="flex-1 rounded-md px-2 py-1.5 text-center"
            style={{
              backgroundColor: i <= currentTierIdx ? t.color : "#F5F5F5",
              color:           i <= currentTierIdx ? t.accentText : "#999",
              opacity:         i > currentTierIdx ? 0.55 : 1
            }}
          >
            <p className="text-[10px] font-black uppercase tracking-wider">
              {i <= currentTierIdx ? "✓ " : ""}{t.label.split(" ")[0]}
            </p>
          </div>
        ))}
      </div>

      {/* Next tier gap — actionable list */}
      {data.nextGap ? (
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-600">
            <Sparkles size={11} className="mr-1 inline"/>
            {data.nextGap.missing.length} step{data.nextGap.missing.length === 1 ? "" : "s"} to <span style={{ color: data.allTiers.find((t) => t.slug === data.nextGap!.next)?.color }}>{data.nextGap.next}</span>
          </p>
          <ul className="flex flex-col gap-1.5">
            {data.nextGap.missing.slice(0, 4).map((c) => {
              const fixUrl = FIX_URL[c.slug]?.(slug) ?? "#";
              return (
                <li key={c.slug} className="flex items-center gap-2">
                  <Circle size={11} strokeWidth={2} className="text-neutral-400"/>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-neutral-900">{c.label}</p>
                    {c.hint && <p className="text-[10.5px] text-neutral-500">{c.hint}</p>}
                  </div>
                  <Link
                    href={fixUrl}
                    className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider hover:bg-white"
                    style={{ borderColor: "rgba(0,0,0,0.10)" }}
                  >
                    {c.payToSkip ? `Skip £${(c.payToSkip.priceGbp / 100).toFixed(2)}` : "Fix it"} <ArrowRight size={10}/>
                  </Link>
                </li>
              );
            })}
          </ul>
          {data.nextGap.missing.length > 4 && (
            <p className="mt-2 text-[10.5px] text-neutral-500">
              And {data.nextGap.missing.length - 4} more —{" "}
              <Link href={`/trade-off/edit/${slug}/trust-ladder`} className="font-black text-neutral-700 underline">see all →</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="flex items-center gap-2 text-[12px] font-black text-neutral-800">
            <Check size={13} className="text-green-700"/>
            You&rsquo;re at the top of the ladder. Every perk unlocked.
          </p>
        </div>
      )}

      {/* Current tier perks — subtle "here's what you get" */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-700">
          Perks you have as {data.tierMeta.label} →
        </summary>
        <ul className="mt-2 space-y-1 pl-4">
          {data.tierMeta.perks.map((p, i) => (
            <li key={i} className="text-[11.5px] text-neutral-700">
              <span className="mr-1 text-neutral-400">·</span>{p}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
