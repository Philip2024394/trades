"use client";

// PublishLiveDialog — the "60-second moment".
//
// Opens from the wizard's ranked-results screen (and the browser's Use
// Blueprint button). Captures the merchant's desired URL, live-checks
// availability, offers 3 alternates if taken, then fires
// /api/studio/publish-live which:
//   • claims the slug atomically
//   • installs the blueprint into every page draft
//   • snapshots each into a versioned published row
//   • returns the live URL
//
// Success state = the URL, big and copyable, with an "Open my site"
// button that navigates to /trade/<slug>. This is the screenshot moment.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import { slugifyXrated } from "@/lib/xratedSlug";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const NEUTRAL = "#525252";

// Single mock placeholder — swapped for real per-blueprint hero
// photography later (Lane 4 photography brief). Public asset served
// by Next.js as-is.
const MOCK_PREVIEW_IMAGE = "/blueprint-preview-mock.svg";

type SlugCheck = { slug: string; available: boolean; reason?: string };
type SuggestResponse =
  | {
      ok: true;
      requested: SlugCheck;
      alternates: SlugCheck[];
      current: string;
    }
  | { ok: false; error: string };

type PublishMetrics = {
  pageCount: number;
  sectionCount: number;
  manifestTargets: {
    conversion: number;
    seo: number;
    trust: number;
    mobile: number;
    accessibility: number;
    speed: number;
  };
  liveScores: {
    seo: number;
    accessibility: number;
    mobile: number;
    speed: number;
    conversion: number;
    brandConsistency: number;
  };
};

type PublishResponse =
  | {
      ok: true;
      slug: string;
      liveUrl: string;
      publishedPages: string[];
      metrics: PublishMetrics;
    }
  | { ok: false; error: string; detail?: string };

// Progress stages — real events happening server-side, animated
// client-side so the merchant sees dopamine ticks in real elapsed time.
// If the API completes fast, remaining ticks flash quickly; if it's
// slow, ticks slow with it. The events themselves are real.
const PROGRESS_STAGES = [
  "Analysing your trade",
  "Selecting your blueprint",
  "Building your pages",
  "Assembling your sections",
  "Applying your design tokens",
  "Optimising mobile layout",
  "Wiring your CTAs",
  "Checking accessibility",
  "Baking in SEO metadata",
  "Reserving your URL",
  "Snapshotting your pages",
  "Publishing live"
] as const;

export function PublishLiveDialog({
  open,
  blueprintSlug,
  blueprintName,
  suggestedName,
  currentSlug,
  onClose,
  onPublished
}: {
  open: boolean;
  blueprintSlug: string | null;
  blueprintName: string | null;
  suggestedName: string | null;
  currentSlug: string;
  onClose: () => void;
  onPublished: (liveUrl: string, slug: string) => void;
}) {
  const [siteName, setSiteName] = useState("");
  const [slug, setSlug] = useState(currentSlug);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [alternates, setAlternates] = useState<SlugCheck[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [metrics, setMetrics] = useState<PublishMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Seed the field when the dialog opens
  useEffect(() => {
    if (!open) return;
    setSiteName(suggestedName ?? "");
    setSlug(suggestedName ? slugifyXrated(suggestedName) : currentSlug);
    setStatus("idle");
    setAlternates([]);
    setReason(null);
    setError(null);
    setLiveUrl(null);
    setCopied(false);
  }, [open, suggestedName, currentSlug]);

  const checkSlug = useCallback(
    async (candidate: string) => {
      if (!candidate) {
        setStatus("idle");
        setAlternates([]);
        return;
      }
      if (candidate === currentSlug) {
        setStatus("ok");
        setAlternates([]);
        setReason("this is your current URL");
        return;
      }
      setStatus("checking");
      try {
        const res = await fetchWithRetry(
          `/api/studio/slug-suggest?base=${encodeURIComponent(candidate)}`
        );
        const json = (await res.json()) as SuggestResponse;
        if (!json.ok) throw new Error(json.error);
        if (json.requested.available) {
          setStatus("ok");
          setAlternates([]);
          setReason(null);
        } else {
          setStatus(json.requested.reason ? "invalid" : "taken");
          setReason(json.requested.reason ?? "already taken");
          setAlternates(json.alternates ?? []);
        }
      } catch (err) {
        setStatus("idle");
        setError((err as Error).message ?? "network");
      }
    },
    [currentSlug]
  );

  function updateName(value: string) {
    setSiteName(value);
    const nextSlug = slugifyXrated(value);
    setSlug(nextSlug);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void checkSlug(nextSlug);
    }, 350);
  }

  function updateSlug(value: string) {
    const nextSlug = slugifyXrated(value);
    setSlug(nextSlug);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void checkSlug(nextSlug);
    }, 350);
  }

  async function publish() {
    if (!blueprintSlug) return;
    setPublishing(true);
    setProgressStage(0);
    setError(null);
    setMetrics(null);

    // Start the progress ticker. The real events happen server-side
    // but there's no SSE stream — we advance one tick every ~500ms and
    // fast-forward the remainder on API response so the merchant sees
    // completion when the work actually finishes.
    const stageInterval = window.setInterval(() => {
      setProgressStage((s) =>
        s < PROGRESS_STAGES.length - 1 ? s + 1 : s
      );
    }, 500);

    try {
      const res = await fetchWithRetry("/api/studio/publish-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintSlug,
          desiredSlug: slug || undefined
        })
      });
      const json = (await res.json()) as PublishResponse;
      if (!json.ok) {
        clearInterval(stageInterval);
        setError(json.detail ?? json.error);
        setPublishing(false);
        setProgressStage(0);
        return;
      }
      // Fast-forward remaining ticks so the merchant sees the whole
      // list completed before the success reveal fades in.
      clearInterval(stageInterval);
      setProgressStage(PROGRESS_STAGES.length);
      // Brief pause so the merchant sees the final ticks land.
      await new Promise((r) => setTimeout(r, 500));
      setMetrics(json.metrics);
      setLiveUrl(json.liveUrl);
      onPublished(json.liveUrl, json.slug);
    } catch (err) {
      clearInterval(stageInterval);
      setError((err as Error).message ?? "publish-failed");
    } finally {
      setPublishing(false);
    }
  }

  async function copyUrl() {
    if (!liveUrl) return;
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked — silently ignore
    }
  }

  if (!open || !blueprintSlug) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Publish live"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {publishing ? (
          // ─── PROGRESS STATE ────────────────────────────────────
          <div>
            <div className="relative h-32">
              <Image
                src={MOCK_PREVIEW_IMAGE}
                alt=""
                fill
                sizes="640px"
                className="object-cover"
                priority
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(10,10,10,0.9), rgba(10,10,10,0.6))"
                }}
              />
              <div className="relative flex h-full flex-col justify-end p-5 text-white">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ color: YELLOW }}
                >
                  Building your digital business
                </p>
                <p className="mt-1 text-[20px] font-extrabold leading-tight">
                  Assembling {blueprintName}…
                </p>
              </div>
            </div>
            <ol className="max-h-[60vh] overflow-y-auto p-6">
              {PROGRESS_STAGES.map((stage, idx) => {
                const done = idx < progressStage;
                const active = idx === progressStage;
                return (
                  <li
                    key={stage}
                    className="flex items-center gap-3 py-2 text-[13px]"
                    style={{
                      color: done
                        ? "#10B981"
                        : active
                          ? "#0A0A0A"
                          : "#9CA3AF"
                    }}
                  >
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
                      style={{
                        background: done
                          ? "#10B981"
                          : active
                            ? YELLOW
                            : "#F3F4F6",
                        color: done || active ? "#FFFFFF" : "#9CA3AF"
                      }}
                    >
                      {done ? "✓" : active ? "…" : idx + 1}
                    </span>
                    <span
                      className="font-bold"
                      style={{ opacity: done || active ? 1 : 0.6 }}
                    >
                      {stage}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : liveUrl ? (
          // ─── SUCCESS STATE ─────────────────────────────────────
          <div>
            <div
              className="relative flex h-40 items-end p-6 text-white"
              style={{ background: GREEN }}
            >
              <div className="absolute inset-0 opacity-20">
                <Image
                  src={MOCK_PREVIEW_IMAGE}
                  alt=""
                  fill
                  sizes="640px"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="relative">
                <p className="text-[11px] font-extrabold uppercase tracking-widest">
                  Your site is live
                </p>
                <p className="mt-1 text-[24px] font-extrabold leading-tight">
                  You did it. Share the URL.
                </p>
              </div>
            </div>
            <div className="p-6">
              {/* Real metrics — page + section counts + scorer output */}
              {metrics && (
                <div className="mb-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p
                    className="text-[9px] font-extrabold uppercase tracking-widest"
                    style={{ color: NEUTRAL }}
                  >
                    Your live site
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                    <MetricCell
                      label="Pages"
                      value={String(metrics.pageCount)}
                    />
                    <MetricCell
                      label="Sections"
                      value={String(metrics.sectionCount)}
                    />
                    <MetricCell
                      label="SEO"
                      value={String(metrics.liveScores.seo)}
                      score
                    />
                    <MetricCell
                      label="A11y"
                      value={String(metrics.liveScores.accessibility)}
                      score
                    />
                    <MetricCell
                      label="Mobile"
                      value={String(metrics.liveScores.mobile)}
                      score
                    />
                    <MetricCell
                      label="Speed"
                      value={String(metrics.liveScores.speed)}
                      score
                    />
                  </div>
                  <p
                    className="mt-2 text-center text-[9px] italic"
                    style={{ color: NEUTRAL }}
                  >
                    Live scores from your published pages. Any score
                    under 90 → Growth Coach will suggest fixes.
                  </p>
                </div>
              )}

              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: NEUTRAL }}
              >
                Live URL
              </p>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-neutral-100 p-3 font-mono text-[13px] font-bold text-neutral-900">
                <span className="min-w-0 flex-1 truncate">{liveUrl}</span>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white transition"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 no-underline transition hover:brightness-95"
                  style={{ background: YELLOW }}
                >
                  Open my site →
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-3 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
                >
                  Back to Studio
                </button>
              </div>
            </div>
          </div>
        ) : (
          // ─── FORM STATE ────────────────────────────────────────
          <div>
            <div className="relative h-32">
              <Image
                src={MOCK_PREVIEW_IMAGE}
                alt=""
                fill
                sizes="512px"
                className="object-cover"
                priority
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(10,10,10,0.85), rgba(10,10,10,0.55))"
                }}
              />
              <div className="relative flex h-full flex-col justify-end p-5 text-white">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ color: YELLOW }}
                >
                  60-second setup
                </p>
                <p className="mt-1 text-[18px] font-extrabold leading-tight">
                  Publish "{blueprintName}" live
                </p>
              </div>
            </div>

            <div className="p-6">
              <label className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: NEUTRAL }}>
                Your business name
              </label>
              <input
                value={siteName}
                onChange={(e) => updateName(e.target.value)}
                placeholder="Smith &amp; Co Carpentry"
                autoFocus
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] font-medium outline-none focus:border-neutral-900"
              />

              <div className="mt-4 flex items-center justify-between">
                <label className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: NEUTRAL }}>
                  Your URL
                </label>
                <StatusPill status={status} reason={reason} />
              </div>
              <div className="mt-1 flex items-stretch gap-0 overflow-hidden rounded-lg border border-neutral-300 focus-within:border-neutral-900">
                <span className="flex items-center bg-neutral-50 px-3 font-mono text-[12px] font-medium text-neutral-500">
                  /trade/
                </span>
                <input
                  value={slug}
                  onChange={(e) => updateSlug(e.target.value)}
                  placeholder="smith-co-carpentry"
                  className="min-w-0 flex-1 border-l border-neutral-200 bg-white px-3 py-2 font-mono text-[13px] font-bold text-neutral-900 outline-none"
                />
              </div>

              {alternates.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold text-neutral-500">
                    Try one of these instead:
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {alternates.map((a) => (
                      <li key={a.slug}>
                        <button
                          type="button"
                          onClick={() => {
                            setSlug(a.slug);
                            void checkSlug(a.slug);
                          }}
                          disabled={!a.available}
                          className="rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold transition disabled:opacity-40"
                          style={{
                            borderColor: a.available ? YELLOW : "#E5E5E5",
                            background: a.available ? "#FEF3C7" : "#F5F5F5",
                            color: a.available ? "#78350F" : NEUTRAL
                          }}
                        >
                          {a.slug}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={publish}
                  disabled={
                    publishing ||
                    !slug ||
                    (status !== "ok" && slug !== currentSlug) ||
                    !blueprintSlug
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: YELLOW }}
                >
                  {publishing ? "Publishing…" : "Publish live now →"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={publishing}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-3 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>

              <p className="mt-3 text-center text-[10px] text-neutral-500">
                We install every page, save your current draft to a
                stash you can restore, and put your site online in one
                click.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  status,
  reason
}: {
  status: "idle" | "checking" | "ok" | "taken" | "invalid";
  reason: string | null;
}) {
  if (status === "idle") return null;
  const map: Record<string, { label: string; color: string }> = {
    checking: { label: "Checking…", color: NEUTRAL },
    ok: { label: reason ?? "available", color: GREEN },
    taken: { label: reason ?? "taken", color: RED },
    invalid: { label: reason ?? "invalid", color: RED }
  };
  const meta = map[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
      style={{ background: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function MetricCell({
  label,
  value,
  score
}: {
  label: string;
  value: string;
  score?: boolean;
}) {
  // Colour scores by band; page/section counts stay black.
  let color = "#0A0A0A";
  if (score) {
    const n = Number(value);
    color = n >= 90 ? GREEN : n >= 75 ? YELLOW : RED;
  }
  return (
    <div>
      <p
        className="text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: NEUTRAL }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 text-[18px] font-extrabold leading-none"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
