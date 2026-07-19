// SiteBook invitations — server-side lifecycle for owner-invites-trade
// via the canteens directory + WhatsApp handoff.
//
// Flow:
//   1. Owner picks trade from /trade-off/yard/canteens?inviteFor=…
//   2. Modal collects: project_ids (opt-in, 1+ required), auto-brief
//   3. createInvitation() debits 1 washer, saves row, returns wa.me
//      URL prefilled with the message + magic link
//   4. Owner hits send in WhatsApp; trade receives + taps
//      nw.app/join/{token}
//   5. acceptInvitation() creates hammerex_sitebook_members rows for
//      each ticked project → status='member'
//
// See migration 20260718170000_hammerex_sitebook_invitations.sql

import crypto from "crypto";
import { supabaseAdmin }        from "@/lib/supabaseAdmin";
import { debitReveal }          from "./revealCredits";
import { hasBusinessDaySlaElapsed } from "@/lib/businessDays";

// ── Types ──────────────────────────────────────────────────────────

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "unavailable";

export type Invitation = {
  id:                    string;
  token:                 string;
  homeowner_id:          string;
  trade_listing_id:      string;
  trade_merchant_slug:   string | null;
  trade_merchant_name:   string | null;
  trade_whatsapp_e164:   string | null;
  project_ids:           string[];
  message_body:          string;
  status:                InvitationStatus;
  washers_charged:       number;
  resend_count:          number;
  sent_at:               string | null;
  responded_at:          string | null;
  revoked_at:            string | null;
  sla_marked_at:         string | null;
  created_at:            string;
};

// ── Token generation ───────────────────────────────────────────────

const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LEN      = 12;

export function generateInviteToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LEN);
  let out = "";
  for (let i = 0; i < TOKEN_LEN; i += 1) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

const REPLY_LINK_BASE = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://thenetworkers.app";

// ── Message template (canonical, per Philip 2026-07-18) ────────────

export function buildInvitationText(input: {
  homeownerFirstName?: string | null;
  siteBookNickname?:   string | null;
  siteBookCity?:       string | null;
  tradeName:           string;
  projectTitles:       string[];
  token:               string;
}): string {
  const owner    = input.homeownerFirstName || input.siteBookNickname || "A homeowner";
  const nickname = input.siteBookNickname   || "their SiteBook";
  const city     = input.siteBookCity       || "UK";
  const project  = input.projectTitles.length === 1
    ? input.projectTitles[0]
    : `${input.projectTitles.length} projects`;
  const link     = `${REPLY_LINK_BASE.replace(/\/$/, "")}/join/${input.token}`;

  return `Hi ${input.tradeName},

${owner} is inviting you to join ${nickname}
on The Network (${city} · ${project}).

Tap to accept + see the brief:
${link}

This link joins you to ${owner}'s SiteBook so you can
see photos, quotes, and reply directly.

— Sent from ${owner}'s SiteBook via The Network`;
}

export function buildWaMeUrl(whatsappE164: string, text: string): string {
  const stripped = whatsappE164.replace(/[^\d]/g, "");
  return `https://wa.me/${stripped}?text=${encodeURIComponent(text)}`;
}

// ── Create ─────────────────────────────────────────────────────────

export async function createInvitation(input: {
  homeownerId:         string;
  homeownerFirstName?: string | null;
  siteBookNickname?:   string | null;
  siteBookCity?:       string | null;
  /** UUID of the trade listing. Pass this OR tradeSlug. */
  tradeListingId?:     string;
  /** Slug of the trade listing (from canteens directory). */
  tradeSlug?:          string;
  projectIds:          string[];
}): Promise<
  | { ok: true; invitation: Invitation; waUrl: string; projectTitles: string[] }
  | { ok: false; error: string }
> {
  if (input.projectIds.length === 0) return { ok: false, error: "no-projects-selected" };
  if (!input.tradeListingId && !input.tradeSlug) return { ok: false, error: "missing-trade" };

  // Verify all projects belong to the homeowner
  const projects = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title")
    .in("id", input.projectIds)
    .eq("homeowner_id", input.homeownerId);
  const projectRows = (projects.data as { id: string; title: string }[]) ?? [];
  if (projectRows.length !== input.projectIds.length) {
    return { ok: false, error: "project-ownership-mismatch" };
  }

  // Look up the trade listing by id or slug
  const listingQuery = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, business_name, whatsapp, phone");
  const listing = input.tradeListingId
    ? await listingQuery.eq("id", input.tradeListingId).maybeSingle()
    : await listingQuery.eq("slug", input.tradeSlug!).maybeSingle();
  if (!listing.data) return { ok: false, error: "trade-not-found" };
  const trade = listing.data as {
    id: string; slug: string; business_name: string;
    whatsapp: string | null; phone: string | null;
  };
  const waNumber = trade.whatsapp || trade.phone;
  if (!waNumber) return { ok: false, error: "trade-no-whatsapp" };

  // Debit 1 washer BEFORE writing the row so failed inserts don't
  // leak credit.
  const debit = await debitReveal(input.homeownerId);
  if (!debit.ok) return { ok: false, error: debit.error };

  // Insert (retry once on token collision)
  let invitation: Invitation | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateInviteToken();
    const messageBody = buildInvitationText({
      homeownerFirstName: input.homeownerFirstName,
      siteBookNickname:   input.siteBookNickname,
      siteBookCity:       input.siteBookCity,
      tradeName:          trade.business_name,
      projectTitles:      projectRows.map((p) => p.title),
      token
    });
    const ins = await supabaseAdmin
      .from("hammerex_sitebook_invitations")
      .insert({
        token,
        homeowner_id:        input.homeownerId,
        trade_listing_id:    trade.id,
        trade_merchant_slug: trade.slug,
        trade_merchant_name: trade.business_name,
        trade_whatsapp_e164: waNumber,
        project_ids:         input.projectIds,
        message_body:        messageBody,
        status:              "pending",
        washers_charged:     1,
        sent_at:             new Date().toISOString()
      })
      .select("*")
      .maybeSingle();
    if (ins.data) { invitation = ins.data as Invitation; break; }
  }
  if (!invitation) return { ok: false, error: "invitation-insert-failed" };

  const waUrl = buildWaMeUrl(waNumber, invitation.message_body);
  return {
    ok: true,
    invitation,
    waUrl,
    projectTitles: projectRows.map((p) => p.title)
  };
}

// ── Load / status update ───────────────────────────────────────────

/**
 * Load an invitation by its public token. Also applies the SLA flip
 * lazily: if status is still 'pending' AND the 24h Mon-Sat window
 * has elapsed since sent_at, the row is bumped to 'unavailable' and
 * the caller sees the updated status.
 */
export async function loadInvitationByToken(token: string): Promise<Invitation | null> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!res.data) return null;
  return maybeMarkUnavailable(res.data as Invitation);
}

export async function loadInvitationsForHomeowner(homeownerId: string): Promise<Invitation[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .select("*")
    .eq("homeowner_id", homeownerId)
    .order("created_at", { ascending: false });
  const rows = (res.data as Invitation[]) ?? [];
  // Apply SLA flip lazily. We update in the background — no need to
  // await for the caller to see the correct in-memory state.
  const now = new Date();
  const flipped: Invitation[] = [];
  for (const r of rows) {
    if (r.status === "pending" && r.sent_at && hasBusinessDaySlaElapsed(r.sent_at, now, 24)) {
      flipped.push({ ...r, status: "unavailable", sla_marked_at: new Date().toISOString() });
    } else {
      flipped.push(r);
    }
  }
  const flippedIds = flipped
    .filter((r, i) => r.status === "unavailable" && rows[i].status === "pending")
    .map((r) => r.id);
  if (flippedIds.length > 0) {
    void supabaseAdmin
      .from("hammerex_sitebook_invitations")
      .update({ status: "unavailable", sla_marked_at: new Date().toISOString() })
      .in("id", flippedIds);
  }
  return flipped;
}

async function maybeMarkUnavailable(row: Invitation): Promise<Invitation> {
  if (row.status !== "pending" || !row.sent_at) return row;
  if (!hasBusinessDaySlaElapsed(row.sent_at, new Date(), 24)) return row;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .update({ status: "unavailable", sla_marked_at: now })
    .eq("id", row.id);
  return { ...row, status: "unavailable", sla_marked_at: now };
}

// ── Accept / Decline / Revoke / Resend ─────────────────────────────

export async function acceptInvitation(token: string): Promise<
  | { ok: true; invitation: Invitation }
  | { ok: false; error: string }
> {
  const inv = await loadInvitationByToken(token);
  if (!inv)                      return { ok: false, error: "not-found" };
  if (inv.status === "revoked")  return { ok: false, error: "revoked" };
  if (inv.status !== "pending" && inv.status !== "unavailable")
    return { ok: false, error: "already-responded" };

  // Fetch trade metadata to seed sitebook_members rows
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, business_name, primary_trade")
    .eq("id", inv.trade_listing_id)
    .maybeSingle();
  const trade = listing.data as {
    id: string; slug: string; business_name: string; primary_trade: string | null;
  } | null;
  if (!trade) return { ok: false, error: "trade-not-found" };

  // Insert one member row per project (idempotent via unique index —
  // if the trade is already on that project, ignore).
  const memberRows = inv.project_ids.map((project_id) => ({
    project_id,
    listing_id:    trade.id,
    merchant_slug: trade.slug,
    merchant_name: trade.business_name,
    trade_type:    trade.primary_trade,
    member_role:   "sub",
    status:        "accepted",
    accepted_at:   new Date().toISOString()
  }));
  await supabaseAdmin
    .from("hammerex_sitebook_members")
    .upsert(memberRows, { onConflict: "project_id,listing_id" });

  const now = new Date().toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .update({ status: "accepted", responded_at: now })
    .eq("id", inv.id)
    .select("*")
    .maybeSingle();
  if (!upd.data) return { ok: false, error: "invitation-update-failed" };
  return { ok: true, invitation: upd.data as Invitation };
}

export async function declineInvitation(token: string): Promise<
  | { ok: true; invitation: Invitation }
  | { ok: false; error: string }
> {
  const inv = await loadInvitationByToken(token);
  if (!inv) return { ok: false, error: "not-found" };
  if (inv.status !== "pending" && inv.status !== "unavailable") {
    return { ok: false, error: "already-responded" };
  }

  const now = new Date().toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .update({ status: "declined", responded_at: now })
    .eq("id", inv.id)
    .select("*")
    .maybeSingle();
  if (!upd.data) return { ok: false, error: "invitation-update-failed" };
  return { ok: true, invitation: upd.data as Invitation };
}

export async function revokeInvitation(id: string, homeownerId: string): Promise<boolean> {
  const upd = await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("homeowner_id", homeownerId)
    .in("status", ["pending", "unavailable"])
    .select("id")
    .maybeSingle();
  return !!upd.data;
}

/** Resend an invitation. Within 7 days of the last send: free.
 *  Beyond that: another washer is debited. */
export async function resendInvitation(id: string, homeownerId: string): Promise<
  | { ok: true; invitation: Invitation; waUrl: string; charged: boolean }
  | { ok: false; error: string }
> {
  const row = await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .select("*")
    .eq("id", id)
    .eq("homeowner_id", homeownerId)
    .maybeSingle();
  if (!row.data) return { ok: false, error: "not-found" };
  const inv = row.data as Invitation;
  if (inv.status === "accepted" || inv.status === "declined") {
    return { ok: false, error: "already-responded" };
  }
  if (!inv.trade_whatsapp_e164) return { ok: false, error: "trade-no-whatsapp" };

  const lastSent = inv.sent_at ? new Date(inv.sent_at).getTime() : 0;
  const withinFreeWindow = Date.now() - lastSent < 7 * 24 * 60 * 60 * 1000;
  let charged = false;
  if (!withinFreeWindow) {
    const debit = await debitReveal(homeownerId);
    if (!debit.ok) return { ok: false, error: debit.error };
    charged = true;
  }

  const now = new Date().toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_sitebook_invitations")
    .update({
      status:          "pending",
      sent_at:         now,
      sla_marked_at:   null,
      resend_count:    inv.resend_count + 1,
      washers_charged: inv.washers_charged + (charged ? 1 : 0)
    })
    .eq("id", inv.id)
    .select("*")
    .maybeSingle();
  if (!upd.data) return { ok: false, error: "invitation-update-failed" };
  const fresh = upd.data as Invitation;
  const waUrl = buildWaMeUrl(inv.trade_whatsapp_e164, fresh.message_body);
  return { ok: true, invitation: fresh, waUrl, charged };
}
