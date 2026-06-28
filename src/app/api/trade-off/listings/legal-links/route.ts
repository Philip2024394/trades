// POST /api/trade-off/listings/legal-links
// Magic-link authenticated. Body: { slug, edit_token, terms_url?,
// privacy_url?, returns_url?, about_url? }.
//
// Whitelists the four tradesperson-owned legal/company URLs surfaced on
// the lean tradie footer (TradeProfileFooter). Each input is trimmed and
// capped at 500 chars; empty strings are normalised to NULL so the
// footer can hide the row cleanly. URL format is validated with
// `new URL(...)` — anything that fails is rejected as a 400 so we never
// persist garbage that would break the footer link.
//
// Save is partial: only fields present in the body are touched. A field
// can be explicitly cleared by sending an empty string. Fields omitted
// from the body keep their existing DB value.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const FIELDS = ["terms_url", "privacy_url", "returns_url", "about_url"] as const;
type FieldKey = (typeof FIELDS)[number];

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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
  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  // Build the patch from whichever whitelisted fields the body included.
  // Empty string → null (explicit clear); valid URL → trimmed string.
  const patch: Partial<Record<FieldKey, string | null>> = {};
  for (const key of FIELDS) {
    if (!(key in body)) continue;
    const raw = s(body[key]);
    if (raw.length === 0) {
      patch[key] = null;
      continue;
    }
    if (raw.length > 500) {
      return NextResponse.json(
        { ok: false, error: `${key} is too long (max 500 chars).` },
        { status: 400 }
      );
    }
    if (!isValidHttpUrl(raw)) {
      return NextResponse.json(
        { ok: false, error: `${key} must be a valid http(s) URL.` },
        { status: 400 }
      );
    }
    patch[key] = raw;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No legal-link fields supplied." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", listing.data.id)
    .select("terms_url, privacy_url, returns_url, about_url")
    .maybeSingle();

  if (upd.error || !upd.data) {
    console.error("[trade-off/listings/legal-links] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, legal_links: upd.data });
}
