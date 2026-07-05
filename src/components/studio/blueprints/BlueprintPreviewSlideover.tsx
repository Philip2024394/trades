"use client";

// Blueprint preview slide-over.
//
// PRD §5.1 · §6.1. Fetches a live-renderable StudioLayoutJson from
// /api/studio/blueprints/[id]/preview-layout and pipes it through the
// SAME StudioLiveShell that renders published storefronts. This means
// the preview is WYSIWYG — no separate outline view, no drift.
//
// Viewport toggle: mobile 375 / tablet 768 / desktop 1280. We scale
// the rendered canvas down to fit the slide-over while preserving the
// design at true breakpoint width.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import { StudioLiveShell } from "@/components/studio/StudioLiveShell";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import type { MerchantData } from "@/lib/studio/sectionTypes";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const NEUTRAL = "#525252";

type BlueprintDetail = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  trades: string[];
  outcomes: string[];
  variant: string;
  score: {
    conversion: number;
    seo: number;
    trust: number;
    mobile: number;
    accessibility: number;
    speed: number;
    brandConsistency?: number;
  };
  requiredCredentials: string[];
  suggestedApps: string[];
  compliance: string[];
  browserCard: {
    oneLiner: string;
    benefits: string[];
    priceLabel: string;
    estimatedBuildMinutes: number;
  };
  layout: Record<string, unknown[]>;
};

type ViewportKey = "mobile" | "van-screen" | "tablet" | "desktop";
const VIEWPORT_WIDTH: Record<ViewportKey, number> = {
  mobile: 375,
  // Landscape phone in dashboard cradle — 812 x 375. Sim the way
  // customers on-site see the merchant's page from their van.
  "van-screen": 812,
  tablet: 768,
  desktop: 1280
};
const VIEWPORT_HEIGHT: Partial<Record<ViewportKey, number>> = {
  "van-screen": 375
};
const VIEWPORT_LABEL: Record<ViewportKey, string> = {
  mobile: "mobile",
  "van-screen": "van dashboard",
  tablet: "tablet",
  desktop: "desktop"
};

// Merchant data placeholder used during preview. Section renderers
// fall back to config values or "your business" copy where fields are
// blank — same as when a new merchant hasn't filled anything yet.
const PREVIEW_MERCHANT: MerchantData = {
  merchantId: "preview",
  slug: "preview",
  merchantName: "Your business",
  city: "Your area",
  whatsappHref: null,
  brandName: "Your brand",
  domain: {}
};

export function BlueprintPreviewSlideover({
  slug,
  onClose,
  onInstall,
  installing
}: {
  slug: string | null;
  onClose: () => void;
  onInstall: (slug: string) => void;
  installing: boolean;
}) {
  const [detail, setDetail] = useState<BlueprintDetail | null>(null);
  const [layout, setLayout] = useState<StudioLayoutJson | null>(null);
  const [viewport, setViewport] = useState<ViewportKey>("mobile");
  const [pageId, setPageId] = useState<string>("home");
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  useEffect(() => {
    if (!slug) {
      setDetail(null);
      setLayout(null);
      setError(null);
      setPageId("home");
      setViewport("mobile");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithRetry(`/api/studio/blueprints/${slug}`);
        const json = (await res.json()) as
          | { ok: true; blueprint: BlueprintDetail }
          | { ok: false; error: string };
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error);
        setDetail(json.blueprint);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message ?? "load-failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Load the built layout whenever slug + pageId change.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithRetry(
          `/api/studio/blueprints/${slug}/preview-layout?page=${encodeURIComponent(pageId)}`
        );
        const json = (await res.json()) as
          | { ok: true; layout: StudioLayoutJson }
          | { ok: false; error: string };
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error);
        setLayout(json.layout);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message ?? "layout-load-failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, pageId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (slug) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slug, onClose]);

  // Compute canvas scale so the true-width breakpoint fits inside the
  // available container width.
  //
  // Mobile + van-screen viewports render at TRUE 1:1 — shrinking a
  // mobile viewport just makes text look cramped and misrepresents how
  // the site actually renders on a real phone. If the panel is narrower
  // than the phone frame, the outer container gets horizontal scroll.
  //
  // Tablet + desktop viewports still scale down to fit — 1280px would
  // never fit inside a preview slideover panel otherwise.
  useEffect(() => {
    function updateScale() {
      const container = canvasContainerRef.current;
      if (!container) return;
      if (viewport === "mobile" || viewport === "van-screen") {
        setCanvasScale(1);
        return;
      }
      const availableWidth = container.clientWidth - 32; // padding
      const target = VIEWPORT_WIDTH[viewport];
      const scale = Math.min(1, availableWidth / target);
      setCanvasScale(scale);
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [viewport, slug]);

  const pages = useMemo(
    () => (detail ? Object.keys(detail.layout) : []),
    [detail]
  );

  if (!slug) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Blueprint preview"
    >
      <div
        className="flex h-full w-full max-w-[1200px] flex-col overflow-hidden bg-neutral-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <p
              className="text-[9px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              Preview
            </p>
            <h2 className="mt-1 truncate text-[18px] font-extrabold text-neutral-900">
              {detail?.name ?? slug}
            </h2>
            {detail && (
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {detail.tagline}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex h-10 items-center rounded-xl border border-neutral-300 bg-white px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>
            <button
              type="button"
              onClick={() => onInstall(slug)}
              disabled={installing}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:opacity-40"
              style={{ background: YELLOW }}
            >
              {installing ? "Installing…" : "Use this blueprint"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Sub-header — pages + viewport switch */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-6 py-3">
          {pages.length > 1 && (
            <>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Page
              </label>
              <select
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-[12px] font-bold outline-none focus:border-neutral-900"
              >
                {pages.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="ml-auto flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 p-1">
            {(["mobile", "van-screen", "tablet", "desktop"] as ViewportKey[]).map((v) => {
              const on = viewport === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewport(v)}
                  className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest transition"
                  style={{
                    background: on ? YELLOW : "transparent",
                    color: on ? "#0A0A0A" : NEUTRAL
                  }}
                >
                  {VIEWPORT_LABEL[v]} · {VIEWPORT_WIDTH[v]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 gap-4 overflow-hidden p-4">
          {/* Preview canvas — mobile viewport renders 1:1. Only vertical
              scroll on the OUTER column; the phone frame itself never
              scrolls horizontally (sections are clipped at their own
              overflow-hidden). If the panel is narrower than the phone
              frame, the frame simply overflows — the user resizes their
              window if they want to see the full frame. */}
          <div
            ref={canvasContainerRef}
            className="flex flex-1 min-w-0 flex-col items-center overflow-y-auto overflow-x-hidden"
          >
            {error && (
              <p className="mt-8 self-start rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
                {error}
              </p>
            )}
            {!error && (!detail || !layout) && (
              <p className="mt-10 self-start text-[13px] text-neutral-500">
                Rendering preview…
              </p>
            )}
            {detail && (
              <div
                className="my-2 origin-top overflow-hidden rounded-[24px] bg-neutral-900 shadow-xl ring-1 ring-neutral-800"
                style={{
                  width: VIEWPORT_WIDTH[viewport] + 4, // 2px bezel each side
                  transform: `scale(${canvasScale})`,
                  transformOrigin: "top center",
                  transition: "transform 240ms cubic-bezier(0.4,0,0.2,1)",
                  marginBottom: `calc(${(1 - canvasScale) * -100}vh)`,
                  padding: 2
                }}
              >
                <div className="flex h-5 items-center justify-center bg-neutral-900 text-[9px] font-bold uppercase tracking-widest text-white/60">
                  {VIEWPORT_LABEL[viewport]} · {VIEWPORT_WIDTH[viewport]}px
                  {viewport === "van-screen" && (
                    <span className="ml-2 opacity-60">· dashboard cradle sim</span>
                  )}
                </div>
                {/* IFRAME preview — CRITICAL for correct responsive rendering.
                    The iframe has its OWN viewport width (375 / 768 / 1280)
                    so Tailwind sm/md/lg breakpoints trigger at the correct
                    thresholds. Rendering StudioLiveShell inline read window
                    width (usually 1400px+ on desktop) so every `sm:` class
                    fired even inside a 375px div — meaning the "mobile"
                    preview actually rendered the desktop layout crammed
                    narrow. Iframes solve this cleanly. Standard practice:
                    Storybook, Chromatic, Loveable all use this pattern. */}
                <iframe
                  key={`${slug}-${pageId}-${viewport}`}
                  src={`/studio/preview/blueprint/${slug}?page=${encodeURIComponent(pageId)}`}
                  title={`Preview: ${detail.name} (${viewport})`}
                  className="block border-0 bg-white"
                  style={{
                    width: VIEWPORT_WIDTH[viewport],
                    height:
                      viewport === "van-screen"
                        ? VIEWPORT_HEIGHT["van-screen"]
                        : `calc(100vh - 220px)`
                  }}
                />
              </div>
            )}
          </div>

          {/* Detail rail — toggleable to give the canvas room on smaller screens */}
          {showDetails && detail && (
            <aside className="hidden w-[260px] flex-none overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 md:block">
              <SectionHead>Score</SectionHead>
              <ul className="mt-2 grid grid-cols-3 gap-2">
                <ScoreCell label="Conv" value={detail.score.conversion} />
                <ScoreCell label="Trust" value={detail.score.trust} />
                <ScoreCell label="Mob" value={detail.score.mobile} />
                <ScoreCell label="SEO" value={detail.score.seo} />
                <ScoreCell label="A11y" value={detail.score.accessibility} />
                <ScoreCell label="Speed" value={detail.score.speed} />
              </ul>

              <SectionHead className="mt-5">Outcomes</SectionHead>
              <ul className="mt-2 flex flex-wrap gap-1">
                {detail.outcomes.map((o) => (
                  <li
                    key={o}
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-amber-800"
                    style={{ background: "#FEF3C7" }}
                  >
                    {o}
                  </li>
                ))}
              </ul>

              {detail.requiredCredentials.length > 0 && (
                <>
                  <SectionHead className="mt-5">Verified widgets</SectionHead>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {detail.requiredCredentials.map((c) => (
                      <li
                        key={c}
                        className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <SectionHead className="mt-5">Apps auto-select</SectionHead>
              <ul className="mt-2 flex flex-wrap gap-1">
                {detail.suggestedApps.map((a) => (
                  <li
                    key={a}
                    className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700"
                  >
                    {a}
                  </li>
                ))}
              </ul>

              {detail.compliance.length > 0 && (
                <>
                  <SectionHead className="mt-5">Compliance baked in</SectionHead>
                  <ul className="mt-2 space-y-1">
                    {detail.compliance.map((c) => (
                      <li
                        key={c}
                        className="text-[10px] text-neutral-600"
                        style={{ paddingLeft: 12, position: "relative" }}
                      >
                        <span
                          className="absolute left-0 top-1 h-2 w-2 rounded-full"
                          style={{ background: GREEN }}
                        />
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <SectionHead className="mt-5">Build</SectionHead>
              <p className="mt-1 text-[16px] font-extrabold text-neutral-900">
                ~{detail.browserCard.estimatedBuildMinutes} min
              </p>
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: GREEN }}>
                {detail.browserCard.priceLabel}
              </p>

              <div className="mt-5 border-t border-neutral-100 pt-3">
                <Link
                  href={`/studio/blueprints`}
                  className="text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ color: NEUTRAL }}
                >
                  Browse all →
                </Link>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-[9px] font-extrabold uppercase tracking-widest text-neutral-500 ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90 ? "#10B981" : value >= 75 ? "#FFB300" : "#DC2626";
  return (
    <li className="text-center">
      <p
        className="text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: NEUTRAL }}
      >
        {label}
      </p>
      <p
        className="text-[15px] font-extrabold leading-none"
        style={{ color }}
      >
        {value}
      </p>
    </li>
  );
}
