// POST /api/trade-off/update
// Magic-link edit endpoint. Body: { slug, edit_token, fields }.
// Verifies the edit_token via constant-time compare against the row's
// stored value, then updates the safe subset of fields. Re-computes
// status (draft <-> live) from completeness and re-runs the Hammerex
// Standard auto-match.
//
// Locked: id, slug, edit_token, created_at, joined_at, report_count,
// hammerex_standard_* (only the API touches Standard fields).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_OFF_REQUIRED_FIELDS,
  TRADE_OFF_TRADES,
  isReservedSlug
} from "@/lib/tradeOff";
import { recomputeHammerexStandard } from "@/lib/tradeOffStandard";
import { geocodeListing } from "@/lib/tradeOffGeocode";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

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

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const UPDATABLE_STRING_FIELDS = [
  "display_name",
  "trading_name",
  "primary_trade",
  "city",
  "country",
  "postcode_prefix",
  "whatsapp",
  "phone",
  "email",
  "website",
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "bio",
  "avatar_url",
  // Xrated App visual customisation — only meaningful when the listing's
  // effectiveTier is app_trial / app_paid. The render layer enforces gating;
  // we accept the writes regardless so an upgrade re-activates them.
  "theme_color",
  "button_text_color",
  "cta_button_effect",
  "hero_text_line1",
  "hero_text_line2",
  "hero_text_line2_color",
  "hero_text_tagline",
  "hero_text_effect",
  "avatar_frame_style",
  "profile_placement",
  "running_marquee",
  "promo_text",
  // "Trades On Standby" advertised availability. Editor enforces the
  // allowed values; we accept any non-empty string and let the editor
  // own validation (so adding a new option doesn't need an API change).
  "availability",
  // Trust & logistics — free-text fields. The numeric / boolean / array
  // counterparts live in their respective field lists below.
  "quote_availability",
  "current_status_note"
] as const;

// String fields with their own maximum-length cap (max 500 chars).
const STRING_FIELD_MAX_LENGTH: Partial<Record<(typeof UPDATABLE_STRING_FIELDS)[number], number>> = {
  quote_availability: 500,
  current_status_note: 500
};

const UPDATABLE_ARRAY_FIELDS = [
  "secondary_trades",
  "service_postcodes",
  "photos",
  "services_offered",
  // Trust & logistics — curated multi-select chips, sanitised below.
  "qualifications",
  "trade_memberships"
] as const;

const UPDATABLE_INT_FIELDS = ["years_in_trade", "start_year"] as const;

// Trust & logistics — positive-integer fields, capped at 100,000,000.
const UPDATABLE_NUMBER_FIELDS = [
  "insurance_cover_gbp",
  "minimum_job_gbp",
  "quote_turnaround_hours"
] as const;
const NUMBER_FIELD_MAX = 100_000_000;

// Booleans accepted through the customisation panel.
const UPDATABLE_BOOL_FIELDS = [
  "accepting_jobs",
  "contact_form_enabled",
  "visit_us_enabled",
  // Trust & logistics flags.
  "is_insured",
  "has_own_transport",
  "has_own_tools",
  "dbs_checked",
  "free_site_visits"
] as const;

// ISO-date fields (YYYY-MM-DD). Null clears the column.
const UPDATABLE_DATE_FIELDS = ["ready_date"] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Premium mini-app JSON fields. Shape:
//  - operating_hours: Record<dayKey, { open, close } | null>
//  - faq_items: { q, a }[]
//  - priced_services: { name, image_url, price, unit }[]
// We sanitise each before persisting.
const UPDATABLE_JSON_FIELDS = [
  "operating_hours",
  "faq_items",
  "priced_services",
  "headline_rate",
  "recommendations"
] as const;

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const TIME_RE = /^[0-2]\d:[0-5]\d$/;

// Trusted Trades — array of { slug, note? }. We strip empty slugs,
// trim notes to 200 chars, dedupe by slug (so a tradie can't list the
// same friend twice), and cap the array at 12 entries.
function sanitiseRecommendations(v: unknown): { slug: string; note?: string }[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: { slug: string; note?: string }[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const slug = String((raw as { slug?: unknown }).slug ?? "").trim().toLowerCase();
    if (slug.length < 5 || slug.length > 60) continue;
    if (!/^[a-z0-9-]+$/.test(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const note = String((raw as { note?: unknown }).note ?? "").trim().slice(0, 200);
    out.push(note ? { slug, note } : { slug });
    if (out.length >= 12) break;
  }
  return out;
}

function sanitiseOperatingHours(v: unknown): Record<string, { open: string; close: string } | null> {
  const out: Record<string, { open: string; close: string } | null> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const day of DAY_KEYS) {
    const slot = (v as Record<string, unknown>)[day];
    if (!slot || typeof slot !== "object") continue;
    const open = typeof (slot as Record<string, unknown>).open === "string"
      ? ((slot as Record<string, unknown>).open as string).trim()
      : "";
    const close = typeof (slot as Record<string, unknown>).close === "string"
      ? ((slot as Record<string, unknown>).close as string).trim()
      : "";
    if (TIME_RE.test(open) && TIME_RE.test(close)) {
      out[day] = { open, close };
    }
  }
  return out;
}

function sanitisePricedServices(
  v: unknown
): { name: string; image_url: string | null; price: number; unit: string; description: string | null }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; image_url: string | null; price: number; unit: string; description: string | null }[] = [];
  for (const item of v.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim().slice(0, 80) : "";
    const image_url_raw = typeof rec.image_url === "string" ? rec.image_url.trim() : "";
    const image_url = image_url_raw.length > 0 ? image_url_raw.slice(0, 400) : null;
    const priceN = Number(rec.price);
    const price = Number.isFinite(priceN) && priceN > 0 ? Math.round(priceN) : 0;
    const unit = typeof rec.unit === "string"
      ? rec.unit.trim().slice(0, 32) || "per project"
      : "per project";
    const description_raw = typeof rec.description === "string" ? rec.description.trim() : "";
    const description = description_raw.length > 0 ? description_raw.slice(0, 500) : null;
    if (name && price > 0) out.push({ name, image_url, price, unit, description });
  }
  return out;
}

// headline_rate is the single starting price shown on the "Trades On
// Standby" card. Returns null when the payload is malformed or empty
// so the card simply omits the price column.
function sanitiseHeadlineRate(
  v: unknown
): { amount: number; unit: string; currency: string } | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const rec = v as Record<string, unknown>;
  const amountN = Number(rec.amount);
  if (!Number.isFinite(amountN) || amountN <= 0) return null;
  const amount = Math.round(amountN);
  const unitRaw = typeof rec.unit === "string" ? rec.unit.trim() : "";
  if (unitRaw.length === 0 || unitRaw.length > 30) return null;
  const currencyRaw = typeof rec.currency === "string" ? rec.currency.trim().toUpperCase() : "";
  if (currencyRaw.length !== 3) return null;
  return { amount, unit: unitRaw.slice(0, 30), currency: currencyRaw };
}

function sanitiseFaqItems(v: unknown): { q: string; a: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { q: string; a: string }[] = [];
  for (const item of v.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const q = typeof (item as Record<string, unknown>).q === "string"
      ? ((item as Record<string, unknown>).q as string).trim().slice(0, 200)
      : "";
    const a = typeof (item as Record<string, unknown>).a === "string"
      ? ((item as Record<string, unknown>).a as string).trim().slice(0, 1000)
      : "";
    if (q && a) out.push({ q, a });
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const fieldsIn = (body.fields && typeof body.fields === "object" ? body.fields : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json({ ok: false, error: "Missing slug or edit_token." }, { status: 400 });
  }

  const existing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!existing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(existing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};

  for (const f of UPDATABLE_STRING_FIELDS) {
    if (f in fieldsIn) {
      let v = s(fieldsIn[f]);
      const cap = STRING_FIELD_MAX_LENGTH[f];
      if (typeof cap === "number" && v.length > cap) v = v.slice(0, cap);
      patch[f] = v.length === 0 ? null : v;
    }
  }
  for (const f of UPDATABLE_ARRAY_FIELDS) {
    if (f in fieldsIn) {
      const arr = arrStr(fieldsIn[f]);
      if (f === "secondary_trades") patch[f] = arr.slice(0, 3);
      else if (f === "photos") patch[f] = arr.slice(0, 6);
      else if (f === "qualifications" || f === "trade_memberships") {
        // Curated chips — at most 20 entries, each 1–80 chars.
        patch[f] = arr
          .map((x) => x.slice(0, 80))
          .filter((x) => x.length > 0)
          .slice(0, 20);
      } else patch[f] = arr.slice(0, 40);
    }
  }
  for (const f of UPDATABLE_INT_FIELDS) {
    if (f in fieldsIn) patch[f] = intOrNull(fieldsIn[f]);
  }
  for (const f of UPDATABLE_NUMBER_FIELDS) {
    if (f in fieldsIn) {
      const n = intOrNull(fieldsIn[f]);
      if (n === null || n <= 0) patch[f] = null;
      else if (n > NUMBER_FIELD_MAX) patch[f] = NUMBER_FIELD_MAX;
      else patch[f] = n;
    }
  }
  for (const f of UPDATABLE_BOOL_FIELDS) {
    if (f in fieldsIn) {
      const v = fieldsIn[f];
      patch[f] = v === true || v === "true" || v === 1 || v === "1";
    }
  }
  for (const f of UPDATABLE_DATE_FIELDS) {
    if (f in fieldsIn) {
      const v = s(fieldsIn[f]);
      patch[f] = v.length > 0 && ISO_DATE_RE.test(v) ? v : null;
    }
  }
  for (const f of UPDATABLE_JSON_FIELDS) {
    if (f in fieldsIn) {
      if (f === "operating_hours") {
        patch[f] = sanitiseOperatingHours(fieldsIn[f]);
      } else if (f === "faq_items") {
        patch[f] = sanitiseFaqItems(fieldsIn[f]);
      } else if (f === "priced_services") {
        patch[f] = sanitisePricedServices(fieldsIn[f]);
      } else if (f === "headline_rate") {
        patch[f] = sanitiseHeadlineRate(fieldsIn[f]);
      } else if (f === "recommendations") {
        patch[f] = sanitiseRecommendations(fieldsIn[f]);
      }
    }
  }

  // Required-field NOT NULLs cannot be set to null — refuse instead.
  for (const reqField of ["display_name", "city", "whatsapp", "email"] as const) {
    if (reqField in patch && (patch[reqField] === null || patch[reqField] === "")) {
      return NextResponse.json(
        { ok: false, error: `${reqField} cannot be empty.` },
        { status: 400 }
      );
    }
  }

  if ("primary_trade" in patch && typeof patch.primary_trade === "string") {
    if (!TRADE_OFF_TRADES.some((t) => t.slug === patch.primary_trade)) {
      return NextResponse.json({ ok: false, error: "Unknown primary trade." }, { status: 400 });
    }
  }

  // Optional slug change. If the tradie picked a new vanity slug, validate
  // and apply it. v1 deliberately skips redirect rows — the edit form warns
  // the tradie that changing their URL breaks existing links.
  const requestedSlug = s(fieldsIn.slug).toLowerCase();
  let nextSlug: string | null = null;
  if (requestedSlug && requestedSlug !== existing.data.slug) {
    if (isReservedSlug(requestedSlug)) {
      return NextResponse.json(
        { ok: false, error: "That URL is reserved or invalid." },
        { status: 400 }
      );
    }
    const dupe = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id")
      .eq("slug", requestedSlug)
      .maybeSingle();
    if (dupe.data && dupe.data.id !== existing.data.id) {
      return NextResponse.json(
        { ok: false, error: "That URL is already taken." },
        { status: 409 }
      );
    }
    patch.slug = requestedSlug;
    nextSlug = requestedSlug;
  }

  // Best-effort geocode whenever the location fields are touched (or are
  // already present but lat/lng are missing). Failure leaves coords as-is.
  if ("city" in patch || "postcode_prefix" in patch || "country" in patch) {
    try {
      const refRow = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("city, postcode_prefix, country")
        .eq("id", existing.data.id)
        .maybeSingle();
      const merged = {
        city:
          typeof patch.city === "string"
            ? patch.city
            : (refRow.data?.city ?? ""),
        postcode_prefix:
          "postcode_prefix" in patch
            ? (patch.postcode_prefix as string | null)
            : (refRow.data?.postcode_prefix ?? null),
        country:
          typeof patch.country === "string"
            ? patch.country
            : (refRow.data?.country ?? "United Kingdom")
      };
      const coords = await geocodeListing(merged);
      if (coords) {
        patch.lat = coords.lat;
        patch.lng = coords.lng;
      }
    } catch (err) {
      console.warn("[trade-off/update] geocoding failed:", err);
    }
  }

  // Apply patch
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, status: existing.data.status });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", existing.data.id)
    .select("*")
    .maybeSingle();
  if (upd.error || !upd.data) {
    console.error("[trade-off/update] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  // Re-evaluate status from completeness (do not flip 'hidden' back to 'live'
  // — moderation hides are sticky).
  const row = upd.data as Record<string, unknown>;
  let nextStatus: string = existing.data.status;
  if (existing.data.status !== "hidden") {
    let complete = true;
    for (const field of TRADE_OFF_REQUIRED_FIELDS) {
      const v = row[field];
      if (typeof v !== "string" || v.trim().length === 0 || v === "(draft)") {
        complete = false;
        break;
      }
    }
    const photos = Array.isArray(row.photos) ? (row.photos as unknown[]) : [];
    if (photos.length < 1) complete = false;
    nextStatus = complete ? "live" : "draft";
    if (nextStatus !== existing.data.status) {
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({ status: nextStatus })
        .eq("id", existing.data.id);
    }
  }

  try {
    await recomputeHammerexStandard(existing.data.id);
  } catch (err) {
    console.error("[trade-off/update] recomputeHammerexStandard failed:", err);
  }

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    slug: nextSlug ?? existing.data.slug
  });
}
