// hero.postcode_local_1 — Postcode-Local Hero.
//
// Search-first hero for local service trades where "coverage" is the
// deciding factor: emergency plumbers, gas engineers, mobile mechanics,
// locksmiths, small builders, cleaners. A big postcode input sits at
// the heart of the hero; three trust chips confirm response time,
// insurance status and years in trade.
//
// Design principles applied:
//   • Postcode input becomes the hero's centre of gravity
//   • Three fact chips: response time, insurance, years — the three
//     things a homeowner checks in that order
//   • On submit the input packages the postcode into the WhatsApp
//     message so the merchant sees it before their phone rings
//   • Optional light or dark surface

"use client";

import { useState } from "react";
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
  postcodePlaceholder: string;
  submitLabel: string;
  chip1: string;
  chip2: string;
  chip3: string;
  supportingCopy: string;
  surface: "dark" | "light";
};

function PostcodeLocalHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const bg = isDark
    ? "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)"
    : "linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)";
  const ink = isDark ? "#FFFFFF" : "#0A0A0A";
  const muted = isDark ? "rgba(255,255,255,0.72)" : "#525252";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const inputBorder = isDark ? "rgba(255,255,255,0.16)" : "#D4D4D4";
  const chipBg = isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const chipBorder = isDark ? "rgba(255,255,255,0.14)" : "#E5E5E5";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const [postcode, setPostcode] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = postcode.trim().toUpperCase();
    if (!trimmed) return;
    if (data.whatsappHref) {
      const msg = encodeURIComponent(`Hi, I'm in ${trimmed}. Can you help?`);
      const separator = data.whatsappHref.includes("?") ? "&" : "?";
      window.location.href = `${data.whatsappHref}${separator}text=${msg}`;
    }
  }

  const chips = [config.chip1, config.chip2, config.chip3].filter(
    (c) => c && c.trim().length > 0
  );

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.postcode_local_1", "Postcode-Local Hero")}
    >
      <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 sm:py-24">
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
          className="mt-4 text-4xl font-extrabold leading-[0.95] sm:text-5xl md:text-6xl"
          style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {config.heading}
        </h1>
        {config.subheading && (
          <p
            className="mt-4 text-[15px] leading-relaxed sm:text-[17px]"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        {/* Postcode search — the star of the show */}
        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-2 rounded-2xl border p-2 sm:flex-row sm:gap-0 sm:p-1.5"
          style={{
            background: inputBg,
            borderColor: inputBorder,
            boxShadow: isDark
              ? "0 12px 40px rgba(0,0,0,0.4)"
              : "0 12px 40px rgba(0,0,0,0.08)"
          }}
        >
          <label className="flex flex-1 items-center gap-2 px-3">
            <PostcodeIcon color={accent} />
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder={config.postcodePlaceholder}
              maxLength={12}
              className="h-12 w-full border-0 bg-transparent text-[16px] font-semibold outline-none placeholder:font-normal sm:h-14 sm:text-[18px]"
              style={{ color: ink }}
              aria-label="Your postcode"
              autoComplete="postal-code"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition active:scale-[0.98] sm:h-14"
            style={{
              background: accent,
              color: "#0A0A0A",
              boxShadow: `0 4px 12px ${accent}66`
            }}
            {...treeAttrs(instanceId, "submitLabel", "Submit CTA", "button")}
          >
            {config.submitLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </form>

        {/* Three fact chips */}
        {chips.length > 0 && (
          <ul className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-2">
            {chips.map((c, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                style={{
                  background: chipBg,
                  borderColor: chipBorder,
                  color: ink
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  aria-hidden="true"
                />
                {c}
              </li>
            ))}
          </ul>
        )}

        {config.supportingCopy && (
          <p
            className="mt-8 text-[11px] font-bold uppercase tracking-[0.22em]"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "supportingCopy", "Supporting copy", "text")}
          >
            {config.supportingCopy}
          </p>
        )}
      </div>
    </section>
  );
}

function PostcodeIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.postcode_local_1",
  name: "Postcode-Local Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Postcode search as the hero's centre of gravity. Three fact chips (response time, insurance, years). Built for local service trades where coverage is the deciding factor.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Covering your area", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "A plumber, right here on your street.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Type your postcode and we'll be on WhatsApp with a quote before the kettle boils.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "postcodePlaceholder", label: "Postcode placeholder", type: { kind: "text", maxLength: 30 }, default: "e.g. LS1 4AB", group: "Search" },
    { key: "submitLabel", label: "Submit button label", type: { kind: "text", maxLength: 20 }, default: "Get quote", priority: "button", group: "Search" },
    { key: "chip1", label: "Chip 1", type: { kind: "text", maxLength: 40 }, default: "45 min avg on-site", group: "Fact chips" },
    { key: "chip2", label: "Chip 2", type: { kind: "text", maxLength: 40 }, default: "£5m public liability", group: "Fact chips" },
    { key: "chip3", label: "Chip 3", type: { kind: "text", maxLength: 40 }, default: "12 years in trade", group: "Fact chips" },
    { key: "supportingCopy", label: "Supporting copy", type: { kind: "text", maxLength: 120 }, default: "No call centres · One-tap WhatsApp · Never pay to enquire", priority: "text", group: "Copy" },
    { key: "surface", label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }, default: "dark", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Postcode-Local hero pattern converts best.",
    improve: "Suggest which fact chip is most important for this trade.",
    rewrite: "Rewrite the headline for a local service trade.",
    suggestAlternative: "Which hero would work for a merchant selling to a wide catchment?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "postcode", "local", "search"],
  bestForVerticals: ["plumber", "electrician", "boiler-engineer", "mobile-mechanic", "locksmith", "carpenter", "cleaner", "small-builder"],
  defaultConfig: () => ({
    eyebrow: "Covering your area",
    heading: "A plumber, right here on your street.",
    subheading: "Type your postcode and we'll be on WhatsApp with a quote before the kettle boils.",
    postcodePlaceholder: "e.g. LS1 4AB",
    submitLabel: "Get quote",
    chip1: "45 min avg on-site",
    chip2: "£5m public liability",
    chip3: "12 years in trade",
    supportingCopy: "No call centres · One-tap WhatsApp · Never pay to enquire",
    surface: "dark"
  }),
  renderer: PostcodeLocalHero
};

sectionRegistry.register(registration);
