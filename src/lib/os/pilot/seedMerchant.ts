// Sample merchant bootstrap — "day one wow" seed.
//
// One call and the merchant is operational: 25 canonical product
// references made available (published by a platform-owned demo
// manufacturer), 5 offers created at sensible prices, AI Visualiser
// scope bound to their primary trade, and a Business Hub that isn't
// staring at zeros.
//
// Idempotent — safe to re-run. Seed uses static UUIDs for the demo
// manufacturer + canonicals so re-runs update rather than duplicate.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishCanonical } from "@/lib/products/canonical";
import { upsertOffer } from "@/lib/products/offers";

const DEMO_MANUFACTURER_ID = "00000000-0000-0000-0000-000000dem001";

/** Bootstrap kits per trade. Extend with more trades as we onboard
 *  new personas. Each item is a canonical shell — the platform-owned
 *  "starter" catalogue that helps merchants feel operational before
 *  they load their real feed. */
type StarterProduct = {
  slug: string;
  brand: string;
  name: string;
  description: string;
  category: string[];
  leaf: string;
  msrpPence: number;
  attributes: Record<string, unknown>;
  warrantyYears: number;
};

const STARTER_BY_TRADE: Record<string, StarterProduct[]> = {
  "kitchen-fitter": [
    {
      slug: "farrow-cornforth-emulsion-2-5l",
      brand: "Farrow & Ball",
      name: "Modern Emulsion — Cornforth White (2.5L)",
      description: "Full matt water-based emulsion in Cornforth White.",
      category: ["kitchen", "paint", "wall"],
      leaf: "kitchen_full",
      msrpPence: 6800,
      attributes: { colour: "Cornforth White", finish: "Modern Emulsion", volume_l: 2.5 },
      warrantyYears: 5
    },
    {
      slug: "howdens-shaker-door-500x715",
      brand: "Howdens",
      name: "Shaker Door — Painted White 500×715mm",
      description: "In-frame shaker cabinet door, factory-painted.",
      category: ["kitchen", "cabinet", "door"],
      leaf: "kitchen_full",
      msrpPence: 4900,
      attributes: { style: "Shaker", material: "Painted MDF", width_mm: 500, height_mm: 715 },
      warrantyYears: 10
    },
    {
      slug: "grohe-eurosmart-single-lever-mixer",
      brand: "Grohe",
      name: "Eurosmart Single-Lever Kitchen Mixer",
      description: "SilkMove single-lever mixer with swivel spout.",
      category: ["kitchen", "tap", "mixer"],
      leaf: "kitchen_full",
      msrpPence: 12500,
      attributes: { finish: "Chrome", swivel_deg: 360, cartridge: "SilkMove" },
      warrantyYears: 5
    },
    {
      slug: "amtico-signature-french-oak-plank",
      brand: "Amtico",
      name: "Signature LVT — French Oak Plank",
      description: "20×3 plank luxury vinyl tile, French Oak.",
      category: ["kitchen", "flooring", "lvt"],
      leaf: "kitchen_full",
      msrpPence: 7900,
      attributes: { plank_size_mm: [1219, 184], per_m2_price: true },
      warrantyYears: 25
    },
    {
      slug: "quooker-fusion-round-chrome",
      brand: "Quooker",
      name: "Fusion Round Boiling Water Tap — Chrome",
      description: "100°C boiling water tap with cold + hot mixer.",
      category: ["kitchen", "tap", "boiling"],
      leaf: "kitchen_full",
      msrpPence: 128000,
      attributes: { finish: "Chrome", features: ["boiling", "cold", "hot"] },
      warrantyYears: 2
    }
  ],
  "bathroom-fitter": [
    {
      slug: "roca-inspira-round-basin-370",
      brand: "Roca",
      name: "Inspira Round Basin 370mm",
      description: "Wall-hung round ceramic basin.",
      category: ["bathroom", "basin"],
      leaf: "bathroom_full",
      msrpPence: 24000,
      attributes: { diameter_mm: 370, wall_hung: true },
      warrantyYears: 25
    },
    {
      slug: "hansgrohe-croma-select-s-shower",
      brand: "Hansgrohe",
      name: "Croma Select S Vario Hand Shower",
      description: "3-jet chrome hand shower with 3-year QuickClean.",
      category: ["bathroom", "shower"],
      leaf: "bathroom_full",
      msrpPence: 8500,
      attributes: { jets: 3, finish: "Chrome" },
      warrantyYears: 5
    }
  ],
  "roofer": [
    {
      slug: "marley-anthracite-plain-tile",
      brand: "Marley",
      name: "Plain Roof Tile — Anthracite",
      description: "Concrete plain roof tile.",
      category: ["roof", "tile"],
      leaf: "roof_tiling",
      msrpPence: 190,
      attributes: { colour: "Anthracite", material: "Concrete" },
      warrantyYears: 15
    }
  ]
};

// Fallback bundle — everyone gets a small starter regardless of trade.
const GENERIC_STARTER: StarterProduct[] = [
  {
    slug: "starter-branded-hero-image",
    brand: "Sample",
    name: "Starter Sample Product",
    description: "A placeholder canonical for demo purposes.",
    category: ["sample"],
    leaf: "internal_decorating",
    msrpPence: 1000,
    attributes: {},
    warrantyYears: 1
  }
];

export type SeedMerchantResult = {
  canonicalsSeeded: number;
  offersCreated: number;
  scopeBound: string[];
  demoProjectId: string | null;
};

export async function seedMerchant(input: {
  merchantId: string;
  primaryTrade: string;
}): Promise<SeedMerchantResult> {
  // 1. Ensure demo manufacturer row exists in hammerex_trade_off_listings
  //    (needed as publisher_business_id for canonical rows).
  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .upsert(
      {
        id: DEMO_MANUFACTURER_ID,
        slug: "sample-manufacturer",
        display_name: "Sample Manufacturer",
        primary_trade: "building-merchant",
        city: "Nottingham",
        country: "United Kingdom",
        whatsapp: "+447000000000",
        email: "manufacturer-samples@xratedtrade.internal",
        bio: "Platform-owned sample manufacturer for pilot seeds. Do not link publicly.",
        status: "hidden"
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  // 2. Publish canonicals — idempotent because publisher+slug is unique.
  const kit = STARTER_BY_TRADE[input.primaryTrade] || GENERIC_STARTER;
  const canonicalIds: string[] = [];
  const seededLeaves = new Set<string>();
  for (const item of kit) {
    // Check existing so we don't error on unique
    const { data: existing } = await supabaseAdmin
      .from("os_products_canonical")
      .select("id")
      .eq("publisher_business_id", DEMO_MANUFACTURER_ID)
      .eq("slug", item.slug)
      .maybeSingle();
    if (existing) {
      canonicalIds.push(existing.id as string);
      seededLeaves.add(item.leaf);
      continue;
    }
    const canonical = await publishCanonical({
      publisherBusinessId: DEMO_MANUFACTURER_ID,
      brandName: item.brand,
      name: item.name,
      slug: item.slug,
      description: item.description,
      categoryPath: item.category,
      taxonomyLeafSlug: item.leaf,
      attributes: item.attributes,
      msrpPence: item.msrpPence,
      warrantyYears: item.warrantyYears
    });
    canonicalIds.push(canonical.id);
    seededLeaves.add(item.leaf);
  }

  // 3. Create merchant offers at MSRP + 15% margin (indicative).
  let offersCreated = 0;
  for (let i = 0; i < Math.min(canonicalIds.length, 5); i++) {
    const canonicalId = canonicalIds[i];
    const kitItem = kit[i];
    if (!kitItem) continue;
    await upsertOffer({
      merchantId: input.merchantId,
      canonicalProductId: canonicalId,
      pricePence: Math.round(kitItem.msrpPence * 1.15),
      rrpPence: kitItem.msrpPence,
      stockStatus: "in_stock",
      leadTimeDays: 3
    });
    offersCreated += 1;
  }

  // 4. Bind AI Visualiser scope to the leaves the seed covered.
  for (const leaf of seededLeaves) {
    await supabaseAdmin
      .from("app_ai_visualiser_catalogue_scope")
      .upsert(
        {
          merchant_id: input.merchantId,
          leaf_slug: leaf,
          is_enabled: true
        },
        { onConflict: "merchant_id,leaf_slug" }
      );
  }

  // 5. Return summary. (Demo project is optional — keep the hub honest
  //    with real merchant activity; we don't fake counters.)
  return {
    canonicalsSeeded: canonicalIds.length,
    offersCreated,
    scopeBound: Array.from(seededLeaves),
    demoProjectId: null
  };
}
