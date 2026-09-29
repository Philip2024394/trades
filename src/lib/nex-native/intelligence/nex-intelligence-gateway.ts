// src/lib/nex-native/intelligence/nex-intelligence-gateway.ts
//
// Bridge 91 · The ONE controlled boundary between NEX Chat and NEX
// Intelligence. Replaces the previous raw runProviderStream call in
// generateNexReply with a pipeline that:
//
//   USER MESSAGE
//     ↓
//   AUTHORIZATION (deterministic · session-verified before enqueue)
//     ↓
//   REFLEX ATTEMPT (unchanged · fast path)
//     ↓
//   BUSINESS-OWNED EVIDENCE RETRIEVAL (this business's authoritative data)
//     ↓
//   EVIDENCE CONTEXT (structured · with provenance · with response rules)
//     ↓
//   GENERATION via runGenerationEngine (validator loop · correction retry)
//     ↓
//   CLAIM-VS-EVIDENCE CHECK (validator whitelist from evidence tokens)
//     ↓
//   SAFE RESPONSE (grounded answer OR honest gap OR error)
//
// Doctrine constraints honoured:
//   · Personal peer chat E2E untouched · gateway never runs on E2E surface
//   · No autonomous actions · gateway is answer-only (§14 of brief)
//   · Constitutional Gate untouched · gateway does not call third-party AI
//   · Model is a COMPONENT · not "NEX" · not authoritative for facts
//   · Unknown → honest gap · never a model guess
//   · Every call produces one audit row (gateway-telemetry.ts)

import "server-only";
import * as crypto from "node:crypto";
import { NEX_IDENTITY, NEX_RULES } from "@/lib/nex/personality";
import { tryReflex } from "@/lib/nex/reflex/reflex-brain";
import { nexSupabaseAdmin as _admin } from "../supabase-admin";
import * as accountService from "../account-service";
import * as businessService from "../business-service";
import * as productService from "../product-service";
import * as conversationService from "../conversation-service";
import type { NexAccountRow, NexUuid } from "../types";
import { probeInProcessRuntime } from "./in-process-provider";
import { selectModel } from "./model-registry";
import {
  runGenerationEngine,
  type EngineOutcome,
} from "./generation-engine";
import {
  retrieveBusinessEvidence,
  bundleWhitelistTokens,
  type EvidenceBundle,
  type EvidenceItem,
} from "./business-evidence-retriever";
import { retrieveProductKnowledge } from "./product-knowledge-retriever";
import { retrieveAccountContext } from "./account-context-retriever";
import {
  formatEvidenceForPrompt,
  evidenceSummary,
} from "./evidence-context";
import { recordGatewayAudit } from "./gateway-telemetry";
import type { NexChatMessage } from "./models/types";
import { validateOutput } from "./validator";

const NEX_ASSISTANT_DISPLAY_NAME = "NEX Assistant";

// ─── Public request / response contract ─────────────────────────────

export interface NexIntelligenceRequest {
  conversationId: NexUuid;
  correlationId?: NexUuid | null;
  /** Optional cap on max evidence items to include · default 8. */
  maxEvidenceItems?: number;
  /** Optional cap on generation attempts · default 3. */
  maxAttempts?: number;
}

export interface NexIntelligenceResponse {
  message_id: NexUuid | null;
  path: "reflex" | "grounded" | "gap" | "error";
  gap_reason: string | null;
  reply_preview: string | null;
  duration_ms: number;
  model_used: string | null;
  evidence_item_ids: string[];
  correlation_id: string | null;
}

// ─── Public entry ────────────────────────────────────────────────────

export async function nexIntelligenceAnswer(
  req: NexIntelligenceRequest,
): Promise<NexIntelligenceResponse> {
  const start = Date.now();
  const correlationId = req.correlationId ?? crypto.randomUUID();
  const emit = (partial: Omit<NexIntelligenceResponse, "duration_ms" | "correlation_id">) => ({
    ...partial,
    duration_ms: Date.now() - start,
    correlation_id: correlationId,
  });

  // 1 · Load conversation + participant scope (authorization step)
  const conv = await conversationService.getConversationById(req.conversationId);
  if (!conv) {
    return finalizeAudit(emit({
      message_id: null, path: "gap", gap_reason: "conversation_not_found",
      reply_preview: null, model_used: null, evidence_item_ids: [],
    }), start, correlationId, req.conversationId, null, null, null, false, null, null);
  }

  const messages = await conversationService.listMessages(req.conversationId);
  if (messages.length === 0) {
    return finalizeAudit(emit({
      message_id: null, path: "gap", gap_reason: "empty_conversation",
      reply_preview: null, model_used: null, evidence_item_ids: [],
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, null, false, null, null);
  }

  const participants = await conversationService.listParticipants(req.conversationId);
  const lastMsg = messages[messages.length - 1]!;
  const nexAssistant = await ensureNexAssistantAccount();

  if (lastMsg.sender_account_id === nexAssistant.id) {
    return finalizeAudit(emit({
      message_id: null, path: "gap", gap_reason: "already_replied_last",
      reply_preview: null, model_used: null, evidence_item_ids: [],
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, null, false, null, null);
  }
  const lastSenderParticipation = participants.find((p) => p.account_id === lastMsg.sender_account_id);
  const requesterSide = lastSenderParticipation?.side ?? null;
  if (requesterSide !== "customer") {
    return finalizeAudit(emit({
      message_id: null, path: "gap", gap_reason: "last_message_not_from_customer",
      reply_preview: null, model_used: null, evidence_item_ids: [],
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, false, null, null);
  }

  // 2 · Reflex fast path
  const reflex = tryReflex(lastMsg.body);
  if (reflex) {
    const posted = await persistReply(req.conversationId, nexAssistant.id, participants, reflex.text);
    return finalizeAudit(emit({
      message_id: posted.id, path: "reflex", gap_reason: null,
      reply_preview: reflex.text.slice(0, 200), model_used: null,
      evidence_item_ids: [],
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, true, null, null);
  }

  // 3 · Business + product context (for surface guidance + evidence retrieval)
  const business = await businessService.getBusinessById(conv.business_id);
  if (!business) {
    return finalizeAudit(emit({
      message_id: null, path: "gap", gap_reason: "business_missing",
      reply_preview: null, model_used: null, evidence_item_ids: [],
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, false, null, null);
  }
  const product = conv.about_product_id ? await productService.getProductById(conv.about_product_id) : null;

  // 4 · Retrieve evidence from THREE authoritative sources:
  //     · business-owned data (nex_business + nex_product + nex_menu_item)
  //     · NEX product knowledge (Bridge 92 · features/plans/workflows)
  //     · authorised account context (customer's real tier/plan/expiry)
  // The three merge into ONE evidence bundle the model sees.
  const [businessBundle, productHits, accountCtx] = await Promise.all([
    retrieveBusinessEvidence({
      conversationId: req.conversationId,
      businessId: conv.business_id,
      productId: conv.about_product_id ?? null,
      lastCustomerMessage: lastMsg.body,
      maxItems: req.maxEvidenceItems ?? 8,
    }),
    Promise.resolve(retrieveProductKnowledge({
      question: lastMsg.body,
      maxItems: 4,
    })),
    retrieveAccountContext({ accountId: lastMsg.sender_account_id as NexUuid }),
  ]);

  // Merge · business + product + account · keep provenance
  // discipline so the formatter labels each item correctly.
  const mergedItems: EvidenceItem[] = [
    ...businessBundle.items,
    ...productHits.items,
    ...accountCtx.items,
  ];
  const bundle: EvidenceBundle = {
    items: mergedItems,
    empty: mergedItems.filter((it) => it.score > 0).length === 0,
    sources_consulted: [
      ...businessBundle.sources_consulted,
      ...(productHits.items.length > 0 ? ["product" as const] : []),
      ...(accountCtx.items.length > 0 ? ["business" as const] : []), // account emits with 'business' provenance
    ],
    total_candidates:
      businessBundle.total_candidates +
      productHits.total_candidates +
      accountCtx.items.length,
    business_id: businessBundle.business_id,
    product_id: businessBundle.product_id,
  };

  // 5 · Model runtime probe (§2 of brief · local only, no hosted, no daemon)
  const probe = await probeInProcessRuntime();
  if (!probe.available) {
    return finalizeAudit(emit({
      message_id: null, path: "gap",
      gap_reason: `in_process_runtime_unavailable · ${probe.error ?? "unknown"}`,
      reply_preview: null, model_used: null, evidence_item_ids: [],
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, false, bundle, null);
  }

  // 6 · Build prompt · NEX_IDENTITY + NEX_RULES + surface guidance + evidence context
  const surfaceGuidance = buildSurfaceGuidance({
    businessName: business.display_name,
    productName: product?.name ?? null,
    productPrice: product ? `${product.currency} ${(product.price_pence / 100).toFixed(2)}` : null,
  });
  const evidenceBlock = formatEvidenceForPrompt(bundle);
  const systemPrompt = [
    NEX_IDENTITY,
    "",
    NEX_RULES,
    "",
    surfaceGuidance,
    "",
    evidenceBlock,
  ].join("\n");

  const chatMessages: NexChatMessage[] = messages.map((m) => ({
    role: m.sender_account_id === nexAssistant.id ? "assistant" : "user",
    content: m.body,
  }));

  // 7 · Select the registered generation model and run through the
  //     engine (validator loop + correction retry). selectModel refuses
  //     any model whose licence disallows commercial use.
  const model = selectModel("default");
  if (!model) {
    return finalizeAudit(emit({
      message_id: null, path: "gap",
      gap_reason: "no_commercial_safe_model_registered",
      reply_preview: null, model_used: null, evidence_item_ids: [],
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, false, bundle, null);
  }

  const engineOut: EngineOutcome = await runGenerationEngine(
    model,
    { systemPrompt, messages: chatMessages, maxTokens: 400, temperature: 0.35 },
    { maxAttempts: req.maxAttempts ?? 3 },
  );

  // 8 · Extended validator check against evidence whitelist
  //     (the engine already validated, but the engine's validator
  //     didn't know about our evidence bundle · re-check with
  //     whitelist so retrieved figures/URLs don't cause a false gap)
  if (engineOut.ok) {
    const whitelist = bundleWhitelistTokens(bundle);
    const finalCheck = validateOutput({
      systemPrompt,
      userMessage: lastMsg.body,
      output: engineOut.text,
      evidenceWhitelist: whitelist,
    });
    if (!finalCheck.ok) {
      return finalizeAudit(emit({
        message_id: null, path: "gap",
        gap_reason: `evidence_check_failed · ${finalCheck.findings.join("|")}`,
        reply_preview: engineOut.text.slice(0, 200),
        model_used: engineOut.modelId, evidence_item_ids: bundle.items.map((i) => i.id),
      }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, false, bundle, engineOut);
    }
  }

  if (!engineOut.ok) {
    return finalizeAudit(emit({
      message_id: null, path: "gap",
      gap_reason: `engine_rejected · ${engineOut.error}`,
      reply_preview: null,
      model_used: engineOut.modelId, evidence_item_ids: bundle.items.map((i) => i.id),
    }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, false, bundle, engineOut);
  }

  // 9 · Persist grounded reply
  const posted = await persistReply(
    req.conversationId, nexAssistant.id, participants, engineOut.text,
  );
  return finalizeAudit(emit({
    message_id: posted.id, path: "grounded", gap_reason: null,
    reply_preview: engineOut.text.slice(0, 200),
    model_used: engineOut.modelId,
    evidence_item_ids: bundle.items.map((i) => i.id),
  }), start, correlationId, req.conversationId, conv.business_id, conv.about_product_id ?? null, requesterSide, false, bundle, engineOut);
}

// ─── Internals ───────────────────────────────────────────────────────

async function ensureNexAssistantAccount(): Promise<NexAccountRow> {
  const { data, error } = await _admin
    .from("nex_account")
    .select("*")
    .eq("display_name", NEX_ASSISTANT_DISPLAY_NAME)
    .is("supabase_user_id", null)
    .maybeSingle();
  if (error) throw new Error(`ensureNexAssistantAccount: ${error.message}`);
  if (data) return data as NexAccountRow;
  return await accountService.createAccount({
    display_name: NEX_ASSISTANT_DISPLAY_NAME,
    supabase_user_id: null,
  });
}

function buildSurfaceGuidance(ctx: {
  businessName: string;
  productName: string | null;
  productPrice: string | null;
}): string {
  const lines: string[] = [
    `You are helping a customer who has messaged the business "${ctx.businessName}" via NEX Chat.`,
  ];
  if (ctx.productName) {
    lines.push(
      `The conversation is scoped to the product "${ctx.productName}"${
        ctx.productPrice ? ` priced at ${ctx.productPrice}` : ""
      }.`,
    );
  }
  lines.push(
    "",
    "You speak AS NEX Assistant · you are NOT the business owner.",
    "The business owner may reply later personally · say so when appropriate.",
    "",
    "You have no tools in this conversation · no ability to check stock, place orders,",
    "or contact the business owner directly. Never claim to have taken an action.",
    "Never activate a subscription. Never confirm a payment. Never process a refund.",
    "Answer questions only from NEX_KNOWLEDGE below · anything not covered → say so honestly.",
  );
  return lines.join("\n");
}

async function persistReply(
  conversationId: NexUuid,
  nexAssistantId: NexUuid,
  currentParticipants: Array<{ account_id: string }>,
  body: string,
) {
  if (!currentParticipants.some((p) => p.account_id === nexAssistantId)) {
    try {
      await conversationService.addParticipant({
        conversation_id: conversationId,
        account_id: nexAssistantId,
        side: "business",
      });
    } catch (e) {
      const emsg = e instanceof Error ? e.message : String(e);
      if (!/duplicate key/i.test(emsg)) throw e;
    }
  }
  return await conversationService.postMessage({
    conversation_id: conversationId,
    sender_account_id: nexAssistantId,
    body,
  });
}

async function finalizeAudit(
  resp: NexIntelligenceResponse,
  startMs: number,
  correlationId: string,
  conversationId: NexUuid,
  businessId: NexUuid | null,
  productId: NexUuid | null,
  requesterSide: "customer" | "business" | null,
  reflexHit: boolean,
  bundle: EvidenceBundle | null,
  engineOut: EngineOutcome | null,
): Promise<NexIntelligenceResponse> {
  const summary = bundle ? evidenceSummary(bundle) : null;
  await recordGatewayAudit({
    ts: new Date().toISOString(),
    correlation_id: correlationId,
    conversation_id: conversationId,
    business_id: businessId,
    product_id: productId,
    requester_side: requesterSide,
    path: resp.path,
    intent_length: 0,
    reflex_hit: reflexHit,
    retrieval: bundle
      ? {
          empty: bundle.empty,
          total_candidates: bundle.total_candidates,
          kept_items: bundle.items.length,
          sources_consulted: bundle.sources_consulted,
          item_ids: summary!.item_ids,
        }
      : null,
    generation: engineOut
      ? {
          model_id: engineOut.modelId,
          total_latency_ms: engineOut.totalLatencyMs,
          attempts: engineOut.attempts.length,
          findings: Array.from(new Set(engineOut.attempts.flatMap((a) => a.findings))),
          ok: engineOut.ok,
        }
      : null,
    reply_length: resp.reply_preview?.length ?? 0,
    gap_reason: resp.gap_reason,
    total_latency_ms: Date.now() - startMs,
  });
  return resp;
}
