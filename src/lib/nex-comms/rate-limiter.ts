// src/lib/nex-comms/rate-limiter.ts
//
// RATE LIMITER · pure. Callers supply the recent-history slice · the limiter
// evaluates it against configured limits and returns ALLOW / REFUSE.
//
// Three limit scopes:
//   - per-contact daily (per category)
//   - per-campaign daily (across all contacts in the campaign)
//   - global daily (across all NEX outbound)

import type { CommsCategory } from "./types";

export interface RateLimits {
  perContactPerDayByCategory: Partial<Record<CommsCategory, number>>;
  perContactPerDayTotal: number;
  perCampaignPerDay?: number;
  globalPerDay?: number;
  perContactMinCooldownSeconds?: Partial<Record<CommsCategory, number>>;
}

export const DEFAULT_LIMITS: RateLimits = {
  perContactPerDayByCategory: {
    recruitment: 1,
    marketing: 1,
    notification: 3,
    transactional: 10,
    service: 10,
    support: 10,
    verification: 5,
    security: 5,
    booking: 20,
    transport: 20,
    business_enquiry: 3,
  },
  perContactPerDayTotal: 10,
  perCampaignPerDay: 500,
  globalPerDay: 10000,
  perContactMinCooldownSeconds: {
    recruitment: 60 * 60 * 24 * 7,   // 7-day cooldown between recruitment sends
    marketing: 60 * 60 * 24 * 7,     // 7-day cooldown between marketing sends
  },
};

export interface RateHistorySlice {
  now: Date;
  contactId: string;
  category: CommsCategory;
  campaignId?: string | null;
  perContactSameDayCount: number;                // count of messages to this contact today (any category)
  perContactSameDayCountThisCategory: number;    // count today in this category
  perCampaignSameDayCount: number;               // count in this campaign today
  globalSameDayCount: number;                    // count globally today
  lastSendToContactThisCategoryAt: Date | null;
}

export interface RateAllowed {
  status: "ALLOWED";
  reason: string;
}

export interface RateRefused {
  status: "REFUSED";
  reason:
    | "PER_CONTACT_CATEGORY_LIMIT"
    | "PER_CONTACT_TOTAL_LIMIT"
    | "PER_CAMPAIGN_LIMIT"
    | "GLOBAL_LIMIT"
    | "COOLDOWN_ACTIVE";
  detail: string;
}

export type RateDecision = RateAllowed | RateRefused;

export function evaluateRate(history: RateHistorySlice, limits: RateLimits = DEFAULT_LIMITS): RateDecision {
  const catLimit = limits.perContactPerDayByCategory[history.category];
  if (catLimit != null && history.perContactSameDayCountThisCategory >= catLimit) {
    return {
      status: "REFUSED",
      reason: "PER_CONTACT_CATEGORY_LIMIT",
      detail: `${history.category} limit ${catLimit}/day per contact reached (current=${history.perContactSameDayCountThisCategory}).`,
    };
  }

  if (history.perContactSameDayCount >= limits.perContactPerDayTotal) {
    return {
      status: "REFUSED",
      reason: "PER_CONTACT_TOTAL_LIMIT",
      detail: `Per-contact daily limit ${limits.perContactPerDayTotal} reached (current=${history.perContactSameDayCount}).`,
    };
  }

  if (
    limits.perCampaignPerDay != null &&
    history.campaignId &&
    history.perCampaignSameDayCount >= limits.perCampaignPerDay
  ) {
    return {
      status: "REFUSED",
      reason: "PER_CAMPAIGN_LIMIT",
      detail: `Campaign daily limit ${limits.perCampaignPerDay} reached (current=${history.perCampaignSameDayCount}).`,
    };
  }

  if (limits.globalPerDay != null && history.globalSameDayCount >= limits.globalPerDay) {
    return {
      status: "REFUSED",
      reason: "GLOBAL_LIMIT",
      detail: `Global daily limit ${limits.globalPerDay} reached (current=${history.globalSameDayCount}).`,
    };
  }

  const cooldown = limits.perContactMinCooldownSeconds?.[history.category];
  if (cooldown && history.lastSendToContactThisCategoryAt) {
    const secondsSince = (history.now.getTime() - history.lastSendToContactThisCategoryAt.getTime()) / 1000;
    if (secondsSince < cooldown) {
      return {
        status: "REFUSED",
        reason: "COOLDOWN_ACTIVE",
        detail: `${history.category} cooldown ${cooldown}s not elapsed (only ${Math.round(secondsSince)}s since last send).`,
      };
    }
  }

  return { status: "ALLOWED", reason: "within all configured limits" };
}
