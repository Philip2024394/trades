// POST /api/trade-off/plant-hire/save — writes the full Plant Hire
// config blob to the listing's plant_hire JSONB column. Everything is
// sanitised on the server; blank strings become "".

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  DEFAULT_SECTIONS_ENABLED,
  PLANT_CATEGORIES,
  isValidIsoDate,
  normalisePlantHireConfig,
  type PlantCategorySlug,
  type PlantHireConfig,
  type PlantHireSectionsEnabled,
  type PlantReview,
  type PlantSpec
} from "@/lib/plantHire";

export const runtime = "nodejs";

type Body = {
  slug: string;
  token: string;
  config: Partial<PlantHireConfig> & {
    categories?: Partial<
      Record<
        PlantCategorySlug,
        {
          enabled: unknown;
          price_day_pence: unknown;
          price_week_pence: unknown;
          price_month_pence: unknown;
          operator_premium_day_pence: unknown;
          note: unknown;
        }
      >
    >;
  };
};

function s(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function pencesOrNull(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function clampFloat(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function sanitizeSpecs(raw: Record<string, unknown>): PlantSpec {
  const num = (v: unknown): number | null => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
  };
  const fuel = ["diesel", "petrol", "electric", "hybrid"];
  const emis = ["stage_v", "stage_iiib", "euro_6"];
  return {
    weight_kg: num(raw.weight_kg),
    dig_depth_mm: num(raw.dig_depth_mm),
    reach_mm: num(raw.reach_mm),
    hp: num(raw.hp),
    bucket_l: num(raw.bucket_l),
    transport_length_mm: num(raw.transport_length_mm),
    transport_width_mm: num(raw.transport_width_mm),
    transport_height_mm: num(raw.transport_height_mm),
    fuel_type: (fuel.includes(raw.fuel_type as string) ? raw.fuel_type : "") as PlantSpec["fuel_type"],
    emission: (emis.includes(raw.emission as string) ? raw.emission : "") as PlantSpec["emission"],
    noise_db_operator: num(raw.noise_db_operator),
    noise_db_bystander: num(raw.noise_db_bystander),
    ground_pressure_kpa: num(raw.ground_pressure_kpa),
    fuel_tank_l: num(raw.fuel_tank_l),
    run_time_hours: num(raw.run_time_hours),
    ulez_compliant:
      raw.ulez_compliant === true ? true : raw.ulez_compliant === false ? false : null
  };
}

function sanitizeSections(raw: unknown): PlantHireSectionsEnabled {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SECTIONS_ENABLED };
  const out: PlantHireSectionsEnabled = { ...DEFAULT_SECTIONS_ENABLED };
  for (const key of Object.keys(out) as (keyof PlantHireSectionsEnabled)[]) {
    const v = (raw as Record<string, unknown>)[key];
    if (v === true || v === false) out[key] = v;
  }
  return out;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug || !body.token || !body.config) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!row.data) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }

  const base = normalisePlantHireConfig(body.config);
  const cleanedCategories: PlantHireConfig["categories"] = {};
  for (const meta of PLANT_CATEGORIES) {
    const raw = body.config.categories?.[meta.slug];
    if (!raw) continue;
    const rawSubs = (raw as { sub_types?: unknown }).sub_types;
    const cleanedSubs = Array.isArray(rawSubs)
      ? rawSubs
          .map((x) => s(x, 60))
          .filter((x) => x.length > 0)
          .slice(0, 20)
      : [];
    const rawImg = (raw as { image_url?: unknown }).image_url;
    const rawGallery = (raw as { gallery_urls?: unknown }).gallery_urls;
    const cleanedGallery = Array.isArray(rawGallery)
      ? (rawGallery as unknown[])
          .map((u) => s(u, 800))
          .filter((u) => /^https?:\/\//i.test(u))
          .slice(0, 5)
      : [];
    const rawVideo = (raw as { video_url?: unknown }).video_url;
    const cleanedVideo = typeof rawVideo === "string" ? s(rawVideo, 800) : "";
    const rawBrochure = (raw as { brochure_pdf_url?: unknown }).brochure_pdf_url;
    const cleanedBrochure = typeof rawBrochure === "string" ? s(rawBrochure, 800) : "";
    const rawLoler = (raw as { loler_cert_url?: unknown }).loler_cert_url;
    const cleanedLoler = typeof rawLoler === "string" ? s(rawLoler, 800) : "";
    const rawDiagram = (raw as { dimension_diagram_url?: unknown }).dimension_diagram_url;
    const cleanedDiagram = typeof rawDiagram === "string" ? s(rawDiagram, 800) : "";
    const rawRunning = (raw as { running_text?: unknown }).running_text;
    const cleanedRunning = typeof rawRunning === "string" ? s(rawRunning, 240) : "";
    const rawCompat = (raw as { compatible_attachments?: unknown }).compatible_attachments;
    const cleanedCompat = Array.isArray(rawCompat)
      ? (rawCompat as unknown[])
          .map((c) => s(c, 40))
          .filter((c) => c.length > 0)
          .slice(0, 12)
      : [];
    const rawSpecs = (raw as { specs?: unknown }).specs;
    const cleanedSpecs: PlantSpec = rawSpecs && typeof rawSpecs === "object"
      ? sanitizeSpecs(rawSpecs as Record<string, unknown>)
      : {};
    const rawRating = (raw as { rating?: unknown }).rating;
    const cleanedRating =
      rawRating && typeof rawRating === "object" && "avg" in (rawRating as Record<string, unknown>)
        ? {
            avg: clampFloat((rawRating as Record<string, unknown>).avg, 0, 5),
            count: pencesOrNull((rawRating as Record<string, unknown>).count) ?? 0
          }
        : { avg: 0, count: 0 };
    const rawReviews = (raw as { reviews?: unknown }).reviews;
    const cleanedReviews: PlantReview[] = Array.isArray(rawReviews)
      ? (rawReviews as unknown[])
          .map((rv): PlantReview | null => {
            if (!rv || typeof rv !== "object") return null;
            const o = rv as Record<string, unknown>;
            const author = s(o.author, 60);
            const text = s(o.text, 400);
            const date = s(o.date, 10);
            const rating = clampFloat(o.rating, 1, 5);
            const avatar = typeof o.avatar_url === "string" ? s(o.avatar_url, 800) : "";
            if (!author || !text) return null;
            const ratings = o.service_ratings as Record<string, unknown> | undefined;
            const service_ratings = ratings
              ? {
                  machine_quality: clampFloat(ratings.machine_quality, 0, 5) || undefined,
                  service: clampFloat(ratings.service, 0, 5) || undefined,
                  price: clampFloat(ratings.price, 0, 5) || undefined,
                  punctuality: clampFloat(ratings.punctuality, 0, 5) || undefined
                }
              : undefined;
            return {
              author,
              rating,
              text,
              date,
              ...(avatar ? { avatar_url: avatar } : {}),
              ...(service_ratings ? { service_ratings } : {})
            };
          })
          .filter((r): r is PlantReview => r !== null)
          .slice(0, 20)
      : [];
    const rawBlocks = (raw as { blocked_ranges?: unknown }).blocked_ranges;
    const cleanedBlocks: { from: string; to: string; note?: string }[] = Array.isArray(rawBlocks)
      ? (rawBlocks as unknown[])
          .map((r) => {
            if (!r || typeof r !== "object") return null;
            const o = r as { from?: unknown; to?: unknown; note?: unknown };
            const from = isValidIsoDate(o.from) ? o.from : null;
            const to = isValidIsoDate(o.to) ? o.to : null;
            if (!from || !to || from > to) return null;
            const note = typeof o.note === "string" ? o.note.slice(0, 120) : "";
            return note ? { from, to, note } : { from, to };
          })
          .filter((x): x is { from: string; to: string; note?: string } => x !== null)
          .slice(0, 50)
      : [];
    cleanedCategories[meta.slug] = {
      enabled: raw.enabled === true,
      price_day_pence: pencesOrNull(raw.price_day_pence),
      price_week_pence: pencesOrNull(raw.price_week_pence),
      price_month_pence: pencesOrNull(raw.price_month_pence),
      operator_premium_day_pence: pencesOrNull(raw.operator_premium_day_pence),
      note: s(raw.note, 240),
      cart_enabled:
        (raw as { cart_enabled?: unknown }).cart_enabled === true
          ? true
          : (raw as { cart_enabled?: unknown }).cart_enabled === false
            ? false
            : meta.cart_default_on,
      sub_types: cleanedSubs,
      image_url: typeof rawImg === "string" ? s(rawImg, 800) : "",
      gallery_urls: cleanedGallery,
      video_url: cleanedVideo,
      brochure_pdf_url: cleanedBrochure,
      loler_cert_url: cleanedLoler,
      dimension_diagram_url: cleanedDiagram,
      running_text: cleanedRunning,
      compatible_attachments: cleanedCompat,
      specs: cleanedSpecs,
      rating: cleanedRating,
      reviews: cleanedReviews,
      blocked_ranges: cleanedBlocks,
      for_sale: (raw as { for_sale?: unknown }).for_sale === true,
      sale_price_pence: pencesOrNull((raw as { sale_price_pence?: unknown }).sale_price_pence),
      sale_condition: (() => {
        const v = (raw as { sale_condition?: unknown }).sale_condition;
        return ["new", "used", "refurbished", "ex_demo"].includes(v as string)
          ? (v as "new" | "used" | "refurbished" | "ex_demo")
          : "";
      })(),
      sale_year: pencesOrNull((raw as { sale_year?: unknown }).sale_year),
      sale_hours_used: pencesOrNull((raw as { sale_hours_used?: unknown }).sale_hours_used),
      sale_note: s((raw as { sale_note?: unknown }).sale_note, 300),
      sale_stock_count: pencesOrNull((raw as { sale_stock_count?: unknown }).sale_stock_count),
      wet_price_day_pence: pencesOrNull((raw as { wet_price_day_pence?: unknown }).wet_price_day_pence),
      sub_hire_available: (raw as { sub_hire_available?: unknown }).sub_hire_available === true
    };
  }
  const config: PlantHireConfig = {
    ...base,
    categories: cleanedCategories,
    turnaround_text: s(base.turnaround_text, 40),
    yard_address: s(base.yard_address, 400),
    yard_open_from: s(base.yard_open_from, 10),
    yard_open_to: s(base.yard_open_to, 10),
    banner_image_url: s(base.banner_image_url, 800),
    illustration_image_url: s(base.illustration_image_url, 800),
    custom_note: s(base.custom_note, 800),
    trust_benefits: base.trust_benefits
      .map((b) => ({ label: s(b.label, 60), url: s(b.url, 800) }))
      .filter((b) => b.label.length > 0)
      .slice(0, 16),
    plant_brands: base.plant_brands
      .map((b) => ({
        name: s(b.name, 40),
        logo_url: b.logo_url ? s(b.logo_url, 800) : null
      }))
      .filter((b) => b.name.length > 0)
      .slice(0, 20),
    waiver_options: base.waiver_options
      .map((w) => ({
        slug: s(w.slug, 40),
        label: s(w.label, 80),
        price_day_pence: w.price_day_pence,
        excess_pence: w.excess_pence,
        note: s(w.note, 300)
      }))
      .filter((w) => w.slug.length > 0 && w.label.length > 0)
      .slice(0, 6),
    delivery_zones: base.delivery_zones
      .map((z) => ({
        label: s(z.label, 80),
        free_radius_miles: z.free_radius_miles,
        price_per_mile_pence: z.price_per_mile_pence,
        fixed_price_pence: z.fixed_price_pence,
        note: s(z.note, 200)
      }))
      .filter((z) => z.label.length > 0)
      .slice(0, 8),
    bulk_tiers: base.bulk_tiers
      .filter((t) => t.min_period_days > 0 && t.label.length > 0)
      .slice(0, 10),
    trade_customers: base.trade_customers
      .map((x) => s(x, 60))
      .filter((x) => x.length > 0)
      .slice(0, 30),
    faq: base.faq
      .filter((f) => f.q.trim().length > 0 && f.a.trim().length > 0)
      .slice(0, 20),
    promo_banner: {
      enabled: base.promo_banner.enabled === true,
      text: s(base.promo_banner.text, 200),
      cta_label: s(base.promo_banner.cta_label, 40),
      cta_href: s(base.promo_banner.cta_href, 400)
    },
    headline_text: s(base.headline_text, 120),
    section_headings: {
      trust_benefits: s(base.section_headings.trust_benefits, 80),
      brands: s(base.section_headings.brands, 80),
      what_we_hire: s(base.section_headings.what_we_hire, 80),
      how_to_hire: s(base.section_headings.how_to_hire, 80),
      delivery: s(base.section_headings.delivery, 80),
      waivers: s(base.section_headings.waivers, 80),
      bulk: s(base.section_headings.bulk, 80),
      trade_customers: s(base.section_headings.trade_customers, 80),
      related_products: s(base.section_headings.related_products, 80),
      faq: s(base.section_headings.faq, 80)
    },
    explanatory_paragraphs: base.explanatory_paragraphs
      .map((p) => s(p, 800))
      .filter((p) => p.length > 0)
      .slice(0, 6),
    mode_bodies: {
      collect: s(base.mode_bodies.collect, 400),
      delivery: s(base.mode_bodies.delivery, 400),
      operator: s(base.mode_bodies.operator, 400),
      long_term: s(base.mode_bodies.long_term, 400)
    },
    related_product_categories: base.related_product_categories
      .map((c) => s(c, 60))
      .filter((c) => c.length > 0)
      .slice(0, 20),
    sections_enabled: sanitizeSections((body.config as { sections_enabled?: unknown }).sections_enabled),
    depot_postcode: s(base.depot_postcode, 12).toUpperCase(),
    breakdown_service: {
      ...base.breakdown_service,
      terms_of_service: s(base.breakdown_service.terms_of_service, 2000)
    },
    haulage_service: {
      ...base.haulage_service,
      operators_licence_number: s(base.haulage_service.operators_licence_number, 40),
      terms_of_service: s(base.haulage_service.terms_of_service, 2500),
      trailer_bands: base.haulage_service.trailer_bands
        .map((b) => ({
          ...b,
          label: s(b.label, 60),
          image_url: s(b.image_url, 800)
        }))
        .slice(0, 8)
    },
    video_center: {
      ...base.video_center,
      heading: s(base.video_center.heading, 80),
      subheading: s(base.video_center.subheading, 160),
      videos: base.video_center.videos
        .map((v) => ({
          ...v,
          youtube_url: s(v.youtube_url, 800),
          title: s(v.title, 120),
          description: s(v.description, 300),
          location: s(v.location, 80),
          linked_machine_slug: s(v.linked_machine_slug, 40),
          thumbnail_url: s(v.thumbnail_url, 800),
          duration_label: s(v.duration_label, 12),
          date_uploaded: s(v.date_uploaded, 10)
        }))
        .filter((v) => v.youtube_url.length > 0)
        .slice(0, 30)
    },
    trade_accounts: {
      ...base.trade_accounts,
      heading: s(base.trade_accounts.heading, 80),
      subheading: s(base.trade_accounts.subheading, 200),
      pdf_url: s(base.trade_accounts.pdf_url, 800),
      terms_of_service: s(base.trade_accounts.terms_of_service, 2500),
      benefits: base.trade_accounts.benefits
        .map((b) => s(b, 80))
        .filter((b) => b.length > 0)
        .slice(0, 10)
    },
    driver_recruitment: {
      ...base.driver_recruitment,
      heading: s(base.driver_recruitment.heading, 80),
      subheading: s(base.driver_recruitment.subheading, 300),
      pdf_url: s(base.driver_recruitment.pdf_url, 800),
      base_location: s(base.driver_recruitment.base_location, 80),
      salary_range_display: s(base.driver_recruitment.salary_range_display, 60),
      terms_of_service: s(base.driver_recruitment.terms_of_service, 2500),
      benefits: base.driver_recruitment.benefits
        .map((b) => s(b, 80))
        .filter((b) => b.length > 0)
        .slice(0, 12)
    },
    team: {
      ...base.team,
      heading: s(base.team.heading, 80),
      subheading: s(base.team.subheading, 200),
      members: base.team.members
        .map((m) => ({
          ...m,
          name: s(m.name, 60),
          role: s(m.role, 60),
          photo_url: s(m.photo_url, 800),
          phone: s(m.phone, 30),
          extension: s(m.extension, 10),
          whatsapp: s(m.whatsapp, 30),
          email: s(m.email, 120),
          hours: s(m.hours, 60),
          specialities: m.specialities
            .map((sp) => s(sp, 40))
            .filter((sp) => sp.length > 0)
            .slice(0, 6)
        }))
        .filter((m) => m.name.length > 0)
        .slice(0, 12)
    },
    parts_counter: {
      ...base.parts_counter,
      heading: s(base.parts_counter.heading, 80),
      subheading: s(base.parts_counter.subheading, 200),
      phone: s(base.parts_counter.phone, 30),
      whatsapp: s(base.parts_counter.whatsapp, 30),
      email: s(base.parts_counter.email, 120),
      hours_summary: s(base.parts_counter.hours_summary, 120),
      same_day_cutoff: s(base.parts_counter.same_day_cutoff, 120),
      manual_library_url: s(base.parts_counter.manual_library_url, 800),
      address: s(base.parts_counter.address, 200),
      terms_of_service: s(base.parts_counter.terms_of_service, 2500),
      hero_image_url: s(base.parts_counter.hero_image_url, 800),
      categories: base.parts_counter.categories
        .map((c) => ({
          ...c,
          name: s(c.name, 60),
          description: s(c.description, 200),
          manual_url: s(c.manual_url, 800),
          lead_time: s(c.lead_time, 40),
          slug: c.slug ? s(c.slug, 40) : "",
          icon_url: c.icon_url ? s(c.icon_url, 800) : ""
        }))
        .filter((c) => c.name.length > 0)
        .slice(0, 30),
      items: base.parts_counter.items
        .map((it) => ({
          ...it,
          sku: s(it.sku, 40),
          name: s(it.name, 120),
          brand: s(it.brand, 40),
          fits: s(it.fits, 300),
          category_slug: s(it.category_slug, 40),
          image_url: s(it.image_url, 800),
          lead_time: s(it.lead_time, 40),
          short_desc: s(it.short_desc, 300),
          manual_url: s(it.manual_url, 800)
        }))
        .filter((it) => it.name.length > 0)
        .slice(0, 500)
    },
    compliance_info: {
      ...base.compliance_info,
      heading: s(base.compliance_info.heading, 80),
      subheading: s(base.compliance_info.subheading, 400),
      wide_load_note: s(base.compliance_info.wide_load_note, 1200),
      nationwide_note: s(base.compliance_info.nationwide_note, 800),
      route_survey_note: s(base.compliance_info.route_survey_note, 400),
      emergency_line_note: s(base.compliance_info.emergency_line_note, 300),
      extra_regs: base.compliance_info.extra_regs
        .map((x) => s(x, 100))
        .filter((x) => x.length > 0)
        .slice(0, 12)
    },
    trust_signals: base.trust_signals,
    cdm_pack: base.cdm_pack,
    machine_finder: base.machine_finder,
    site_calculator: base.site_calculator,
    repeat_ladder: base.repeat_ladder,
    notify_when_free: base.notify_when_free,
    bulk_quote: base.bulk_quote,
    closure_calendar: base.closure_calendar,
    sub_hire: base.sub_hire,
    payment_gateways: base.payment_gateways,
    layout_config: base.layout_config
  };

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ plant_hire: config })
    .eq("id", row.data.id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, config });
}
