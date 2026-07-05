"use client";

// Blueprint Browser — outcome-first template picker.
//
// PRD §5 · §6 · §21. Filters on the left (drawer on mobile), ranked
// blueprint cards in the main grid. Each card carries decision-only
// info: mobile preview, scores, sections, verified widgets, build time.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import { BlueprintCard } from "./BlueprintCard";
import { BlueprintPreviewSlideover } from "./BlueprintPreviewSlideover";
import { PublishLiveDialog } from "./PublishLiveDialog";

const YELLOW = "#FFB300";

type Score = {
  conversion: number;
  seo: number;
  trust: number;
  mobile: number;
  accessibility: number;
  speed: number;
  brandConsistency?: number;
};

type BrowserCard = {
  oneLiner: string;
  benefits: string[];
  priceLabel: string;
  estimatedBuildMinutes: number;
};

export type BlueprintRow = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  trades: string[];
  outcomes: string[];
  variant: string;
  score: Score;
  requiredCredentials: string[];
  suggestedApps: string[];
  browserCard: BrowserCard;
  rankScore: number;
  rankReasons: string[];
};

const OUTCOMES: { slug: string; label: string }[] = [
  { slug: "quote-requests", label: "Quote requests" },
  { slug: "phone-calls", label: "Phone calls" },
  { slug: "whatsapp-enquiries", label: "WhatsApp enquiries" },
  { slug: "emergency-callout", label: "Emergency callout" },
  { slug: "product-sales", label: "Product sales" },
  { slug: "service-sales", label: "Service bookings" },
  { slug: "project-showcase", label: "Project showcase" },
  { slug: "staff-recruitment", label: "Recruitment" },
  { slug: "local-coverage", label: "Local coverage" },
  { slug: "trade-account", label: "Trade accounts" },
  { slug: "equipment-hire", label: "Equipment hire" },
  { slug: "training-signups", label: "Training signups" }
];

const VARIANTS = [
  { slug: "corporate", label: "Corporate" },
  { slug: "industrial", label: "Industrial" },
  { slug: "tradesman", label: "Tradesman" },
  { slug: "premium", label: "Premium" },
  { slug: "emergency", label: "Emergency" },
  { slug: "minimal", label: "Minimal" }
];

export function BlueprintBrowser({
  currentSlug,
  displayName
}: {
  currentSlug: string;
  displayName: string;
}) {
  const [blueprints, setBlueprints] = useState<BlueprintRow[] | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [variantFilter, setVariantFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [publishingSlug, setPublishingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void load(outcomeFilter, variantFilter);
  }, [outcomeFilter, variantFilter]);

  async function load(outcome: string, variant: string) {
    setError(null);
    try {
      const url = new URL(
        "/api/studio/blueprints",
        window.location.origin
      );
      if (outcome !== "all") url.searchParams.set("outcome", outcome);
      if (variant !== "all") url.searchParams.set("variant", variant);
      const res = await fetch(url.toString());
      const json = (await res.json()) as
        | { ok: true; blueprints: BlueprintRow[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setBlueprints(json.blueprints);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }

  const filtered = useMemo(() => {
    if (!blueprints) return [];
    const q = search.trim().toLowerCase();
    if (!q) return blueprints;
    return blueprints.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.tagline.toLowerCase().includes(q) ||
        b.trades.some((t) => t.toLowerCase().includes(q)) ||
        b.outcomes.some((o) => o.toLowerCase().includes(q))
    );
  }, [blueprints, search]);

  function openPublishDialog(slug: string) {
    setError(null);
    setFlash(null);
    setPreviewSlug(null);
    setPublishingSlug(slug);
  }

  // Kept as fallback if we ever want draft-only install; the primary
  // path is openPublishDialog which fires publish-live atomically.
  async function _draftOnlyInstall_(slug: string) {
    setInstalling(slug);
    setFlash(null);
    try {
      const res = await fetchWithRetry(
        `/api/studio/blueprints/${slug}/install`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const json = (await res.json()) as {
        ok: boolean;
        installedPages?: string[];
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? "install-failed");
      setFlash(
        `Installed on ${json.installedPages?.length ?? 0} page(s). Open Studio to review.`
      );
      window.setTimeout(() => setFlash(null), 5000);
    } catch (err) {
      setError((err as Error).message ?? "install-failed");
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Blueprint Studio
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            Pick the outcome. We ship the site.
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
            Every Blueprint is a full multi-page layout tuned to a business
            outcome — quote requests, phone calls, product sales, trade
            accounts. Content-preserving, editable everywhere.
          </p>
        </div>
        <Link
          href="/studio/blueprints/wizard"
          className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 15 8l6 1-4.5 4.5L18 21l-6-3-6 3 1.5-7.5L3 9l6-1z"/>
          </svg>
          Setup wizard · 90s
        </Link>
      </div>

      {flash && (
        <p
          role="status"
          className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800"
        >
          {flash}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700"
        >
          {error}
        </p>
      )}

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blueprints, trades, outcomes…"
          className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium outline-none focus:border-neutral-900"
        />
        <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Outcome
        </label>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-bold outline-none focus:border-neutral-900"
        >
          <option value="all">All outcomes</option>
          {OUTCOMES.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Style
        </label>
        <select
          value={variantFilter}
          onChange={(e) => setVariantFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-bold outline-none focus:border-neutral-900"
        >
          <option value="all">All styles</option>
          {VARIANTS.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {blueprints === null ? (
        <p className="mt-10 text-[13px] text-neutral-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center text-[13px] font-bold text-neutral-500">
          No blueprints match — try clearing filters.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bp) => (
            <BlueprintCard
              key={bp.slug}
              blueprint={bp}
              installing={installing === bp.slug}
              onInstall={() => openPublishDialog(bp.slug)}
              onPreview={() => setPreviewSlug(bp.slug)}
            />
          ))}
        </div>
      )}

      <BlueprintPreviewSlideover
        slug={previewSlug}
        installing={installing === previewSlug}
        onClose={() => setPreviewSlug(null)}
        onInstall={openPublishDialog}
      />

      <PublishLiveDialog
        open={publishingSlug !== null}
        blueprintSlug={publishingSlug}
        blueprintName={
          blueprints?.find((b) => b.slug === publishingSlug)?.name ?? null
        }
        suggestedName={displayName}
        currentSlug={currentSlug}
        onClose={() => setPublishingSlug(null)}
        onPublished={() => {
          setFlash("Site is live!");
          window.setTimeout(() => setFlash(null), 5000);
        }}
      />
    </div>
  );
}
