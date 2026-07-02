// product_grid.classic_3col_1 — 6-tile 3-column product grid.
//
// Fixed 6 product slots keeps the schema flat (one editableField per
// property × per slot). Each tile's image is a separate DOM element
// with priority="image", so Module 7's picker + upload works per-tile
// without new plumbing. Header carries an optional "See all" CTA
// pointing at a catalogue page.
//
// For merchants who need dynamic product feeds (real inventory), a
// future product_grid.data_driven_1 registration will read from
// data.domain.products — the shell contract is stable so both
// registrations can coexist.

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
  showSeeAll: boolean;
  seeAllLabel: string;
  seeAllHref: string;
  p1Name: string; p1Price: string; p1ImageUrl: string; p1Href: string;
  p2Name: string; p2Price: string; p2ImageUrl: string; p2Href: string;
  p3Name: string; p3Price: string; p3ImageUrl: string; p3Href: string;
  p4Name: string; p4Price: string; p4ImageUrl: string; p4Href: string;
  p5Name: string; p5Price: string; p5ImageUrl: string; p5Href: string;
  p6Name: string; p6Price: string; p6ImageUrl: string; p6Href: string;
};

function ProductGridClassic({
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

  type Product = {
    i: Slot;
    name: string;
    price: string;
    imageUrl: string;
    href: string;
  };
  const productSlots: Product[] = [
    { i: 1, name: config.p1Name, price: config.p1Price, imageUrl: config.p1ImageUrl, href: config.p1Href },
    { i: 2, name: config.p2Name, price: config.p2Price, imageUrl: config.p2ImageUrl, href: config.p2Href },
    { i: 3, name: config.p3Name, price: config.p3Price, imageUrl: config.p3ImageUrl, href: config.p3Href },
    { i: 4, name: config.p4Name, price: config.p4Price, imageUrl: config.p4ImageUrl, href: config.p4Href },
    { i: 5, name: config.p5Name, price: config.p5Price, imageUrl: config.p5ImageUrl, href: config.p5Href },
    { i: 6, name: config.p6Name, price: config.p6Price, imageUrl: config.p6ImageUrl, href: config.p6Href }
  ];
  const products = productSlots.filter((p) => p.name);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "product_grid.classic_3col_1", "Product grid")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
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
            <h2
              className="mt-2 text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
              {...treeAttrs(instanceId, "heading", "Main headline", "text")}
            >
              {config.heading}
            </h2>
          </div>
          {config.showSeeAll && config.seeAllLabel && (
            <Link
              href={config.seeAllHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-110"
              style={{ background: "#0A0A0A" }}
              {...treeAttrs(instanceId, "seeAllLabel", "See-all button", "button")}
            >
              {config.seeAllLabel} →
            </Link>
          )}
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.i}>
              <Link
                href={p.href || "#"}
                tabIndex={isEditing ? -1 : undefined}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"
              >
                <span className="relative block aspect-square w-full overflow-hidden bg-neutral-100">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                      {...treeAttrs(instanceId, `p${p.i}ImageUrl`, `Product ${p.i} photo`, "image")}
                    />
                  ) : (
                    <span
                      className="absolute inset-0 grid place-items-center text-[10px] font-extrabold uppercase tracking-widest text-neutral-400"
                      {...treeAttrs(instanceId, `p${p.i}ImageUrl`, `Product ${p.i} photo`, "image")}
                    >
                      + Photo
                    </span>
                  )}
                  {p.price && (
                    <span
                      className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 shadow-sm"
                      style={{ background: accent }}
                      {...treeAttrs(instanceId, `p${p.i}Price`, `Product ${p.i} price`, "text")}
                    >
                      {p.price}
                    </span>
                  )}
                </span>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p
                    className="text-[13px] leading-tight"
                    style={{
                      fontFamily: headingFont,
                      fontWeight: headingWeight ?? 800,
                      color: text
                    }}
                    {...treeAttrs(instanceId, `p${p.i}Name`, `Product ${p.i} name`, "text")}
                  >
                    {p.name}
                  </p>
                  <p
                    className="mt-auto text-[10px] font-extrabold uppercase tracking-widest transition group-hover:text-neutral-900"
                    style={{
                      color: muted,
                      fontFamily: bodyFont,
                      fontWeight: bodyWeight ?? 500
                    }}
                  >
                    View →
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

const productFields = (i: Slot, name: string, price: string) => [
  { key: `p${i}Name`, label: `Product ${i} name`, type: { kind: "text" as const, maxLength: 60 }, default: name, priority: "text" as const, aiPromptable: true, group: `Product ${i}` },
  { key: `p${i}Price`, label: `Product ${i} price`, type: { kind: "text" as const, maxLength: 24 }, default: price, priority: "text" as const, description: "e.g. £120 / day, From £45, POA", group: `Product ${i}` },
  { key: `p${i}ImageUrl`, label: `Product ${i} photo`, type: { kind: "image" as const, aspectRatio: "1/1", recommendedWidthPx: 800 }, default: "", priority: "image" as const, group: `Product ${i}` },
  { key: `p${i}Href`, label: `Product ${i} link`, type: { kind: "link" as const, allowInternal: true, allowExternal: true }, default: "#", group: `Product ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "product_grid.classic_3col_1",
  name: "3-column product grid",
  version: "1.0.0",
  library: "product_grid",
  description:
    "Six product cards in a 3-column grid. Photo, name, price pill, view-through link. Best for merchants with a compact catalogue — plant hire fleet, key blanks, spare parts, tool hire, hardware.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Featured", priority: "text", group: "Header" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "What we hire the most.", priority: "text", aiPromptable: true, group: "Header" },
    { key: "showSeeAll", label: "Show See-all button", type: { kind: "boolean" }, default: true, group: "Header" },
    { key: "seeAllLabel", label: "See-all button text", type: { kind: "text", maxLength: 24 }, default: "See the full range", priority: "button", group: "Header" },
    { key: "seeAllHref", label: "See-all button link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "/products", group: "Header" },
    ...productFields(1, "0.8 tonne micro-excavator", "£85 / day"),
    ...productFields(2, "1.5 tonne mini-excavator", "£110 / day"),
    ...productFields(3, "3 tonne excavator", "£165 / day"),
    ...productFields(4, "8 tonne dumper", "£140 / day"),
    ...productFields(5, "6-inch petrol whacker", "£45 / day"),
    ...productFields(6, "Diamond floor saw", "£70 / day")
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain:
      "Explain why a 3-column product grid works for UK trade merchants. Reference the specific products.",
    improve:
      "Improve without layout change. Product names under 5 words. Prices formatted consistently. Return only patched config.",
    rewrite:
      "Rewrite product names in a {tone} voice. Prices stay factual.",
    suggestAlternative:
      "Suggest an alternative product-grid layout from library='product_grid'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail:
    "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/product-grid-classic-3col-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 600 },
    accessibility: { contrastMin: 4.5, requiredAlt: ["p1ImageUrl", "p2ImageUrl", "p3ImageUrl", "p4ImageUrl", "p5ImageUrl", "p6ImageUrl"] },
    sales: { primaryActionRequired: true, socialProofRecommended: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: [
    "product_grid",
    "three_column",
    "six_tiles",
    "price_pill",
    "e_commerce"
  ],
  bestForVerticals: [
    "plant_hire",
    "tool_hire",
    "building_merchant",
    "key_cutting",
    "spare_parts",
    "hardware"
  ],
  defaultConfig: () => ({
    eyebrow: "Featured",
    heading: "What we hire the most.",
    showSeeAll: true,
    seeAllLabel: "See the full range",
    seeAllHref: "/products",
    p1Name: "0.8 tonne micro-excavator", p1Price: "£85 / day", p1ImageUrl: "", p1Href: "#",
    p2Name: "1.5 tonne mini-excavator", p2Price: "£110 / day", p2ImageUrl: "", p2Href: "#",
    p3Name: "3 tonne excavator", p3Price: "£165 / day", p3ImageUrl: "", p3Href: "#",
    p4Name: "8 tonne dumper", p4Price: "£140 / day", p4ImageUrl: "", p4Href: "#",
    p5Name: "6-inch petrol whacker", p5Price: "£45 / day", p5ImageUrl: "", p5Href: "#",
    p6Name: "Diamond floor saw", p6Price: "£70 / day", p6ImageUrl: "", p6Href: "#"
  }),
  renderer: ProductGridClassic
};

sectionRegistry.register(registration);
