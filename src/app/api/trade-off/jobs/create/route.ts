// POST /api/trade-off/jobs/create
// Public endpoint — a customer posts a project to the Xrated Trades jobs feed.
// All new posts land as status='pending' and an admin flips them to 'live'
// via the moderation queue. Tradies WhatsApp the customer directly via the
// contact button on the job detail page.
//
// Slug is built from trade_slug + city via buildJobSlug(). On a unique-
// constraint collision we retry with a short random suffix up to 5 times.
//
// Photos must already be uploaded via /api/trade-off/jobs/upload-photo;
// we only accept Supabase Storage URLs from our project so a malicious
// poster can't drop arbitrary off-site images into the feed.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { whatsappDigits } from "@/lib/tradeOff";
import {
  XRATED_JOBS_MAX_DESCRIPTION,
  XRATED_JOBS_MAX_PHOTOS,
  XRATED_JOBS_MIN_DESCRIPTION,
  buildJobSlug,
  isJobTradeKnown
} from "@/lib/xratedJobs";

export const runtime = "nodejs";

const ALLOWED_PHOTO_PREFIX = "https://msdonkkechxzgagyguoe.supabase.co/";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function arrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => (x as string).trim())
    .filter((x) => x.length > 0);
}

function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const customer_name = s(body.customer_name);
  const customer_whatsapp_raw = s(body.customer_whatsapp);
  const trade_slug = s(body.trade_slug);
  const city = s(body.city);
  const postcode_prefix_raw = s(body.postcode_prefix);
  const description = s(body.description);
  const budget_hint_raw = s(body.budget_hint);
  const photos = arrStr(body.photos);

  if (customer_name.length < 2 || customer_name.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Name must be between 2 and 80 characters." },
      { status: 400 }
    );
  }

  const whatsappDigitsOnly = whatsappDigits(customer_whatsapp_raw);
  if (whatsappDigitsOnly.length < 8) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp number must contain at least 8 digits." },
      { status: 400 }
    );
  }

  if (!trade_slug || !isJobTradeKnown(trade_slug)) {
    return NextResponse.json(
      { ok: false, error: "Unknown trade." },
      { status: 400 }
    );
  }

  if (city.length < 2 || city.length > 60) {
    return NextResponse.json(
      { ok: false, error: "City must be between 2 and 60 characters." },
      { status: 400 }
    );
  }

  if (description.length < XRATED_JOBS_MIN_DESCRIPTION) {
    return NextResponse.json(
      {
        ok: false,
        error: `Description must be at least ${XRATED_JOBS_MIN_DESCRIPTION} characters.`
      },
      { status: 400 }
    );
  }
  if (description.length > XRATED_JOBS_MAX_DESCRIPTION) {
    return NextResponse.json(
      {
        ok: false,
        error: `Description must be at most ${XRATED_JOBS_MAX_DESCRIPTION} characters.`
      },
      { status: 400 }
    );
  }

  if (photos.length > XRATED_JOBS_MAX_PHOTOS) {
    return NextResponse.json(
      { ok: false, error: `At most ${XRATED_JOBS_MAX_PHOTOS} photos are allowed.` },
      { status: 400 }
    );
  }
  for (const url of photos) {
    if (!url.startsWith(ALLOWED_PHOTO_PREFIX)) {
      return NextResponse.json(
        { ok: false, error: "Photos must be uploaded via the upload endpoint." },
        { status: 400 }
      );
    }
  }

  if (budget_hint_raw.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Budget hint must be at most 80 characters." },
      { status: 400 }
    );
  }
  const budget_hint = budget_hint_raw || null;

  const postcode_prefix = postcode_prefix_raw
    ? postcode_prefix_raw.toUpperCase().slice(0, 10)
    : null;
  if (postcode_prefix && postcode_prefix.length > 10) {
    return NextResponse.json(
      { ok: false, error: "Postcode prefix must be at most 10 characters." },
      { status: 400 }
    );
  }

  const baseRow = {
    customer_name,
    customer_whatsapp: whatsappDigitsOnly,
    trade_slug,
    city,
    postcode_prefix,
    description,
    budget_hint,
    photos,
    status: "pending" as const,
    is_example: false
  };

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = buildJobSlug(
      trade_slug,
      city,
      attempt === 0 ? undefined : shortSuffix()
    );
    const insert = await supabaseAdmin
      .from("hammerex_xrated_jobs")
      .insert({ ...baseRow, slug })
      .select("id, slug, status")
      .maybeSingle();

    if (insert.data) {
      return NextResponse.json({
        ok: true,
        slug: insert.data.slug,
        status: insert.data.status
      });
    }
    if (insert.error?.code === "23505") {
      lastError = "slug-collision";
      continue;
    }
    console.error("[trade-off/jobs/create] insert failed:", insert.error);
    return NextResponse.json(
      { ok: false, error: insert.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: false, error: `Could not create job (${lastError ?? "unknown"}).` },
    { status: 500 }
  );
}
