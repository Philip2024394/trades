"use client";
// src/app/nex-app/create-banners/CreateBannersClient.tsx
//
// NEX Create Banners · Interactive sandbox client · 2026-09-23
// ============================================================
// Interactive form + progress + preview grid for the sandbox demo.
// Every rendered banner shows the UNPROVEN watermark from Sharp; this
// component also stamps a UI-level "NOT FOR PUBLICATION" chip on each.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMockProductById, productToBannerBrief } from "@/lib/nex/mock-products";

interface VariantRow {
  variant_id: string;
  format_id: string;
  seed: number;
  state: "queued" | "generating" | "composing" | "complete" | "failed";
  raw_generation_relative_path: string | null;
  composed_relative_path: string | null;
  composed_public_url: string | null;
  duration_ms: number | null;
  failure_reason: string | null;
  raw_sha256: string | null;
  composed_sha256: string | null;
}

interface JobShape {
  job_id: string;
  created_at: string;
  campaign_summary: {
    business_display_name: string;
    product_or_service_label: string;
    campaign_objective: string;
    headline: string;
    cta: string;
  };
  total_variants: number;
  state: "created" | "running" | "complete" | "failed";
  started_at: string | null;
  completed_at: string | null;
  variants: VariantRow[];
  quality_status: "UNPROVEN";
  publication_allowed: false;
  reference_sha256_used: string;
}

function stateColour(s: VariantRow["state"]): string {
  switch (s) {
    case "queued":
      return "bg-neutral-100 text-neutral-600";
    case "generating":
      return "bg-blue-100 text-blue-800";
    case "composing":
      return "bg-amber-100 text-amber-900";
    case "complete":
      return "bg-emerald-100 text-emerald-900";
    case "failed":
      return "bg-red-100 text-red-900";
  }
}

export default function CreateBannersClient() {
  const [business, setBusiness] = useState("Acme Scaffolding");
  const [product, setProduct] = useState(
    "residential scaffolding installation"
  );
  const [objective, setObjective] = useState(
    "Reliable scaffolding for house renovations · book a free survey"
  );
  const [headline, setHeadline] = useState("Reliable scaffolding for your home");
  const [cta, setCta] = useState("Book a free survey");
  const [distinctSeeds, setDistinctSeeds] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobShape | null>(null);

  // Product-aware auto-fill · per §5 permanent conversation-first doctrine
  // ("NEX should not ask what NEX already knows"). When `?product_id=`
  // is present in the URL AND the id matches a NEX product record, the
  // Banner Creation capability constructs the creative brief from the
  // product record and pre-populates every form field verbatim (no
  // fabrication of commercial facts). The fields remain editable — the
  // member sees NEX applied information it already had, and can adjust
  // if they choose.
  const searchParams = useSearchParams();
  const productIdParam = searchParams?.get("product_id") ?? null;
  const sourceProduct = productIdParam ? getMockProductById(productIdParam) : undefined;
  const productAwareMode = Boolean(sourceProduct);

  useEffect(() => {
    if (!sourceProduct) return;
    const brief = productToBannerBrief(sourceProduct);
    setBusiness(brief.business_display_name);
    setProduct(brief.product_or_service_label);
    setObjective(brief.campaign_objective);
    setHeadline(brief.headline);
    setCta(brief.cta);
    // Do NOT touch distinctSeeds — that's an engine control, not a
    // product-derived field.
  }, [sourceProduct]);

  const submit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/nex/create-banners/sandbox/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_display_name: business,
          product_or_service_label: product,
          campaign_objective: objective,
          headline,
          cta,
          distinct_seeds: distinctSeeds,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      const jobId: string = json.job_id;
      // Prime a shell job so the UI shows immediately
      setJob({
        job_id: jobId,
        created_at: new Date().toISOString(),
        campaign_summary: {
          business_display_name: business,
          product_or_service_label: product,
          campaign_objective: objective,
          headline,
          cta,
        },
        total_variants: Number(json.total_variants ?? 0),
        state: "created",
        started_at: null,
        completed_at: null,
        variants: [],
        quality_status: "UNPROVEN",
        publication_allowed: false,
        reference_sha256_used: String(json.reference_sha256_used ?? ""),
      });
      setSubmitting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }, [business, product, objective, headline, cta, distinctSeeds]);

  // Poll while job is not terminal
  useEffect(() => {
    if (!job || job.state === "complete" || job.state === "failed") return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/nex/create-banners/sandbox/job/${job.job_id}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (res.ok && json.ok) {
          setJob(json.job as JobShape);
        }
      } catch {
        /* transient · retry next tick */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [job]);

  const complete = job?.variants.filter((v) => v.state === "complete").length ?? 0;
  const failed = job?.variants.filter((v) => v.state === "failed").length ?? 0;
  const active = job?.variants.filter(
    (v) => v.state === "generating" || v.state === "composing"
  ).length ?? 0;

  return (
    <div>
      {/* Form */}
      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          Sandbox campaign
        </h2>
        {productAwareMode && sourceProduct && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Product-aware
            </span>
            <span>
              Auto-filled from your NEX product{" "}
              <span className="font-semibold">{sourceProduct.name}</span> ·
              price <span className="font-semibold">{sourceProduct.priceLabel}</span>
              {" "}· every field below can be edited before generating.
            </span>
          </div>
        )}
        <p className="mb-4 text-xs text-neutral-600">
          This is a sandbox demo · every output is watermarked{" "}
          <span className="font-semibold">UNPROVEN</span> · nothing is published ·
          nothing enters the image manifest. Reference is fixed to the
          Founder-supplied scaffolded-house photo (SHA{" "}
          <code className="font-mono">6fe56772…</code>).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-neutral-700">
            Business display name
            <input
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-700">
            Product / service label
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-700 sm:col-span-2">
            Campaign objective
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-700">
            Headline (NEX-composed · overlaid on top band)
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-700">
            CTA (NEX-composed · overlaid on bottom band)
            <input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-700 sm:col-span-2">
            Distinct SDXL generations (1–4). Each generation feeds
            multiple format variants via NEX composition — total is always
            12 banners.
            <input
              type="number"
              min={1}
              max={4}
              value={distinctSeeds}
              onChange={(e) =>
                setDistinctSeeds(
                  Math.max(1, Math.min(4, Number(e.target.value) || 3))
                )
              }
              className="mt-1 w-24 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || (job?.state === "running")}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Starting…"
              : job?.state === "running"
              ? "Job running…"
              : "Generate 12 banners"}
          </button>
          {error && (
            <span className="text-xs text-red-700">Error: {error}</span>
          )}
        </div>
        <p className="mt-3 text-xs text-neutral-600">
          Expected time: ~{Math.round(distinctSeeds * 2)}–
          {distinctSeeds * 3} minutes on RTX 2050 (SDXL is ~100 s per
          generation · composition is ~5 s per variant).
        </p>
      </section>

      {/* Job progress */}
      {job && (
        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">
              Job {job.job_id}
            </h2>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                job.state === "complete"
                  ? "bg-emerald-100 text-emerald-900"
                  : job.state === "failed"
                  ? "bg-red-100 text-red-900"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {job.state.toUpperCase()}
            </span>
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            {complete}/{job.total_variants} complete · {active} in progress ·{" "}
            {failed} failed · quality={job.quality_status} · publish=
            {String(job.publication_allowed)}
          </div>
        </section>
      )}

      {/* Preview grid */}
      {job && job.variants.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">
            Banners
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {job.variants.map((v) => (
              <div
                key={v.variant_id}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
              >
                <div className="relative aspect-square bg-neutral-100">
                  {v.composed_public_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={v.composed_public_url}
                      alt={v.variant_id}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                      {v.state === "failed"
                        ? "failed"
                        : v.state === "generating"
                        ? "generating SDXL…"
                        : v.state === "composing"
                        ? "composing…"
                        : "queued"}
                    </div>
                  )}
                  <span className="absolute right-2 top-2 rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    unproven · not for publication
                  </span>
                </div>
                <div className="p-3 text-xs text-neutral-700">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-neutral-500">
                      {v.format_id}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateColour(
                        v.state
                      )}`}
                    >
                      {v.state}
                    </span>
                  </div>
                  <div>seed {v.seed}</div>
                  {v.duration_ms !== null && (
                    <div className="text-[10px] text-neutral-500">
                      {v.duration_ms} ms
                    </div>
                  )}
                  {v.composed_sha256 && (
                    <div className="mt-1 truncate font-mono text-[10px] text-neutral-400">
                      sha {v.composed_sha256.slice(0, 12)}…
                    </div>
                  )}
                  {v.failure_reason && (
                    <div className="mt-1 text-[10px] text-red-700">
                      {v.failure_reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
