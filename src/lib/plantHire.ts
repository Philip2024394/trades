// Plant Hire service — shared types + defaults used by the public
// sub-page, the merchant editor, and the profile hero-adjacent card.
//
// Rate model: pence per day / week / month, PLUS an optional operator
// premium (also pence per day). Weekend and bank-holiday multipliers
// live on the config, not per category, because they're set-once
// policies rather than per-machine numbers.

export type PlantCategorySlug =
  | "mini_excavator"
  | "midi_excavator"
  | "backhoe_loader"
  | "wheel_loader"
  | "bulldozer"
  | "grader"
  | "dumper"
  | "tracked_dumper"
  | "articulated_dumper"
  | "telehandler"
  | "forklift"
  | "roller"
  | "plate_compactor"
  | "trench_rammer"
  | "scissor_lift"
  | "cherry_picker"
  | "skid_steer"
  | "breaker"
  | "generator"
  | "compressor"
  | "water_bowser"
  | "space_heater"
  | "concrete_mixer"
  | "concrete_pump"
  | "wood_chipper"
  | "trencher"
  | "floor_saw"
  | "flail_mower"
  | "plant_trailer"
  | "welfare_unit"
  | "attachments";

export const PLANT_CATEGORIES: {
  slug: PlantCategorySlug;
  label: string;
  short_desc: string;
  default_day_pence: number;
  default_week_pence: number;
  default_month_pence: number;
  default_operator_pence: number;
  emoji: string;
  cart_default_on: boolean;
}[] = [
  {
    slug: "mini_excavator",
    label: "Mini excavator (0.8–3T)",
    short_desc: "Micro diggers and mini excavators for gardens, footings and drainage.",
    default_day_pence: 12000,
    default_week_pence: 45000,
    default_month_pence: 135000,
    default_operator_pence: 20000,
    emoji: "🚜",
    cart_default_on: true
  },
  {
    slug: "midi_excavator",
    label: "Midi / large excavator (5T+)",
    short_desc: "5T–14T tracked excavators for site clearance, drainage and bulk dig.",
    default_day_pence: 22000,
    default_week_pence: 80000,
    default_month_pence: 250000,
    default_operator_pence: 22000,
    emoji: "🚧",
    cart_default_on: true
  },
  {
    slug: "backhoe_loader",
    label: "Backhoe loader (JCB 3CX)",
    short_desc: "Front-bucket loader with rear digging arm. Roadable and versatile.",
    default_day_pence: 20000,
    default_week_pence: 65000,
    default_month_pence: 195000,
    default_operator_pence: 22000,
    emoji: "🚜",
    cart_default_on: true
  },
  {
    slug: "wheel_loader",
    label: "Wheel loader",
    short_desc: "Compact articulated loaders for yard stockpile handling and site loading.",
    default_day_pence: 18000,
    default_week_pence: 60000,
    default_month_pence: 180000,
    default_operator_pence: 22000,
    emoji: "🚜",
    cart_default_on: true
  },
  {
    slug: "bulldozer",
    label: "Bulldozer",
    short_desc: "Tracked dozers for site strip, levelling and bulk earth-moving.",
    default_day_pence: 40000,
    default_week_pence: 140000,
    default_month_pence: 420000,
    default_operator_pence: 25000,
    emoji: "🚜",
    cart_default_on: true
  },
  {
    slug: "grader",
    label: "Motor grader",
    short_desc: "Six-wheel motor graders for road formation, haul-road prep and levelling.",
    default_day_pence: 45000,
    default_week_pence: 160000,
    default_month_pence: 480000,
    default_operator_pence: 25000,
    emoji: "🛠️",
    cart_default_on: true
  },
  {
    slug: "dumper",
    label: "Site dumper (1–3T)",
    short_desc: "Skip loader and swivel dumpers — muck-away and materials on-site.",
    default_day_pence: 9000,
    default_week_pence: 30000,
    default_month_pence: 90000,
    default_operator_pence: 18000,
    emoji: "🛻",
    cart_default_on: true
  },
  {
    slug: "tracked_dumper",
    label: "Tracked dumper (2.5–6T)",
    short_desc: "Rubber-tracked carriers for soft ground and boggy sites.",
    default_day_pence: 14000,
    default_week_pence: 45000,
    default_month_pence: 135000,
    default_operator_pence: 20000,
    emoji: "🛻",
    cart_default_on: true
  },
  {
    slug: "articulated_dumper",
    label: "Articulated dump truck",
    short_desc: "6×6 articulated haulers (20–40T) for bulk earthworks and quarry haul.",
    default_day_pence: 55000,
    default_week_pence: 190000,
    default_month_pence: 560000,
    default_operator_pence: 25000,
    emoji: "🚛",
    cart_default_on: true
  },
  {
    slug: "telehandler",
    label: "Telehandler",
    short_desc: "Manitou / Merlo variable-reach handlers — load, lift and place pallets.",
    default_day_pence: 20000,
    default_week_pence: 70000,
    default_month_pence: 220000,
    default_operator_pence: 22000,
    emoji: "🏗️",
    cart_default_on: true
  },
  {
    slug: "forklift",
    label: "Forklift (counterbalance)",
    short_desc: "Counterbalance forklifts for yard pallet handling, container work and warehousing.",
    default_day_pence: 8000,
    default_week_pence: 26000,
    default_month_pence: 75000,
    default_operator_pence: 18000,
    emoji: "🚛",
    cart_default_on: true
  },
  {
    slug: "roller",
    label: "Ride-on roller",
    short_desc: "Single-drum and tandem rollers — sub-base compaction and tarmac.",
    default_day_pence: 10000,
    default_week_pence: 32000,
    default_month_pence: 95000,
    default_operator_pence: 18000,
    emoji: "🛞",
    cart_default_on: true
  },
  {
    slug: "plate_compactor",
    label: "Plate compactor",
    short_desc: "Pedestrian plate compactors — path prep, block paving, sub-base finish.",
    default_day_pence: 3500,
    default_week_pence: 11000,
    default_month_pence: 32000,
    default_operator_pence: 0,
    emoji: "⏹️",
    cart_default_on: true
  },
  {
    slug: "trench_rammer",
    label: "Trench rammer (whacker)",
    short_desc: "Upright rammers for narrow-trench compaction and utility backfill.",
    default_day_pence: 4000,
    default_week_pence: 12000,
    default_month_pence: 35000,
    default_operator_pence: 0,
    emoji: "⬇️",
    cart_default_on: true
  },
  {
    slug: "scissor_lift",
    label: "Scissor lift (MEWP)",
    short_desc: "Electric and diesel scissors for indoor and site access work.",
    default_day_pence: 12000,
    default_week_pence: 38000,
    default_month_pence: 110000,
    default_operator_pence: 0,
    emoji: "📶",
    cart_default_on: true
  },
  {
    slug: "cherry_picker",
    label: "Cherry picker / boom",
    short_desc: "Articulated and straight booms — signage, roofing and tree work.",
    default_day_pence: 18000,
    default_week_pence: 55000,
    default_month_pence: 165000,
    default_operator_pence: 20000,
    emoji: "🍒",
    cart_default_on: true
  },
  {
    slug: "skid_steer",
    label: "Skid steer / mini loader",
    short_desc: "Compact Bobcats — tight-access loading, sweeping and landscaping.",
    default_day_pence: 14000,
    default_week_pence: 45000,
    default_month_pence: 135000,
    default_operator_pence: 20000,
    emoji: "🛴",
    cart_default_on: true
  },
  {
    slug: "breaker",
    label: "Breaker (hydraulic / hand-held)",
    short_desc: "Hand-held Kango breakers and hydraulic attachments for excavators.",
    default_day_pence: 4000,
    default_week_pence: 12000,
    default_month_pence: 35000,
    default_operator_pence: 0,
    emoji: "🔨",
    cart_default_on: true
  },
  {
    slug: "generator",
    label: "Generator (portable / towable)",
    short_desc: "Petrol and diesel gennies — site power from 2kVA up to 60kVA.",
    default_day_pence: 5000,
    default_week_pence: 15000,
    default_month_pence: 45000,
    default_operator_pence: 0,
    emoji: "⚡",
    cart_default_on: true
  },
  {
    slug: "compressor",
    label: "Air compressor (towable)",
    short_desc: "Diesel road-towable compressors — breaker air, sandblasting, tool power.",
    default_day_pence: 8000,
    default_week_pence: 24000,
    default_month_pence: 72000,
    default_operator_pence: 0,
    emoji: "💨",
    cart_default_on: true
  },
  {
    slug: "water_bowser",
    label: "Water bowser (towable)",
    short_desc: "Towable water tanks — dust suppression, mixer feed, site washdown.",
    default_day_pence: 4500,
    default_week_pence: 14000,
    default_month_pence: 42000,
    default_operator_pence: 0,
    emoji: "🚰",
    cart_default_on: true
  },
  {
    slug: "space_heater",
    label: "Space heater (diesel)",
    short_desc: "Direct-fired diesel heaters — winter drying, curing, tented sites.",
    default_day_pence: 3500,
    default_week_pence: 11000,
    default_month_pence: 32000,
    default_operator_pence: 0,
    emoji: "🔥",
    cart_default_on: true
  },
  {
    slug: "concrete_mixer",
    label: "Concrete mixer (towable)",
    short_desc: "Diesel drum mixers — small-batch pours, footings, path work.",
    default_day_pence: 4500,
    default_week_pence: 13000,
    default_month_pence: 40000,
    default_operator_pence: 0,
    emoji: "🧱",
    cart_default_on: true
  },
  {
    slug: "concrete_pump",
    label: "Concrete pump",
    short_desc: "Trailer-mounted pumps — precast pours, footings, screed placement.",
    default_day_pence: 30000,
    default_week_pence: 105000,
    default_month_pence: 315000,
    default_operator_pence: 22000,
    emoji: "🧱",
    cart_default_on: true
  },
  {
    slug: "wood_chipper",
    label: "Wood chipper",
    short_desc: "Diesel and PTO chippers — tree surgery, site clearance, hedge work.",
    default_day_pence: 12000,
    default_week_pence: 40000,
    default_month_pence: 120000,
    default_operator_pence: 20000,
    emoji: "🪵",
    cart_default_on: true
  },
  {
    slug: "trencher",
    label: "Trencher / stump grinder",
    short_desc: "Tracked trenchers and stump grinders — utility runs, root removal.",
    default_day_pence: 12000,
    default_week_pence: 40000,
    default_month_pence: 120000,
    default_operator_pence: 20000,
    emoji: "🪓",
    cart_default_on: true
  },
  {
    slug: "floor_saw",
    label: "Floor saw",
    short_desc: "Petrol and diesel floor saws — concrete cutting, asphalt joints.",
    default_day_pence: 5500,
    default_week_pence: 17000,
    default_month_pence: 50000,
    default_operator_pence: 0,
    emoji: "🪚",
    cart_default_on: true
  },
  {
    slug: "flail_mower",
    label: "Compact tractor + flail mower",
    short_desc: "Tractor-mounted flail mowers — verges, land clearance, estate work.",
    default_day_pence: 18000,
    default_week_pence: 60000,
    default_month_pence: 180000,
    default_operator_pence: 22000,
    emoji: "🌾",
    cart_default_on: true
  },
  {
    slug: "plant_trailer",
    label: "Plant trailer (low-loader)",
    short_desc: "3-axle low-loader trailers for self-move of plant between sites.",
    default_day_pence: 8000,
    default_week_pence: 26000,
    default_month_pence: 78000,
    default_operator_pence: 0,
    emoji: "🚚",
    cart_default_on: true
  },
  {
    slug: "welfare_unit",
    label: "Welfare / site accommodation",
    short_desc: "Mobile welfare cabins with WC, kitchen and drying area.",
    default_day_pence: 9000,
    default_week_pence: 28000,
    default_month_pence: 85000,
    default_operator_pence: 0,
    emoji: "🏠",
    cart_default_on: true
  },
  {
    slug: "attachments",
    label: "Attachments (buckets / augers / grabs)",
    short_desc: "Buckets, augers, thumbs and grabs to bolt onto a machine you already have.",
    default_day_pence: 3000,
    default_week_pence: 9000,
    default_month_pence: 25000,
    default_operator_pence: 0,
    emoji: "🪝",
    cart_default_on: true
  }
];

export function isCategoryCartEnabled(
  cfg: Partial<PlantCategoryConfig> | undefined,
  meta: (typeof PLANT_CATEGORIES)[number]
): boolean {
  if (cfg?.cart_enabled === true) return true;
  if (cfg?.cart_enabled === false) return false;
  return meta.cart_default_on;
}

export type PlantSpec = {
  weight_kg?: number | null;
  dig_depth_mm?: number | null;
  reach_mm?: number | null;
  hp?: number | null;
  bucket_l?: number | null;
  transport_length_mm?: number | null;
  transport_width_mm?: number | null;
  transport_height_mm?: number | null;
  fuel_type?: "diesel" | "petrol" | "electric" | "hybrid" | "";
  emission?: "stage_v" | "stage_iiib" | "euro_6" | "";
  /** Operator ear-level noise in dB(A). */
  noise_db_operator?: number | null;
  /** Bystander-perceived (LWA) noise in dB(A). */
  noise_db_bystander?: number | null;
  /** Ground-pressure in kPa — matters for landscaping/soft-ground. */
  ground_pressure_kpa?: number | null;
  /** Fuel tank capacity in litres. */
  fuel_tank_l?: number | null;
  /** Typical run-time per tank in hours. */
  run_time_hours?: number | null;
  /** ULEZ compliance — matters for London / Birmingham / Bath work. */
  ulez_compliant?: boolean | null;
};

export type PlantReview = {
  author: string;
  rating: number; // 1-5 (overall — auto or manual)
  text: string;
  date: string; // YYYY-MM-DD
  /** Reviewer avatar / profile picture URL. */
  avatar_url?: string;
  /** Optional per-dimension sub-scores. When present, the review
   *  modal displays them as scale bars and the overall rating is the
   *  average of the set values. */
  service_ratings?: {
    machine_quality?: number; // 1-5
    service?: number;
    price?: number;
    punctuality?: number;
  };
};

/** Platform-default specs per plant category. Sensible UK-industry
 *  values shown when the merchant hasn't set per-machine specs. Merged
 *  by mergeSpecs() — merchant values win, platform values fill the
 *  gaps. Guarantees every tile has a spec table on day one. */
export const PLANT_DEFAULT_SPECS: Record<PlantCategorySlug, PlantSpec> = {
  mini_excavator: {
    weight_kg: 1500, hp: 15, dig_depth_mm: 2100, reach_mm: 3300, bucket_l: 25,
    transport_length_mm: 3300, transport_width_mm: 990, transport_height_mm: 2200,
    fuel_type: "diesel", emission: "stage_v"
  },
  midi_excavator: {
    weight_kg: 6000, hp: 55, dig_depth_mm: 3800, reach_mm: 6200, bucket_l: 130,
    transport_length_mm: 5300, transport_width_mm: 1900, transport_height_mm: 2500,
    fuel_type: "diesel", emission: "stage_v"
  },
  backhoe_loader: {
    weight_kg: 8000, hp: 74, dig_depth_mm: 4200, reach_mm: 5700, bucket_l: 250,
    transport_length_mm: 5900, transport_width_mm: 2300, transport_height_mm: 3000,
    fuel_type: "diesel", emission: "stage_v"
  },
  wheel_loader: {
    weight_kg: 5000, hp: 55, bucket_l: 900,
    transport_length_mm: 5200, transport_width_mm: 1800, transport_height_mm: 2500,
    fuel_type: "diesel", emission: "stage_v"
  },
  bulldozer: {
    weight_kg: 20000, hp: 165,
    transport_length_mm: 5300, transport_width_mm: 3000, transport_height_mm: 3200,
    fuel_type: "diesel", emission: "stage_v"
  },
  articulated_dumper: {
    weight_kg: 25000, hp: 250,
    transport_length_mm: 10000, transport_width_mm: 3000, transport_height_mm: 3500,
    fuel_type: "diesel", emission: "stage_v"
  },
  grader: {
    weight_kg: 15000, hp: 155,
    transport_length_mm: 9100, transport_width_mm: 2600, transport_height_mm: 3500,
    fuel_type: "diesel", emission: "stage_v"
  },
  dumper: {
    weight_kg: 2100, hp: 25,
    transport_length_mm: 3200, transport_width_mm: 1600, transport_height_mm: 2500,
    fuel_type: "diesel", emission: "stage_v"
  },
  tracked_dumper: {
    weight_kg: 3000, hp: 30,
    transport_length_mm: 3400, transport_width_mm: 1700, transport_height_mm: 2500,
    fuel_type: "diesel", emission: "stage_v"
  },
  telehandler: {
    weight_kg: 6800, hp: 74, reach_mm: 6000,
    transport_length_mm: 4700, transport_width_mm: 2100, transport_height_mm: 2000,
    fuel_type: "diesel", emission: "stage_v"
  },
  forklift: {
    weight_kg: 3500, hp: 55,
    transport_length_mm: 3800, transport_width_mm: 1200, transport_height_mm: 2200,
    fuel_type: "diesel", emission: "stage_v"
  },
  roller: {
    weight_kg: 3000, hp: 40,
    transport_length_mm: 4200, transport_width_mm: 1500, transport_height_mm: 2600,
    fuel_type: "diesel", emission: "stage_v"
  },
  plate_compactor: {
    weight_kg: 100, hp: 5,
    fuel_type: "petrol"
  },
  trench_rammer: {
    weight_kg: 75, hp: 5,
    fuel_type: "petrol"
  },
  scissor_lift: {
    weight_kg: 1500, hp: 0,
    transport_length_mm: 2400, transport_width_mm: 1200, transport_height_mm: 2100,
    fuel_type: "electric"
  },
  cherry_picker: {
    weight_kg: 3000, hp: 45,
    transport_length_mm: 4900, transport_width_mm: 1800, transport_height_mm: 2100,
    fuel_type: "diesel", emission: "stage_v"
  },
  skid_steer: {
    weight_kg: 3500, hp: 55, bucket_l: 500,
    transport_length_mm: 3400, transport_width_mm: 1700, transport_height_mm: 2000,
    fuel_type: "diesel", emission: "stage_v"
  },
  breaker: {
    weight_kg: 30, hp: 5,
    fuel_type: "petrol"
  },
  generator: {
    weight_kg: 200, hp: 10,
    fuel_type: "diesel"
  },
  compressor: {
    weight_kg: 500, hp: 20,
    fuel_type: "diesel"
  },
  water_bowser: {
    weight_kg: 200
  },
  space_heater: {
    weight_kg: 60,
    fuel_type: "diesel"
  },
  concrete_mixer: {
    weight_kg: 300, hp: 5,
    fuel_type: "diesel"
  },
  concrete_pump: {
    weight_kg: 800, hp: 25,
    fuel_type: "diesel"
  },
  wood_chipper: {
    weight_kg: 900, hp: 25,
    fuel_type: "diesel"
  },
  trencher: {
    weight_kg: 3000, hp: 30,
    fuel_type: "diesel"
  },
  floor_saw: {
    weight_kg: 100, hp: 13,
    fuel_type: "petrol"
  },
  flail_mower: {
    weight_kg: 2500, hp: 45,
    fuel_type: "diesel", emission: "stage_v"
  },
  plant_trailer: {
    weight_kg: 500
  },
  welfare_unit: {
    weight_kg: 1500,
    fuel_type: "diesel"
  },
  attachments: {}
};

/** Merge merchant-set specs on top of platform defaults. Merchant
 *  values always win; blank/null merchant values fall through to
 *  platform defaults. */
export function mergeSpecs(
  slug: PlantCategorySlug,
  merchant: PlantSpec | undefined
): PlantSpec {
  const defaults = PLANT_DEFAULT_SPECS[slug] ?? {};
  const out: PlantSpec = { ...defaults };
  if (!merchant) return out;
  for (const key of Object.keys(merchant) as (keyof PlantSpec)[]) {
    const v = merchant[key];
    if (v !== null && v !== undefined && v !== "") {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

export type PlantCategoryConfig = {
  enabled: boolean;
  price_day_pence: number | null;
  price_week_pence: number | null;
  price_month_pence: number | null;
  operator_premium_day_pence: number | null;
  note: string;
  cart_enabled?: boolean;
  sub_types?: string[];
  image_url?: string;
  /** 0-5 gallery images on the machine tile (in addition to cover). */
  gallery_urls?: string[];
  /** YouTube / Vimeo URL — renders as an embedded lightbox thumbnail. */
  video_url?: string;
  /** Public PDF URL — brochure / spec sheet download. */
  brochure_pdf_url?: string;
  /** Public PDF URL — LOLER cert (statutory lifting equipment cert). */
  loler_cert_url?: string;
  /** Bespoke dimension / spec diagram image URL. When set, renders in
   *  the Size & Access modal instead of the auto-generated SVG
   *  silhouette. Blank → auto-silhouette. */
  dimension_diagram_url?: string;
  /** Announcement banner text under the machine hero — merchant sets
   *  e.g. "New 3.5T mini digger arriving Wednesday — hire from Friday
   *  with nationwide delivery". Blank = no banner. */
  running_text?: string;
  /** Compatible attachments (list of PlantCategorySlug values from the
   *  attachments-family — breaker, attachments, forklift, etc.). Drives
   *  the "frequently hired with" cross-sell on the tile. */
  compatible_attachments?: string[];
  /** Technical spec sheet. All fields optional. */
  specs?: PlantSpec;
  /** Aggregate rating (avg / count) — shows a star strip on the tile. */
  rating?: { avg: number; count: number };
  /** Up to last 5 reviews — full text renders in the tile modal. */
  reviews?: PlantReview[];
  blocked_ranges?: { from: string; to: string; note?: string }[];

  /** BUY-NOW SUPPORT — merchant can flag a machine as also-for-sale.
   *  Flips a "For Sale £X,XXX" pill on the tile + a green "Buy Now"
   *  button in the modal. Uses the same WhatsApp handoff pattern as
   *  hire enquiry — the message is auto-prefilled with the condition,
   *  year, hours and price. */
  for_sale?: boolean;
  sale_price_pence?: number | null;
  sale_condition?: "new" | "used" | "refurbished" | "ex_demo" | "";
  sale_year?: number | null;
  sale_hours_used?: number | null;
  /** Free-text sale note — servicing, extras, tyre condition, etc. */
  sale_note?: string;
  /** Stock count for buy-now (null = single unit or unknown). */
  sale_stock_count?: number | null;

  /** Wet-hire day rate (with operator) — pence. If null, dry-hire only. */
  wet_price_day_pence?: number | null;
  /** Whether this specific machine is available on sub-hire from
   *  partners (when the merchant's own is out). */
  sub_hire_available?: boolean;
};

/** Per-listing UI section flags. Merchant flips each on/off from the
 *  Sections card at the top of the editor. Both the add-on and the
 *  future standalone plant-hire app read from the same JSONB, so a
 *  merchant configures once and both surfaces stay in sync. */
export type PlantHireSectionsEnabled = {
  spec_panel: boolean;
  gallery: boolean;
  video: boolean;
  documents: boolean; // brochure + LOLER
  attachments_compat: boolean;
  postcode_calculator: boolean;
  search_filter: boolean;
  break_even_nudge: boolean;
  reviews: boolean;
  notify_when_free: boolean;
  repeat_customer_ladder: boolean;
  cdm_pack: boolean;
  ai_recommender: boolean;
};

export const DEFAULT_SECTIONS_ENABLED: PlantHireSectionsEnabled = {
  spec_panel: true,
  gallery: true,
  video: true,
  documents: true,
  attachments_compat: true,
  postcode_calculator: true,
  search_filter: true,
  break_even_nudge: true,
  reviews: true,
  notify_when_free: false,
  repeat_customer_ladder: false,
  cdm_pack: false,
  ai_recommender: false
};

export const SECTIONS_META: {
  key: keyof PlantHireSectionsEnabled;
  label: string;
  description: string;
}[] = [
  { key: "spec_panel", label: "Technical specs panel", description: "Weight, dig depth, reach, HP, bucket size, transport dims." },
  { key: "gallery", label: "Machine gallery (3–5 images)", description: "Extra images per machine (side, cab, engine, working)." },
  { key: "video", label: "Walkaround video", description: "YouTube / Vimeo URL per machine." },
  { key: "documents", label: "Downloads (brochure + LOLER)", description: "PDF spec sheet + statutory LOLER certificate." },
  { key: "attachments_compat", label: "Compatible attachments", description: "Cross-sell attachments per machine on the tile." },
  { key: "postcode_calculator", label: "Postcode delivery calculator", description: "Customer enters postcode → live delivery cost." },
  { key: "search_filter", label: "Search + filter bar", description: "Text search, weight range, available-today filter." },
  { key: "break_even_nudge", label: "Best-rate nudge in enquire card", description: "'5 days — week rate is cheaper' auto-hint." },
  { key: "reviews", label: "Machine reviews", description: "Star rating + verified customer reviews per machine." },
  { key: "notify_when_free", label: "Notify-when-free", description: "Customer taps blocked range → WA fires when range ends." },
  { key: "repeat_customer_ladder", label: "Repeat customer discount ladder", description: "3rd hire = 5% off, 6th = 10%. Sticky." },
  { key: "cdm_pack", label: "CDM 2015 risk-assessment pack", description: "Auto-generated site risk PDF per hire. £10 add-on." },
  { key: "ai_recommender", label: "'What machine do I need?' AI widget", description: "LLM widget above categories that picks the right tile." }
];

/** ISO date guard — accepts YYYY-MM-DD only. */
export function isValidIsoDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

/** True if `iso` falls inside any of the blocked ranges (inclusive). */
export function isDateBlocked(
  iso: string,
  ranges: { from: string; to: string }[] | undefined
): boolean {
  if (!ranges || ranges.length === 0) return false;
  return ranges.some((r) => iso >= r.from && iso <= r.to);
}

/** Return the next available date after all blocked ranges that touch
 *  `todayIso`, or null if the machine is free today. */
export function nextAvailableAfterBlocks(
  todayIso: string,
  ranges: { from: string; to: string }[] | undefined
): string | null {
  if (!ranges || ranges.length === 0) return null;
  const covering = ranges.find((r) => todayIso >= r.from && todayIso <= r.to);
  if (!covering) return null;
  const d = new Date(covering.to);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Trust-bar benefit. `label` is the tick text; `url` (optional) turns
 *  the item into a link — used to route to compliance / careers /
 *  trade-accounts / breakdown etc. */
export type PlantTrustBenefit = {
  label: string;
  url: string;
};

export type PlantBulkTier = {
  /** Threshold weeks (or days for very short hires) at which this tier kicks in. */
  min_period_days: number;
  label: string; // "5% off 2wk+" or "10% discount 4wk+"
};

export type PlantFaq = { q: string; a: string };

export type PlantBrand = { name: string; logo_url?: string | null };

/** Damage waiver / insurance option. Merchant chooses which of these
 *  they offer — the customer picks one at enquiry. */
export type PlantWaiverOption = {
  slug: string;
  label: string;
  price_day_pence: number | null; // null = "flat 10% of hire" style, use note
  excess_pence: number | null;
  note: string;
};

/** Delivery zone row. Free within `free_radius_miles`, then per-mile
 *  charge kicks in. Blank list = quoted per-job. */
export type PlantDeliveryZone = {
  label: string; // "Hull + HU postcodes", "Yorkshire + Humberside"
  free_radius_miles: number | null;
  price_per_mile_pence: number | null;
  fixed_price_pence: number | null; // one-off flat fee instead of per-mile
  note: string;
};

/** Fuel handling policy. */
export type FuelPolicy =
  | "refuel_on_return"
  | "pay_refuel_charge"
  | "diesel_included"
  | "electric_only";

export type PlantHireConfig = {
  categories: Partial<Record<PlantCategorySlug, PlantCategoryConfig>>;
  modes: {
    collect: boolean;
    delivery: boolean;
    operator: boolean;
    long_term: boolean;
  };
  years_hiring: number | null;
  cpa_terms: boolean;
  hired_in_insured: boolean;
  cpcs_operators: boolean;
  hse_audited: boolean;
  /** Free-text turnaround pill — "Same day delivery", "Next day", etc. */
  turnaround_text: string;
  /** Fuel policy applied to all machines. */
  fuel_policy: FuelPolicy;
  /** Fuel refuel charge, £/L in pence. Only surfaced when
   *  fuel_policy = 'pay_refuel_charge'. */
  fuel_refuel_pence_per_litre: number | null;
  /** Weekend charged as X% of a day rate. 100 = same as one day.
   *  150 = 1.5×. null = "1 day charge Fri→Mon" default. */
  weekend_rate_percent: number | null;
  /** Bank holiday surcharge % on top of day rate. null = none. */
  bank_holiday_surcharge_percent: number | null;
  /** Universal refundable deposit in pence. null = per-category / quoted. */
  deposit_pence: number | null;
  /** Min age required — e.g. 21 for self-drive machines. null = no gate. */
  min_operator_age: number | null;
  /** Whether the merchant requires CPCS/NPORS card upload on enquiry. */
  cpcs_required: boolean;
  yard_address: string;
  yard_open_from: string; // "07:00"
  yard_open_to: string; // "17:00"
  banner_image_url: string;
  illustration_image_url: string;
  custom_note: string;
  trust_benefits: PlantTrustBenefit[];
  plant_brands: PlantBrand[];
  waiver_options: PlantWaiverOption[];
  delivery_zones: PlantDeliveryZone[];
  bulk_tiers: PlantBulkTier[];
  trade_customers: string[];
  faq: PlantFaq[];
  promo_banner: {
    enabled: boolean;
    text: string;
    cta_label: string;
    cta_href: string;
  };
  headline_text: string;
  section_headings: {
    trust_benefits: string;
    brands: string;
    what_we_hire: string;
    how_to_hire: string;
    delivery: string;
    waivers: string;
    bulk: string;
    trade_customers: string;
    related_products: string;
    faq: string;
  };
  explanatory_paragraphs: string[];
  mode_bodies: {
    collect: string;
    delivery: string;
    operator: string;
    long_term: string;
  };
  related_product_categories: string[];
  /** Per-listing UI section flags. Defaults from DEFAULT_SECTIONS_ENABLED. */
  sections_enabled: PlantHireSectionsEnabled;
  /** Depot postcode (origin) used by the postcode delivery calculator. */
  depot_postcode: string;
  /** 24/7 breakdown service configuration. */
  breakdown_service: PlantBreakdownService;
  /** Machine haulage — Product A (deliver own fleet) + Product B
   *  (haulage-only for someone else's machine). Configured per merchant;
   *  read by /plant-hire/haulage wizard on every app. */
  haulage_service: PlantHaulageService;
  /** YouTube video listings — merchant-curated, machine-tagged. */
  video_center: PlantVideoCenter;
  /** Trade credit accounts application (online form + PDF download). */
  trade_accounts: PlantTradeAccounts;
  /** Driver recruitment form (LGV / plant / low-loader operators). */
  driver_recruitment: PlantDriverRecruitment;
  /** Meet-the-team roster with per-member direct contact. */
  team: PlantTeamSection;
  /** Spare parts trade counter — category cards + manuals + hours. */
  parts_counter: PlantPartsCounter;
  /** Wide-load / nationwide delivery compliance & information card. */
  compliance_info: PlantComplianceInfo;
  /** Third-party trust signals — accreditations, reviews, insurance. */
  trust_signals: PlantTrustSignals;
  /** CDM 2015 risk-assessment pack (PDF + inline copy). */
  cdm_pack: PlantCdmPack;
  /** Rule-based "which machine do I need?" wizard (/plant-hire/finder). */
  machine_finder: PlantMachineFinder;
  /** Site services calculator (aggregate / concrete / hardcore). */
  site_calculator: PlantSiteCalculator;
  /** Repeat-customer discount ladder. */
  repeat_ladder: PlantRepeatLadder;
  /** Notify-when-free — customer subscribes to a blocked-range end. */
  notify_when_free: PlantNotifyWhenFree;
  /** Bulk hire quote builder for multi-machine long-term projects. */
  bulk_quote: PlantBulkQuote;
  /** Weekend + bank-holiday yard closure calendar. */
  closure_calendar: PlantClosureCalendar;
  /** Sub-hire indicator + partner list. */
  sub_hire: PlantSubHire;
  /** Opt-in payment gateway add-on — merchant activates the methods
   *  they accept; the shipped flow stays WhatsApp-first. Customers see
   *  which methods are accepted and follow the merchant-supplied link
   *  after the WhatsApp confirmation. */
  payment_gateways: PlantPaymentGateways;
  /** Master switch for the extended plant hire showcase on the
   *  merchant's profile home. When false, the mega showcase is
   *  suppressed and the profile falls back to the small PlantHireCard
   *  teaser (or nothing) — all sub-pages, wizards and forms still work
   *  normally. Default true. */
  showcase_enabled: boolean;
  /** OPTIONAL layout customisation. When null / empty, the home
   *  showcase renders the hardcoded default order (Russell's baseline).
   *  When a merchant configures `rows`, the dynamic renderer takes over
   *  — each row can have 1-3 columns of section keys pulled from the
   *  plant hire section registry. Same JSON shape works for any trade
   *  app's dynamic renderer; only the section registry differs per app. */
  layout_config: PlantLayoutConfig | null;
};

/** Reserved region label — sidebar rail (right) vs main column. Blog-
 *  style split. Merchants opt into sidebar sections by dragging them
 *  into a `sidebar` row; default rows are `main`. */
export type LayoutRegion = "main" | "sidebar";

/** One row in the merchant's page layout. A row has 1-3 columns; each
 *  column names a section key from the registry. Merchants reorder
 *  rows top/bottom, and swap columns left/right within a row. */
export type LayoutRow = {
  id: string;
  columns: string[];
  region: LayoutRegion;
};

export type PlantLayoutConfig = {
  rows: LayoutRow[];
};

export function emptyLayoutConfig(): PlantLayoutConfig | null {
  return null;
}

export function normaliseLayoutConfig(raw: unknown): PlantLayoutConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<PlantLayoutConfig>;
  if (!Array.isArray(r.rows) || r.rows.length === 0) return null;
  const rows: LayoutRow[] = r.rows
    .map((row): LayoutRow | null => {
      if (!row || typeof row !== "object") return null;
      const o = row as Partial<LayoutRow>;
      const id = typeof o.id === "string" ? o.id.slice(0, 40) : "";
      const cols = Array.isArray(o.columns)
        ? o.columns
            .filter((c): c is string => typeof c === "string")
            .map((c) => c.slice(0, 40))
            .slice(0, 3)
        : [];
      if (!id || cols.length === 0) return null;
      const region: LayoutRegion = o.region === "sidebar" ? "sidebar" : "main";
      return { id, columns: cols, region };
    })
    .filter((r): r is LayoutRow => r !== null)
    .slice(0, 40);
  return rows.length > 0 ? { rows } : null;
}

/** Configuration for the merchant's breakdown / mobile-repair service.
 *  Every flag / rate is optional — leave blank / 0 to hide from the
 *  submission form. Merchant activates only the payment methods they
 *  actually accept. */
export type PlantBreakdownService = {
  enabled: boolean;
  own_machine_supported: boolean;
  third_party_supported: boolean;
  callout_fee_pence: number | null;
  hourly_rate_pence: number | null;
  minimum_callout_hours: number | null;
  parts_markup_percent: number | null;
  payment_options: {
    card_before_dispatch: boolean;
    card_after_fix: boolean;
    cash_on_fix: boolean;
    trade_account: boolean;
  };
  terms_of_service: string;
  sla_local_hours: number | null;
  sla_national_hours: number | null;
};

// ─── HAULAGE ──────────────────────────────────────────────────────────

/** Trailer band — machine weight range maps to a trailer type + rate. */
export type HaulageTrailerBand = {
  slug: "beavertail" | "low_loader" | "step_frame" | "heavy_haulage" | "modular_spmt";
  label: string;
  weight_from_kg: number;
  weight_to_kg: number;
  fixed_pence: number | null;
  per_mile_pence: number | null;
  quote_only: boolean;
  image_url: string;
};

/** Loading method options — how the machine gets on/off. */
export const HAULAGE_LOAD_METHODS = [
  { slug: "self_drive", label: "Self-drive on/off ramps" },
  { slug: "winch", label: "Winch on (non-runner)" },
  { slug: "customer_crane", label: "Customer supplies crane" },
  { slug: "haulier_hiab", label: "Haulier supplies HIAB" }
] as const;

/** Access surface at pickup / delivery. */
export const HAULAGE_ACCESS_TYPES = [
  { slug: "hardstanding", label: "Hardstanding / yard" },
  { slug: "concrete", label: "Concrete pad" },
  { slug: "field", label: "Field / grass" },
  { slug: "muddy", label: "Muddy / wet ground" },
  { slug: "steep_slope", label: "Steep slope" },
  { slug: "restricted", label: "Restricted / tight access" }
] as const;

export type PlantHaulageService = {
  enabled: boolean;
  /** Product A — merchant delivers their own fleet. */
  own_fleet_enabled: boolean;
  /** Product B — merchant hauls a third-party machine. */
  third_party_enabled: boolean;
  /** Product A rates. */
  delivery_first_mile_pence: number | null;
  delivery_per_mile_pence: number | null;
  delivery_minimum_pence: number | null;
  /** Product B: trailer bands (weight-based). */
  trailer_bands: HaulageTrailerBand[];
  /** Product B surcharges. */
  non_runner_surcharge_pence: number | null;
  escort_per_day_pence: number | null;
  police_escort_notification_pence: number | null;
  weekend_multiplier_percent: number | null;
  overnight_standby_pence: number | null;
  /** Goods-in-transit % on declared value. 0.5 = 0.5%. */
  insurance_percent: number | null;
  /** Whether the merchant handles STGO / VR1 / bridge notification. */
  handles_notifications: boolean;
  /** Trust signal — public licence number. */
  operators_licence_number: string;
  /** Trust signal — max cover value. */
  goods_in_transit_cover_pence: number | null;
  terms_of_service: string;
};

export const DEFAULT_TRAILER_BANDS: HaulageTrailerBand[] = [
  {
    slug: "beavertail",
    label: "Beavertail (up to 10T)",
    weight_from_kg: 0,
    weight_to_kg: 10000,
    fixed_pence: 25000,
    per_mile_pence: 200,
    quote_only: false,
    image_url: ""
  },
  {
    slug: "low_loader",
    label: "Low loader (10–25T)",
    weight_from_kg: 10001,
    weight_to_kg: 25000,
    fixed_pence: 40000,
    per_mile_pence: 300,
    quote_only: false,
    image_url: ""
  },
  {
    slug: "step_frame",
    label: "Step-frame low loader (25–40T)",
    weight_from_kg: 25001,
    weight_to_kg: 40000,
    fixed_pence: 60000,
    per_mile_pence: 400,
    quote_only: false,
    image_url: ""
  },
  {
    slug: "heavy_haulage",
    label: "Heavy haulage / STGO Cat 2 (40–80T)",
    weight_from_kg: 40001,
    weight_to_kg: 80000,
    fixed_pence: 90000,
    per_mile_pence: 600,
    quote_only: false,
    image_url: ""
  },
  {
    slug: "modular_spmt",
    label: "Modular / SPMT (80T+ abnormal)",
    weight_from_kg: 80001,
    weight_to_kg: 999999,
    fixed_pence: null,
    per_mile_pence: null,
    quote_only: true,
    image_url: ""
  }
];

export function emptyHaulageService(): PlantHaulageService {
  return {
    enabled: false,
    own_fleet_enabled: true,
    third_party_enabled: false,
    delivery_first_mile_pence: 5000,
    delivery_per_mile_pence: 250,
    delivery_minimum_pence: 15000,
    trailer_bands: DEFAULT_TRAILER_BANDS.map((b) => ({ ...b })),
    non_runner_surcharge_pence: 30000,
    escort_per_day_pence: 35000,
    police_escort_notification_pence: 25000,
    weekend_multiplier_percent: 150,
    overnight_standby_pence: 30000,
    insurance_percent: 50, // 0.5% stored as basis-points ÷ 10
    handles_notifications: true,
    operators_licence_number: "",
    goods_in_transit_cover_pence: 25_000_000, // £250,000
    terms_of_service: ""
  };
}

export function normaliseHaulageService(raw: unknown): PlantHaulageService {
  const base = emptyHaulageService();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantHaulageService>;
  const bands = Array.isArray(r.trailer_bands) ? r.trailer_bands : [];
  const normalisedBands: HaulageTrailerBand[] = bands
    .map((b): HaulageTrailerBand | null => {
      if (!b || typeof b !== "object") return null;
      const o = b as Partial<HaulageTrailerBand>;
      const slug = typeof o.slug === "string" ? o.slug : "";
      const validSlugs = ["beavertail", "low_loader", "step_frame", "heavy_haulage", "modular_spmt"] as const;
      if (!(validSlugs as readonly string[]).includes(slug)) return null;
      return {
        slug: slug as HaulageTrailerBand["slug"],
        label: typeof o.label === "string" ? o.label.slice(0, 60) : "",
        weight_from_kg: n(o.weight_from_kg, 0, 1_000_000) ?? 0,
        weight_to_kg: n(o.weight_to_kg, 0, 1_000_000) ?? 0,
        fixed_pence: n(o.fixed_pence, 0, 100_000_000),
        per_mile_pence: n(o.per_mile_pence, 0, 100_000),
        quote_only: o.quote_only === true,
        image_url: typeof o.image_url === "string" ? o.image_url.slice(0, 800) : ""
      };
    })
    .filter((b): b is HaulageTrailerBand => b !== null);
  const finalBands = normalisedBands.length > 0 ? normalisedBands : base.trailer_bands;
  return {
    enabled: r.enabled === true,
    own_fleet_enabled: r.own_fleet_enabled !== false,
    third_party_enabled: r.third_party_enabled === true,
    delivery_first_mile_pence: n(r.delivery_first_mile_pence, 0, 10_000_000),
    delivery_per_mile_pence: n(r.delivery_per_mile_pence, 0, 100_000),
    delivery_minimum_pence: n(r.delivery_minimum_pence, 0, 10_000_000),
    trailer_bands: finalBands,
    non_runner_surcharge_pence: n(r.non_runner_surcharge_pence, 0, 10_000_000),
    escort_per_day_pence: n(r.escort_per_day_pence, 0, 10_000_000),
    police_escort_notification_pence: n(r.police_escort_notification_pence, 0, 10_000_000),
    weekend_multiplier_percent: n(r.weekend_multiplier_percent, 100, 500),
    overnight_standby_pence: n(r.overnight_standby_pence, 0, 10_000_000),
    insurance_percent: n(r.insurance_percent, 0, 1000),
    handles_notifications: r.handles_notifications !== false,
    operators_licence_number:
      typeof r.operators_licence_number === "string" ? r.operators_licence_number.slice(0, 40) : "",
    goods_in_transit_cover_pence: n(r.goods_in_transit_cover_pence, 0, 10_000_000_000),
    terms_of_service:
      typeof r.terms_of_service === "string" ? r.terms_of_service.slice(0, 2500) : ""
  };
}

/** Auto-pick the correct trailer band for a given machine weight. */
export function pickTrailerBand(
  weightKg: number,
  bands: HaulageTrailerBand[]
): HaulageTrailerBand | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const match = bands.find(
    (b) => weightKg >= b.weight_from_kg && weightKg <= b.weight_to_kg
  );
  return match ?? bands[bands.length - 1] ?? null;
}

/** Live regulation flags derived from machine dimensions/weight. */
export function haulageRegFlags(input: {
  width_mm?: number | null;
  height_mm?: number | null;
  length_mm?: number | null;
  weight_kg?: number | null;
}): {
  wide_load: boolean;
  private_escort_required: boolean;
  police_escort_required: boolean;
  route_survey_required: boolean;
  stgo_cat_2_required: boolean;
  stgo_cat_3_required: boolean;
  notification_hours: number; // clear working days converted to hours (48 = 2 working days)
} {
  const w = input.width_mm ?? 0;
  const h = input.height_mm ?? 0;
  const l = input.length_mm ?? 0;
  const kg = input.weight_kg ?? 0;
  return {
    wide_load: w > 2550,
    private_escort_required: w > 3000 || l > 18650,
    police_escort_required: w > 3500 || l > 27400,
    route_survey_required: h > 4950,
    stgo_cat_2_required: kg > 44000,
    stgo_cat_3_required: kg > 80000,
    notification_hours: w > 3000 || l > 27400 || kg > 44000 ? 48 : 0
  };
}

// ─── VIDEO CENTER ─────────────────────────────────────────────────────

export type PlantVideo = {
  youtube_url: string;
  title: string;
  description: string;
  location: string;
  /** Slug of a linked PlantCategory — enables "View this machine →"
   *  button on the video card. Empty = no link. */
  linked_machine_slug: string;
  /** Optional override thumbnail (auto-derived from YouTube ID otherwise). */
  thumbnail_url: string;
  /** Free-text "2:34" duration for display. */
  duration_label: string;
  /** YYYY-MM-DD upload date. */
  date_uploaded: string;
};

export type PlantVideoCenter = {
  enabled: boolean;
  heading: string;
  subheading: string;
  videos: PlantVideo[];
};

export function emptyVideoCenter(): PlantVideoCenter {
  return {
    enabled: false,
    heading: "Video centre",
    subheading: "Watch the fleet in action.",
    videos: []
  };
}

export function normaliseVideoCenter(raw: unknown): PlantVideoCenter {
  const base = emptyVideoCenter();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantVideoCenter>;
  const videos = Array.isArray(r.videos) ? r.videos : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 80)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 160)
        : base.subheading,
    videos: videos
      .map((v): PlantVideo | null => {
        if (!v || typeof v !== "object") return null;
        const o = v as Partial<PlantVideo>;
        const url = typeof o.youtube_url === "string" ? o.youtube_url.trim().slice(0, 800) : "";
        if (!url) return null;
        return {
          youtube_url: url,
          title: typeof o.title === "string" ? o.title.slice(0, 120) : "",
          description: typeof o.description === "string" ? o.description.slice(0, 300) : "",
          location: typeof o.location === "string" ? o.location.slice(0, 80) : "",
          linked_machine_slug:
            typeof o.linked_machine_slug === "string" ? o.linked_machine_slug.slice(0, 40) : "",
          thumbnail_url:
            typeof o.thumbnail_url === "string" ? o.thumbnail_url.slice(0, 800) : "",
          duration_label:
            typeof o.duration_label === "string" ? o.duration_label.slice(0, 12) : "",
          date_uploaded:
            typeof o.date_uploaded === "string" ? o.date_uploaded.slice(0, 10) : ""
        };
      })
      .filter((v): v is PlantVideo => v !== null)
      .slice(0, 30)
  };
}

// ─── TRADE ACCOUNTS ───────────────────────────────────────────────────

export type PlantTradeAccounts = {
  enabled: boolean;
  online_application_enabled: boolean;
  pdf_download_enabled: boolean;
  pdf_url: string;
  heading: string;
  subheading: string;
  benefits: string[];
  credit_limit_min_pence: number | null;
  credit_limit_max_pence: number | null;
  min_years_trading: number | null;
  require_bank_details: boolean;
  require_trade_references: number;
  require_insurance_cert: boolean;
  turnaround_days: number | null;
  terms_of_service: string;
};

export function emptyTradeAccounts(): PlantTradeAccounts {
  return {
    enabled: false,
    online_application_enabled: true,
    pdf_download_enabled: false,
    pdf_url: "",
    heading: "Open a trade account",
    subheading: "30 days from invoice. Weekly statements. Priority delivery + preferential rates.",
    benefits: [
      "30 days from invoice",
      "Weekly consolidated statements",
      "Priority delivery slots",
      "Preferential rates on long hires",
      "One account across the whole fleet"
    ],
    credit_limit_min_pence: 50000,
    credit_limit_max_pence: 1000000,
    min_years_trading: 2,
    require_bank_details: true,
    require_trade_references: 2,
    require_insurance_cert: true,
    turnaround_days: 2,
    terms_of_service: ""
  };
}

export function normaliseTradeAccounts(raw: unknown): PlantTradeAccounts {
  const base = emptyTradeAccounts();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantTradeAccounts>;
  return {
    enabled: r.enabled === true,
    online_application_enabled: r.online_application_enabled !== false,
    pdf_download_enabled: r.pdf_download_enabled === true,
    pdf_url: typeof r.pdf_url === "string" ? r.pdf_url.slice(0, 800) : "",
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 80)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 200)
        : base.subheading,
    benefits: Array.isArray(r.benefits)
      ? r.benefits.filter((b): b is string => typeof b === "string" && b.length > 0).slice(0, 10)
      : base.benefits,
    credit_limit_min_pence: n(r.credit_limit_min_pence, 0, 100_000_000),
    credit_limit_max_pence: n(r.credit_limit_max_pence, 0, 100_000_000),
    min_years_trading: n(r.min_years_trading, 0, 100),
    require_bank_details: r.require_bank_details !== false,
    require_trade_references: n(r.require_trade_references, 0, 10) ?? 2,
    require_insurance_cert: r.require_insurance_cert !== false,
    turnaround_days: n(r.turnaround_days, 0, 30),
    terms_of_service:
      typeof r.terms_of_service === "string" ? r.terms_of_service.slice(0, 2500) : ""
  };
}

// ─── DRIVER RECRUITMENT ───────────────────────────────────────────────

export type PlantDriverRecruitment = {
  enabled: boolean;
  online_application_enabled: boolean;
  pdf_download_enabled: boolean;
  pdf_url: string;
  heading: string;
  subheading: string;
  positions_available: string[];
  benefits: string[];
  base_location: string;
  salary_range_display: string;
  min_years_experience: number | null;
  require_cpc_card: boolean;
  require_digitacho: boolean;
  require_stgo_experience: boolean;
  require_plant_experience: boolean;
  full_time_available: boolean;
  part_time_available: boolean;
  owner_driver_available: boolean;
  turnaround_days: number | null;
  terms_of_service: string;
};

export const DRIVER_POSITION_PRESETS = [
  // Driving roles
  { slug: "plant_driver", label: "Plant driver (C+E)", group: "Driving" },
  { slug: "low_loader_driver", label: "Low-loader driver", group: "Driving" },
  { slug: "beavertail_driver", label: "Beavertail driver (C1)", group: "Driving" },
  { slug: "hiab_driver", label: "HIAB / crane-truck driver", group: "Driving" },
  { slug: "tipper_driver", label: "Tipper driver", group: "Driving" },
  { slug: "delivery_driver", label: "Delivery van driver", group: "Driving" },
  { slug: "yard_driver", label: "Yard driver / shunter", group: "Driving" },
  { slug: "dispatcher", label: "Transport dispatcher", group: "Driving" },
  // Workshop
  { slug: "mechanic", label: "Fleet mechanic", group: "Workshop" },
  { slug: "auto_electrician", label: "Auto electrician / diagnostics", group: "Workshop" },
  { slug: "hydraulics_fitter", label: "Hydraulics fitter", group: "Workshop" },
  { slug: "apprentice_mechanic", label: "Apprentice mechanic", group: "Workshop" },
  // Yard + counter
  { slug: "yard_operative", label: "Yard operative / plant washer", group: "Yard" },
  { slug: "parts_counter", label: "Parts counter / stores", group: "Yard" },
  { slug: "trade_counter_assistant", label: "Trade counter assistant", group: "Yard" },
  // Office
  { slug: "receptionist", label: "Receptionist / customer service", group: "Office" },
  { slug: "bookings_coordinator", label: "Bookings coordinator", group: "Office" },
  { slug: "accountant", label: "Accountant / bookkeeper", group: "Office" },
  { slug: "credit_controller", label: "Credit controller", group: "Office" },
  { slug: "sales_admin", label: "Sales / hire desk admin", group: "Office" },
  // Management + apprentice
  { slug: "transport_manager", label: "Transport manager (CPC)", group: "Management" },
  { slug: "operations_manager", label: "Operations manager", group: "Management" },
  { slug: "apprentice_general", label: "General apprentice / trainee", group: "Apprentice" }
] as const;

export type DriverPositionSlug = (typeof DRIVER_POSITION_PRESETS)[number]["slug"];

export function emptyDriverRecruitment(): PlantDriverRecruitment {
  return {
    enabled: false,
    online_application_enabled: true,
    pdf_download_enabled: false,
    pdf_url: "",
    heading: "Drivers wanted",
    subheading:
      "We&rsquo;re hiring plant drivers, low-loader operators and yard crew. CPC + digitacho essentials — everything else we can talk about.",
    positions_available: ["plant_driver", "low_loader_driver"],
    benefits: [
      "Steady weekly loads",
      "Modern fleet + serviced trailers",
      "Weekly pay",
      "Overtime + weekend rates",
      "Ongoing CPC training paid",
      "Uniform + PPE supplied"
    ],
    base_location: "",
    salary_range_display: "£38,000–£48,000 + overtime",
    min_years_experience: 2,
    require_cpc_card: true,
    require_digitacho: true,
    require_stgo_experience: false,
    require_plant_experience: true,
    full_time_available: true,
    part_time_available: false,
    owner_driver_available: true,
    turnaround_days: 3,
    terms_of_service: ""
  };
}

export function normaliseDriverRecruitment(raw: unknown): PlantDriverRecruitment {
  const base = emptyDriverRecruitment();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantDriverRecruitment>;
  return {
    enabled: r.enabled === true,
    online_application_enabled: r.online_application_enabled !== false,
    pdf_download_enabled: r.pdf_download_enabled === true,
    pdf_url: typeof r.pdf_url === "string" ? r.pdf_url.slice(0, 800) : "",
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 80)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    positions_available: Array.isArray(r.positions_available)
      ? r.positions_available
          .filter((p): p is string => typeof p === "string")
          .filter((p) => DRIVER_POSITION_PRESETS.some((d) => d.slug === p))
          .slice(0, 10)
      : base.positions_available,
    benefits: Array.isArray(r.benefits)
      ? r.benefits.filter((b): b is string => typeof b === "string" && b.length > 0).slice(0, 12)
      : base.benefits,
    base_location: typeof r.base_location === "string" ? r.base_location.slice(0, 80) : "",
    salary_range_display:
      typeof r.salary_range_display === "string" ? r.salary_range_display.slice(0, 60) : "",
    min_years_experience: n(r.min_years_experience, 0, 50),
    require_cpc_card: r.require_cpc_card !== false,
    require_digitacho: r.require_digitacho !== false,
    require_stgo_experience: r.require_stgo_experience === true,
    require_plant_experience: r.require_plant_experience !== false,
    full_time_available: r.full_time_available !== false,
    part_time_available: r.part_time_available === true,
    owner_driver_available: r.owner_driver_available === true,
    turnaround_days: n(r.turnaround_days, 0, 30),
    terms_of_service:
      typeof r.terms_of_service === "string" ? r.terms_of_service.slice(0, 2500) : ""
  };
}

// ─── MEET THE TEAM ────────────────────────────────────────────────────

export type PlantTeamMember = {
  name: string;
  role: string;
  photo_url: string;
  phone: string;
  extension: string;
  whatsapp: string;
  email: string;
  hours: string;
  specialities: string[];
};

export type PlantTeamSection = {
  enabled: boolean;
  heading: string;
  subheading: string;
  members: PlantTeamMember[];
};

export function emptyTeamSection(): PlantTeamSection {
  return {
    enabled: false,
    heading: "Meet the team",
    subheading: "Direct lines to the people who move the yard. Skip the switchboard.",
    members: []
  };
}

export function normaliseTeamSection(raw: unknown): PlantTeamSection {
  const base = emptyTeamSection();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantTeamSection>;
  const members = Array.isArray(r.members) ? r.members : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 80)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 200)
        : base.subheading,
    members: members
      .map((m): PlantTeamMember | null => {
        if (!m || typeof m !== "object") return null;
        const o = m as Partial<PlantTeamMember>;
        const name = typeof o.name === "string" ? o.name.slice(0, 60) : "";
        if (!name) return null;
        return {
          name,
          role: typeof o.role === "string" ? o.role.slice(0, 60) : "",
          photo_url: typeof o.photo_url === "string" ? o.photo_url.slice(0, 800) : "",
          phone: typeof o.phone === "string" ? o.phone.slice(0, 30) : "",
          extension: typeof o.extension === "string" ? o.extension.slice(0, 10) : "",
          whatsapp: typeof o.whatsapp === "string" ? o.whatsapp.slice(0, 30) : "",
          email: typeof o.email === "string" ? o.email.slice(0, 120) : "",
          hours: typeof o.hours === "string" ? o.hours.slice(0, 60) : "",
          specialities: Array.isArray(o.specialities)
            ? o.specialities
                .filter((s): s is string => typeof s === "string" && s.length > 0)
                .slice(0, 6)
            : []
        };
      })
      .filter((m): m is PlantTeamMember => m !== null)
      .slice(0, 12)
  };
}

// ─── SPARE PARTS COUNTER ──────────────────────────────────────────────

export type PartsCategory = {
  name: string;
  description: string;
  manual_url: string;
  in_stock: boolean;
  lead_time: string;
  /** Optional category slug used to filter items on the trade counter page. */
  slug?: string;
  /** Optional icon URL. */
  icon_url?: string;
};

export type PartsItem = {
  sku: string;
  name: string;
  brand: string;
  fits: string;
  category_slug: string;
  price_pence: number | null;
  image_url: string;
  in_stock: boolean;
  stock_count: number | null;
  lead_time: string;
  short_desc: string;
  featured: boolean;
  manual_url: string;
};

export type PlantPartsCounter = {
  enabled: boolean;
  heading: string;
  subheading: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours_summary: string;
  same_day_cutoff: string;
  minimum_order_pence: number | null;
  delivery_available: boolean;
  categories: PartsCategory[];
  items: PartsItem[];
  manual_library_url: string;
  address: string;
  terms_of_service: string;
  hero_image_url: string;
};

export function emptyPartsCounter(): PlantPartsCounter {
  return {
    enabled: false,
    heading: "Spare parts trade counter",
    subheading:
      "Filters, hoses, belts, tracks — walk-in and phone-order. Same-day when the truck is already going out.",
    phone: "",
    whatsapp: "",
    email: "",
    hours_summary: "Mon–Fri 07:00–17:00 · Sat 08:00–12:00",
    same_day_cutoff: "Order before 14:00 for same-day dispatch",
    minimum_order_pence: null,
    delivery_available: true,
    categories: [],
    items: [],
    manual_library_url: "",
    address: "",
    terms_of_service: "",
    hero_image_url: ""
  };
}

export function normalisePartsCounter(raw: unknown): PlantPartsCounter {
  const base = emptyPartsCounter();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantPartsCounter>;
  const cats = Array.isArray(r.categories) ? r.categories : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 80)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 200)
        : base.subheading,
    phone: typeof r.phone === "string" ? r.phone.slice(0, 30) : "",
    whatsapp: typeof r.whatsapp === "string" ? r.whatsapp.slice(0, 30) : "",
    email: typeof r.email === "string" ? r.email.slice(0, 120) : "",
    hours_summary:
      typeof r.hours_summary === "string" && r.hours_summary.trim().length > 0
        ? r.hours_summary.slice(0, 120)
        : base.hours_summary,
    same_day_cutoff:
      typeof r.same_day_cutoff === "string"
        ? r.same_day_cutoff.slice(0, 120)
        : base.same_day_cutoff,
    minimum_order_pence: n(r.minimum_order_pence, 0, 10_000_000),
    delivery_available: r.delivery_available !== false,
    categories: cats
      .map((c): PartsCategory | null => {
        if (!c || typeof c !== "object") return null;
        const o = c as Partial<PartsCategory>;
        const name = typeof o.name === "string" ? o.name.slice(0, 60) : "";
        if (!name) return null;
        return {
          name,
          description: typeof o.description === "string" ? o.description.slice(0, 200) : "",
          manual_url: typeof o.manual_url === "string" ? o.manual_url.slice(0, 800) : "",
          in_stock: o.in_stock !== false,
          lead_time: typeof o.lead_time === "string" ? o.lead_time.slice(0, 40) : "",
          slug: typeof o.slug === "string" ? o.slug.slice(0, 40) : "",
          icon_url: typeof o.icon_url === "string" ? o.icon_url.slice(0, 800) : ""
        };
      })
      .filter((c): c is PartsCategory => c !== null)
      .slice(0, 30),
    items: Array.isArray((r as { items?: unknown }).items)
      ? ((r as { items: unknown[] }).items as unknown[])
          .map((it): PartsItem | null => {
            if (!it || typeof it !== "object") return null;
            const o = it as Partial<PartsItem>;
            const name = typeof o.name === "string" ? o.name.slice(0, 120) : "";
            if (!name) return null;
            return {
              sku: typeof o.sku === "string" ? o.sku.slice(0, 40) : "",
              name,
              brand: typeof o.brand === "string" ? o.brand.slice(0, 40) : "",
              fits: typeof o.fits === "string" ? o.fits.slice(0, 300) : "",
              category_slug:
                typeof o.category_slug === "string" ? o.category_slug.slice(0, 40) : "",
              price_pence: n(o.price_pence, 0, 100_000_000),
              image_url: typeof o.image_url === "string" ? o.image_url.slice(0, 800) : "",
              in_stock: o.in_stock !== false,
              stock_count: n(o.stock_count, 0, 100_000),
              lead_time: typeof o.lead_time === "string" ? o.lead_time.slice(0, 40) : "",
              short_desc: typeof o.short_desc === "string" ? o.short_desc.slice(0, 300) : "",
              featured: o.featured === true,
              manual_url: typeof o.manual_url === "string" ? o.manual_url.slice(0, 800) : ""
            };
          })
          .filter((x): x is PartsItem => x !== null)
          .slice(0, 500)
      : [],
    manual_library_url:
      typeof r.manual_library_url === "string" ? r.manual_library_url.slice(0, 800) : "",
    address: typeof r.address === "string" ? r.address.slice(0, 200) : "",
    terms_of_service:
      typeof r.terms_of_service === "string" ? r.terms_of_service.slice(0, 2500) : "",
    hero_image_url:
      typeof r.hero_image_url === "string" ? r.hero_image_url.slice(0, 800) : ""
  };
}

// ─── COMPLIANCE INFO ──────────────────────────────────────────────────

export type PlantComplianceInfo = {
  enabled: boolean;
  heading: string;
  subheading: string;
  wide_load_note: string;
  nationwide_note: string;
  extra_regs: string[];
  route_survey_note: string;
  emergency_line_note: string;
};

export function emptyComplianceInfo(): PlantComplianceInfo {
  return {
    enabled: false,
    heading: "Wide load & nationwide delivery",
    subheading:
      "Every abnormal load leaves the yard fully compliant — STGO categorised, escorts booked, notifications filed. If your job sits outside our published zone rates, one WhatsApp and we&rsquo;ll build a bespoke quote.",
    wide_load_note:
      "Wide loads (over 2.55m), long loads (over 18.65m) and heavy loads (over 44T) travel under STGO Category 1, 2 or 3 depending on weight, with our operator's licence on file with the DVSA. VR1 forms filed 2 working days before dispatch. Route surveys walked in person for bridges under 5.03m or turns on constrained lanes.",
    nationwide_note:
      "Nationwide coverage subject to lane availability. If your postcode isn't listed on our delivery zones page, WhatsApp us the pickup + delivery postcodes and machine weight — we quote inside 30 minutes.",
    extra_regs: [
      "Full compliance with DVSA STGO Cat 1/2/3",
      "National Highways VR1 notifications filed on your behalf",
      "Private + police escort vehicles arranged when width or weight triggers require",
      "Goods-in-transit cover displayed on every quote",
      "CPC + digitacho-carded drivers only",
      "Serviced trailers — annual DVSA + brake test"
    ],
    route_survey_note:
      "Route surveys mandatory for loads over 4.95m tall or 3.5m wide. Charged separately for surveys outside our home zone.",
    emergency_line_note:
      "Broken down on the network? Call the 24/7 breakdown line — printed on every trailer and hire dispatch note."
  };
}

export function normaliseComplianceInfo(raw: unknown): PlantComplianceInfo {
  const base = emptyComplianceInfo();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantComplianceInfo>;
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 80)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 400)
        : base.subheading,
    wide_load_note:
      typeof r.wide_load_note === "string" && r.wide_load_note.trim().length > 0
        ? r.wide_load_note.slice(0, 1200)
        : base.wide_load_note,
    nationwide_note:
      typeof r.nationwide_note === "string" && r.nationwide_note.trim().length > 0
        ? r.nationwide_note.slice(0, 800)
        : base.nationwide_note,
    extra_regs: Array.isArray(r.extra_regs)
      ? r.extra_regs
          .filter((s): s is string => typeof s === "string" && s.length > 0)
          .slice(0, 12)
      : base.extra_regs,
    route_survey_note:
      typeof r.route_survey_note === "string"
        ? r.route_survey_note.slice(0, 400)
        : base.route_survey_note,
    emergency_line_note:
      typeof r.emergency_line_note === "string"
        ? r.emergency_line_note.slice(0, 300)
        : base.emergency_line_note
  };
}

// ─── TRUST SIGNALS ────────────────────────────────────────────────────

export type PlantAccreditation = {
  slug: string;
  label: string;
  logo_url: string;
  cert_number: string;
};

export type PlantAward = { title: string; year: string; issuer: string };

export type PlantTrustSignals = {
  enabled: boolean;
  heading: string;
  subheading: string;
  accreditations: PlantAccreditation[];
  google_reviews_embed_url: string;
  google_place_id: string;
  trustpilot_embed_url: string;
  trustpilot_business_id: string;
  insurance_cert_url: string;
  insurance_cover_pence: number | null;
  awards: PlantAward[];
  net_promoter_score: number | null;
};

const ACCREDITATION_PRESETS: PlantAccreditation[] = [
  { slug: "safecontractor", label: "SafeContractor Approved", logo_url: "", cert_number: "" },
  { slug: "chas", label: "CHAS Accredited", logo_url: "", cert_number: "" },
  { slug: "iso_9001", label: "ISO 9001", logo_url: "", cert_number: "" },
  { slug: "iso_14001", label: "ISO 14001", logo_url: "", cert_number: "" },
  { slug: "iso_45001", label: "ISO 45001", logo_url: "", cert_number: "" },
  { slug: "constructionline", label: "Constructionline Gold", logo_url: "", cert_number: "" },
  { slug: "fors_gold", label: "FORS Gold", logo_url: "", cert_number: "" },
  { slug: "hae", label: "HAE / EHA Member", logo_url: "", cert_number: "" },
  { slug: "cpa", label: "CPA Member", logo_url: "", cert_number: "" }
];

export const ACCREDITATION_ALL = ACCREDITATION_PRESETS;

export function emptyTrustSignals(): PlantTrustSignals {
  return {
    enabled: false,
    heading: "Vetted, insured, audited.",
    subheading:
      "Every credential you'd expect from a national brand — plus the paperwork on the wall to prove it.",
    accreditations: [],
    google_reviews_embed_url: "",
    google_place_id: "",
    trustpilot_embed_url: "",
    trustpilot_business_id: "",
    insurance_cert_url: "",
    insurance_cover_pence: null,
    awards: [],
    net_promoter_score: null
  };
}

export function normaliseTrustSignals(raw: unknown): PlantTrustSignals {
  const base = emptyTrustSignals();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantTrustSignals>;
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    accreditations: Array.isArray(r.accreditations)
      ? r.accreditations
          .map((a): PlantAccreditation | null => {
            if (!a || typeof a !== "object") return null;
            const o = a as Partial<PlantAccreditation>;
            const label = typeof o.label === "string" ? o.label.slice(0, 60) : "";
            if (!label) return null;
            return {
              slug: typeof o.slug === "string" ? o.slug.slice(0, 40) : "",
              label,
              logo_url: typeof o.logo_url === "string" ? o.logo_url.slice(0, 800) : "",
              cert_number: typeof o.cert_number === "string" ? o.cert_number.slice(0, 40) : ""
            };
          })
          .filter((a): a is PlantAccreditation => a !== null)
          .slice(0, 20)
      : [],
    google_reviews_embed_url:
      typeof r.google_reviews_embed_url === "string"
        ? r.google_reviews_embed_url.slice(0, 800)
        : "",
    google_place_id: typeof r.google_place_id === "string" ? r.google_place_id.slice(0, 120) : "",
    trustpilot_embed_url:
      typeof r.trustpilot_embed_url === "string" ? r.trustpilot_embed_url.slice(0, 800) : "",
    trustpilot_business_id:
      typeof r.trustpilot_business_id === "string"
        ? r.trustpilot_business_id.slice(0, 120)
        : "",
    insurance_cert_url:
      typeof r.insurance_cert_url === "string" ? r.insurance_cert_url.slice(0, 800) : "",
    insurance_cover_pence: n(r.insurance_cover_pence, 0, 10_000_000_000),
    awards: Array.isArray(r.awards)
      ? r.awards
          .map((a): PlantAward | null => {
            if (!a || typeof a !== "object") return null;
            const o = a as Partial<PlantAward>;
            const title = typeof o.title === "string" ? o.title.slice(0, 80) : "";
            if (!title) return null;
            return {
              title,
              year: typeof o.year === "string" ? o.year.slice(0, 10) : "",
              issuer: typeof o.issuer === "string" ? o.issuer.slice(0, 80) : ""
            };
          })
          .filter((a): a is PlantAward => a !== null)
          .slice(0, 12)
      : [],
    net_promoter_score: n(r.net_promoter_score, -100, 100)
  };
}

// ─── CDM PACK ─────────────────────────────────────────────────────────

export type PlantCdmPack = {
  enabled: boolean;
  heading: string;
  subheading: string;
  pdf_url: string;
  price_pence: number | null;
  auto_included_on_hires_over_pence: number | null;
  bullets: string[];
  terms_of_service: string;
};

export function emptyCdmPack(): PlantCdmPack {
  return {
    enabled: false,
    heading: "CDM 2015 risk-assessment pack",
    subheading:
      "Auto-generated site risk pack per hire — PDF ready to hand to the principal contractor. £10 add-on.",
    pdf_url: "",
    price_pence: 1000,
    auto_included_on_hires_over_pence: 100000,
    bullets: [
      "Machine risk assessment (COSHH + noise + vibration)",
      "Method statement template",
      "PPE + operator sign-off sheet",
      "Site emergency contacts",
      "24/7 breakdown escalation path"
    ],
    terms_of_service: ""
  };
}

export function normaliseCdmPack(raw: unknown): PlantCdmPack {
  const base = emptyCdmPack();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantCdmPack>;
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 80)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    pdf_url: typeof r.pdf_url === "string" ? r.pdf_url.slice(0, 800) : "",
    price_pence: n(r.price_pence, 0, 100_000_000),
    auto_included_on_hires_over_pence: n(r.auto_included_on_hires_over_pence, 0, 100_000_000),
    bullets: Array.isArray(r.bullets)
      ? r.bullets
          .filter((s): s is string => typeof s === "string" && s.length > 0)
          .slice(0, 10)
      : base.bullets,
    terms_of_service:
      typeof r.terms_of_service === "string" ? r.terms_of_service.slice(0, 2000) : ""
  };
}

// ─── MACHINE FINDER ───────────────────────────────────────────────────

/** Rule-based decision-tree "AI" wizard. Merchant defines Q + A pairs;
 *  each answer maps to one or more machine slugs. Deterministic — no
 *  actual LLM in the loop. */
export type MachineFinderOption = {
  label: string;
  recommends: string[];
};

export type MachineFinderQuestion = {
  key: string;
  question: string;
  options: MachineFinderOption[];
};

export type PlantMachineFinder = {
  enabled: boolean;
  heading: string;
  subheading: string;
  questions: MachineFinderQuestion[];
};

export function defaultMachineFinderQuestions(): MachineFinderQuestion[] {
  return [
    {
      key: "task",
      question: "What are you trying to do?",
      options: [
        { label: "Dig footings / drainage", recommends: ["mini_excavator", "midi_excavator"] },
        { label: "Move muck around site", recommends: ["dumper", "tracked_dumper"] },
        { label: "Lift + place materials", recommends: ["telehandler", "forklift"] },
        { label: "Access at height", recommends: ["scissor_lift", "cherry_picker"] },
        { label: "Break out concrete", recommends: ["breaker", "midi_excavator"] },
        { label: "Compact sub-base", recommends: ["roller", "plate_compactor", "trench_rammer"] },
        { label: "Site power / fuel", recommends: ["generator", "compressor"] },
        { label: "Not sure yet", recommends: [] }
      ]
    },
    {
      key: "access",
      question: "How tight is the site access?",
      options: [
        { label: "Standard gate (2.5m+)", recommends: [] },
        { label: "Narrow (1.5m)", recommends: ["mini_excavator", "skid_steer"] },
        { label: "Through-house / garden (0.9m)", recommends: ["mini_excavator"] }
      ]
    },
    {
      key: "surface",
      question: "What's the ground like?",
      options: [
        { label: "Hardstanding / concrete", recommends: [] },
        { label: "Soft or wet ground", recommends: ["tracked_dumper", "mini_excavator"] },
        { label: "Sensitive lawn", recommends: ["mini_excavator", "tracked_dumper"] }
      ]
    },
    {
      key: "duration",
      question: "How long do you need it?",
      options: [
        { label: "1 day", recommends: [] },
        { label: "1 week", recommends: [] },
        { label: "1 month+", recommends: [] }
      ]
    },
    {
      key: "ulez",
      question: "Working inside a Clean Air Zone (London / Birmingham / Bath)?",
      options: [
        { label: "Yes", recommends: [] },
        { label: "No", recommends: [] }
      ]
    }
  ];
}

export function emptyMachineFinder(): PlantMachineFinder {
  return {
    enabled: false,
    heading: "Which machine do I need?",
    subheading:
      "5 questions, instant shortlist. Not sure between a mini digger and a tracked dumper? We pick for you.",
    questions: defaultMachineFinderQuestions()
  };
}

export function normaliseMachineFinder(raw: unknown): PlantMachineFinder {
  const base = emptyMachineFinder();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantMachineFinder>;
  const qs = Array.isArray(r.questions) ? r.questions : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 240)
        : base.subheading,
    questions:
      qs.length === 0
        ? base.questions
        : qs
            .map((q): MachineFinderQuestion | null => {
              if (!q || typeof q !== "object") return null;
              const o = q as Partial<MachineFinderQuestion>;
              const key = typeof o.key === "string" ? o.key.slice(0, 40) : "";
              const question = typeof o.question === "string" ? o.question.slice(0, 200) : "";
              if (!key || !question) return null;
              const options = Array.isArray(o.options)
                ? o.options
                    .map((op): MachineFinderOption | null => {
                      if (!op || typeof op !== "object") return null;
                      const oo = op as Partial<MachineFinderOption>;
                      const label = typeof oo.label === "string" ? oo.label.slice(0, 100) : "";
                      if (!label) return null;
                      return {
                        label,
                        recommends: Array.isArray(oo.recommends)
                          ? oo.recommends
                              .filter((s): s is string => typeof s === "string")
                              .slice(0, 12)
                          : []
                      };
                    })
                    .filter((o): o is MachineFinderOption => o !== null)
                    .slice(0, 12)
                : [];
              return { key, question, options };
            })
            .filter((q): q is MachineFinderQuestion => q !== null)
            .slice(0, 10)
  };
}

// ─── SITE CALCULATOR ──────────────────────────────────────────────────

export type SiteCalculatorMaterial = {
  slug: string;
  label: string;
  /** Bulk density in kg/m³ — used to convert cubic metres to tonnes. */
  density_kg_per_m3: number;
  unit_price_per_tonne_pence: number | null;
  note: string;
  /** Preset category — drives the default density when quick-adding.
   *  Empty string = merchant set density manually. */
  category?: string;
};

/** Quick-add category presets — merchant picks a category and the
 *  density auto-fills. They can still override afterwards. */
export const MATERIAL_CATEGORY_PRESETS: {
  slug: string;
  label: string;
  density_kg_per_m3: number;
  hint: string;
}[] = [
  { slug: "aggregate", label: "Aggregate (chip / gravel / hardcore)", density_kg_per_m3: 1800, hint: "10–40mm chippings, MOT Type 1, crushed hardcore" },
  { slug: "sand", label: "Sand (building / sharp / plaster)", density_kg_per_m3: 1600, hint: "Building sand, sharp sand, plastering sand" },
  { slug: "concrete", label: "Concrete / ready-mix / mortar", density_kg_per_m3: 2400, hint: "C20 / C25 / C30 / C35 ready-mix, mortar mixes" },
  { slug: "soil", label: "Topsoil / subsoil / compost", density_kg_per_m3: 1400, hint: "Screened topsoil, subsoil, PAS100 compost" },
  { slug: "bark", label: "Bark / mulch / wood chip", density_kg_per_m3: 400, hint: "Decorative bark, playground mulch, wood chip" },
  { slug: "decorative", label: "Decorative stone / slate / cobbles", density_kg_per_m3: 1600, hint: "Slate chippings, Cotswold gold, Scottish pebbles" },
  { slug: "asphalt", label: "Asphalt / tarmac / bitumen", density_kg_per_m3: 2300, hint: "Cold-lay tarmac, hot rolled asphalt" },
  { slug: "recycled", label: "Recycled aggregates (6F5 / crusher run)", density_kg_per_m3: 1900, hint: "Recycled brick, 6F5 sub-base, crusher run" }
];

export function densityForCategory(categorySlug: string): number {
  const meta = MATERIAL_CATEGORY_PRESETS.find((c) => c.slug === categorySlug);
  return meta?.density_kg_per_m3 ?? 1800;
}

export type PlantSiteCalculator = {
  enabled: boolean;
  heading: string;
  subheading: string;
  materials: SiteCalculatorMaterial[];
  waste_factor_percent: number | null;
};

export function defaultSiteCalculatorMaterials(): SiteCalculatorMaterial[] {
  return [
    {
      slug: "mot_type_1",
      label: "MOT Type 1 sub-base",
      density_kg_per_m3: 2100,
      unit_price_per_tonne_pence: 4500,
      note: "Compact 40mm-down limestone. Estimate assumes 95% compaction."
    },
    {
      slug: "concrete_c25",
      label: "Ready-mix concrete C25",
      density_kg_per_m3: 2400,
      unit_price_per_tonne_pence: 12000,
      note: "General footing / slab mix. Order 5–10% extra for waste."
    },
    {
      slug: "hardcore",
      label: "Recycled hardcore (6F5)",
      density_kg_per_m3: 1900,
      unit_price_per_tonne_pence: 3000,
      note: "Cheaper base course for driveways + hardstanding."
    },
    {
      slug: "sand",
      label: "Building sand",
      density_kg_per_m3: 1600,
      unit_price_per_tonne_pence: 5500,
      note: "For mortar mixes + block laying."
    },
    {
      slug: "gravel",
      label: "Gravel 10–20mm",
      density_kg_per_m3: 1700,
      unit_price_per_tonne_pence: 6000,
      note: "Decorative + drainage."
    },
    {
      slug: "topsoil",
      label: "Topsoil (screened)",
      density_kg_per_m3: 1350,
      unit_price_per_tonne_pence: 4000,
      note: "For gardens + landscaping."
    }
  ];
}

export function emptySiteCalculator(): PlantSiteCalculator {
  return {
    enabled: false,
    heading: "Site services calculator",
    subheading:
      "Type your area + depth — get tonnes, bags, mixes and a delivery quote. Same-day mixed loads if we're already going out.",
    materials: defaultSiteCalculatorMaterials(),
    waste_factor_percent: 10
  };
}

export function normaliseSiteCalculator(raw: unknown): PlantSiteCalculator {
  const base = emptySiteCalculator();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantSiteCalculator>;
  const mats = Array.isArray(r.materials) ? r.materials : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    materials:
      mats.length === 0
        ? base.materials
        : mats
            .map((m): SiteCalculatorMaterial | null => {
              if (!m || typeof m !== "object") return null;
              const o = m as Partial<SiteCalculatorMaterial>;
              const slug = typeof o.slug === "string" ? o.slug.slice(0, 40) : "";
              const label = typeof o.label === "string" ? o.label.slice(0, 80) : "";
              const dens = n(o.density_kg_per_m3, 100, 5000) ?? 2000;
              if (!slug || !label) return null;
              return {
                slug,
                label,
                density_kg_per_m3: dens,
                unit_price_per_tonne_pence: n(o.unit_price_per_tonne_pence, 0, 10_000_000),
                note: typeof o.note === "string" ? o.note.slice(0, 200) : "",
                category: typeof o.category === "string" ? o.category.slice(0, 40) : ""
              };
            })
            .filter((m): m is SiteCalculatorMaterial => m !== null)
            .slice(0, 20),
    waste_factor_percent: n(r.waste_factor_percent, 0, 100)
  };
}

// ─── REPEAT LADDER + NOTIFY + BULK ────────────────────────────────────

export type RepeatTier = {
  hires_required: number;
  discount_percent: number;
  label: string;
};

export type PlantRepeatLadder = {
  enabled: boolean;
  heading: string;
  subheading: string;
  tiers: RepeatTier[];
  reset_after_months: number | null;
};

export function emptyRepeatLadder(): PlantRepeatLadder {
  return {
    enabled: false,
    heading: "Repeat customer discount ladder",
    subheading: "The more you hire, the less you pay. Automatic — no code needed.",
    tiers: [
      { hires_required: 3, discount_percent: 5, label: "3rd hire onwards" },
      { hires_required: 6, discount_percent: 10, label: "6th hire — Silver" },
      { hires_required: 12, discount_percent: 15, label: "12th hire — Gold" },
      { hires_required: 24, discount_percent: 20, label: "24th hire — Platinum" }
    ],
    reset_after_months: 24
  };
}

export function normaliseRepeatLadder(raw: unknown): PlantRepeatLadder {
  const base = emptyRepeatLadder();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantRepeatLadder>;
  const tiers = Array.isArray(r.tiers) ? r.tiers : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    tiers:
      tiers.length === 0
        ? base.tiers
        : tiers
            .map((t): RepeatTier | null => {
              if (!t || typeof t !== "object") return null;
              const o = t as Partial<RepeatTier>;
              const hires = n(o.hires_required, 1, 999) ?? null;
              const disc = n(o.discount_percent, 0, 100) ?? null;
              if (hires === null || disc === null) return null;
              return {
                hires_required: hires,
                discount_percent: disc,
                label: typeof o.label === "string" ? o.label.slice(0, 60) : ""
              };
            })
            .filter((t): t is RepeatTier => t !== null)
            .slice(0, 10),
    reset_after_months: n(r.reset_after_months, 1, 120)
  };
}

export type PlantNotifyWhenFree = {
  enabled: boolean;
  heading: string;
  subheading: string;
};

export function emptyNotifyWhenFree(): PlantNotifyWhenFree {
  return {
    enabled: false,
    heading: "Machine you want on hire? We'll ping you.",
    subheading:
      "Tap the machine, drop your WhatsApp — we message you the day it returns. No spam, one message per machine."
  };
}

export function normaliseNotifyWhenFree(raw: unknown): PlantNotifyWhenFree {
  const base = emptyNotifyWhenFree();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantNotifyWhenFree>;
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 240)
        : base.subheading
  };
}

export type PlantBulkQuote = {
  enabled: boolean;
  heading: string;
  subheading: string;
  min_machines: number | null;
  min_duration_weeks: number | null;
  discount_hint_percent: number | null;
};

export function emptyBulkQuote(): PlantBulkQuote {
  return {
    enabled: false,
    heading: "Bulk / project hire",
    subheading:
      "5+ machines or a 4-week+ project? Skip the tile-by-tile — WhatsApp us a spec and we build one bespoke quote.",
    min_machines: 5,
    min_duration_weeks: 4,
    discount_hint_percent: 15
  };
}

export function normaliseBulkQuote(raw: unknown): PlantBulkQuote {
  const base = emptyBulkQuote();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantBulkQuote>;
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    min_machines: n(r.min_machines, 1, 500),
    min_duration_weeks: n(r.min_duration_weeks, 1, 52),
    discount_hint_percent: n(r.discount_hint_percent, 0, 100)
  };
}

// ─── CLOSURE CALENDAR + SUB-HIRE ─────────────────────────────────────

export type ClosureDate = {
  date: string;
  label: string;
  half_day: boolean;
};

export type PlantClosureCalendar = {
  enabled: boolean;
  heading: string;
  subheading: string;
  closures: ClosureDate[];
  weekend_note: string;
};

export function emptyClosureCalendar(): PlantClosureCalendar {
  return {
    enabled: false,
    heading: "Yard opening + upcoming closures",
    subheading: "Bank holidays + planned closures — book around us, not into a locked gate.",
    closures: [],
    weekend_note: "Saturdays 08:00–12:00 · Sundays closed"
  };
}

export function normaliseClosureCalendar(raw: unknown): PlantClosureCalendar {
  const base = emptyClosureCalendar();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantClosureCalendar>;
  const list = Array.isArray(r.closures) ? r.closures : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 240)
        : base.subheading,
    closures: list
      .map((c): ClosureDate | null => {
        if (!c || typeof c !== "object") return null;
        const o = c as Partial<ClosureDate>;
        const date = typeof o.date === "string" && isValidIsoDate(o.date) ? o.date : "";
        if (!date) return null;
        return {
          date,
          label: typeof o.label === "string" ? o.label.slice(0, 60) : "",
          half_day: o.half_day === true
        };
      })
      .filter((c): c is ClosureDate => c !== null)
      .slice(0, 40),
    weekend_note:
      typeof r.weekend_note === "string" ? r.weekend_note.slice(0, 120) : base.weekend_note
  };
}

export type SubHirePartner = { name: string; logo_url: string; note: string };

export type PlantSubHire = {
  enabled: boolean;
  heading: string;
  subheading: string;
  partners: SubHirePartner[];
  markup_percent: number | null;
};

export function emptySubHire(): PlantSubHire {
  return {
    enabled: false,
    heading: "Not listed? Ask us anyway.",
    subheading:
      "We partner with Trade Circle — the UK trades network — to source machines, parts and consumables you can't find on our shelves. Same rates, same insurance, same delivery SLA. You deal with us; we do the running around.",
    partners: [],
    markup_percent: 0
  };
}

export function normaliseSubHire(raw: unknown): PlantSubHire {
  const base = emptySubHire();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantSubHire>;
  const partners = Array.isArray(r.partners) ? r.partners : [];
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 120)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    partners: partners
      .map((p): SubHirePartner | null => {
        if (!p || typeof p !== "object") return null;
        const o = p as Partial<SubHirePartner>;
        const name = typeof o.name === "string" ? o.name.slice(0, 60) : "";
        if (!name) return null;
        return {
          name,
          logo_url: typeof o.logo_url === "string" ? o.logo_url.slice(0, 800) : "",
          note: typeof o.note === "string" ? o.note.slice(0, 200) : ""
        };
      })
      .filter((p): p is SubHirePartner => p !== null)
      .slice(0, 20),
    markup_percent: n(r.markup_percent, 0, 100)
  };
}

// ─── PAYMENT GATEWAYS ─────────────────────────────────────────────────

export type PaymentGatewaySlug =
  | "stripe"
  | "gocardless"
  | "paypal"
  | "klarna"
  | "bacs"
  | "card_over_phone";

export type PaymentGatewayConfig = {
  enabled: boolean;
  /** Overrides the platform display name if set. */
  display_name: string;
  /** Pre-created payment / payment-link URL (Stripe Payment Link,
   *  PayPal.me, GoCardless one-off collection, etc.). */
  payment_url: string;
  /** For BACS or over-the-phone: the details the customer needs to
   *  actually pay. Sanitised HTML-free. */
  instructions: string;
  /** Free text — "1.5% + 20p" etc. Purely display. */
  fee_note: string;
};

export const PAYMENT_GATEWAY_META: {
  slug: PaymentGatewaySlug;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    slug: "stripe",
    label: "Stripe (card + Apple / Google Pay)",
    description: "Card payments via Stripe payment link. Supports Apple/Google Pay.",
    icon: "💳"
  },
  {
    slug: "gocardless",
    label: "GoCardless (direct debit)",
    description: "Best for weekly + monthly hires. 1–3 day clearance.",
    icon: "🏦"
  },
  {
    slug: "paypal",
    label: "PayPal / PayPal.me",
    description: "Universal fallback — customer sends via PayPal or PayPal.me link.",
    icon: "🅿️"
  },
  {
    slug: "klarna",
    label: "Klarna (buy-now-pay-later)",
    description: "Split into 3 or 30-day terms for larger hires.",
    icon: "🎨"
  },
  {
    slug: "bacs",
    label: "Bank transfer (BACS / Faster Payments)",
    description: "Manual — customer pays into your business account.",
    icon: "🏛️"
  },
  {
    slug: "card_over_phone",
    label: "Card over the phone",
    description: "Merchant takes card details via a call.",
    icon: "📞"
  }
];

export type PlantPaymentGateways = {
  enabled: boolean;
  heading: string;
  subheading: string;
  /** Deposit % taken at booking (rest on balance_when). */
  deposit_percent: number | null;
  /** Free-text label for when the balance is due — "on delivery",
   *  "on off-hire", "net 30", etc. */
  balance_when: string;
  gateways: Record<PaymentGatewaySlug, PaymentGatewayConfig>;
};

export function emptyPaymentGatewayConfig(): PaymentGatewayConfig {
  return {
    enabled: false,
    display_name: "",
    payment_url: "",
    instructions: "",
    fee_note: ""
  };
}

export function emptyPaymentGateways(): PlantPaymentGateways {
  return {
    enabled: false,
    heading: "Accepted payment methods",
    subheading:
      "Choose the method that suits you when we confirm the booking. Deposit taken on confirmation; balance due on delivery.",
    deposit_percent: 25,
    balance_when: "on delivery",
    gateways: {
      stripe: emptyPaymentGatewayConfig(),
      gocardless: emptyPaymentGatewayConfig(),
      paypal: emptyPaymentGatewayConfig(),
      klarna: emptyPaymentGatewayConfig(),
      bacs: emptyPaymentGatewayConfig(),
      card_over_phone: emptyPaymentGatewayConfig()
    }
  };
}

export function normalisePaymentGateways(raw: unknown): PlantPaymentGateways {
  const base = emptyPaymentGateways();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantPaymentGateways>;
  const gw: Record<PaymentGatewaySlug, PaymentGatewayConfig> = { ...base.gateways };
  const rawGateways = (r.gateways ?? {}) as Partial<
    Record<PaymentGatewaySlug, Partial<PaymentGatewayConfig>>
  >;
  for (const meta of PAYMENT_GATEWAY_META) {
    const g = rawGateways[meta.slug];
    if (g && typeof g === "object") {
      gw[meta.slug] = {
        enabled: g.enabled === true,
        display_name: typeof g.display_name === "string" ? g.display_name.slice(0, 60) : "",
        payment_url: typeof g.payment_url === "string" ? g.payment_url.slice(0, 800) : "",
        instructions: typeof g.instructions === "string" ? g.instructions.slice(0, 400) : "",
        fee_note: typeof g.fee_note === "string" ? g.fee_note.slice(0, 60) : ""
      };
    }
  }
  return {
    enabled: r.enabled === true,
    heading:
      typeof r.heading === "string" && r.heading.trim().length > 0
        ? r.heading.slice(0, 100)
        : base.heading,
    subheading:
      typeof r.subheading === "string" && r.subheading.trim().length > 0
        ? r.subheading.slice(0, 300)
        : base.subheading,
    deposit_percent: n(r.deposit_percent, 0, 100),
    balance_when: typeof r.balance_when === "string" ? r.balance_when.slice(0, 60) : base.balance_when,
    gateways: gw
  };
}

export function emptyBreakdownService(): PlantBreakdownService {
  return {
    enabled: false,
    own_machine_supported: true,
    third_party_supported: false,
    callout_fee_pence: null,
    hourly_rate_pence: null,
    minimum_callout_hours: 1,
    parts_markup_percent: 15,
    payment_options: {
      card_before_dispatch: false,
      card_after_fix: true,
      cash_on_fix: true,
      trade_account: false
    },
    terms_of_service: "",
    sla_local_hours: 4,
    sla_national_hours: 24
  };
}

// ─── PRESETS ──────────────────────────────────────────────────────────

export const TRUST_BENEFITS_PRESET: PlantTrustBenefit[] = [
  { label: "CPA Terms & Conditions", url: "" },
  { label: "Hired-In Insured", url: "" },
  { label: "CPCS-carded Operators", url: "" },
  { label: "HSE-audited fleet", url: "" },
  { label: "Same-day local delivery", url: "" },
  { label: "24/7 breakdown line", url: "" },
  { label: "Weekend hire available", url: "" },
  { label: "Trade accounts welcome", url: "" }
];

export const PLANT_BRANDS_PRESET: PlantBrand[] = [
  { name: "JCB", logo_url: null },
  { name: "Kubota", logo_url: null },
  { name: "Bomag", logo_url: null },
  { name: "Manitou", logo_url: null },
  { name: "Merlo", logo_url: null },
  { name: "Genie", logo_url: null },
  { name: "Bobcat", logo_url: null },
  { name: "Terex", logo_url: null },
  { name: "Thwaites", logo_url: null },
  { name: "Takeuchi", logo_url: null },
  { name: "Hitachi", logo_url: null },
  { name: "Wacker Neuson", logo_url: null }
];

export const TRADE_CUSTOMERS_PRESET: string[] = [
  "Builders",
  "Groundworkers",
  "Landscapers",
  "Drainage contractors",
  "Roofers",
  "Scaffolders",
  "Fencing contractors",
  "Utility contractors",
  "Housebuilders",
  "Housing associations",
  "Local councils",
  "Facilities management",
  "Farmers",
  "Property developers",
  "Self-builders"
];

export const WAIVER_OPTIONS_PRESET: PlantWaiverOption[] = [
  {
    slug: "theft_only",
    label: "Theft-only cover",
    price_day_pence: 800,
    excess_pence: 50000,
    note: "Covers theft only. £500 excess. Add on request at hire."
  },
  {
    slug: "full_waiver",
    label: "Full damage waiver",
    price_day_pence: 1500,
    excess_pence: 25000,
    note: "Covers theft + accidental damage. £250 excess. Recommended for site work."
  },
  {
    slug: "own_certificate",
    label: "Your own hired-in insurance",
    price_day_pence: 0,
    excess_pence: null,
    note: "Bring a valid certificate showing the merchant as loss payee — no waiver charge."
  }
];

export const DELIVERY_ZONES_PRESET: PlantDeliveryZone[] = [
  {
    label: "Local (10 miles from yard)",
    free_radius_miles: 10,
    price_per_mile_pence: null,
    fixed_price_pence: 0,
    note: "Free within 10 miles both ways."
  },
  {
    label: "Regional (up to 30 miles)",
    free_radius_miles: null,
    price_per_mile_pence: 250,
    fixed_price_pence: null,
    note: "Charged per mile each way beyond 10 miles."
  },
  {
    label: "National",
    free_radius_miles: null,
    price_per_mile_pence: null,
    fixed_price_pence: null,
    note: "Quoted per job — WhatsApp us the site postcode."
  }
];

export const BULK_TIERS_PRESET: PlantBulkTier[] = [
  { min_period_days: 14, label: "5% off 2-week+ hires" },
  { min_period_days: 28, label: "10% off month+ hires" },
  { min_period_days: 84, label: "15% off 3-month+ hires" },
  { min_period_days: 168, label: "WhatsApp for a 6-month contract quote" }
];

export const FAQ_PRESET: PlantFaq[] = [
  { q: "What do I need to hire a machine self-drive?", a: "Photo ID (driving licence or passport) and a recent utility bill or bank statement. No trade account needed — same as Travis Perkins TP Hire. For machines above 3.5T on the road you'll also need the correct entitlement on your licence." },
  { q: "Do I need a CPCS card?", a: "On any commercial or construction site, yes — CPCS or NPORS for plant, IPAF for MEWPs. For private / domestic sites (your own garden, a farm), no card is legally required but you must operate safely." },
  { q: "Is delivery included?", a: "Delivery is free within our local zone (see the Delivery section). Beyond that we charge per mile each way or quote per job for national hires. Collection back to our yard follows the same rates." },
  { q: "What about fuel?", a: "Diesel is excluded on machine hire — return with a full tank or pay our refuel charge, which is higher than pump because we use a bowser. Electric machines (scissors, small MEWPs) charge included." },
  { q: "How does the damage waiver work?", a: "You choose at hire: theft-only, full waiver, or bring your own hired-in insurance certificate. Both waivers carry an excess — see the Damage Waiver section for the numbers. Insurance without waiver is at your own risk." },
  { q: "What are the weekend rates?", a: "Delivered Friday afternoon, collected Monday morning = 1 day charge (industry standard). Delivered any other combination is charged pro-rata to the daily rate." },
  { q: "Can I hire with an operator?", a: "Yes — for most machines we can supply a CPCS-carded operator at the day rate premium shown. Operators are booked 24 hours in advance minimum. WhatsApp us for last-minute jobs." },
  { q: "What if the machine breaks down?", a: "Call the 24/7 breakdown line printed on the machine. Any fault that stops production is replaced same day within our local zone, next day nationally. Damage caused by misuse is chargeable — always inspect the machine on delivery and report any pre-existing damage in writing." },
  { q: "Do I need to provide a deposit?", a: "Yes for self-drive hire — refundable and taken as a card pre-auth on delivery, released on safe return. Long-term contracts (28+ days) may waive the deposit against a trade account." },
  { q: "Can I extend the hire?", a: "Yes — WhatsApp us before your end date. Extensions roll onto whichever tier gives you the best rate (day → week → month automatically). Failing to notify results in the machine being classed as overdue and chargeable at the day rate." }
];

export function emptyPlantHireConfig(): PlantHireConfig {
  return {
    categories: {},
    modes: { collect: true, delivery: true, operator: false, long_term: true },
    years_hiring: null,
    cpa_terms: true,
    hired_in_insured: true,
    cpcs_operators: false,
    hse_audited: false,
    turnaround_text: "",
    fuel_policy: "refuel_on_return",
    fuel_refuel_pence_per_litre: null,
    weekend_rate_percent: null,
    bank_holiday_surcharge_percent: null,
    deposit_pence: null,
    min_operator_age: 21,
    cpcs_required: false,
    yard_address: "",
    yard_open_from: "",
    yard_open_to: "",
    banner_image_url: "",
    illustration_image_url: "",
    custom_note: "",
    trust_benefits: [],
    plant_brands: [],
    waiver_options: [],
    delivery_zones: [],
    bulk_tiers: [],
    trade_customers: [],
    faq: [],
    promo_banner: { enabled: false, text: "", cta_label: "", cta_href: "" },
    headline_text: "",
    section_headings: {
      trust_benefits: "",
      brands: "",
      what_we_hire: "",
      how_to_hire: "",
      delivery: "",
      waivers: "",
      bulk: "",
      trade_customers: "",
      related_products: "",
      faq: ""
    },
    explanatory_paragraphs: [],
    mode_bodies: { collect: "", delivery: "", operator: "", long_term: "" },
    related_product_categories: [],
    sections_enabled: { ...DEFAULT_SECTIONS_ENABLED },
    depot_postcode: "",
    breakdown_service: emptyBreakdownService(),
    haulage_service: emptyHaulageService(),
    video_center: emptyVideoCenter(),
    trade_accounts: emptyTradeAccounts(),
    driver_recruitment: emptyDriverRecruitment(),
    team: emptyTeamSection(),
    parts_counter: emptyPartsCounter(),
    compliance_info: emptyComplianceInfo(),
    trust_signals: emptyTrustSignals(),
    cdm_pack: emptyCdmPack(),
    machine_finder: emptyMachineFinder(),
    site_calculator: emptySiteCalculator(),
    repeat_ladder: emptyRepeatLadder(),
    notify_when_free: emptyNotifyWhenFree(),
    bulk_quote: emptyBulkQuote(),
    closure_calendar: emptyClosureCalendar(),
    sub_hire: emptySubHire(),
    payment_gateways: emptyPaymentGateways(),
    showcase_enabled: true,
    layout_config: null
  };
}

function n(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function normalisePlantHireConfig(raw: unknown): PlantHireConfig {
  const base = emptyPlantHireConfig();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantHireConfig>;
  return {
    categories:
      r.categories && typeof r.categories === "object" ? r.categories : {},
    modes: {
      collect: r.modes?.collect !== false,
      delivery: r.modes?.delivery === true || r.modes?.delivery === undefined,
      operator: r.modes?.operator === true,
      long_term: r.modes?.long_term === true || r.modes?.long_term === undefined
    },
    years_hiring: n(r.years_hiring, 0, 100),
    cpa_terms: r.cpa_terms !== false,
    hired_in_insured: r.hired_in_insured !== false,
    cpcs_operators: r.cpcs_operators === true,
    hse_audited: r.hse_audited === true,
    turnaround_text: typeof r.turnaround_text === "string" ? r.turnaround_text : "",
    fuel_policy: (["refuel_on_return", "pay_refuel_charge", "diesel_included", "electric_only"] as const).includes(
      r.fuel_policy as FuelPolicy
    )
      ? (r.fuel_policy as FuelPolicy)
      : "refuel_on_return",
    fuel_refuel_pence_per_litre: n(r.fuel_refuel_pence_per_litre, 0, 100000),
    weekend_rate_percent: n(r.weekend_rate_percent, 0, 300),
    bank_holiday_surcharge_percent: n(r.bank_holiday_surcharge_percent, 0, 300),
    deposit_pence: n(r.deposit_pence, 0, 10_000_000),
    min_operator_age: n(r.min_operator_age, 16, 80),
    cpcs_required: r.cpcs_required === true,
    yard_address: typeof r.yard_address === "string" ? r.yard_address : "",
    yard_open_from: typeof r.yard_open_from === "string" ? r.yard_open_from : "",
    yard_open_to: typeof r.yard_open_to === "string" ? r.yard_open_to : "",
    banner_image_url: typeof r.banner_image_url === "string" ? r.banner_image_url : "",
    illustration_image_url:
      typeof r.illustration_image_url === "string" ? r.illustration_image_url : "",
    custom_note: typeof r.custom_note === "string" ? r.custom_note : "",
    trust_benefits: Array.isArray(r.trust_benefits)
      ? (r.trust_benefits as unknown[])
          .map((item): PlantTrustBenefit | null => {
            if (typeof item === "string") {
              const s = item.slice(0, 60);
              return s ? { label: s, url: "" } : null;
            }
            if (item && typeof item === "object") {
              const o = item as { label?: unknown; url?: unknown };
              const label = typeof o.label === "string" ? o.label.slice(0, 60) : "";
              if (!label) return null;
              const url = typeof o.url === "string" ? o.url.slice(0, 800) : "";
              return { label, url };
            }
            return null;
          })
          .filter((x): x is PlantTrustBenefit => x !== null)
          .slice(0, 16)
      : [],
    plant_brands: Array.isArray(r.plant_brands)
      ? (r.plant_brands as unknown[])
          .map((x): PlantBrand | null => {
            if (typeof x === "string") return { name: x, logo_url: null };
            if (x && typeof x === "object") {
              const b = x as { name?: unknown; logo_url?: unknown };
              const name = typeof b.name === "string" ? b.name.slice(0, 40) : "";
              if (!name) return null;
              const logo = typeof b.logo_url === "string" ? b.logo_url.slice(0, 800) : null;
              return { name, logo_url: logo && logo.length > 0 ? logo : null };
            }
            return null;
          })
          .filter((b): b is PlantBrand => b !== null)
          .slice(0, 20)
      : [],
    waiver_options: Array.isArray(r.waiver_options)
      ? (r.waiver_options as unknown[])
          .map((x): PlantWaiverOption | null => {
            if (!x || typeof x !== "object") return null;
            const o = x as Partial<PlantWaiverOption>;
            const slug = typeof o.slug === "string" ? o.slug.slice(0, 40) : "";
            const label = typeof o.label === "string" ? o.label.slice(0, 80) : "";
            if (!slug || !label) return null;
            return {
              slug,
              label,
              price_day_pence: n(o.price_day_pence, 0, 1_000_000),
              excess_pence: n(o.excess_pence, 0, 10_000_000),
              note: typeof o.note === "string" ? o.note.slice(0, 300) : ""
            };
          })
          .filter((w): w is PlantWaiverOption => w !== null)
          .slice(0, 6)
      : [],
    delivery_zones: Array.isArray(r.delivery_zones)
      ? (r.delivery_zones as unknown[])
          .map((x): PlantDeliveryZone | null => {
            if (!x || typeof x !== "object") return null;
            const o = x as Partial<PlantDeliveryZone>;
            const label = typeof o.label === "string" ? o.label.slice(0, 80) : "";
            if (!label) return null;
            return {
              label,
              free_radius_miles: n(o.free_radius_miles, 0, 500),
              price_per_mile_pence: n(o.price_per_mile_pence, 0, 100000),
              fixed_price_pence: n(o.fixed_price_pence, 0, 10_000_000),
              note: typeof o.note === "string" ? o.note.slice(0, 200) : ""
            };
          })
          .filter((z): z is PlantDeliveryZone => z !== null)
          .slice(0, 8)
      : [],
    bulk_tiers: Array.isArray(r.bulk_tiers)
      ? r.bulk_tiers
          .filter((x): x is PlantBulkTier =>
            !!x &&
            typeof x === "object" &&
            typeof (x as PlantBulkTier).min_period_days === "number" &&
            typeof (x as PlantBulkTier).label === "string"
          )
          .map((t) => ({
            min_period_days: Math.max(1, Math.round(t.min_period_days)),
            label: t.label.slice(0, 60)
          }))
          .slice(0, 10)
      : [],
    trade_customers: Array.isArray(r.trade_customers)
      ? r.trade_customers.filter((x): x is string => typeof x === "string").slice(0, 30)
      : [],
    faq: Array.isArray(r.faq)
      ? r.faq
          .filter((x): x is PlantFaq =>
            !!x &&
            typeof x === "object" &&
            typeof (x as PlantFaq).q === "string" &&
            typeof (x as PlantFaq).a === "string"
          )
          .map((f) => ({ q: f.q.slice(0, 200), a: f.a.slice(0, 1200) }))
          .slice(0, 20)
      : [],
    promo_banner:
      r.promo_banner && typeof r.promo_banner === "object"
        ? {
            enabled: (r.promo_banner as { enabled?: unknown }).enabled === true,
            text:
              typeof (r.promo_banner as { text?: unknown }).text === "string"
                ? ((r.promo_banner as { text: string }).text).slice(0, 200)
                : "",
            cta_label:
              typeof (r.promo_banner as { cta_label?: unknown }).cta_label === "string"
                ? ((r.promo_banner as { cta_label: string }).cta_label).slice(0, 40)
                : "",
            cta_href:
              typeof (r.promo_banner as { cta_href?: unknown }).cta_href === "string"
                ? ((r.promo_banner as { cta_href: string }).cta_href).slice(0, 400)
                : ""
          }
        : { enabled: false, text: "", cta_label: "", cta_href: "" },
    headline_text: typeof r.headline_text === "string" ? r.headline_text.slice(0, 120) : "",
    section_headings:
      r.section_headings && typeof r.section_headings === "object"
        ? {
            trust_benefits: str80((r.section_headings as Record<string, unknown>).trust_benefits),
            brands: str80((r.section_headings as Record<string, unknown>).brands),
            what_we_hire: str80((r.section_headings as Record<string, unknown>).what_we_hire),
            how_to_hire: str80((r.section_headings as Record<string, unknown>).how_to_hire),
            delivery: str80((r.section_headings as Record<string, unknown>).delivery),
            waivers: str80((r.section_headings as Record<string, unknown>).waivers),
            bulk: str80((r.section_headings as Record<string, unknown>).bulk),
            trade_customers: str80((r.section_headings as Record<string, unknown>).trade_customers),
            related_products: str80((r.section_headings as Record<string, unknown>).related_products),
            faq: str80((r.section_headings as Record<string, unknown>).faq)
          }
        : {
            trust_benefits: "",
            brands: "",
            what_we_hire: "",
            how_to_hire: "",
            delivery: "",
            waivers: "",
            bulk: "",
            trade_customers: "",
            related_products: "",
            faq: ""
          },
    explanatory_paragraphs: Array.isArray(r.explanatory_paragraphs)
      ? r.explanatory_paragraphs.filter((x): x is string => typeof x === "string").slice(0, 6)
      : [],
    mode_bodies:
      r.mode_bodies && typeof r.mode_bodies === "object"
        ? {
            collect: str400((r.mode_bodies as Record<string, unknown>).collect),
            delivery: str400((r.mode_bodies as Record<string, unknown>).delivery),
            operator: str400((r.mode_bodies as Record<string, unknown>).operator),
            long_term: str400((r.mode_bodies as Record<string, unknown>).long_term)
          }
        : { collect: "", delivery: "", operator: "", long_term: "" },
    related_product_categories: Array.isArray(r.related_product_categories)
      ? r.related_product_categories.filter((x): x is string => typeof x === "string").slice(0, 20)
      : [],
    sections_enabled:
      r.sections_enabled && typeof r.sections_enabled === "object"
        ? {
            ...DEFAULT_SECTIONS_ENABLED,
            ...(r.sections_enabled as Partial<PlantHireSectionsEnabled>)
          }
        : { ...DEFAULT_SECTIONS_ENABLED },
    depot_postcode: typeof r.depot_postcode === "string" ? r.depot_postcode.slice(0, 12) : "",
    breakdown_service: normaliseBreakdownService(r.breakdown_service),
    haulage_service: normaliseHaulageService(
      (r as { haulage_service?: unknown }).haulage_service
    ),
    video_center: normaliseVideoCenter((r as { video_center?: unknown }).video_center),
    trade_accounts: normaliseTradeAccounts((r as { trade_accounts?: unknown }).trade_accounts),
    driver_recruitment: normaliseDriverRecruitment(
      (r as { driver_recruitment?: unknown }).driver_recruitment
    ),
    team: normaliseTeamSection((r as { team?: unknown }).team),
    parts_counter: normalisePartsCounter((r as { parts_counter?: unknown }).parts_counter),
    compliance_info: normaliseComplianceInfo((r as { compliance_info?: unknown }).compliance_info),
    trust_signals: normaliseTrustSignals((r as { trust_signals?: unknown }).trust_signals),
    cdm_pack: normaliseCdmPack((r as { cdm_pack?: unknown }).cdm_pack),
    machine_finder: normaliseMachineFinder((r as { machine_finder?: unknown }).machine_finder),
    site_calculator: normaliseSiteCalculator((r as { site_calculator?: unknown }).site_calculator),
    repeat_ladder: normaliseRepeatLadder((r as { repeat_ladder?: unknown }).repeat_ladder),
    notify_when_free: normaliseNotifyWhenFree((r as { notify_when_free?: unknown }).notify_when_free),
    bulk_quote: normaliseBulkQuote((r as { bulk_quote?: unknown }).bulk_quote),
    closure_calendar: normaliseClosureCalendar((r as { closure_calendar?: unknown }).closure_calendar),
    sub_hire: normaliseSubHire((r as { sub_hire?: unknown }).sub_hire),
    payment_gateways: normalisePaymentGateways(
      (r as { payment_gateways?: unknown }).payment_gateways
    ),
    showcase_enabled:
      (r as { showcase_enabled?: unknown }).showcase_enabled === false ? false : true,
    layout_config: normaliseLayoutConfig((r as { layout_config?: unknown }).layout_config)
  };
}

function normaliseBreakdownService(raw: unknown): PlantBreakdownService {
  const base = emptyBreakdownService();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlantBreakdownService>;
  const pay = (r.payment_options ?? {}) as Partial<PlantBreakdownService["payment_options"]>;
  return {
    enabled: r.enabled === true,
    own_machine_supported: r.own_machine_supported !== false,
    third_party_supported: r.third_party_supported === true,
    callout_fee_pence: n(r.callout_fee_pence, 0, 10_000_000),
    hourly_rate_pence: n(r.hourly_rate_pence, 0, 10_000_000),
    minimum_callout_hours: n(r.minimum_callout_hours, 0, 24) ?? 1,
    parts_markup_percent: n(r.parts_markup_percent, 0, 100) ?? 15,
    payment_options: {
      card_before_dispatch: pay.card_before_dispatch === true,
      card_after_fix: pay.card_after_fix !== false,
      cash_on_fix: pay.cash_on_fix !== false,
      trade_account: pay.trade_account === true
    },
    terms_of_service:
      typeof r.terms_of_service === "string" ? r.terms_of_service.slice(0, 2000) : "",
    sla_local_hours: n(r.sla_local_hours, 0, 168) ?? 4,
    sla_national_hours: n(r.sla_national_hours, 0, 720) ?? 24
  };
}

function str80(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 80) : "";
}
function str400(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 400) : "";
}

export function enabledPlantSlugs(cfg: PlantHireConfig): PlantCategorySlug[] {
  const out: PlantCategorySlug[] = [];
  for (const meta of PLANT_CATEGORIES) {
    const c = cfg.categories[meta.slug];
    if (c?.enabled) out.push(meta.slug);
  }
  return out;
}

export function isPlantHireConfigured(cfg: PlantHireConfig): boolean {
  const anyCat = enabledPlantSlugs(cfg).length > 0;
  const anyMode =
    cfg.modes.collect || cfg.modes.delivery || cfg.modes.operator || cfg.modes.long_term;
  return anyCat && anyMode;
}

export function formatPriceFrom(pence: number | null | undefined, suffix = "/day"): string {
  if (!pence || pence <= 0) return "POA";
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `from £${pounds}${suffix}` : `from £${pounds.toFixed(2)}${suffix}`;
}

export function formatPounds(pence: number | null | undefined): string {
  if (!pence || pence <= 0) return "POA";
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}
