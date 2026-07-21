// GET  /api/scheduled-posts   — list the caller's scheduled posts
// POST /api/scheduled-posts   — schedule a new one
//
// All writes gated by:
//   • max 20 pending slots per merchant
//   • max 3 pending posts landing on YARD in any rolling 24h
//   • scheduled_for must be > NOW() + 2min and < NOW() + 90 days
//   • content_hash may not match either of the last 2 posts by
//     the same merchant (spam prevention)

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PENDING_PER_MERCHANT = 20;
const MAX_YARD_PER_24H         = 3;
const MIN_SCHEDULE_OFFSET_MS   = 2 * 60 * 1000;             // 2 minutes
const MAX_SCHEDULE_OFFSET_MS   = 90 * 24 * 60 * 60 * 1000;  // 90 days

const YARD_ELIGIBLE_KINDS = new Set(["counter", "showcase"]);
const ALL_KINDS           = new Set(["chat", "question", "showcase", "make-offer", "announcement", "counter"]);

function hashContent(body: string, photoUrls: string[]): string {
  return createHash("sha256")
    .update(body.trim())
    .update("\n")
    .update((photoUrls ?? []).sort().join("|"))
    .digest("hex")
    .slice(0, 32);
}

async function findMerchantCanteen(slug: string): Promise<{ canteen_id: string | null }> {
  const { data } = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id")
    .eq("owner_slug", slug)
    .maybeSingle();
  return { canteen_id: (data as { id?: string } | null)?.id ?? null };
}

// ─── GET ────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const statusFilter = req.nextUrl.searchParams.get("status") ?? "pending";
  const limit        = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "50")));

  let q = supabaseAdmin
    .from("hammerex_scheduled_posts")
    .select("id, scheduled_for, kind, body, photo_urls, mood_slug, price_gbp, target_trade_slugs, target_canteen, target_yard, status, posted_at, posted_post_id, failure_reason, created_at")
    .eq("merchant_slug", merchantSlug)
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (statusFilter !== "all") q = q.eq("status", statusFilter);
  const res = await q;
  if (res.error) {
    return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, posts: res.data ?? [] });
}

// ─── POST ───────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    scheduled_for?:       string;
    kind?:                string;
    body?:                string;
    photo_urls?:          string[];
    image_ids?:           string[];    // hammerex_feed_tile_library slugs;
                                        // server resolves to photo_urls
    mood_slug?:           string;
    price_gbp?:           number;
    target_trade_slugs?:  string[];
    target_yard?:         boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // If the caller passed `image_ids` (feed_tile_library slugs), resolve
  // them to URLs so we store the same shape as manual canteen posts.
  if (Array.isArray(body.image_ids) && body.image_ids.length > 0 && (!body.photo_urls || body.photo_urls.length === 0)) {
    const ids = body.image_ids.slice(0, 10);
    const res = await supabaseAdmin
      .from("hammerex_feed_tile_library")
      .select("slug, url")
      .in("slug", ids);
    const bySlug = new Map((res.data ?? []).map((r) => [r.slug as string, r.url as string]));
    body.photo_urls = ids.map((id) => bySlug.get(id)).filter((u): u is string => !!u);
    if (body.photo_urls.length === 0) {
      return NextResponse.json({ ok: false, error: "no_resolvable_images" }, { status: 400 });
    }
  }

  // Validate timing.
  const when = body.scheduled_for ? new Date(body.scheduled_for) : null;
  if (!when || isNaN(when.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid_time" }, { status: 400 });
  }
  const offset = when.getTime() - Date.now();
  if (offset < MIN_SCHEDULE_OFFSET_MS) {
    return NextResponse.json({ ok: false, error: "too_soon", detail: "Schedule at least 2 minutes ahead." }, { status: 400 });
  }
  if (offset > MAX_SCHEDULE_OFFSET_MS) {
    return NextResponse.json({ ok: false, error: "too_far", detail: "Max 90 days ahead." }, { status: 400 });
  }

  // Validate kind + yard eligibility.
  const kind = String(body.kind ?? "showcase");
  if (!ALL_KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }
  const targetYard = !!body.target_yard;
  if (targetYard && !YARD_ELIGIBLE_KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "kind_not_yard_eligible", detail: "Only 'showcase' and 'counter' kinds surface on the Yard." }, { status: 400 });
  }

  const postBody   = String(body.body ?? "").slice(0, 5000);
  const photoUrls  = (Array.isArray(body.photo_urls) ? body.photo_urls : []).slice(0, 10);
  const contentHash = hashContent(postBody, photoUrls);

  // ─── Quota + spam gates ─────────────────────────────────────

  // 20-slot pending cap per merchant.
  const pendingCount = await supabaseAdmin
    .from("hammerex_scheduled_posts")
    .select("id", { count: "exact", head: true })
    .eq("merchant_slug", merchantSlug)
    .eq("status", "pending");
  if ((pendingCount.count ?? 0) >= MAX_PENDING_PER_MERCHANT) {
    return NextResponse.json({
      ok: false, error: "slot_cap",
      detail: `Max ${MAX_PENDING_PER_MERCHANT} scheduled posts at a time. Delete a pending post to schedule another.`
    }, { status: 429 });
  }

  // Rolling 24h yard cap.
  if (targetYard) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const yardCount = await supabaseAdmin
      .from("hammerex_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("merchant_slug", merchantSlug)
      .eq("target_yard", true)
      .in("status", ["pending", "posted"])
      .gte("created_at", since);
    if ((yardCount.count ?? 0) >= MAX_YARD_PER_24H) {
      return NextResponse.json({
        ok: false, error: "yard_cap",
        detail: `Max ${MAX_YARD_PER_24H} yard posts per 24h. Yours will still post to your canteen.`
      }, { status: 429 });
    }
  }

  // Spam gate — reject if same content as either of the last 2.
  const recent = await supabaseAdmin
    .from("hammerex_scheduled_posts")
    .select("content_hash")
    .eq("merchant_slug", merchantSlug)
    .order("created_at", { ascending: false })
    .limit(2);
  if (recent.data?.some((r) => r.content_hash === contentHash)) {
    return NextResponse.json({
      ok: false, error: "duplicate_content",
      detail: "Same post as one of your last two. Change the body or photos."
    }, { status: 409 });
  }

  const { canteen_id } = await findMerchantCanteen(merchantSlug);

  const insert = await supabaseAdmin
    .from("hammerex_scheduled_posts")
    .insert({
      merchant_slug:      merchantSlug,
      canteen_id,
      scheduled_for:      when.toISOString(),
      kind,
      body:               postBody,
      photo_urls:         photoUrls,
      mood_slug:          body.mood_slug ?? null,
      price_gbp:          body.price_gbp ?? null,
      target_trade_slugs: Array.isArray(body.target_trade_slugs) ? body.target_trade_slugs.slice(0, 20) : [],
      target_canteen:     true,
      target_yard:        targetYard,
      status:             "pending",
      content_hash:       contentHash
    })
    .select("id, scheduled_for")
    .single();

  if (insert.error) {
    console.error("[scheduled-posts POST] insert failed:", insert.error.message);
    return NextResponse.json({ ok: false, error: "insert_failed", detail: insert.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, post: insert.data });
}
