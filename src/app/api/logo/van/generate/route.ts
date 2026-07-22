// POST /api/logo/van/generate
//
// First-cut AI van layout. Body:
//   { van_slug, business_name, phone, logo_url?, strap_line?, trade?, cert?, vibe? }
// → { ok:true, layout: VanLayout }
//
// Public: no auth. Rate-limited by IP hash (5/min) to keep the
// Anthropic bill in check.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { generateVanLayout } from "@/lib/logo/vanLayoutAI";
import { defaultVanLayout } from "@/lib/logo/vanLayout";
import { vanColourBySlug } from "@/lib/logo/vans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_PER_MINUTE = 5;
const bucket: Map<string, { count: number; resetAt: number }> = new Map();

function checkRate(req: NextRequest): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip") ?? "0.0.0.0";
  const key = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const now = Date.now();
  const entry = bucket.get(key);
  if (!entry || entry.resetAt < now) {
    bucket.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MINUTE) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!checkRate(req)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => null) as {
    van_slug?:       string;
    van_colour?:     string;
    business_name?:  string;
    phone?:          string;
    logo_url?:       string;
    strap_line?:     string;
    trade?:          string;
    cert?:           string;
    vibe?:           string;
  } | null;

  const vanSlug      = String(body?.van_slug      ?? "").trim();
  const vanColourSlug= String(body?.van_colour    ?? "").trim();
  const businessName = String(body?.business_name ?? "").trim().slice(0, 60);
  const phone        = String(body?.phone         ?? "").trim().slice(0, 30);
  const logoUrl      = body?.logo_url ? String(body.logo_url) : null;
  const strapLine    = body?.strap_line ? String(body.strap_line).slice(0, 80) : "";
  const trade        = body?.trade      ? String(body.trade).slice(0, 40)      : "";
  const cert         = body?.cert       ? String(body.cert).slice(0, 40)       : "";
  const vibe         = body?.vibe       ? String(body.vibe).slice(0, 40)       : "";

  if (!vanSlug)      return NextResponse.json({ ok: false, error: "van_slug_required" },      { status: 400 });
  if (!businessName) return NextResponse.json({ ok: false, error: "business_name_required" }, { status: 400 });

  const vanColour = vanColourBySlug(vanColourSlug);

  // AI path if key is present, deterministic fallback otherwise.
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const layout = hasKey
    ? await generateVanLayout({
        vanSlug, logoUrl, businessName, phone, strapLine, trade, cert, vibe,
        vanColour: vanColour ? { hex: vanColour.hex, label: vanColour.label, aiHint: vanColour.aiHint } : undefined
      })
    : defaultVanLayout({ vanSlug, logoUrl, businessName, phone, strapLine });

  return NextResponse.json({ ok: true, layout, ai: hasKey });
}
