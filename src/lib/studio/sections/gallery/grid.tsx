// gallery.grid_1 — 8-tile uniform photo grid.
//
// Portfolio / finished-job / before-after showcase. Every tile is
// square, no captions, minimal chrome — the photos do the talking.
// Merchants add photos slot by slot via the Module 7 image picker.
// Optional "See all photos" CTA below the grid points at a dedicated
// portfolio page.
//
// A future gallery.masonry_1 will offer variable-height Pinterest-style
// tiles; grid_1 is the safest first pick for merchants uploading mixed
// aspect-ratio photos.

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Slot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Config = {
  eyebrow: string;
  heading: string;
  p1ImageUrl: string; p1Alt: string;
  p2ImageUrl: string; p2Alt: string;
  p3ImageUrl: string; p3Alt: string;
  p4ImageUrl: string; p4Alt: string;
  p5ImageUrl: string; p5Alt: string;
  p6ImageUrl: string; p6Alt: string;
  p7ImageUrl: string; p7Alt: string;
  p8ImageUrl: string; p8Alt: string;
  showSeeAll: boolean;
  seeAllLabel: string;
  seeAllHref: string;
};

function GalleryGrid({
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

  type Photo = { i: Slot; url: string; alt: string };
  const slots: Photo[] = [
    { i: 1, url: config.p1ImageUrl, alt: config.p1Alt },
    { i: 2, url: config.p2ImageUrl, alt: config.p2Alt },
    { i: 3, url: config.p3ImageUrl, alt: config.p3Alt },
    { i: 4, url: config.p4ImageUrl, alt: config.p4Alt },
    { i: 5, url: config.p5ImageUrl, alt: config.p5Alt },
    { i: 6, url: config.p6ImageUrl, alt: config.p6Alt },
    { i: 7, url: config.p7ImageUrl, alt: config.p7Alt },
    { i: 8, url: config.p8ImageUrl, alt: config.p8Alt }
  ];
  // In edit mode we render EVERY slot (including empty ones) so the
  // merchant can click the placeholder and upload. In preview/published
  // empty slots are hidden.
  const photos = isEditing ? slots : slots.filter((p) => p.url);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "gallery.grid_1", "Gallery")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
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

        <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li
              key={p.i}
              className="relative aspect-square overflow-hidden rounded-2xl bg-neutral-100"
            >
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={p.alt || `Photo ${p.i}`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                  {...treeAttrs(instanceId, `p${p.i}ImageUrl`, `Photo ${p.i}`, "image")}
                />
              ) : (
                <span
                  className="absolute inset-0 grid place-items-center text-[10px] font-extrabold uppercase tracking-widest text-neutral-400"
                  {...treeAttrs(instanceId, `p${p.i}ImageUrl`, `Photo ${p.i}`, "image")}
                >
                  + Photo {p.i}
                </span>
              )}
            </li>
          ))}
        </ul>

        {config.showSeeAll && config.seeAllLabel && (
          <div className="mt-8 flex justify-center">
            <Link
              href={config.seeAllHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="inline-flex h-12 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
              style={{ background: accent, color: "#0A0A0A" }}
              {...treeAttrs(instanceId, "seeAllLabel", "See-all button", "button")}
            >
              {config.seeAllLabel} →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

const photoFields = (i: Slot) => [
  { key: `p${i}ImageUrl`, label: `Photo ${i}`, type: { kind: "image" as const, aspectRatio: "1/1", recommendedWidthPx: 800 }, default: "", priority: "image" as const, group: `Photo ${i}` },
  { key: `p${i}Alt`, label: `Photo ${i} alt text`, type: { kind: "text" as const, maxLength: 120 }, default: "", description: "Short description — search engines and screen readers.", group: `Photo ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "gallery.grid_1",
  name: "Photo grid",
  version: "1.0.0",
  library: "gallery",
  description:
    "8-tile uniform photo grid. 4-column desktop, 2-column mobile. Best for finished-job portfolios — landscaping, joinery, tiling, kitchen fits. In edit mode every empty slot shows a placeholder so upload is one click.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Recent work", priority: "text", group: "Header" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "The last eight jobs.", priority: "text", aiPromptable: true, group: "Header" },
    ...photoFields(1),
    ...photoFields(2),
    ...photoFields(3),
    ...photoFields(4),
    ...photoFields(5),
    ...photoFields(6),
    ...photoFields(7),
    ...photoFields(8),
    { key: "showSeeAll", label: "Show See-all button", type: { kind: "boolean" }, default: true, group: "Footer" },
    { key: "seeAllLabel", label: "See-all button text", type: { kind: "text", maxLength: 24 }, default: "See every job", priority: "button", group: "Footer" },
    { key: "seeAllHref", label: "See-all button link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "/portfolio", group: "Footer" }
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain:
      "Explain why a photo grid works for photo-heavy UK trades. Reference the specific layout choices (uniform tiles, 4-col desktop).",
    improve:
      "Improve without layout change. Headline under 6 words. See-all label verb-first. Return only patched config.",
    rewrite:
      "Rewrite the headline in a {tone} voice.",
    suggestAlternative:
      "Suggest an alternative gallery layout from library='gallery'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail:
    "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/gallery-grid-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 1200 },
    accessibility: { contrastMin: 4.5, requiredAlt: ["p1Alt", "p2Alt", "p3Alt", "p4Alt", "p5Alt", "p6Alt", "p7Alt", "p8Alt"] },
    sales: { socialProofRecommended: true },
    seo: { headingLevel: 2 },
    mobile: { noHorizontalScroll: true },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: [
    "gallery",
    "grid",
    "uniform_tiles",
    "eight_slots",
    "photo_heavy"
  ],
  bestForVerticals: [
    "landscaping",
    "joinery",
    "tiling",
    "kitchen_install",
    "bathroom_install",
    "roofing",
    "carpentry",
    "brickwork",
    "plastering"
  ],
  defaultConfig: () => ({
    eyebrow: "Recent work",
    heading: "The last eight jobs.",
    p1ImageUrl: "", p1Alt: "",
    p2ImageUrl: "", p2Alt: "",
    p3ImageUrl: "", p3Alt: "",
    p4ImageUrl: "", p4Alt: "",
    p5ImageUrl: "", p5Alt: "",
    p6ImageUrl: "", p6Alt: "",
    p7ImageUrl: "", p7Alt: "",
    p8ImageUrl: "", p8Alt: "",
    showSeeAll: true,
    seeAllLabel: "See every job",
    seeAllHref: "/portfolio"
  }),
  renderer: GalleryGrid
};

sectionRegistry.register(registration);
