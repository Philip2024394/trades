// hero.magazine_editorial_1 — Editorial Magazine Hero.
//
// Premium-feel hero for high-end trades: bespoke kitchens, custom
// extensions, garden design, luxury bathroom installers, interior
// designers. Full magazine-spread layout: massive editorial
// typography, pull-quote in the margin, structured metadata (issue,
// section, credits), and a subtle serif accent for gravitas.
//
// Design principles applied:
//   • Magazine typography rhythm — serif accent, editorial letter-spacing
//   • Metadata rail (issue / section / credit) frames the piece
//   • Pull-quote on the right column with a serif drop-quote
//   • Photo hangs from a rule line — deliberate, editorial
//   • Subdued palette, big whitespace, gravitas over exuberance

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  issue: string;
  section: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  bodyLead: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  pullQuote: string;
  pullQuoteAuthor: string;
  heroImageUrl: string;
  credit: string;
  surface: "cream" | "onyx";
};

function MagazineEditorialHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isCream = config.surface === "cream";
  const bg = isCream
    ? "linear-gradient(180deg, #FBFAF6 0%, #F0EBE0 100%)"
    : "linear-gradient(180deg, #0A0A0A 0%, #14100F 100%)";
  const ink = isCream ? "#1A1512" : "#F8F5EE";
  const muted = isCream ? "rgba(26,21,18,0.6)" : "rgba(248,245,238,0.6)";
  const border = isCream ? "rgba(26,21,18,0.14)" : "rgba(248,245,238,0.14)";
  const serifFont = "Georgia, 'Playfair Display', 'Times New Roman', serif";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";
  const headingFont = (tokens["font.heading"] as string) ?? serifFont;

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.magazine_editorial_1", "Magazine Editorial Hero")}
    >
      {/* Top metadata rail */}
      <div
        className="mx-auto max-w-6xl border-b px-5 py-4 sm:px-6"
        style={{ borderColor: border }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.3em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "issue", "Issue", "text")}
            >
              {config.issue}
            </span>
            <span aria-hidden="true" className="h-3 w-px" style={{ background: border }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "section", "Section", "text")}
            >
              {config.section}
            </span>
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "credit", "Credit", "text")}
          >
            {config.credit}
          </span>
        </div>
      </div>

      {/* Editorial body */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        {/* LEFT — copy column */}
        <article>
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
            className="mt-5 text-5xl font-normal leading-[1] sm:text-7xl md:text-8xl"
            style={{
              fontFamily: serifFont,
              letterSpacing: "-0.03em",
              fontStyle: "italic",
              fontWeight: 500
            }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mt-6 max-w-lg text-[17px] font-semibold leading-relaxed sm:text-[19px]"
              style={{ color: ink, fontFamily: headingFont }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}

          {config.bodyLead && (
            <p
              className="mt-6 max-w-xl text-[14px] leading-relaxed sm:text-[15px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "bodyLead", "Body lead", "text")}
            >
              {/* Drop-cap first letter — editorial signature */}
              <span
                className="float-left mr-2 mt-1 text-6xl font-normal leading-[0.75]"
                style={{
                  color: accent,
                  fontFamily: serifFont,
                  fontStyle: "italic"
                }}
              >
                {config.bodyLead.charAt(0)}
              </span>
              {config.bodyLead.slice(1)}
            </p>
          )}

          <Link
            href={primaryHref || "#"}
            className="mt-10 inline-flex h-14 items-center justify-center gap-2 rounded-none border-2 px-6 text-[12px] font-extrabold uppercase tracking-[0.28em] transition"
            style={{
              borderColor: ink,
              background: ink,
              color: isCream ? "#FBFAF6" : "#14100F"
            }}
            {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
          >
            <span>{config.primaryCtaLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </article>

        {/* RIGHT — pull-quote + image */}
        <aside className="flex flex-col gap-6">
          {config.heroImageUrl && (
            <div className="w-full">
              <div
                className="border-t pt-3"
                style={{ borderColor: border }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.3em]"
                  style={{ color: muted }}
                >
                  Featured project
                </p>
              </div>
              <div
                className="mt-3 overflow-hidden"
                style={{ aspectRatio: "4 / 5" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.heroImageUrl}
                  alt=""
                  className="h-full w-full object-cover grayscale-[15%]"
                />
              </div>
            </div>
          )}

          {config.pullQuote && (
            <blockquote
              className="border-l-2 pl-5"
              style={{ borderColor: accent }}
            >
              <span
                aria-hidden="true"
                className="mb-2 block text-4xl font-normal leading-[1]"
                style={{
                  color: accent,
                  fontFamily: serifFont,
                  fontStyle: "italic"
                }}
              >
                &ldquo;
              </span>
              <p
                className="text-[17px] font-normal leading-snug sm:text-[19px]"
                style={{ fontFamily: serifFont, fontStyle: "italic", color: ink }}
                {...treeAttrs(instanceId, "pullQuote", "Pull quote", "text")}
              >
                {config.pullQuote}
              </p>
              <p
                className="mt-3 text-[10px] font-bold uppercase tracking-[0.28em]"
                style={{ color: muted }}
                {...treeAttrs(instanceId, "pullQuoteAuthor", "Pull quote author", "text")}
              >
                — {config.pullQuoteAuthor}
              </p>
            </blockquote>
          )}
        </aside>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.magazine_editorial_1",
  name: "Editorial Magazine Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Premium magazine-spread hero with serif italic headline, drop-cap lead, pull-quote and portrait-crop photo. For high-end trades: bespoke kitchens, extensions, garden design.",
  editableFields: [
    { key: "issue", label: "Issue label", type: { kind: "text", maxLength: 30 }, default: "Vol. 04 · 2026", priority: "text", group: "Metadata rail" },
    { key: "section", label: "Section label", type: { kind: "text", maxLength: 30 }, default: "Interiors", priority: "text", group: "Metadata rail" },
    { key: "credit", label: "Credit line", type: { kind: "text", maxLength: 60 }, default: "Design & build · Est. 2011", priority: "text", group: "Metadata rail" },
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Feature", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline (serif italic)", type: { kind: "text", maxLength: 100 }, default: "Craft, without the bluster.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Kitchens made in our workshop, fitted by the same hands that made them. No sub-contractors. No shortcuts.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "bodyLead", label: "Body lead (with drop-cap)", type: { kind: "text", maxLength: 400, multiline: true }, default: "Every commission starts with a walk through the space. We measure, we listen, we sketch. Then we go away and design something that fits the room, the budget and the way you actually live. Every commission ends with a walk through the finished job — same hands, same care.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Commission a project", priority: "button", aiPromptable: true, group: "CTA" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTA" },
    { key: "pullQuote", label: "Pull quote", type: { kind: "text", maxLength: 200, multiline: true }, default: "They didn't just build our kitchen — they understood our house.", priority: "text", aiPromptable: true, group: "Pull quote" },
    { key: "pullQuoteAuthor", label: "Pull quote author", type: { kind: "text", maxLength: 60 }, default: "Emma & James, York", priority: "text", group: "Pull quote" },
    { key: "heroImageUrl", label: "Hero image URL", type: { kind: "image", aspectRatio: "4:5", recommendedWidthPx: 1200 }, default: "", group: "Image" },
    { key: "surface", label: "Surface", type: { kind: "select", options: [{ value: "cream", label: "Cream (premium)" }, { value: "onyx", label: "Onyx (moody)" }] }, default: "cream", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Magazine Editorial hero converts best.",
    improve: "Suggest a serif-friendly headline for this trade.",
    rewrite: "Rewrite the drop-cap lead in editorial voice.",
    suggestAlternative: "Which hero would work for a value-focused trade?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "editorial", "premium", "serif"],
  bestForVerticals: ["bespoke-kitchen", "interior-designer", "garden-designer", "extension-builder", "luxury-bathroom-fitter", "carpenter", "joiner", "showroom"],
  defaultConfig: () => ({
    issue: "Vol. 04 · 2026",
    section: "Interiors",
    credit: "Design & build · Est. 2011",
    eyebrow: "Feature",
    heading: "Craft, without the bluster.",
    subheading: "Kitchens made in our workshop, fitted by the same hands that made them. No sub-contractors. No shortcuts.",
    bodyLead: "Every commission starts with a walk through the space. We measure, we listen, we sketch. Then we go away and design something that fits the room, the budget and the way you actually live. Every commission ends with a walk through the finished job — same hands, same care.",
    primaryCtaLabel: "Commission a project",
    primaryCtaHref: "#whatsapp",
    pullQuote: "They didn't just build our kitchen — they understood our house.",
    pullQuoteAuthor: "Emma & James, York",
    heroImageUrl: "",
    surface: "cream"
  }),
  renderer: MagazineEditorialHero
};

sectionRegistry.register(registration);
