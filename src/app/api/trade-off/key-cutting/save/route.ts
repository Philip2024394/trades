// POST /api/trade-off/key-cutting/save — writes the full Key Cutting
// config blob to the listing's key_cutting JSONB column. Everything is
// sanitised on the server; blank strings become "".

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  KEY_CATEGORIES,
  normaliseKeyCuttingConfig,
  type KeyCategorySlug,
  type KeyCuttingConfig
} from "@/lib/keyCutting";

export const runtime = "nodejs";

type Body = {
  slug: string;
  token: string;
  config: Partial<KeyCuttingConfig> & {
    categories?: Partial<Record<KeyCategorySlug, { enabled: unknown; price_from_pence: unknown; note: unknown }>>;
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

  const base = normaliseKeyCuttingConfig(body.config);
  const cleanedCategories: KeyCuttingConfig["categories"] = {};
  for (const meta of KEY_CATEGORIES) {
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
    cleanedCategories[meta.slug] = {
      enabled: raw.enabled === true,
      price_from_pence: pencesOrNull(raw.price_from_pence),
      note: s(raw.note, 240),
      cart_enabled:
        (raw as { cart_enabled?: unknown }).cart_enabled === true
          ? true
          : (raw as { cart_enabled?: unknown }).cart_enabled === false
            ? false
            : meta.cart_default_on,
      sub_types: cleanedSubs,
      image_url: typeof rawImg === "string" ? s(rawImg, 800) : ""
    };
  }
  const config: KeyCuttingConfig = {
    ...base,
    categories: cleanedCategories,
    machine_brand: s(base.machine_brand, 60),
    turnaround_text: s(base.turnaround_text, 40),
    postal_address: s(base.postal_address, 400),
    banner_image_url: s(base.banner_image_url, 800),
    illustration_image_url: s(base.illustration_image_url, 800),
    custom_note: s(base.custom_note, 800),
    restricted_brands: base.restricted_brands
      .map((x) => s(x, 40))
      .filter((x) => x.length > 0)
      .slice(0, 8),
    trust_benefits: base.trust_benefits
      .map((x) => s(x, 60))
      .filter((x) => x.length > 0)
      .slice(0, 16),
    key_brands: base.key_brands
      .map((b) => ({
        name: s(b.name, 40),
        logo_url: b.logo_url ? s(b.logo_url, 800) : null
      }))
      .filter((b) => b.name.length > 0)
      .slice(0, 20),
    bulk_tiers: base.bulk_tiers
      .filter((t) => t.min_qty > 0 && t.label.length > 0)
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
      what_we_cut: s(base.section_headings.what_we_cut, 80),
      how_to_get: s(base.section_headings.how_to_get, 80),
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
      walk_in: s(base.mode_bodies.walk_in, 400),
      photo_scan: s(base.mode_bodies.photo_scan, 400),
      postal: s(base.mode_bodies.postal, 400)
    },
    related_product_categories: base.related_product_categories
      .map((c) => s(c, 60))
      .filter((c) => c.length > 0)
      .slice(0, 20)
  };

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ key_cutting: config })
    .eq("id", row.data.id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, config });
}
