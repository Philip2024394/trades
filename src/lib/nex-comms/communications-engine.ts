// src/lib/nex-comms/communications-engine.ts
//
// COMMUNICATIONS ENGINE · orchestrator.
//
// Order of evaluation (SHORT-CIRCUITS on the first REFUSE):
//   1. Idempotency (duplicate detection)
//   2. Permission (category × basis + campaign approval)
//   3. Suppression (global · cross-domain)
//   4. Rate limits (per-contact + per-campaign + global + cooldown)
//   5. Channel router (free-first tier selection)
//   6. Kill-switch check for real outbound
//   7. Provider dispatch
//
// Returns a DecisionResult that traces exactly why a send happened or did not.

import type {
  CommsSendRequest,
  CommsSuppressionRow,
  CommsChannel,
} from "./types";
import type { CommsProvider, ProviderSendResult } from "./providers/types";
import { realOutboundPermitted } from "./providers/mock-provider";
import { checkIdempotency } from "./idempotency";
import { checkPermission } from "./permission";
import { evaluateSuppression } from "./suppression";
import { evaluateRate, DEFAULT_LIMITS, type RateHistorySlice, type RateLimits } from "./rate-limiter";
import { routeChannel, type CandidateChannelAvailability } from "./channel-router";

export type EngineDecisionStep =
  | "idempotency"
  | "permission"
  | "suppression"
  | "rate"
  | "route"
  | "kill_switch"
  | "provider";

export interface EngineOK {
  status: "SENT" | "DUPLICATE_RETURNED";
  chosenChannel: CommsChannel;
  chosenTier: number;
  providerName: string;
  providerResult?: ProviderSendResult;
  existingMessageId?: string;
  auditTrail: { step: EngineDecisionStep; note: string }[];
}

export interface EngineRefused {
  status: "REFUSED";
  refusedAt: EngineDecisionStep;
  reason: string;
  auditTrail: { step: EngineDecisionStep; note: string }[];
}

export type EngineResult = EngineOK | EngineRefused;

export interface EngineContext {
  provider: CommsProvider;
  existingMessageForIdempotencyKey: {
    messageId: string;
    createdAt: Date;
    status: string;
  } | null;
  suppressions: CommsSuppressionRow[];
  rateHistory: RateHistorySlice;
  rateLimits?: RateLimits;
  channelAvailabilities: CandidateChannelAvailability[];
  now: Date;
}

export async function evaluateAndSend(
  request: CommsSendRequest,
  ctx: EngineContext,
): Promise<EngineResult> {
  const trail: { step: EngineDecisionStep; note: string }[] = [];

  // 1. Idempotency
  const idem = checkIdempotency({
    idempotencyKey: request.idempotencyKey,
    existingMessageForKey: ctx.existingMessageForIdempotencyKey,
  });
  if (idem.status === "REFUSED") {
    return refused(trail, "idempotency", `${idem.reason}: ${idem.detail}`);
  }
  if (idem.status === "DUPLICATE") {
    trail.push({ step: "idempotency", note: `duplicate · returning existing message ${idem.existingMessageId}` });
    return {
      status: "DUPLICATE_RETURNED",
      chosenChannel: "nex_inbox",   // placeholder · the existing message carries the actual channel
      chosenTier: 0,
      providerName: ctx.provider.name,
      existingMessageId: idem.existingMessageId,
      auditTrail: trail,
    };
  }
  trail.push({ step: "idempotency", note: `new key '${idem.idempotencyKey}'` });

  // 2. Permission
  const perm = checkPermission({
    category: request.category,
    basis: request.permissionBasis,
    campaign: request.campaign,
  });
  if (perm.status === "REFUSED") {
    trail.push({ step: "permission", note: `${perm.reason}: ${perm.detail}` });
    return refused(trail, "permission", `${perm.reason}: ${perm.detail}`);
  }
  trail.push({ step: "permission", note: perm.note });

  // 3. Suppression
  const supp = evaluateSuppression({
    contactId: request.contact.contactId,
    category: request.category,
    now: ctx.now,
    suppressions: ctx.suppressions,
  });
  if (supp.suppressed) {
    trail.push({ step: "suppression", note: supp.reason });
    return refused(trail, "suppression", supp.reason);
  }
  trail.push({ step: "suppression", note: "no suppression applies" });

  // 4. Rate + cooldown
  const rate = evaluateRate(ctx.rateHistory, ctx.rateLimits ?? DEFAULT_LIMITS);
  if (rate.status === "REFUSED") {
    trail.push({ step: "rate", note: `${rate.reason}: ${rate.detail}` });
    return refused(trail, "rate", `${rate.reason}: ${rate.detail}`);
  }
  trail.push({ step: "rate", note: rate.reason });

  // 5. Channel routing (free-first)
  const route = routeChannel({
    contact: request.contact,
    category: request.category,
    preferredChannels: request.preferredChannels,
    cheaperChannelSwapAllowed: request.cheaperChannelSwapAllowed,
    availabilities: ctx.channelAvailabilities,
  });
  if (route.status === "NO_CHANNEL_AVAILABLE") {
    trail.push({ step: "route", note: route.detail });
    return refused(trail, "route", route.detail);
  }
  trail.push({ step: "route", note: route.route });

  // 6. Kill-switch check for real outbound (mock provider is always allowed)
  if (ctx.provider.name !== "mock") {
    const gate = realOutboundPermitted(route.chosenChannel);
    if (!gate.ok) {
      trail.push({ step: "kill_switch", note: gate.reason ?? "real outbound refused" });
      return refused(trail, "kill_switch", gate.reason ?? "real outbound refused");
    }
    trail.push({ step: "kill_switch", note: "real outbound gate passed" });
  } else {
    trail.push({ step: "kill_switch", note: "mock provider · always permitted" });
  }

  // 7. Provider dispatch
  const providerResult = await ctx.provider.send({
    provider: ctx.provider.name,
    messageId: request.idempotencyKey,
    channel: route.chosenChannel,
    recipient: {
      canonicalPhoneE164: request.contact.canonicalPhoneE164,
      email: request.contact.email,
      deviceRef: request.contact.inAppUserRef,
    },
    content: {
      text: request.content.text,
      mediaRef: request.content.mediaRef,
      parameters: request.content.parameters,
    },
    correlationId: request.correlationId,
  });

  if (providerResult.status === "REFUSED") {
    trail.push({ step: "provider", note: `${providerResult.reason}: ${providerResult.detail}` });
    return refused(trail, "provider", `${providerResult.reason}: ${providerResult.detail}`);
  }

  trail.push({ step: "provider", note: `provider '${ctx.provider.name}' accepted · id=${providerResult.providerMessageId}` });

  return {
    status: "SENT",
    chosenChannel: route.chosenChannel,
    chosenTier: route.chosenTier,
    providerName: ctx.provider.name,
    providerResult,
    auditTrail: trail,
  };
}

function refused(
  trail: { step: EngineDecisionStep; note: string }[],
  step: EngineDecisionStep,
  reason: string,
): EngineRefused {
  return { status: "REFUSED", refusedAt: step, reason, auditTrail: trail };
}
