// GET  /api/mate/signals?surface=merchant&homeowner_id=...
//   → { ok, unread_count, signals[] }
//   Returns 'new' status signals for the current signed-in user.
//   Merchant: session cookie resolves the slug. Homeowner: id passed.
//
// POST /api/mate/signals
//   Body: { signal_id, action: 'read' | 'dismissed' | 'actioned' }
//   → { ok }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveKey(surface: string, req: NextRequest, homeownerId: string): Promise<string | null> {
  if (surface === "merchant") {
    const slug = await getMerchantSlug();
    return slug ?? null;
  }
  if (surface === "homeowner") return homeownerId || null;
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url          = new URL(req.url);
  const surface      = url.searchParams.get("surface") ?? "";
  const homeownerId  = url.searchParams.get("homeowner_id") ?? "";
  if (surface !== "merchant" && surface !== "homeowner") {
    return NextResponse.json({ ok: false, error: "invalid_surface" }, { status: 400 });
  }
  const key = await resolveKey(surface, req, homeownerId);
  if (!key) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("hammerex_mate_signals")
    .select("id, kind, priority, title, body, action_url, action_label, metadata, status, generated_at")
    .eq("surface", surface)
    .eq("user_key", key)
    .eq("status", "new")
    .order("priority", { ascending: true })
    .order("generated_at", { ascending: false })
    .limit(20);

  const rows = data ?? [];
  return NextResponse.json({ ok: true, unread_count: rows.length, signals: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null) as {
    signal_id?: string;
    action?:    "read" | "dismissed" | "actioned";
    surface?:   string;
    homeowner_id?: string;
  } | null;

  const signalId = body?.signal_id ?? "";
  const action   = body?.action    ?? "read";
  const surface  = body?.surface   ?? "";
  const homeownerId = body?.homeowner_id ?? "";
  if (!signalId) return NextResponse.json({ ok: false, error: "signal_id_missing" }, { status: 400 });
  if (!["read", "dismissed", "actioned"].includes(action)) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  const key = await resolveKey(surface, req, homeownerId);
  if (!key) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  // Ownership check — the signal must belong to the caller
  const owner = await supabaseAdmin
    .from("hammerex_mate_signals")
    .select("id, user_key")
    .eq("id", signalId)
    .maybeSingle();
  if (!owner.data)                     return NextResponse.json({ ok: false, error: "not_found" },  { status: 404 });
  if (owner.data.user_key !== key)     return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { status: action };
  if (action === "read")     patch.read_at     = nowIso;
  if (action === "actioned") patch.actioned_at = nowIso;

  await supabaseAdmin
    .from("hammerex_mate_signals")
    .update(patch)
    .eq("id", signalId);

  return NextResponse.json({ ok: true });
}
