// src/lib/nex/brain/orchestrate.ts
//
// The canonical NEX conversation Brain (Philip 2026-08-31 · Stage 3.6
// "NEX Speaking Brain" · Option B). ONE deterministic orchestration
// function that every NEX chat surface calls before dispatching to any
// specialist. Prior to this extraction, `/api/nex/general-chat` owned
// the routing and `/api/nex-conv/chat` skipped it entirely — so the
// phone-shell voice composer landed on Qwen+STAIRCASE for accommodation
// queries. Doctrine: one canonical Brain, specialists live UNDER it.
//
// The Brain covers, in order of priority:
//   1. Safety Mode (chest pain / earthquake / stolen wallet · always wins)
//   2. Theme routing (blossom / grand entrance / walnut / reset)
//   3. Creation cards (banner / poster · honest coming-soon card)
//   4. Calendar / reminder cards (honest waiting-for-connection card)
//   5. Contacts routing
//   6. Conversation-intent classifier + gated replies (accommodation,
//      food, indonesia, tourism, business, marketplace, booking,
//      translation, weather, writing, image)
//   7. Image-view routing
//   8. UK-trade cascade (staircase, plumbing, electrical, kitchen)
//   9. Generic fallback
//
// Callers can inspect `intent` on the result to decide whether to
// delegate to a specialist (e.g. Qwen staircase Q&A for genuine UK
// staircase intent) rather than returning the Brain's reply verbatim.

import { classifyConversationIntent } from "@/lib/nex/conversation-intent";
import { retrieveKnowledge, formatKnowledgeBlock } from "@/lib/nex/indonesia/knowledge";
import { classifySafetySignal, composeSafetyResponse } from "@/lib/nex/safety";
import {
  extractAccommodationSlots,
  mergeAccommodationSlots,
  newSlotsIntroduced,
  describeSlots,
  type AccommodationSlots,
} from "./accommodation-slots";
import { getSession, upsertSession, isVerticalSwitch, applyVerticalSwitchReset, applyAbandonmentReset, type SessionState } from "./session";
import { detectAbandonment } from "./abandonment-detector";
import { decideAccommodationInsight } from "./insight";
import { recordInsightGap } from "./insight-gaps";
import { ActivationTrace } from "./capabilities";
import {
  newAccommodationGoal,
  progressAccommodationGoal,
  markGoalNotProgressed,
  shouldSurfaceResume,
  resumeAcknowledgement,
  shouldSurfacePausedHint,
  pausedHint,
  // Stage 3.41.f · generic food/commerce goal constructors for sticky-vertical persistence
  newVerticalGoal,
  progressVerticalGoal,
  type Goal,
} from "./goal-tracking";
import { reflectOnReply, type ReflectionReport } from "./reflection";
import { assessConfidence, type ConfidenceReport } from "./confidence";
import { assessMetaCognition, type MetaCognitionReport } from "./meta-cognition";
import { recordLearning } from "./learning";
import {
  extractEntities,
  capturePresentedBusinesses,
  mergeEntityWindow,
  type RecognisedEntity,
} from "./entities";
import { resolveReference, summariseResolution, type ReferenceResolution } from "./reference-resolution";
import {
  detectComparisonIntent,
  selectComparisonCandidates,
  compareCandidates,
  renderComparisonReply,
  type ComparisonReport,
  type CompareCandidate,
} from "./comparison";
import {
  detectRecommendationIntent,
  recommendFromCandidates,
  renderRecommendationReply,
  type RecommendationReport,
  type RecommendCandidate,
} from "./recommendation";
import { selectTool, summariseToolDecision, type ToolDecision } from "./tool-selection";
import { composeCommerceReply } from "./commerce-composer";
import { checkPermissions, DEFAULT_POLICY, type PermissionUse, type GovernanceReport, type ConsentGrants } from "./governance";
import { proposeAction, executeAction, type ActionProposal, type ActionExecution } from "./action";
import { verifyAction, type VerificationReport } from "./verification";
import { predictNext, type PredictionReport } from "./prediction";
import { decideInitiative, type InitiativeReport } from "./initiative";
import { detectAdaptations, type AdaptationReport } from "./adaptation";
import {
  getPreferences,
  updatePreferencesFromSlots,
  snapshotPreferences,
  type LongTermPreferences,
} from "./long-term-memory";
import { decidePersonalization, type PersonalizationReport } from "./personalization";
import { computeAttention, type AttentionReport } from "./attention";
import { buildPlan, type PlanReport } from "./planning";
import { applyPersonality, type PersonalityReport, type PersonalityProfile } from "./personality";

export type Suggestion = { label: string; href: string };

export type ThemeCommand =
  | { action: "activate"; theme_id: "blossom" | "staircase_light_cream" | "staircase_walnut" }
  | { action: "reset" };

export type MeetingCard = {
  type: "meeting";
  fields: { title: string; date: string; time: string; reminder: string };
  status: "requires_connection" | "coming_soon";
  status_label: string;
  actions: CardAction[];
};

export type ImageCreationCard = {
  type: "image_creation";
  fields: { subject: string; overlay: string; format: string };
  status: "coming_soon";
  status_label: string;
  actions: CardAction[];
};

export type CardAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "coming_soon"; label: string; toast: string }
  | { kind: "dismiss"; label: string }
  | { kind: "save_for_later"; label: string; state: "prepared_waiting" };

export type Card = MeetingCard | ImageCreationCard;

export type BrainReply = {
  reply: string;
  suggestions: Suggestion[];
  card?: Card;
  theme_command?: ThemeCommand;
  intent?: string;
  intent_reason?: string;
  /** Stage 3.9 · which Brain capabilities activated on this turn.
   *  Honest audit trail · exposed via metrics in the HTTP layer. */
  capabilities?: string[];
  /** Stage 3.9 · current goal state (if any). Lets HQ + tests see
   *  whether the goal is active / paused / resumed / completed. */
  goal?: { kind: string; status: string; summary: string; turnsSinceProgress: number } | null;
  /** Stage 3.10 · Reflection · self-check report of this reply.
   *  Constitutional per Philip 2026-08-31 doctrine. Observational v1 ·
   *  when overallPass=false the composer still ships the reply but the
   *  failing findings are visible in the response for HQ + tests. */
  reflection?: ReflectionReport;
  /** Stage 3.11 · Confidence · per-reply audit classifying claims as
   *  grounded_fact / retrieved / computed / boundary / conversational.
   *  Overall level: high · medium · low · unavailable. Constitutional
   *  pair with Truth + Reflection. */
  confidence?: ConfidenceReport;
  /** Stage 3.12 · Meta-Cognition · constitutional umbrella composing
   *  Truth + Reflection + Confidence into a single self-awareness
   *  summary per turn ("What do I know? · How sure? · Am I wrong? ·
   *  What should I do?"). Attached to response for observability. */
  meta_cognition?: MetaCognitionReport;
  /** Stage 3.16 · Comparison · structured side-by-side report when
   *  the user asks to compare 2-3 presented businesses. */
  comparison?: ComparisonReport;
  /** Stage 3.17 · Recommendation · evidence-based ranking with
   *  defensible reason · tie-breaker prompt when signals are close. */
  recommendation?: RecommendationReport;
  /** Stage 3.18 · Tool Selection · which tool the Brain chose for
   *  this turn (world_retrieval · commerce_retrieval · live_source ·
   *  calculator · user_action · none). Makes the implicit routing
   *  auditable and provides the seam for future capability plug-ins. */
  tool_decision?: ToolDecision;
  /** Stage 3.20 · Governance · permission audit for this turn. */
  governance?: GovernanceReport;
  /** Stage 3.21 · Action · proposed action from a resolved reference
   *  + requested action verb (book/open/etc). Never fabricates. When
   *  consent is required, execution is deferred; the proposal + link
   *  preview surface for the user to confirm. */
  action_proposal?: ActionProposal;
  /** Stage 3.21 · Action · execution outcome. v1 only executes
   *  `open_directory` (link generation, no server-side state change). */
  action_execution?: ActionExecution;
  /** Stage 3.22 · Verification · CONSTITUTIONAL fifth · runs after
   *  Action to confirm the execution matched intent · never claims
   *  verification success without evidence · closes the honesty five
   *  loop (Truth · Reflection · Confidence · Meta-Cognition · Learning
   *  · Verification). */
  verification?: VerificationReport;
  /** Stage 3.23 · Prediction · anticipates the next likely user
   *  action based on this turn's state · deterministic · never
   *  claims certainty · observational v1 (composer text unchanged). */
  prediction?: PredictionReport;
  /** Stage 3.24 · Initiative · decision on whether to volunteer the
   *  top prediction proactively · rate-limited (session cap: 3) ·
   *  never doubles up with composer's own question. */
  initiative?: InitiativeReport;
  /** Stage 3.25 · Adaptation · pattern detection over the Learning
   *  ledger for this conversation · surfaces suggested behavior
   *  adjustments · v1 observational · closes the Learning → Adaptation
   *  loop. */
  adaptation?: AdaptationReport;
  /** Stage 3.26 · Long-Term Memory · cross-session user preferences.
   *  Null when userId absent OR consent not granted. Persisted-and-
   *  read snapshot for this turn. */
  long_term_memory?: {
    userId: string;
    interactionCount: number;
    locationPreference?: { canonical: string; count: number };
    typePreference?: { canonical: string; count: number };
    budgetPreference?: { canonical: string; count: number };
    areaPreference?: { canonical: string; count: number };
  } | null;
  /** Stage 3.27 · Personalization · returning-user signal from LTM ·
   *  optional greeting prepended on first accommodation turn of a
   *  new conversation · never fabricates preferences the LTM doesn't hold. */
  personalization?: PersonalizationReport;
  /** Stage 3.28 · Attention · cross-turn priority ranking of slots ·
   *  entities · goal · observational v1 · future consumers use `top`
   *  as the default reference / question / focus. */
  attention?: AttentionReport;
  /** Stage 3.29 · Planning · multi-step plan builder above Insight ·
   *  shows the full path from current state to goal completion · v1
   *  accommodation only · observational. */
  planning?: PlanReport;
  /** Stage 3.30 · Personality · post-processed reply audit ·
   *  friendly (default) · concise · professional · never touches
   *  numbers/names/boundaries. */
  personality_profile?: PersonalityReport;
  /** Stage 3.34 · Live World cards · vertical-agnostic PresentedCardSet
   *  rendered from real directory records (nex.accommodation_business /
   *  food / commerce / etc). Only present when `useLiveWorld:true` was
   *  passed AND the intent maps to a wired vertical. Never fabricates
   *  cards · when 0 real records match, `cards.length===0`. */
  world_cards?: import("./presentation").PresentedCardSet;
  /** Stage 3.34 · Latency of the World-adapter call (ms) · surfaced for
   *  latency budgeting + slow-query alerts. */
  world_latency_ms?: number;
  /** Stage 3.34 · Phase 27c/d · Expanded 10-card paginated page ·
   *  attached when the user's turn is a "show me more" request AND an
   *  active accommodation goal has real World matches. UI opens the
   *  in-app expanded results surface using this payload. Same live
   *  World records the 3-card set uses · never a separate retrieval. */
  world_expanded_page?: import("./presentation").ExpandedResultsPage;
  /**
   * Stage 3.35 · Phase 1 · Structured query signal (Philip 2026-08-31).
   * The Brain's understanding of THIS turn: which vertical, what noun,
   * which area/city, what budget, price ceiling, verb intent, and
   * whether the user asked "near me" (which NEX can't honour today).
   * Foundation signal that Phase 2 (Recommendation), Phase 3
   * (Comparison), Phase 4 (Reasoning), Phase 5 (Planning) consume to
   * decide whether to run a fresh retrieval or operate over the
   * current candidate set. Attached even when useLiveWorld is false
   * so downstream systems can inspect the parse regardless.
   */
  world_query?: {
    vertical?: import("./world-adapters/types").WorldVertical;
    verbIntent: WorldQueryVerbIntent;
    category?: string;      // sub-classification: hotel · headphones · dentist · restaurant
    query?: string;         // noun tail for name-search
    city?: string;
    area?: string;
    budget?: "budget" | "mid" | "luxury";
    priceCeilingIdr?: number;
    nearMe: boolean;        // true when NEX can't honour · honest boundary
  };
  /**
   * Stage 3.35 · Phase A · Evidence-based recommendation over live
   * WorldRecords. Fires when world_query.verbIntent === "recommend"
   * AND live records are available for the current vertical. Ranks by
   * Bayesian rating × reviewCount (primary) · area proximity (secondary)
   * · retrieval position (tie-break). Emits pick + runners + honest
   * gaps so downstream systems + Reflection can audit the reasoning.
   */
  world_recommendation?: import("./recommend-from-world").WorldRecommendation;
  /**
   * Stage 3.35 · Phase B · Structured comparison over live WorldRecords.
   * Fires when world_query.verbIntent === "compare". Produces a table
   * (per-vertical columns) · observations (defensible per-field claims)
   * · pickHint (hedged partial claim OR nothing when no evidence
   * permits). NEVER manufactures an overall winner · missing values
   * render as "—" or "Unavailable" verbatim from schema absence.
   */
  world_comparison?: import("./compare-from-world").WorldComparison;
  /**
   * Stage 3.35 · Phase C · Multi-constraint reasoning over live
   * WorldRecords. Fires when the user's message extracts 2+
   * constraints (cheap + close + highly rated etc). Per-constraint
   * evidence state (supported/unsupported per record). Missing data
   * NEVER becomes a bad score · evidenceCoverage surfaced explicitly.
   * Reply distinguishes strong recommendation (coverage=1.0) from
   * best-available-from-partial (0<c<1) from no-supported-constraints
   * (c=0). Never quotes a numeric score like "87/100".
   */
  world_reasoning?: import("./reason-from-world").WorldReasoning;
  /**
   * Stage 3.35 · Phase D · Sequenced multi-step plan over live World
   * data. Fires when the message describes 2+ steps ("find me a hotel,
   * then transport to the airport"). Each step executes sequentially ·
   * downstream steps that need upstream evidence (e.g. hotel
   * coordinates as transport origin) BLOCK when that evidence is
   * missing on the upstream pick. Never guesses. Report includes
   * per-step status + block/skip cascade.
   */
  world_plan?: import("./plan-from-world").WorldPlan;
  /**
   * Stage 3.35 · Phase E · Tool Selection · deterministic router that
   * picks the tool category (world · world_plan · action · calculator ·
   * weather · knowledge · ambiguous · unsupported) with explicit
   * precedence and required-input contract. Sits ABOVE the existing
   * tool_decision (Stage 3.18) which stays for backwards-compat.
   * Attached on every live-World turn so downstream code + tests can
   * audit the routing choice.
   */
  tool_selection?: import("./tool-router").ToolSelection;
  /** Stage 3.35 · Phase E · Calculator result (present when router
   *  chose calculator category AND the tool executed). */
  calculator_result?: import("./tools/calculator").CalculatorResult;
  /** Stage 3.35 · Phase E · Weather result (present when router chose
   *  weather AND the tool ran). Honest unavailable state when no
   *  provider is configured. */
  weather_result?: import("./tools/weather").WeatherResult;
  /** Stage 3.35 · Phase E · Knowledge result (present when router
   *  chose knowledge AND the editorial lookup ran). */
  knowledge_result?: import("./tools/knowledge").KnowledgeResult;
  /**
   * Stage 3.36 · Action + Verification v2 · immutable audit chain.
   * Present when the router chose category="action" AND the executor
   * ran (either to BLOCKED for missing authorization or through to a
   * VERIFIED/UNKNOWN/FAILED terminal state).
   *
   * CONSTITUTIONAL: `finalState` determines the reply — no ad-hoc
   * wording. `VERIFIED` requires independent DeliveryProof. Anything
   * else must NOT claim success. The composer (`action-composer.ts`)
   * owns the phrasing table and a linter test proves no leak.
   *
   * Attached alongside the older ActionProposal/ActionExecution/
   * VerificationReport fields for backwards-compat during migration.
   */
  action_audit?: import("./action-audit").ActionAudit;
  /**
   * Stage 3.41.d P1 · true when THIS turn's message actually resolved
   * a reference (ordinal or pronoun). Voice selector uses this to
   * choose acknowledge_reference over discovery_hit · avoids the
   * unreliable "compare resolvedInTurn to turnCount" heuristic which
   * mis-fires on turns that don't reach the accommodation composer.
   */
  reference_just_resolved?: boolean;
  /** Convenience mirror of session.currentReference.business.canonical
   *  at the end of this turn · for voice selector wording. */
  current_reference_canonical?: string;
};

export type OrchestrateOptions = {
  userMarket?: "ID" | "UK" | "US";
  /**
   * Session handle · when present, the Brain reads prior accommodation
   * slots and persists updated slots for the next turn.
   */
  conversationId?: string;
  /**
   * Stage 3.26 · Long-Term Memory user identity. Opaque client-provided
   * string · trusted for v1 (no auth verification). Cross-conversation
   * preferences are keyed by userId. Absent = LTM inactive.
   */
  userId?: string;
  /**
   * Stage 3.26 · Explicit user consent for long-term memory read/write.
   * Required for LTM operations (Governance require_consent). Absent
   * or false = LTM inactive even when userId is provided.
   */
  consentLongTermMemory?: boolean;
  /**
   * Stage 3.30 · Optional personality profile for reply post-processing.
   * "friendly" (default) · "concise" (strips fillers) · "professional"
   * (neutral verbs). Never modifies factual claims/names/boundaries.
   */
  personalityProfile?: PersonalityProfile;
  /**
   * Stage 3.34 · Live World data access (Philip 2026-08-31). When true,
   * the accommodation composer queries `nex.accommodation_business` via
   * the World adapter INSTEAD of reading `knowledge-entities.json`.
   *
   * Doctrine: the World owns the data · when a directory record changes,
   * the next turn sees it. No sync, no cache, no rebuild.
   *
   * Default false so existing tests + surfaces keep their current
   * behaviour during migration. Callers wired to production databases
   * pass true. When every vertical's adapter ships, this flag turns
   * into always-on and the JSON knowledge path stays only for
   * editorial content (kos-kosan explanations, tourism essays).
   */
  useLiveWorld?: boolean;
  /**
   * Stage 3.34 · Presented card set from the World. Not user input · the
   * outer orchestrator populates this after the composer runs so the
   * response can carry a vertical-agnostic PresentedCardSet alongside
   * the reply text. Composers should NOT read this.
   */
  __presentedCards?: unknown;
  /**
   * Stage 3.34 · Phase 27a · Pre-fetched World records. When present,
   * the accommodation composer's discovery branch sources its named-list
   * opener + count + boundary from THESE records instead of the JSON
   * knowledge corpus. Guarantees text + cards derive from the SAME
   * canonical retrieval (doctrine: "ONE RETRIEVAL → ONE EVIDENCE SET
   * → TEXT + CARDS"). Set by orchestrateChatTurnLive · never by callers.
   */
  __worldRecords?: readonly import("./world-adapters/types").WorldRecord[];
  /**
   * Stage 3.34 · Total real records available in the World BEFORE the
   * top-N slice · used in text like "Saya punya 521 listingan asli...".
   * Set alongside __worldRecords.
   */
  __worldTotalAvailable?: number;
};

function mentionsThemeIntent(lower: string): boolean {
  if (!/\btheme\b/i.test(lower)) return false;
  return /\b(change|switch|set|apply|use|make|turn|activate|try|preview|reset|restore|default|pick|choose)\b/i.test(
    lower,
  );
}

function composeGatedReply(
  intent: ReturnType<typeof classifyConversationIntent>,
  message: string,
  opts: OrchestrateOptions,
  trace: ActivationTrace,
): { reply: string; suggestions: Suggestion[]; card?: Card; theme_command?: ThemeCommand } | null {
  switch (intent.intent) {
    case "conversation":
      return {
        reply:
          intent.reason === "greeting"
            ? "Hi! I'm NEX. Ask me about Indonesia, food, places to visit, or something you'd like to plan — and if you need a professional, I can help you find one."
            : intent.reason === "meta_about_nex"
              ? "I'm NEX — a local-first assistant. I know a fair bit about Indonesia (food, places, practical travel), can look at photos you share, and can help you find businesses or plan a trip. What are you working on?"
              : "Happy to chat. If you're planning something in Indonesia, want restaurant ideas, or need to find a professional, just say the word.",
        suggestions: [],
      };

    case "commerce": {
      trace.record("world_knowledge", "commerce world queried");
      trace.record("truth_honesty", "commerce composer applies honest boundaries · no fabrication when corpus empty");
      const commerce = composeCommerceReply({ message, userMarket: opts.userMarket });
      trace.record("commerce", `category=${commerce.detectedCategory ?? "none"} · offers=${commerce.offersMatched}`);
      return {
        reply: commerce.reply,
        suggestions: commerce.suggestions,
        card: commerce.card as unknown as Card,
      };
    }

    case "accommodation": {
      trace.record("memory", "accommodation session loaded");
      trace.record("world_knowledge", "accommodation retrieval");
      trace.record("insight", "accommodation Insight decision");
      trace.record("curiosity", "next-best question chosen");
      trace.record("smart_questioning", "one best question surfaced");
      trace.record("truth_honesty", "provenance + honest boundaries applied");
      trace.record("spatial_awareness", "area filter via haversine");
      trace.record("time_awareness", "date slot considered");
      const session = getSession(opts.conversationId);

      // Stage 3.9 · Goal Tracking · create or progress the accommodation goal.
      let goalNext: Goal | undefined = session?.goal;
      const out = composeAccommodationReply(message, opts, session);

      if (opts.conversationId) {
        // Progression signal: slots changed vs prior (knowledge questions
        // don't change slots by design — see Stage 3.7 fix). A turn that
        // asked "What is a kos-kosan?" mid-flow does NOT count as goal
        // progress; the goal transitions to paused via markGoalNotProgressed
        // elsewhere. Discovery turns that change slots count as progress.
        const priorAccomm = session?.accommodation;
        const slotsChanged = JSON.stringify(priorAccomm ?? {}) !== JSON.stringify(out.updatedSlots);

        if (!goalNext || goalNext.kind !== "accommodation" || goalNext.status === "abandoned" || goalNext.status === "completed") {
          goalNext = newAccommodationGoal(out.updatedSlots);
          trace.record("goal_tracking", `goal created id=${goalNext.id}`);
        } else if (slotsChanged) {
          const before = goalNext.status;
          goalNext = progressAccommodationGoal(goalNext, out.updatedSlots);
          trace.record("goal_tracking", `goal progressed ${before}→${goalNext.status}`);
        } else {
          // Same slots · treat as a non-progressing turn (knowledge Q).
          const before = goalNext.status;
          goalNext = markGoalNotProgressed(goalNext);
          trace.record("goal_tracking", `goal not-progressed ${before}→${goalNext.status}`);
        }

        // Stage 3.14 · Phase 7 · Entity Intelligence · extract entities
        // from the user message + capture businesses NEX presented.
        const nowIso = new Date().toISOString();
        const userEntities = extractEntities(message, nowIso);
        const cardPayload = out.card as unknown as { payload?: { hits?: Array<{ id?: string; name?: string | null; category?: string }> } } | undefined;
        const presentedEntities = capturePresentedBusinesses(cardPayload?.payload?.hits ?? [], nowIso);
        // Resolve BEFORE merging THIS turn's presented entities into the
        // window · a pronoun in this turn refers to what NEX presented in
        // an EARLIER turn, not what it's about to present now.
        const priorWindow = session?.entities ?? [];
        // Stage 3.41.d P4 · thread session's currentReference through so
        // pronouns like "message them" resolve to a recent pick even
        // when the presented batch has multiple candidates. Staleness
        // enforced in the resolver.
        const priorRefBiz = session?.currentReference?.business;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const priorRefTurn = (session?.currentReference as any)?.resolvedInTurn as number | undefined;
        // Stage 3.41.d P1 · turnCount was bumped at the TOP of
        // orchestrateChatTurnLive so this value is THIS turn's number.
        const currentTurn = session?.turnCount ?? 1;
        const currentReferenceEntity: RecognisedEntity | undefined = priorRefBiz
          ? {
              id: `business_name:${priorRefBiz.canonical}`,
              kind: "business_name",
              raw: priorRefBiz.raw,
              canonical: priorRefBiz.canonical,
              refId: priorRefBiz.refId,
              source: "nex_reply",
              atIso: nowIso,
            }
          : undefined;
        const resolution: ReferenceResolution = resolveReference(userEntities, priorWindow, {
          currentReferenceEntity,
          currentReferenceResolvedInTurn: priorRefTurn,
          currentTurn,
        });
        trace.record("reference_resolution", resolution.resolved
          ? `resolved ${resolution.refKind}=${resolution.offset} → ${resolution.entity.canonical}`
          : `unresolved · ${resolution.reason}`);

        const mergedEntities = mergeEntityWindow(
          priorWindow,
          [...userEntities, ...presentedEntities],
        );
        trace.record("entity_intelligence", `user=${userEntities.length} · presented=${presentedEntities.length} · window=${mergedEntities.length}`);

        // Stage 3.41.d P4 · stamp resolvedInTurn on the current-turn
        // summary when we successfully resolved. Preserves the prior
        // resolvedInTurn when THIS turn didn't itself resolve · that's
        // how staleness accrues (silence about the pick counts).
        //
        // Stage 3.41.h · vertical-switch cleanup · if the prior goal
        // was food/commerce and this turn just promoted us into
        // accommodation, the food/commerce reference and its business
        // entities must NOT leak into the new accommodation
        // conversation. Detect the switch and clear before deriving
        // resolution/summary/merge. Fail-closed.
        const priorGoalKindForSwitch = session?.goal?.kind;
        const switchedIntoAccommodation = isVerticalSwitch(priorGoalKindForSwitch, "accommodation");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevRefTurn = switchedIntoAccommodation
          ? undefined
          : (session?.currentReference as any)?.resolvedInTurn as number | undefined;
        const priorSummaryForCarry = switchedIntoAccommodation ? undefined : session?.currentReference;
        const resolutionSummary = summariseResolution(resolution);
        const currentReferenceSummary = resolution.resolved
          ? { ...resolutionSummary, resolvedInTurn: currentTurn }
          : (prevRefTurn !== undefined
              ? { ...(priorSummaryForCarry ?? resolutionSummary), resolvedInTurn: prevRefTurn }
              : resolutionSummary);
        // Also prune business_name entities from the prior vertical
        // so ordinal resolution on the FIRST accommodation turn can't
        // accidentally match against food/commerce entries still in
        // the window. Non-business_name entities (dates, quantities)
        // are preserved.
        const entitiesAfterSwitch = switchedIntoAccommodation
          ? mergedEntities.filter((e) => {
              if (e.kind !== "business_name") return true;
              // Keep only entities from THIS accommodation turn
              // (source=nex_reply captured just now with fresh atIso).
              return e.source === "nex_reply" && e.atIso === nowIso;
            })
          : mergedEntities;
        upsertSession({
          conversationId: opts.conversationId,
          createdAt: session?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          accommodation: out.updatedSlots,
          goal: goalNext,
          entities: entitiesAfterSwitch,
          // turnCount was bumped at the top of orchestrateChatTurnLive ·
          // don't reset it here · preserve the incremented value that
          // reflects THIS turn.
          turnCount: session?.turnCount ?? currentTurn,
          // Always persist the resolution summary · resolved OR unresolved.
          // On vertical-switch turns, prior summary was discarded (see
          // priorSummaryForCarry above) so we land on THIS turn's summary.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          currentReference: currentReferenceSummary as any,
          // Universal Entity Intelligence (Philip 2026-09-06 · AUTHORIZE).
          // Preserve any prior card memo across accommodation turns so a
          // next-turn attribute question can answer from real evidence.
          entityCardMemo: session?.entityCardMemo,
          // Preserve dialogueTurns + lastNexQuestion + related session
          // continuity fields as well · other pipeline code depends on
          // these surviving the accommodation upsert.
          dialogueTurns: session?.dialogueTurns,
          lastNexQuestion: session?.lastNexQuestion,
          frame: session?.frame,
        });

        // Stage 3.15 · when a book-intent turn resolves to a specific
        // business, enhance the reply so NEX explicitly names what it
        // understood the user meant. Fires ONLY when the user's book
        // intent is present AND we resolved cleanly. Composer's honest
        // "can't book" boundary still ships.
        if (resolution.resolved && out.updatedSlots?.action === "book" && !out.reply.toLowerCase().includes(resolution.entity.raw.toLowerCase())) {
          out.reply = `You mean ${resolution.entity.raw} — ${out.reply.charAt(0).toLowerCase()}${out.reply.slice(1)}`;
        }

        // ─── Discovery Continuity Slice (Philip 2026-09-06 · CEREMONIAL
        //     AUTHORIZE · D1) ─────────────────────────────────────────
        //
        // WHY: Wave 5 identified D1 · when the user's turn is an
        // anaphoric reference to an entity NEX presented in a prior
        // accommodation discovery turn ("the first one" · "the second"
        // · "that one" · "tell me more about the first"), the composer
        // was re-emitting the discovery opener instead of anchoring on
        // the resolved entity. session.entities was already populated
        // by `capturePresentedBusinesses` above · resolveReference was
        // already resolving correctly · only the reply-side handoff was
        // missing.
        //
        // HOW: use the existing semantic reference intelligence. Only
        // fires when the resolver returned refKind = ordinal / pronoun /
        // pronoun_via_current_reference · never on fresh discovery
        // turns · never phrase-matched. The overridden reply names the
        // resolved entity honestly (raw name + 1-indexed offset in the
        // prior list) and invites a specific follow-up. NO fabricated
        // attributes · NO new evidence · NO new memory · uses only
        // fields already present on the RecognisedEntity resolveReference
        // returned.
        //
        // PRESERVATION: fresh conversations have no session.entities so
        // resolution.resolved is false and this block does nothing · P0.4
        // fresh-conversation ordinal protection remains intact. Book
        // intent (line 605-607) wins because it fires first when
        // action==="book". Comparison/Recommendation branches downstream
        // set out.reply from their own reports so they win when they
        // fire. Vertical-switch protection (isVerticalSwitch above)
        // already cleared prior business_name entities from the window
        // so a hotel → restaurant switch cannot leak.
        else if (
          resolution.resolved &&
          (resolution.refKind === "ordinal"
            || resolution.refKind === "pronoun"
            || resolution.refKind === "pronoun_via_current_reference")
        ) {
          const pickName = resolution.entity.raw;
          const pickOffset = resolution.offset;
          const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
          out.reply = lang === "id"
            ? `${pickName} — itu pilihan #${pickOffset} dari daftar sebelumnya. Ingin tahu apa dari yang NEX punya?`
            : `${pickName} — that's #${pickOffset} from the list I showed you. What would you like to know about it from what NEX has?`;
          trace.record(
            "reference_resolution",
            `discovery_continuity: overrode reply for resolved ${resolution.refKind} → ${pickName}#${pickOffset}`,
          );
        }

        // Stage 3.16 · Phase 9 · Comparison · detect compare intent + render.
        // Stage 3.17 · Phase 10 · Recommendation · detect rec intent · ranks.
        // Both consumers use the same candidate-selection + retrieval-enrich
        // pattern. When BOTH intents fire, Recommendation wins the reply
        // (recommendation IS the answer to "compare + which is best?").
        let comparisonReport: ComparisonReport | undefined;
        let recommendationReport: RecommendationReport | undefined;

        const wantsCompare = detectComparisonIntent(message);
        const wantsRecommend = detectRecommendationIntent(message);

        if (wantsCompare || wantsRecommend) {
          const selected = selectComparisonCandidates(userEntities, priorWindow);
          const corpusHits = retrieveKnowledge(mergedEntities.map((e) => e.raw).join(" "), {
            limit: 40, minConfidence: 0.5, preferCategory: "accommodation", market: opts.userMarket,
          });
          const enriched: CompareCandidate[] = selected.map((entity) => {
            const hit = corpusHits.find((h) => h.id === entity.refId);
            return { entity, hit: hit ? { category: hit.category, geo: hit.geo } : undefined };
          });

          if (wantsCompare) {
            comparisonReport = compareCandidates(enriched);
            trace.record("comparison", comparisonReport.compared
              ? `compared ${comparisonReport.candidates.length} candidates`
              : `not compared · ${comparisonReport.reason}`);
          }

          if (wantsRecommend) {
            const recCandidates: RecommendCandidate[] = enriched;
            recommendationReport = recommendFromCandidates(recCandidates, out.updatedSlots);
            trace.record("recommendation", recommendationReport.recommended
              ? `top=${recommendationReport.topPick.canonical} tie=${recommendationReport.tieBreakingNeeded}`
              : `not recommended · ${recommendationReport.reason}`);
          }

          // Reply precedence: Recommendation (specific pick) beats Comparison
          // (side-by-side) beats composer default.
          if (recommendationReport && recommendationReport.recommended) {
            out.reply = renderRecommendationReply(recommendationReport);
          } else if (comparisonReport && comparisonReport.compared) {
            out.reply = renderComparisonReply(comparisonReport);
          } else if (recommendationReport && !recommendationReport.recommended) {
            out.reply = renderRecommendationReply(recommendationReport);
          }
        }

        (out as unknown as { __comparison?: ComparisonReport; __recommendation?: RecommendationReport }).__comparison = comparisonReport;
        (out as unknown as { __comparison?: ComparisonReport; __recommendation?: RecommendationReport }).__recommendation = recommendationReport;
      }

      // Stage 3.9 · surface a resume acknowledgement when the goal
      // just transitioned into `resumed` (user returned after a
      // knowledge interruption / greeting).
      let reply = out.reply;
      if (goalNext && shouldSurfaceResume(goalNext)) {
        reply = resumeAcknowledgement(goalNext) + reply;
      }

      // Stage 3.16 · Comparison report attached (if present).
      // Stage 3.17 · Recommendation report attached (if present).
      const tagged = out as unknown as { __comparison?: ComparisonReport; __recommendation?: RecommendationReport };
      const compReport = tagged.__comparison;
      const recReport = tagged.__recommendation;

      return {
        reply,
        suggestions: out.suggestions,
        card: out.card,
        comparison: compReport,
        recommendation: recReport,
      };
    }

    case "indonesia":
    case "tourism":
    case "food": {
      const hits = retrieveKnowledge(message, { limit: 3, minConfidence: 0.7 });
      if (hits.length === 0) {
        return {
          reply:
            "I don't have that in my grounded knowledge yet — I'd rather say so than guess. If you tell me a specific city or area, I can point you at real places from NEX's directory.",
          suggestions: [
            { label: "Browse businesses", href: "/nex-app/centre" },
          ],
        };
      }
      const primary = hits[0]!;
      const grounded = formatKnowledgeBlock(hits);
      const secondaryFacts = hits.slice(1, 3).map((h) => `\n\n${h.content}`).join("");
      const wantsLiveNudge = intent.intent === "food" || intent.intent === "tourism";
      const liveNudge = wantsLiveNudge
        ? "\n\nFor live specifics (opening hours, prices, availability tonight) I'd need a directory lookup — say the word and I'll open the browser panel."
        : "";
      const provenance = ` (Source: NEX Indonesia knowledge · ${primary.region} · verified ${primary.last_verified}.)`;
      return {
        reply: `${primary.content}${secondaryFacts}${liveNudge}${provenance}`,
        suggestions: wantsLiveNudge
          ? [{ label: "Find nearby", href: "/nex-app/centre" }]
          : [],
        card: {
          kind: "knowledge",
          payload: {
            hits: hits.map((h) => ({ id: h.id, topic: h.topic, region: h.region, stability: h.stability, confidence: h.confidence, last_verified: h.last_verified })),
            grounded_block: grounded,
          },
        } as unknown as Card,
      };
    }

    case "places":
    case "business":
      return {
        reply:
          "I can help you find businesses through NEX's directory. Tell me the type of place and the neighbourhood — e.g. 'coffee shop in Ubud' or 'clinic near Canggu'.",
        suggestions: [
          { label: "Open directory", href: "/nex-app/centre" },
        ],
      };

    case "marketplace":
      return {
        reply:
          "The NEX marketplace surface is where I list items and services. Tell me what you're looking to buy or sell and I'll point you at the right filter.",
        suggestions: [
          { label: "Open marketplace", href: "/nex-app/centre" },
        ],
      };

    case "booking":
      return {
        reply:
          "Booking flows (hotels, tables, drivers) are handled through NEX's directory partners rather than by me directly — I won't invent an availability or a price. Tell me what you're trying to book and where, and I'll surface the right partner surface.",
        suggestions: [
          { label: "Open directory", href: "/nex-app/centre" },
        ],
      };

    case "weather":
      return {
        reply:
          "Weather is live data — I don't store or predict it. For Indonesia the rough guide is: dry season roughly April–October (Bali/Java), wet season the rest. For today's actual conditions, please use a weather app or ask me to open a live source.",
        suggestions: [],
      };

    case "translation":
      return {
        reply:
          "I can help with common Indonesian phrases in text form. If you tell me the phrase and the direction (English↔Indonesian), I'll do my best — for legal or formal documents please use a professional translator.",
        suggestions: [],
      };

    case "writing":
      return {
        reply:
          "I can draft short messages, replies, and captions. Give me the audience, tone, and rough content and I'll take a first pass.",
        suggestions: [],
      };

    case "image":
      return {
        reply:
          "Yes — I can look at images. Attach the photo, screenshot, or document and ask what you'd like me to read or describe.",
        suggestions: [],
      };

    default:
      return null;
  }
}

// ─── Accommodation composer · Stage 3.7 conversational (Philip 2026-08-31) ─
//
// Multi-turn slot-aware composer. Reads any prior session state, merges
// this turn's extraction on top, retrieves with the accumulated context,
// and shapes the reply based on WHAT'S NEW versus WHAT'S KNOWN.
//
// Three modes:
//   DISCOVERY — the default action-oriented mode. Names real properties,
//   acknowledges accumulated slots, asks the next natural refining
//   question, never dumps the tourism essay.
//
//   KNOWLEDGE — question phrasings ("what is a kos-kosan"). Returns the
//   grounded explanation record. Preserves prior session state so a
//   discovery flow can resume on the next turn.
//
//   CORRECTION — user changed their mind ("actually, find me a
//   guesthouse instead"). Acknowledges the switch explicitly.
//
// Honesty boundary: OSM listings are discovery-only. NEX never invents
// availability, prices, ratings, or amenity data. Requests for
// facilities (pool / wifi / breakfast) get an honest "OSM listings
// don't carry facility data" reply.

// Stage 3.31 · Philip 2026-08-31. Deterministic message-language
// detector for accommodation replies. Returns "id" when the message
// contains bounded Bahasa Indonesia markers that don't appear in
// natural English usage; returns "en" otherwise. Kept conservative to
// avoid false positives on English messages that happen to mention
// Indonesian place names or borrowed words (e.g. "kos-kosan",
// "Malioboro", "Jogja").
const ID_LANG_MARKERS: RegExp[] = [
  /\bcari\b/i,
  /\bbutuh\b/i,
  /\bmau\b/i,
  /\bperlu\b/i,
  /\byang\s+(murah|mewah|menengah|bagus|dekat|lain|besar|kecil|baru|lama|paling|pertama|kedua|ketiga)\b/i,
  /\bmana\s+yang\s+paling\b/i,
  /\byang\s+mana\s+yang\b/i,
  /\bbandingkan\b/i,
  /\bpertama\s+dan\s+kedua\b/i,
  /\bdekat\b/i,
  /\bsebenarnya\b/i,
  /\bkolam\s+renang\b/i,
  /\bapa\s+itu\b/i,
  /\bjelaskan\b/i,
  /\bmurah\b/i,
  /\bmewah\b/i,
  /\bmenengah\b/i,
  /\bkamu\b/i,
  /\bkalau\b/i,
  /\bkalo\b/i,
  /\bdong\b/i,
  /\bnih\b/i,
  /\btolong\b/i,
  /\btunjuk\b/i,
  /\bakhir\s+pekan\b/i,
  /\bmalam\s+ini\b/i,
  /\bbesok\b/i,
  /\bada\s+\w+\?/i,
  /\bpesan(kan|in)?\b/i,
  /\bharga\b/i,
  /\bbahasa\b/i,
  /\bsimpan\b/i,
  /\bbagaimana\b/i,
  /\bkenapa\b/i,
  /\bdimana\b/i,
  /\bkapan\b/i,
  /\bsiapa\b/i,
  /\bberapa\b/i,
  /\bper\s+(malam|hari|minggu|bulan)\b/i,
  /\btempat\s+menginap\b/i,
  /\bfasilitas\b/i,
  /\blingkungan\b/i,
  /\bbukan\s+\w+/i,
];

export function detectAccommodationReplyLang(message: string): "en" | "id" {
  return ID_LANG_MARKERS.some((rx) => rx.test(message)) ? "id" : "en";
}

function composeAccommodationReply(
  message: string,
  opts: OrchestrateOptions,
  session: SessionState | null,
): { reply: string; suggestions: Suggestion[]; card?: Card; updatedSlots: AccommodationSlots } {
  // Stage 3.31 · Philip 2026-08-31. Reply language derives from the
  // CURRENT MESSAGE — if the user typed Indonesian, they get an
  // Indonesian reply; if they typed English, English. Market is only
  // a hint (not a hard gate) because ID-market users routinely type
  // English and expect English back. Numbers, business names, area
  // names, provenance regions, and honesty boundaries carry identical
  // facts in both languages — Truth doctrine preserved verbatim.
  const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
  const L = (en: string, id: string): string => (lang === "id" ? id : en);

  const extraction = extractAccommodationSlots(message);
  const priorSlots = session?.accommodation;
  // Knowledge questions mention type/location vocabulary as TOPIC not
  // as preference — "What is a kos-kosan?" contains "kos" but the user
  // isn't asking for a kos. Preserve prior slots without merging the
  // question's noun mentions on top.
  const slotsForMerge = extraction.isKnowledgeQuestion ? {} : extraction.slots;
  const mergedSlots = mergeAccommodationSlots(priorSlots, slotsForMerge);
  const introduced = newSlotsIntroduced(priorSlots, slotsForMerge);

  // Compose a synthetic retrieval string so accumulated slots (area,
  // location, type from prior turns) still bias the ranker even when
  // the current turn is a single word like "Cheap." · deterministic ·
  // no LLM. For knowledge questions we use the RAW message only: the
  // user is asking about the topic in the message, not searching under
  // their accumulated preferences ("What is a kos-kosan?" must return
  // the kos record, not the hotel record from earlier state).
  const searchText = extraction.isKnowledgeQuestion
    ? message
    : [message, mergedSlots.location, mergedSlots.area, mergedSlots.type].filter(Boolean).join(" ");

  const hits = retrieveKnowledge(searchText, {
    limit: 15,
    minConfidence: 0.5,
    preferCategory: "accommodation",
    market: opts.userMarket,
  });

  // Stage 3.34 · Phase 27a doctrine: ONE RETRIEVAL → TEXT + CARDS.
  // When the outer wrapper (orchestrateChatTurnLive) has already queried
  // the live World, its records REPLACE the JSON-derived realPropsAll
  // so the composer's spoken opener names those exact businesses and
  // its count matches the World's totalAvailable · text and cards now
  // originate from the SAME evidence set. Knowledge explanations still
  // come from the JSON corpus (kos-kosan · batik · tourism editorial ·
  // per doctrine §12).
  const realPropsAll = opts.__worldRecords && !extraction.isKnowledgeQuestion
    ? worldRecordsToKnowledgeShape(opts.__worldRecords)
    : hits.filter((h) => h.id.startsWith("place:accommodation:"));
  const realPropsAllCount = opts.__worldRecords
    ? (opts.__worldTotalAvailable ?? opts.__worldRecords.length)
    : realPropsAll.length;
  const explanations = hits.filter((h) => h.id.startsWith("accommodation:"));

  // ─── Knowledge question → grounded explanation ──────────────────
  if (extraction.isKnowledgeQuestion) {
    const primary = explanations[0] ?? hits.filter((h) => !h.id.startsWith("place:accommodation:"))[0];
    if (!primary) {
      return {
        reply: L(
          "I don't have that in my accommodation knowledge yet. If you tell me a specific area or type (hotel, guesthouse, homestay, kos), I'll try again.",
          "Saya belum punya info itu di pengetahuan akomodasi saya. Kalau kamu sebutkan area atau tipe spesifik (hotel, guesthouse, homestay, kos), saya coba lagi.",
        ),
        suggestions: [],
        updatedSlots: mergedSlots,
      };
    }
    const provenance = L(
      ` (Source: NEX Indonesia knowledge · ${primary.region} · verified ${primary.last_verified}.)`,
      ` (Sumber: Pengetahuan NEX Indonesia · ${primary.region} · diverifikasi ${primary.last_verified}.)`,
    );
    // Preserve prior state; add a soft reminder if a discovery flow was in progress.
    const resumeHint = (priorSlots?.type || priorSlots?.location || priorSlots?.area)
      ? L(
          ` (I'll keep the ${describeSlots(mergedSlots)} search in mind — just say the word to continue.)`,
          ` (Saya simpan pencarian ${describeSlots(mergedSlots, "id")} — tinggal bilang kalau mau lanjut.)`,
        )
      : "";
    return {
      reply: `${primary.content}${provenance}${resumeHint}`,
      suggestions: [{ label: "Find nearby", href: "/nex-app/centre" }],
      card: {
        kind: "knowledge",
        payload: {
          hits: hits.slice(0, 3).map((h) => ({ id: h.id, topic: h.topic, region: h.region, stability: h.stability, confidence: h.confidence, last_verified: h.last_verified })),
        },
      } as unknown as Card,
      updatedSlots: mergedSlots,
    };
  }

  // ─── Post-retrieval filtering with merged slots (STRICT) ────────
  //
  // Filters are STRICT · when the user asked for a villa and the
  // corpus has zero villas, we return 0 matches rather than falling
  // back to hotels-labelled-as-villas. Fabrication-adjacent silent
  // fallback would violate the "never invent" doctrine. Insight's
  // over-narrowed EUREKA signal then honestly says "no villas but I
  // have N other listings — want to widen the search?"
  //
  // Area filter uses HONEST geographic proximity (haversine ~1.5km)
  // against known area coordinates (Malioboro is a real street with a
  // real lat/lng). OSM property records don't tag area names in their
  // keywords, so a text-bag match would either drop everything or —
  // if we relaxed — silently include far-away properties as if they
  // were "near Malioboro". Distance-based is the doctrine-compliant
  // way to answer "near X" when we actually know where X is.
  let realProps = realPropsAll;
  if (mergedSlots.type) {
    const wantCategory = `accommodation.${mergedSlots.type}`;
    realProps = realProps.filter((h) => h.category === wantCategory);
  }
  if (mergedSlots.area) {
    realProps = filterByArea(realProps, mergedSlots.area);
  }

  // ─── Ask Insight what to do next (Stage 3.8 · Philip 2026-08-31) ─
  //
  // Insight is a Brain subsystem, not another Brain. It looks at the
  // merged slot state, the retrieval outcome, and the current turn's
  // shape (book/price/amenity intents, corrections) and returns ONE
  // decision: what — if anything — is worth saying next. When it
  // returns shouldSpeak=false, the composer stays silent about
  // follow-up questions and just presents the results.
  const isBookIntent = mergedSlots.action === "book";
  const isPriceQuestion = /\b(how much|berapa|price|prices|harga|cost|costs|rate|rates|per night|per malam)\b/i.test(message);
  const amenitiesAsked = extraction.slots.amenities ?? [];
  const isAmenityQuestion = amenitiesAsked.length > 0;

  const insight = decideAccommodationInsight({
    message,
    extraction,
    priorSlots,
    mergedSlots,
    realPropertiesMatched: realProps.length,
    realPropertiesAvailable: realPropsAllCount,
    isBookIntent,
    isPriceQuestion,
    isAmenityQuestion,
    amenitiesAsked,
    lang,
  });

  // Learning-gap recording · feeds workforce prioritisation later.
  // Best-effort · never breaks the reply.
  recordInsightGap(insight, { userMarket: opts.userMarket, intent: "accommodation" });

  // Stage 3.13 · Learning · mirror Insight signals into the ledger.
  if (insight.reason === "learning_gap" && insight.learningGap) {
    recordLearning({
      kind: "insight_gap_detected",
      conversationId: opts.conversationId,
      scope: insight.learningGap.scope,
      summary: `user asked about ${insight.learningGap.unmet}, no data available`,
      detail: { query: insight.learningGap.query, unmet: insight.learningGap.unmet },
    });
  }
  if (insight.reason === "contradiction" && insight.contradictionSummary) {
    recordLearning({
      kind: "slot_correction_observed",
      conversationId: opts.conversationId,
      scope: "accommodation.slots",
      summary: insight.contradictionSummary,
    });
  }

  // ─── Insight-driven honest boundaries (book / price / amenity) ──
  // These are opportunities/learning-gaps where the reply IS the
  // insight — no property list, no boilerplate.
  if (insight.reason === "opportunity" && isBookIntent) {
    const names = realProps.slice(0, 3).map(nameOf);
    const suffix = names.length > 0
      ? L(
          ` I can put ${names.join(", ")} in front of you as candidates.`,
          ` Saya bisa tampilkan ${names.join(", ")} sebagai kandidat.`,
        )
      : "";
    return {
      reply: `${insight.question}${suffix}`,
      suggestions: [{ label: "Open directory", href: "/nex-app/centre" }],
      updatedSlots: mergedSlots,
    };
  }
  if (insight.reason === "learning_gap" && isPriceQuestion) {
    const names = realProps.slice(0, 3).map(nameOf);
    const suffix = names.length > 0
      ? L(
          ` I have candidates — ${names.join(", ")} — but you'd need to check their prices directly or via a booking platform.`,
          ` Saya punya kandidat — ${names.join(", ")} — tapi harga perlu kamu cek langsung atau lewat platform booking.`,
        )
      : "";
    return {
      reply: `${insight.question}${suffix}`,
      suggestions: [{ label: "Open directory", href: "/nex-app/centre" }],
      updatedSlots: mergedSlots,
    };
  }
  if (insight.reason === "learning_gap" && isAmenityQuestion) {
    const names = realProps.slice(0, 3).map(nameOf);
    const suffix = names.length > 0
      ? L(
          ` I can share three candidates — ${names.join(", ")} — so you can check them directly.`,
          ` Saya bisa bagikan tiga kandidat — ${names.join(", ")} — supaya kamu cek langsung.`,
        )
      : "";
    return {
      reply: `${insight.question}${suffix}`,
      suggestions: [{ label: "Open directory", href: "/nex-app/centre" }],
      updatedSlots: mergedSlots,
    };
  }

  // ─── Discovery reply (with Insight-provided opener/tail) ────────
  if (realProps.length > 0) {
    const names = realProps.slice(0, 3).map(nameOf);
    const list = names.join(", ");
    const more = realProps.length > 3 ? L(", and more", ", dan lainnya") : "";
    const summaryEn = describeSlots(mergedSlots);
    const summary = lang === "id" ? describeSlots(mergedSlots, "id") : summaryEn;
    const acknowledgeIntroduced = !extraction.correction && introduced.length > 0 && (priorSlots?.type || priorSlots?.location || priorSlots?.area)
      ? L(`Got it — ${summaryEn}. `, `Baik — ${summary}. `)
      : "";
    const correctionLead = insight.reason === "contradiction" && insight.contradictionSummary
      ? `${insight.contradictionSummary}. `
      : "";
    const defaultOpener = L(
      `I've got ${realPropsAllCount} real listings for ${summaryEn} — `,
      `Saya punya ${realPropsAllCount} listingan asli untuk ${summary} — `,
    );
    const opener = correctionLead || acknowledgeIntroduced || defaultOpener;
    const body = `${list}${more}. `;
    const boundary = L(
      "These are OpenStreetMap community listings so they're for discovery, not live booking.",
      "Ini listingan komunitas OpenStreetMap, jadi untuk penemuan saja, bukan booking langsung.",
    );
    // Only trail with a question when Insight has one worth asking.
    // Insight of reason=contradiction has no `question` (its role was
    // the opener) so no trailing question — the user just changed
    // their mind, we don't push them for more.
    const trailingQuestion = insight.shouldSpeak && insight.question ? ` ${insight.question}` : "";
    const reply = `${opener}${body}${boundary}${trailingQuestion}`;
    return {
      reply,
      suggestions: [{ label: "Open directory", href: "/nex-app/centre" }],
      card: {
        kind: "accommodation_discovery",
        payload: {
          slots: mergedSlots,
          insight: { reason: insight.reason, priority: insight.priority },
          hits: realProps.slice(0, 5).map((h) => ({
            id: h.id, name: nameOf(h), category: h.category, region: h.region, source: h.source,
          })),
        },
      } as unknown as Card,
      updatedSlots: mergedSlots,
    };
  }

  // ─── No real matches · Insight tells us what to ask/say ─────────
  //
  // Eureka presentation: when Insight has a grounded observation to
  // surface (currently only over-narrowed clarification), the question
  // string already carries the "One thing I noticed…" opener — the
  // composer just prepends the slot-summary context so the user knows
  // WHAT the observation is about.
  const summaryEn = describeSlots(mergedSlots);
  const summary = lang === "id" ? describeSlots(mergedSlots, "id") : summaryEn;
  const isEureka = insight.presentation === "eureka" && insight.shouldSpeak;
  const knowsSomething = mergedSlots.type || mergedSlots.location || mergedSlots.area;
  const prefix = isEureka
    ? "" // Eureka opener lives inside insight.question.
    : knowsSomething
      ? L(`Got it — ${summaryEn}. I don't have matching real listings yet. `, `Baik — ${summary}. Belum ada listingan asli yang cocok. `)
      : L("Absolutely — I can help you find a place to stay. ", "Baik — saya bisa bantu cari tempat menginap. ");
  const tail = insight.shouldSpeak && insight.question
    ? insight.question
    : L("Tell me more about what you're after and I'll try again.", "Ceritakan lebih detail apa yang kamu cari, saya coba lagi.");
  return {
    reply: `${prefix}${tail}`,
    suggestions: [{ label: "Open directory", href: "/nex-app/centre" }],
    updatedSlots: mergedSlots,
  };
}

// Known Indonesian sub-area centroids · used ONLY for honest
// distance-based "near X" filtering. Coordinates are approximate
// (street midpoints or district centres) · widely verifiable. Any
// property within ~1.5km of the centroid counts as "near". Areas we
// don't have coordinates for fall back to a text-bag match against
// keywords/description.
const AREA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  malioboro: { lat: -7.7929, lng: 110.3660 },
  prawirotaman: { lat: -7.8155, lng: 110.3650 },
  kraton: { lat: -7.8050, lng: 110.3644 },
  kotagede: { lat: -7.8271, lng: 110.4001 },
  tugu: { lat: -7.7828, lng: 110.3671 },
  gondomanan: { lat: -7.8010, lng: 110.3673 },
};

/** Approximate distance in km between two lat/lng points (haversine).
 *  Good to ~1% at these latitudes · plenty for a "within 1.5km" gate. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function filterByArea<T extends { geo?: { lat?: number; lng?: number }; content?: string; keywords?: string[]; topic?: string }>(
  hits: readonly T[],
  areaCanonical: string,
): T[] {
  const centroid = AREA_CENTROIDS[areaCanonical];
  if (centroid) {
    // Geographic proximity · honest distance-based match.
    return hits.filter((h) => {
      if (typeof h.geo?.lat === "number" && typeof h.geo?.lng === "number") {
        return distanceKm({ lat: h.geo.lat, lng: h.geo.lng }, centroid) <= 1.5;
      }
      return false; // Property without coordinates can't be honestly matched to an area.
    });
  }
  // Unknown area · fall back to opportunistic text-bag match on
  // keywords/description/topic. Still honest — only matches when the
  // area name literally appears in the record's own text.
  const needle = areaCanonical.toLowerCase();
  return hits.filter((h) => {
    const bag = [h.content ?? "", ...(h.keywords ?? []), h.topic ?? ""].join(" ").toLowerCase();
    return bag.includes(needle);
  });
}

function nameOf(h: { name?: string; content?: string; topic?: string; keywords?: string[] }): string {
  // Stage 3.34: WorldRecord-adapted hits carry an explicit `.name` field ·
  // prefer it directly. JSON OSM records store `description = "hotel ·
  // Griya Sentana · community-verified..."` · split on middle-dot and
  // take the property name segment as before.
  if (h.name && h.name.trim().length > 0) return h.name.trim();
  const parts = (h.content ?? "").split(" · ");
  if (parts.length >= 2 && parts[1] && parts[1].trim().length > 0) return parts[1].trim();
  return h.topic ?? "(unnamed)";
}

// ─── Stage 3.34 · Phase 27a · World → Knowledge-shape adapter ─────────
//
// Doctrine (§Single-Evidence-Object): the accommodation composer's
// downstream logic (post-filtering · Insight input · nameOf · card
// building) already expects a shape close to the JSON KnowledgeHit.
// Rather than fork every downstream call site, we adapt WorldRecord to
// a KnowledgeHit-like shape that preserves the composer's contract
// while carrying the real World identity. The resulting objects satisfy
// filterByArea (via .geo) and nameOf (via .name), and the .category
// string matches the "accommodation.<type>" convention the composer's
// post-filter uses.
function worldRecordsToKnowledgeShape(records: readonly import("./world-adapters/types").WorldRecord[]) {
  return records.map((r) => ({
    id: `place:accommodation:${r.id}`,
    name: r.name,
    topic: r.name,
    content: `${r.category ?? "accommodation"} · ${r.name}`,
    category: `accommodation.${r.category ?? "unknown"}`,
    keywords: r.amenities ?? [],
    geo: r.latitude != null && r.longitude != null ? { lat: r.latitude, lng: r.longitude } : undefined,
    region: r.city ?? "Yogyakarta",
    // Stash the original WorldRecord so downstream Presentation can rebuild
    // full evidence-driven cards without a second retrieval.
    __worldRecord: r,
  }));
}

// ─── Field extractors for cards ────────────────────────────────────────

function extractMeetingTitle(_message: string): string {
  return "Meeting";
}

function extractMeetingDate(message: string): string {
  const lower = message.toLowerCase();
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  if (/\btomorrow\b/.test(lower)) return "Tomorrow";
  if (/\btoday\b/.test(lower))    return "Today";
  for (const d of days) {
    const nextMatch = new RegExp(`\\bnext\\s+${d}\\b`, "i").test(lower);
    if (nextMatch) return "Next " + d.charAt(0).toUpperCase() + d.slice(1);
  }
  for (const d of days) {
    if (new RegExp(`\\b${d}\\b`, "i").test(lower)) {
      return d.charAt(0).toUpperCase() + d.slice(1);
    }
  }
  const monthMatch = message.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  );
  if (monthMatch) {
    return `${monthMatch[1]} ${monthMatch[2].charAt(0).toUpperCase() + monthMatch[2].slice(1).toLowerCase()}`;
  }
  return "Not specified";
}

function extractMeetingTime(message: string): string {
  const m = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (m) {
    const h = m[1];
    const mins = m[2] ?? "00";
    const ampm = m[3].toUpperCase();
    return `${h}:${mins} ${ampm}`;
  }
  const m24 = message.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m24) return `${m24[1]}:${m24[2]}`;
  return "Not specified";
}

function extractMeetingReminder(message: string): string {
  const lower = message.toLowerCase();
  if (/morning of|morning reminder|reminder.*morning/.test(lower)) {
    return "Morning of the day";
  }
  const m = lower.match(/(\d+)\s*(hour|hr|min|minute)s?\s*(before|prior|earlier)?/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].startsWith("hour") || m[2] === "hr" ? "hour" : "minute";
    return `${n} ${unit}${n === 1 ? "" : "s"} before`;
  }
  return "1 hour before";
}

function extractImageSubject(message: string): string {
  const m = message.match(
    /(?:for|of|about|showing|featuring)\s+(?:a\s+|an\s+|some\s+|the\s+|my\s+)?([a-z][a-z\s]{2,50})/i,
  );
  if (m) {
    const words = m[1].trim().split(/\s+/).slice(0, 6).join(" ");
    return words.replace(/\s+(with|and|for|in|on|at)$/i, "").trim() || "Not specified";
  }
  return "Not specified";
}

function extractImageOverlay(message: string): string {
  const q = message.match(/["']([^"']{2,50})["']/);
  if (q) return q[1];
  const w = message.match(/with\s+([a-z0-9][a-z0-9\s]{1,50}?)\s+on\s+it\b/i);
  if (w) return w[1].trim();
  const s = message.match(/(?:saying|that says|text|caption)\s+["']?([a-z0-9\s]{2,50}?)["']?(?:\.|,|$)/i);
  if (s) return s[1].trim();
  return "Not specified";
}

function extractImageFormat(message: string): string {
  const lower = message.toLowerCase();
  if (/instagram/.test(lower))  return "Instagram Portrait";
  if (/facebook/.test(lower))   return "Facebook Feed";
  if (/story/.test(lower))      return "Instagram Story";
  if (/cover/.test(lower))      return "Facebook Cover";
  if (/flyer|a4\b/.test(lower)) return "A4 Flyer";
  if (/a5\b/.test(lower))       return "A5 Flyer";
  if (/twitter|linkedin/.test(lower)) return "Social Post";
  return "Not specified";
}

// ─── Canonical Brain orchestration ─────────────────────────────────────

export function orchestrateChatTurn(message: string, opts: OrchestrateOptions = {}): BrainReply {
  const lower = message.toLowerCase();

  // Stage 3.9 · Capability Registry activation trace. Records which
  // Brain capabilities the current turn actually exercised · returned
  // in `capabilities[]` for honest audit.
  const trace = new ActivationTrace();
  trace.record("perception", "message received");
  trace.record("self_awareness", "capability registry consulted");

  // 1. Safety mode — always wins.
  const safety = classifySafetySignal(message);
  if (safety.requiresSafetyResponse) {
    trace.record("safety", `signal=${safety.signal}`);
    const safetyReply = composeSafetyResponse(safety);
    return {
      reply: safetyReply.reply,
      suggestions: safetyReply.suggestions,
      intent: `safety.${safety.signal}`,
      intent_reason: safety.reason,
      capabilities: trace.summary().capabilities,
    };
  }

  // 2. Theme routing.
  const wantsReset =
    /\b(reset|restore|default|standard|original nex|standard nex)\b/i.test(lower) ||
    /back to (default|original|standard|normal|the original|the default)/i.test(lower) ||
    /(remove|switch off|disable|clear|turn off) (my |the )?(theme|custom theme|blossom|cherry blossom)/i.test(lower) ||
    /restore (my |the )?(workspace|nex|theme)/i.test(lower) ||
    /(switch|go|change) back to (nex|the original|standard)/i.test(lower) ||
    /use the (original|standard|default) (nex|design|workspace)/i.test(lower);
  if (wantsReset) {
    return {
      reply:
        "Done. Your workspace has been restored to the original Nex design. If you'd like to personalise it again, just describe how you'd like your workspace to feel.",
      suggestions: [],
      theme_command: { action: "reset" },
    };
  }

  const wantsBlossom =
    /\b(cherry blossom|blossom|sakura)\b/i.test(lower) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(soft |cute |gentle )?(and )?(pink|blush|rose)/i.test(lower) ||
    /pink (workspace|chat|nex|theme|style)/i.test(lower);
  if (wantsBlossom) {
    return {
      reply:
        "Done! Your workspace now has a soft cherry blossom style. If this isn't quite the right fit, tell me the feeling you're after and I'll create another one.",
      suggestions: [],
      theme_command: { action: "activate", theme_id: "blossom" },
    };
  }

  const wantsGrandEntrance =
    /\b(grand entrance|luxury home|luxury workspace|premium workspace|five million|£5m|five ?m home)\b/i.test(lower) ||
    /\b(staircase[- ]?light[- ]?cream|staircase[- ]?light|light[- ]?cream|staircase[- ]?cream)\b/i.test(lower) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(like |into )?(a |the |an )?(luxury|luxurious|premium|elegant|grand|modern|apple|villa)/i.test(lower) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(like |into )?(a |the |an )?(workshop|craftsman|carpenter|joiner)/i.test(lower) ||
    /(luxury|luxurious|premium|elegant|grand|villa|workshop|craftsman|carpenter|joiner) (feel|style|workspace|theme|vibe)/i.test(lower) ||
    /(cream|bronze|brass|copper|champagne|gold) (workspace|chat|nex|theme|style)/i.test(lower) ||
    /(make|give) (my |the |it )?(workspace |chat )?(a )?(warm |soft )?(cream|bronze|brass|champagne|gold) (feel|look)/i.test(lower) ||
    /(warm |soft )?(cream and bronze|bronze and cream|glass and cream|cream and gold|bronze and gold)/i.test(lower);
  if (wantsGrandEntrance) {
    return {
      reply:
        "Done. Your workspace now has a Grand Entrance feel — frosted glass over warm cream, bronze accents and a subtle champagne trim. If it's not quite the right fit, tell me the feeling you're after and I'll create another one.",
      suggestions: [],
      theme_command: { action: "activate", theme_id: "staircase_light_cream" },
    };
  }

  const wantsWalnutSanctum =
    /\b(walnut sanctum|walnut|old money|old[- ]world|library|study|master(?:'s)? study|sanctum)\b/i.test(lower) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(like |into )?(a |the |an )?(private )?(study|library|drawing[- ]?room|reading room|gentleman[' ]?s club)/i.test(lower) ||
    /(dark|moody|deep) (and )?(warm|luxurious|luxury|masculine|handsome|elegant)/i.test(lower) ||
    /(brass|amber|dark walnut) (workspace|chat|nex|theme|style)/i.test(lower) ||
    /(walnut and brass|brass and walnut|amber and walnut|walnut and amber|dark and warm)/i.test(lower);
  if (wantsWalnutSanctum) {
    return {
      reply:
        "Done. Your workspace now has a Walnut Sanctum feel — deep walnut wood, a warm amber sconce and antique-brass hairlines. Old-money library energy. Tell me the feeling you're after if you'd like something different.",
      suggestions: [],
      theme_command: { action: "activate", theme_id: "staircase_walnut" },
    };
  }

  const wantsOtherPremiumTheme =
    /\b(luxury|luxurious|gold|black and gold|elegant|premium)\b.*(workspace|theme|look|feel|style)/i.test(lower) ||
    /\b(military|tactical|command|army|marine)\b.*(workspace|theme|look|feel|style)/i.test(lower) ||
    /\b(glass|apple|modern|futuristic|clean)\b.*(workspace|theme|look|feel|style)/i.test(lower) ||
    /\b(industrial|workshop|trades|construction|utility)\b.*(workspace|theme|look|feel|style)/i.test(lower);
  if (wantsOtherPremiumTheme) {
    return {
      reply:
        "I understand the feeling you're after. Blossom is the first premium workspace I've finished — more styles like Luxury, Military, Glass and Industrial are on my way. In the meantime you can try Blossom or return to the original Nex design.",
      suggestions: [],
    };
  }

  if (mentionsThemeIntent(lower)) {
    return {
      reply:
        "I've got two premium workspaces ready right now — Blossom (soft cherry pink) and Grand Entrance (frosted glass with warm bronze). Say which one you'd like, or ask me to reset back to the original Nex.",
      suggestions: [],
    };
  }

  // 3. Image / banner / marketing creation cards.
  const wantsCreation =
    /(create|make|design|build|generate|edit|change|resize|remove|replace|inpaint|outpaint)\s+.*(banner|poster|logo|flyer|advert(isement)?|ad|graphic|image|picture|design|marketing|render|thumbnail|artwork)/i.test(lower) ||
    /^(banner|poster|logo|flyer|design|graphic|artwork|thumbnail)\b/i.test(lower.trim()) ||
    /(instagram|facebook|linkedin|tiktok|twitter|x)\s+(banner|post|ad|advert|cover|story|reel)/i.test(lower);
  if (wantsCreation) {
    const card: ImageCreationCard = {
      type: "image_creation",
      fields: {
        subject: extractImageSubject(message),
        overlay: extractImageOverlay(message),
        format: extractImageFormat(message),
      },
      status: "coming_soon",
      status_label: "Coming Soon",
      actions: [
        { kind: "coming_soon", label: "Notify me when ready", toast: "I'll surface this the moment image creation ships. No sign-up needed." },
        { kind: "link", label: "Find a designer", href: "/nex-app/centre" },
        { kind: "dismiss", label: "Cancel" },
      ],
    };
    return {
      reply:
        "I've captured what I understood from your request. Image creation is on the way — once it lands I'll build this with you inside our conversation, edits and all. Have I missed any details?",
      suggestions: [],
      card,
    };
  }

  // 4. Calendar / reminder cards.
  const wantsCalendarOrReminder =
    /(save|schedule|book|create|set|add|make)\s+.*(meeting|appointment|event|reminder|note)/i.test(lower) ||
    /\bremind me\b/i.test(lower) ||
    /\bset (a |the )?reminder\b/i.test(lower) ||
    /\b(open|check|add to) (my |the )?calendar\b/i.test(lower);
  if (wantsCalendarOrReminder) {
    const card: MeetingCard = {
      type: "meeting",
      fields: {
        title: extractMeetingTitle(message),
        date: extractMeetingDate(message),
        time: extractMeetingTime(message),
        reminder: extractMeetingReminder(message),
      },
      status: "requires_connection",
      status_label: "Waiting for Calendar",
      actions: [
        { kind: "save_for_later", label: "Save for later", state: "prepared_waiting" },
        { kind: "dismiss", label: "Cancel" },
      ],
    };
    return {
      reply:
        "I've completed everything I could from your request. The only thing missing is a connected calendar. Once you connect Google Calendar or Outlook, I'll save this meeting without you needing to enter everything again. Have I missed any details?",
      suggestions: [],
      card,
    };
  }

  // 5. Contacts.
  const wantsContacts =
    /\bmy contact(s)?\b/i.test(lower) ||
    /\bmy friend(s)?\b/i.test(lower) ||
    /(pull up|show me|see|open|find|view)\s+(my |the )?(contact|friend|network|address book|people)/i.test(lower) ||
    /\bwhere is my (friend|contact)/i.test(lower);
  if (wantsContacts) {
    return {
      reply:
        "Your contacts live here — everyone you've connected with through Nex. Tap through to see who's around.",
      suggestions: [
        { label: "Open Contacts", href: "/nex-app/contacts" },
      ],
    };
  }

  // 6. Conversation-intent classifier + gated replies (accommodation, food, indonesia, etc).
  let intent = classifyConversationIntent(message, { userMarket: opts.userMarket });
  trace.record("intent", `classified=${intent.intent} · reason=${intent.reason}`);

  // Stage 3.7 · sticky accommodation flow (Philip 2026-08-31).
  //
  // Turns like "Cheap", "Somewhere quiet", "How much?", "Can I book it?"
  // don't hit any ACCOMMODATION regex, so the stateless classifier
  // returns "conversation" (with the neutral default reason). If we
  // HAVE an active accommodation session, any such neutral turn is
  // treated as a continuation of the discovery flow. The composer's
  // extractor will pick up whatever slots it can and the reply logic
  // handles amenity / price / book questions honestly.
  //
  // Strong signals — greetings, meta-about-NEX, weather, food, staircase,
  // translation, business-lookup — are NOT overridden. Those genuinely
  // switch topics and the accommodation session remains available for
  // when the user comes back to it.
  if (
    intent.intent === "conversation" &&
    intent.reason === "default_conversation_no_specialist_signal" &&
    opts.conversationId
  ) {
    const s = getSession(opts.conversationId);
    const active = s?.accommodation && (
      s.accommodation.type || s.accommodation.location || s.accommodation.area || s.accommodation.budget
    );
    if (active) {
      intent = { intent: "accommodation", confidence: 0.75, reason: "session_continuation" };
    }
  }

  // Stage 3.9 · Goal Tracking transitions. When the current intent is
  // NOT accommodation but a session goal exists, mark the goal as not
  // progressed (which advances paused → abandoned over enough turns).
  // When the current intent IS accommodation, the accommodation
  // composer handles the goal creation / progression itself.
  if (opts.conversationId) {
    const s = getSession(opts.conversationId);
    if (s?.goal && s.goal.kind === "accommodation" && intent.intent !== "accommodation") {
      const advanced = markGoalNotProgressed(s.goal);
      upsertSession({ ...s, goal: advanced });
      trace.record("goal_tracking", `advance status=${advanced.status} turnsSinceProgress=${advanced.turnsSinceProgress}`);
    }
  }

  const passthroughIntents = new Set(["staircase", "trades", "quotation", "documents", "other"]);
  if (!passthroughIntents.has(intent.intent)) {
    trace.record("conversation_control", `gated intent=${intent.intent}`);

    const gated = composeGatedReply(intent, message, opts, trace);

    // Stage 3.18 · Phase 11 · Tool Selection · make the tool choice
    // explicit. Runs AFTER the composer so hasResolvedReference and
    // this-turn's action slot reflect what the composer actually
    // did (composer persists reference resolution + merged slots to
    // session). v1 is observational — attaching for audit — and the
    // composer's implicit tool usage matches this decision. Future
    // Commerce Brain intent will consume this decision to route.
    const sessionForTool = opts.conversationId ? getSession(opts.conversationId) : null;
    const toolDecision = selectTool({
      intent: intent.intent,
      message,
      slots: sessionForTool?.accommodation,
      userMarket: opts.userMarket,
      hasResolvedReference: !!sessionForTool?.currentReference?.resolved,
    });
    trace.record("tool_selection", summariseToolDecision(toolDecision));

    // Stage 3.20 · Phase 13 · Governance · audit which permissions
    // this turn exercised. Enumerated from the actual capabilities
    // the trace recorded + the tool decision's declared primary.
    // Never fabricates a permission that wasn't actually used.
    const activated = trace.summary().capabilities;
    const uses: PermissionUse[] = [];
    if (activated.includes("world_knowledge")) uses.push({ permission: "read.world_knowledge", context: "retrieveKnowledge" });
    if (activated.includes("commerce")) uses.push({ permission: "read.commerce", context: "findProducts/findOffers" });
    if (activated.includes("memory") || activated.includes("goal_tracking") || activated.includes("entity_intelligence")) {
      uses.push({ permission: "write.session", context: "upsertSession (slots/goal/entities/reference)" });
    }
    if (activated.includes("learning")) uses.push({ permission: "write.learning_ledger", context: "recordLearning" });
    if (activated.includes("insight") && intent.intent === "accommodation") {
      // Insight only writes workforce gaps when learning_gap fires · presence of
      // insight capability isn't proof of gap write · this is a best-effort
      // audit hint · when Insight decides learning_gap the composer calls
      // recordInsightGap which writes to workforce.
      uses.push({ permission: "write.workforce_gap", context: "recordInsightGap (when Insight fires learning_gap)" });
    }
    if (toolDecision.primary === "user_action") uses.push({ permission: "execute.user_action", context: `${toolDecision.reason}` });
    if (toolDecision.primary === "live_source") uses.push({ permission: "call.live_source", context: `${toolDecision.reason}` });
    // Stage 3.26 · long_term_memory permission when userId provided (audit
    // the intent to touch cross-session state · consent flag determines
    // whether it actually writes, but the AUDIT shows the request).
    if (opts.userId) {
      uses.push({
        permission: "write.long_term_memory",
        context: opts.consentLongTermMemory
          ? "userId + consent granted · LTM read/write active"
          : "userId provided but consent NOT granted · LTM inactive · surfacing require_consent",
      });
    }

    // Stage 3.26 · consent grants map from OrchestrateOptions.
    // Consent promotes require_consent → allow at audit time.
    const consentGrants: ConsentGrants = {};
    if (opts.consentLongTermMemory) consentGrants["write.long_term_memory"] = true;
    const governance = checkPermissions(uses, DEFAULT_POLICY, consentGrants);
    trace.record("governance", `${governance.policy} · allow=${governance.allowedCount} · consent=${governance.hasRequiresConsent} · deny=${governance.hasDenies}`);

    // Stage 3.21 · Phase 14 · Action · propose + (safely) execute.
    // Fires when Reference Resolution surfaced a target for THIS turn ·
    // requestedKind derived from tool_decision + slots. v1: only
    // open_directory actually executes (link generation, no side
    // effects); other kinds return declared_not_wired honestly.
    let actionProposal: ActionProposal | undefined;
    let actionExecution: ActionExecution | undefined;
    const currentRef = sessionForTool?.currentReference;
    if (currentRef?.resolved && currentRef.business) {
      // Choose requested action from tool decision + slot action.
      // book/open both currently map to open_directory in v1 (safest).
      // Future: separate wa/email/book/save/add kinds once wired.
      const requestedKind = toolDecision.primary === "user_action"
        ? "open_directory" as const
        : "open_directory" as const;
      actionProposal = proposeAction({
        requestedKind,
        target: {
          canonical: currentRef.business.canonical,
          raw: currentRef.business.raw,
          refId: currentRef.business.refId,
        },
        governance,
      });
      // Execute only when v1 wired AND consent not required.
      if (actionProposal.availability === "available" && !actionProposal.consentRequired) {
        actionExecution = executeAction(actionProposal);
      } else if (actionProposal.consentRequired) {
        actionExecution = {
          executed: false,
          kind: actionProposal.kind,
          target: actionProposal.target,
          reason: "no_consent",
          message: "Governance requires user consent before executing this action · surfacing the proposal only.",
        };
      }
      trace.record("action", actionExecution?.executed
        ? `executed ${actionProposal.kind} → ${actionExecution.result.url ?? ""}`
        : `proposed ${actionProposal.kind} · ${actionProposal.availability} · consent=${actionProposal.consentRequired}`);
    }

    // Stage 3.22 · Phase 15 · Verification · confirms execution
    // matched intent. Runs only when proposal + execution exist ·
    // reports applicable=false honestly when nothing was executed.
    const verification = verifyAction({
      proposal: actionProposal,
      execution: actionExecution,
      session: sessionForTool,
    });
    trace.record("verification", verification.applicable
      ? `${verification.passed ? "passed" : "FAILED"} · ${verification.passedCount}/${verification.totalChecks}`
      : `n/a · ${verification.reason}`);

    // Stage 3.23 · Phase 16 · Prediction · anticipate next likely
    // user action from this turn's outcomes. Deterministic · never
    // fabricates a hint the state doesn't support.
    const sessionForPrediction = opts.conversationId ? getSession(opts.conversationId) : null;
    const gatedCardPayload = (gated?.card as unknown as { payload?: { hits?: unknown[] } } | undefined)?.payload;
    const realPropertiesMatched = Array.isArray(gatedCardPayload?.hits) ? gatedCardPayload!.hits!.length : 0;
    // Detect boundary hits from reply text signals (Confidence's boundary heuristic
    // is already in use above; we mirror the specific amenity/price signals here).
    const replyLower = (gated?.reply ?? "").toLowerCase();
    const didAmenityBoundary = /don'?t carry facility data|can'?t confidently filter/i.test(replyLower);
    const didPriceBoundary = /no.*price data|can'?t quote a rate/i.test(replyLower);
    const prediction = predictNext({
      intent: intent.intent,
      slots: sessionForPrediction?.accommodation,
      goal: sessionForPrediction?.goal ?? null,
      hasResolvedReference: !!sessionForPrediction?.currentReference?.resolved,
      realPropertiesMatched,
      didExecuteAction: actionExecution?.executed === true,
      didAmenityBoundary,
      didPriceBoundary,
      didComparison: (gated as { comparison?: { compared?: boolean } } | undefined)?.comparison?.compared === true,
      didRecommendation: (gated as { recommendation?: { recommended?: boolean } } | undefined)?.recommendation?.recommended === true,
    });
    trace.record("prediction", prediction.top
      ? `top=${prediction.top.kind} (${prediction.top.confidence}) · ${prediction.candidates.length} candidates`
      : `no signal · ${prediction.reason}`);

    // Stage 3.24 · Phase 17 · Initiative · decide whether to volunteer
    // the top prediction proactively. Rate-limited per conversation ·
    // gated by confidence + composer-already-asked + already-proactive
    // signals. Persists sessionCount when volunteered.
    const priorInitiativeCount = sessionForPrediction?.initiativeCount ?? 0;
    const initiative = decideInitiative({
      prediction,
      reply: gated?.reply ?? "",
      didExecuteAction: actionExecution?.executed === true,
      didComparison: (gated as { comparison?: { compared?: boolean } } | undefined)?.comparison?.compared === true,
      didRecommendation: (gated as { recommendation?: { recommended?: boolean } } | undefined)?.recommendation?.recommended === true,
      sessionInitiativeCount: priorInitiativeCount,
    });
    trace.record("initiative", initiative.decision.volunteered
      ? `volunteered ${initiative.decision.suggestion.kind} · ${initiative.sessionCount}/${initiative.cap}`
      : `suppressed · ${initiative.decision.reason}`);

    // Persist updated count when volunteered (session survives per conversation).
    if (initiative.decision.volunteered && opts.conversationId) {
      const s = getSession(opts.conversationId);
      if (s) {
        upsertSession({ ...s, initiativeCount: initiative.sessionCount });
      }
    }

    // Stage 3.25 · Phase 18 · Adaptation · read Learning ledger for
    // repeat patterns and surface suggested behavior adjustments.
    // Runs AFTER Learning has already recorded this turn's signals
    // (reflection_failure/confidence_low above · insight_gap_detected
    // + slot_correction_observed in composer). Signals are attached
    // for future composer/UI to consume · v1 observational.
    const adaptation = detectAdaptations({ conversationId: opts.conversationId });
    trace.record("adaptation", adaptation.hasSignals
      ? `${adaptation.signals.length} pattern${adaptation.signals.length === 1 ? "" : "s"} · ${adaptation.signals.map((s) => s.kind).join(",")}`
      : "no patterns");

    // Stage 3.26 · Phase 19 · Long-Term Memory · consent-gated read/write.
    // Only active when userId + consent both present. Reads snapshot for
    // response · writes accommodation preferences when slots present.
    // Governance already surfaces write.long_term_memory as require_consent
    // (default policy); consent flag flips to allow at the LTM layer.
    let longTermSnapshot: ReturnType<typeof snapshotPreferences> = null;
    const hasLtmConsent = opts.consentLongTermMemory === true;
    if (opts.userId && hasLtmConsent) {
      // Write from accommodation slots when present.
      const sessionForLtm = opts.conversationId ? getSession(opts.conversationId) : null;
      const accomm = sessionForLtm?.accommodation;
      if (accomm && (accomm.location || accomm.type || accomm.budget || accomm.area)) {
        const updated = updatePreferencesFromSlots({
          userId: opts.userId,
          hasConsent: true,
          location: accomm.location,
          type: accomm.type,
          budget: accomm.budget,
          area: accomm.area,
        });
        longTermSnapshot = snapshotPreferences(updated);
        trace.record("long_term_memory", `write ok · interactions=${updated?.interactionCount ?? 0} · consent=granted`);
      } else {
        // Just read current preferences.
        longTermSnapshot = snapshotPreferences(getPreferences(opts.userId, true));
        trace.record("long_term_memory", `read ok · interactions=${longTermSnapshot?.interactionCount ?? 0}`);
      }
    } else {
      trace.record("long_term_memory", opts.userId
        ? "userId present · consent NOT granted · LTM inactive"
        : "no userId · LTM inactive");
    }

    // Stage 3.27 · Phase 20 · Personalization · read LTM + decide
    // whether to surface a returning-user greeting. Fires only on
    // the FIRST accommodation turn of the CURRENT conversation
    // (detected via session.accommodation being empty before this
    // turn) · never fabricates preferences the LTM doesn't hold.
    let personalization: PersonalizationReport | undefined;
    if (opts.userId && hasLtmConsent) {
      const ltmForPz = getPreferences(opts.userId, true);
      const sessionForPz = opts.conversationId ? getSession(opts.conversationId) : null;
      const accommForPz = sessionForPz?.accommodation;
      const isFirstAccommodationTurn = intent.intent === "accommodation"
        && accommForPz != null
        && Object.keys(accommForPz).length > 0
        && (sessionForPz?.goal?.interactionCount === undefined || sessionForPz?.goal?.turnsSinceProgress === 0)
        && (sessionForPz?.goal?.createdAt !== undefined && sessionForPz.goal.createdAt === sessionForPz.goal.updatedAt);
      personalization = decidePersonalization({
        longTermMemory: ltmForPz as LongTermPreferences | null,
        currentSlots: accommForPz,
        isFirstAccommodationTurnThisConversation: isFirstAccommodationTurn,
      });
      trace.record("personalization", personalization.signal.kind === "none"
        ? `none · ${personalization.signal.reason}`
        : `${personalization.signal.kind} · ${personalization.signal.preferences.length} prefs · greeting=${!!personalization.signal.greeting}`);
    }

    // Stage 3.28 · Phase 21 · Attention · cross-turn priority scorer.
    // Reads session state + this turn's signals · ranks slots/entities/goal
    // by score. Observational v1 · future consumers use `top` as
    // default reference/question/focus.
    const sessionForAttn = opts.conversationId ? getSession(opts.conversationId) : null;
    const attention = computeAttention({
      slots: sessionForAttn?.accommodation,
      goal: sessionForAttn?.goal ?? null,
      entities: sessionForAttn?.entities,
      resolvedReferenceCanonical: sessionForAttn?.currentReference?.business?.canonical,
      // slotsIntroducedThisTurn + correctionThisTurn not readily available at
      // this outer scope · Attention still produces meaningful ranking from
      // state alone (base + status modifiers). v2 can plumb turn signals.
      topK: 12,  // wide enough that typical state (3 slots + 5 entities + 1 goal) always fits
    });
    trace.record("attention", attention.summary);

    // Stage 3.29 · Phase 22 · Planning · multi-step plan above Insight.
    // Deterministic step-generator from current state (slots · goal · ref ·
    // execution). Observational v1 · shows the plan for UI/audit.
    const gatedCardForPlan = (gated?.card as unknown as { payload?: { hits?: unknown[] } } | undefined)?.payload;
    const realPropsForPlan = Array.isArray(gatedCardForPlan?.hits) ? gatedCardForPlan!.hits!.length : 0;
    const planning = buildPlan({
      intent: intent.intent,
      slots: sessionForAttn?.accommodation,
      hasResolvedReference: !!sessionForAttn?.currentReference?.resolved,
      didExecuteAction: actionExecution?.executed === true,
      realPropertiesMatched: realPropsForPlan,
    });
    trace.record("planning", planning.summary);

    if (gated) {
      const goalNow = opts.conversationId ? getSession(opts.conversationId)?.goal : undefined;
      // Stage 3.9 · Goal Tracking · when the user asks a non-goal
      // question but has an accommodation goal that JUST transitioned
      // to paused (turnsSinceProgress === 1), append a soft hint so
      // they know NEX is preserving the search. Only fires for
      // non-accommodation intents (the accommodation composer has its
      // own resume-hint for the knowledge-question branch).
      let reply = gated.reply;
      if (goalNow && intent.intent !== "accommodation" && shouldSurfacePausedHint(goalNow)) {
        reply = reply + pausedHint(goalNow);
        trace.record("goal_tracking", `paused hint appended`);
      }
      // Stage 3.27 · Personalization greeting prepend (first accommodation turn).
      if (personalization?.signal.kind !== "none" && personalization?.signal.greeting) {
        reply = `${personalization.signal.greeting} ${reply}`;
        trace.record("personalization", "greeting prepended to reply");
      }

      // Stage 3.10 · Reflection · constitutional self-check.
      const accommodationSlots = opts.conversationId
        ? getSession(opts.conversationId)?.accommodation
        : undefined;
      // Stage 3.34c · when the wrapper injected live World records, pass
      // them to Reflection as an evidence set so the strict check runs:
      // spoken count must equal World.totalAvailable AND named businesses
      // must appear in the World record set.
      const worldEvidence = opts.__worldRecords
        ? {
            totalAvailable: opts.__worldTotalAvailable ?? opts.__worldRecords.length,
            recordNames: opts.__worldRecords.map((r) => r.name),
          }
        : undefined;
      const reflection = reflectOnReply({
        userMessage: message,
        reply,
        intent: intent.intent,
        intentReason: intent.reason,
        userMarket: opts.userMarket,
        slots: accommodationSlots as unknown as Record<string, unknown>,
        worldEvidence,
      });
      trace.record("reflection", `overallPass=${reflection.overallPass} · ${reflection.passedCount}/${reflection.totalChecks}`);

      // Stage 3.11 · Confidence · constitutional per-reply audit.
      const gatedCard = gated.card as unknown as { kind?: string; payload?: { hits?: unknown[] } } | undefined;
      const hits = Array.isArray(gatedCard?.payload?.hits) ? gatedCard!.payload!.hits! : [];
      const namesRealProperties = hits.length > 0 && gatedCard?.kind === "accommodation_discovery";
      // Stage 3.31 · detection regexes accept EN + ID literals so ID
      // replies aren't misclassified as low-confidence / evidence-free.
      const isGroundedKnowledge = /source: nex indonesia knowledge|sumber: pengetahuan nex indonesia/i.test(reply);
      const isHonestBoundary = /can'?t book|no live booking|don'?t carry (price|facility) data|no.*price data|can'?t confidently filter|belum bisa memesan|belum ada koneksi booking|tidak menyimpan data (harga|fasilitas)|belum bisa memfilter/i.test(reply);
      const isRefiningQuestion = reply.trim().endsWith("?") && !namesRealProperties && !isHonestBoundary;
      const confidence = assessConfidence({
        reply,
        intent: intent.intent,
        realPropertiesMatched: namesRealProperties ? hits.length : undefined,
        realPropertiesAvailable: namesRealProperties ? hits.length : undefined,
        namesRealProperties,
        citesProvenance: isGroundedKnowledge,
        citesGeographicArea: /\b(near|dekat) (malioboro|prawirotaman|kraton|kotagede|tugu|gondomanan)\b/i.test(reply),
        isHonestBoundary,
        isRefiningQuestion,
        isGroundedKnowledge,
      });
      trace.record("confidence", `overall=${confidence.overall} · evidence=${confidence.evidenceCount} · boundary=${confidence.boundaryCount}`);

      // Stage 3.13 · Learning · capture signals for the ledger.
      //   · reflection_failure — when any Reflection check failed
      //   · confidence_low — when Confidence overall = low (no recognisable claims)
      // Insight gap detection is recorded from its own recordInsightGap
      // call site (below the composer) · we mirror it here to feed
      // Meta-Cognition's whatILearned via the same Learning ledger.
      if (!reflection.overallPass) {
        const failedChecks = reflection.findings.filter((f) => !f.passed).map((f) => f.check);
        recordLearning({
          kind: "reflection_failure",
          conversationId: opts.conversationId,
          scope: `${intent.intent}.reflection`,
          summary: `${failedChecks.length} check(s) failed: ${failedChecks.join(", ")}`,
          detail: { failedChecks, reasons: reflection.findings.filter((f) => !f.passed).map((f) => ({ check: f.check, reason: f.reason })) },
        });
        trace.record("learning", `reflection_failure recorded · ${failedChecks.length} checks`);
      }
      if (confidence.overall === "low") {
        recordLearning({
          kind: "confidence_low",
          conversationId: opts.conversationId,
          scope: `${intent.intent}.confidence`,
          summary: `Confidence=low · ${confidence.reason}`,
        });
        trace.record("learning", `confidence_low recorded`);
      }

      // Stage 3.12 · Meta-Cognition · constitutional umbrella.
      // Stage 3.13 adds conversationId so whatILearned can read the ledger.
      // Stage 3.14 adds entities so whatIKnow.entitiesSeen surfaces the roll-up.
      const sessionForMeta = opts.conversationId ? getSession(opts.conversationId) : null;
      const meta = assessMetaCognition({
        reply,
        reflection,
        confidence,
        goal: goalNow,
        slots: accommodationSlots as unknown as Record<string, unknown>,
        intent: intent.intent,
        conversationId: opts.conversationId,
        entities: sessionForMeta?.entities,
        verification,
      });
      trace.record("meta_cognition", meta.summary);

      // Stage 3.30 · Phase 23 · Personality · post-process reply text
      // safely (never touches numbers/names/boundaries · deterministic
      // transformations only). Applied LAST so it operates on the final
      // reply text (after all other capabilities have prepended/appended).
      const personalityOut = applyPersonality({ reply, profile: opts.personalityProfile });
      trace.record("personality", personalityOut.report.summary);
      reply = personalityOut.reply;

      return {
        ...gated,
        reply,
        intent: intent.intent,
        intent_reason: intent.reason,
        capabilities: trace.summary().capabilities,
        goal: goalNow ? { kind: goalNow.kind, status: goalNow.status, summary: goalNow.summary, turnsSinceProgress: goalNow.turnsSinceProgress } : null,
        reflection,
        confidence,
        meta_cognition: meta,
        tool_decision: toolDecision,
        governance,
        action_proposal: actionProposal,
        action_execution: actionExecution,
        verification,
        prediction,
        initiative,
        adaptation,
        long_term_memory: longTermSnapshot,
        personalization,
        attention,
        planning,
        personality_profile: personalityOut.report,
      };
    }
  }

  // 7. Image-view routing.
  const wantsImageView =
    /(show|see|look at|view|find|pull up|display|browse|open|any)\s+.*(image|picture|photo|photograph|gallery|design|example|inspiration)/i.test(lower) ||
    /(gallery|inspiration)\b/i.test(lower);
  if (wantsImageView) {
    if (/staircase|\bstair(s|way|case)?\b|balustrade|oak|walnut|glass\s+stair/i.test(lower)) {
      return {
        reply:
          "The Staircase Library is where I keep the designs I know best — plenty of oak, walnut, glass and modern styles. Tap through and anything that catches your eye can start a project.",
        suggestions: [
          { label: "Open Staircase Library", href: "/nex-app/staircase-library" },
          { label: "Browse Trade Centre", href: "/nex-app/centre" },
        ],
        intent: intent.intent,
        intent_reason: intent.reason,
      };
    }
    return {
      reply:
        "The Staircase Library has the deepest image collection today. Trade Centre also shows real project photos from verified merchants. I'll add more trade libraries as Nex grows.",
      suggestions: [
        { label: "Staircase Library", href: "/nex-app/staircase-library" },
        { label: "Trade Centre", href: "/nex-app/centre" },
      ],
      intent: intent.intent,
      intent_reason: intent.reason,
    };
  }

  // 8. UK-trade cascade — reached only when the classifier passed through
  // (i.e. intent is staircase/trades/quotation/documents/other). Market
  // gating already happened INSIDE classifyConversationIntent: an ID user
  // saying "staircase" is redirected to intent="indonesia" upstream and
  // never reaches this cascade.
  if (/staircase|\bstair(s|way|case)?\b|balustrade|banister|newel/.test(lower)) {
    return {
      reply:
        "Staircases are where I know most today. I can help you find companies, compare materials, and understand what's involved before you commit to anything.",
      suggestions: [
        { label: "Browse staircase companies", href: "/nex-app/centre?q=staircase" },
        { label: "Staircase Library", href: "/nex-app/staircase-library" },
      ],
      intent: intent.intent,
      intent_reason: intent.reason,
    };
  }

  if (/plumber|plumbing|leak(ing)?|boiler|radiator|drain/.test(lower)) {
    return {
      reply:
        "For plumbing work, the Trade Centre lists verified professionals near you. I don't have deep plumbing knowledge yet, so I'll get you to real people faster.",
      suggestions: [
        { label: "Find a plumber", href: "/nex-app/centre?q=plumber" },
      ],
      intent: intent.intent,
      intent_reason: intent.reason,
    };
  }

  if (/electric(al|ian)?|wiring|socket|fuse|rewire/.test(lower)) {
    return {
      reply:
        "For electrical work, the Trade Centre is the fastest way to a real professional. I'll add deeper electrical knowledge to Nex as it earns its place.",
      suggestions: [
        { label: "Find an electrician", href: "/nex-app/centre?q=electrician" },
      ],
      intent: intent.intent,
      intent_reason: intent.reason,
    };
  }

  if (/kitchen|renovation|extension|loft|bathroom|refurb/.test(lower)) {
    return {
      reply:
        "That sounds like a home project. The Trade Centre is where you can find companies for it, and I'll help you keep everything organised in one place as you go.",
      suggestions: [
        { label: "Browse Trade Centre", href: "/nex-app/centre" },
        { label: "My Projects", href: "/nex-app/projects" },
      ],
      intent: intent.intent,
      intent_reason: intent.reason,
    };
  }

  if (/find|looking for|need (someone|a )/.test(lower)) {
    return {
      reply:
        "The Trade Centre is where you can browse and connect with verified professionals. Tell me the kind of work you need and I'll help you get to the right people.",
      suggestions: [
        { label: "Open Trade Centre", href: "/nex-app/centre" },
      ],
      intent: intent.intent,
      intent_reason: intent.reason,
    };
  }

  if (/(continue|resume|my project|where.*(left|got to))/.test(lower)) {
    return {
      reply:
        "Head to My Projects and pick up where you left off. I keep everything visible so you never have to remember what stage each conversation was at.",
      suggestions: [
        { label: "My Projects", href: "/nex-app/projects" },
      ],
      intent: intent.intent,
      intent_reason: intent.reason,
    };
  }

  return {
    reply:
      "I can help you find trusted professionals, manage projects, and understand what to do next. Tell me what you're working on and I'll point you the right way.",
    suggestions: [
      { label: "Trade Centre", href: "/nex-app/centre" },
      { label: "My Projects", href: "/nex-app/projects" },
    ],
    intent: intent.intent,
    intent_reason: intent.reason,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Stage 3.34 · Phase 27 · Live World access wrapper (Philip 2026-08-31)
// ═══════════════════════════════════════════════════════════════════
//
// `orchestrateChatTurnLive()` is the async companion to the sync
// `orchestrateChatTurn()`. When `opts.useLiveWorld === true` AND the
// resolved intent maps to a wired vertical (currently only
// "accommodation"), it:
//
//   1. Runs the sync orchestrator to produce reply text + full audit
//      trail (Reflection · Confidence · Insight · Governance · etc.)
//      unchanged. Every existing test path is preserved.
//   2. In parallel, queries the World adapter for real directory rows
//      that match the same intent/slots the composer used.
//   3. Builds a vertical-agnostic PresentedCardSet via the Presentation
//      capability (3 cards default · 2 if 2 · 1 if 1 · 0 if 0 · never
//      pads).
//   4. Attaches `world_cards` + `world_latency_ms` to the BrainReply.
//
// If the World call fails (network / DB down), the reply still ships
// with the sync-path text and `world_cards` is undefined. Never throws.
//
// The reply TEXT still comes from the existing knowledge-JSON composer
// this phase · only the cards are live. Migrating the composer's
// named-list opener ("I've got N real listings for X — A, B, C.") to
// use the World records is the natural next step; deferred to keep
// this phase's blast radius contained.

import { searchWorld } from "./world-adapters";
import { presentRecords, presentRecordsExpanded, type PresentedCardSet, type ExpandedResultsPage } from "./presentation";
import type { WorldSearchInput, WorldVertical } from "./world-adapters/types";
import { recommendFromWorld, type WorldRecommendation } from "./recommend-from-world";
import { compareFromWorld, type WorldComparison } from "./compare-from-world";
import { reasonFromWorld, parseConstraints, type WorldReasoning } from "./reason-from-world";
import { parsePlanSteps, executePlan, type WorldPlan, type PlanStep } from "./plan-from-world";
import { routeToTool, type ToolSelection } from "./tool-router";
import { runCalculator, type CalculatorResult } from "./tools/calculator";
import { runWeather, type WeatherResult } from "./tools/weather";
import { runKnowledge, type KnowledgeResult } from "./tools/knowledge";
import { runActionChain } from "./action-chain";
import { whatsappStubAdapter } from "./adapters/whatsapp-stub";
import type { ActionAudit, ActionChainTarget, ChainActionKind } from "./action-audit";
import {
  decideAuthorization,
  composeProposalPrompt,
  composeAmbiguousReprompt,
  composeDeclineAck,
  composeStaleAck,
  composeMissingEvidenceReply,
  type PendingProposal,
} from "./action-authorization";
import { parseConfirmation } from "./confirmation-parser";
import { composeActionReply } from "./action-composer";

// Stage 3.34d · Phase 27h · Intent → vertical map.
// Only intents that map to a registered World adapter appear here.
// classifier's "booking" · "quotation" · "trades" · "places" etc still
// route to their existing sync-composer branches (unchanged this phase).
const INTENT_TO_VERTICAL: Partial<Record<string, WorldVertical>> = {
  accommodation: "accommodation",
  food:          "food",
  business:      "service",       // classifier's "business" = find/hire a service
  commerce:      "commerce",
  marketplace:   "commerce",      // classifier's "marketplace" also routes to products
  // "transport" isn't a classifier intent today · providers surface
  // when the user asks explicit driver/ride queries via keywords the
  // classifier routes to "business" or "trades" · left mapped so an
  // explicit "transport" intent works if the classifier grows it.
  transport:     "transport",
};

// Stage 3.34 · Phase 27d · "Show me more" intent detection.
//
// Fires on explicit user requests to browse the full result set, in
// both English and Bahasa Indonesia. Bounded regex · no LLM. Only
// consulted when the session already has an active accommodation goal
// (so a bare "next" outside a discovery flow doesn't trigger).
const SHOW_MORE_MARKERS: RegExp[] = [
  /\bshow\s+(me\s+)?more\b/i,
  /\bshow\s+(me\s+)?the\s+list\b/i,
  /\bgive\s+me\s+(all|more)\b/i,
  /\bmore\s+(hotels?|options?|places?|listings?|choices?)\b/i,
  /\bsee\s+more\b/i,
  /\ball\s+of\s+them\b/i,
  /\bfull\s+list\b/i,
  /\bnext\s+page\b/i,
  /\bpage\s+\d+\b/i,
  // Bahasa Indonesia
  /\btunjukkan?\s+(semua|lebih|lagi)\b/i,
  /\btampilkan?\s+(semua|lebih|lagi)\b/i,
  /\blihat\s+semua\b/i,
  /\blebih\s+banyak\b/i,
  /\bsemua\s+(hotel|pilihan|listingan)\b/i,
  /\bdaftar\s+(lengkap|penuh|semua)\b/i,
  /\bhalaman\s+(berikutnya|selanjutnya|\d+)\b/i,
];

function detectShowMoreIntent(message: string): boolean {
  return SHOW_MORE_MARKERS.some((rx) => rx.test(message));
}

/**
 * Extract a 1-based page number from the user's message when they say
 * "page 3" / "halaman 3" / "next page". Returns 1 when unspecified.
 */
function extractRequestedPage(message: string): number {
  const m = message.match(/\bpage\s+(\d+)\b|\bhalaman\s+(\d+)\b/i);
  if (m) {
    const n = parseInt(m[1] ?? m[2] ?? "1", 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }
  return 1;
}

// Stage 3.34e · Extract the search-relevant substring from the user's
// message for the World adapter's `query` field. This is what closes
// the "buy me headphones returns all 5 products, not headphones-filtered"
// gap flagged in Stage 3.34d "DO NOT CLAIM" list.
//
// Deterministic · matches how the classifier's COMMERCE and BUSINESS_LOOKUP
// packs recognise the "verb + product noun" and "cari/find + noun"
// patterns. Extracts the noun tail so the adapter can ILIKE it against
// business_name / product_name.
//
// EN patterns:
//   "buy me a phone under 3 million"    → "phone"
//   "find me a plumber near me"         → "plumber"
//   "where can I find gudeg"            → "gudeg"
//   "recommend a laptop for gaming"     → "laptop"
//
// ID patterns:
//   "beli headphone"                    → "headphone"
//   "cari warung"                       → "warung"
//   "cari dokter gigi di jogja"         → "dokter gigi"
//
// Falls back to undefined when no clear noun tail extractable · adapter
// runs unfiltered · caller gets all rows (which is honest, not fabricated).
export function extractWorldSearchQuery(message: string): string | undefined {
  const m = message.trim();
  if (m.length === 0) return undefined;

  // EN: verb-me?-article?-NOUN(...trailing filler)
  const en = m.match(
    /\b(?:buy|purchase|order|find|show|get|shop\s+for|shopping\s+for|need|want|looking\s+for|recommend|suggest|where\s+can\s+i\s+find|where\s+to\s+buy)\s+(?:me\s+|for\s+me\s+)?(?:a\s+|an\s+|the\s+|some\s+)?([a-z][a-z\s\-]{1,40}?)(?:\s+(?:under|below|less\s+than|from|in|at|near|for|with|that|which|by|to|from|around)\b|[?.,]|$)/i,
  );
  if (en && en[1]) {
    const noun = en[1].trim().replace(/\s+/g, " ");
    if (noun.length >= 3) return noun;
  }

  // ID: verb-NOUN
  const id = m.match(
    /\b(?:beli|belanja|cari(?:kan)?|pesan(?:kan)?|mau|butuh|perlu|tunjuk(?:kan)?|tampilkan)\s+(?:sebuah\s+|saya\s+)?([a-z][a-z\s\-]{1,40}?)(?:\s+(?:di|dekat|dari|dengan|yang|untuk|kurang\s+dari|bawah)\b|[?.,]|$)/i,
  );
  if (id && id[1]) {
    const noun = id[1].trim().replace(/\s+/g, " ");
    if (noun.length >= 3) return noun;
  }

  return undefined;
}

// Stage 3.35 · Phase 1 · Query verb intent classifier.
//
// The verb tells the Brain WHAT the user wants done with the World —
// discover new candidates (default), compare presented options,
// recommend one, book a specific one, purchase a product, browse
// more, refine an existing goal. This becomes the routing signal for
// Phase 2 (Recommendation) · Phase 3 (Comparison) · Phase 4 (Reasoning)
// · Phase 5 (Planning) to know whether to run a fresh retrieval or
// operate over the current candidate set.
//
// Deterministic · bilingual EN + ID · verb pack ordered by specificity
// so "compare A and B" beats "find something like A and B".
export type WorldQueryVerbIntent =
  | "compare"     // user asks to compare current candidates
  | "recommend"   // user asks NEX's pick from current candidates
  | "book"        // user wants to book / reserve
  | "purchase"    // user wants to buy a product
  | "contact"     // user wants to contact a business (WhatsApp / call / message)
  | "browse"      // "show me more" / "show the list" · expanded surface
  | "refine"      // "cheaper" / "closer" / "yang murah" · narrow current set
  | "discover";   // default · new search

export function parseWorldQueryVerbIntent(message: string): WorldQueryVerbIntent {
  const m = message.trim();
  if (m.length === 0) return "discover";

  // Compare · check first because "compare A vs B" contains "vs" and
  // "compare" keywords that shouldn't fall through to discover.
  if (/\b(compare|vs\.?|versus|which\s+is\s+(better|best|closer|cheaper))\b/i.test(m)
    || /\b(bandingkan|beda\s+antara|mana\s+yang\s+lebih)\b/i.test(m)) {
    return "compare";
  }
  // Recommend · "which one do you recommend" · "what's the best one"
  if (/\b(recommend|which\s+(one|do you)\s+recommend|your\s+pick|which\s+should\s+i|what'?s\s+the\s+best)\b/i.test(m)
    || /\b(rekomendasi|pilihkan|yang\s+mana\s+yang\s+paling\s+bagus)\b/i.test(m)) {
    return "recommend";
  }
  // Book / reserve
  if (/\b(book|reserve|reserv|reservation|booking)\b/i.test(m)
    || /\b(pesan|pesankan|booking\s+dong)\b/i.test(m)) {
    return "book";
  }
  // Purchase (commerce)
  if (/\b(buy|purchase|order|checkout)\b/i.test(m)
    || /\b(beli|belanja)\b/i.test(m)) {
    return "purchase";
  }
  // Contact
  if (/\b(contact|message|whatsapp|call|phone|reach\s+out)\b/i.test(m)
    || /\b(hubungi|kontak|telepon)\b/i.test(m)) {
    return "contact";
  }
  // Browse (same signals as detectShowMoreIntent · reuses that logic)
  if (detectShowMoreIntent(m)) return "browse";
  // Refine (single-word refinements: "cheaper" · "closer" · "yang murah")
  if (/^(cheaper|closer|nearer|smaller|bigger|larger|newer|older)\b/i.test(m)
    || /^(yang\s+(murah|dekat|kecil|besar|baru|lama))\b/i.test(m)) {
    return "refine";
  }
  return "discover";
}

// Stage 3.35 · Phase B · Ordinal reference extraction for comparison.
//
// "compare the first and second" · "bandingkan yang pertama dan kedua"
// Returns 1-based indices in the order they appear in the message ·
// e.g. [1, 2] · [1, 3] · [2, 3]. Empty when no ordinals found.
//
// Consumed by wrapper: when verbIntent=compare AND ordinals present,
// wrapper selects those specific records from the retrieved set.
export function parseOrdinalReferences(message: string): readonly number[] {
  const m = message.toLowerCase();
  const found = new Set<number>();
  const ordered: number[] = [];
  const add = (n: number) => { if (!found.has(n)) { found.add(n); ordered.push(n); } };
  // EN: "first", "second", "third" · numeric "1", "2", "3" · "#1"
  const enMap: Array<[RegExp, number]> = [
    [/\b(first|1st|no\.?\s*1|number\s+one)\b/, 1],
    [/\b(second|2nd|no\.?\s*2|number\s+two)\b/, 2],
    [/\b(third|3rd|no\.?\s*3|number\s+three)\b/, 3],
    [/\b(fourth|4th)\b/, 4],
    [/\b(fifth|5th)\b/, 5],
  ];
  // ID: "yang pertama/kedua/ketiga" · "ke-1/ke-2"
  const idMap: Array<[RegExp, number]> = [
    [/\b(pertama|ke[- ]?1)\b/, 1],
    [/\b(kedua|ke[- ]?2)\b/, 2],
    [/\b(ketiga|ke[- ]?3)\b/, 3],
    [/\b(keempat|ke[- ]?4)\b/, 4],
    [/\b(kelima|ke[- ]?5)\b/, 5],
  ];
  // Walk the message once so ordinal order in text is preserved.
  for (const [rx, n] of [...enMap, ...idMap]) {
    if (rx.test(m)) add(n);
  }
  return ordered;
}

// Stage 3.35 · Phase 1 · "near me" detection.
//
// Bilingual regex · fires when the user asks for something "near me" ·
// "close to me" · "di sekitar saya" · "dekat saya" · etc. NEX has no
// geolocation source today · this signal triggers an honest boundary
// in the reply ("I don't have your location · try 'near [area]'")
// instead of silently returning all records.
export function parseNearMe(message: string): boolean {
  return /\b(near\s+me|close\s+to\s+me|around\s+me|nearby)\b/i.test(message)
      || /\b(di\s+sekitar\s+(saya|sini)|dekat\s+saya|dekat\s+sini)\b/i.test(message);
}

// Extract an optional price ceiling from the message (max price filter)
// e.g. "phone under 3 million" · "laptop below Rp 5,000,000" · "bawah 3 juta".
// Returns IDR amount (integer) when parseable · undefined otherwise.
export function extractMaxPriceIdr(message: string): number | undefined {
  // "under 3 million" · "below 5 million" · "less than 2m"
  const en = message.match(/\b(?:under|below|less\s+than|max(?:imum)?)\s+(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(million|mil|m|juta|k|ribu|thousand)?\b/i);
  if (en) {
    // Commas are thousands separators in this locale (Rp 2,500 = 2500 · not 2.5).
    const n = parseFloat(en[1].replace(/,/g, ""));
    const unit = (en[2] ?? "").toLowerCase();
    const mult =
      unit === "million" || unit === "mil" || unit === "m" || unit === "juta" ? 1_000_000 :
      unit === "k" || unit === "ribu" || unit === "thousand" ? 1_000 : 1;
    return Math.round(n * mult);
  }
  // ID: "bawah 3 juta" · "kurang dari 5 juta"
  const id = message.match(/\b(?:bawah|kurang\s+dari|maksimal)\s+(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?\b/i);
  if (id) {
    const n = parseFloat(id[1].replace(/,/g, ""));
    const unit = (id[2] ?? "").toLowerCase();
    const mult =
      unit === "juta" || unit === "jt" ? 1_000_000 :
      unit === "ribu" || unit === "rb" || unit === "k" ? 1_000 : 1;
    return Math.round(n * mult);
  }
  return undefined;
}

// Stage 3.34d · Phase 27h · Generic evidence-based reply composer.
//
// Accommodation has its own specialised sync-composer branch that
// consumes injected World records (Phase 27a) to build a discovery
// reply. For the other verticals (food · commerce · service ·
// transport) the sync composer's existing text is a generic default
// that pre-dates the World adapter. This helper produces an
// evidence-based reply the WRAPPER uses to OVERRIDE the base.reply
// so text and cards derive from the SAME World records for every
// vertical, not just accommodation.
//
// Doctrine invariants:
//   · Named businesses are literal WorldRecord.name values (no
//     rewriting · no shortening · no invented adjectives)
//   · Count is literal World.totalAvailable
//   · Bilingual (EN + ID) driven by detectAccommodationReplyLang · same
//     language rule as the accommodation flow so a Bahasa-Indonesia
//     message gets a Bahasa-Indonesia reply
//   · Zero World records → honest boundary reply · never fabricates
//   · Never invents price/rating/availability/booking · Presentation
//     layer's evidence-driven actions handle those signals on cards
function composeWorldResultsReply(input: {
  message: string;
  vertical: WorldVertical;
  records: readonly import("./world-adapters/types").WorldRecord[];
  totalAvailable: number;
  cityFallback?: string;
}): string {
  const lang: "en" | "id" = detectAccommodationReplyLang(input.message) === "id" ? "id" : "en";
  const L = (en: string, id: string): string => (lang === "id" ? id : en);
  const nouns = VERTICAL_NOUNS[input.vertical];
  const city = input.cityFallback ?? "";
  const cityPhraseEn = city ? ` in ${city}` : "";
  const cityPhraseId = city ? ` di ${city}` : "";

  if (input.records.length === 0) {
    return L(
      `I don't have real ${nouns.plural.en}${cityPhraseEn} that match yet. Tell me more about what you're after and I'll try again.`,
      `Belum ada ${nouns.plural.id}${cityPhraseId} yang cocok. Ceritakan lebih detail apa yang kamu cari, saya coba lagi.`,
    );
  }

  const names = input.records.slice(0, 3).map((r) => r.name);
  const list = names.join(", ");
  const more = input.totalAvailable > names.length
    ? L(", and more", ", dan lainnya")
    : "";
  return L(
    `I found ${input.totalAvailable} real ${nouns.plural.en}${cityPhraseEn} — ${list}${more}. These are NEX directory listings for discovery — I never invent price or availability.`,
    `Saya temukan ${input.totalAvailable} ${nouns.plural.id}${cityPhraseId} — ${list}${more}. Ini listingan direktori NEX untuk penemuan — saya tidak pernah mengarang harga atau ketersediaan.`,
  );
}

const VERTICAL_NOUNS: Record<WorldVertical, { singular: { en: string; id: string }; plural: { en: string; id: string } }> = {
  accommodation: { singular: { en: "stay",     id: "tempat menginap" }, plural: { en: "stays",     id: "tempat menginap" } },
  food:          { singular: { en: "place",    id: "tempat makan" },   plural: { en: "places",    id: "tempat makan" } },
  service:       { singular: { en: "provider", id: "penyedia jasa" },  plural: { en: "providers", id: "penyedia jasa" } },
  commerce:      { singular: { en: "product",  id: "produk" },         plural: { en: "products",  id: "produk" } },
  transport:     { singular: { en: "driver",   id: "pengemudi" },      plural: { en: "drivers",   id: "pengemudi" } },
  places:        { singular: { en: "place",    id: "tempat" },         plural: { en: "places",    id: "tempat" } },
};

export async function orchestrateChatTurnLive(
  message: string,
  opts: OrchestrateOptions = {},
): Promise<BrainReply> {
  // Stage 3.41.d P1 · bump turnCount at the TOP of every turn so
  // downstream signals like "reference just resolved" can compare
  // resolvedInTurn === turnCount reliably · regardless of which
  // composer path fires. Persist immediately so nested code that
  // re-reads the session sees the incremented value.
  if (opts.conversationId) {
    const preS = getSession(opts.conversationId);
    if (preS) {
      upsertSession({ ...preS, turnCount: (preS.turnCount ?? 0) + 1 });
    } else {
      upsertSession({
        conversationId: opts.conversationId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        turnCount: 1,
      });
    }
  }

  // Stage 3.41.k landing #1 · ABANDONMENT GATE (Philip 2026-08-31).
  //
  // MUST run BEFORE the vertical intent probe · otherwise a message
  // like "forget dinner" would still route to food discovery because
  // "dinner" is a food keyword.
  //
  // Constitutional invariant:
  //   abandonment > vertical keywords > sticky-vertical > entity ref
  //
  // Deterministic · no LLM · no auto-select. On match:
  //   · session.currentReference cleared
  //   · business_name entities pruned
  //   · goal.status → "abandoned"
  //   · short acknowledgement returned · NO discovery on this turn
  if (opts.conversationId) {
    const abandon = detectAbandonment(message);
    if (abandon.matched) {
      const preS = getSession(opts.conversationId);
      if (preS) upsertSession(applyAbandonmentReset(preS));
      const lang: "en" | "id" =
        abandon.language ??
        (detectAccommodationReplyLang(message) === "id" ? "id" : "en");
      const ack = lang === "id" ? "Sip, aku batalin." : "Okay, dropped it.";
      const base: BrainReply = {
        reply: ack,
        suggestions: [],
        intent: "abandonment",
        intent_reason: `phrase=${abandon.phrase}·lang=${lang}`,
      };
      if (opts.useLiveWorld) {
        return {
          ...base,
          world_query: {
            vertical: undefined,
            verbIntent: parseWorldQueryVerbIntent(message),
            nearMe: parseNearMe(message),
          },
        };
      }
      return base;
    }
  }

  // Stage 3.34 · Phase 27a doctrine: ONE RETRIEVAL → TEXT + CARDS.
  //
  // To satisfy that invariant we must fetch the World BEFORE running
  // the sync composer so its named-list opener + count derive from
  // the SAME records the cards use. Previous shape (sync-first, then
  // World, then cards) left the reply text sourced from the JSON
  // knowledge mirror while the cards showed live data · that's the
  // "cards live · text stale" gap this phase closes.

  // Determine vertical from a lightweight intent classifier probe.
  // Stage 3.34c · in addition to the raw classification, we also respect
  // the STICKY-FLOW doctrine (Stage 3.7): when the session has an active
  // accommodation goal, refining turns like "cheap" · "near Malioboro" ·
  // "double bed" that raw-classify as "conversation" should still hit
  // the World so the composer's sticky-flow promotion has live records
  // to work with.
  const probeIntent = classifyConversationIntent(message, { userMarket: opts.userMarket });
  let vertical = opts.useLiveWorld ? INTENT_TO_VERTICAL[probeIntent.intent] : undefined;
  if (!vertical && opts.useLiveWorld && opts.conversationId) {
    const stickySession = getSession(opts.conversationId);
    // Stage 3.41.f · sticky-vertical generalised to any supported
    // World-vertical goal · not just accommodation. Same fail-closed
    // conditions: only inherit when the goal is active/resumed (not
    // paused, not abandoned). Location-only refinements like
    // "Somewhere around Malioboro" reach the sticky check as
    // "conversation" intent · they inherit the live vertical instead
    // of collapsing to clarify.
    const stickyGoal = stickySession?.goal;
    const stickyGoalKind = stickyGoal?.kind;
    const stickyGoalActive = stickyGoal?.status === "active" || stickyGoal?.status === "resumed";
    const stickyVerticalFromGoal: WorldVertical | undefined =
      stickyGoalActive && stickyGoalKind === "accommodation" ? "accommodation" :
      stickyGoalActive && stickyGoalKind === "food"          ? "food"          :
      stickyGoalActive && stickyGoalKind === "commerce"      ? "commerce"      :
      undefined;
    if (stickyVerticalFromGoal) vertical = stickyVerticalFromGoal;
    // Stage 3.41.d P4 · sticky by RECENT REFERENCE too · if the user
    // just picked something and is now asking a follow-up ("what's
    // good about it") OR acting on it ("message them"), we're still
    // in the vertical conversation even if the goal has been marked
    // not-progressed. Generalised in 3.41.f to any supported vertical.
    if (!vertical) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refSummary = stickySession?.currentReference as any;
      const refFresh =
        refSummary?.resolved
        && refSummary.resolvedInTurn !== undefined
        && stickySession?.turnCount !== undefined
        && (stickySession.turnCount - refSummary.resolvedInTurn) <= 3;
      const refGoalKind = stickySession?.goal?.kind;
      if (refFresh && (refGoalKind === "accommodation" || refGoalKind === "food" || refGoalKind === "commerce")) {
        vertical = refGoalKind as WorldVertical;
      }
    }
  }

  // Stage 3.37 · Action authorization gate · EARLY CHECK
  //
  // Must run BEFORE the "no vertical" early return so that confirmation
  // messages ("yes"/"no"/"okay"/"iya"/"jangan"/etc.) — which typically
  // classify to NO wired vertical — still reach the authorization
  // decision when the session has a pending proposal.
  if (opts.conversationId) {
    const preSession = getSession(opts.conversationId);
    const pending = preSession?.pendingProposal;
    if (pending && pending.status === "AWAITING") {
      const conf = parseConfirmation(message);
      if (conf.kind !== "AMBIGUOUS" || true /* let AMBIGUOUS reprompt too */) {
        const currentTurn = (preSession?.turnCount ?? 0) + 1;
        // Prefer the language of the ORIGINAL proposal prompt · a two-
        // word confirmation like "iya kirim" is too short to language-
        // detect reliably. Fall back to detecting from the message.
        const lang: "en" | "id" = pending.language
          ?? (detectAccommodationReplyLang(message) === "id" ? "id" : "en");
        const decision = decideAuthorization({
          requestedKind:   pending.kind,
          requestedTarget: pending.target,
          messageBody:     pending.messageBody,
          message,
          currentTurn,
          pendingProposal: pending,
          confirmationResult: conf,
          now: () => new Date().toISOString(),
        });
        // Only intercept when the decision is actually resolving the
        // pending proposal · a NEW action intent still needs to flow
        // through the normal path below.
        const shouldIntercept =
          decision.outcome === "PROCEED_WITH_AUTH"
          || decision.outcome === "DECLINED"
          || decision.outcome === "AMBIGUOUS_NEEDS_CLARIFICATION"
          || decision.outcome === "STALE_OR_MISMATCHED";
        if (shouldIntercept) {
          const base = orchestrateChatTurn(message, opts);
          let earlyAudit: ActionAudit | undefined;
          if (decision.outcome === "PROCEED_WITH_AUTH") {
            earlyAudit = await runActionChain({
              kind: decision.proposal.kind,
              requestedByMessage: message,
              target: decision.proposal.target,
              authorization: decision.auth,
              adapter: whatsappStubAdapter,
            });
            base.reply = composeActionReply(earlyAudit, lang);
            const next = getSession(opts.conversationId);
            if (next) {
              upsertSession({
                ...next,
                turnCount: currentTurn,
                pendingProposal: { ...decision.proposal, status: "CONSUMED" },
              });
            }
          } else if (decision.outcome === "DECLINED") {
            earlyAudit = await runActionChain({
              kind: pending.kind,
              requestedByMessage: message,
              target: pending.target,
              authorization: decision.auth,
              adapter: whatsappStubAdapter,
            });
            base.reply = composeDeclineAck(pending, lang);
            const next = getSession(opts.conversationId);
            if (next) {
              upsertSession({
                ...next,
                turnCount: currentTurn,
                pendingProposal: { ...pending, status: "EXPIRED" },
              });
            }
          } else if (decision.outcome === "AMBIGUOUS_NEEDS_CLARIFICATION") {
            base.reply = composeAmbiguousReprompt(pending, lang);
            const next = getSession(opts.conversationId);
            if (next) upsertSession({ ...next, turnCount: currentTurn });
          } else if (decision.outcome === "STALE_OR_MISMATCHED") {
            base.reply = composeStaleAck(decision.reason, lang);
            const next = getSession(opts.conversationId);
            if (next) {
              upsertSession({
                ...next,
                turnCount: currentTurn,
                pendingProposal: { ...pending, status: "EXPIRED" },
              });
            }
          }
          if (opts.useLiveWorld) {
            return {
              ...base,
              world_query: {
                vertical: undefined,
                verbIntent: parseWorldQueryVerbIntent(message),
                nearMe: parseNearMe(message),
              },
              action_audit: earlyAudit,
            };
          }
          return { ...base, action_audit: earlyAudit };
        }
      }
    }
  }

  // If not a wired vertical OR useLiveWorld false → sync path is enough.
  // Stage 3.35 · Phase 1 · still attach world_query so downstream code
  // can inspect the parse even when no vertical was engaged. Verb intent
  // + near-me + area still meaningful (Phase 2's Recommendation may
  // fire on the composer's own hits without needing a wired vertical).
  if (!vertical) {
    const base = orchestrateChatTurn(message, opts);
    if (opts.useLiveWorld) {
      return {
        ...base,
        world_query: {
          vertical: undefined,
          verbIntent: parseWorldQueryVerbIntent(message),
          nearMe: parseNearMe(message),
        },
      };
    }
    return base;
  }

  // Build the World search input by MERGING the persisted session slots
  // with slots extracted from THIS turn's message. Ordering matters:
  // the sync composer will re-do this merge internally · but we need
  // the merged view HERE to feed the World query BEFORE we call the
  // composer. Otherwise turn-1 messages ("Find me a guesthouse") would
  // hit the World with no category since the session was empty on
  // entry.
  const session = opts.conversationId ? getSession(opts.conversationId) : null;
  const priorSlots = session?.accommodation;
  const thisTurnExtraction = extractAccommodationSlots(message);
  const mergedSlots = mergeAccommodationSlots(
    priorSlots,
    thisTurnExtraction.isKnowledgeQuestion ? {} : thisTurnExtraction.slots,
  );
  const market = opts.userMarket === "ID" ? "ID" : (opts.userMarket ?? "ID");

  // Stage 3.34e · Search-query flow-through. Accommodation composer's
  // slot state already carries type/area/budget so the adapter narrows
  // correctly. For non-accommodation verticals the slot extractor
  // doesn't populate product/service nouns · we extract them from the
  // message here so "buy me headphones" narrows commerce by
  // "headphones", "find me a dentist" narrows service by "dentist".
  //
  // City default remains "Yogyakarta" for accommodation (the customer
  // page default matches). For commerce/transport/food/service where
  // the user hasn't named a city, we DROP the city filter so the
  // adapter searches the whole ID market · avoids zero-result false
  // negatives on commerce where products live in Jakarta but the
  // classifier didn't extract a city slot.
  const extractedQuery = vertical !== "accommodation"
    ? extractWorldSearchQuery(message)
    : undefined;
  const extractedMaxPriceIdr = extractMaxPriceIdr(message);
  const verbIntent = parseWorldQueryVerbIntent(message);
  const nearMe = parseNearMe(message);

  const cityFilter = mergedSlots.location
    ? mergedSlots.location.charAt(0).toUpperCase() + mergedSlots.location.slice(1)
    : vertical === "accommodation" ? "Yogyakarta" : undefined;

  const input: WorldSearchInput = {
    vertical,
    market,
    city: cityFilter,
    // Stage 3.35 · Phase 1 · area now flows to food + service adapters
    // (they added district ILIKE filter). Commerce + transport ignore
    // it (their schemas don't publish a district).
    area: mergedSlots.area,
    category: mergedSlots.type,
    budget: mergedSlots.budget,
    guests: mergedSlots.guests,
    amenities: mergedSlots.amenities,
    query: extractedQuery,
    limit: 10, // fetch top-10 for future expanded-list use · slice 3 for cards.
    // For commerce with a price ceiling, sort by price ascending so the
    // best-value candidates show first. Otherwise rating.
    sort: extractedMaxPriceIdr != null && vertical === "commerce" ? "price_asc" : "rating",
  };

  let worldRecords: readonly import("./world-adapters/types").WorldRecord[] = [];
  let worldTotalAvailable = 0;
  let latencyMs = 0;
  let worldError: string | undefined;
  try {
    const world = await searchWorld(input);
    latencyMs = world.latencyMs;
    worldRecords = world.records;
    worldTotalAvailable = world.totalAvailable;
  } catch (err) {
    worldError = err instanceof Error ? err.message : String(err);
    // Fall through · sync composer will use JSON fallback for text ·
    // and we surface an error-caveat card set below.
  }

  // Run the sync orchestrator with the pre-fetched World records so the
  // composer's discovery branch names those exact businesses and quotes
  // the World's totalAvailable in its opener. Knowledge-question branch
  // still reads the JSON explanation corpus (editorial doctrine §12).
  const injectedOpts: OrchestrateOptions = {
    ...opts,
    __worldRecords: worldRecords,
    __worldTotalAvailable: worldTotalAvailable,
  };
  const base = orchestrateChatTurn(message, injectedOpts);

  // Stage 3.34d · Phase 27h · Non-accommodation verticals don't have a
  // specialised sync-composer branch that consumes injected World
  // records. To honour the doctrine "ONE EVIDENCE SET → TEXT + CARDS"
  // for every vertical, the wrapper composes an evidence-driven reply
  // text from the same World records and OVERRIDES the base.reply
  // when the vertical is food · commerce · service · transport ·
  // places. Accommodation keeps its specialised composer (already
  // consuming records via injection).
  if (!worldError && vertical !== "accommodation") {
    base.reply = composeWorldResultsReply({
      message,
      vertical,
      records: worldRecords,
      totalAvailable: worldTotalAvailable,
      cityFallback: input.city,
    });
  }

  // Stage 3.35 · Phase A · Evidence-based recommendation.
  //
  // Fires when the user's verb intent is "recommend" AND we have live
  // World records to reason over. Composes an evidence-based reply
  // (Bayesian rating × reviewCount primary · area proximity secondary
  // · honest gaps for missing fields) and OVERRIDES base.reply with
  // that text. Attaches the full WorldRecommendation report so
  // Reflection + tests can audit the reasoning chain.
  //
  // NEVER fabricates a recommendation when no ranking signal is
  // available (returns recommended:false + honest message instead).
  // Stage 3.35 · Phase C · Multi-constraint reasoning takes precedence
  // over Phase A vanilla recommendation when the user gave 2+ concrete
  // constraints ("cheap and close to Malioboro and highly rated").
  // Fires on discover/recommend/compare verbs — the constraints
  // themselves signal the user wants a reasoned pick, not a raw list.
  //
  // Per doctrine (Philip 2026-08-31):
  //   · Missing data never becomes a bad score (per-record per-constraint
  //     evidence state · unsupported records skip that constraint)
  //   · evidenceCoverage surfaced explicitly · reply text distinguishes
  //     coverage=1.0 (strong) vs 0<c<1 (partial) vs c=0 (no support)
  //   · No numeric-score claims in reply text
  const constraints = !worldError && worldRecords.length > 0
    ? parseConstraints({
        message,
        slotArea: mergedSlots.area,
        priceCeilingIdr: extractedMaxPriceIdr,
      })
    : [];
  let worldReasoning: WorldReasoning | undefined;
  const reasoningEligibleVerb = verbIntent === "discover" || verbIntent === "recommend" || verbIntent === "compare";
  if (!worldError && reasoningEligibleVerb && worldRecords.length > 0 && constraints.length >= 2) {
    worldReasoning = reasonFromWorld({
      records: worldRecords,
      vertical,
      constraints,
    });
    const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
    if (worldReasoning.reasoned) {
      base.reply = lang === "id" ? worldReasoning.replyText.id : worldReasoning.replyText.en;
    } else {
      base.reply = lang === "id" ? worldReasoning.message.id : worldReasoning.message.en;
    }
  }

  let worldRecommendation: WorldRecommendation | undefined;
  // Phase A vanilla recommendation only fires when Phase C reasoning
  // did NOT fire (i.e. no multi-constraint reasoning override needed).
  if (!worldError && !worldReasoning && verbIntent === "recommend" && worldRecords.length > 0) {
    worldRecommendation = recommendFromWorld({
      records: worldRecords,
      vertical,
      slotArea: mergedSlots.area,
    });
    // Reply-text override. Uses the language of the user's message so
    // ID users get ID text · EN users get EN text (same policy as
    // Stage 3.31 accommodation composer).
    const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
    if (worldRecommendation.recommended) {
      base.reply = lang === "id"
        ? worldRecommendation.replyText.id
        : worldRecommendation.replyText.en;
    } else {
      base.reply = lang === "id"
        ? worldRecommendation.message.id
        : worldRecommendation.message.en;
    }
  }

  // Stage 3.35 · Phase B · Structured comparison.
  //
  // Fires when the user's verb intent is "compare". Resolves ordinal
  // references from the message when present ("compare the first and
  // second") · falls back to the current turn's top candidates when no
  // ordinals given ("compare these three"). Renders a per-vertical
  // structured table, per-field defensible observations, and OPTIONALLY
  // a hedged pickHint on distance or rating when data supports it.
  //
  // CONSTITUTIONAL: never manufactures an overall winner. When no
  // ranking-relevant field is published for the compared candidates,
  // the reply says exactly that.
  let worldComparison: WorldComparison | undefined;
  // Phase B comparison fires when verbIntent=compare AND Phase C
  // reasoning did NOT fire (i.e. bare "compare these" without multi-
  // constraint reasoning). Reasoning path handles multi-constraint
  // compare requests holistically.
  if (!worldError && !worldReasoning && verbIntent === "compare" && worldRecords.length > 0) {
    const ordinals = parseOrdinalReferences(message);
    // Resolve the compared subset. Ordinals map to 1-based positions
    // in the current retrieval slice.
    const subset = ordinals.length >= 2
      ? ordinals.map((n) => worldRecords[n - 1]).filter((r): r is import("./world-adapters/types").WorldRecord => Boolean(r))
      : worldRecords.slice(0, 3);
    worldComparison = compareFromWorld({
      records: subset,
      vertical,
      slotArea: mergedSlots.area,
    });
    const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
    if (worldComparison.compared) {
      base.reply = lang === "id"
        ? worldComparison.replyText.id
        : worldComparison.replyText.en;
    } else {
      base.reply = lang === "id"
        ? worldComparison.message.id
        : worldComparison.message.en;
    }
  }

  // Build the card set from the SAME evidence.
  const cards: PresentedCardSet = worldError
    ? {
        vertical,
        cards: [],
        totalAvailable: 0,
        headline: "World lookup failed.",
        caveat: `world_error: ${worldError}`,
      }
    : presentRecords({
        records: worldRecords,
        totalAvailable: worldTotalAvailable,
        vertical,
      });

  // Stage 3.41.f · create/refresh a lightweight food/commerce goal so
  // sticky-vertical persistence works on the NEXT turn. Accommodation
  // goals are handled in the sync composer path · this fills the gap
  // for the other verticals. Fail-closed: only when World returned
  // actual records this turn (never fabricate a goal from thin air).
  //
  // Stage 3.41.g · ALSO capture the presented entities from those cards
  // and merge into session.entities · so reference resolution ("the
  // second one" · "them") can consume food and commerce picks the same
  // way it consumes accommodation picks. Uses the existing canonical
  // capturePresentedBusinesses + mergeEntityWindow · no second entity
  // store · no new resolution path · no fabricated entities (only
  // records actually returned by the World query).
  if (opts.conversationId && !worldError && worldRecords.length > 0 && (vertical === "food" || vertical === "commerce" || vertical === "service" || vertical === "transport")) {
    const preS = getSession(opts.conversationId);
    const priorGoal = preS?.goal;
    const summary = `a ${vertical} search` + (message.trim().length ? ` (${message.trim().slice(0, 40)})` : "");
    const nextGoal = priorGoal && priorGoal.kind === vertical
      ? progressVerticalGoal(priorGoal, summary)
      : newVerticalGoal(vertical, summary);
    const nowIso = new Date().toISOString();

    // Stage 3.41.h · vertical-switch cleanup · a food entity must
    // NEVER remain the active reference after we've switched to
    // commerce (and vice versa · and to/from accommodation). Detect
    // the switch here and reset before running resolution + capture.
    // Fail-closed: no reference is guessed in the new vertical.
    const switched = isVerticalSwitch(priorGoal?.kind, nextGoal.kind);
    const workingSession: SessionState | undefined = preS && switched
      ? applyVerticalSwitchReset(preS)
      : preS;

    // Stage 3.41.g · reference resolution for THIS turn · MUST run
    // BEFORE the just-presented entities are merged (an ordinal in
    // this turn refers to what NEX presented in an EARLIER turn, not
    // what it's about to present now). Same pattern the accommodation
    // composer follows internally · here we do the equivalent
    // out-of-band for food/commerce.
    const priorWindow = workingSession?.entities ?? [];
    const userEntities = extractEntities(message, nowIso);
    // After the vertical-switch reset, currentReference is cleared ·
    // so on switch turns there's no prior reference to consult (which
    // is exactly what we want · we won't re-use a stale food entity
    // in a commerce turn).
    const priorRefBiz = workingSession?.currentReference?.business;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priorRefTurn = (workingSession?.currentReference as any)?.resolvedInTurn as number | undefined;
    const currentTurn = workingSession?.turnCount ?? 1;
    const currentReferenceEntity = priorRefBiz
      ? {
          id: `business_name:${priorRefBiz.canonical}`,
          kind: "business_name" as const,
          raw: priorRefBiz.raw,
          canonical: priorRefBiz.canonical,
          refId: priorRefBiz.refId,
          source: "nex_reply" as const,
          atIso: nowIso,
        }
      : undefined;
    const resolution = resolveReference(userEntities, priorWindow, {
      currentReferenceEntity,
      currentReferenceResolvedInTurn: priorRefTurn,
      currentTurn,
    });

    // Capture the actually-returned records · never from user text ·
    // never invented. If worldRecords is empty we already skipped
    // this block. Records without a name are dropped by the helper.
    const capturedFromCards = capturePresentedBusinesses(
      worldRecords.map((r) => ({ id: r.id, name: r.name, category: r.category })),
      nowIso,
    );
    // Merge in the order: prior window (already vertical-scoped after
    // any switch) · this turn's user entities · this turn's presented
    // entities. Newest wins de-dup.
    const mergedEntities = mergeEntityWindow(priorWindow, [...userEntities, ...capturedFromCards]);

    // Persist THIS turn's resolution summary · stamp resolvedInTurn
    // when this turn resolved (same convention accommodation uses).
    // On vertical-switch turns, prior summary was cleared so we
    // land on either a fresh resolution or an honest unresolved.
    const resolutionSummary = summariseResolution(resolution);
    const currentReferenceSummary = resolution.resolved
      ? { ...resolutionSummary, resolvedInTurn: currentTurn }
      : (priorRefTurn !== undefined
          ? { ...(workingSession?.currentReference ?? resolutionSummary), resolvedInTurn: priorRefTurn }
          : resolutionSummary);

    if (workingSession) {
      upsertSession({
        ...workingSession,
        goal: nextGoal,
        entities: mergedEntities,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentReference: currentReferenceSummary as any,
      });
    }
  }

  // Stage 3.34 · Phase 27d · "Show me more" · when the user explicitly
  // asked to see the full list AND we have real records, attach an
  // ExpandedResultsPage so the UI can open the in-app 10-card paginated
  // surface using the SAME live World records. Never fires without an
  // explicit ask · no unsolicited expansion.
  let expanded: ExpandedResultsPage | undefined;
  if (!worldError && detectShowMoreIntent(message) && worldTotalAvailable > 0) {
    const requestedPage = extractRequestedPage(message);
    expanded = presentRecordsExpanded({
      records: worldRecords,
      totalAvailable: worldTotalAvailable,
      vertical,
      page: requestedPage,
      // preSliced:true because we only fetched the top-10 · when the
      // caller asks page > 1, a future enhancement re-queries with
      // offset. For page 1 the top-10 IS the page-1 slice.
      preSliced: requestedPage === 1,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Stage 3.35 · Phase E · Tool Router (Philip 2026-08-31)
  // ═══════════════════════════════════════════════════════════════
  //
  // Deterministic router picks the tool CATEGORY for this turn:
  // world · world_plan · action · calculator · weather · knowledge ·
  // ambiguous · unsupported. Precedence is fixed · no random selection.
  //
  // When the router picks calculator/weather/knowledge, we execute
  // that tool here and OVERRIDE base.reply · World machinery stays
  // untouched. When the router picks world/world_plan, the existing
  // Phase A-D code below handles it (unchanged). When ambiguous, we
  // ask for clarification instead of guessing.
  const hasMultiStep = opts.useLiveWorld ? parsePlanSteps(message).length >= 2 : false;
  const routerIntent = opts.useLiveWorld ? probeIntent.intent : undefined;
  const session2 = opts.conversationId ? getSession(opts.conversationId) : null;
  const toolSelection: ToolSelection = routeToTool({
    message,
    intent: routerIntent,
    hasMultiStep,
    hasResolvedReference: !!session2?.currentReference?.resolved,
  });

  // Tools OTHER THAN world/world_plan/action execute here.
  // world · world_plan fall through to the existing Phase A-D
  // machinery below (unchanged). Action has its own gate below.
  let calculatorResult: CalculatorResult | undefined;
  let weatherResult:    WeatherResult    | undefined;
  let knowledgeResult:  KnowledgeResult  | undefined;
  let actionAudit:      ActionAudit      | undefined;

  // ═══════════════════════════════════════════════════════════════
  // Stage 3.37 · Action authorization gate (Philip 2026-08-31)
  // ═══════════════════════════════════════════════════════════════
  //
  // CONSTITUTIONAL: every mutation requires explicit user confirmation.
  // This gate fires in two cases:
  //   (a) session has a pending AWAITING proposal and this turn's
  //       message parses as CONFIRM / DECLINE / AMBIGUOUS
  //   (b) tool-router picked category=action with a resolved reference,
  //       meaning the user has just requested a mutation
  //
  // In case (a) with CONFIRM matching fingerprint → runActionChain
  // with GRANTED auth. Otherwise (DECLINE / AMBIGUOUS / STALE / new
  // proposal) we short-circuit with the appropriate composer reply and
  // NEVER invoke the adapter.
  {
    const currentTurn = (session2?.turnCount ?? 0) + 1;
    const pending = session2?.pendingProposal;
    const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";

    // Helper · resolve the current-turn action intent to a
    // (kind, target, messageBody) triple. Returns undefined when the
    // turn is not an action request (no toolSelection.category=action
    // AND no pending proposal to satisfy).
    const buildActionRequest = (): { kind: ChainActionKind; target: ActionChainTarget; messageBody?: string } | undefined => {
      const ref = session2?.currentReference;
      if (!ref?.resolved || !ref.business) return undefined;
      // For 3.37 v1, wired mutation kind is contact_via_whatsapp.
      // open_directory continues to flow through the legacy 3.21 path
      // for backwards compat.
      // Match on refId (exact) first, fall back to case-insensitive
      // name/canonical match · session canonical is lowercased.
      const refCanon = ref.business.canonical?.toLowerCase() ?? "";
      const refRawLc = ref.business.raw?.toLowerCase() ?? "";
      const businessRecord = worldRecords.find((r) => {
        const rid = (r as { id?: string }).id;
        if (ref.business!.refId && rid && rid === ref.business!.refId) return true;
        const nameLc = r.name?.toLowerCase() ?? "";
        return nameLc === refCanon || nameLc === refRawLc;
      });
      const wa = businessRecord?.whatsapp;
      // Prefer the display-cased name from the record (falls back to
      // the raw form of the reference, then canonical).
      const displayName = businessRecord?.name || ref.business.raw || ref.business.canonical;
      const target: ActionChainTarget = {
        canonical: displayName,
        refId:     ref.business.refId,
        contactChannel: wa
          ? { kind: "whatsapp", value: wa, source: "world_record" }
          : undefined,
        resolvedAt: new Date().toISOString(),
      };
      return { kind: "contact_via_whatsapp", target, messageBody: message.trim() };
    };

    // Case (a) · pending proposal + user's confirmation attempt
    if (pending && pending.status === "AWAITING") {
      const conf = parseConfirmation(message);
      const request = buildActionRequest() ?? {
        kind: pending.kind,
        target: pending.target,
        messageBody: pending.messageBody,
      };
      const decision = decideAuthorization({
        requestedKind:    request.kind,
        requestedTarget:  request.target,
        messageBody:      request.messageBody,
        message,
        currentTurn,
        pendingProposal:  pending,
        confirmationResult: conf,
        now:              () => new Date().toISOString(),
      });

      if (decision.outcome === "PROCEED_WITH_AUTH") {
        // GRANTED · run the chain with the pending proposal's target.
        actionAudit = await runActionChain({
          kind: decision.proposal.kind,
          requestedByMessage: message,
          target: decision.proposal.target,
          authorization: decision.auth,
          adapter: whatsappStubAdapter,   // v1 stub · UNKNOWN by design
        });
        base.reply = composeActionReply(actionAudit, lang);
        // Mark CONSUMED · replay guard.
        if (opts.conversationId) {
          const next = getSession(opts.conversationId);
          if (next) {
            upsertSession({
              ...next,
              turnCount: currentTurn,
              pendingProposal: { ...decision.proposal, status: "CONSUMED" },
            });
          }
        }
      } else if (decision.outcome === "DECLINED") {
        // BLOCKED via runActionChain so the audit chain is honest.
        actionAudit = await runActionChain({
          kind: pending.kind,
          requestedByMessage: message,
          target: pending.target,
          authorization: decision.auth,
          adapter: whatsappStubAdapter,   // adapter never called (auth denied)
        });
        base.reply = composeDeclineAck(pending, lang);
        if (opts.conversationId) {
          const next = getSession(opts.conversationId);
          if (next) {
            upsertSession({
              ...next,
              turnCount: currentTurn,
              pendingProposal: { ...pending, status: "EXPIRED" },
            });
          }
        }
      } else if (decision.outcome === "AMBIGUOUS_NEEDS_CLARIFICATION") {
        base.reply = composeAmbiguousReprompt(pending, lang);
        if (opts.conversationId) {
          const next = getSession(opts.conversationId);
          if (next) upsertSession({ ...next, turnCount: currentTurn });
        }
      } else if (decision.outcome === "STALE_OR_MISMATCHED") {
        base.reply = composeStaleAck(decision.reason, lang);
        if (opts.conversationId) {
          const next = getSession(opts.conversationId);
          if (next) {
            upsertSession({
              ...next,
              turnCount: currentTurn,
              pendingProposal: { ...pending, status: "EXPIRED" },
            });
          }
        }
      } else if (decision.outcome === "AWAIT_CONFIRMATION") {
        // The prior pending was invalidated · propose the new one.
        base.reply = composeProposalPrompt(decision.proposal, lang);
        if (opts.conversationId) {
          const next = getSession(opts.conversationId);
          if (next) {
            upsertSession({
              ...next,
              turnCount: currentTurn,
              pendingProposal: decision.proposal,
            });
          }
        }
      } else if (decision.outcome === "BLOCKED_MISSING_EVIDENCE") {
        base.reply = composeMissingEvidenceReply(decision.reason, request.target, lang);
        if (opts.conversationId) {
          const next = getSession(opts.conversationId);
          if (next) upsertSession({ ...next, turnCount: currentTurn });
        }
      }
    }
    // Case (b) · no pending · but router picked action AND we can build a request
    else if (toolSelection.category === "action") {
      const request = buildActionRequest();
      if (request) {
        const decision = decideAuthorization({
          requestedKind:   request.kind,
          requestedTarget: request.target,
          messageBody:     request.messageBody,
          message,
          currentTurn,
          pendingProposal: null,
          confirmationResult: undefined,
          now: () => new Date().toISOString(),
        });
        if (decision.outcome === "BLOCKED_MISSING_EVIDENCE") {
          base.reply = composeMissingEvidenceReply(decision.reason, request.target, lang);
          if (opts.conversationId) {
            const next = getSession(opts.conversationId);
            if (next) upsertSession({ ...next, turnCount: currentTurn });
          }
        } else if (decision.outcome === "AWAIT_CONFIRMATION") {
          const stamped: PendingProposal = { ...decision.proposal, language: lang };
          base.reply = composeProposalPrompt(stamped, lang);
          if (opts.conversationId) {
            const next = getSession(opts.conversationId);
            if (next) {
              upsertSession({
                ...next,
                turnCount: currentTurn,
                pendingProposal: stamped,
              });
            }
          }
        }
      }
    }
  }

  if (toolSelection.category === "calculator") {
    calculatorResult = runCalculator(message);
    const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
    base.reply = calculatorResult.computed
      ? (lang === "id" ? calculatorResult.replyText.id : calculatorResult.replyText.en)
      : (lang === "id" ? calculatorResult.message.id  : calculatorResult.message.en);
  } else if (toolSelection.category === "weather") {
    // v1 · no provider wired. Runner returns honest unavailable.
    weatherResult = await runWeather({ message });
    const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
    base.reply = weatherResult.obtained
      ? (lang === "id" ? weatherResult.replyText.id : weatherResult.replyText.en)
      : (lang === "id" ? weatherResult.message.id  : weatherResult.message.en);
  } else if (toolSelection.category === "knowledge") {
    knowledgeResult = runKnowledge({ message, market: opts.userMarket });
    const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
    base.reply = knowledgeResult.found
      ? (lang === "id" ? knowledgeResult.replyText.id : knowledgeResult.replyText.en)
      : (lang === "id" ? knowledgeResult.message.id  : knowledgeResult.message.en);
  } else if (toolSelection.category === "ambiguous") {
    // Only surface the clarification prompt when NO other useful path
    // will produce a reply. If the wrapper is about to fetch World
    // records for a wired vertical OR the session has an active
    // accommodation goal (Phase B compare / Phase C reasoning / etc.
    // will handle the reply downstream), the ambiguous override would
    // drop valid context. Router still reports category=ambiguous so
    // downstream tests can audit routing · we just don't override
    // base.reply here.
    const willFireWorld = !!vertical;
    const hasActiveGoal = session2?.goal?.kind === "accommodation"
      && (session2.goal.status === "active" || session2.goal.status === "resumed");
    if (!willFireWorld && !hasActiveGoal) {
      const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
      base.reply = lang === "id"
        ? "Bisa ceritakan lebih detail? Saya butuh sedikit konteks untuk membantu — misal nama tempat, aktivitas, atau apa yang kamu cari."
        : "Could you give me a bit more detail? I need some context to help — e.g. a place, an activity, or what you're trying to find.";
    }
  }

  // Stage 3.35 · Phase D · Multi-step planning.
  //
  // Detects "find X, then Y" · "cari X, lalu Y" style requests. When
  // 2+ steps parseable, executes them sequentially with the CONSTITUTIONAL
  // rule: downstream steps NEVER consume unverified upstream assumptions.
  // If Step 1 picks a hotel whose coords are unpublished, Step 2
  // (transport-from-hotel) is BLOCKED with an honest reason.
  //
  // Plan execution reuses searchWorld directly per step so each step
  // hits the live World independently. The pick within each step is
  // taken as the top adapter result (reasoning/recommendation
  // integration is a future enhancement · Phase D v1 focuses on the
  // sequencing + blocking doctrine).
  let worldPlan: WorldPlan | undefined;
  const planSteps = opts.useLiveWorld ? parsePlanSteps(message) : [];
  if (planSteps.length >= 2) {
    worldPlan = await executePlan({
      steps: planSteps,
      stepExecutor: async (step, priorPicks) => {
        // Enrich step input with upstream coordinates when this step
        // depends on them (e.g. transport from prior hotel).
        const originReq = step.requiredInputs.find(
          (r) => r.field === "coordinates" && r.usedAs === "origin",
        );
        const originPick = originReq ? priorPicks[originReq.from] : undefined;
        const cityForStep = step.slots.city
          || originPick?.city
          || (step.vertical === "accommodation" ? "Yogyakarta" : undefined);
        const searchInput: WorldSearchInput = {
          vertical: step.vertical,
          market: "ID",
          city: cityForStep,
          area: step.slots.area,
          category: step.slots.category,
          budget: step.slots.budget,
          query: step.slots.query,
          limit: 10,
          sort: "rating",
        };
        const world = await searchWorld(searchInput);
        return {
          records: world.records,
          pick: world.records[0],
        };
      },
    });
    if (worldPlan.planned) {
      const lang: "en" | "id" = detectAccommodationReplyLang(message) === "id" ? "id" : "en";
      base.reply = lang === "id" ? worldPlan.replyText.id : worldPlan.replyText.en;
    }
  }

  return {
    ...base,
    world_cards: cards,
    world_latency_ms: latencyMs,
    world_expanded_page: expanded,
    // Stage 3.35 · Phase 1 · structured query signal · foundation for
    // Phases 2-5 · attached on every live-World turn so Recommendation
    // · Comparison · Reasoning · Planning can inspect the parse.
    world_query: {
      vertical,
      verbIntent,
      category: mergedSlots.type ?? extractedQuery,
      query: extractedQuery,
      city: cityFilter,
      area: mergedSlots.area,
      budget: mergedSlots.budget,
      priceCeilingIdr: extractedMaxPriceIdr,
      nearMe,
    },
    world_recommendation: worldRecommendation,
    world_comparison: worldComparison,
    world_reasoning: worldReasoning,
    world_plan: worldPlan,
    tool_selection: toolSelection,
    calculator_result: calculatorResult,
    weather_result: weatherResult,
    knowledge_result: knowledgeResult,
    action_audit: actionAudit,
  };
}
