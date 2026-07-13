// POST /api/canteens/[slug]/invite
//
// Host-only. Parses the invite modal's "handles" textarea (one per
// line, mix of @slugs and phone numbers). For each entry:
//
//   @slug     → look up in hammerex_trade_off_listings.
//                  Match → insert into hammerex_canteen_members
//                          with role='member' (skipped if already a
//                          member; server-side idempotent).
//                  Miss  → returned in the `unrecognized` bucket so
//                          the client can nudge the host to double-
//                          check spelling.
//   phone     → returned to the client as a WhatsApp share URL. We
//                  DO NOT send SMS/WA server-side (avoids abuse +
//                  compliance) — the host taps the button, so the
//                  message is sent from THEIR device.
//
// Anything else (empty lines, malformed) is silently skipped.
//
// Response shape lets the client render a three-bucket results
// panel: what's now a member, what to click-to-send, what didn't
// match. Never silently fails a whole batch on partial errors.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";

const MAX_ENTRIES = 50;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

type InvitePayload = {
  entries?: string[];
  // Legacy support — the modal passes a single textarea string too.
  raw?: string;
};

type ParsedEntry =
  | { kind: "slug"; value: string }
  | { kind: "phone"; value: string }
  | { kind: "invalid"; raw: string };

function parseLine(line: string): ParsedEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("@")) {
    const slug = trimmed.slice(1).toLowerCase();
    return SLUG_RE.test(slug)
      ? { kind: "slug", value: slug }
      : { kind: "invalid", raw: trimmed };
  }
  // Digits + spaces + optional +/() only — phone-shaped input.
  const digits = trimmed.replace(/[^0-9+]/g, "");
  if (digits.length >= 9 && digits.length <= 15) {
    return { kind: "phone", value: digits };
  }
  // Plain word → treat as slug guess (missing @).
  if (SLUG_RE.test(trimmed.toLowerCase())) {
    return { kind: "slug", value: trimmed.toLowerCase() };
  }
  return { kind: "invalid", raw: trimmed };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { slug: canteenSlug } = await params;

  let payload: InvitePayload;
  try {
    payload = (await req.json()) as InvitePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const lines = Array.isArray(payload.entries)
    ? payload.entries
    : String(payload.raw ?? "").split("\n");
  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: "empty-payload" }, { status: 400 });
  }
  if (lines.length > MAX_ENTRIES) {
    return NextResponse.json({ ok: false, error: "too-many-entries" }, { status: 400 });
  }

  // Host check.
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug, name, trade_label")
    .eq("slug", canteenSlug)
    .maybeSingle();
  if (canteen.error || !canteen.data) {
    return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  }
  if (canteen.data.host_slug !== identity.slug) {
    return NextResponse.json({ ok: false, error: "not-host" }, { status: 403 });
  }

  const parsed = lines.map(parseLine).filter((p): p is ParsedEntry => p !== null);
  const slugEntries = parsed.filter((p): p is Extract<ParsedEntry, { kind: "slug" }> => p.kind === "slug");
  const phoneEntries = parsed.filter((p): p is Extract<ParsedEntry, { kind: "phone" }> => p.kind === "phone");
  const invalidEntries = parsed.filter((p): p is Extract<ParsedEntry, { kind: "invalid" }> => p.kind === "invalid");

  const canteenId = canteen.data.id;
  const canteenName = canteen.data.name;
  const inviteUrl = `/trade-off/yard/canteens/${canteenSlug}?invite=1`;

  // ── Resolve slugs → matched listings ──
  const uniqueSlugs = Array.from(new Set(slugEntries.map((s) => s.value)));
  let addedMembers: Array<{ slug: string; displayName: string }> = [];
  let unrecognisedSlugs: string[] = [];
  let alreadyMembers: string[] = [];

  if (uniqueSlugs.length > 0) {
    const listings = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, display_name, trade_label")
      .in("slug", uniqueSlugs);
    const foundBySlug = new Map<string, { display_name: string | null; trade_label: string | null }>();
    for (const l of listings.data ?? []) {
      foundBySlug.set(l.slug, { display_name: l.display_name ?? null, trade_label: l.trade_label ?? null });
    }
    unrecognisedSlugs = uniqueSlugs.filter((s) => !foundBySlug.has(s));

    if (foundBySlug.size > 0) {
      // Skip slugs already a member.
      const existing = await supabaseAdmin
        .from("hammerex_canteen_members")
        .select("member_slug")
        .eq("canteen_id", canteenId)
        .in("member_slug", Array.from(foundBySlug.keys()));
      const existingSet = new Set((existing.data ?? []).map((r) => r.member_slug));
      alreadyMembers = Array.from(existingSet);

      const toInsert: Array<{
        canteen_id: string;
        member_slug: string;
        display_name: string;
        trade_label: string;
        role: string;
      }> = [];
      for (const [foundSlug, meta] of foundBySlug) {
        if (existingSet.has(foundSlug)) continue;
        toInsert.push({
          canteen_id: canteenId,
          member_slug: foundSlug,
          display_name: meta.display_name ?? foundSlug,
          trade_label: meta.trade_label ?? canteen.data.trade_label,
          role: "member"
        });
      }
      if (toInsert.length > 0) {
        const inserted = await supabaseAdmin
          .from("hammerex_canteen_members")
          .insert(toInsert)
          .select("member_slug, display_name");
        if (!inserted.error && inserted.data) {
          addedMembers = inserted.data.map((r) => ({ slug: r.member_slug, displayName: r.display_name }));
        }
      }
    }
  }

  // Bump member_count best-effort so canteen list stays fresh.
  if (addedMembers.length > 0) {
    const cur = await supabaseAdmin
      .from("hammerex_canteens")
      .select("member_count")
      .eq("id", canteenId)
      .maybeSingle();
    const prev = cur.data?.member_count ?? 1;
    await supabaseAdmin
      .from("hammerex_canteens")
      .update({ member_count: prev + addedMembers.length })
      .eq("id", canteenId);
  }

  // ── Build WhatsApp share URLs for phone numbers ──
  const waMessage = `Join ${canteenName} on Thenetworkers: ${inviteUrl}`;
  const whatsAppShares = phoneEntries.map((p) => ({
    phone: p.value,
    href: `https://wa.me/${p.value.replace(/^\+/, "")}?text=${encodeURIComponent(waMessage)}`
  }));

  return NextResponse.json({
    ok: true,
    added: addedMembers,
    alreadyMembers,
    unrecognisedSlugs,
    invalid: invalidEntries.map((i) => i.raw),
    whatsAppShares
  });
}
