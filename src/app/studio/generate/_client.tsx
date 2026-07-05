// Slice E — client shell for the landing page.
//
// Left column: prompt textarea + trade selector + Generate button.
// Right column: iframe pointed at /studio/generate/preview with the
// current prompt + trade in the URL. Regenerating just updates the src.
//
// Design intent (Linear × Stripe, mobile-first, non-negotiable):
//   • Single-column stack on mobile (form on top, iframe below)
//   • Two-column split on lg+ (form left ~380px, iframe fills rest)
//   • 13px minimum text (WCAG floor)
//   • Lucide icons only
//   • Framer Motion for form state transitions

"use client";

import { useMemo, useState } from "react";
import { Sparkles, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Trade = { slug: string; label: string };

type Props = {
  trades: Trade[];
  initialPrompt: string;
  initialTrade: string;
  initialMerchantName: string;
};

export function GenerateLanding({
  trades,
  initialPrompt,
  initialTrade,
  initialMerchantName
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [tradeSlug, setTradeSlug] = useState(initialTrade);
  const [merchantName, setMerchantName] = useState(initialMerchantName);
  const [previewKey, setPreviewKey] = useState(0);
  const [generating, setGenerating] = useState(false);

  const previewSrc = useMemo(() => {
    if (!tradeSlug) return "";
    const qs = new URLSearchParams();
    qs.set("trade", tradeSlug);
    if (prompt.trim()) qs.set("prompt", prompt.trim());
    if (merchantName.trim()) qs.set("merchantName", merchantName.trim());
    return `/studio/generate/preview?${qs.toString()}&k=${previewKey}`;
  }, [prompt, tradeSlug, merchantName, previewKey]);

  const canGenerate = tradeSlug.length > 0 && prompt.trim().length >= 8;

  function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    // Bump key so the iframe reloads even if params match cache.
    setPreviewKey((k) => k + 1);
    // The generating flag clears once the iframe fires onLoad.
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900 lg:flex-row">
      {/* ─── Left: prompt form ─────────────────────────── */}
      <aside className="border-b border-neutral-200 bg-white lg:w-[380px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-5 sm:p-6 lg:p-8">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "#FFB30012" }}
            >
              <Sparkles size={16} strokeWidth={2.25} style={{ color: "#FFB300" }} aria-hidden="true" />
            </div>
            <h1 className="text-[15px] font-extrabold tracking-tight">
              Build your app
            </h1>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
            Describe the app you want. Pick your trade. We&apos;ll assemble a
            full page with your industry&apos;s content, credentials,
            services and FAQs already filled in.
          </p>

          {/* Prompt textarea */}
          <label className="mt-6 block">
            <span className="text-[13px] font-bold text-neutral-700">
              What app do you want?
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A landing page for my Gas Safe plumbing business in Leeds. Emergency callouts + boiler installs. Want a clear callback CTA."
              className="mt-2 min-h-[132px] w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 text-[13px] leading-relaxed placeholder-neutral-400 outline-none focus:border-neutral-900"
              maxLength={800}
            />
            <span className="mt-1 block text-right text-[11px] text-neutral-400">
              {prompt.length}/800
            </span>
          </label>

          {/* Trade select */}
          <label className="mt-4 block">
            <span className="text-[13px] font-bold text-neutral-700">
              Your trade
            </span>
            <select
              value={tradeSlug}
              onChange={(e) => setTradeSlug(e.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium outline-none focus:border-neutral-900"
            >
              <option value="">Select…</option>
              {trades.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {/* Business name (optional) */}
          <label className="mt-4 block">
            <span className="text-[13px] font-bold text-neutral-700">
              Business name{" "}
              <span className="font-medium text-neutral-400">(optional)</span>
            </span>
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="e.g. Yorkshire Plumbing Co"
              className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium placeholder-neutral-400 outline-none focus:border-neutral-900"
              maxLength={80}
            />
          </label>

          {/* Generate button */}
          <div className="mt-6">
            <Button
              size="xl"
              className="w-full"
              disabled={!canGenerate || generating}
              onClick={handleGenerate}
            >
              {generating ? (
                <>
                  <Loader2 size={18} strokeWidth={2.25} className="mr-2 animate-spin" />
                  Generating…
                </>
              ) : previewKey === 0 ? (
                <>
                  Generate app
                  <ArrowRight size={18} strokeWidth={2.25} className="ml-2" />
                </>
              ) : (
                <>
                  <RefreshCw size={18} strokeWidth={2.25} className="mr-2" />
                  Regenerate
                </>
              )}
            </Button>
            {!canGenerate && (
              <p className="mt-2 text-center text-[11px] text-neutral-400">
                Pick a trade and write at least a sentence.
              </p>
            )}
          </div>

          <div className="mt-auto pt-6 text-[11px] leading-relaxed text-neutral-400">
            Every section&apos;s content comes from the platform&apos;s
            Knowledge Graph for your trade — services, FAQs, credentials
            and testimonial templates are pre-filled. You edit whatever
            you want to change.
          </div>
        </div>
      </aside>

      {/* ─── Right: iframe preview ─────────────────────── */}
      <main className="relative flex-1 bg-neutral-100 p-3 sm:p-5 lg:p-6">
        {previewSrc ? (
          <div className="h-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <iframe
              key={previewKey}
              src={previewSrc}
              title="Generated app preview"
              className="h-full w-full min-h-[600px]"
              onLoad={() => setGenerating(false)}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className={cn(
        "flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center"
      )}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "#FFB30012" }}
      >
        <Sparkles size={24} strokeWidth={2} style={{ color: "#FFB300" }} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-[15px] font-extrabold">Your app previews here</h2>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500">
        Fill in the prompt and pick your trade, then hit Generate.
      </p>
    </div>
  );
}
