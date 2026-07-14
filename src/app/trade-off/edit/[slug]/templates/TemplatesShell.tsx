"use client";

// Merchant mobile app template picker. Each template renders inside a
// CSS iPhone frame with a static reference screenshot. Applying a
// template writes the slug onto
// hammerex_trade_off_listings.mobile_app_template_slug for the signed-
// in merchant. Live-preview iframe was replaced by the screenshot
// approach because fixed-position modals/nav inside the scaled iframe
// clipped past the phone's rounded corners.

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, ExternalLink, Sparkles } from "lucide-react";
import type { AppTemplate } from "@/lib/appTemplates";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";
const BRAND_GREEN_DARK = "#166534";

// One entry per template — image is the static screenshot rendered
// inside the phone frame; liveUrl is the "View live app" deep-link.
const PREVIEWS: Record<string, { image: string; liveUrl: string }> = {
  "template-1": {
    image:   "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2009_45_57%20PM.png",
    liveUrl: "/trade-off/yard/canteens/uk-kitchen-fitters"
  }
};

export function TemplatesShell({
  slug,
  templates,
  appliedSlug
}: {
  slug: string;
  templates: AppTemplate[];
  appliedSlug: string;
}) {
  const [applied, setApplied] = useState(appliedSlug);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function applyTemplate(templateSlug: string) {
    if (templateSlug === applied || submitting) return;
    setSubmitting(templateSlug);
    setError(null);
    try {
      const res = await fetch(`/api/merchant/${encodeURIComponent(slug)}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateSlug })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error === "not-signed-in" ? "Please sign in as this merchant." : "Apply failed — please try again.");
        return;
      }
      setApplied(templateSlug);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <div className="mb-6">
        <Link
          href={`/trade-off/edit/${slug}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={12} strokeWidth={2.5}/>
          Back to dashboard
        </Link>
      </div>

      {/* Header — copy on the left, decorative illustration on the
          right. Same header style as the washers page for consistency. */}
      <header className="mb-8 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Mobile app themes
          </div>
          <h1
            className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]"
            style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
          >
            Choose your app template
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
            Pick the visual style your customers see when they open your business on a phone. You can switch anytime — your content (products, services, posts, kitchen designs) stays the same, only the theme changes.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-[12px] font-black uppercase tracking-wider text-red-700">
          {error}
        </div>
      )}

      {/* Templates grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const isApplied = t.slug === applied;
          const isSubmitting = submitting === t.slug;
          const preview = PREVIEWS[t.slug];
          return (
            <article
              key={t.slug}
              className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition"
              style={{
                borderColor: isApplied ? BRAND_YELLOW : "rgba(139,69,19,0.15)",
                boxShadow: isApplied ? `0 0 0 2px ${BRAND_YELLOW}55` : undefined
              }}
            >
              {/* iPhone preview — tightened padding so the enlarged
                  300px frame doesn't push the card too tall in the
                  grid. Gradient still gives depth around the phone. */}
              <div
                className="relative flex items-center justify-center px-4 py-5"
                style={{
                  background: `linear-gradient(140deg, ${t.themeBgColor} 0%, #EDE4CD 100%)`
                }}
              >
                <IphoneFrame previewImageUrl={preview?.image}/>
                {t.isDefault && !isApplied && (
                  <span
                    className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] shadow-md"
                    style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                  >
                    <Sparkles size={10} strokeWidth={2.6}/>
                    Default
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="flex flex-1 flex-col gap-3 border-t p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    Template · {t.slug.replace("template-", "")}
                  </div>
                  <h3 className="mt-1 text-[17px] font-black leading-tight text-neutral-900">
                    {t.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                    Theme
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full border border-neutral-300"
                      style={{ backgroundColor: t.themeBgColor }}
                    />
                    {t.themeName}
                  </div>
                </div>

                {t.description && (
                  <p className="line-clamp-4 flex-1 text-[12.5px] leading-relaxed text-neutral-700">
                    {t.description}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => applyTemplate(t.slug)}
                  disabled={isApplied || isSubmitting}
                  className="mt-1 inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isApplied ? "#E5E7EB" : BRAND_YELLOW,
                    color: isApplied ? "#6B7280" : BRAND_BLACK
                  }}
                >
                  {isApplied ? (
                    <>
                      <Check size={13} strokeWidth={2.6}/>
                      Applied
                    </>
                  ) : isSubmitting ? (
                    "Applying…"
                  ) : (
                    "Apply this template"
                  )}
                </button>

                {preview?.liveUrl && (
                  <a
                    href={preview.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.97]"
                    style={{ borderColor: "rgba(139,69,19,0.20)" }}
                  >
                    View live app
                    <ExternalLink size={12} strokeWidth={2.5}/>
                  </a>
                )}
              </div>
            </article>
          );
        })}

        {/* Coming-soon slot — signals more templates are on the way
            without pretending they already exist. */}
        <article
          className="flex flex-col overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${BRAND_YELLOW}22` }}
            >
              <Sparkles size={20} strokeWidth={2.2} style={{ color: BRAND_YELLOW }}/>
            </div>
            <div className="text-[13px] font-black text-neutral-900">
              More templates coming soon
            </div>
            <p className="max-w-xs text-[11.5px] leading-relaxed text-neutral-500">
              We&apos;re working on Dark Mode, Merchant-Pro Portfolio, and a full-photo Hero Focus template. Suggest a style at{" "}
              <a
                href="mailto:thenetworkers.app@gmail.com"
                className="font-black text-neutral-800 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
              >
                thenetworkers.app@gmail.com
              </a>.
            </p>
          </div>
        </article>
      </div>

      {/* Footer note */}
      <footer className="mt-8 rounded-xl border bg-white p-4 text-[11.5px] leading-relaxed text-neutral-600 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <strong>Your content stays with you.</strong> Switching a template only changes theme + layout — your products, services, kitchen designs, posts, jobs, and reviews are unchanged. Your URL <span className="font-mono text-[11px] text-neutral-900">thenetworkers.app/{slug}</span> stays the same forever.
      </footer>
    </main>
  );
}

// ─── Template preview (plain image, no CSS phone frame) ─────
//
// Renders the template's reference PNG directly. The screenshot itself
// already includes a phone-shaped mockup, so a CSS iPhone chassis
// around it creates a phone-inside-a-phone. Object-contain preserves
// the mockup's shape end-to-end.

function IphoneFrame({ previewImageUrl }: { previewImageUrl: string | undefined }) {
  if (!previewImageUrl) {
    return (
      <div
        className="mx-auto flex items-center justify-center text-center text-[10px] font-black uppercase tracking-wider text-neutral-500"
        style={{ aspectRatio: "9 / 19.5", width: "300px" }}
      >
        Preview coming soon
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={previewImageUrl}
      alt="Template preview"
      loading="lazy"
      className="mx-auto block h-auto w-full max-w-[300px] object-contain"
    />
  );
}
