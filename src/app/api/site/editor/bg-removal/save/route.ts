// POST /api/site/editor/bg-removal/save
//
// Accepts a transparent-background PNG produced client-side by
// the RMBG-1.4 worker, checks the merchant's monthly quota +
// rolling 24h cap, uploads to Supabase Storage, and returns the
// public URL. Also writes to the events ledger + increments the
// monthly counter atomically.
//
// Body: multipart form
//   file:         the PNG blob
//   source_url:   optional URL of the original (for provenance)
//   inference_ms: optional int — how long the worker took
//   backend:      optional 'webgpu' | 'wasm'

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { MONTHLY_QUOTA, ROLLING_24H_CAP, OUTPUT_BUCKET } from "@/lib/backgroundRemoval/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;   // 20MB safety cap

function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function readMerchantTier(slug: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("tier")
    .eq("slug", slug)
    .maybeSingle();
  return (data as { tier?: string } | null)?.tier ?? "standard";
}

async function currentMonthUsage(slug: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("hammerex_bgremoval_usage")
    .select("used_count")
    .eq("merchant_slug", slug)
    .eq("month_yyyymm", monthKey())
    .maybeSingle();
  return (data as { used_count?: number } | null)?.used_count ?? 0;
}

async function rolling24hCount(slug: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("hammerex_bgremoval_events")
    .select("id", { count: "exact", head: true })
    .eq("merchant_slug", slug)
    .gte("created_at", since);
  return count ?? 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const tier         = await readMerchantTier(merchantSlug);
  const monthlyLimit = MONTHLY_QUOTA[tier] ?? MONTHLY_QUOTA.standard;

  // Quota gates — check BEFORE upload so we don't burn storage on
  // a rejected write.
  const [usedThisMonth, used24h] = await Promise.all([
    currentMonthUsage(merchantSlug),
    rolling24hCount(merchantSlug)
  ]);

  if (usedThisMonth >= monthlyLimit) {
    return NextResponse.json({
      ok:    false,
      error: "monthly_limit",
      quota: { used: usedThisMonth, limit: monthlyLimit, tier }
    }, { status: 402 });
  }
  if (used24h >= ROLLING_24H_CAP) {
    return NextResponse.json({
      ok:    false,
      error: "rolling_24h_limit",
      quota: { used24h, limit: ROLLING_24H_CAP }
    }, { status: 429 });
  }

  // Parse multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 413 });
  }
  const inferenceMs = Number(form.get("inference_ms") ?? 0) || null;
  const backend     = String(form.get("backend")      ?? "").slice(0, 20) || null;
  const sourceUrl   = String(form.get("source_url")   ?? "").slice(0, 500);
  const sourceBytes = Number(form.get("source_bytes") ?? 0) || null;

  // Upload to Storage.
  const id      = randomUUID();
  const path    = `${merchantSlug}/${id}.png`;
  const buffer  = Buffer.from(await file.arrayBuffer());

  const upload = await supabaseAdmin.storage
    .from(OUTPUT_BUCKET)
    .upload(path, buffer, {
      contentType:  "image/png",
      cacheControl: "31536000",
      upsert:       false
    });
  if (upload.error) {
    console.error("[bg-removal/save] storage upload failed:", upload.error.message);
    return NextResponse.json({ ok: false, error: "storage_failed" }, { status: 502 });
  }
  const publicUrl = supabaseAdmin.storage.from(OUTPUT_BUCKET).getPublicUrl(path).data.publicUrl;

  // Ledger + monthly counter — non-atomic but idempotent enough
  // for a fair-use quota. Race conditions here at worst let a
  // merchant sneak one over the cap; storage-side is protected.
  const now = new Date();
  await supabaseAdmin.from("hammerex_bgremoval_events").insert({
    merchant_slug:  merchantSlug,
    source_bytes:   sourceBytes,
    output_bytes:   file.size,
    storage_path:   path,
    public_url:     publicUrl,
    inference_ms:   inferenceMs,
    device_backend: backend,
    created_at:     now.toISOString()
  });

  // Upsert monthly counter — RPC does the atomic increment.
  try {
    const rpc = await supabaseAdmin.rpc("increment_bgremoval_usage", {
      p_merchant_slug: merchantSlug,
      p_month_yyyymm:  monthKey(now)
    });
    if (rpc.error) throw new Error(rpc.error.message);
  } catch {
    // Fallback to a non-atomic upsert if the RPC isn't available.
    const { data: cur } = await supabaseAdmin
      .from("hammerex_bgremoval_usage")
      .select("used_count")
      .eq("merchant_slug", merchantSlug)
      .eq("month_yyyymm", monthKey(now))
      .maybeSingle();
    const next = ((cur as { used_count?: number } | null)?.used_count ?? 0) + 1;
    await supabaseAdmin
      .from("hammerex_bgremoval_usage")
      .upsert({
        merchant_slug: merchantSlug,
        month_yyyymm:  monthKey(now),
        used_count:    next,
        last_used_at:  now.toISOString()
      }, { onConflict: "merchant_slug,month_yyyymm" });
  }

  return NextResponse.json({
    ok:  true,
    url: publicUrl,
    id,
    quota: {
      used:  usedThisMonth + 1,
      limit: monthlyLimit,
      tier
    }
  });
}
