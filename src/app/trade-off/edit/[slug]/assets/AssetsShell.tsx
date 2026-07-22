"use client";

// AssetsShell — the merchant-facing free-collateral generator.
// Tabs by kind (Site Poster · Google Review · Business Card).
// Each tab: template picker → headline → generate → download PDF.
//
// Analytics chart (scans + downloads) is Pro-tier gated. Free tier
// sees a blurred preview + "Upgrade to Pro to see who's scanning
// your posters" CTA — proven revenue lever.

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Printer, Download, Sparkles, TrendingUp,
  QrCode, Star, IdCard, Zap, Crown, Lock, Loader2, X, Check
} from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BRAND_GREEN  = "#166534";

type AssetKind = "site_poster" | "google_review" | "business_card";

type Asset = {
  id:                       string;
  kind:                     AssetKind;
  template_slug:            string;
  headline:                 string | null;
  refresh_number:           number;
  created_at:               string;
  next_free_refresh_at:     string;
  footer_removed_paid_at:   string | null;
  instant_refresh_paid_at:  string | null;
  scan_count:               number;
  download_count:           number;
};

type Template = {
  slug:        string;
  kind:        AssetKind;
  label:       string;
  bgColor:     string;
  accentColor: string;
  textColor:   string;
};

// Duplicated from src/lib/assetEngine.ts — kept in sync as the
// merchant preview must render the same colours the PDF prints.
const TEMPLATES: Template[] = [
  { slug: "v1_bold_yellow",  kind: "site_poster",   label: "Bold Yellow",   bgColor: "#0A0A0A", accentColor: "#FFB300", textColor: "#FFFFFF" },
  { slug: "v2_construction", kind: "site_poster",   label: "Construction",  bgColor: "#FFB300", accentColor: "#0A0A0A", textColor: "#0A0A0A" },
  { slug: "v3_iron",         kind: "site_poster",   label: "Iron",          bgColor: "#1F2937", accentColor: "#F97316", textColor: "#F5F5F5" },
  { slug: "v4_chalk",        kind: "site_poster",   label: "Chalk",         bgColor: "#FBF6EC", accentColor: "#166534", textColor: "#0A0A0A" },
  { slug: "v5_hivis",        kind: "site_poster",   label: "Hi-Vis Green",  bgColor: "#166534", accentColor: "#FFB300", textColor: "#FFFFFF" },
  { slug: "v6_brick",        kind: "site_poster",   label: "Brick",         bgColor: "#7C2D12", accentColor: "#FBF6EC", textColor: "#FBF6EC" },
  { slug: "review_v1_stars", kind: "google_review", label: "5-star Light",  bgColor: "#FFFFFF", accentColor: "#FFB300", textColor: "#0A0A0A" },
  { slug: "review_v2_dark",  kind: "google_review", label: "Dark Spotlight", bgColor: "#0A0A0A", accentColor: "#FFB300", textColor: "#FFFFFF" },
  { slug: "card_v1_yellow",  kind: "business_card", label: "Yellow Tab",    bgColor: "#0A0A0A", accentColor: "#FFB300", textColor: "#FFFFFF" },
  { slug: "card_v2_chalk",   kind: "business_card", label: "Chalk Minimal", bgColor: "#FBF6EC", accentColor: "#0A0A0A", textColor: "#0A0A0A" }
];

const KIND_LIST: Array<{ kind: AssetKind; label: string; hint: string; icon: React.ComponentType<{ size?: number }> }> = [
  { kind: "site_poster",   label: "Site Poster",     hint: "Van window · site fence · skip",   icon: Printer  },
  { kind: "google_review", label: "Google Review",   hint: "Ask customers for a Google review", icon: Star     },
  { kind: "business_card", label: "Business Card",   hint: "12-up sheet · print at home",       icon: IdCard   }
];

const DEFAULT_HEADLINES: Record<AssetKind, string> = {
  site_poster:   "SCAN FOR REVIEWS",
  google_review: "Loved our work?",
  business_card: "Scan for quote"
};

export function AssetsShell({ slug }: { slug: string }) {
  const [tab, setTab]         = useState<AssetKind>("site_poster");
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [tplPick, setTplPick] = useState<string>("v1_bold_yellow");
  const [headline, setHead]   = useState<string>("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);

  const templatesForTab = useMemo(() => TEMPLATES.filter((t) => t.kind === tab), [tab]);
  const latestForTab    = useMemo(() => assets.find((a) => a.kind === tab), [assets, tab]);

  useEffect(() => {
    // Snap the template picker to a valid template for the current tab
    if (!templatesForTab.some((t) => t.slug === tplPick)) {
      setTplPick(templatesForTab[0]?.slug ?? "");
    }
  }, [tab, templatesForTab, tplPick]);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/merchant/assets/list", { cache: "no-store" });
        const json = await res.json();
        if (json.ok) setAssets(json.assets as Asset[]);
      } catch {}
    })();
  }, []);

  async function generate() {
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res  = await fetch("/api/merchant/assets/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          kind:          tab,
          template_slug: tplPick,
          headline:      headline || DEFAULT_HEADLINES[tab]
        })
      });
      const json = await res.json();
      if (res.status === 402 && json.error === "cooldown_active") {
        setErr(`You can refresh for free on ${new Date(json.next_free_refresh_at).toLocaleDateString()}. Or skip the cooldown for £1.99.`);
        return;
      }
      if (!res.ok || !json.ok) throw new Error(json.error ?? "generate_failed");
      setAssets((prev) => [json.asset as Asset, ...prev.filter((a) => a.id !== json.asset.id)]);
      setNotice("Your asset is ready. Tap Download PDF.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "generate_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-6">
      {/* Back + heading */}
      <div>
        <Link href={`/trade-off/edit/${slug}/home`} className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={12}/> Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-black" style={{ color: BRAND_BLACK }}>Free print assets</h1>
        <p className="text-[12.5px] text-neutral-600">Site posters, Google review cards, business cards — built from your canteen data. Print anywhere.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl bg-neutral-100 p-1">
        {KIND_LIST.map(({ kind, label, hint, icon: Icon }) => {
          const active = tab === kind;
          const asset  = assets.find((a) => a.kind === kind);
          return (
            <button
              key={kind}
              onClick={() => setTab(kind)}
              className="flex-1 rounded-xl px-3 py-2 text-left transition"
              style={{ backgroundColor: active ? "white" : "transparent", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
            >
              <div className="flex items-center gap-2">
                <Icon size={14}/>
                <span className="text-[12.5px] font-black text-neutral-900">{label}</span>
                {asset && (
                  <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-black text-green-800">v{asset.refresh_number}</span>
                )}
              </div>
              <p className="mt-0.5 text-[10.5px] text-neutral-500">{hint}</p>
            </button>
          );
        })}
      </div>

      {/* Generator */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          <Sparkles size={11} className="mr-1 inline"/> Generate your {KIND_LIST.find((k) => k.kind === tab)?.label}
        </h2>

        {/* Template picker */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Style</label>
          <div className="flex flex-wrap gap-2">
            {templatesForTab.map((t) => {
              const active = tplPick === t.slug;
              return (
                <button
                  key={t.slug}
                  onClick={() => setTplPick(t.slug)}
                  className="relative overflow-hidden rounded-lg border-2 p-1 transition hover:scale-[1.02]"
                  style={{ borderColor: active ? BRAND_BLACK : "rgba(0,0,0,0.10)" }}
                  aria-pressed={active}
                >
                  <div
                    className="flex h-16 w-24 items-center justify-center rounded"
                    style={{ backgroundColor: t.bgColor, color: t.textColor }}
                  >
                    <div className="h-8 w-8 rounded" style={{ backgroundColor: t.accentColor }}/>
                  </div>
                  <p className="mt-1 text-[10px] font-black text-neutral-700">{t.label}</p>
                  {active && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_BLACK, color: "white" }}>
                      <Check size={10} strokeWidth={3}/>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Headline input */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            Headline <span className="text-neutral-400">· optional</span>
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHead(e.target.value.slice(0, 60))}
            placeholder={DEFAULT_HEADLINES[tab]}
            className="w-full rounded-lg border px-3 py-2 text-[13px]"
          />
          <p className="mt-1 text-[10.5px] text-neutral-500">Max 60 characters. Blank = we use "{DEFAULT_HEADLINES[tab]}".</p>
        </div>

        {err && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-[12px] text-red-800">{err}</div>
        )}
        {notice && (
          <div className="mb-3 rounded-lg bg-green-50 p-3 text-[12px] text-green-800">{notice}</div>
        )}

        {/* Generate CTA */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={generate}
            disabled={busy || !tplPick}
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            {busy ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            {latestForTab ? `Refresh (v${latestForTab.refresh_number + 1})` : "Generate"}
          </button>

          {latestForTab && (
            <a
              href={`/api/merchant/assets/download?id=${latestForTab.id}&format=pdf`}
              className="inline-flex h-11 items-center gap-2 rounded-full border-2 px-5 text-[12px] font-black uppercase tracking-wider hover:bg-neutral-50"
              style={{ borderColor: BRAND_BLACK, color: BRAND_BLACK }}
            >
              <Download size={13}/> Download PDF
            </a>
          )}
        </div>
      </section>

      {/* Analytics — scans + downloads */}
      {latestForTab && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
              <TrendingUp size={11} className="mr-1 inline"/> Reach · this version
            </h2>
            <span className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
              v{latestForTab.refresh_number} · created {new Date(latestForTab.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatBlock icon={<QrCode size={13}/>} label="QR scans"    value={latestForTab.scan_count}/>
            <StatBlock icon={<Download size={13}/>} label="Downloads" value={latestForTab.download_count}/>
            <StatBlock icon={<Sparkles size={13}/>} label="Days live" value={Math.max(1, Math.floor((Date.now() - new Date(latestForTab.created_at).getTime()) / 86400000))}/>
          </div>
          <p className="mt-3 text-[10.5px] text-neutral-500">
            <Lock size={10} className="mr-1 inline"/> Pro tier unlocks scan location, device type + daily trend chart. <Link href="/trade-off/pricing" className="font-black text-neutral-800 underline">Upgrade →</Link>
          </p>
        </section>
      )}

      {/* Upsell strip */}
      <section className="rounded-2xl border-2 p-4" style={{ borderColor: BRAND_YELLOW, background: "linear-gradient(135deg, #FFFBEB 0%, #FFF5D6 100%)" }}>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "#7A5B00" }}>
          <Crown size={11} className="mr-1 inline"/> Small unlocks
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <UpsellPill
            icon={<X size={13}/>}
            title="Remove footer — £2.99"
            hint="Hides the 'Powered by The Networkers' line on this asset"
            href={`/api/merchant/assets/upsell/footer/checkout?asset=${latestForTab?.id ?? ""}`}
            disabled={!latestForTab || !!latestForTab.footer_removed_paid_at}
            done={!!latestForTab?.footer_removed_paid_at}
          />
          <UpsellPill
            icon={<Zap size={13}/>}
            title="Instant refresh — £1.99"
            hint="Skip the 30-day cooldown once"
            href={`/api/merchant/assets/upsell/refresh/checkout?asset=${latestForTab?.id ?? ""}`}
            disabled={!latestForTab || !!latestForTab.instant_refresh_paid_at}
            done={!!latestForTab?.instant_refresh_paid_at}
          />
        </div>
      </section>

      {/* All history */}
      {assets.filter((a) => a.kind === tab).length > 1 && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Past versions
          </h2>
          <ul className="divide-y">
            {assets.filter((a) => a.kind === tab).slice(1).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-[12px]">
                <div>
                  <span className="font-black text-neutral-900">v{a.refresh_number}</span>
                  <span className="ml-2 text-neutral-500">{new Date(a.created_at).toLocaleDateString()}</span>
                  <span className="ml-2 text-neutral-500">· {a.scan_count} scans · {a.download_count} DL</span>
                </div>
                <a
                  href={`/api/merchant/assets/download?id=${a.id}&format=pdf`}
                  className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider hover:bg-neutral-50"
                >
                  <Download size={10}/> PDF
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex items-center gap-1 text-neutral-500">{icon}<span className="text-[10.5px] font-black uppercase tracking-wider">{label}</span></div>
      <p className="text-2xl font-black tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function UpsellPill({ icon, title, hint, href, disabled, done }: {
  icon: React.ReactNode; title: string; hint: string; href: string; disabled: boolean; done: boolean;
}) {
  const cls = "flex items-center gap-2 rounded-lg border p-3 text-left transition";
  if (done) return (
    <div className={cls + " opacity-60"} style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: "#F0FDF4" }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white"><Check size={13}/></span>
      <div>
        <p className="text-[12px] font-black text-neutral-900">{title.split("—")[0]}<span className="text-green-700"> · Unlocked</span></p>
        <p className="text-[10.5px] text-neutral-600">Applied to this asset</p>
      </div>
    </div>
  );
  if (disabled) return (
    <div className={cls + " opacity-40"} style={{ borderColor: "rgba(0,0,0,0.10)" }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200">{icon}</span>
      <div>
        <p className="text-[12px] font-black text-neutral-500">{title}</p>
        <p className="text-[10.5px] text-neutral-500">{hint}</p>
      </div>
    </div>
  );
  return (
    <a href={href} className={cls + " hover:brightness-95"} style={{ borderColor: BRAND_YELLOW, backgroundColor: "white" }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>{icon}</span>
      <div>
        <p className="text-[12px] font-black text-neutral-900">{title}</p>
        <p className="text-[10.5px] text-neutral-600">{hint}</p>
      </div>
    </a>
  );
}
