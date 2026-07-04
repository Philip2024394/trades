// hero.before_after_slider_1 — Interactive Before/After Slider.
//
// Show-your-work hero: draggable divider reveals before/after photos
// of real jobs. Zero words needed — the merchant's transformation
// speaks for itself. Best-in-class for trades whose value is
// visible: painters, roofers, cleaners, restorers, tilers,
// landscapers.
//
// Design principles applied:
//   • The slider IS the pitch — no copy needed to convey quality
//   • Interactive delight: drag or tap the handle to reveal
//   • Fallback: at 50/50 both photos visible even without interaction
//   • Overlay labels ("Before"/"After") anchor the compare mentally
//   • Keyboard-accessible (arrow keys move the handle)

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
  beforeLabel: string;
  afterLabel: string;
  jobDescription: string;
};

function BeforeAfterSliderHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent | TouchEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX;
      const raw = ((clientX - rect.left) / rect.width) * 100;
      setPosition(Math.max(0, Math.min(100, raw)));
    }
    function onEnd() {
      setDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragging]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 5));
    if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 5));
  }

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)",
        color: "#FFFFFF",
        fontFamily: bodyFont
      }}
      {...sectionRootAttrs(instanceId, "hero.before_after_slider_1", "Before/After Slider Hero")}
    >
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
          style={{
            opacity: Math.max(0, Math.min(1, config.backgroundImageOpacity ?? 1))
          }}
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}
      {config.backgroundImageUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)"
          }}
        />
      )}

      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-12">
          {/* LEFT — copy */}
          <div>
            {config.eyebrow && (
              <p
                className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
                style={{ color: accent }}
                {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
              >
                {config.eyebrow}
              </p>
            )}
            <h1
              className="mt-3 text-4xl font-extrabold leading-[0.95] sm:text-5xl lg:text-6xl"
              style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
              {...treeAttrs(instanceId, "heading", "Headline", "text")}
            >
              {config.heading}
            </h1>
            {config.subheading && (
              <p
                className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75 sm:text-[17px]"
                {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
              >
                {config.subheading}
              </p>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={primaryHref || "#"}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
                style={{
                  background: accent,
                  color: "#0A0A0A",
                  boxShadow: `0 8px 24px ${accent}55`
                }}
                {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
              >
                <span>{config.primaryCtaLabel}</span>
              </Link>
              {config.secondaryCtaLabel && (
                <Link
                  href={secondaryHref || "#"}
                  className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest transition hover:bg-white/5"
                  style={{
                    borderColor: "rgba(255,255,255,0.2)",
                    color: "#FFFFFF",
                    background: "rgba(255,255,255,0.03)"
                  }}
                  {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
                >
                  {config.secondaryCtaLabel}
                </Link>
              )}
            </div>
          </div>

          {/* RIGHT — slider */}
          <div>
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded-2xl border select-none"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "#1a1a1a",
                aspectRatio: "4 / 3",
                cursor: dragging ? "grabbing" : "grab"
              }}
              onMouseDown={() => setDragging(true)}
              onTouchStart={() => setDragging(true)}
            >
              {/* Composite mode: when the merchant supplies a SINGLE
                  side-by-side image (before on the left half, after on
                  the right half) as both URLs, we render each frame as
                  a scaled 200%-wide background aligned to its half. */}
              {(() => {
                const composite =
                  !!config.beforeImageUrl &&
                  config.beforeImageUrl === config.afterImageUrl
                    ? config.beforeImageUrl
                    : null;

                return (
                  <>
                    {/* After (bottom layer) — RIGHT half of the composite.
                        We use a real <img> at 200% width with the
                        composite shifted -100% left so only the right
                        half is visible inside the clipping frame. This
                        preserves aspect ratio via object-cover, unlike
                        `background-size: 200% 100%` which distorts. */}
                    {composite ? (
                      <div className="absolute inset-0 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={composite}
                          alt={config.afterLabel}
                          className="absolute inset-y-0 h-full max-w-none object-cover"
                          style={{ width: "200%", left: "-100%" }}
                          draggable={false}
                          {...treeAttrs(instanceId, "afterImageUrl", "After photo", "image")}
                        />
                      </div>
                    ) : config.afterImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={config.afterImageUrl}
                        alt={config.afterLabel}
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                        {...treeAttrs(instanceId, "afterImageUrl", "After photo", "image")}
                      />
                    ) : (
                      <PlaceholderTile label={config.afterLabel} tone="green" />
                    )}

                    {/* Before (top layer, clipped to slider position) —
                        LEFT half of the composite via left: 0 on the
                        200%-wide img. */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                    >
                      {composite ? (
                        <div className="absolute inset-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={composite}
                            alt={config.beforeLabel}
                            className="absolute inset-y-0 h-full max-w-none object-cover"
                            style={{ width: "200%", left: "0" }}
                            draggable={false}
                            {...treeAttrs(instanceId, "beforeImageUrl", "Before photo", "image")}
                          />
                        </div>
                      ) : config.beforeImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={config.beforeImageUrl}
                          alt={config.beforeLabel}
                          className="absolute inset-0 h-full w-full object-cover"
                          draggable={false}
                          {...treeAttrs(instanceId, "beforeImageUrl", "Before photo", "image")}
                        />
                      ) : (
                        <PlaceholderTile label={config.beforeLabel} tone="grey" />
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Labels */}
              <span
                className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest"
                style={{
                  background: "rgba(0,0,0,0.72)",
                  color: "#FFFFFF",
                  backdropFilter: "blur(6px)"
                }}
                {...treeAttrs(instanceId, "beforeLabel", "Before label", "text")}
              >
                {config.beforeLabel}
              </span>
              <span
                className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest"
                style={{
                  background: accent,
                  color: "#0A0A0A"
                }}
                {...treeAttrs(instanceId, "afterLabel", "After label", "text")}
              >
                {config.afterLabel}
              </span>

              {/* Handle divider */}
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${position}%`,
                  transform: "translateX(-50%)",
                  width: 2,
                  background: accent,
                  boxShadow: `0 0 20px ${accent}88`
                }}
                aria-hidden="true"
              />

              {/* Handle button — draggable + keyboard-accessible */}
              <button
                type="button"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging(true);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setDragging(true);
                }}
                aria-label="Drag to compare before and after"
                className="absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-2xl transition hover:scale-110 focus:outline-none focus:ring-4"
                style={{
                  left: `${position}%`,
                  background: "#FFFFFF",
                  borderColor: accent
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                  <polyline points="9 6 3 12 9 18" transform="translate(12,0)" />
                </svg>
              </button>
            </div>

            {config.jobDescription && (
              <p
                className="mt-4 text-center text-[12px] font-semibold text-white/60"
                {...treeAttrs(instanceId, "jobDescription", "Job description", "text")}
              >
                {config.jobDescription}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlaceholderTile({ label, tone }: { label: string; tone: "green" | "grey" }) {
  const bg =
    tone === "green"
      ? "linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)"
      : "linear-gradient(135deg, #404040 0%, #737373 100%)";
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: bg }}
    >
      <p className="text-xl font-extrabold uppercase tracking-widest text-white/80">
        {label}
      </p>
    </div>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.before_after_slider_1",
  name: "Before/After Slider Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Interactive draggable slider revealing before/after photos of real work. Zero words needed. Perfect for painters, roofers, cleaners, restorers, tilers.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Real work · Real transformations", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Drag. See the difference.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Every job photographed before we start and after we finish. Same care, same finish, every time.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Start your project", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "See more work", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "beforeImageUrl", label: "Before image URL", type: { kind: "image", aspectRatio: "4:3", recommendedWidthPx: 1200 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_00_28%20PM.png", group: "Photos", description: "If this and 'After image URL' point to the same URL, the slider treats it as a composite: left half = Before, right half = After." },
    { key: "afterImageUrl", label: "After image URL", type: { kind: "image", aspectRatio: "4:3", recommendedWidthPx: 1200 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_00_28%20PM.png", group: "Photos", description: "Point to a separate After photo for two-image mode, or match Before URL for composite mode." },
    { key: "beforeLabel", label: "Before label", type: { kind: "text", maxLength: 20 }, default: "Before", group: "Labels" },
    { key: "afterLabel", label: "After label", type: { kind: "text", maxLength: 20 }, default: "After", group: "Labels" },
    { key: "jobDescription", label: "Job caption", type: { kind: "text", maxLength: 120 }, default: "Victorian terraced house · Full external repaint · 5-day job", priority: "text", group: "Caption" },
    { key: "backgroundImageUrl", role: "background_media",label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_58_48%20PM.png", group: "Background", description: "Full-bleed photo behind the whole hero. Leave empty for the plain dark gradient." },
    { key: "backgroundImageOpacity", role: "opacity",label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Before/After Slider hero works best.",
    improve: "Suggest which project photo pair should lead.",
    rewrite: "Rewrite the headline for a visual transformation trade.",
    suggestAlternative: "Which hero would work for a trade without dramatic before/after material?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "interactive", "slider", "portfolio"],
  bestForVerticals: ["painter", "roofer", "cleaner", "restorer", "tiler", "landscape-designer", "driveway-installer", "carpet-cleaner"],
  defaultConfig: () => ({
    eyebrow: "Real work · Real transformations",
    heading: "Drag. See the difference.",
    subheading: "Every job photographed before we start and after we finish. Same care, same finish, every time.",
    primaryCtaLabel: "Start your project",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See more work",
    secondaryCtaHref: "#projects",
    beforeImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_00_28%20PM.png",
    afterImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_00_28%20PM.png",
    beforeLabel: "Before",
    afterLabel: "After",
    jobDescription: "Victorian terraced house · Full external repaint · 5-day job",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_58_48%20PM.png",
    backgroundImageOpacity: 1
  }),
  renderer: BeforeAfterSliderHero
};

sectionRegistry.register(registration);
