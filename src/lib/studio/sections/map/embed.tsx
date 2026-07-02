// map.embed_1 — Google Maps embed via the no-API-key legacy pattern.
//
// Merchant types an address / postcode / place name into `mapQuery`;
// we build `https://maps.google.com/maps?q=…&output=embed` — no Maps
// Platform key required. 16:9 responsive iframe, lazy-loaded. Small
// caption below carries opening hours / travel time / service area.

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
  mapQuery: string;
  caption: string;
};

function toMapEmbedUrl(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
}

function MapEmbed({
  instanceId,
  config,
  tokens
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;

  const embedUrl = toMapEmbedUrl(config.mapQuery);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "map.embed_1", "Map")}
    >
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          {config.heading && (
            <h2
              className="mt-2 text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
              {...treeAttrs(instanceId, "heading", "Main headline", "text")}
            >
              {config.heading}
            </h2>
          )}
          {config.subheading && (
            <p
              className="mt-2 max-w-2xl text-[14px] leading-relaxed sm:text-[16px]"
              style={{
                color: muted,
                fontFamily: bodyFont,
                fontWeight: bodyWeight ?? 500
              }}
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {config.subheading}
            </p>
          )}
        </div>

        <div
          className="relative mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-md"
          style={{ aspectRatio: "16 / 9" }}
          {...treeAttrs(instanceId, "mapQuery", "Map", "image")}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={config.heading || "Map"}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-500">
              <span
                aria-hidden="true"
                className="grid h-14 w-14 place-items-center rounded-full text-[22px] font-extrabold text-neutral-900"
                style={{ background: accent }}
              >
                📍
              </span>
              <p className="text-[11px] font-extrabold uppercase tracking-widest">
                Add an address or postcode
              </p>
              <p className="max-w-xs text-center text-[11px] text-neutral-400">
                Click the map in edit mode → toolbar Replace, or paste
                a postcode into the field.
              </p>
            </div>
          )}
        </div>

        {config.caption && (
          <p
            className="mt-4 text-center text-[12px] font-bold"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "caption", "Caption", "text")}
          >
            {config.caption}
          </p>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "map.embed_1",
  name: "Map embed",
  version: "1.0.0",
  library: "map",
  description:
    "Google Maps embed via the legacy no-API-key URL. Merchant pastes an address, postcode, or place name and the map renders. 16:9 responsive iframe with lazy loading. Caption line below for hours or service-area reach.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Where we're based", priority: "text", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "Come and see us.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 220, multiline: true }, default: "Our yard is open Mon-Fri 7:30-18:00. Plenty of parking. Trade counter through the main gate.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "mapQuery", label: "Address / postcode / place", type: { kind: "text", maxLength: 200 }, default: "LS10 1AB", priority: "text", description: "Anything Google Maps recognises — full address, postcode, business name, or lat/long.", group: "Map" },
    { key: "caption", label: "Caption (optional)", type: { kind: "text", maxLength: 120 }, default: "Free parking · 5 mins from J45 M1", priority: "text", aiPromptable: true, group: "Map" }
  ],
  animations: ["none", "fade"],
  aiPrompts: {
    explain: "Explain why a map section builds trust for UK trades. Reference specific copy.",
    improve: "Improve without layout change. Headline under 6 words. Sub-line one sentence. Caption 3-4 short signals. Return only patched config.",
    rewrite: "Rewrite copy in a {tone} voice.",
    suggestAlternative: "Suggest an alternative map layout from library='map'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/map-embed-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 60, blockingResources: ["google-maps-iframe"] },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: false, socialProofRecommended: false },
    seo: { headingLevel: 2, structuredData: "Place" },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["map", "google_maps", "embed", "no_api_key", "16_9"],
  bestForVerticals: ["plant_hire", "tool_hire", "building_merchant", "kitchen_install", "bathroom_install", "landscaping", "hvac", "plumbing", "electrical", "joinery"],
  defaultConfig: () => ({
    eyebrow: "Where we're based",
    heading: "Come and see us.",
    subheading: "Our yard is open Mon-Fri 7:30-18:00. Plenty of parking. Trade counter through the main gate.",
    mapQuery: "LS10 1AB",
    caption: "Free parking · 5 mins from J45 M1"
  }),
  renderer: MapEmbed
};

sectionRegistry.register(registration);
