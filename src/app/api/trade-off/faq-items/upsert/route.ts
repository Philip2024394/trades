// POST /api/trade-off/faq-items/upsert
// Magic-link authenticated. Body: { slug, edit_token, faq: { id?, ref_code?, question, answer, category, status?, sort_order? } }.
// When id is present, UPDATE WHERE listing_id matches (cross-listing
// tamper guard). Otherwise INSERT. Ref code is auto-generated as the
// next FAQ-NNN slot when omitted; if the caller provides a ref_code and
// it collides, we fall back to FAQ-NNN-2 / -3 in the same shape the
// products upsert uses for slug collisions.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const REF_RE = /^FAQ-[0-9]{3,4}$/;
const MAX_LIVE_PER_LISTING = 50;

const CATEGORIES = new Set([
  "general",
  "pricing",
  "process",
  "materials",
  "trust",
  "warranty",
  "aftercare"
]);

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonNegInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/** Pad a number into a 3-digit FAQ code (FAQ-001 / FAQ-012 / FAQ-100). */
function refForIndex(n: number): string {
  const padded = String(n).padStart(3, "0");
  return `FAQ-${padded}`;
}

async function nextRefCode(listingId: string): Promise<string> {
  const res = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("ref_code")
    .eq("listing_id", listingId);
  if (res.error) {
    throw new Error(res.error.message);
  }
  const used = new Set<string>((res.data ?? []).map((r) => r.ref_code as string));
  // Walk from 1 upwards — first free 3-digit slot wins.
  for (let i = 1; i <= 9999; i++) {
    const candidate = refForIndex(i);
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Exhausted FAQ ref-code namespace.");
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
  const faqIn = (body.faq && typeof body.faq === "object"
    ? body.faq
    : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
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

  const question = s(faqIn.question);
  if (question.length < 5 || question.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Question must be 5-200 characters." },
      { status: 400 }
    );
  }
  const answer = s(faqIn.answer);
  if (answer.length < 5 || answer.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "Answer must be 5-2000 characters." },
      { status: 400 }
    );
  }

  const categoryRaw = s(faqIn.category).toLowerCase();
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "general";

  const statusRaw = s(faqIn.status);
  const status: "live" | "archived" =
    statusRaw === "archived" ? "archived" : "live";
  const sort_order = nonNegInt(faqIn.sort_order);

  const refIn = s(faqIn.ref_code).toUpperCase();
  // Refuse a free-text ref unless it matches the format the trigger
  // expects. The editor enforces this client-side; the API is the final
  // guard.
  if (refIn && !REF_RE.test(refIn)) {
    return NextResponse.json(
      {
        ok: false,
        error: "ref_code must look like FAQ-001 (3 or 4 digits, uppercase)."
      },
      { status: 400 }
    );
  }

  const idRaw = s(faqIn.id);
  if (idRaw) {
    // UPDATE path — preserve the existing ref_code by default. If the
    // caller explicitly supplied a different one, honour it (uniqueness
    // is enforced at the DB layer).
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid faq id." },
        { status: 400 }
      );
    }
    const patch: Record<string, unknown> = {
      question,
      answer,
      category,
      status,
      sort_order
    };
    if (refIn) patch.ref_code = refIn;

    const upd = await supabaseAdmin
      .from("hammerex_xrated_faq_items")
      .update(patch)
      .eq("id", idRaw)
      .eq("listing_id", listing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/faq-items/upsert] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    if (!upd.data) {
      return NextResponse.json(
        { ok: false, error: "FAQ not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, faq: upd.data });
  }

  // INSERT path — enforce the per-listing live cap server-side. The
  // trigger also enforces it; we surface a friendlier error here.
  if (status === "live") {
    const countRes = await supabaseAdmin
      .from("hammerex_xrated_faq_items")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.data.id)
      .eq("status", "live");
    if (countRes.error) {
      console.error("[trade-off/faq-items/upsert] count failed:", countRes.error);
      return NextResponse.json(
        { ok: false, error: countRes.error.message },
        { status: 500 }
      );
    }
    if ((countRes.count ?? 0) >= MAX_LIVE_PER_LISTING) {
      return NextResponse.json(
        {
          ok: false,
          error: `You already have ${MAX_LIVE_PER_LISTING} live FAQs. Archive one first.`
        },
        { status: 400 }
      );
    }
  }

  // Resolve the ref code — caller-supplied takes priority, fall back to
  // the next free FAQ-NNN. If the caller's ref collides with another row
  // we append "-2", "-3" … to match the products convention.
  let ref_code = refIn;
  if (!ref_code) {
    try {
      ref_code = await nextRefCode(listing.data.id);
    } catch (err) {
      console.error("[trade-off/faq-items/upsert] next ref failed:", err);
      return NextResponse.json(
        { ok: false, error: "Could not allocate ref code." },
        { status: 500 }
      );
    }
  }

  // Insert with collision recovery. The DB CHECK constraint only allows
  // FAQ-NNN[N] — no "-2" suffix variant is legal — so on a unique
  // violation we walk forward to the next free numeric slot instead.
  let attempt = 0;
  while (true) {
    attempt += 1;
    const ins = await supabaseAdmin
      .from("hammerex_xrated_faq_items")
      .insert({
        listing_id: listing.data.id,
        ref_code,
        question,
        answer,
        category,
        status,
        sort_order
      })
      .select("*")
      .maybeSingle();
    if (!ins.error && ins.data) {
      return NextResponse.json({ ok: true, faq: ins.data });
    }
    const isUnique =
      ins.error &&
      ((ins.error as { code?: string }).code === "23505" ||
        /duplicate key/i.test(ins.error.message || ""));
    if (!isUnique || attempt >= 5) {
      console.error("[trade-off/faq-items/upsert] insert failed:", ins.error);
      return NextResponse.json(
        { ok: false, error: ins.error?.message ?? "Insert failed" },
        { status: 500 }
      );
    }
    try {
      ref_code = await nextRefCode(listing.data.id);
    } catch (err) {
      console.error("[trade-off/faq-items/upsert] next ref retry failed:", err);
      return NextResponse.json(
        { ok: false, error: "Could not allocate ref code." },
        { status: 500 }
      );
    }
  }
}
