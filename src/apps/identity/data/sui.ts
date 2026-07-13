// Single User Identity (SUI) — the unified identity model that makes
// Trade Center + The Network + Canteen + Yard + Counter behave as ONE
// product for the user.
//
// Before SUI: identity was scattered across
//   - identity/tradeIdentities.ts    (trade-side, R07 8-layer credential)
//   - marketplace/data/merchants.ts   (merchant-side, product listings)
//   - trades/data/tradeProfiles.ts    (customer-facing bio + gallery)
//   - trade-off/lib/users.ts          (Network-side, older codebase)
// Same person, four records. Fill four times.
//
// After SUI: one canonical `Sui` record per user, spread across capability
// blocks (identity / merchant / tradePublic / social / preferences).
// Every area reads from SUI, no re-typing.
//
// This module is INTENTIONALLY a thin resolver layer for now. It reads
// from the existing scattered fixtures and returns the unified shape.
// Migration path: over time, the fixtures collapse INTO SUI as the
// canonical source, and the shims disappear.

import { findTradeIdentity, TRADE_IDENTITY_FIXTURES, currentViewerTrade, type VerifiedTradeIdentity, countVerifiedLayers } from "./tradeIdentities";
import { findMerchant, MERCHANT_FIXTURES, type MarketplaceMerchant } from "@/apps/marketplace/data/merchants";
import { findTradeProfile, type TradePublicProfile } from "@/apps/trades/data/tradeProfiles";
import { BASE_FOLLOWER_COUNTS, BASE_FOLLOWING_COUNTS } from "@/apps/social/data/socialGraph";

// ─── The SUI type ─────────────────────────────────────────────────────

export type SuiRoleKey =
  | "trade"           // R07 Verified Trade Identity holder
  | "merchant"        // Sells on the marketplace
  | "customer"        // Buys / hires
  | "employee";       // On a merchant's team

export type SuiContact = {
  emailPrimary?: string;
  phoneE164?: string;
  whatsappE164?: string;
  whatsappExposedOnProfile?: boolean;
};

export type Sui = {
  /** Canonical slug — used everywhere. Same slug across every area. */
  slug: string;
  /** Roles this user holds. Multiple allowed — many merchants ARE trades. */
  roles: SuiRoleKey[];
  displayName: string;
  legalName?: string;
  headshotInitials: string;
  logoImageUrl?: string;
  homeCity: string;
  memberSinceIso: string;

  /** Trade capability (from R07 if role includes "trade"). */
  trade?: {
    identity: VerifiedTradeIdentity;
    publicProfile?: TradePublicProfile;
    verifiedLayerCount: number;
  };

  /** Merchant capability (from marketplace/data/merchants.ts if role includes "merchant"). */
  merchant?: MarketplaceMerchant;

  /** Contact — one source of truth, referenced by every composer + form. */
  contact: SuiContact;

  /** Social graph derived stats. */
  social: {
    followerCount: number;
    followingCount: number;
  };
};

// ─── Resolvers ───────────────────────────────────────────────────────

/**
 * Assemble a canonical SUI record for a slug. Reads from every source
 * that has data for this slug. Returns undefined if the slug doesn't
 * exist in any store.
 */
export function resolveSui(slug: string): Sui | undefined {
  const identity = findTradeIdentity(slug);
  const merchant = findMerchant(slug);
  const publicProfile = findTradeProfile(slug);

  if (!identity && !merchant) return undefined;

  const roles: SuiRoleKey[] = [];
  if (identity) roles.push("trade");
  if (merchant) roles.push("merchant");

  const displayName = identity?.displayName ?? merchant?.displayName ?? slug;
  const legalName = identity?.legalName ?? merchant?.legalName;
  const homeCity = identity?.homeCity ?? merchant?.homeCity ?? "";
  const memberSinceIso =
    identity?.memberSinceIso ??
    merchant?.memberSinceIso ??
    new Date().toISOString();
  const headshotInitials =
    identity?.headshotInitials ?? merchant?.logoInitials ?? slug.slice(0, 2).toUpperCase();
  const logoImageUrl = merchant?.logoImageUrl;

  return {
    slug,
    roles,
    displayName,
    legalName,
    headshotInitials,
    logoImageUrl,
    homeCity,
    memberSinceIso,
    trade: identity
      ? {
          identity,
          publicProfile,
          verifiedLayerCount: countVerifiedLayers(identity)
        }
      : undefined,
    merchant,
    contact: {
      // Contact fixtures are sparse today; will populate as SUI becomes canonical.
      emailPrimary: undefined,
      phoneE164: undefined,
      whatsappE164: undefined,
      whatsappExposedOnProfile: false
    },
    social: {
      followerCount: BASE_FOLLOWER_COUNTS[slug] ?? 0,
      followingCount: BASE_FOLLOWING_COUNTS[slug] ?? 0
    }
  };
}

/**
 * The current viewer as SUI. Bridges the older `currentViewerTrade()`
 * shim so every new component can consume the canonical shape.
 */
export function currentViewerSui(): Sui {
  const trade = currentViewerTrade();
  const sui = resolveSui(trade.slug);
  if (!sui) {
    // Fallback — should never happen but avoids a hard crash if the
    // demo fixtures desync.
    return {
      slug: trade.slug,
      roles: ["trade"],
      displayName: trade.displayName,
      legalName: trade.legalName,
      headshotInitials: trade.headshotInitials,
      homeCity: trade.homeCity,
      memberSinceIso: trade.memberSinceIso,
      trade: {
        identity: trade,
        verifiedLayerCount: countVerifiedLayers(trade)
      },
      contact: {},
      social: { followerCount: 0, followingCount: 0 }
    };
  }
  return sui;
}

/**
 * List every SUI record in the system — used for directories, feed
 * pop-ins, and admin surfaces.
 */
export function allSuiRecords(): Sui[] {
  const seen = new Set<string>();
  const out: Sui[] = [];

  for (const t of TRADE_IDENTITY_FIXTURES) {
    if (seen.has(t.slug)) continue;
    const rec = resolveSui(t.slug);
    if (rec) {
      seen.add(t.slug);
      out.push(rec);
    }
  }
  for (const m of MERCHANT_FIXTURES) {
    if (seen.has(m.slug)) continue;
    const rec = resolveSui(m.slug);
    if (rec) {
      seen.add(m.slug);
      out.push(rec);
    }
  }
  return out;
}

/**
 * Given any SUI record, return the correct destination URL for their
 * "profile" — trade profile if trade, merchant page if merchant only.
 */
export function suiProfileHref(sui: Sui): string {
  if (sui.roles.includes("trade")) return `/tc/trade/${sui.slug}`;
  if (sui.roles.includes("merchant")) return `/tc/trade-center/merchant/${sui.slug}`;
  return `/tc/hub`;
}

/**
 * Composer prefill: given a SUI record + a composer type, return the
 * fields the composer can auto-populate. Used by every composer type
 * so the trade never re-types their own basics.
 */
export function suiComposerPrefill(sui: Sui): Record<string, string> {
  const p: Record<string, string> = {
    authorSlug: sui.slug,
    authorName: sui.displayName,
    authorInitials: sui.headshotInitials,
    homeCity: sui.homeCity
  };
  if (sui.merchant) p.merchantSlug = sui.merchant.slug;
  if (sui.trade) p.tradeSlug = sui.trade.identity.slug;
  return p;
}
