// POST /api/trade-off/shop-categories/save — replaces the merchant's
// full shop_categories JSONB array. Validated + sanitised. Slugs are
// normalised (lower_snake, no leading/trailing underscores, max 60).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type IncomingCategory = {
  slug: string;
  label: string;
  image_url: string | null;
  enabled: boolean;
};

type Body = {
  slug: string;
  token: string;
  categories: IncomingCategory[];
};

function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function sanitiseUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  return t.slice(0, 800);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug || !body.token || !Array.isArray(body.categories)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!listing.data) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  if (listing.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }

  const seen = new Set<string>();
  const normalised = body.categories
    .map((c, i) => {
      const label = (c.label ?? "").trim().slice(0, 60);
      let slug = slugify(c.slug || label);
      if (!label || !slug) return null;
      // Deduplicate slugs — collisions get "_2", "_3" appended.
      let uniq = slug;
      let n = 2;
      while (seen.has(uniq)) uniq = `${slug}_${n++}`;
      seen.add(uniq);
      return {
        slug: uniq,
        label,
        image_url: sanitiseUrl(c.image_url),
        enabled: c.enabled !== false,
        sort_order: i
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .slice(0, 50); // hard cap

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ shop_categories: normalised })
    .eq("id", listing.data.id);
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, categories: normalised });
}
