// brands.strip_1 — 8-logo accreditation / partner strip.
//
// The "as trusted by" band. Merchant fills 4-8 logos of accreditations
// (Gas Safe, CPCS, NICEIC, Which?) or supplier / manufacturer partners
// (Worcester, Baxi, Vaillant). Greyscale by default so mixed-colour
// logos look coherent; hover restores full colour.
//
// In edit mode every empty slot renders a "+ Logo" placeholder that
// carries a data-tree-id and priority="image" — one click uploads via
// Module 7's picker.

"use client";

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Marquee } from "@/components/magicui/marquee";

type Slot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Config = {
  eyebrow: string;
  heading: string;
  b1LogoUrl: string; b1Alt: string;
  b2LogoUrl: string; b2Alt: string;
  b3LogoUrl: string; b3Alt: string;
  b4LogoUrl: string; b4Alt: string;
  b5LogoUrl: string; b5Alt: string;
  b6LogoUrl: string; b6Alt: string;
  b7LogoUrl: string; b7Alt: string;
  b8LogoUrl: string; b8Alt: string;
  greyscale: boolean;
  /** When true, logos scroll horizontally on infinite loop (default).
   *  When false, they sit in a static grid. Marquee always falls back
   *  to a static grid in edit mode so placeholders stay tappable. */
  marquee: boolean;
};

function BrandsStrip({
  instanceId,
  config,
  tokens,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const isEditing = mode === "edit";

  type Logo = { i: Slot; url: string; alt: string };
  const slots: Logo[] = [
    { i: 1, url: config.b1LogoUrl, alt: config.b1Alt },
    { i: 2, url: config.b2LogoUrl, alt: config.b2Alt },
    { i: 3, url: config.b3LogoUrl, alt: config.b3Alt },
    { i: 4, url: config.b4LogoUrl, alt: config.b4Alt },
    { i: 5, url: config.b5LogoUrl, alt: config.b5Alt },
    { i: 6, url: config.b6LogoUrl, alt: config.b6Alt },
    { i: 7, url: config.b7LogoUrl, alt: config.b7Alt },
    { i: 8, url: config.b8LogoUrl, alt: config.b8Alt }
  ];
  // Edit mode: render ALL 8 slots as placeholders so merchant can tap.
  // Preview / published: skip empty slots.
  const logos = isEditing ? slots : slots.filter((l) => l.url);
  const grey = config.greyscale;
  // Marquee only kicks in outside edit mode + only when we actually
  // have 3+ real logos — a strip of 1 doesn't need to scroll.
  const marquee = !isEditing && config.marquee !== false && logos.length >= 3;

  function renderCell(l: Logo) {
    return (
      <li
        key={l.i}
        className="flex items-center justify-center rounded-xl bg-neutral-50 p-3"
        style={{ minHeight: 72, minWidth: marquee ? 140 : undefined }}
      >
        {l.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.url}
            alt={l.alt || `Brand ${l.i}`}
            loading="lazy"
            className="max-h-12 w-full max-w-full object-contain transition"
            style={{
              filter: grey ? "grayscale(1)" : "none",
              opacity: grey ? 0.7 : 1
            }}
            {...treeAttrs(instanceId, `b${l.i}LogoUrl`, `Brand ${l.i} logo`, "image")}
          />
        ) : (
          <span
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: muted }}
            {...treeAttrs(instanceId, `b${l.i}LogoUrl`, `Brand ${l.i} logo`, "image")}
          >
            + Logo {l.i}
          </span>
        )}
      </li>
    );
  }

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "brands.strip_1", "Brands strip")}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {(config.eyebrow || config.heading) && (
          <div className="text-center">
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
                className="mt-2 text-2xl leading-tight sm:text-3xl"
                style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
                {...treeAttrs(instanceId, "heading", "Main headline", "text")}
              >
                {config.heading}
              </h2>
            )}
          </div>
        )}

        {marquee ? (
          <div className={config.eyebrow || config.heading ? "mt-8" : ""}>
            <Marquee durationSec={40} pauseOnHover gapClassName="gap-6">
              <ul className="flex items-center gap-6">
                {logos.map(renderCell)}
              </ul>
            </Marquee>
          </div>
        ) : (
          <ul
            className={`grid grid-cols-3 items-center gap-4 sm:grid-cols-4 lg:grid-cols-8 ${
              config.eyebrow || config.heading ? "mt-8" : ""
            }`}
          >
            {logos.map(renderCell)}
          </ul>
        )}
      </div>
    </section>
  );
}

const brandFields = (i: Slot) => [
  { key: `b${i}LogoUrl`, label: `Brand ${i} logo`, type: { kind: "image" as const, aspectRatio: "3/2", recommendedWidthPx: 300 }, default: "", priority: "image" as const, group: `Brand ${i}` },
  { key: `b${i}Alt`, label: `Brand ${i} alt text`, type: { kind: "text" as const, maxLength: 60 }, default: "", description: "Short description of the brand.", group: `Brand ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "brands.strip_1",
  name: "Brand logo strip",
  version: "1.0.0",
  library: "brands",
  description:
    "8-cell horizontal strip for accreditations, memberships, or supplier / manufacturer partners. Greyscale by default so mixed-colour logos look coherent. Empty slots in edit mode show a placeholder chip.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker (optional)", type: { kind: "text", maxLength: 40 }, default: "As trusted by", priority: "text", group: "Header" },
    { key: "heading", label: "Main headline (optional)", type: { kind: "text", maxLength: 120 }, default: "", priority: "text", aiPromptable: true, description: "Leave blank for a pure logo strip.", group: "Header" },
    ...brandFields(1),
    ...brandFields(2),
    ...brandFields(3),
    ...brandFields(4),
    ...brandFields(5),
    ...brandFields(6),
    ...brandFields(7),
    ...brandFields(8),
    { key: "greyscale", label: "Greyscale logos", type: { kind: "boolean" }, default: true, description: "Recommended when mixing multiple brand colours.", group: "Style" },
    { key: "marquee", label: "Auto-scrolling marquee", type: { kind: "boolean" }, default: true, description: "Logos scroll on infinite loop with fade-edge mask. Falls back to a static grid in edit mode and when there are fewer than 3 logos.", group: "Style" }
  ],
  animations: ["none", "fade", "marquee"],
  aiPrompts: {
    explain: "Explain why a brands strip works for UK trades. Reference accreditations and manufacturers.",
    improve: "Improve without layout change. Kicker under 4 words. Alt text specific to each brand. Return only patched config.",
    rewrite: "Rewrite kicker + heading in a {tone} voice.",
    suggestAlternative: "Suggest an alternative brands layout from library='brands'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/brands-strip-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 400 },
    accessibility: { contrastMin: 4.5, requiredAlt: ["b1Alt", "b2Alt", "b3Alt", "b4Alt", "b5Alt", "b6Alt", "b7Alt", "b8Alt"] },
    sales: { socialProofRecommended: true },
    seo: { headingLevel: 2 },
    mobile: { noHorizontalScroll: true },
    brandConsistency: { boundTokens: ["color.accent", "color.surface"] }
  },
  telemetryTags: ["brands", "strip", "logos", "eight_slots", "greyscale"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "boiler_repair", "gas_safe", "roofing", "plant_hire", "tool_hire", "building_merchant", "kitchen_install", "bathroom_install"],
  defaultConfig: () => ({
    eyebrow: "As trusted by",
    heading: "",
    b1LogoUrl: "", b1Alt: "",
    b2LogoUrl: "", b2Alt: "",
    b3LogoUrl: "", b3Alt: "",
    b4LogoUrl: "", b4Alt: "",
    b5LogoUrl: "", b5Alt: "",
    b6LogoUrl: "", b6Alt: "",
    b7LogoUrl: "", b7Alt: "",
    b8LogoUrl: "", b8Alt: "",
    greyscale: true,
    marquee: true
  }),
  renderer: BrandsStrip
};

sectionRegistry.register(registration);
