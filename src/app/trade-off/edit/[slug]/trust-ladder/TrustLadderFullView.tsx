"use client";

// Full trust-ladder view. Shows every tier laid out with all
// criteria (met + unmet) and direct fix / upgrade CTAs.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Crown, Check, Circle, ArrowRight, Lock, ArrowLeft, Zap, X } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

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
  nextGap:    null | { next: string; missing: TrustResponse["criteria"] };
  progress:   { silver: { met: number; total: number }; gold: { met: number; total: number }; platinum: { met: number; total: number } };
  badgeColor: string;
};

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

export function TrustLadderFullView({ slug }: { slug: string }) {
  const [data, setData]     = useState<TrustResponse | null>(null);
  const [loading, setLoad]  = useState(true);
  const [err, setErr]       = useState<string | null>(null);
  const searchParams        = useSearchParams();
  const router              = useRouter();
  const showBadgePicker     = searchParams.get("badge") === "picker";

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

  const groupedByTier = useMemo(() => {
    if (!data) return null;
    return {
      silver:   data.criteria.filter((c) => c.requiredFor === "silver"),
      gold:     data.criteria.filter((c) => c.requiredFor === "gold"),
      platinum: data.criteria.filter((c) => c.requiredFor === "platinum")
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-neutral-100"/>
        {[1,2,3,4].map((i) => <div key={i} className="mb-4 h-36 animate-pulse rounded-2xl bg-neutral-100"/>)}
      </div>
    );
  }
  if (err || !data || !groupedByTier) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-red-700">Couldn&rsquo;t load the trust ladder. {err && `(${err})`}</p>
      </div>
    );
  }

  const currentIdx = ["bronze","silver","gold","platinum"].indexOf(data.tier);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-6">
      {showBadgePicker && (
        <BadgeColourPicker
          currentColor={data.badgeColor}
          onSaved={(newColor) => {
            setData({ ...data, badgeColor: newColor });
            router.replace(`/trade-off/edit/${slug}/trust-ladder`);
          }}
          onClose={() => router.replace(`/trade-off/edit/${slug}/trust-ladder`)}
        />
      )}

      {/* Back link */}
      <Link href={`/trade-off/edit/${slug}/home`} className="inline-flex w-fit items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
        <ArrowLeft size={12}/> Back to dashboard
      </Link>

      {/* Hero — current tier + score */}
      <header
        className="rounded-2xl border-2 p-5"
        style={{ borderColor: data.badgeColor, background: "linear-gradient(135deg, #FFFBEB 0%, white 100%)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-md"
              style={{ backgroundColor: data.badgeColor, color: data.tierMeta.accentText }}
            >
              <Crown size={32} strokeWidth={2.4}/>
            </div>
            <div>
              <p className="text-[10.5px] font-black uppercase tracking-[0.16em] text-neutral-500">
                Your current tier · {data.score} trust points
              </p>
              <h1 className="text-2xl font-black" style={{ color: BRAND_BLACK }}>
                You&rsquo;re {data.tierMeta.label}
              </h1>
            </div>
          </div>
          {data.tier === "platinum" && (
            <Link
              href={`/api/merchant/trust-ladder/custom-badge/checkout?slug=${slug}`}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white hover:brightness-95"
              style={{ backgroundColor: BRAND_BLACK }}
            >
              Custom badge colour · £2.99
            </Link>
          )}
        </div>
      </header>

      {/* Tier laddder cards */}
      {(["bronze","silver","gold","platinum"] as const).map((tier, i) => {
        const meta   = data.allTiers.find((t) => t.slug === tier)!;
        const isPast    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture  = i > currentIdx;
        const criteria  = tier === "bronze" ? [] : groupedByTier[tier as "silver" | "gold" | "platinum"];

        return (
          <section
            key={tier}
            className="rounded-2xl border-2 bg-white p-5 shadow-sm"
            style={{
              borderColor: isCurrent ? meta.color : isPast ? "#E5E5E5" : "rgba(0,0,0,0.08)",
              opacity:     isFuture ? 0.75 : 1
            }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: meta.color, color: meta.accentText }}
                >
                  {isPast ? <Check size={20} strokeWidth={2.6}/> : isCurrent ? <Crown size={20} strokeWidth={2.4}/> : <Lock size={16}/>}
                </div>
                <div>
                  <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                    {isPast ? "Unlocked" : isCurrent ? "You are here" : "Locked"}
                  </p>
                  <h2 className="text-lg font-black" style={{ color: BRAND_BLACK }}>{meta.label}</h2>
                </div>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700">
                +{meta.bumpSort} algorithmic boost
              </span>
            </div>

            {/* Criteria — only for silver+ */}
            {criteria.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {criteria.map((c) => {
                  const fixUrl = FIX_URL[c.slug]?.(slug) ?? "#";
                  return (
                    <li
                      key={c.slug}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: c.met ? "#BBF7D0" : "rgba(0,0,0,0.08)",
                        backgroundColor: c.met ? "#F0FDF4" : "white"
                      }}
                    >
                      {c.met ? (
                        <Check size={14} className="flex-none text-green-700" strokeWidth={2.6}/>
                      ) : (
                        <Circle size={12} className="flex-none text-neutral-400"/>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-black text-neutral-900">{c.label}</p>
                        {c.hint && <p className="text-[10.5px] text-neutral-500">{c.hint}</p>}
                      </div>
                      <span className="hidden rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-neutral-500 sm:inline">
                        +{c.points}
                      </span>
                      {!c.met && (
                        <div className="flex items-center gap-1">
                          <Link
                            href={fixUrl}
                            className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider hover:bg-neutral-50"
                            style={{ borderColor: "rgba(0,0,0,0.15)" }}
                          >
                            Fix it <ArrowRight size={10}/>
                          </Link>
                          {c.payToSkip && (
                            <Link
                              href={`/api/merchant/trust-ladder/skip-queue/checkout?slug=${slug}&criterion=${c.slug}`}
                              className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:brightness-95"
                              style={{ backgroundColor: BRAND_BLACK }}
                            >
                              <Zap size={9}/> Skip £{(c.payToSkip.priceGbp / 100).toFixed(2)}
                            </Link>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Perks — always visible so merchant sees the reward */}
            <div className="rounded-lg bg-neutral-50 p-3">
              <p className="mb-1.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                Perks
              </p>
              <ul className="flex flex-col gap-0.5">
                {meta.perks.map((p, j) => (
                  <li key={j} className="text-[12px] text-neutral-800">
                    <span className="mr-1.5 text-neutral-400">·</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}

      {/* Legal footnote */}
      <p className="mt-2 text-[10.5px] text-neutral-500">
        Trust ladder recomputed nightly. Reviews, subscriptions and verification changes update your tier immediately.
        We never sell your position — you can only earn tier by meeting the criteria. Two paid options exist:
        Skip the manual insurance queue (£4.99 one-time) and unlock custom badge colour (£2.99 one-time, Platinum only).
      </p>
    </div>
  );
}

const PRESET_COLORS = [
  "#0A0A0A", "#FFB300", "#166534", "#B91C1C", "#1E40AF",
  "#7C2D12", "#4C1D95", "#9F1239", "#0F766E", "#4A5568"
];

function BadgeColourPicker({
  currentColor,
  onSaved,
  onClose
}: {
  currentColor: string;
  onSaved: (color: string) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string>(currentColor || "#FFB300");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res  = await fetch("/api/merchant/trust-ladder/custom-badge/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ color: picked })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      onSaved(picked);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 bg-white p-5 shadow-xl" style={{ borderColor: picked }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
          Pick your custom badge colour
        </p>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-neutral-100">
          <X size={16}/>
        </button>
      </div>
      <div className="mb-4 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow"
          style={{ backgroundColor: picked, color: "#fff" }}
        >
          <Crown size={12} strokeWidth={2.6}/> Platinum
        </span>
        <span className="text-[11.5px] text-neutral-600">
          This is how your badge will appear on every canteen + yard card.
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setPicked(c)}
            className="h-9 w-9 rounded-full border-2 transition hover:scale-110"
            style={{ backgroundColor: c, borderColor: picked === c ? "#0A0A0A" : "rgba(0,0,0,0.10)" }}
            aria-label={`Set colour ${c}`}
          />
        ))}
      </div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Custom hex</label>
        <input
          type="color"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="h-9 w-14 cursor-pointer rounded border"
        />
        <input
          type="text"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="h-9 w-28 rounded border px-2 font-mono text-[12px] uppercase"
          placeholder="#000000"
        />
      </div>
      {err && <p className="mb-2 text-[11px] text-red-700">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          {saving ? "Saving…" : "Save colour"}
        </button>
        <button
          onClick={onClose}
          className="inline-flex h-10 items-center rounded-full border px-4 text-[11px] font-black uppercase tracking-wider hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
