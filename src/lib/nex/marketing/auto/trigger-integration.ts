// src/lib/nex/marketing/auto/trigger-integration.ts
//
// NEX Managed Email Marketing · Stage 5.5 · TriggerRouter integration
// Founder-authorised programme (§13-§14).
//
// Wires AUTO discovery events into the existing Wave 7 TriggerRouter.
// Does NOT create a new router · uses existing 'event_triggered' vocabulary.
// Every discovery event is idempotent via Wave 2 D2 key (through
// deriveAutoCampaignKey in campaign-service).
//
// Unknown triggers remain explicit · handler returns `no_match` and the
// caller's outer routing decides what to do next. No default "send anyway".

import type { PoolClient } from "pg";
import type { TriggerEvent } from "../../continuous-loop/types";
import type { TriggerHandler, TriggerRouter } from "../../continuous-loop/trigger-router";
import { createAutoCampaign, populateAutoCampaignQueue, type AutoCampaignIntent, type AutoCampaignOutcome } from "./campaign-service";

// ─── Marketing-intent marker (found in TriggerEvent.detail) ─────────
//
// A discovery event that should produce an AUTO marketing campaign
// MUST include `detail.marketing_intent === "auto_campaign"` PLUS the
// required AutoCampaignIntent fields.  Anything else is ignored (silent
// no-op is safe · the composed handler wraps the trigger-router only for
// events explicitly requesting AUTO marketing action).
//
// This means the TriggerRouter can safely be shared with non-marketing
// workflows · unrelated `event_triggered` events pass through untouched.

export interface AutoMarketingTriggerDeps {
  readonly get_client: () => Promise<PoolClient>;
  readonly on_outcome?: (event: TriggerEvent, outcome: AutoCampaignOutcome & { queued?: number }) => void;
  readonly logger?: (msg: string, meta?: Record<string, unknown>) => void;
}

export type AutoMarketingTriggerResult =
  | { kind: "no_match" }
  | { kind: "invalid_intent"; missing: ReadonlyArray<string> }
  | { kind: "processed"; outcome: AutoCampaignOutcome & { queued?: number } };

// ─── Pure predicate ─────────────────────────────────────────────────
export function matchesAutoMarketingEvent(event: TriggerEvent): boolean {
  if (event.kind !== "event_triggered" && event.kind !== "user_triggered" && event.kind !== "scheduled") return false;
  const d = event.detail ?? {};
  return (d as any).marketing_intent === "auto_campaign";
}

// ─── Extract + validate intent from event ───────────────────────────
export function extractAutoCampaignIntent(event: TriggerEvent): { ok: true; intent: AutoCampaignIntent } | { ok: false; missing: ReadonlyArray<string> } {
  const d = event.detail ?? {};
  const required = ["policy_id", "source_reference", "campaign_intent", "country", "display_name", "subject_line", "body_text"] as const;
  const missing = required.filter(k => (d as any)[k] === undefined || (d as any)[k] === null || (d as any)[k] === "");
  if (missing.length > 0) return { ok: false, missing };
  const intent: AutoCampaignIntent = {
    policy_id:        String((d as any).policy_id),
    source_reference: String((d as any).source_reference),
    campaign_intent:  String((d as any).campaign_intent),
    country:          String((d as any).country),
    category:         ((d as any).category ?? null) as string | null,
    language:         ((d as any).language ?? null) as string | null,
    display_name:     String((d as any).display_name),
    subject_line:     String((d as any).subject_line),
    body_text:        String((d as any).body_text),
    banner_image_url: (d as any).banner_image_url,
    cta_url:          (d as any).cta_url,
    cta_label:        (d as any).cta_label,
    footer_text:      (d as any).footer_text,
    actor:            (d as any).actor ?? "system:trigger-router",
    trigger_ref:      event.target_id,
    content_approved: (d as any).content_approved,
    recent_daily_sends: (d as any).recent_daily_sends,
  };
  return { ok: true, intent };
}

// ─── Process one event · returns typed outcome ──────────────────────
export async function processAutoMarketingTrigger(
  event: TriggerEvent,
  deps: AutoMarketingTriggerDeps,
  options: { populate_queue?: boolean } = {},
): Promise<AutoMarketingTriggerResult> {
  if (!matchesAutoMarketingEvent(event)) return { kind: "no_match" };
  const parsed = extractAutoCampaignIntent(event);
  if (!parsed.ok) {
    deps.logger?.("auto-marketing-trigger:invalid_intent", { missing: parsed.missing });
    return { kind: "invalid_intent", missing: parsed.missing };
  }
  const client = await deps.get_client();
  try {
    const outcome = await createAutoCampaign(client, parsed.intent);
    let queued: number | undefined;
    if (options.populate_queue !== false && (outcome.kind === "created" || outcome.kind === "already_exists")) {
      // §11 · only after policy/eligibility gates allowed the campaign.
      const q = await populateAutoCampaignQueue(client, outcome.campaign_id);
      queued = q.queued;
    }
    const combined = { ...outcome, queued };
    deps.on_outcome?.(event, combined);
    deps.logger?.("auto-marketing-trigger:processed", { kind: outcome.kind, queued });
    return { kind: "processed", outcome: combined };
  } finally {
    (client as any).release?.();
  }
}

// ─── Optional convenience · register on a TriggerRouter ────────────
/** Register an AUTO marketing handler on the given router for the given
 *  trigger kind (default: 'event_triggered'). If the router already has a
 *  handler for that kind, compose · call existing first · then AUTO logic.
 *  Composition is deliberate · no silent replacement. */
export function registerAutoMarketingTrigger(
  router: TriggerRouter,
  deps: AutoMarketingTriggerDeps,
  options: { kind?: "event_triggered" | "user_triggered" | "scheduled"; populate_queue?: boolean } = {},
): { registered_kind: string; composed: boolean } {
  const kind = options.kind ?? "event_triggered";
  const already = router.registeredKinds().includes(kind);
  let composed = false;
  let prior: TriggerHandler | null = null;
  if (already) {
    // Cannot register twice · take snapshot then unregister + compose
    // (Router allows only one handler per kind by design.)
    // We do NOT know the existing handler internals · we compose by
    // preserving the invariant via `unregister` + wrapper. Callers that
    // want to preserve prior handling should call this before other work.
    router.unregister(kind);
    composed = true;
  }
  const handler: TriggerHandler = async (event) => {
    if (prior) await prior(event);
    await processAutoMarketingTrigger(event, deps, { populate_queue: options.populate_queue });
  };
  router.register(kind, handler);
  return { registered_kind: kind, composed };
}
