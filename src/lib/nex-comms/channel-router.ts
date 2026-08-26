// src/lib/nex-comms/channel-router.ts
//
// CHANNEL ROUTER · free-first tier selection.
//
// Doctrine: NEX-owned channels (in-app · web · inbox) preferred where they
// are legitimately available for the category and the contact has them.
// Paid channels used only when the message cannot be delivered another way.
//
// The router NEVER invents that a contact "has in-app". Availability is
// declared explicitly by the caller. When no permitted channel is available
// the router returns NO_CHANNEL_AVAILABLE rather than defaulting to WhatsApp.

import type { CommsChannel, CommsCategory, CommsContact } from "./types";

const TIER: Record<CommsChannel, 0 | 1 | 2 | 3> = {
  nex_in_app: 0,
  nex_web: 0,
  nex_inbox: 0,
  email: 1,
  push_notification: 1,
  whatsapp: 2,
  sms: 3,
  voice_call: 3,
};

/**
 * Channels a category may legitimately use. Recruitment intentionally
 * cannot use nex_in_app / push_notification because a discovered candidate
 * does not have a NEX app installed.
 */
const CATEGORY_ELIGIBLE_CHANNELS: Record<CommsCategory, readonly CommsChannel[]> = {
  transactional:    ["nex_in_app", "nex_web", "nex_inbox", "email", "push_notification", "whatsapp", "sms"] as const,
  service:          ["nex_in_app", "nex_web", "nex_inbox", "email", "push_notification", "whatsapp"] as const,
  support:          ["nex_in_app", "nex_web", "nex_inbox", "email", "whatsapp"] as const,
  verification:     ["nex_in_app", "email", "whatsapp", "sms"] as const,
  security:         ["nex_in_app", "email", "sms"] as const,
  notification:     ["nex_in_app", "nex_web", "push_notification", "email"] as const,
  booking:          ["nex_in_app", "nex_web", "email", "whatsapp"] as const,
  transport:        ["nex_in_app", "nex_web", "email", "whatsapp"] as const,
  business_enquiry: ["email", "whatsapp"] as const,
  recruitment:      ["whatsapp", "email"] as const,
  marketing:        ["nex_in_app", "nex_web", "email"] as const,   // marketing NEVER via WhatsApp/SMS in this router
};

export interface CandidateChannelAvailability {
  channel: CommsChannel;
  costHintIdr: number | null;   // per-message cost hint · null = unknown
  available: boolean;
  reason?: string;              // why it's unavailable
}

export interface ChannelRouteInput {
  contact: CommsContact;
  category: CommsCategory;
  preferredChannels?: CommsChannel[];   // caller preference · router may downgrade to a cheaper tier
  cheaperChannelSwapAllowed?: boolean;  // default true
  availabilities: CandidateChannelAvailability[];   // caller declares which channels are actually available for this contact
}

export interface ChannelRouteOK {
  status: "ROUTED";
  chosenChannel: CommsChannel;
  chosenTier: 0 | 1 | 2 | 3;
  costHintIdr: number | null;
  route: string;
}

export interface ChannelRouteRefused {
  status: "NO_CHANNEL_AVAILABLE";
  detail: string;
}

export type ChannelRouteResult = ChannelRouteOK | ChannelRouteRefused;

export function routeChannel(input: ChannelRouteInput): ChannelRouteResult {
  const eligibleForCategory = new Set<CommsChannel>(CATEGORY_ELIGIBLE_CHANNELS[input.category]);
  const swapAllowed = input.cheaperChannelSwapAllowed ?? true;

  const candidates = input.availabilities.filter(
    (a) => a.available && eligibleForCategory.has(a.channel),
  );

  if (candidates.length === 0) {
    return {
      status: "NO_CHANNEL_AVAILABLE",
      detail: `No available channels for category '${input.category}'. Eligible: ${[...eligibleForCategory].join(", ")}.`,
    };
  }

  // If caller has a preferred channel that is available + eligible + is at the
  // cheapest tier available, honour it. Otherwise route to the cheapest tier.
  const cheapestTier = Math.min(...candidates.map((c) => TIER[c.channel])) as 0 | 1 | 2 | 3;

  // Honour caller preference only when they are already asking for the cheapest tier
  // OR they have explicitly disabled cheaper-channel swapping.
  if (input.preferredChannels && input.preferredChannels.length > 0) {
    for (const p of input.preferredChannels) {
      const match = candidates.find((c) => c.channel === p);
      if (match) {
        if (!swapAllowed || TIER[match.channel] === cheapestTier) {
          return {
            status: "ROUTED",
            chosenChannel: match.channel,
            chosenTier: TIER[match.channel],
            costHintIdr: match.costHintIdr,
            route: swapAllowed
              ? `preferred channel '${match.channel}' at cheapest tier ${TIER[match.channel]}`
              : `preferred channel '${match.channel}' at tier ${TIER[match.channel]} (swap disabled by caller)`,
          };
        }
        // preferred channel exists but a cheaper tier is available and swap is on · fall through
        break;
      }
    }
  }

  // Pick the cheapest-tier candidate · deterministic tiebreak by channel name
  const cheapest = candidates
    .filter((c) => TIER[c.channel] === cheapestTier)
    .sort((a, b) => a.channel.localeCompare(b.channel))[0];

  return {
    status: "ROUTED",
    chosenChannel: cheapest.channel,
    chosenTier: TIER[cheapest.channel],
    costHintIdr: cheapest.costHintIdr,
    route: `free-first routing selected '${cheapest.channel}' at tier ${TIER[cheapest.channel]}`,
  };
}
