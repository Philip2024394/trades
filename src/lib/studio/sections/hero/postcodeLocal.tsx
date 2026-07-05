// hero.postcode_local_1 — Phase 3 rebuild on shadcn foundation.
//
// Search-first hero for local service trades. Big postcode input at
// centre of gravity. Three trust chips: response time, insurance, years.
// On submit packages postcode into WhatsApp message. Banner proportions
// on desktop. shadcn Button + Badge + Card + Reveal. Typography scale.

"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Clock, ShieldCheck, Award, ArrowRight } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  postcodePlaceholder: string;
  submitLabel: string;
  chip1: string;
  chip2: string;
  chip3: string;
  supportingCopy: string;
  surface: "dark" | "light";
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

function PostcodeLocalHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const [postcode, setPostcode] = useState("");

  // Defensive fallbacks.
  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = (typeof config.heading === "string" && config.heading) || "Where do you need us?";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";
  const postcodePlaceholder = (typeof config.postcodePlaceholder === "string" && config.postcodePlaceholder) || "Enter your postcode";
  const submitLabel = (typeof config.submitLabel === "string" && config.submitLabel) || "Check coverage";
  const chip1 = typeof config.chip1 === "string" ? config.chip1 : "";
  const chip2 = typeof config.chip2 === "string" ? config.chip2 : "";
  const chip3 = typeof config.chip3 === "string" ? config.chip3 : "";
  const supportingCopy = typeof config.supportingCopy === "string" ? config.supportingCopy : "";
  const backgroundImageUrl = typeof config.backgroundImageUrl === "string" ? config.backgroundImageUrl : "";
  const backgroundImageOpacity = Number(config.backgroundImageOpacity) || 0.15;

  const whatsappHref = data.whatsappHref ?? "#whatsapp";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = postcode.trim();
    if (!trimmed) return;
    const message = `Hi — checking coverage for ${trimmed}. Can you quote?`;
    const url = new URL(whatsappHref, "https://x.example");
    url.searchParams.set("text", message);
    if (typeof window !== "undefined") {
      window.location.href = whatsappHref.startsWith("http")
        ? `${whatsappHref}?text=${encodeURIComponent(message)}`
        : `#coverage-${encodeURIComponent(trimmed)}`;
    }
  }

  return (
    <section
      className={cn(
        "relative isolate w-full overflow-x-clip",
        isDark ? "bg-neutral-950 text-white" : "bg-neutral-50 text-neutral-950"
      )}
      style={{
        background: isDark
          ? "linear-gradient(180deg, #0A0A0A 0%, #171717 100%)"
          : "linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)"
      }}
      {...sectionRootAttrs(instanceId, "hero.postcode_local_1", "Postcode-Local Hero")}
    >
      {backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          style={{ opacity: backgroundImageOpacity }}
        />
      )}
      {/* Radial spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(50% 45% at 50% 20%, ${accent}18 0%, transparent 60%)`
        }}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-14 text-center sm:px-6 sm:py-20 lg:min-h-[600px] lg:max-h-[800px] lg:py-24">
        {eyebrow && (
          <Reveal>
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5"
              style={{
                borderColor: `${accent}55`,
                background: `${accent}12`,
                color: accent
              }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              <MapPin size={12} strokeWidth={2.75} />
              <span className="text-eyebrow font-extrabold uppercase">
                {eyebrow}
              </span>
            </div>
          </Reveal>
        )}

        <Reveal delay={0.08}>
          <h1
            className="mt-6 text-display-md font-extrabold sm:mt-8 sm:text-display-lg lg:text-display-xl"
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {heading}
          </h1>
        </Reveal>

        {subheading && (
          <Reveal delay={0.16}>
            <p
              className={cn(
                "mt-4 max-w-xl text-body-md sm:mt-5 sm:text-body-lg",
                isDark ? "text-white/70" : "text-neutral-600"
              )}
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {subheading}
            </p>
          </Reveal>
        )}

        {/* Postcode input — the hero's centre of gravity */}
        <Reveal delay={0.22}>
          <form
            onSubmit={handleSubmit}
            className={cn(
              "mx-auto mt-8 flex w-full max-w-md flex-col gap-2 rounded-2xl border p-2 shadow-xl backdrop-blur-xl sm:mt-10 sm:flex-row",
              isDark
                ? "border-white/15 bg-white/5"
                : "border-black/8 bg-white"
            )}
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <MapPin
                size={18}
                strokeWidth={2.25}
                className={isDark ? "text-white/60" : "text-neutral-500"}
                aria-hidden="true"
              />
              <input
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder={postcodePlaceholder}
                aria-label="Postcode"
                className={cn(
                  "h-11 flex-1 bg-transparent text-body-md outline-none placeholder:text-muted-foreground",
                  isDark ? "text-white" : "text-neutral-950"
                )}
                {...treeAttrs(instanceId, "postcodePlaceholder", "Input placeholder", "text")}
              />
            </div>
            <Button
              type="submit"
              size="xl"
              className="group h-14 flex-shrink-0"
              style={{
                background: accent,
                color: "#0A0A0A",
                boxShadow: `0 8px 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.5)`
              }}
            >
              <span {...treeAttrs(instanceId, "submitLabel", "Submit label", "button")}>
                {submitLabel}
              </span>
              <ArrowRight strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Button>
          </form>
        </Reveal>

        {/* Three trust chips */}
        {(chip1 || chip2 || chip3) && (
          <Reveal delay={0.3}>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-3">
              {[
                { text: chip1, icon: Clock },
                { text: chip2, icon: ShieldCheck },
                { text: chip3, icon: Award }
              ]
                .filter((c) => c.text.length > 0)
                .map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <li
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur-md",
                        isDark
                          ? "border-white/15 bg-white/5 text-white"
                          : "border-black/10 bg-white/85 text-neutral-950"
                      )}
                    >
                      <Icon
                        size={12}
                        strokeWidth={2.5}
                        style={{ color: accent }}
                        aria-hidden="true"
                      />
                      <span
                        className="text-caption font-extrabold uppercase"
                        {...treeAttrs(instanceId, `chip${i + 1}`, `Chip ${i + 1}`, "text")}
                      >
                        {c.text}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Reveal>
        )}

        {supportingCopy && (
          <Reveal delay={0.38}>
            <p
              className={cn(
                "mt-6 max-w-md text-caption",
                isDark ? "text-white/50" : "text-neutral-500"
              )}
              {...treeAttrs(instanceId, "supportingCopy", "Supporting copy", "text")}
            >
              {supportingCopy}
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.postcode_local_1",
  name: "Postcode-Local Hero",
  version: "3.0.0",
  library: "hero",
  description:
    "Search-first hero with big postcode input + 3 trust chips. On submit packages postcode into WhatsApp message. Banner proportions on desktop. Best for coverage-critical local trades.",
  editableFields: [
    { key: "eyebrow", label: "Small eyebrow", type: { kind: "text", maxLength: 40 }, default: "Local & fully insured", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 80 }, default: "Are you in our area?", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 180, multiline: true }, default: "Type your postcode to see if we cover you — instant answer, no signup.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "postcodePlaceholder", label: "Postcode placeholder", type: { kind: "text", maxLength: 40 }, default: "Enter your postcode", group: "Search" },
    { key: "submitLabel", label: "Submit label", type: { kind: "text", maxLength: 20 }, default: "Check coverage", priority: "button", role: "primary_action_label", group: "Search" },
    { key: "chip1", label: "Chip 1 (response time)", type: { kind: "text", maxLength: 30 }, default: "1hr response", priority: "text", group: "Trust chips" },
    { key: "chip2", label: "Chip 2 (insurance)", type: { kind: "text", maxLength: 30 }, default: "£5M insured", priority: "text", group: "Trust chips" },
    { key: "chip3", label: "Chip 3 (years)", type: { kind: "text", maxLength: 30 }, default: "12 years local", priority: "text", group: "Trust chips" },
    { key: "supportingCopy", label: "Supporting copy", type: { kind: "text", maxLength: 120 }, default: "We cover most of the Greater Manchester area. Not sure? Ask.", priority: "text", group: "Copy" },
    { key: "backgroundImageUrl", role: "background_media", label: "Background image (optional)", type: { kind: "image" }, default: "", group: "Media" },
    { key: "backgroundImageOpacity", label: "Background image opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 0.15, group: "Media" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }, default: "dark", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A postcode-local search hero. Explain when it beats a static hero.",
    improve: "Tighten headline + chips. Return patched fields only.",
    rewrite: "Rewrite copy in a {tone} voice, preserving structure.",
    suggestAlternative: "Suggest an alternative for national-coverage merchants.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 200 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: true, ctaAboveFold: true }, seo: { headingLevel: 1 }, mobile: { minTapTargetPx: 48 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["hero", "postcode", "search", "local", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "mobile-mechanic", "locksmith", "handyman", "cleaner"],
  defaultConfig: () => ({
    eyebrow: "Local & fully insured",
    heading: "Are you in our area?",
    subheading: "Type your postcode to see if we cover you — instant answer, no signup.",
    postcodePlaceholder: "Enter your postcode",
    submitLabel: "Check coverage",
    chip1: "1hr response",
    chip2: "£5M insured",
    chip3: "12 years local",
    supportingCopy: "We cover most of the Greater Manchester area. Not sure? Ask.",
    surface: "dark",
    backgroundImageUrl: "",
    backgroundImageOpacity: 0.15
  }),
  renderer: PostcodeLocalHero
};

sectionRegistry.register(registration);
