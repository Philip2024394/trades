// beacon — 3-tier lead routing engine.
//
// Homeowner posts a project → we fan it out to N nearest trades with
// a claim SLA. Timeouts back-fill to the next batch. Non-active
// trades (no washers / no WhatsApp) still receive it with an upsell
// CTA. When all waves timeout, the residual lands in an admin queue
// for merchant-acquisition outreach.
//
// Philip 2026-07-17 spec:
//   • claim_slots = 3 (target concurrent responders)
//   • claim_sla_hours = 2 (SLA per assigned merchant)
//   • fill-up-to-target: if a claim times out, back-fill the next
//     nearest trade until slots refill or the pool is exhausted
//   • FOMO signal: timed-out claims keep the message visible but
//     the WhatsApp CTA is replaced with a grey "expired" state
//   • Tier 2 upsell: non-ready merchants see "top up washers to
//     unlock" or "add WhatsApp to activate" CTAs
//   • Tier 3 admin residual: no-taker beacons go to admin queue
//     with generated bait link for prospective-trade outreach
//
// Constitutional check: ADR-0003 (no lead selling) — trades pay a
// washer only when THEY claim; homeowner pays £0.
// Washer rule (project_washers_lead_gen_model.md) — 1 claim = 1
// washer deducted at claim time, not before.
//
// SERVER-ONLY.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BeaconReadinessTier = 1 | 2 | 3;
// 1 = Active-ready (washer bag has balance + WhatsApp populated)
// 2 = Warm (needs washer topup OR WhatsApp activation)
// 3 = Cold (both) — still gets the nudge but very likely to churn

export type BeaconInput = {
  customer_name:      string;
  customer_email:     string | null;
  customer_whatsapp:  string | null;
  customer_city:      string | null;
  customer_postcode_prefix: string | null;
  project_description: string;
  trade_slug:          string;
  source_surface:      string;          // "inspiration-detail" / "find-beacon" / etc.
  source_image_id:     string | null;
  customer_ip_hash:    string | null;
  claim_slots?:        number;
  claim_sla_hours?:    number;
};

export type BeaconClaim = {
  id:                 string;
  beacon_id:          string;
  merchant_slug:      string;
  status:             "assigned" | "claimed" | "timed_out" | "expired";
  assigned_at:        string;
  sla_expires_at:     string;
  claimed_at:         string | null;
  readiness_tier:     BeaconReadinessTier;
  wave_number:        number;
};

const DEFAULT_SLOTS = 3;
const DEFAULT_SLA_HOURS = 2;

// Rate-limit thresholds — keep tight enough that a spammer can't
// drain washer bags via fanout notifications, loose enough that a
// legitimate homeowner posting two projects (kitchen + bathroom)
// isn't blocked.
const RATE_LIMIT = {
  PER_IP_PER_HOUR:            3,
  PER_IP_PER_DAY:             10,
  PER_IP_PER_TRADE_PER_15MIN: 1
} as const;

/** Rate-limit check for beacon creation. Called before createBeacon.
 *  Returns `allowed: false` with a reason + Retry-After hint when
 *  any limit is exceeded. Uses customer_ip_hash from prior beacons
 *  as the join key (no separate rate-limit table needed). */
export async function checkBeaconRateLimit(input: {
  ipHash:    string;
  tradeSlug: string;
}): Promise<{
  allowed:            boolean;
  reason?:            string;
  retryAfterMinutes?: number;
}> {
  if (!input.ipHash || input.ipHash === "unknown") {
    // Unknown IP — allow but log. Alternative is to reject, which
    // would break legitimate direct-server requests + local dev.
    return { allowed: true };
  }

  const now = Date.now();
  const day  = new Date(now - 24 * 3600 * 1000).toISOString();
  const hour = new Date(now - 3600 * 1000).toISOString();
  const win15 = new Date(now - 15 * 60 * 1000).toISOString();

  // Single query — pulls the last day's beacons for this IP hash, we
  // filter windows in code. Cheap because per-IP volume in a 24h
  // window is naturally bounded.
  const recentRes = await supabaseAdmin
    .from("hammerex_xrated_project_beacons")
    .select("sent_at, trade_slug")
    .eq("customer_ip_hash", input.ipHash)
    .gte("sent_at", day)
    .limit(50);
  const recent = (recentRes.data ?? []) as Array<{ sent_at: string; trade_slug: string }>;

  const perDay  = recent.length;
  const perHour = recent.filter((r) => r.sent_at >= hour).length;
  const perTradeWindow = recent.filter((r) =>
    r.sent_at >= win15 && r.trade_slug === input.tradeSlug
  ).length;

  if (perTradeWindow >= RATE_LIMIT.PER_IP_PER_TRADE_PER_15MIN) {
    return {
      allowed:           false,
      reason:            "You've just posted a job for this trade. Wait 15 minutes before submitting another for the same trade — this stops duplicate leads reaching them.",
      retryAfterMinutes: 15
    };
  }
  if (perHour >= RATE_LIMIT.PER_IP_PER_HOUR) {
    return {
      allowed:           false,
      reason:            `You've posted ${perHour} jobs in the last hour. Wait an hour before posting another (helps us keep trades focused on real enquiries).`,
      retryAfterMinutes: 60
    };
  }
  if (perDay >= RATE_LIMIT.PER_IP_PER_DAY) {
    return {
      allowed:           false,
      reason:            `You've posted ${perDay} jobs today. Wait until tomorrow before posting another. If this is wrong, contact support.`,
      retryAfterMinutes: 720
    };
  }
  return { allowed: true };
}

/** Homeowner submits an enquiry. Creates the beacon row + fans it
 *  out to the first wave of eligible merchants. Returns the beacon
 *  ID + summary of who was reached. */
export async function createBeacon(input: BeaconInput): Promise<{
  beaconId:  string;
  fanoutCount: number;
  readinessBreakdown: { tier1: number; tier2: number; tier3: number };
  adminResidual: boolean;
}> {
  const slots      = input.claim_slots     ?? DEFAULT_SLOTS;
  const slaHours   = input.claim_sla_hours ?? DEFAULT_SLA_HOURS;
  const now = new Date();

  // 1) Create the beacon row. Now stores customer_email + customer_whatsapp
  //    (added 2026-07-17) so the receipt email can go out + so claimBeacon
  //    can build a proper wa.me link with the real customer number.
  const insert = await supabaseAdmin
    .from("hammerex_xrated_project_beacons")
    .insert({
      customer_name:             input.customer_name,
      customer_email:            input.customer_email,
      customer_whatsapp:         input.customer_whatsapp,
      customer_city:             input.customer_city,
      customer_postcode_prefix:  input.customer_postcode_prefix,
      trade_slug:                input.trade_slug,
      project_description:       input.project_description,
      country:                   "GB",
      customer_ip_hash:          input.customer_ip_hash,
      source_surface:            input.source_surface,
      source_image_id:           input.source_image_id,
      claim_slots:               slots,
      claim_sla_hours:           slaHours,
      status:                    "active",
      sent_at:                   now.toISOString()
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    throw new Error(`[beacon.create] insert failed: ${insert.error?.message ?? "no row"}`);
  }
  const beaconId = insert.data.id as string;

  // 2) Fan out to first wave.
  const fanout = await runFanoutWave({
    beaconId,
    tradeSlug:   input.trade_slug,
    city:        input.customer_city ?? null,
    slotsNeeded: slots,
    slaHours,
    waveNumber:  1
  });

  // 3) If zero eligible trades exist, escalate immediately to admin.
  const adminResidual = fanout.fanoutCount === 0;
  if (adminResidual) {
    await escalateToAdmin(beaconId);
  }

  // 4) Send the receipt email to the homeowner (both branches). Fires
  //    only when customer_email is populated. Never blocks the return.
  if (input.customer_email) {
    try {
      const { sendBeaconReceiptEmail } = await import("@/lib/beaconCustomerEmail");
      await sendBeaconReceiptEmail({
        beaconId,
        customerEmail: input.customer_email,
        customerName:  input.customer_name,
        customerCity:  input.customer_city,
        tradeSlug:     input.trade_slug,
        description:   input.project_description,
        fanoutCount:   fanout.fanoutCount,
        slaHours,
        adminResidual
      });
    } catch (err) {
      console.error("[beacon.create] receipt email failed:", err);
    }
  }

  return {
    beaconId,
    fanoutCount:        fanout.fanoutCount,
    readinessBreakdown: fanout.readinessBreakdown,
    adminResidual
  };
}

/** Run one wave of fanout for a beacon. Skips merchants who have
 *  already been assigned this beacon (idempotent on re-run).
 *  Prioritises Tier 1 (active-ready) merchants first, then Tier 2
 *  (warm) to reach the slot target. Returns readiness breakdown. */
export async function runFanoutWave(input: {
  beaconId:    string;
  tradeSlug:   string;
  city:        string | null;
  slotsNeeded: number;
  slaHours:    number;
  waveNumber:  number;
}): Promise<{ fanoutCount: number; readinessBreakdown: { tier1: number; tier2: number; tier3: number } }> {
  const { beaconId, tradeSlug, city, slotsNeeded, slaHours, waveNumber } = input;

  // Already-assigned merchants (any status). Skip these so we don't
  // spam the same merchant with the same beacon in later waves.
  const existing = await supabaseAdmin
    .from("hammerex_beacon_claims")
    .select("merchant_slug")
    .eq("beacon_id", beaconId);
  const alreadyAssigned = new Set((existing.data ?? []).map((r) => r.merchant_slug as string));

  // Merchant search — primary_trade or secondary_trades containment.
  // City first (exact match), then broaden to any UK match.
  const orFilter = `primary_trade.eq.${tradeSlug},secondary_trades.cs.{${tradeSlug}}`;

  const base = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, whatsapp, city")
    .eq("status", "live")
    .or(orFilter);

  let candidates: Array<{ id: string; slug: string; whatsapp: string | null; city: string | null }> = [];

  // City-first pass
  if (city) {
    const cityRes = await base.ilike("city", city).limit(slotsNeeded * 4);
    candidates = ((cityRes.data ?? []) as Array<{ id: string; slug: string; whatsapp: string | null; city: string | null }>);
  }
  // Wider net if under-filled
  if (candidates.length < slotsNeeded * 2) {
    const wider = await base.limit(slotsNeeded * 6);
    const extras = ((wider.data ?? []) as typeof candidates);
    const seen = new Set(candidates.map((c) => c.slug));
    for (const c of extras) {
      if (!seen.has(c.slug)) {
        candidates.push(c);
        seen.add(c.slug);
      }
    }
  }

  // Filter already-assigned
  candidates = candidates.filter((c) => !alreadyAssigned.has(c.slug));

  // Score readiness per merchant. Read washer bags in one batch.
  const merchantIds = candidates.map((c) => c.id);
  const bagRes = merchantIds.length > 0
    ? await supabaseAdmin
        .from("hammerex_washer_bags")
        .select("listing_id, balance")
        .in("listing_id", merchantIds)
    : { data: [] as Array<{ listing_id: string; balance: number }>, error: null };
  const bagBySlug: Record<string, number> = {};
  for (const b of (bagRes.data ?? []) as Array<{ listing_id: string; balance: number }>) {
    const merchant = candidates.find((c) => c.id === b.listing_id);
    if (merchant) bagBySlug[merchant.slug] = b.balance;
  }

  function readiness(c: { slug: string; whatsapp: string | null }): BeaconReadinessTier {
    const hasWa   = Boolean(c.whatsapp && c.whatsapp.replace(/\D/g, "").length >= 8);
    const hasBag  = (bagBySlug[c.slug] ?? 0) > 0;
    if (hasWa && hasBag) return 1;
    if (hasWa || hasBag) return 2;
    return 3;
  }

  // Rank: Tier 1 first, Tier 2 second, Tier 3 last. Take top N to fill slots.
  const ranked = candidates
    .map((c) => ({ ...c, tier: readiness(c) }))
    .sort((a, b) => a.tier - b.tier);

  // Take up to slotsNeeded Tier-1s + fill remaining with Tier-2 + then Tier-3.
  const tier1 = ranked.filter((c) => c.tier === 1);
  const tier2 = ranked.filter((c) => c.tier === 2);
  const tier3 = ranked.filter((c) => c.tier === 3);

  const chosen: typeof ranked = [];
  for (const c of tier1) { if (chosen.length >= slotsNeeded) break; chosen.push(c); }
  for (const c of tier2) { if (chosen.length >= slotsNeeded) break; chosen.push(c); }
  for (const c of tier3) { if (chosen.length >= slotsNeeded) break; chosen.push(c); }

  if (chosen.length === 0) {
    return { fanoutCount: 0, readinessBreakdown: { tier1: 0, tier2: 0, tier3: 0 } };
  }

  const now = new Date();
  const slaExpires = new Date(now.getTime() + slaHours * 3600 * 1000);
  const rows = chosen.map((c) => ({
    beacon_id:            beaconId,
    merchant_slug:        c.slug,
    merchant_listing_id:  c.id,
    assigned_at:          now.toISOString(),
    sla_expires_at:       slaExpires.toISOString(),
    status:               "assigned",
    readiness_tier:       c.tier,
    wave_number:          waveNumber
  }));

  const claimInsert = await supabaseAdmin
    .from("hammerex_beacon_claims")
    .insert(rows);
  if (claimInsert.error) {
    console.error("[beacon.fanout] claim insert failed:", claimInsert.error);
  }

  // Fire notifications to every newly-assigned merchant. Best-effort
  // per merchant — a Resend hiccup on one doesn't block the wave.
  // Tier 3 skipped inside notifyBeaconAssigned. Async but awaited so
  // stream stays sequential (Resend rate-limits at ~10/s).
  try {
    const beacon = await supabaseAdmin
      .from("hammerex_xrated_project_beacons")
      .select("customer_name, customer_city, trade_slug, project_description, claim_sla_hours")
      .eq("id", beaconId)
      .single();
    if (beacon.data) {
      const { notifyBeaconAssigned } = await import("@/lib/beaconNotify");
      for (const c of chosen) {
        await notifyBeaconAssigned({
          merchantId:    c.id,
          merchantSlug:  c.slug,
          readinessTier: c.tier,
          beaconId,
          customerName:  (beacon.data.customer_name as string) ?? "Customer",
          customerCity:  (beacon.data.customer_city as string | null) ?? null,
          tradeSlug:     (beacon.data.trade_slug as string) ?? tradeSlug,
          description:   (beacon.data.project_description as string) ?? "",
          slaHours:      (beacon.data.claim_sla_hours as number) ?? slaHours
        }).catch((err) => console.error(`[beacon.fanout] notify ${c.slug} failed:`, err));
      }
    }
  } catch (err) {
    console.error("[beacon.fanout] notification loop threw:", err);
  }

  return {
    fanoutCount: chosen.length,
    readinessBreakdown: {
      tier1: chosen.filter((c) => c.tier === 1).length,
      tier2: chosen.filter((c) => c.tier === 2).length,
      tier3: chosen.filter((c) => c.tier === 3).length
    }
  };
}

/** Trade claims a beacon. Idempotent — safe on double-click. Deducts
 *  1 washer from the merchant's bag. Returns whether the claim was
 *  accepted, and the WhatsApp deep-link the trade should open.
 *
 *  `customMessage` — when provided, used verbatim as the WhatsApp
 *  pre-fill instead of the canned template. Trade can personalise
 *  the message in the compose modal before submitting. */
export async function claimBeacon(input: {
  beaconId:       string;
  merchantSlug:   string;
  customMessage?: string;
}): Promise<{ ok: boolean; reason?: string; whatsappHref?: string }> {
  const claimRow = await supabaseAdmin
    .from("hammerex_beacon_claims")
    .select("id, status, sla_expires_at, merchant_listing_id, readiness_tier")
    .eq("beacon_id", input.beaconId)
    .eq("merchant_slug", input.merchantSlug)
    .maybeSingle();
  if (claimRow.error || !claimRow.data) {
    return { ok: false, reason: "not-assigned" };
  }
  const claim = claimRow.data;
  if (claim.status === "claimed") {
    return { ok: false, reason: "already-claimed" };
  }
  if (claim.status !== "assigned") {
    return { ok: false, reason: `status-${claim.status}` };
  }
  if (new Date(claim.sla_expires_at as string).getTime() < Date.now()) {
    return { ok: false, reason: "sla-expired" };
  }
  // Tier 2/3 merchants can't claim until they're active-ready. UI
  // should route them through top-up / WhatsApp-add first.
  if (claim.readiness_tier !== 1) {
    return { ok: false, reason: "not-ready" };
  }

  // Fetch beacon customer contact + description for the WA link.
  const beacon = await supabaseAdmin
    .from("hammerex_xrated_project_beacons")
    .select("customer_name, customer_city, project_description, customer_whatsapp")
    .eq("id", input.beaconId)
    .single();
  const custDesc = (beacon.data?.project_description as string) ?? "your project";
  const custName = (beacon.data?.customer_name as string) ?? "customer";
  const custCity = (beacon.data?.customer_city as string) ?? "";
  const custWa   = (beacon.data?.customer_whatsapp as string | null) ?? "";

  // Charge 1 washer from the merchant bag.
  const bagRes = await supabaseAdmin
    .from("hammerex_washer_bags")
    .select("id, balance")
    .eq("listing_id", claim.merchant_listing_id as string)
    .maybeSingle();
  if (!bagRes.data || bagRes.data.balance < 1) {
    return { ok: false, reason: "no-washers" };
  }
  await supabaseAdmin
    .from("hammerex_washer_bags")
    .update({ balance: bagRes.data.balance - 1 })
    .eq("id", bagRes.data.id as string);

  // Flip status + stamp claim time.
  await supabaseAdmin
    .from("hammerex_beacon_claims")
    .update({
      status:         "claimed",
      claimed_at:     new Date().toISOString(),
      washer_charged: true
    })
    .eq("id", claim.id as string);

  // If we've now filled the slot target, no more waves are needed.
  // Cron will still sweep timeouts.

  // Use the trade's custom-composed message when provided (from the
  // compose modal); otherwise the canned template. Cap at 800 chars
  // as WhatsApp deep-links get truncated past ~1000 URL-encoded chars.
  const defaultMsg = `Hi ${custName}, I saw your ${custCity ? custCity + " " : ""}enquiry on The Network — "${custDesc.slice(0, 140)}${custDesc.length > 140 ? "…" : ""}". Happy to quote — when's a good time to chat?`;
  const composed   = (input.customMessage ?? "").trim();
  const waMsg      = composed.length > 0 ? composed.slice(0, 800) : defaultMsg;
  // Build the real wa.me link with the customer's number (digits only).
  // Falls back to a "picker" wa.me link (no number) if the customer
  // didn't provide WhatsApp — trade can still send the drafted message
  // by choosing a contact in their WhatsApp app.
  const waDigits = custWa.replace(/\D/g, "");
  const whatsappHref = waDigits.length >= 8
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMsg)}`
    : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
  return { ok: true, whatsappHref };
}

/** Cron sweep — flip expired assigned claims to `timed_out`,
 *  back-fill new waves for beacons that fell below target, escalate
 *  to admin residual if no more trades exist to fanout to. */
export async function slaSweep(): Promise<{
  timedOut: number;
  refilled: number;
  escalated: number;
}> {
  const now = new Date();

  // 1) Find all assigned claims past SLA and time them out.
  const expiredRes = await supabaseAdmin
    .from("hammerex_beacon_claims")
    .select("id, beacon_id")
    .eq("status", "assigned")
    .lt("sla_expires_at", now.toISOString());
  const expiredClaims = (expiredRes.data ?? []) as Array<{ id: string; beacon_id: string }>;

  if (expiredClaims.length > 0) {
    await supabaseAdmin
      .from("hammerex_beacon_claims")
      .update({ status: "timed_out", timed_out_at: now.toISOString() })
      .in("id", expiredClaims.map((c) => c.id));
  }

  // 2) Group by beacon_id — for each affected beacon, check if we've
  //    dropped below the slot target and need another wave.
  const affectedBeaconIds = Array.from(new Set(expiredClaims.map((c) => c.beacon_id)));
  let refilled = 0;
  let escalated = 0;

  for (const beaconId of affectedBeaconIds) {
    const beacon = await supabaseAdmin
      .from("hammerex_xrated_project_beacons")
      .select("trade_slug, customer_city, claim_slots, claim_sla_hours, status")
      .eq("id", beaconId)
      .single();
    if (!beacon.data || beacon.data.status !== "active") continue;

    // Count remaining active claims (assigned or claimed) for this beacon.
    const activeCountRes = await supabaseAdmin
      .from("hammerex_beacon_claims")
      .select("id", { count: "exact", head: true })
      .eq("beacon_id", beaconId)
      .in("status", ["assigned", "claimed"]);
    const activeCount = activeCountRes.count ?? 0;

    // Max wave number so far
    const waveRes = await supabaseAdmin
      .from("hammerex_beacon_claims")
      .select("wave_number")
      .eq("beacon_id", beaconId)
      .order("wave_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextWave = ((waveRes.data?.wave_number as number | undefined) ?? 1) + 1;

    const slots     = (beacon.data.claim_slots     as number) ?? DEFAULT_SLOTS;
    const slaHours  = (beacon.data.claim_sla_hours as number) ?? DEFAULT_SLA_HOURS;
    const shortBy   = Math.max(0, slots - activeCount);

    if (shortBy === 0) continue;

    // Cap: 4 waves total = ~4x SLA. Stops runaway fanout.
    if (nextWave > 4) {
      await escalateToAdmin(beaconId);
      escalated++;
      continue;
    }

    const wave = await runFanoutWave({
      beaconId,
      tradeSlug:   beacon.data.trade_slug as string,
      city:        (beacon.data.customer_city as string | null) ?? null,
      slotsNeeded: shortBy,
      slaHours,
      waveNumber:  nextWave
    });
    if (wave.fanoutCount === 0) {
      await escalateToAdmin(beaconId);
      escalated++;
    } else {
      refilled += wave.fanoutCount;
    }
  }

  return { timedOut: expiredClaims.length, refilled, escalated };
}

/** Escalate a beacon to the admin residual queue. Idempotent. */
export async function escalateToAdmin(beaconId: string): Promise<void> {
  const existing = await supabaseAdmin
    .from("hammerex_beacon_admin_residuals")
    .select("id")
    .eq("beacon_id", beaconId)
    .maybeSingle();
  if (existing.data) return;

  // Close the beacon
  await supabaseAdmin
    .from("hammerex_xrated_project_beacons")
    .update({ status: "admin_residual", admin_residual: true, closed_at: new Date().toISOString() })
    .eq("id", beaconId);

  // Generate a bait link slug — 10 chars url-safe base36
  const baitSlug = Math.random().toString(36).slice(2, 12);

  await supabaseAdmin
    .from("hammerex_beacon_admin_residuals")
    .insert({
      beacon_id:       beaconId,
      outreach_status: "pending",
      bait_link_slug:  baitSlug
    });
}

/** Record a Tier-2 conversion event (washer topup or WhatsApp add
 *  triggered by a beacon nudge). Used for analytics. */
export async function recordConversion(input: {
  beaconId:     string;
  merchantSlug: string;
  eventType:    "washer_topup" | "whatsapp_added";
  meta?:        Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("hammerex_beacon_conversion_events").insert({
    beacon_id:     input.beaconId,
    merchant_slug: input.merchantSlug,
    event_type:    input.eventType,
    meta:          input.meta ?? {}
  });
}
