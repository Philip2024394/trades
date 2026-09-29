// src/lib/nex-native/intelligence/account-context-retriever.ts
//
// Bridge 92 · Authorised account-context retrieval for the gateway.
// -------------------------------------------------------------------
// When a user asks entitlement-aware questions ("what does my plan
// include?", "which features do I have access to?", "why can't I use
// this theme?"), the gateway needs the user's REAL tier and plan
// from nex_account · never the model's guess.
//
// Doctrine constraints:
//   · The gateway operates on business-customer conversations. The
//     "user" here is the CUSTOMER account · not the business owner.
//   · We fetch only the fields required to answer entitlement +
//     expiry questions · nothing else · minimum-necessary data.
//   · The result is emitted as an EvidenceItem so it merges naturally
//     with business + product evidence in the gateway.
//   · Never emitted for anonymous/visitor conversations (returns empty).
//   · Never contains personal contact info (phone, email).

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import {
  planEntryForSubscription,
} from "./product-knowledge";
import type { EvidenceItem } from "./business-evidence-retriever";
import type {
  NexAccountTier,
  NexSubscriptionPlan,
  NexTimestamp,
  NexUuid,
} from "../types";

export interface AccountContextResult {
  items: EvidenceItem[];
  tier: NexAccountTier | null;
  plan: NexSubscriptionPlan | null;
  bisnis_expires_at: NexTimestamp | null;
  trial_active: boolean;
}

interface AccountRowSlice {
  id: NexUuid;
  display_name: string;
  tier: NexAccountTier;
  subscription_plan: NexSubscriptionPlan | null;
  bisnis_expires_at: NexTimestamp | null;
  themes_trial_used_at: NexTimestamp | null;
}

const TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Fetch minimum-necessary tier/plan context for one customer account.
 *  Emits ONE EvidenceItem that describes the account's authoritative
 *  plan state. Returns an empty items array when the caller is
 *  anonymous or the account row can't be resolved. */
export async function retrieveAccountContext(opts: {
  accountId: NexUuid | null;
}): Promise<AccountContextResult> {
  if (!opts.accountId) {
    return {
      items: [], tier: null, plan: null,
      bisnis_expires_at: null, trial_active: false,
    };
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select(
      "id, display_name, tier, subscription_plan, bisnis_expires_at, themes_trial_used_at",
    )
    .eq("id", opts.accountId)
    .maybeSingle();
  if (error || !data) {
    return {
      items: [], tier: null, plan: null,
      bisnis_expires_at: null, trial_active: false,
    };
  }
  const acc = data as AccountRowSlice;

  // Effective tier · lazy check bisnis_expires_at so a lapsed
  // subscription is treated as gratis on the reply.
  const now = Date.now();
  const expiresAtMs = acc.bisnis_expires_at
    ? new Date(acc.bisnis_expires_at).getTime()
    : null;
  const isLapsed =
    (acc.tier === "bisnis" || acc.tier === "pro") &&
    expiresAtMs !== null &&
    expiresAtMs < now;
  const effectiveTier: NexAccountTier = isLapsed ? "gratis" : acc.tier;

  // Trial · themes_trial_used_at + 7 days
  const trialAt = acc.themes_trial_used_at
    ? new Date(acc.themes_trial_used_at).getTime()
    : null;
  const trialActive =
    trialAt !== null && now - trialAt < TRIAL_WINDOW_MS;

  // Lookup the authoritative plan entry from the catalogue for
  // freshness · this is where product-knowledge integration matters.
  const planEntry = planEntryForSubscription(
    acc.subscription_plan,
    effectiveTier,
  );

  // Compose a single EvidenceItem the gateway can drop into its
  // bundle. Everything here is derived from the authoritative
  // nex_account row + versioned product catalogue.
  const parts: string[] = [];
  parts.push(`Account: ${acc.display_name}`);
  parts.push(`Current plan: ${planEntry?.title ?? "unknown"}`);
  if (acc.bisnis_expires_at && !isLapsed) {
    parts.push(
      `Renews: ${new Date(acc.bisnis_expires_at).toISOString().slice(0, 10)}`,
    );
  }
  if (isLapsed) {
    parts.push("Note: Bisnis subscription has lapsed · effective tier is Gratis.");
  }
  if (trialActive && trialAt) {
    const expiresAtIso = new Date(trialAt + TRIAL_WINDOW_MS).toISOString().slice(0, 10);
    parts.push(`Themes trial active until ${expiresAtIso}.`);
  } else if (acc.themes_trial_used_at) {
    parts.push("Themes trial already used · one-time only.");
  } else {
    parts.push("Themes trial not yet used · eligible for 7-day free trial.");
  }

  const item: EvidenceItem = {
    id: `account.${acc.id}.plan_context`,
    provenance: "business", // reuse existing provenance enum · closest fit
    source_id: acc.id,
    updated_at: new Date().toISOString(),
    title: "Your current NEX plan",
    content: parts.join(" · "),
    score: 0.6, // moderate boost · this is authoritative account state
    figures: [],
    urls: [],
  };

  return {
    items: [item],
    tier: effectiveTier,
    plan: acc.subscription_plan,
    bisnis_expires_at: acc.bisnis_expires_at,
    trial_active: trialActive,
  };
}
