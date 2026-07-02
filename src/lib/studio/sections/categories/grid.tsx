// categories.grid_1 — 6-tile category navigation grid.
//
// Category tiles route customers to hub pages. Distinct from
// product_grid (which links to individual products) — categories point
// merchants who sell across a range at a natural top-level nav
// (plant hire fleet → excavators / dumpers / rollers / access / etc.).
//
// Each tile has an image (or placeholder in edit mode), category name,
// optional item count line, and a link. 3-col desktop, 2-col mobile.

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Slot = 1 | 2 | 3 | 4 | 5 | 6;

type Config = {
  eyebrow: string;
  heading: string;
  c1ImageUrl: string; c1Name: string; c1Count: string; c1Href: string;
  c2ImageUrl: string; c2Name: string; c2Count: string; c2Href: string;
  c3ImageUrl: string; c3Name: string; c3Count: string; c3Href: string;
  c4ImageUrl: string; c4Name: string; c4Count: string; c4Href: string;
  c5ImageUrl: string; c5Name: string; c5Count: string; c5Href: string;
  c6ImageUrl: string; c6Name: string; c6Count: string; c6Href: string;
};

function CategoriesGrid({
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
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;
  const isEditing = mode === "edit";

  type Cat = {
    i: Slot;
    image: string;
    name: string;
    count: string;
    href: string;
  };
  const slots: Cat[] = [
    { i: 1, image: config.c1ImageUrl, name: config.c1Name, count: config.c1Count, href: config.c1Href },
    { i: 2, image: config.c2ImageUrl, name: config.c2Name, count: config.c2Count, href: config.c2Href },
    { i: 3, image: config.c3ImageUrl, name: config.c3Name, count: config.c3Count, href: config.c3Href },
    { i: 4, image: config.c4ImageUrl, name: config.c4Name, count: config.c4Count, href: config.c4Href },
    { i: 5, image: config.c5ImageUrl, name: config.c5Name, count: config.c5Count, href: config.c5Href },
    { i: 6, image: config.c6ImageUrl, name: config.c6Name, count: config.c6Count, href: config.c6Href }
  ];
  const cats = isEditing ? slots : slots.filter((c) => c.name);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "categories.grid_1", "Categories")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {(config.eyebrow || config.heading) && (
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
          </div>
        )}

        <ul
          className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 ${
            config.eyebrow || config.heading ? "mt-8" : ""
          }`}
        >
          {cats.map((c) => (
            <li key={c.i}>
              <Link
                href={c.href || "#"}
                tabIndex={isEditing ? -1 : undefined}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image}
                      alt={c.name || `Category ${c.i}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                      {...treeAttrs(instanceId, `c${c.i}ImageUrl`, `Category ${c.i} image`, "image")}
                    />
                  ) : (
                    <span
                      className="absolute inset-0 grid place-items-center text-[10px] font-extrabold uppercase tracking-widest text-neutral-400"
                      {...treeAttrs(instanceId, `c${c.i}ImageUrl`, `Category ${c.i} image`, "image")}
                    >
                      + Photo
                    </span>
                  )}
                </span>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p
                    className="text-[15px] leading-tight"
                    style={{
                      fontFamily: headingFont,
                      fontWeight: headingWeight ?? 800,
                      color: text
                    }}
                    {...treeAttrs(instanceId, `c${c.i}Name`, `Category ${c.i} name`, "text")}
                  >
                    {c.name}
                  </p>
                  {c.count && (
                    <p
                      className="text-[11px] font-bold uppercase tracking-widest"
                      style={{
                        color: muted,
                        fontFamily: bodyFont,
                        fontWeight: bodyWeight ?? 500
                      }}
                      {...treeAttrs(instanceId, `c${c.i}Count`, `Category ${c.i} count`, "text")}
                    >
                      {c.count}
                    </p>
                  )}
                  <p
                    className="mt-auto text-[10px] font-extrabold uppercase tracking-widest transition group-hover:text-neutral-900"
                    style={{ color: muted }}
                  >
                    Browse →
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const catFields = (i: Slot, name: string, count: string) => [
  { key: `c${i}ImageUrl`, label: `Category ${i} image`, type: { kind: "image" as const, aspectRatio: "4/3", recommendedWidthPx: 800 }, default: "", priority: "image" as const, group: `Category ${i}` },
  { key: `c${i}Name`, label: `Category ${i} name`, type: { kind: "text" as const, maxLength: 40 }, default: name, priority: "text" as const, aiPromptable: true, group: `Category ${i}` },
  { key: `c${i}Count`, label: `Category ${i} item count (optional)`, type: { kind: "text" as const, maxLength: 40 }, default: count, priority: "text" as const, description: 'e.g. "12 models", "18 SKUs"', group: `Category ${i}` },
  { key: `c${i}Href`, label: `Category ${i} link`, type: { kind: "link" as const, allowInternal: true, allowExternal: true }, default: "#", group: `Category ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "categories.grid_1",
  name: "Categories grid",
  version: "1.0.0",
  library: "categories",
  description:
    "Six category tiles for top-level navigation. Image, name, optional item count, link. Best for merchants with a range wide enough to warrant hub pages — plant hire (excavators / dumpers / rollers), builders' merchant (bricks / timber / insulation), tool hire.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker (optional)", type: { kind: "text", maxLength: 40 }, default: "Shop by category", priority: "text", group: "Header" },
    { key: "heading", label: "Main headline (optional)", type: { kind: "text", maxLength: 120 }, default: "What are you looking for?", priority: "text", aiPromptable: true, group: "Header" },
    ...catFields(1, "Excavators", "18 models"),
    ...catFields(2, "Dumpers", "12 models"),
    ...catFields(3, "Access platforms", "9 models"),
    ...catFields(4, "Rollers", "7 models"),
    ...catFields(5, "Attachments", "42 SKUs"),
    ...catFields(6, "Consumables", "180 SKUs")
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain: "Explain why a categories grid works for a UK trade merchant with a wide range. Reference specific category names.",
    improve: "Improve without layout change. Category names under 3 words. Count lines specific. Return only patched config.",
    rewrite: "Rewrite category names in a {tone} voice. Counts stay factual.",
    suggestAlternative: "Suggest an alternative categories layout from library='categories'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/categories-grid-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 800 },
    accessibility: { contrastMin: 4.5, requiredAlt: [] },
    sales: { primaryActionRequired: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["categories", "grid", "six_tiles", "navigation", "hub_pages"],
  bestForVerticals: ["plant_hire", "tool_hire", "building_merchant", "key_cutting", "spare_parts", "hardware"],
  defaultConfig: () => ({
    eyebrow: "Shop by category",
    heading: "What are you looking for?",
    c1ImageUrl: "", c1Name: "Excavators", c1Count: "18 models", c1Href: "#",
    c2ImageUrl: "", c2Name: "Dumpers", c2Count: "12 models", c2Href: "#",
    c3ImageUrl: "", c3Name: "Access platforms", c3Count: "9 models", c3Href: "#",
    c4ImageUrl: "", c4Name: "Rollers", c4Count: "7 models", c4Href: "#",
    c5ImageUrl: "", c5Name: "Attachments", c5Count: "42 SKUs", c5Href: "#",
    c6ImageUrl: "", c6Name: "Consumables", c6Count: "180 SKUs", c6Href: "#"
  }),
  renderer: CategoriesGrid
};

sectionRegistry.register(registration);
