// NEX Marketing Attribution · read-only computation over tracking + contacts
//
// DOCTRINE
// Attribution correlates session_id + utm_campaign + conversion events into
// per-campaign performance data · resolves first-touch and last-touch models
// per contact · exposes funnel counts across the visit journey.
//
// This service is READ-ONLY over existing stores (`nex-tracking` + `nex-contacts`).
// No new persistence. Every computation is deterministic given the current data.
//
// MODELS SUPPORTED
//   first_touch  — the earliest UTM captured in a contact's session history
//   last_touch   — the latest UTM captured before a conversion event
//   all_touches  — full ordered chain (for multi-touch weighting downstream)
//
// GDPR
// Nothing sensitive leaves the process boundary. Attribution rolls up
// counts + campaign names · never raw fingerprints or IPs.

import { listEvents, type TrackingEvent } from "../tracking/fs-store";

// ── Types ─────────────────────────────────────────────────────────

export type Touch = {
  campaign: string | null;
  source: string | null;
  medium: string | null;
  path: string | null;
  event_name: string;
  occurred_at: string;
};

export type CampaignReport = {
  campaign: string;
  sources: string[];
  mediums: string[];
  sessions: number;
  page_views: number;
  form_submits: number;
  conversions: number;
  contacts_acquired: number;             // contacts whose first touch = this campaign
  conversion_rate_pct: number;           // conversions / sessions * 100
  first_seen: string;
  last_seen: string;
};

export type ContactAttribution = {
  contact_id: string;
  first_touch: Touch | null;
  last_touch: Touch | null;              // last touch before final conversion (or overall latest)
  all_touches: Touch[];
  sessions: string[];
  converted: boolean;
  conversion_at: string | null;
};

export type FunnelReport = {
  window_hours: number;
  visitors: number;                      // unique fingerprints
  sessions: number;
  page_viewers: number;                  // sessions with ≥1 page_view
  engagers: number;                      // sessions with ≥1 click OR ≥1 scroll_depth
  form_viewers: number;                  // sessions with ≥1 form_view
  form_submitters: number;               // sessions with ≥1 form_submit
  converters: number;                    // sessions with ≥1 conversion
  contacts_touched: number;              // sessions with contact_id linked
  conversion_rate_pct: number;           // converters / sessions * 100
};

// ── Helpers ───────────────────────────────────────────────────────

function toTouch(e: TrackingEvent): Touch {
  return {
    campaign: e.utm_campaign,
    source: e.utm_source,
    medium: e.utm_medium,
    path: e.path,
    event_name: e.event_name,
    occurred_at: e.occurred_at,
  };
}

function hasCampaign(e: TrackingEvent): boolean {
  return Boolean(e.utm_campaign || e.utm_source || e.utm_medium);
}

// ── Campaign roll-up ──────────────────────────────────────────────

export async function campaignReport(sinceMs: number = 30 * 24 * 60 * 60 * 1000): Promise<CampaignReport[]> {
  const events = await listEvents({ limit: 10000, since_ms: sinceMs });

  type Acc = {
    campaign: string;
    sources: Set<string>;
    mediums: Set<string>;
    sessions: Set<string>;
    page_views: number;
    form_submits: number;
    conversions: number;
    first_seen: string;
    last_seen: string;
  };
  const byCampaign = new Map<string, Acc>();

  // First-touch acquisition per fingerprint · which campaign brought them in?
  const firstTouchByFp = new Map<string, TrackingEvent>();
  for (const e of events) {
    if (!hasCampaign(e)) continue;
    const prev = firstTouchByFp.get(e.fingerprint);
    if (!prev || e.occurred_at < prev.occurred_at) firstTouchByFp.set(e.fingerprint, e);
  }

  for (const e of events) {
    const campaign = e.utm_campaign ?? "(no campaign)";
    let a = byCampaign.get(campaign);
    if (!a) {
      a = {
        campaign,
        sources: new Set(),
        mediums: new Set(),
        sessions: new Set(),
        page_views: 0,
        form_submits: 0,
        conversions: 0,
        first_seen: e.occurred_at,
        last_seen: e.occurred_at,
      };
      byCampaign.set(campaign, a);
    }
    if (e.utm_source) a.sources.add(e.utm_source);
    if (e.utm_medium) a.mediums.add(e.utm_medium);
    a.sessions.add(e.session_id);
    if (e.event_name === "page_view") a.page_views += 1;
    if (e.event_name === "form_submit") a.form_submits += 1;
    if (e.event_name === "conversion") a.conversions += 1;
    if (e.occurred_at < a.first_seen) a.first_seen = e.occurred_at;
    if (e.occurred_at > a.last_seen) a.last_seen = e.occurred_at;
  }

  // Attribute contacts_acquired per campaign via first-touch fingerprint mapping.
  const contactsByCampaign = new Map<string, Set<string>>();
  for (const [fp, firstTouch] of firstTouchByFp) {
    // A contact_id observed in ANY event with this fingerprint counts as acquired.
    const eventsWithContactForFp = events.filter((e) => e.fingerprint === fp && e.contact_id);
    if (eventsWithContactForFp.length === 0) continue;
    const campaign = firstTouch.utm_campaign ?? "(no campaign)";
    const set = contactsByCampaign.get(campaign) ?? new Set<string>();
    for (const e of eventsWithContactForFp) if (e.contact_id) set.add(e.contact_id);
    contactsByCampaign.set(campaign, set);
  }

  const out: CampaignReport[] = [];
  for (const [campaign, a] of byCampaign) {
    const contactsSet = contactsByCampaign.get(campaign) ?? new Set<string>();
    out.push({
      campaign,
      sources: [...a.sources].sort(),
      mediums: [...a.mediums].sort(),
      sessions: a.sessions.size,
      page_views: a.page_views,
      form_submits: a.form_submits,
      conversions: a.conversions,
      contacts_acquired: contactsSet.size,
      conversion_rate_pct: a.sessions.size > 0
        ? Math.round((a.conversions / a.sessions.size) * 1000) / 10
        : 0,
      first_seen: a.first_seen,
      last_seen: a.last_seen,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions);
}

// ── Contact attribution chain ─────────────────────────────────────

export async function contactAttribution(contact_id: string, sinceMs = 90 * 24 * 60 * 60 * 1000): Promise<ContactAttribution> {
  const events = await listEvents({ contact_id, limit: 10000, since_ms: sinceMs });
  const chain = events
    .slice()
    .sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1))
    .filter((e) => hasCampaign(e) || e.event_name === "conversion");
  const conversion = chain.find((e) => e.event_name === "conversion") ?? null;
  const sessions = [...new Set(events.map((e) => e.session_id))];
  const firstCampaigned = chain.find((e) => hasCampaign(e)) ?? null;

  let lastTouch: Touch | null = null;
  if (conversion) {
    // Latest campaigned event BEFORE the conversion.
    const beforeConversion = chain.filter((e) => hasCampaign(e) && e.occurred_at <= conversion.occurred_at);
    if (beforeConversion.length > 0) lastTouch = toTouch(beforeConversion[beforeConversion.length - 1]);
  } else {
    // Fallback · latest campaigned event overall.
    const campaigned = chain.filter((e) => hasCampaign(e));
    if (campaigned.length > 0) lastTouch = toTouch(campaigned[campaigned.length - 1]);
  }

  return {
    contact_id,
    first_touch: firstCampaigned ? toTouch(firstCampaigned) : null,
    last_touch: lastTouch,
    all_touches: chain.filter((e) => hasCampaign(e)).map(toTouch),
    sessions,
    converted: Boolean(conversion),
    conversion_at: conversion?.occurred_at ?? null,
  };
}

// ── Funnel · overall visit journey ────────────────────────────────

export async function funnelReport(sinceMs: number = 24 * 60 * 60 * 1000): Promise<FunnelReport> {
  const events = await listEvents({ limit: 20000, since_ms: sinceMs });
  const visitors = new Set<string>();
  const sessionsSet = new Set<string>();
  const pageViewSessions = new Set<string>();
  const engageSessions = new Set<string>();
  const formViewSessions = new Set<string>();
  const formSubmitSessions = new Set<string>();
  const convertSessions = new Set<string>();
  const contactSessions = new Set<string>();

  for (const e of events) {
    visitors.add(e.fingerprint);
    sessionsSet.add(e.session_id);
    if (e.event_name === "page_view") pageViewSessions.add(e.session_id);
    if (e.event_name === "click" || e.event_name === "scroll_depth") engageSessions.add(e.session_id);
    if (e.event_name === "form_view") formViewSessions.add(e.session_id);
    if (e.event_name === "form_submit") formSubmitSessions.add(e.session_id);
    if (e.event_name === "conversion") convertSessions.add(e.session_id);
    if (e.contact_id) contactSessions.add(e.session_id);
  }

  const sessions = sessionsSet.size;
  return {
    window_hours: Math.round(sinceMs / (60 * 60 * 1000)),
    visitors: visitors.size,
    sessions,
    page_viewers: pageViewSessions.size,
    engagers: engageSessions.size,
    form_viewers: formViewSessions.size,
    form_submitters: formSubmitSessions.size,
    converters: convertSessions.size,
    contacts_touched: contactSessions.size,
    conversion_rate_pct: sessions > 0
      ? Math.round((convertSessions.size / sessions) * 1000) / 10
      : 0,
  };
}
