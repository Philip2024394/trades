// POST /api/nex-conv/chat
//
// Historically this was the direct entry to the ADR-0044 conversation-
// learning pipeline (Qwen 2.5 3B via Ollama + STAIRCASE_INTENTS/ENTITIES).
// Philip 2026-08-31 · Stage 3.6 · "NEX Speaking Brain" · Option B: this
// route now sits BEHIND the canonical NEX Brain (orchestrateChatTurn).
// The Brain owns intent, market, and routing. Only when the intent
// classifies as genuine UK staircase (staircase intent + market=UK)
// does the request fall through to the Qwen/STAIRCASE pipeline.
//
// Rationale: NexAppShell's voice composer (useNexVoice) posts here.
// Before this change, accommodation/food/tourism turns in the phone
// shell landed on Qwen's staircase-design intake ("what sort of look
// are you going for — traditional, contemporary...") because the route
// bypassed the Brain entirely.
//
// The Qwen specialist remains available and unchanged for UK staircase
// conversations. It becomes a capability UNDER the Brain, not the
// default. Zero third-party AI in the response path — the Brain is
// deterministic and Ollama is validated as local by respond-local.mjs.

import { NextResponse, type NextRequest } from "next/server";
import { orchestrateChatTurn, orchestrateChatTurnLive } from "@/lib/nex/brain/orchestrate";
// Phase D · natural-language Live discovery routing
import { detectLiveDiscoveryScope } from "@/lib/nex/brain/live-discovery-intent";
import { runLiveDiscoveryHandler } from "@/lib/nex/brain/live-discovery-handler";
import { getSession, upsertSession, appendDialogueTurn, applyVerticalSwitchReset } from "@/lib/nex/brain/session";
import { renderVoice } from "@/lib/nex/brain/personality-voice";
import { selectVoiceIntent } from "@/lib/nex/brain/voice-intent-selector";
import { detectEntityFollowup } from "@/lib/nex/brain/entity-followup-detector";
// P0 · Response Composition Layer (Philip 2026-09-05 · P0 doctrine).
import { deriveFrame } from "@/lib/nex/brain/conversational-frame";
import { composeReplyViaLocalLLM } from "@/lib/nex/brain/response-composition";
import { verifyClaims } from "@/lib/nex/brain/claim-verification";
import { retrieveKnowledge } from "@/lib/nex/indonesia/knowledge";
// S3 · Directory-aware knowledge tier (Philip 2026-09-05 · chief-engineer
// authorization). Bridges live directory rows (accommodation · service ·
// food · commerce · transport) into the composer's RAG context so real
// hotels/gyms/restaurants become composable evidence alongside walker
// records. Fail-safe · flag-guarded · bounded latency.
import { retrieveDirectoryAsKnowledge } from "@/lib/nex/indonesia/directory-knowledge";
// P0 · Zero-Evidence Fabrication Guard (Philip 2026-09-05 · chief-engineer
// AUTHORIZE · P0 CORRECTION). When retrieval returns zero grounded
// knowledge AND user asks about a specific subject, skip the LLM composer
// and return an honest boundary. Prevents proven FOOD T4 Japan/tuna
// fabrication where composition ran with knowledge_count=0.
import { decideHonestBoundary } from "@/lib/nex/brain/honest-boundary-reply";
// Founder BEGIN 2026-09-09 · SHADOW-MODE deterministic composer (P1-P5 + R1-R3).
// Attached as a non-blocking parallel path · never changes the customer's reply ·
// records paired {chat, deterministic} outputs for offline agreement analysis.
// Enabled by env NEX_DETERMINISTIC_SHADOW=1. Hard timeout budget.
import { runShadowMode, SHADOW_MODE_ENABLED } from "@/lib/nex/intelligence-storage-grid/accommodation/shadow-mode";
import { getAccommodationDbPool } from "@/lib/nex-accommodation/db";
// P0.3 · Hotel Resolved-Reference Continuity (Philip 2026-09-05 · AUTHORIZE
// P0.3). When session.currentReference resolves to a directory entity this
// turn, hydrate the full record via getWorldRecordById and inject as
// first-priority grounded evidence into composition context. SCOPE LOCK:
// this correction slice applies only to accommodation verticals; gym /
// service / food / commerce reference continuity is a separate slice.
import {
  hydrateResolvedReference,
  hydratedRecordToKnowledge,
  buildHotelRecordSummary,
  isReferenceFreshThisTurn,
  type HydrationResult,
} from "@/lib/nex/brain/reference-hydration";
// P0.4 · Fresh-Conversation Ordinal Contamination Guard (Philip 2026-09-05).
// Detects ordinal/deictic references in the user message that have NO
// valid conversational anchor and, when detected, forces a honest
// clarification reply instead of allowing retrieval to bind an entity
// via lexical coincidence. Preserves P0 zero-evidence guard and P0.3
// hotel reference continuity.
import { decideOrdinalGate } from "@/lib/nex/brain/ordinal-anchor";
// P0 · Result-Follow-Up Provenance Guard (Philip 2026-09-05 · AUTHORIZE ·
// RESULT-FOLLOW-UP PROVENANCE). Detects follow-ups ABOUT an existing
// result set ("where you find them" · "how did you find these" · etc.)
// and answers from actual known provenance instead of re-emitting the
// original list. Preserves P0.3 hotel reference continuity · P0.4
// fresh-conversation ordinal gate · P0 zero-evidence guard. Fires
// BEFORE the ordinal gate so intent-changed follow-ups remain anchored.
import { decideResultFollowupGate } from "@/lib/nex/brain/result-followup";
// Capability & Display Intelligence (Philip 2026-09-06 · AUTHORIZE ·
// ACCOMMODATION PROVENANCE, BOOKING SEMANTICS & FOLLOW-UP CONVERSATION FIX).
// Handles three post-provenance dialogue acts that were being lost to
// stale result-set re-emission:
//   · CAPABILITY_QUESTION      "can I book?"
//   · CAPABILITY_CLARIFICATION "what do you mean I can't book?"
//   · RESULT_DISPLAY_REQUEST   "ok show me them" · "let's see them"
// Separates SOURCE (where listings came from) from CAPABILITY (what NEX
// can do with them). Fires BEFORE result-followup so a capability
// clarification about a prior provenance answer is not re-classified
// as a fresh provenance question.
import { decideCapabilityDisplayGate } from "@/lib/nex/brain/capability-display-intelligence";
// Business International Market Intelligence v1 (Philip 2026-09-06 ·
// CEREMONIAL AUTHORIZE · BUSINESS v1). Bridges an authenticated
// business_id + commercial-intent classifier + discovered-companies
// store into the conversation. Deterministic SEND block (§10 §30) ·
// draft-only autonomy · honest zero-evidence reply when no companies
// found (§13 §33). Runs AFTER conversational gates so social replies,
// memory, capability display, and result-followup still win when
// applicable. Isolated from the accommodation workforce and the
// Programmer Agent — two-agent separation contract preserved.
import { decideBusinessMarketGate } from "@/lib/nex/brain/business-market-gate";
// G24 · Scope-Validated Evidence Guard (Philip 2026-09-05 · AUTHORIZE ·
// NEX G24). Blocks the fabrication pathway where retrieval returned k>0
// records that are NOT scope-relevant to the user's actual question
// (proven cases: "seafood in Japan" → fabricated Japanese seafood claims;
// "Michelin restaurant in Semarang" → fabricated restaurant name). Runs
// AFTER retrieval and AFTER P0.4 · empties hits when scope IRRELEVANT or
// PARTIALLY_SUPPORTED so the existing P0 zero-evidence guard fires with
// an honest boundary. No new fabrication path added.
import { decideScopeGate, buildScopeBoundaryReply } from "@/lib/nex/brain/scope-validation";
// Conversational Function Reclassification / Social-Turn Protection
// (Philip 2026-09-06 · AUTHORIZE · Conversational Function slice).
// Prevents stale task-response inheritance when the current turn is
// a NEW conversational act (social · gratitude · personal-context
// offer / statement · meta-conversation). Runs above every other
// composition gate so the current turn's meaning cannot be
// overridden by inherited task context.
import { decideConversationalFunctionGate, classifyConversationalFunction } from "@/lib/nex/brain/conversational-function";
// G23 · User-Fact Memory & Persistence (Philip 2026-09-06 · AUTHORIZE G23).
// Detects explicit user facts from each turn (consuming L4 dialogue-act
// and G12 polarity), writes them to the JSONL-backed persistent store,
// and gates memory-question turns ("what do you know about me", "what
// did I tell you about my business") with a deterministic response
// drawn from the store — never fabricated.
import {
  detectUserFactCandidates,
  detectRetractionSubjects,
  writeUserFacts,
  supersedeMatchingFacts,
  decideMemoryReply,
} from "@/lib/nex/brain/user-fact-memory";
// G03 · Language Stability & Reply-Language Continuity (Philip 2026-09-06 · AUTHORIZE G03).
// NEX-owned conversational language state. Detects per-turn language,
// preserves active language across turns, handles explicit switches,
// isolates translation requests + quoted text + capability questions,
// and verifies the LLM's output actually obeyed the language directive.
import {
  resolveActiveLanguage,
  decideLanguageSwitchGate,
  verifyOutputLanguage,
  langToOwnerLanguage,
  type Lang,
} from "@/lib/nex/brain/language-state";
// G15 · Confirmation & Yes/No Intelligence (Philip 2026-09-06 · AUTHORIZE G15).
// Understands yes/no/etc. in conversational context. Resolves against
// the last NEX proposition. Never guesses on fresh conversations; never
// executes actions from social acknowledgements. Consumes G03 active
// language for reply routing.
import { decideConfirmationGate } from "@/lib/nex/brain/confirmation-intelligence";
// Wave 1 · Conversational Semantic Control (Philip 2026-09-06 · AUTHORIZE).
// Temporal + Quantity + Comparison/Ranking intelligence. Each module
// exposes observability on every turn AND fires a safe gate ONLY when
// the message would otherwise produce fabricated / stale-context output
// (reflective tenses with entity · fresh incremental/ordinal quantities ·
// fresh ranking/comparison without a result set).
import { decideTemporalGate } from "@/lib/nex/brain/temporal-intelligence";
import { decideQuantityGate } from "@/lib/nex/brain/quantity-intelligence";
import { decideComparisonRankingGate } from "@/lib/nex/brain/comparison-ranking-intelligence";
// Wave 2 · Contextual Meaning & Conversational Scope (Philip 2026-09-06 · AUTHORIZE).
// Spatial · Implicit constraints · Elliptical continuation + Topic-shift + Result-set scope.
// Observability on every turn; safe gates only for fresh-conv fabrication-risk cases
// (fresh "there"/"here" without antecedent; fresh ellipsis without result set).
import { decideSpatialGate } from "@/lib/nex/brain/spatial-intelligence";
import { detectImplicitConstraints } from "@/lib/nex/brain/implicit-constraints";
import { decideFrameScopeGate, inspectResultSetState, analyzeScope, mapDomainNounToVertical } from "@/lib/nex/brain/frame-scope-intelligence";
// P0.2 · Composed-reply entity feedback + wrong-domain gate widening (Philip 2026-09-05 P0.2 doctrine).
import { composedListToEntities } from "@/lib/nex/brain/composed-entities";
import { mergeEntityWindow, extractEntities } from "@/lib/nex/brain/entities";
// P1 REDIRECT · ordinal-reference resolution on conversation turns
// (Philip 2026-09-05 · corrective). Without this, ordinal references
// like "the second one" against composed lists never resolve because
// orchestrate.ts only invokes resolveReference on accommodation/world_cards
// paths. Route-level invocation for the general conversation path.
import { resolveReference, summariseResolution } from "@/lib/nex/brain/reference-resolution";
// Wave 3 · Spoken Interaction & Voice Intelligence (Philip 2026-09-06 · AUTHORIZE · WAVE 3).
// Spoken-normalization is observability + advisory · never authoritative
// over semantics. Social/emotional gate handles pure EMOTIONAL_REACTION
// and CONFUSION acts so they don't fall back to stale "found N"
// re-emission. Voice compression is observability-only unless the
// caller sets `voice: true` in the request body.
import { normalizeSpokenInput } from "@/lib/nex/brain/spoken-normalization";
import { decideSocialEmotionalGate } from "@/lib/nex/brain/social-emotional";
import { compressForVoice } from "@/lib/nex/brain/voice-response-compression";
// Universal Entity Intelligence + Result Card Contract (Philip 2026-09-06 · AUTHORIZE).
// Projects the existing `world_cards` PresentedCardSet into a structured
// EntityResultCardSet with per-attribute KNOWN_YES / UNKNOWN state and
// selected highlights. Memoized to session so follow-up questions like
// "does the first one have a pool?" can answer from evidence.
import {
  projectEntityResultCardSetFromPresented,
  memoize,
} from "@/lib/nex/brain/entity-result-cards";
import { decideAttributeQueryGate } from "@/lib/nex/brain/entity-attribute-query";

const P0_COMPOSITION_ENABLED = process.env.NEX_P0_COMPOSITION_ENABLED !== "false";

/**
 * P0 gate · which BrainReply shapes are allowed to be re-composed by
 * the local LLM. Structured intents (commerce · accommodation ·
 * comparison · recommendation · action · verification · safety) MUST
 * keep the deterministic composer's reply — those paths enforce
 * honesty boundaries the LLM cannot be trusted with.
 *
 * Open-knowledge intents (conversation · indonesia · knowledge · food
 * · tourism · translation · writing · business) are eligible.
 */
function shouldComposeOpenKnowledge(composed: any, userMessage?: string): boolean {
  if (composed.action_audit) return false;
  if (composed.action_proposal) return false;
  if (composed.comparison) return false;
  if (composed.recommendation) return false;
  if (composed.world_recommendation) return false;
  if (composed.world_comparison) return false;
  if (composed.world_plan) return false;
  if (composed.governance?.hasDenies) return false;
  if (composed.intent === "staircase") return false;
  // Safety EXCLUDED — composeSafetyResponse enforces critical
  // distress phrasing (chest pain / earthquake / stolen wallet) that
  // the LLM must not reshape.
  //
  // P0.2 widening (Philip 2026-09-05 P0.2 doctrine):
  //
  // Structural intents (commerce · accommodation · booking · marketplace)
  // are usually correctly served by their deterministic composers.
  // BUT when the Brain misroutes an INFORMATION query as a structural
  // intent — e.g., "where did gudeg originate?" → world_cards with 797
  // restaurants; "what's the phone number of the indonesian embassy in
  // tokyo?" → commerce with unrelated products — the deterministic
  // reply is worse than a composed honest boundary.
  //
  // The information-query detector below matches historical / definitional
  // / comparative / procedural / factual-lookup shapes. If the user's
  // message matches, we override the structural gate and compose an
  // honest reply. Commerce/accommodation questions that ARE genuine
  // ("cheap hotel in Yogyakarta") never match this detector · they keep
  // the deterministic path unchanged.
  const isInformationQuery =
    !!userMessage && INFORMATION_QUERY_RX.test(userMessage.toLowerCase());
  const intent = composed.intent;
  const worldCardsCount =
    composed.world_cards
      ? (composed.world_cards.count ?? composed.world_cards.cards?.length ?? 0)
      : 0;
  if (worldCardsCount > 0 && !isInformationQuery) return false;
  if ((intent === "commerce" || intent === "accommodation" || intent === "booking" || intent === "marketplace") && !isInformationQuery) return false;
  // Eligible open-knowledge intents pass through directly · misrouted
  // information queries force composition even for structural intents.
  const eligible = new Set([
    "conversation", "indonesia", "knowledge",
    "food", "tourism", "translation", "writing",
    "business",
  ]);
  if (isInformationQuery) return true;
  return intent ? eligible.has(intent) : true;
}

// P0.2 · Information-query detector · matches queries that seek
// facts/definitions/comparisons/history rather than commerce/booking.
// Kept regex-only (deterministic) so it can be audited and unit-tested.
// Conservative on purpose: false negatives (missed information query
// keeps deterministic path) are acceptable; false positives (composing
// when we shouldn't) risk unwanted LLM output on structural intents.
const INFORMATION_QUERY_RX =
  /\b(where\s+(did|does|was|were|is)|when\s+(did|does|was|were|is)|why\s+(did|does|was|were|is)|how\s+(did|does|was|were|is)|what\s+(is|are|was|were|does|do|caused|makes|makes\s+up)|who\s+(is|was|are|were|invented|discovered|founded)|(tell\s+me\s+about|explain|describe|define|compare|difference\s+between|contrast|history\s+of|origin\s+of|meaning\s+of|definition\s+of)|(coming\s+back\s+to|as\s+we\s+were\s+discussing|earlier\s+we\s+discussed)|(phone\s+number|email\s+address|contact\s+details|address\s+of)\s+of|(is\s+it\s+true|do\s+you\s+know|can\s+you\s+tell\s+me)|and\s+(japan|singapore|india|indonesia|europe|america|china|korea|thailand|vietnam|malaysia|philippines|australia|uk|usa|us)\??$|and\s+what\s+about|what\s+about|and\s+(you|yourself)\?)\b/i;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cold boot on the first customer message includes: pg pool init + all conv
// tables loaded into memory (~15s at MVP scale) + Ollama model load into VRAM
// if idle (~15s). Total worst case ~35s. 120s ceiling gives comfortable margin.
// Brain-only turns are deterministic and return in <100ms after warmup.
export const maxDuration = 120;

let _bootPromise: Promise<{ store: any; ready: true }> | null = null;

async function boot() {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    // @ts-expect-error — pipeline lives outside `src/` (scripts/nex-conv)
    const { createStore } = await import(
      /* @vite-ignore */ "../../../../../scripts/nex-conv/lib/store-factory.mjs"
    );
    // @ts-expect-error same reason
    const { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } = await import(
      /* @vite-ignore */ "../../../../../scripts/nex-conv/lib/entities.mjs"
    );

    const store = await createStore({ backend: "postgres" });

    for (const intent of STAIRCASE_INTENTS) await store.upsertIntent(intent);
    for (const ent of STAIRCASE_ENTITIES)
      await store.upsertEntity({ ...ent, brain: "staircase_brain" });

    return { store, ready: true as const };
  })();
  return _bootPromise;
}

type ChatRequest = {
  conversation_id?: string;
  message?: string;
  business_id?: string | null;
  /**
   * User's market context · Philip 2026-08-31 Stage 3.6. When absent,
   * defaults to "ID" (the phone shell serves Indonesian users). Only
   * market="UK" opens the door to the UK staircase Qwen specialist.
   */
  market?: "ID" | "UK" | "US";
  /** Stage 3.26 · Long-Term Memory user identity. Opaque client-provided
   *  string. Absent = LTM inactive. */
  user_id?: string;
  /** Stage 3.26 · Explicit consent for LTM read/write. Required for
   *  cross-session preference persistence. */
  consent?: { long_term_memory?: boolean };
  /** Wave 3 · Capability E · Voice Response Compression. When true, the
   *  compressed voice-safe version of the reply is returned in
   *  `voice_reply_compressed`. Composition_meta also reports the
   *  compressed form as observability even when this flag is false. */
  voice?: boolean;
  /** Stage 3.42 · Optional client-provided previous NEX reply used by
   *  the conversation router when server-side session state is missing. */
  previous_nex_reply?: string;
};

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function serverError(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/nex-conv/chat · idempotent warmup for the Qwen store.
// Kept for legacy clients that pre-warm on mount. Brain turns don't
// need this (deterministic, no boot cost).
export async function GET() {
  const t0 = Date.now();
  try {
    const { store } = await boot();
    return NextResponse.json({
      status: "ready",
      warmup_ms: Date.now() - t0,
      store_counts: store.counts?.() ?? null,
    });
  } catch (e: unknown) {
    return serverError(
      "warmup failed · " + String((e as Error)?.message ?? e).slice(0, 200),
      503
    );
  }
}

export async function POST(req: NextRequest) {
  // Founder BEGIN · NEX CHAT RESPONSE SPEED AUDIT (2026-09-09) · minimal timers
  // wrapped in try/catch so instrumentation errors NEVER break the response.
  // Emits a `_debug_timings` field in the response body. Zero logic change.
  const _perfNow: () => number = (() => {
    try { const { performance } = require("node:perf_hooks"); return () => performance.now(); }
    catch { return () => Date.now(); }
  })();
  const _t_request_start = _perfNow();
  const _stage_ms: Record<string, number> = {};
  let _t_body_parsed = 0;

  let body: ChatRequest;
  try {
    body = await req.json();
    _t_body_parsed = _perfNow();
    try { _stage_ms.body_parse = Math.round((_t_body_parsed - _t_request_start) * 100) / 100; } catch {}
  } catch {
    return badRequest("body must be valid JSON");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return badRequest("message is required and non-empty");
  if (message.length > 2000)
    return badRequest("message exceeds 2000 chars");

  const conversation_id =
    typeof body.conversation_id === "string" && /^[0-9a-f-]{8,}$/i.test(body.conversation_id)
      ? body.conversation_id
      : crypto.randomUUID();

  // Stage 3.42 · Conversation Layer (Philip 2026-09-01) · optional
  // client-provided previous NEX reply. When session state is missing
  // (e.g. Next.js dev-mode API-route hot-reloads dropping globalThis),
  // the conversation-router still needs the immediately-prior question
  // to interpret bare answers ("Indonesia" · "im good and you") as
  // context continuations. Client sends the last NEX bubble text ·
  // server prefers session.lastNexQuestion, falls back to this.
  const previousNexReply: string | undefined =
    typeof body.previous_nex_reply === "string" && body.previous_nex_reply.length > 0
      ? body.previous_nex_reply.slice(0, 800)
      : undefined;

  const userMarket: "ID" | "UK" | "US" =
    body.market === "UK" || body.market === "US" || body.market === "ID"
      ? body.market
      : "ID";

  // ─── Canonical Brain FIRST (Philip 2026-08-31 · Option B) ───────
  //
  // The Brain owns intent classification, market gating, safety mode,
  // theme routing, and the Indonesian knowledge world. The Qwen
  // staircase specialist only sees turns the Brain explicitly hands
  // off (intent="staircase" AND userMarket="UK").
  const brainT0 = Date.now();
  const _t_brain_start = _perfNow();
  // Stage 3.26 · Long-Term Memory · pass userId + consent through.
  const userId = typeof body.user_id === "string" && body.user_id.length > 0 ? body.user_id : undefined;
  const consentLongTermMemory = body.consent?.long_term_memory === true;
  // Stage 3.34 · Phase 27e · Live World access for the production
  // conversation route. `useLiveWorld:true` routes accommodation +
  // future verticals through the World-adapter path so the composer's
  // spoken text + the 3-card set + the expanded-list surface all
  // derive from the SAME live directory retrieval. When the intent
  // does not map to a wired vertical (or the adapter is unreachable),
  // the wrapper falls back to the sync path with a caveat · never
  // fabricates. Existing regressions untouched because the sync path
  // still runs inside the wrapper — the wrapper only ADDS live-World
  // enrichment · it does not replace the sync composer.
  const composed = await orchestrateChatTurnLive(message, {
    userMarket,
    conversationId: conversation_id,
    userId,
    consentLongTermMemory,
    useLiveWorld: true,
  });
  const brainMs = Date.now() - brainT0;
  try { _stage_ms.orchestrator = Math.round((_perfNow() - _t_brain_start) * 100) / 100; } catch {}

  // ─── Phase D · LIVE_DISCOVERY_REQUEST dispatch (Philip 2026-09-06) ──
  //
  // §16-§24 · Natural-language "what's live" / "what's happening
  // tonight" routes to the existing Live discovery system. Deterministic
  // pre-classification lives in classifyConversationIntent · the actual
  // Live data + honest conversational summary come from runLive-
  // DiscoveryHandler which never fabricates. Preserves G03/G12/G15/G23/
  // G24 (they operate on session state and reply composition, both of
  // which remain unchanged for this intent — we only replace the reply
  // text and attach cards).
  if (composed.intent === "live_discovery") {
    try {
      const scope = detectLiveDiscoveryScope(message);
      const sessionForCity = conversation_id ? getSession(conversation_id) : null;
      const sessionCity = sessionForCity?.accommodation?.location ?? null;
      const liveReply = await runLiveDiscoveryHandler({ scope, session_city: sessionCity });
      composed.reply = liveReply.summary;
      // Attach the live cards as suggestions so the chat surface can
      // render them alongside the natural-language answer.
      const liveSuggestions = liveReply.cards.slice(0, 4).map((c) => ({
        label: c.title ?? "Open Live",
        href: `/nex-live?media=${encodeURIComponent(c.media_id)}`,
      }));
      composed.suggestions = [...liveSuggestions, ...(composed.suggestions ?? [])];
      // Observability trail attached alongside the reply — never a
      // silent action.
      (composed as unknown as { live_discovery?: unknown }).live_discovery = {
        scope,
        city_used: liveReply.city_used,
        category_used: liveReply.category_used,
        status_counts: liveReply.status_counts,
        empty_reason: liveReply.empty_reason,
        cards: liveReply.cards,
      };
    } catch (e) {
      // Never break the response · fall back to composed.reply and
      // record the failure honestly.
      (composed as unknown as { live_discovery?: unknown }).live_discovery = {
        error: e instanceof Error ? e.message.slice(0, 200) : String(e),
      };
    }
  }

  const isUkStaircase =
    userMarket === "UK" && composed.intent === "staircase";

  // Stage 3.42 · Conversation Layer (Philip 2026-09-01) · record the
  // user's turn into the session dialogueTurns window BEFORE the
  // voice_reply IIFE runs · so the router sees the CURRENT user turn
  // in the rolling window if it needs to look back beyond just
  // `message` and `lastNexQuestion`. NEX-side turn recorded AFTER
  // voice rendering (see below).
  if (conversation_id) {
    try {
      const preS = getSession(conversation_id);
      if (preS) {
        const updated = appendDialogueTurn(preS, { role: "user", text: message });
        upsertSession(updated);
      }
    } catch { /* dialogue recording never breaks the response */ }
  }

  // ─── P1 REDIRECT · Route-level ordinal-reference resolution ────
  // Philip 2026-09-05 corrective · closes the P0.2 ordinal-integration
  // gap for the conversation path. Composed lists deposit entities
  // (kind=place|area|business_name, source=nex_reply, presentedOffset)
  // into the session via composed-entities.ts on the PRIOR turn. This
  // block invokes resolveReference on the CURRENT user message so
  // ordinal references ("the second one") pick up those entities.
  //
  // Guards:
  //   1. Only runs when session has presented entities AND user message
  //      extracted ordinal/pronoun · never fires spuriously.
  //   2. Skips when orchestrate already resolved a reference this turn
  //      (i.e., accommodation/food/world_cards path already handled it) ·
  //      never overwrites Brain's own resolution.
  //   3. Skips for structural intents (commerce/accommodation/booking/
  //      marketplace) · those are Brain-owned per the P0 doctrine.
  if (conversation_id) {
    try {
      const sess = getSession(conversation_id);
      const structuralIntents = new Set([
        "commerce", "accommodation", "booking", "marketplace",
      ]);
      const isStructural =
        typeof composed.intent === "string" && structuralIntents.has(composed.intent);
      // Guard: did orchestrate already resolve this turn?
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alreadyResolvedThisTurn =
        (sess?.currentReference as any)?.resolvedInTurn === (sess?.turnCount ?? 1) &&
        sess?.currentReference?.resolved === true;
      if (sess && !isStructural && !alreadyResolvedThisTurn) {
        const nowIso = new Date().toISOString();
        const userEntities = extractEntities(message, nowIso);
        const hasOrdinalOrPronoun = userEntities.some(
          (e) => e.kind === "ordinal" || e.kind === "pronoun",
        );
        const priorPresented = (sess.entities ?? []).some(
          (e) =>
            (e.kind === "business_name" || e.kind === "place" || e.kind === "area") &&
            e.source === "nex_reply",
        );
        if (hasOrdinalOrPronoun && priorPresented) {
          const resolution = resolveReference(userEntities, sess.entities ?? [], {
            currentTurn: sess.turnCount ?? 1,
          });
          const summary = summariseResolution(resolution);
          upsertSession({
            ...sess,
            currentReference: resolution.resolved
              ? { ...summary, resolvedInTurn: sess.turnCount ?? 1 }
              : summary,
          });
        }
      }
    } catch { /* reference resolution never breaks the response · fail-safe */ }
  }

  // ─── P0 · Response Composition Layer (Philip 2026-09-05) ───────
  // For open-knowledge intents only. Uses local Ollama (qwen2.5:7b
  // primary, 3b fallback) with the Live Conversational Frame + fresh
  // Indonesia RAG retrieval + the Brain's own draft as context. All
  // composition passes claim-level post-verification before it lands
  // on composed.reply. On any failure or rejection: fall back to the
  // deterministic reply. Never throws. Feature-flag gated.
  type CompositionMeta = {
    ran: boolean;
    accepted: boolean;
    reason?: string;
    model?: string | null;
    fell_back?: boolean;
    latency_ms?: number | null;
    prompt_tokens?: number | null;
    response_tokens?: number | null;
    flags?: Array<{ kind: string; severity: string; matched_text: string; reason: string }>;
    baseline_reply?: string;
    composed_reply?: string;
    frame_topic?: string;
    frame_subject?: string;
    knowledge_count?: number;
    // P0.2 · observability enrichment (Philip 2026-09-05)
    composed_entity_count?: number;
    /** True when the composition gate widened for an information query
     *  that Brain misrouted to a structural intent (world_cards or
     *  commerce/accommodation). Attacks P0.2 gaps #1 and #2. */
    widened_for_information_query?: boolean;
    /** Marker so downstream observability knows: composition_meta.flags
     *  ARE the post-composition claim audit, not stale pre-composition
     *  audit data. Attacks P0.2 gap #5. */
    post_composition_audit_ran?: boolean;
    // P0.3 · Hotel resolved-reference continuity observability
    hydrated_reference_id?: string | null;
    hydrated_reference_vertical?: string | null;
    hydration_reason?: string;
    // P0.4 · Fresh-conversation ordinal contamination guard observability
    ordinal_gate_fired?: boolean;
    ordinal_gate_reason?: string;
    ordinal_matched_phrase?: string | null;
    // P0 · Result-follow-up provenance guard observability
    result_followup_fired?: boolean;
    result_followup_reason?: string;
    result_followup_vertical?: string | null;
    result_followup_from_evidence?: boolean;
    // G24 · Scope-validated evidence observability
    scope_validation_status?: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "IRRELEVANT" | "NO_EVIDENCE";
    scope_validation_reason?: string;
    scope_missing_anchors?: string[];
    scope_covered_anchors?: string[];
    scope_gate_fired?: boolean;
    // Conversational-Function / Social-Turn Protection observability
    conv_function_detected?: string;
    conv_function_confidence?: "high" | "medium" | "low";
    conv_function_gate_fired?: boolean;
    conv_function_reason?: string;
    // G23 · User-Fact Memory observability
    memory_candidates_count?: number;
    memory_written_count?: number;
    memory_superseded_count?: number;
    memory_retracted_count?: number;
    memory_gate_fired?: boolean;
    memory_gate_reason?: string;
    memory_retrieved_count?: number;
    // G03 · Language Stability observability
    active_language?: Lang;
    detected_language_this_turn?: Lang;
    language_confidence?: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    language_source?: string;
    language_switch_gate_fired?: boolean;
    language_switched_from?: Lang;
    language_switched_to?: Lang;
    output_language_matches?: boolean;
    output_language_dominant?: Lang;
    output_language_verification?: "MATCH" | "DRIFT" | "SKIPPED";
    // G15 · Confirmation & Yes/No Intelligence observability
    confirmation_form?: string;
    confirmation_answer_polarity?: string;
    confirmation_resolution?: string;
    confirmation_active_proposition?: string;
    confirmation_gate_fired?: boolean;
    confirmation_gate_reason?: string;
    confirmation_effective_polarity?: string;
    // Wave 1 · Temporal · Quantity · Comparison/Ranking observability
    temporal_tense?: string;
    temporal_entity?: string;
    temporal_gate_fired?: boolean;
    quantity_kind?: string;
    quantity_value?: number;
    quantity_gate_fired?: boolean;
    semantic_intent?: string;
    semantic_attribute?: string;
    semantic_direction?: string;
    semantic_count?: number;
    semantic_gate_fired?: boolean;
    wave1_gate_reason?: string;
    // Wave 2 · Spatial · Implicit · Frame/Scope observability
    spatial_concept?: string;
    spatial_polarity?: string;
    spatial_anchor?: string;
    spatial_is_change?: boolean;
    spatial_gate_fired?: boolean;
    implicit_constraint_count?: number;
    implicit_constraints_summary?: string;
    frame_transition?: string;
    frame_active_domain?: string;
    frame_result_set_state?: string;
    frame_is_elliptical?: boolean;
    frame_gate_fired?: boolean;
    wave2_gate_reason?: string;
    // Capability & Display Intelligence observability (prior slice)
    capability_display_act?: string;
    capability_display_reason?: string;
    capability_display_gate_fired?: boolean;
    capability_kind?: string;
    capability_state?: string;
    capability_display_vertical?: string;
    display_entities_count?: number;
    // Wave 3 · Spoken Normalization observability
    stt_raw_length?: number;
    stt_normalized?: string;
    stt_changed?: boolean;
    stt_confidence?: "HIGH" | "MEDIUM" | "LOW";
    stt_markers?: string[];
    stt_candidate_count?: number;
    stt_self_correction?: boolean;
    stt_self_correction_kept?: string;
    stt_self_correction_rejected?: string;
    stt_code_switch?: boolean;
    stt_languages_seen?: string[];
    // Wave 3 · Social/Emotional / Confusion observability
    social_emotional_act?: string;
    social_emotional_emotion?: string;
    social_emotional_reason?: string;
    social_emotional_gate_fired?: boolean;
    social_emotional_task_fragment?: string;
    // Wave 3 · Voice Response Compression observability
    voice_compression_requested?: boolean;
    voice_compression_applied?: boolean;
    voice_compression_reduction_pct?: number;
    voice_compression_meaning_preserved?: boolean;
    voice_compressed_reply?: string;
    // Universal Entity Intelligence + Card Contract observability
    attribute_query_kind?: string;
    attribute_query_reference?: string;
    attribute_query_keyword?: string;
    attribute_query_matched_id?: string;
    attribute_query_matched_state?: string;
    attribute_query_reason?: string;
    attribute_query_gate_fired?: boolean;
    attribute_query_resolved_position?: number;
    attribute_query_resolved_name?: string;
    entity_result_cards_count?: number;
    entity_result_cards_vertical?: string;
    entity_result_cards_avg_coverage?: number;
    entity_result_cards_memoized?: boolean;
    attribute_query_memo_count?: number;
    // Universal Entity Intelligence v2 · 6-state observability
    entity_result_cards_avg_evidence_pct?: number;
    entity_result_cards_total_unverified?: number;
    entity_result_cards_total_stale?: number;
    entity_result_cards_total_conflicting?: number;
    // Business International Market Intelligence v1 observability
    business_market_gate_fired?: boolean;
    business_market_reason?: string;
    business_market_observability?: unknown;
    business_market_cards?: unknown;
  };
  const composition_meta: CompositionMeta = { ran: false, accepted: false };

  // ─── Wave 3 · Spoken Normalization (observability + advisory) ────
  // (Philip 2026-09-06 · AUTHORIZE · WAVE 3 · Capability A)
  //
  // Runs BEFORE every gate so downstream classifiers can see the
  // normalized form for higher-accuracy classification. Normalization
  // is NEVER authoritative over semantics — every existing gate that
  // consumes `message` continues to work with the raw text unchanged.
  // Observability is captured on every turn for §21 evidence.
  try {
    const stt = normalizeSpokenInput(message);
    composition_meta.stt_raw_length = stt.raw.length;
    composition_meta.stt_normalized = stt.normalized;
    composition_meta.stt_changed = stt.changed;
    composition_meta.stt_confidence = stt.confidence;
    composition_meta.stt_markers = stt.markers;
    composition_meta.stt_candidate_count = stt.candidates.length;
    composition_meta.stt_self_correction = stt.self_correction.detected;
    composition_meta.stt_self_correction_kept = stt.self_correction.kept_span ?? undefined;
    composition_meta.stt_self_correction_rejected = stt.self_correction.rejected_span ?? undefined;
    composition_meta.stt_code_switch = stt.code_switch.detected;
    composition_meta.stt_languages_seen = stt.code_switch.languages_seen;
  } catch { /* normalization must never break the response */ }

  // ─── P0.3 · Hotel Resolved-Reference Continuity ─────────────────
  // (Philip 2026-09-05 · AUTHORIZE · P0.3 CORRECTION)
  //
  // Runs BEFORE the composition gate so a resolved accommodation
  // reference can WIDEN the gate (accommodation is a structural intent
  // that would otherwise skip LLM composition; when the user drills
  // into a specific hotel via ordinal reference, we need composition
  // to run with that hotel as grounded evidence).
  //
  // DETERMINISTIC: hydration reads the actual DB record via
  // getWorldRecordById. LLM does not guess which hotel the user meant.
  // If hydration fails (record deleted, unresolved reference, wrong
  // vertical), composition falls back to normal path and the P0
  // zero-evidence guard fires when appropriate.
  //
  // SCOPE LOCKED to accommodation via verticalAllowlist. Gym / food /
  // service / commerce reference continuity are separate authorizations.
  let hydrationResult: HydrationResult = { hydrated: false, reason: "not_attempted" };
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id) {
    const preCompositionSession = getSession(conversation_id);
    const preCompositionTurn = preCompositionSession?.turnCount ?? 1;
    if (isReferenceFreshThisTurn(preCompositionSession, preCompositionTurn)) {
      hydrationResult = await hydrateResolvedReference({
        session: preCompositionSession,
        market: userMarket,
        currentTurn: preCompositionTurn,
        verticalAllowlist: ["accommodation"],
      });
      composition_meta.hydration_reason = hydrationResult.hydrated
        ? `hydrated:${hydrationResult.vertical}:${hydrationResult.record.id}`
        : `not_hydrated:${hydrationResult.reason}`;
      if (hydrationResult.hydrated) {
        composition_meta.hydrated_reference_id = hydrationResult.record.id;
        composition_meta.hydrated_reference_vertical = hydrationResult.vertical;
      }
    }
  }

  // ─── G03 · Language State Resolution ─────────────────────────────
  // (Philip 2026-09-06 · AUTHORIZE · G03)
  //
  // NEX-owned language policy. Runs BEFORE every gate so all
  // downstream reply-language decisions use the authoritative active
  // language rather than per-turn inline detections.
  //
  // Also detects explicit language-switch requests and gates them
  // with a deterministic acknowledgement in the NEW language.
  let g03State: ReturnType<typeof resolveActiveLanguage> | null = null;
  let languageSwitchGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id) {
    try {
      const switchDecision = decideLanguageSwitchGate({
        conversation_id,
        message,
      });
      g03State = switchDecision.state;
      composition_meta.active_language = g03State.active;
      composition_meta.detected_language_this_turn = g03State.detected_this_turn;
      composition_meta.language_confidence = g03State.confidence;
      composition_meta.language_source = g03State.source;
      if (switchDecision.shouldGate) {
        languageSwitchGateFired = true;
        composition_meta.language_switch_gate_fired = true;
        composition_meta.language_switched_from = switchDecision.switched_from;
        composition_meta.language_switched_to = switchDecision.switched_to;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = switchDecision.reply;
        composition_meta.reason = `boundary:language_switch:${switchDecision.switched_from}->${switchDecision.switched_to}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = switchDecision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* language state must never break the response */ }
  }

  // ─── G15 · Confirmation & Yes/No Intelligence ────────────────────
  // (Philip 2026-09-06 · AUTHORIZE · G15)
  //
  // Resolves yes/no/etc. against the last NEX proposition in session.
  // Fires the gate only when guidance is warranted:
  //   · NO_TARGET (fresh conv "yes" / no active question) → clarify
  //   · AMBIGUOUS (negated question + AFFIRM/REJECT) → clarify
  //   · CORRECTIVE ("no, restaurant") → acknowledge target
  //   · SOCIAL ("thanks" / "no thanks") → brief natural ack · no exec
  //   · UNCERTAIN ("I think so") → clarify
  //
  // Does NOT fire on:
  //   · Clean CONFIRMED / REJECTED against a clear proposition —
  //     downstream composition handles via context.
  //   · Non-confirmations (form = NONE).
  let confirmationGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !languageSwitchGateFired) {
    try {
      const confSession = getSession(conversation_id);
      const confDecision = decideConfirmationGate({
        userMessage: message,
        session: confSession,
        activeLanguage: g03State?.active ?? "EN",
      });
      composition_meta.confirmation_form = confDecision.detection.form;
      composition_meta.confirmation_answer_polarity = confDecision.detection.answer_polarity;
      composition_meta.confirmation_gate_reason = confDecision.reason;
      if ("resolution" in confDecision) {
        composition_meta.confirmation_resolution = confDecision.resolution.resolution;
        composition_meta.confirmation_active_proposition = confDecision.resolution.active_proposition?.kind;
        composition_meta.confirmation_effective_polarity = String(confDecision.resolution.effective_polarity);
      }
      if (confDecision.shouldGate) {
        confirmationGateFired = true;
        composition_meta.confirmation_gate_fired = true;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = confDecision.reply;
        composition_meta.reason = `boundary:confirmation:${confDecision.detection.form}:${confDecision.reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = confDecision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* confirmation gate must never break the response */ }
  }

  // ─── Wave 1 · Conversational Semantic Control ────────────────────
  // (Philip 2026-09-06 · AUTHORIZE · WAVE 1)
  //
  // Runs after G03 (activeLanguage available) + G15 (confirmation
  // may already have fired). Wave 1 modules produce observability
  // on EVERY turn and fire safe gates only in:
  //   · Temporal: reflective PAST/COMPLETED/NOT_YET/RECENT/CHANGE_OF_STATE
  //     with an entity mention (no fresh search on past reflections)
  //   · Quantity: fresh INCREMENTAL ("two more") or ORDINAL_RANGE
  //     ("the first two") without a result set to expand
  //   · Comparison/Ranking: fresh COMPARE/RANK/SELECT without a
  //     result set (never fabricate a ranking)
  //
  // Observability populated for downstream consumers even when gates
  // don't fire.
  let wave1GateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !languageSwitchGateFired && !confirmationGateFired) {
    try {
      const activeLang = g03State?.active ?? "EN";
      const wave1Session = getSession(conversation_id);
      const hasActiveResultSet = !!(wave1Session?.entities?.some((e) =>
        (e as unknown as { source?: string }).source === "nex_reply",
      ));

      // Temporal
      const tempDecision = decideTemporalGate({ userMessage: message, activeLanguage: activeLang });
      composition_meta.temporal_tense = tempDecision.detection.tense;
      composition_meta.temporal_entity = tempDecision.detection.entity_mention ?? undefined;

      // Quantity
      // (Conversational Continuation Slice · D3 · Philip 2026-09-06)
      // Positive-case continuation requires two extra inputs:
      //   1. `activeResultSetEntities` · already-presented entities from
      //      session so "one more" can name entities at offsets beyond
      //      the visibly-shown top-3
      //   2. `deferToTopicShift` · when this same turn also declares a
      //      DIFFERENT-vertical topic ("I need one more restaurant"
      //      after a hotel search), quantity YIELDS to the topic-shift
      //      gate — quantity continuation must not answer the wrong
      //      vertical (§F of the D3 safety table)
      const wave2SessionForQty = wave1Session;
      const activeResultSetEntities = (wave2SessionForQty?.entities ?? [])
        .filter((e) => (e as unknown as { source?: string; kind?: string }).source === "nex_reply"
                       && (e as unknown as { kind?: string }).kind === "business_name")
        .map((e) => {
          const be = e as unknown as { raw?: string; presentedOffset?: number; refId?: string };
          return {
            raw: be.raw ?? "",
            presentedOffset: be.presentedOffset,
            refId: be.refId,
          };
        })
        .filter((e) => e.raw.length > 0);
      // Pre-analyze topic-shift to decide whether quantity should defer.
      // (D3 · Conversational Continuation · Philip 2026-09-06)
      // `prior_domain_hint` is the vertical NAME (accommodation/food/…)
      // populated by analyzeScope from `inspectResultSetState` · so use
      // it directly rather than re-mapping.
      const preScopeAnalysis = analyzeScope({ message, session: wave2SessionForQty });
      let deferToTopicShift = false;
      if (preScopeAnalysis.transition === "TOPIC_SHIFT" && preScopeAnalysis.active_domain_hint) {
        const newVertical = mapDomainNounToVertical(preScopeAnalysis.active_domain_hint);
        const priorVerticalNames = new Set(["accommodation", "food", "commerce", "transport", "service", "places"]);
        const priorVertical = preScopeAnalysis.prior_domain_hint
          ? (priorVerticalNames.has(preScopeAnalysis.prior_domain_hint)
              ? preScopeAnalysis.prior_domain_hint
              : mapDomainNounToVertical(preScopeAnalysis.prior_domain_hint))
          : null;
        if (newVertical && priorVertical && newVertical !== priorVertical) {
          deferToTopicShift = true;
        }
      }
      const qtyDecision = decideQuantityGate({
        userMessage: message, hasActiveResultSet, activeLanguage: activeLang,
        activeResultSetEntities,
        visibleShownCount: 3,
        deferToTopicShift,
      });
      composition_meta.quantity_kind = qtyDecision.constraint.kind;
      composition_meta.quantity_value = qtyDecision.constraint.value;

      // Comparison/Ranking
      const crDecision = decideComparisonRankingGate({
        userMessage: message, hasActiveResultSet, activeLanguage: activeLang,
      });
      composition_meta.semantic_intent = crDecision.state.intent;
      composition_meta.semantic_attribute = crDecision.state.attribute ?? undefined;
      composition_meta.semantic_direction = crDecision.state.direction ?? undefined;
      composition_meta.semantic_count = crDecision.state.count ?? undefined;

      // Fire the FIRST applicable Wave 1 gate. Order matters for safety:
      // temporal reflections take precedence over quantity/ranking gates
      // (a past-tense reflection like "I was looking earlier" is not a
      // new quantity request).
      if (tempDecision.shouldGate) {
        wave1GateFired = true;
        composition_meta.temporal_gate_fired = true;
        composition_meta.wave1_gate_reason = `temporal:${tempDecision.reason}`;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = tempDecision.reply;
        composition_meta.reason = `boundary:${composition_meta.wave1_gate_reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = tempDecision.reply;
        composition_meta.knowledge_count = 0;
      } else if (qtyDecision.shouldGate) {
        wave1GateFired = true;
        composition_meta.quantity_gate_fired = true;
        composition_meta.wave1_gate_reason = `quantity:${qtyDecision.reason}`;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = qtyDecision.reply;
        composition_meta.reason = `boundary:${composition_meta.wave1_gate_reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = qtyDecision.reply;
        composition_meta.knowledge_count = 0;
      } else if (crDecision.shouldGate) {
        wave1GateFired = true;
        composition_meta.semantic_gate_fired = true;
        composition_meta.wave1_gate_reason = `semantic:${crDecision.reason}`;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = crDecision.reply;
        composition_meta.reason = `boundary:${composition_meta.wave1_gate_reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = crDecision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* Wave 1 must never break the response */ }
  }

  // ─── Wave 2 · Contextual Meaning & Conversational Scope ──────────
  // (Philip 2026-09-06 · AUTHORIZE · WAVE 2)
  //
  // Runs after Wave 1, before L4. Observability on every turn; safe
  // gates fire only for:
  //   · Spatial DEICTIC ("there") without antecedent → clarify
  //   · Frame/scope AMBIGUOUS ellipsis without active result set → clarify
  // Implicit constraints are observability-only (never invent thresholds).
  let wave2GateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !languageSwitchGateFired && !confirmationGateFired && !wave1GateFired) {
    try {
      const activeLang = g03State?.active ?? "EN";
      const wave2Session = getSession(conversation_id);
      const rs = inspectResultSetState(wave2Session);
      const hasSpatialAntecedent = rs.state === "ACTIVE_RESULT_SET";

      // Spatial
      const spDecision = decideSpatialGate({
        userMessage: message, hasSpatialAntecedent, activeLanguage: activeLang,
      });
      composition_meta.spatial_concept = spDecision.constraint.concept;
      composition_meta.spatial_polarity = spDecision.constraint.polarity;
      composition_meta.spatial_anchor = spDecision.constraint.anchor ?? undefined;
      composition_meta.spatial_is_change = spDecision.constraint.is_change;

      // Implicit constraints (observability-only · never gates)
      const impl = detectImplicitConstraints(message);
      composition_meta.implicit_constraint_count = impl.constraints.length;
      if (impl.constraints.length > 0) {
        composition_meta.implicit_constraints_summary = impl.constraints
          .map((c) => `${c.attribute}:${c.direction}`).join(",");
      }

      // Frame / scope
      const frDecision = decideFrameScopeGate({
        userMessage: message, session: wave2Session, activeLanguage: activeLang,
      });
      composition_meta.frame_transition = frDecision.analysis.transition;
      composition_meta.frame_active_domain = frDecision.analysis.active_domain_hint ?? undefined;
      composition_meta.frame_result_set_state = frDecision.analysis.active_result_set;
      composition_meta.frame_is_elliptical = frDecision.analysis.is_elliptical;

      // Fire FIRST applicable Wave 2 gate. Order: spatial deictic
      // (highest specificity · fabrication-risk) → frame ambiguity.
      if (spDecision.shouldGate) {
        wave2GateFired = true;
        composition_meta.spatial_gate_fired = true;
        composition_meta.wave2_gate_reason = `spatial:${spDecision.reason}`;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = spDecision.reply;
        composition_meta.reason = `boundary:${composition_meta.wave2_gate_reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = spDecision.reply;
        composition_meta.knowledge_count = 0;
      } else if (frDecision.shouldGate) {
        wave2GateFired = true;
        composition_meta.frame_gate_fired = true;
        composition_meta.wave2_gate_reason = `frame:${frDecision.reason}`;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = frDecision.reply;
        composition_meta.reason = `boundary:${composition_meta.wave2_gate_reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = frDecision.reply;
        composition_meta.knowledge_count = 0;
        // Conversational Continuation Slice · D4 (Philip 2026-09-06)
        // When the topic-shift gate fires with a vertical switch target,
        // reset the session's business-name entities and currentReference
        // so subsequent turns don't accidentally resolve against the
        // stale prior-vertical result set. Uses the existing
        // applyVerticalSwitchReset — no new memory system.
        if (frDecision.vertical_switch_target && conversation_id) {
          try {
            const stale = getSession(conversation_id);
            if (stale) {
              upsertSession(applyVerticalSwitchReset(stale));
              composition_meta.wave2_gate_reason = `${composition_meta.wave2_gate_reason}:reset_applied`;
            }
          } catch { /* reset must never break the response */ }
        }
      }
    } catch { /* Wave 2 must never break the response */ }
  }

  // ─── Conversational Function / Social-Turn Protection Gate ──────
  // (Philip 2026-09-06 · AUTHORIZE · Conversational Function Reclassification)
  //
  // INVARIANT: CURRENT TURN MEANING > STALE PREVIOUS RESPONSE PATH.
  //
  // Runs above every other composition gate. If the current turn is a
  // NEW conversational act — social greeting/farewell, gratitude,
  // personal-context offer/statement, meta-conversation — override
  // any stale task-response inheritance from prior turns with a
  // deterministic natural reply. Never fabricates.
  //
  // Gate is delegation-aware: result_provenance_followup messages are
  // routed to the existing Result-Follow-Up gate below (this gate's
  // classifier returns RESULT_FOLLOW_UP · not gated here).
  //
  // Only fires for 5 explicitly-authorized functions per §15
  // ("do not overcorrect"): SOCIAL_UTTERANCE · GRATITUDE ·
  // PERSONAL_CONTEXT_OFFER · PERSONAL_CONTEXT_STATEMENT ·
  // META_CONVERSATION. Task requests, information questions,
  // confirmations, topic shifts, corrections, clarifications flow
  // through the existing pipeline unchanged.
  let conversationalFunctionGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && !languageSwitchGateFired && !confirmationGateFired && !wave1GateFired && !wave2GateFired) {
    const cfDecision = decideConversationalFunctionGate({ userMessage: message });
    composition_meta.conv_function_detected = cfDecision.detection.function;
    composition_meta.conv_function_confidence = cfDecision.detection.confidence;
    composition_meta.conv_function_reason = cfDecision.reason;
    if (cfDecision.shouldGate) {
      conversationalFunctionGateFired = true;
      composition_meta.conv_function_gate_fired = true;
      composition_meta.accepted = true;
      composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
      composition_meta.composed_reply = cfDecision.reply;
      composition_meta.reason = `boundary:conv_function:${cfDecision.detection.function}:${cfDecision.detection.reason}`;
      composition_meta.post_composition_audit_ran = false;
      composed.reply = cfDecision.reply;
      // Explicitly clear knowledge count · the current turn is not a
      // knowledge-retrieval turn and any prior hits are stale.
      composition_meta.knowledge_count = 0;
    }
  }

  // ─── G23 · User-Fact Memory · detect + write on every turn ─────
  // (Philip 2026-09-06 · AUTHORIZE · G23)
  //
  // Consumes L4 dialogue-act (only ASSERTION-family creates
  // candidates) and G12 polarity (AFFIRMATIVE creates positive facts,
  // NEGATED retracts prior facts with matching subject). Runs even
  // when an L4 conv-function gate fires — the user is still providing
  // information even if the RESPONSE is gated. Memory writes never
  // affect the composed reply.
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id) {
    try {
      const cfDetection = classifyConversationalFunction(message);
      const polarity = cfDetection.polarity.polarity;
      if (polarity === "AFFIRMATIVE") {
        const candidates = detectUserFactCandidates({
          message,
          dialogueFunction: cfDetection.function,
          polarity,
        });
        composition_meta.memory_candidates_count = candidates.length;
        if (candidates.length > 0) {
          const w = writeUserFacts(candidates, conversation_id, message);
          composition_meta.memory_written_count = w.written.length;
          composition_meta.memory_superseded_count = w.superseded.length;
        }
      } else if (polarity === "NEGATED" || polarity === "CONTRASTIVE") {
        // G12 retraction path · negated user-fact assertions retract
        // matching prior positive facts. E.g. "I don't run a
        // restaurant anymore" retracts the prior role fact.
        const retractionSubjects = detectRetractionSubjects(message);
        let retracted = 0;
        for (const rs of retractionSubjects) {
          const r = supersedeMatchingFacts({
            conversation_id,
            fact_type: rs.fact_type,
            subject: rs.subject,
            source_turn_text: message,
          });
          retracted += r.length;
        }
        composition_meta.memory_retracted_count = retracted;
        composition_meta.memory_candidates_count = retractionSubjects.length;
      } else {
        composition_meta.memory_candidates_count = 0;
      }
    } catch { /* memory writes must never break the response */ }
  }

  // ─── G23 · Memory-Question Gate ─────────────────────────────────
  // Deterministic reply from the store when the user explicitly asks
  // what NEX remembers. Never fabricates; always cites stored facts.
  let memoryGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !conversationalFunctionGateFired && !languageSwitchGateFired && !confirmationGateFired && !wave1GateFired && !wave2GateFired) {
    try {
      const memDecision = decideMemoryReply({
        userMessage: message,
        conversation_id,
      });
      composition_meta.memory_gate_reason = memDecision.reason;
      if (memDecision.shouldReply) {
        memoryGateFired = true;
        composition_meta.memory_gate_fired = true;
        composition_meta.memory_retrieved_count = memDecision.retrieved.length;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = memDecision.reply;
        composition_meta.reason = `boundary:memory_gate:${memDecision.kind}:${memDecision.reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = memDecision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* memory gate must never break the response */ }
  }

  // ─── Wave 7 · Conversational Entity Reasoning ───────────────────
  // (Philip 2026-09-06 · CEREMONIAL AUTHORIZE ·
  //  Integration Recovery 2026-09-06: reordered above attribute-query)
  //
  // Handles the 10 reasoning-level dialogue acts (ENTITY_*_REQUEST):
  // recommendation · comparison · pros/cons · best-for · suitability ·
  // ranking · why · what-don't-you-know · evidence-request · opinion.
  //
  // Runs BEFORE the attribute-query / interest / social / capability /
  // result-followup gates so a semantic reasoning act like
  // "what are you basing that on?" is not intercepted by the attribute-
  // query LIST_ATTRIBUTES_OF starter ["what","are"] + pronoun "that".
  //
  // Semantic priority (founder rule): SEMANTIC INTENT >
  //   REASONING / EVIDENCE REQUEST > ATTRIBUTE QUERY.
  //
  // Ordinary attribute questions ("does it have a pool?", "which has
  // laundry?") classify via classifyDecisionIntent as NONE and pass
  // straight through to the attribute-query gate unchanged.
  //
  // Never fabricates: all claims decompose to evidence; unsupported
  // claims are filtered before rendering.
  let entityReasoningGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !conversationalFunctionGateFired && !memoryGateFired
      && !languageSwitchGateFired && !confirmationGateFired
      && !wave1GateFired && !wave2GateFired) {
    try {
      const { classifyDecisionIntent } = await import("@/lib/nex/brain/reasoning/decision-intent");
      const { composeReasoning } = await import("@/lib/nex/brain/reasoning/entity-reasoning");
      const { renderReasoningReply } = await import("@/lib/nex/brain/reasoning/reasoning-reply");
      const decision = classifyDecisionIntent(message);
      composition_meta.entity_reasoning_kind = decision.kind;
      if (decision.kind !== "NONE") {
        const erSession = getSession(conversation_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memo = (erSession as any)?.entityCardMemo as import("@/lib/nex/brain/entity-result-cards").EntityCardMemo[] | undefined;
        const activeLang: "EN" | "ID" = decision.language === "ID" ? "ID"
          : (g03State?.active === "ID" ? "ID" : "EN");
        // Explicit-only user context (§4)
        const userContext = { explicit_facts: {}, current_turn_preferences: [] };
        const payload = composeReasoning({
          intent: decision.kind,
          language: activeLang,
          entityCardMemo: memo,
          userContext,
        });
        composition_meta.entity_reasoning_has_result_set = payload.has_active_result_set;
        composition_meta.entity_reasoning_claim_count = payload.claims.length;
        composition_meta.entity_reasoning_missing_evidence_count = payload.missing_evidence.length;
        composition_meta.entity_reasoning_recommendation = payload.recommendation?.winner_name;
        const rendered = renderReasoningReply(payload);
        if (rendered.shouldReply && rendered.reply.trim().length > 0) {
          entityReasoningGateFired = true;
          composition_meta.entity_reasoning_gate_fired = true;
          composition_meta.entity_reasoning_reason = rendered.reason;
          composition_meta.accepted = true;
          composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
          composition_meta.composed_reply = rendered.reply;
          composition_meta.reason = `boundary:entity_reasoning:${decision.kind}:${rendered.reason}`;
          composition_meta.post_composition_audit_ran = false;
          composed.reply = rendered.reply;
          composition_meta.knowledge_count = 0;
        }
      }
    } catch { /* reasoning gate must never break the response */ }
  }

  // ─── Universal Entity Attribute Query Gate ───────────────────────
  // (Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE)
  //
  // Answers "does the first one have a pool?" · "which one has laundry?"
  // · "tell me more about the second one" · "do any have breakfast?"
  // from the session's memoized EntityCardMemo — never fabricates.
  //
  // Runs AFTER entity-reasoning (semantic reasoning acts like
  // "what are you basing that on?" win first), Wave 2 (frame/scope),
  // G23 memory, L4 conv-function. Runs BEFORE the social-emotional /
  // capability-display / result-followup gates so an attribute question
  // never routes to CAPABILITY_QUESTION or CONFUSION by mistake.
  //
  // Requires vertical + card memo · fresh conversations without prior
  // results emit an honest no-anchor boundary.
  let attributeQueryGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !conversationalFunctionGateFired && !memoryGateFired
      && !entityReasoningGateFired
      && !languageSwitchGateFired && !confirmationGateFired
      && !wave1GateFired && !wave2GateFired) {
    try {
      const aqSession = getSession(conversation_id);
      const aqLang = g03State?.active ?? "EN";
      // Wave 6 · viewed-entity augmentation (Philip 2026-09-06)
      // When the user just returned from a detail page, prepend the
      // viewed entity's memoized attribute state to entityCardMemo so a
      // pronoun follow-up like "does it have a pool?" resolves against
      // the entity the user was viewing (not the first ordinal). Never
      // fabricates the memo; falls through to standard memo when the
      // viewed entity is stale or lacks a memo.
      let aqEffectiveSession = aqSession;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const viewed = (aqSession as any)?.viewedEntity as import("@/lib/nex/brain/universal-discovery/viewed-entity").ViewedEntitySnapshot | undefined;
      if (viewed && viewed.memo && aqSession) {
        const aqCurrentTurn = aqSession.turnCount ?? 1;
        const { isViewedEntityFresh } = await import("@/lib/nex/brain/universal-discovery/viewed-entity");
        if (isViewedEntityFresh(viewed, aqCurrentTurn)) {
          const priorMemo = Array.isArray(aqSession.entityCardMemo) ? aqSession.entityCardMemo : [];
          const isAlreadyFirst = priorMemo[0]?.ref_id === viewed.memo.ref_id;
          if (!isAlreadyFirst) {
            const augmented = [viewed.memo, ...priorMemo].slice(0, 3);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            aqEffectiveSession = { ...aqSession, entityCardMemo: augmented } as any;
            composition_meta.attribute_query_reason = `viewed_entity_prepended:${viewed.ref_id}`;
          }
        }
      }
      const aqMemo = (aqEffectiveSession as unknown as { entityCardMemo?: unknown[] })?.entityCardMemo;
      composition_meta.attribute_query_memo_count = Array.isArray(aqMemo) ? aqMemo.length : 0;
      const aqDecision = decideAttributeQueryGate({
        userMessage: message,
        session: aqEffectiveSession,
        activeLanguage: aqLang,
      });
      composition_meta.attribute_query_kind = aqDecision.detection.kind;
      composition_meta.attribute_query_reference = aqDecision.detection.reference;
      composition_meta.attribute_query_keyword = aqDecision.detection.keyword ?? undefined;
      composition_meta.attribute_query_matched_id = aqDecision.detection.matched_attribute_id ?? undefined;
      composition_meta.attribute_query_reason = aqDecision.reason;
      if (aqDecision.shouldGate) {
        attributeQueryGateFired = true;
        composition_meta.attribute_query_gate_fired = true;
        composition_meta.attribute_query_matched_state = aqDecision.matched_state ?? undefined;
        composition_meta.attribute_query_resolved_position = aqDecision.resolved_position ?? undefined;
        composition_meta.attribute_query_resolved_name = aqDecision.resolved_entity_name ?? undefined;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = aqDecision.reply;
        composition_meta.reason = `boundary:attribute_query:${aqDecision.detection.kind}:${aqDecision.reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = aqDecision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* attribute-query gate must never break the response */ }
  }

  // ─── Interest Gate · Entity → Interest → Owner Conversation ─────
  // (Philip 2026-09-06 · CEREMONIAL AUTHORIZE · Interest Slice ·
  //  Integration Recovery 2026-09-06: guard now also gates on
  //  !entityReasoningGateFired since reasoning moved above)
  //
  // Handles the "I'm interested" / "I want to contact them" / "bisa
  // hubungi mereka" semantic act. Runs AFTER entity-reasoning (a
  // reasoning act wins first when applicable) and AFTER attribute-
  // query. G12 negation preserved · verified-contact rule (§3 · §4)
  // preserved · never fabricates a contact route or auto-sends.
  let interestGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !conversationalFunctionGateFired && !memoryGateFired
      && !attributeQueryGateFired && !entityReasoningGateFired
      && !languageSwitchGateFired && !confirmationGateFired
      && !wave1GateFired && !wave2GateFired) {
    try {
      const { decideInterestGate } = await import("@/lib/nex/brain/interest/interest-gate");
      const { getWorldRecordById } = await import("@/lib/nex/brain/world-adapters");
      const { parseRefId } = await import("@/lib/nex/brain/reference-hydration");
      const igSession = getSession(conversation_id);
      const igLang: "EN" | "ID" = g03State?.active === "ID" ? "ID" : "EN";
      const decision = await decideInterestGate({
        message,
        session: igSession,
        activeLanguage: igLang,
        fetchRecord: async (refId: string) => {
          const parsed = parseRefId(refId);
          if (!parsed) return null;
          try {
            return await getWorldRecordById({
              vertical: parsed.vertical,
              id: parsed.id,
              market: userMarket,
            });
          } catch { return null; }
        },
      });
      composition_meta.interest_intent_kind = decision.intent.kind;
      composition_meta.interest_gate_reason = decision.reason;
      if (decision.shouldGate) {
        interestGateFired = true;
        composition_meta.interest_gate_fired = true;
        composition_meta.interest_gate_kind = decision.kind;
        composition_meta.interest_entity_ref_id = decision.entity_ref_id;
        composition_meta.interest_entity_name = decision.entity_name;
        composition_meta.interest_contactability = decision.contactability?.state;
        composition_meta.interest_send_enabled = decision.contactability?.interest_send_enabled ?? false;
        composition_meta.interest_open_url = decision.open_url;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = decision.reply;
        composition_meta.reason = `boundary:interest:${decision.kind}:${decision.reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = decision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* interest gate must never break the response */ }
  }

  // ─── Wave 3 · Social / Emotional / Confusion Gate ────────────────
  // (Philip 2026-09-06 · AUTHORIZE · WAVE 3 · Capabilities C, D)
  //
  // Detects three additional dialogue acts that existing L4 conv-
  // function does not cover:
  //   · EMOTIONAL_REACTION   "wow" · "nice" · "mantap" · "aduh"
  //   · CONFUSION            "huh?" · "what do you mean?" · "aku bingung"
  //   · SOCIAL_PLUS_TASK     "nice, now show me the second one"
  //
  // Fires ONLY for EMOTIONAL_REACTION and CONFUSION — pure social /
  // emotional / confused utterances that must NEVER trigger a new
  // search or re-emit stale "found N" results.
  //
  // SOCIAL_PLUS_TASK is observability-only — §7 mandates BOTH the
  // social meaning AND the task must survive, so we do NOT gate; we
  // let the existing pipeline handle the task portion and just record
  // the social preamble.
  //
  // Runs AFTER L4 conv-function so L4's SOCIAL_UTTERANCE / GRATITUDE
  // detection wins when applicable · runs BEFORE capability-display so
  // "wow" doesn't get classified as a display request.
  let socialEmotionalGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && conversation_id
      && !conversationalFunctionGateFired && !memoryGateFired
      && !attributeQueryGateFired && !interestGateFired && !entityReasoningGateFired
      && !languageSwitchGateFired && !confirmationGateFired
      && !wave1GateFired && !wave2GateFired) {
    try {
      const seSession = getSession(conversation_id);
      const seActiveLang = g03State?.active ?? "EN";
      const seDecision = decideSocialEmotionalGate({
        userMessage: message,
        session: seSession,
        activeLanguage: seActiveLang,
      });
      composition_meta.social_emotional_act = seDecision.detection.act;
      composition_meta.social_emotional_emotion = seDecision.detection.emotion;
      composition_meta.social_emotional_reason = seDecision.reason;
      if (seDecision.detection.task_fragment) {
        composition_meta.social_emotional_task_fragment = seDecision.detection.task_fragment;
      }
      if (seDecision.shouldGate) {
        socialEmotionalGateFired = true;
        composition_meta.social_emotional_gate_fired = true;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = seDecision.reply;
        composition_meta.reason = `boundary:social_emotional:${seDecision.detection.act}:${seDecision.reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = seDecision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* social/emotional gate must never break the response */ }
  }

  // ─── Capability & Display Intelligence Gate ─────────────────────
  // (Philip 2026-09-06 · AUTHORIZE · ACCOMMODATION PROVENANCE, BOOKING
  //  SEMANTICS & FOLLOW-UP CONVERSATION FIX)
  //
  // INVARIANTS
  //   §6  SOURCE ≠ CAPABILITY. Whether NEX can perform an action for a
  //       listing is a separate, evidence-grounded question from where
  //       the listing was sourced.
  //   §10 A dialogue-act reset after a provenance answer must be
  //       recognised. "what do you mean I can't book?" and "ok so let's
  //       see them" are CURRENT acts — they must override any stale
  //       search-result inheritance from prior turns.
  //   §11 A display request against an existing result set must
  //       re-emit that result set — not trigger a new search and not
  //       re-emit the "found 3" acknowledgement.
  //
  // Runs BEFORE result-followup so a capability clarification about a
  // prior provenance answer is not reclassified as another provenance
  // question. Runs AFTER L4 conv-function, G23 memory, G03 language,
  // G15 confirmation, Wave 1 and Wave 2 so those higher-priority
  // signals still win when applicable.
  let capabilityDisplayGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && !conversationalFunctionGateFired && !memoryGateFired && !attributeQueryGateFired && !interestGateFired && !entityReasoningGateFired && !socialEmotionalGateFired && !languageSwitchGateFired && !confirmationGateFired && !wave1GateFired && !wave2GateFired) {
    try {
      const capSession = conversation_id ? getSession(conversation_id) : null;
      const capActiveLang = g03State?.active ?? "EN";
      const capDecision = decideCapabilityDisplayGate({
        userMessage: message,
        session: capSession,
        activeLanguage: capActiveLang,
      });
      composition_meta.capability_display_act = capDecision.detection.act;
      composition_meta.capability_display_reason = capDecision.reason;
      if (capDecision.shouldGate) {
        capabilityDisplayGateFired = true;
        composition_meta.capability_display_gate_fired = true;
        composition_meta.capability_kind = capDecision.detection.capability_kind ?? undefined;
        composition_meta.capability_state = capDecision.capability_state ?? undefined;
        composition_meta.capability_display_vertical = capDecision.inferred_vertical ?? undefined;
        composition_meta.display_entities_count = capDecision.display_entity_count ?? undefined;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = capDecision.reply;
        composition_meta.reason = `boundary:capability_display:${capDecision.detection.act}:${capDecision.reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = capDecision.reply;
        composition_meta.knowledge_count = 0;
      }
    } catch { /* capability/display gate must never break the response */ }
  }

  // ─── P0 · Result-Follow-Up Provenance Guard (INTENT-INDEPENDENT) ─
  // (Philip 2026-09-05 · AUTHORIZE · RESULT-FOLLOW-UP PROVENANCE §1)
  //
  // INVARIANT: A follow-up question about an existing result set must
  // remain anchored to that result set, EVEN WHEN THE FOLLOW-UP USES
  // DIFFERENT CONVERSATIONAL INTENT.
  //
  // MUST RUN BEFORE THE COMPOSITION GATE. The composition block is
  // skipped for structural accommodation intent when the message does
  // not match INFORMATION_QUERY_RX. That means an in-composition-block
  // gate cannot see "where you find them" or "where are these from?"
  // — they never reach it, and the deterministic accommodation
  // composer re-emits the T1 list-reply (the proven regression).
  //
  // Running here makes the gate intent-independent: any provenance
  // follow-up gets a provenance answer regardless of how the intent
  // classifier routed the message.
  let resultFollowupFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && !conversationalFunctionGateFired && !memoryGateFired && !attributeQueryGateFired && !interestGateFired && !entityReasoningGateFired && !socialEmotionalGateFired && !capabilityDisplayGateFired && !languageSwitchGateFired && !confirmationGateFired && !wave1GateFired && !wave2GateFired) {
    const preFollowupSession = conversation_id ? getSession(conversation_id) : null;
    const followupOwnerLanguage: "en" | "id" =
      /[a-z]/i.test(message) &&
      !/\b(apa|siapa|dimana|bagaimana|selamat|kenapa|halo|hai|iya|saya|anda|kamu|ceritakan|tentang|belum|tidak|ingin|yang|mana|adalah|akan|sudah|jadi|juga|itu|ini|dengan|pada|untuk)\b/i.test(message.toLowerCase())
        ? "en"
        : "id";
    const followupDecision = decideResultFollowupGate({
      userMessage: message,
      session: preFollowupSession,
      ownerLanguage: followupOwnerLanguage,
    });
    composition_meta.result_followup_fired = followupDecision.shouldGate;
    composition_meta.result_followup_reason = followupDecision.reason;
    if (followupDecision.shouldGate) {
      resultFollowupFired = true;
      composition_meta.result_followup_vertical = followupDecision.inferred_vertical;
      composition_meta.result_followup_from_evidence = followupDecision.provenance_from_evidence;
      composition_meta.accepted = true;
      composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
      composition_meta.composed_reply = followupDecision.reply;
      composition_meta.reason = `boundary:result_followup:${followupDecision.reason}`;
      composition_meta.post_composition_audit_ran = false;
      composed.reply = followupDecision.reply;
    }
  }

  // ─── Business International Market Intelligence v1 gate ────────
  // (Philip 2026-09-06 · CEREMONIAL AUTHORIZE · BUSINESS v1)
  //
  // Fires only when a business_id is attached to the request AND the
  // message contains a commercial signal (FIND_* objective / send /
  // draft). Deterministically refuses autonomous send actions (§10 §30).
  // Emits honest zero-evidence replies when no companies are stored
  // for the target market (§13 §33 · no fabrication).
  //
  // Runs AFTER every conversational gate so social replies, memory,
  // capability-display, and result-followup keep priority when they
  // apply. Isolated from accommodation and Programmer agents.
  let businessMarketGateFired = false;
  if (P0_COMPOSITION_ENABLED && !isUkStaircase && !conversationalFunctionGateFired && !memoryGateFired && !attributeQueryGateFired && !interestGateFired && !entityReasoningGateFired && !socialEmotionalGateFired && !capabilityDisplayGateFired && !resultFollowupFired && !languageSwitchGateFired && !confirmationGateFired && !wave1GateFired && !wave2GateFired) {
    try {
      const bmSession = conversation_id ? getSession(conversation_id) : null;
      const bmLang = g03State?.active ?? "EN";
      const bmDecision = decideBusinessMarketGate({
        userMessage: message,
        session: bmSession,
        activeLanguage: bmLang,
        business_id: body.business_id ?? null,
      });
      composition_meta.business_market_reason = bmDecision.reason;
      composition_meta.business_market_observability = bmDecision.observability;
      if (bmDecision.shouldGate) {
        businessMarketGateFired = true;
        composition_meta.business_market_gate_fired = true;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = bmDecision.reply;
        composition_meta.reason = `boundary:business_market:${bmDecision.reason}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = bmDecision.reply;
        if (bmDecision.cards) {
          composition_meta.business_market_cards = bmDecision.cards;
        }
        composition_meta.knowledge_count = bmDecision.observability.companies_retrieved;
      }
    } catch { /* business gate must never break the response */ }
  }

  if (P0_COMPOSITION_ENABLED && !isUkStaircase && !conversationalFunctionGateFired && !memoryGateFired && !attributeQueryGateFired && !interestGateFired && !entityReasoningGateFired && !socialEmotionalGateFired && !capabilityDisplayGateFired && !resultFollowupFired && !businessMarketGateFired && !languageSwitchGateFired && !confirmationGateFired && !wave1GateFired && !wave2GateFired && (shouldComposeOpenKnowledge(composed, message) || hydrationResult.hydrated)) {
    composition_meta.ran = true;
    // P0.2 · Record whether gate widened for a misrouted info query.
    // Used by the after-runner to prove gap #1 / #2 improvements.
    const structuralIntents = new Set(["commerce", "accommodation", "booking", "marketplace"]);
    const worldCardsPresent = !!composed.world_cards && ((composed.world_cards.count ?? composed.world_cards.cards?.length ?? 0) > 0);
    composition_meta.widened_for_information_query =
      worldCardsPresent || (typeof composed.intent === "string" && structuralIntents.has(composed.intent));
    try {
      const sess = conversation_id ? getSession(conversation_id) : null;
      const marketForFrame: "ID" | "UK" | "US" | "UNIVERSAL" = userMarket;
      const frame = deriveFrame(sess, marketForFrame);
      composition_meta.frame_topic = frame.running_topic;
      composition_meta.frame_subject = frame.running_subject;
      // Retrieve with a slightly broader net than the gate's own pass ·
      // composition benefits from more context to reason over. Never
      // fabricates from these · claim-verifier enforces.
      // Also expand retrieval query with the running_topic so bare
      // follow-ups ("and yogyakarta?") retrieve on the actual subject.
      const retrievalQuery = [message, frame.running_topic, frame.running_subject]
        .filter(Boolean)
        .join(" ");
      const seedHits = retrieveKnowledge(retrievalQuery, {
        market: userMarket,
        limit: 6,
        minConfidence: 0.5,
      });
      // S3 · Directory-aware knowledge tier (Philip 2026-09-05).
      // Parallel to the seed/walker retrieval · surfaces LISTED
      // accommodation/service/food/commerce/transport rows as
      // composable knowledge for the LLM's RAG context. Bounded
      // latency (750ms hard cap) · fail-safe (returns [] on error).
      const dirHits = await retrieveDirectoryAsKnowledge(retrievalQuery, {
        market: userMarket,
        perVerticalLimit: 2,
        timeoutMs: 750,
      });
      // Merge · de-duplicate by id · retain seed-first ordering.
      const seenIds = new Set(seedHits.map((h) => h.id));
      const hits = [...seedHits];
      for (const d of dirHits) {
        if (!seenIds.has(d.id)) { hits.push(d); seenIds.add(d.id); }
      }
      // P0.3 · Prepend hydrated resolved-reference record as first-
      // priority grounded evidence (Philip 2026-09-05 · P0.3 CORRECTION).
      // Comes BEFORE seed/directory hits so the composer sees it as the
      // canonical subject of this turn. Only fires when the caller
      // successfully hydrated a real DB record — never fabricated.
      if (hydrationResult.hydrated) {
        const hydratedKnowledge = hydratedRecordToKnowledge(hydrationResult.record);
        if (!seenIds.has(hydratedKnowledge.id)) {
          hits.unshift(hydratedKnowledge);
          seenIds.add(hydratedKnowledge.id);
        }
      }
      composition_meta.knowledge_count = hits.length;

      // ─── G24 · Scope-Validated Evidence Guard ────────────────────
      // (Philip 2026-09-05 · AUTHORIZE · NEX G24)
      //
      // INVARIANT: RETRIEVAL PRESENCE ≠ EVIDENCE PRESENCE.
      //
      // The existing P0 zero-evidence guard fires only when k=0. This
      // gate handles the k>0-but-irrelevant case that produced the
      // known fabrication regressions (Speaking Intelligence Audit
      // G24): "seafood in Japan" → k=6 Indonesian food hits →
      // fabricated Japanese seafood claims; "Michelin restaurant in
      // Semarang" → k=8 loose hits → fabricated "Restoran Sinar Mas".
      //
      // When the question pins a named anchor (place / brand / proper
      // noun) that the retrieval does not cover at word-boundary,
      // the retrieval is NOT scope-valid evidence. Empty the hits and
      // let the existing zero-evidence guard fire an honest boundary.
      // No new fabrication path is added. No per-case keyword rule.
      let scopeGateFired = false;
      if (hits.length > 0) {
        const scopeDecision = decideScopeGate({ message, records: hits });
        composition_meta.scope_validation_status = scopeDecision.validation.status;
        composition_meta.scope_validation_reason = scopeDecision.validation.reason;
        composition_meta.scope_covered_anchors = scopeDecision.validation.evidence_scope.covered_anchors;
        composition_meta.scope_missing_anchors = scopeDecision.validation.evidence_scope.missing_anchors;
        if (scopeDecision.shouldGate) {
          scopeGateFired = true;
          composition_meta.scope_gate_fired = true;
          // Emit a deterministic honest boundary AND clear hits so no
          // downstream path can invoke the LLM composer on scope-invalid
          // evidence. The reply is voice-safe and names only real anchors
          // from the question — never fabricates a specific claim.
          const gateOwnerLanguage: "en" | "id" =
            /[a-z]/i.test(message) &&
            !/\b(apa|siapa|dimana|bagaimana|selamat|kenapa|halo|hai|iya|saya|anda|kamu|ceritakan|tentang|belum|tidak|ingin|yang|mana|adalah|akan|sudah|jadi|juga|itu|ini|dengan|pada|untuk)\b/i.test(message.toLowerCase())
              ? "en"
              : "id";
          const boundaryReply = buildScopeBoundaryReply(scopeDecision.validation, gateOwnerLanguage);
          composition_meta.accepted = true;
          composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
          composition_meta.composed_reply = boundaryReply;
          composition_meta.reason = `boundary:scope_gate:${scopeDecision.validation.reason}`;
          composition_meta.post_composition_audit_ran = false;
          composed.reply = boundaryReply;
          hits.length = 0;
          composition_meta.knowledge_count = 0;
        }
      }

      // ─── P0.4 · Fresh-Conversation Ordinal Contamination Guard ──
      // (Philip 2026-09-05 · AUTHORIZE · P0.4 CORRECTION)
      //
      // INVARIANT: ordinal/deictic reference requires a valid
      // conversational anchor. Without an anchor, a lexical match
      // in retrieval MUST NOT become the conversational referent.
      //
      // Proven defect (pre-fix): fresh conversation · "Tell me about
      // the first hotel." → composition composed "The first hotel in
      // the conversation is Griya Sentana..." manufacturing context.
      //
      // If gate fires: discard retrieved hits · emit honest boundary
      // asking clarification · preserve the P0 zero-evidence guard
      // discipline (fresh k=0 semantics continue below).
      //
      // Gate does NOT fire when session has an anchor (P0.3 hydration
      // path takes over) OR when message is an explicit entity search
      // ("Find First Living Hotel" — proper-noun compound, not adjacent
      // to a category noun after an ordinal).
      const preOrdinalSession = conversation_id ? getSession(conversation_id) : null;
      // If result-followup already emitted a boundary reply, skip the
      // ordinal gate entirely — the reply is already set. A synthesized
      // "no-op" gate result keeps downstream branches structurally sound.
      // Result-followup gate is intent-independent and lives above the
      // composition block. If it already fired, composition_ran is
      // false and we never reach here — but keeping the defensive
      // check makes control flow legible in isolation.
      const ordinalGate = decideOrdinalGate({
        userMessage: message,
        session: preOrdinalSession,
      });
      composition_meta.ordinal_gate_fired = ordinalGate.shouldGate;
      composition_meta.ordinal_gate_reason = ordinalGate.reason;
      if (ordinalGate.shouldGate) {
        composition_meta.ordinal_matched_phrase = ordinalGate.detection.matched_phrase;
        composition_meta.accepted = true;
        composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
        composition_meta.composed_reply = ordinalGate.boundary_reply;
        composition_meta.reason = `boundary:ordinal_no_anchor:${ordinalGate.reason}:phrase=${ordinalGate.detection.matched_phrase}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = ordinalGate.boundary_reply;
        // Clear the knowledge count · retrieved hits are NOT valid
        // referents for this turn.
        composition_meta.knowledge_count = 0;
      }

      // ─── P0 · Zero-Evidence Fabrication Guard ────────────────────
      // (Philip 2026-09-05 · chief-engineer AUTHORIZE · P0 CORRECTION)
      //
      // NEX HIERARCHY: NEX-owned retrieval + evidence state is
      // authoritative. If retrieval returned NO grounded knowledge for
      // this turn AND the user is asking about a substantive subject,
      // the LLM composer MUST NOT be invoked (proven FOOD T4 reproduction:
      // k_count=0 + "What about Japan?" → LLM fabricated sushi/sashimi/
      // ramen claims). Instead, NEX composes an honest boundary reply
      // deterministically.
      //
      // Gate/verifier separation preserved: this is a PRE-composition gate
      // (should composition run?); the claim verifier is POST-composition
      // (are the composed claims supported?). Both mechanisms remain
      // distinct — this gate does not replace the verifier for cases where
      // composition DOES proceed.
      //
      // NOT an over-broad kill switch: only fires when a SUBJECT can be
      // extracted from the message. "What do you think?" / "Hi" / meta
      // questions have no subject and pass through to normal composition.
      composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
      // If the P0.4 ordinal gate already emitted a boundary this turn,
      // short-circuit — P0 zero-evidence + LLM composition MUST NOT run
      // (they would overwrite the ordinal boundary reply). The `applies:false`
      // sentinel drives the existing if/else structure down the else path
      // where the LLM block is guarded by an additional shouldGate check.
      const boundaryDecision = (scopeGateFired || ordinalGate.shouldGate)
        ? ({ applies: false as const, reason: scopeGateFired ? "scope_gate_already_fired" : "ordinal_gate_already_fired" } as const)
        : decideHonestBoundary({
            userMessage: message,
            hasGroundedKnowledge: hits.length > 0,
          });
      if (boundaryDecision.applies) {
        composition_meta.accepted = true;
        composition_meta.composed_reply = boundaryDecision.reply;
        composition_meta.reason = `boundary:zero_evidence:${boundaryDecision.reason}:subject=${boundaryDecision.subject}`;
        composition_meta.post_composition_audit_ran = false;
        composed.reply = boundaryDecision.reply;
        // Skip the compose-and-verify block below · deterministic
        // boundary text is NEX-authored and does not need LLM claim
        // verification (nothing was composed by an LLM).
      } else if (scopeGateFired) {
        // G24 · Scope-validated gate already emitted the boundary reply
        // above. Do NOT run LLM composition — the retrieval was
        // scope-invalid, and the LLM would fabricate on empty context.
      } else if (ordinalGate.shouldGate) {
        // P0.4 · Ordinal gate already emitted the boundary reply above.
        // Do NOT run LLM composition — it would overwrite composed.reply
        // and potentially fabricate context we've just refused to build.
      } else {
        // Fall through to normal composition · rest of block wrapped
        // in this else via the extension below.
      const knowledge = hits.map((h) => ({
        topic: h.topic,
        content: h.content,
        source: h.source,
        region: h.region,
        last_verified: h.last_verified,
        stability: h.stability,
        score: (h as { score?: number }).score,
        // P1 · Evidence-first contradictions (Philip 2026-09-05 P1 doctrine).
        // Passed through so claim-verifier's checkExplicitContradictions
        // can hard-reject any composed predicate the record itself denies.
        contradictions: (h as { contradictions?: string[] }).contradictions,
      }));
      const knownEntities: string[] = [];
      if (composed.meta_cognition?.whatIKnow?.entitiesSeen && typeof composed.meta_cognition.whatIKnow.entitiesSeen === "object") {
        // Best-effort: entitiesSeen is { total, byKind: {kind: [names]} }
        const byKind = (composed.meta_cognition.whatIKnow.entitiesSeen as { byKind?: Record<string, unknown> }).byKind ?? {};
        for (const values of Object.values(byKind)) {
          if (Array.isArray(values)) {
            for (const v of values) if (typeof v === "string") knownEntities.push(v);
          }
        }
      }
      const worldCardNames: string[] = [];
      if (composed.world_cards?.cards && Array.isArray(composed.world_cards.cards)) {
        for (const c of composed.world_cards.cards) {
          const name = (c as { title?: string; name?: string })?.title ?? (c as { name?: string })?.name;
          if (typeof name === "string") worldCardNames.push(name);
        }
      }
      // G03 · use the NEX-owned active conversational language.
      // Falls back to the legacy per-turn inline detection only if the
      // language state resolution didn't run (e.g. no conversation_id).
      const ownerLanguage: "en" | "id" = g03State
        ? langToOwnerLanguage(g03State.active)
        : (/[a-z]/i.test(message) && !/apa|siapa|dimana|bagaimana|selamat|kenapa|halo|hai|iya/i.test(message.toLowerCase())
            ? "en"
            : "id");
      // baseline_reply already captured before boundary decision above
      const comp = await composeReplyViaLocalLLM({
        message,
        frame,
        knowledge,
        intent: composed.intent,
        brain_reply: composed.reply,
        known_entities: knownEntities.slice(0, 20),
        owner_language: ownerLanguage,
      });
      composition_meta.model = comp.model;
      composition_meta.fell_back = comp.fell_back;
      composition_meta.latency_ms = comp.latency_ms;
      composition_meta.prompt_tokens = comp.prompt_tokens;
      composition_meta.response_tokens = comp.response_tokens;
      if (!comp.text) {
        composition_meta.reason = `compose_failed: ${comp.reason ?? "unknown"}`;
      } else {
        const v = verifyClaims({
          reply_text: comp.text,
          user_message: message,
          frame,
          knowledge,
          known_entities: knownEntities,
          world_card_names: worldCardNames,
        });
        composition_meta.flags = v.flags.map((f) => ({ kind: f.kind, severity: f.severity, matched_text: f.matched_text, reason: f.reason }));
        // P0.2 · Mark that these flags are the post-composition audit
        // (not the deterministic pre-composition confidence report).
        composition_meta.post_composition_audit_ran = true;
        if (v.passed) {
          composition_meta.accepted = true;
          composition_meta.composed_reply = comp.text;
          composed.reply = comp.text;
          // G03 · verify the composed text is in the expected language.
          // Observation-only per AUTHORIZE §22 · does not retry / rewrite
          // (that would violate §23). Drift is surfaced via metadata for
          // downstream analysis.
          if (g03State) {
            try {
              const v3 = verifyOutputLanguage(comp.text, g03State.active);
              composition_meta.output_language_dominant = v3.dominant;
              composition_meta.output_language_matches = v3.matches;
              composition_meta.output_language_verification = v3.matches ? "MATCH" : "DRIFT";
            } catch {
              composition_meta.output_language_verification = "SKIPPED";
            }
          }
          // ─── P0.2 · Entity-window feedback (Philip 2026-09-05) ───
          // Extract enumerated entities from the composed reply and
          // merge them into the session's entity window so a next-turn
          // ordinal reference ("the second one") can resolve against
          // what NEX just said. Deterministic. Never fabricates.
          try {
            if (conversation_id) {
              const composedEntities = composedListToEntities(comp.text);
              composition_meta.composed_entity_count = composedEntities.length;
              if (composedEntities.length > 0) {
                const s = getSession(conversation_id);
                if (s) {
                  const nextEntities = mergeEntityWindow(s.entities ?? [], composedEntities);
                  upsertSession({ ...s, entities: nextEntities });
                }
              }
            }
          } catch {
            /* entity feedback never breaks the response */
          }
        } else {
          composition_meta.reason = `claim_verification_rejected: ${v.reason ?? "unknown"}`;
        }
      }
      } // close: else (from zero-evidence-guard · Philip 2026-09-05)
    } catch (err) {
      composition_meta.reason = `exception: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // ─── P0.3 · Deterministic Record-Summary Fallback ────────────────
  // (Philip 2026-09-05 · AUTHORIZE · P0.3 CORRECTION)
  //
  // When a resolved-reference hotel record was hydrated this turn but
  // the LLM composition was either rejected by claim-verification or
  // failed outright, DO NOT let the reply fall back to the deterministic
  // accommodation composer's list-reemit (that would lose the resolved
  // reference — the exact defect this slice fixes).
  //
  // Instead, emit a DETERMINISTIC summary of the hydrated record built
  // ONLY from fields the record actually has. No LLM. No guessing. No
  // marketing language. This is the "the reference survives to the
  // final response" guarantee end-to-end.
  //
  // Fires ONLY when hydration succeeded AND composition did not accept.
  // Fresh conversations (no ref) + accepted composition paths untouched.
  if (hydrationResult.hydrated && !composition_meta.accepted) {
    const summary = buildHotelRecordSummary(hydrationResult.record);
    composition_meta.baseline_reply = composition_meta.baseline_reply ?? composed.reply;
    composition_meta.composed_reply = summary;
    composition_meta.accepted = true;
    composition_meta.reason = `record_summary_fallback:${hydrationResult.vertical}:${hydrationResult.record.id}${composition_meta.reason ? " · after:" + composition_meta.reason : ""}`;
    composed.reply = summary;
  }

  // ─── Universal Entity Result Cards · projection + session memo ───
  // (Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE)
  //
  // Projects the composer's `world_cards` PresentedCardSet into a
  // structured EntityResultCardSet with per-attribute state, highlights,
  // and coverage. Memoizes the compact form to session so the next-turn
  // attribute-query gate can answer "does the first one have a pool?"
  // deterministically.
  //
  // Runs LAST · after all gates and composition · so the memo always
  // reflects the CURRENT reply. Never blocks the response.
  let entityResultCardSet: ReturnType<typeof projectEntityResultCardSetFromPresented> | null = null;
  try {
    const wc = composed.world_cards;
    if (wc && wc.cards && wc.cards.length > 0) {
      entityResultCardSet = projectEntityResultCardSetFromPresented({ presented: wc });
      composition_meta.entity_result_cards_count = entityResultCardSet.cards.length;
      composition_meta.entity_result_cards_vertical = entityResultCardSet.vertical;
      const avg = entityResultCardSet.cards.length === 0 ? 0
        : Math.round(entityResultCardSet.cards.reduce((s, c) => s + c.coverage.coverage_pct, 0) / entityResultCardSet.cards.length);
      composition_meta.entity_result_cards_avg_coverage = avg;
      // Universal Entity Intelligence v2 · additionally report the
      // evidence_pct (KNOWN_YES + UNVERIFIED / total) so downstream can
      // see the "evidence at some tier" fraction alongside the
      // conservative "known verified" fraction.
      const evidenceAvg = entityResultCardSet.cards.length === 0 ? 0
        : Math.round(entityResultCardSet.cards.reduce((s, c) => s + c.coverage.evidence_pct, 0) / entityResultCardSet.cards.length);
      composition_meta.entity_result_cards_avg_evidence_pct = evidenceAvg;
      composition_meta.entity_result_cards_total_unverified = entityResultCardSet.cards.reduce((s, c) => s + c.coverage.unverified, 0);
      composition_meta.entity_result_cards_total_stale = entityResultCardSet.cards.reduce((s, c) => s + c.coverage.stale, 0);
      composition_meta.entity_result_cards_total_conflicting = entityResultCardSet.cards.reduce((s, c) => s + c.coverage.conflicting, 0);
      // Persist the memoized form on session for next-turn attribute
      // questions. Overwrites any prior memo — the current result set
      // is now the active reference set.
      if (conversation_id) {
        const s = getSession(conversation_id);
        if (s) {
          const memo = memoize(entityResultCardSet.cards);
          upsertSession({ ...s, entityCardMemo: memo } as unknown as Parameters<typeof upsertSession>[0]);
          composition_meta.entity_result_cards_memoized = true;
        }
      }
    }
  } catch { /* card projection must never break the response */ }

  // ─── Wave 3 · Voice Response Compression ────────────────────────
  // (Philip 2026-09-06 · AUTHORIZE · WAVE 3 · Capabilities E, F)
  //
  // Always compute the compressed form so we have observability of what
  // a voice-safe compression would produce. Only OVERWRITE the returned
  // reply when the caller opts in via `voice: true`. Compression module
  // guarantees semantic preservation — if any preservation marker would
  // be lost, it reverts to the original.
  const voiceRequested = body.voice === true;
  composition_meta.voice_compression_requested = voiceRequested;
  try {
    const comp = compressForVoice(composed.reply ?? "");
    composition_meta.voice_compressed_reply = comp.compressed;
    composition_meta.voice_compression_applied = voiceRequested && comp.metrics.changed;
    composition_meta.voice_compression_reduction_pct = comp.metrics.reduction_pct;
    composition_meta.voice_compression_meaning_preserved = comp.meaning_preserved;
    if (voiceRequested && comp.metrics.changed && comp.meaning_preserved) {
      composed.reply = comp.compressed;
    }
  } catch { /* voice compression must never break the response */ }

  if (!isUkStaircase) {
    // Founder speed audit · attach _debug_timings BEFORE build so any thrown
    // access is caught. try/catch keeps instrumentation from ever breaking the
    // response body shape.
    let _debug_timings: Record<string, unknown> | null = null;

    // Founder BEGIN 2026-09-09 · SHADOW-MODE deterministic composer.
    // Runs in parallel with the customer's real reply. Non-blocking · budgeted.
    // Any error is captured · customer never sees it.
    let deterministic_shadow: unknown = { enabled: false, skipped_reason: "flag_off" };
    if (SHADOW_MODE_ENABLED) {
      try {
        const shadowPool = getAccommodationDbPool();
        deterministic_shadow = await runShadowMode({
          message: String(message ?? ""),
          conversation_id: conversation_id ?? null,
          language: "en", // Chat brain language detection happens further up · shadow defaults en for now
          pool: shadowPool,
          chatBrainReply: composed as unknown,
          chatBrainVisibleText: String(composed?.reply ?? ""),
          chatBrainIntent: (composed?.intent as string | null) ?? null,
        });
      } catch (e) {
        deterministic_shadow = { enabled: true, skipped_reason: "wire_error", error: e instanceof Error ? e.message : String(e) };
      }
    }

    try {
      _stage_ms.total_before_response_send = Math.round((_perfNow() - _t_request_start) * 100) / 100;
      _debug_timings = {
        stage_ms: _stage_ms,
        // Founder BEGIN 2026-09-09 · CHAT-ORCHESTRATOR-SUB-INSTRUMENTATION
        orchestrator_sub_timings: (composed as any)?.sub_timings ?? null,
        composition_latency_ms: (typeof (composition_meta as any)?.latency_ms === "number") ? (composition_meta as any).latency_ms : null,
        composition_accepted: (composition_meta as any)?.accepted ?? null,
        composition_model: (composition_meta as any)?.model ?? null,
        composition_fell_back: (composition_meta as any)?.fell_back ?? null,
        llm_invoked: (composition_meta as any)?.accepted === true && typeof (composition_meta as any)?.latency_ms === "number",
        intent_resolved: composed.intent ?? null,
        brain_ms_legacy: brainMs,
        deterministic_shadow,
        instrument_version: "chat-shadow-mode-v3-deterministic-2026-09-09",
      };
    } catch { _debug_timings = { error: "instrumentation_failed" }; }
    return NextResponse.json({
      conversation_id,
      reply: composed.reply,
      understood_intent: composed.intent ?? null,
      understood_entities: [],
      retrieved_top_k_count: 0,
      served_by: "nex-brain-orchestrator",
      intent: composed.intent ?? null,
      intent_reason: composed.intent_reason ?? null,
      suggestions: composed.suggestions,
      card: composed.card ?? null,
      // Phase D · natural-language Live discovery payload · null unless
      // the intent was live_discovery. Never fabricated. Includes real
      // cards, city_used, status_counts, and empty_reason for honesty.
      live_discovery: (composed as unknown as { live_discovery?: unknown }).live_discovery ?? null,
      state_summary: {
        turn_count: 1,
        current_topic: composed.intent ?? null,
        established_facts: {},
        entities_in_focus: [],
        constraints: [],
        stage: "brain",
        corrections_logged: 0,
        current_emotion: "neutral",
        handoff_recommended: false,
        thin_packet_strikes: 0,
        condensed_history_present: false,
        conversation_language: "en",
      },
      // Stage 3.9 · Brain capability audit + goal state exposed on
      // every turn so HQ, tests, and future observability tooling can
      // see what the Brain actually did.
      brain_capabilities: composed.capabilities ?? [],
      goal: composed.goal ?? null,
      // Stage 3.10 · Reflection self-check report · constitutional.
      reflection: composed.reflection ?? null,
      // Stage 3.11 · Confidence per-reply audit · constitutional.
      confidence: composed.confidence ?? null,
      // Stage 3.12 · Meta-Cognition umbrella · constitutional.
      meta_cognition: composed.meta_cognition ?? null,
      // Stage 3.14 · Entity Intelligence · session entity roll-up
      // (mirror of meta_cognition.whatIKnow.entitiesSeen for direct access).
      entities: composed.meta_cognition?.whatIKnow?.entitiesSeen ?? null,
      // Stage 3.15 · Reference Resolution · resolved reference for this turn.
      current_reference: (() => {
        const sess = conversation_id ? getSession(conversation_id) : null;
        return sess?.currentReference ?? null;
      })(),
      // Stage 3.16 · Comparison · structured side-by-side (when user asked to compare).
      comparison: composed.comparison ?? null,
      // Stage 3.17 · Recommendation · evidence-based ranking (when user asked to recommend).
      recommendation: composed.recommendation ?? null,
      // Stage 3.18 · Tool Selection · which tool the Brain chose for this turn.
      tool_decision: composed.tool_decision ?? null,
      // Stage 3.20 · Governance · permission audit for this turn.
      governance: composed.governance ?? null,
      // Stage 3.21 · Action · proposal + execution (link generation v1).
      action_proposal: composed.action_proposal ?? null,
      action_execution: composed.action_execution ?? null,
      // Stage 3.22 · Verification · CONSTITUTIONAL fifth · did the action match intent?
      verification: composed.verification ?? null,
      // Stage 3.23 · Prediction · anticipated next likely user action.
      prediction: composed.prediction ?? null,
      // Stage 3.24 · Initiative · did NEX volunteer a proactive suggestion this turn?
      initiative: composed.initiative ?? null,
      // Stage 3.25 · Adaptation · pattern signals from Learning ledger this conversation.
      adaptation: composed.adaptation ?? null,
      // Stage 3.26 · Long-Term Memory · cross-session preferences (when userId + consent).
      long_term_memory: composed.long_term_memory ?? null,
      // Stage 3.27 · Personalization · returning-user signal.
      personalization: composed.personalization ?? null,
      // Stage 3.28 · Attention · cross-turn priority ranking.
      attention: composed.attention ?? null,
      // Stage 3.29 · Planning · multi-step plan for accommodation flow.
      planning: composed.planning ?? null,
      // Stage 3.30 · Personality · post-processed reply audit.
      personality_profile: composed.personality_profile ?? null,
      // Stage 3.34 · Live World access · cards + expanded surface + latency.
      // world_cards populate the 3-landscape-card presentation from
      // real directory rows (nex.accommodation_business etc). world_expanded_page
      // fires when the user asked "show me more" and we have real
      // records for the current goal. Both derive from the SAME live
      // World retrieval that fed the composer's spoken reply.
      world_cards: composed.world_cards ?? null,
      // Chat Result Experience Integration (Philip 2026-09-06) · pass
      // through theme_command from the sync orchestrator so /nex-app/chat's
      // Theme Engine client continues to work. Server-side theme_persisted
      // is not ported (deferred).
      theme_command: (composed as unknown as { theme_command?: unknown }).theme_command ?? null,
      // Universal Entity Intelligence · structured card contract with
      // per-attribute state (KNOWN_YES / UNKNOWN) + highlights. Never
      // fabricated · derived from the same PresentedCardSet the UI
      // renders. Null when no world_cards were emitted this turn.
      entity_result_cards: entityResultCardSet,
      world_expanded_page: composed.world_expanded_page ?? null,
      world_latency_ms: composed.world_latency_ms ?? null,
      // Stage 3.36 · Action + Verification v2 · immutable audit chain
      // for mutation actions (contact_via_whatsapp etc). Present when
      // the action gate ran a chain to a terminal state this turn.
      action_audit: composed.action_audit ?? null,
      // Stage 3.37 · Awaiting proposal snapshot · when NEX has just
      // proposed a mutation and is waiting for the user's confirmation.
      // Consumers can render a confirm/decline UI keyed off this field.
      pending_proposal_snapshot: (() => {
        const sess = conversation_id ? getSession(conversation_id) : null;
        const p = sess?.pendingProposal;
        return p && p.status === "AWAITING" ? {
          fingerprint:      p.fingerprint,
          actionId:         p.actionId,
          kind:             p.kind,
          targetCanonical:  p.target.canonical,
          messageBody:      p.messageBody,
          proposedAt:       p.proposedAt,
          language:         p.language ?? null,
        } : null;
      })(),
      // Stage 3.41 · Personality voice · the friend-language rendering
      // of THIS turn's answer. Base `reply` above stays untouched
      // (the honest constitutional composer output that HQ/audit see);
      // Chat surfaces render `voice_reply` for the user-facing message.
      // P0 · Response Composition observability. Present when the
      // composition gate ran this turn (accepted or rejected). Lets
      // baseline diff + telemetry see what happened.
      composition_meta,
      voice_reply: (() => {
        // P0 · When composition was accepted, the composed text is the
        // reply · voice-intent selector's default paths don't know
        // about it. Short-circuit here so voice_reply.en carries the
        // composed answer directly.
        if (composition_meta.accepted && composition_meta.composed_reply) {
          try {
            if (conversation_id) {
              const nextSess = getSession(conversation_id);
              if (nextSess) {
                const spoken = composition_meta.composed_reply;
                let updated = appendDialogueTurn(nextSess, { role: "nex", text: spoken });
                const trimmedSpoken = spoken.trim();
                const endsWithQuestion = trimmedSpoken.endsWith("?");
                updated = { ...updated, lastNexQuestion: endsWithQuestion ? trimmedSpoken : undefined };
                upsertSession(updated);
              }
            }
          } catch { /* dialogue recording never breaks the response */ }
          return {
            en: composition_meta.composed_reply,
            id: null,
            mode: "friendly",
            intent: "p0_composed",
            chosen_reason: `p0_composition_layer · model=${composition_meta.model} · fell_back=${composition_meta.fell_back} · latency_ms=${composition_meta.latency_ms}`,
          };
        }
        try {
          const sess    = conversation_id ? getSession(conversation_id) : null;
          const pending = sess?.pendingProposal ?? null;
          // Stage 3.41.d P1 · did the reference just resolve THIS turn?
          // We check the session's currentReference · if it's resolved
          // AND resolvedInTurn === current turn, this turn is the one
          // that picked it → prefer acknowledge_reference voice.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const refSummary = sess?.currentReference as any;
          const refResolvedInTurn: number | undefined = refSummary?.resolvedInTurn;
          const referenceJustResolved =
            !!refSummary?.resolved
            && refResolvedInTurn !== undefined
            && sess?.turnCount !== undefined
            && refResolvedInTurn === sess.turnCount;
          const currentReferenceName: string | undefined =
            refSummary?.business?.canonical ?? refSummary?.business?.raw;
          // Stage 3.41.d P2 · entity-followup detector · only fires
          // when we have a current reference AND the utterance matches
          // a follow-up pattern ("what's good about it" / "tell me more").
          const followup = detectEntityFollowup(message);
          const entityFollowupIntent = !!(followup.matched && currentReferenceName);

          // Stage 3.42 · fallback lastNexQuestion from client if
          // session state didn't survive (see previousNexReply above).
          const sessForSelector: typeof sess = sess && !sess.lastNexQuestion && previousNexReply?.trim().endsWith("?")
            ? { ...sess, lastNexQuestion: previousNexReply.trim() }
            : sess;
          const plea    = selectVoiceIntent({
            brain: composed,
            pendingProposal: pending,
            message,
            referenceJustResolved,
            entityFollowupIntent,
            currentReferenceName,
            // Stage 3.42 · Conversation Layer (Philip 2026-09-01) ·
            // pass session so router can consult dialogueTurns +
            // lastNexQuestion for social/context routing.
            session: sessForSelector,
          });
          const voice   = renderVoice({ intent: plea.intent, content: plea.content, mode: plea.mode });
          // Stage 3.42 · Conversation Layer (Philip 2026-09-01) ·
          // record the NEX side of the turn into dialogueTurns + set
          // lastNexQuestion if the rendered voice ends in a `?` (used
          // by the router to interpret next-turn short answers as
          // context continuations rather than vague queries).
          try {
            if (conversation_id) {
              const nextSess = getSession(conversation_id);
              if (nextSess) {
                const spoken = voice.en ?? composed.reply ?? "";
                let updated = appendDialogueTurn(nextSess, { role: "nex", text: spoken });
                const trimmedSpoken = spoken.trim();
                const endsWithQuestion = trimmedSpoken.endsWith("?");
                updated = {
                  ...updated,
                  lastNexQuestion: endsWithQuestion ? trimmedSpoken : undefined,
                };
                upsertSession(updated);
              }
            }
          } catch { /* dialogue recording never breaks the response */ }
          return { en: voice.en, id: voice.id, mode: voice.mode, intent: plea.intent, chosen_reason: plea.chosenReason };
        } catch (err) {
          // Voice layer failing MUST NOT break the chat response. Fall
          // back to null · surface consumer will render base reply.
          return { en: null, id: null, mode: null, intent: null, chosen_reason: `voice_render_error: ${err instanceof Error ? err.message : String(err)}` };
        }
      })(),
      metrics: {
        total_ms: brainMs,
        brain_ms: brainMs,
        world_ms: composed.world_latency_ms ?? null,
        specialist_used: null,
      },
      // Founder speed audit · minimal per-stage timings · safe under any error
      _debug_timings,
    });
  }

  // ─── UK staircase fallthrough: existing Qwen pipeline ───────────
  let store: any;
  try {
    ({ store } = await boot());
  } catch (e: unknown) {
    return serverError(
      "conversation store failed to initialise · " + String((e as Error)?.message ?? e).slice(0, 200)
    );
  }

  // @ts-expect-error — pipeline outside src/
  const infer = await import(/* @vite-ignore */ "../../../../../scripts/nex-conv/lib/infer.mjs");

  const stored = store.getState(conversation_id);
  const state = stored ?? infer.newState({ conversation_id, brain: "staircase_brain", business_id: body.business_id ?? null });

  let out: any;
  try {
    out = await infer.processTurn({
      store,
      state,
      brain: "staircase_brain",
      text: message,
      speaker: "customer",
      withProse: true,
    });
  } catch (e: unknown) {
    return serverError(
      "conversation engine failed · " + String((e as Error)?.message ?? e).slice(0, 300)
    );
  }

  try {
    await store.upsertState(state);
  } catch {
    // non-fatal
  }

  try {
    const customerTurn = await store.writeTurn({
      conversation_id,
      turn_index: Math.max(0, state.turn_count - 2),
      speaker: "customer",
      text: message,
      detected_intent: out.understood_intent?.slug ?? null,
      detected_entities: out.understood_entities ?? [],
      used_item_ids: (out.retrieved_top_k ?? []).map((k: any) => k.id),
      walked_edge_ids: [],
      latency_ms: out.total_ms ?? null,
    });
    await store.writeTurn({
      conversation_id,
      turn_index: state.turn_count - 1,
      speaker: "nex",
      text: out.prose?.text ?? "(no prose)",
      detected_intent: null,
      detected_entities: [],
      used_item_ids: (out.retrieved_top_k ?? []).map((k: any) => k.id),
      walked_edge_ids: [],
      latency_ms: out.stage_timings?.prose_ms ?? null,
    });
    void customerTurn;
  } catch {
    // non-fatal
  }

  const proseErr = out.prose?.error;
  if (proseErr) {
    return NextResponse.json({
      conversation_id,
      reply: null,
      error: "response layer error · " + String(proseErr).slice(0, 300),
      state_summary: shapeStateSummary(state),
      served_by: "uk-staircase-qwen",
    }, { status: 502 });
  }

  return NextResponse.json({
    conversation_id,
    reply: out.prose?.text ?? "(no prose returned)",
    understood_intent: out.understood_intent?.slug ?? null,
    understood_entities: out.understood_entities ?? [],
    retrieved_top_k_count: (out.retrieved_top_k ?? []).length,
    served_by: "uk-staircase-qwen",
    intent: composed.intent ?? "staircase",
    intent_reason: composed.intent_reason ?? null,
    suggestions: composed.suggestions,
    state_summary: shapeStateSummary(state),
    metrics: {
      total_ms: (out.total_ms ?? 0) + brainMs,
      brain_ms: brainMs,
      specialist_ms: out.total_ms ?? null,
      prose_ms: out.stage_timings?.prose_ms ?? null,
      prose_tokens_prompt: out.prose?.tokens_prompt ?? null,
      prose_tokens_completion: out.prose?.tokens_completion ?? null,
      prose_model: out.prose?.model ?? null,
      prose_provider: out.prose?.provider ?? null,
      specialist_used: "uk-staircase-qwen",
    },
  });
}

function shapeStateSummary(state: any) {
  return {
    turn_count: state?.turn_count ?? 0,
    current_topic: state?.current_topic ?? null,
    established_facts: state?.established_facts ?? {},
    entities_in_focus: (state?.entities_in_focus ?? []).slice(0, 10),
    constraints: state?.constraints ?? [],
    stage: state?.stage ?? "discover",
    corrections_logged: (state?.corrections_log ?? []).length,
    current_emotion: state?.current_emotion ?? "neutral",
    handoff_recommended: state?.handoff_recommended === true,
    thin_packet_strikes: state?.thin_packet_strikes ?? 0,
    condensed_history_present: !!state?.condensed_history,
    conversation_language: state?.conversation_language ?? "en",
  };
}
