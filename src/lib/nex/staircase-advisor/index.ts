// Staircase Advisor v0 · orchestration entry point
//
// Called from /api/nex/staircase-chat/route.ts BEFORE the knowledge bridge
// when NEX_STAIRCASE_ADVISOR_ENABLED=1. Returns a Pipeline-C-shaped
// response if Advisor claims the turn · null to fall through.
//
// Behavioural rules encoded here:
//   - Trigger check (Section 3): only engage on advisor patterns
//   - Boundary check (Section 6.2): price/fit hit safe handoff messages
//   - Unauthored branch check (Section 4.1 · Option A · 2026-08-01):
//     Replacement + Extension politely explain the limitation
//   - Stage 1 threshold (Section 5.2): project_type + style → direction
//   - Field extraction (Section 4.2): parse multi-field messages · skip-ahead
//   - 5-turn handoff cap (Section 4.1)
//   - Every response carries an attribution trail (Section 5.5 · 8.6)

import "server-only";

import {
  getOrCreateState,
  persistState,
  type AdvisorState,
} from "./state";

import {
  shouldTriggerAdvisor,
  isReplacementBranch,
  isExtensionBranch,
  isImageRequest,
} from "./triggers";

import { extractFields, nextQuestion } from "./flow";
import { composeStageOne } from "./recommendation";

import {
  isBoundaryRequest,
  PRICE_HANDOFF_MESSAGE,
  FIT_HANDOFF_MESSAGE,
  REPLACEMENT_HANDOFF_MESSAGE,
  EXTENSION_HANDOFF_MESSAGE,
  FIVE_TURN_HANDOFF_MESSAGE,
} from "./boundaries";

import { matchComparison } from "./comparisons";
import { matchTruthTopic } from "./truth-answer";
import { matchAmbiguity } from "./ambiguity";
import { retrieveTruth } from "./truth-retrieval";
import { isIdentityProbe, nexIdentityResponse, offTopicResponse } from "./identity";
import { isObviouslyInScope, classifyScope } from "./scope-classifier";
import { isKitchenAdjacent, KITCHEN_REDIRECT_MESSAGE, kitchenReferenceAttachment } from "./kitchen-redirect";
import { composeGroundedAnswer, retrieveConfirmedImages } from "./llm-composer";
import { isDesignEnquiry, extractDesignEnquiryContext, INSTALL_LOCATION_PHRASES } from "./design-enquiry";
import { isNegativeFeedback, buildFeedbackResponse } from "./feedback-detection";
import { isShortFollowUp, isImageFollowUp, enrichWithLastTopic } from "./follow-up-detection";
import { matchSocialIntent } from "./social-intents";
import { detectCountry, REGIONAL_PROFILES } from "./regional-terminology";
import {
  IMAGE_STATE_BADGE,
  IMAGE_STATE_CAPTION,
  type ImageMatch,
  type ImageState,
} from "@/lib/nex/images/confirmed-library";
// Philip 2026-08-02 · Priority 3 intelligence layer · Supplier Preparation Workflow (Business Brain).
// Isolated per Philip's architecture rule: Staircase Brain → Customer Understanding → Business Brain → Supplier Workflow.
import { isSupplierIntent } from "@/lib/nex/business-brain/supplier-intent";
import { runSupplierWorkflow } from "@/lib/nex/business-brain/supplier-workflow";
import { getOrCreateEnquiry } from "@/lib/nex/business-brain/enquiry-state";

// Philip 2026-08-01 · Image-language safety net.
// When a knowledge snippet body starts with "This image shows a modern straight
// flight..." and the composer copies that phrasing verbatim into its answer, the
// customer reads about an image that doesn't accompany the answer. If NO visual
// brain images are attached, rewrite image-referring phrases into general form.
// This is a belt-and-braces backup to the composer system-prompt rule.
function stripImageLanguageWhenEmpty(text: string, hasImages: boolean): string {
  if (hasImages) return text;
  let out = text;
  // Sentence-openers that assert an image is present
  out = out.replace(/\bthis\s+image\s+shows?\s+/gi, "");
  out = out.replace(/\bthe\s+image\s+(above|below|shown|attached|here)\s+/gi, "");
  out = out.replace(/\bin\s+(the|this)\s+(image|photograph|picture)[,]?\s+/gi, "");
  out = out.replace(/\bas\s+(shown|displayed)\s+(here|below|above|in\s+the\s+image)[,]?\s+/gi, "");
  // Gallery/examples-below references (only removed when nothing is attached)
  out = out.replace(/\bthe\s+(gallery|examples?|photos?|images?)\s+below[,]?\s+/gi, "");
  out = out.replace(/\bthe\s+attached\s+(design|image|photograph|picture)s?[,]?\s+/gi, "");
  // Collapse double spaces / stray punctuation left over
  out = out.replace(/\s{2,}/g, " ").replace(/^\s*[,.\-]\s*/, "");
  // Capitalise first letter if the sentence-opener was stripped mid-flow
  if (out.length > 0 && /[a-z]/.test(out[0])) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

// Convert Visual Brain matches to the AdvisorImageAttachment shape returned to the client
// Visual Brain v2 (Philip 2026-08-01): one staircase = one design record with many views.
function imagesToAttachments(matches: ImageMatch[]): AdvisorImageAttachment[] {
  return matches.map((m) => {
    const design_id =
      m.image.design_id ??
      m.image.image_id ??
      m.image.url.split("/").pop()?.split(".")[0] ??
      "unknown";
    // Philip 2026-08-02 · Visual Brain Connection v1 · transparency layer.
    // Unset state defaults to "concept" (safest). Badge + transparency caption
    // travel with every tile so the customer always knows what they are looking at.
    const image_state: ImageState = m.image.image_state ?? "concept";
    return {
      design_id,
      title:                m.image.title ?? m.image.staircase_type,
      design_family:        m.image.design_family,
      image_id:             m.image.image_id ?? design_id,   // legacy alias
      url:                  m.image.url,
      additional_views:     m.image.additional_views,
      view_types:           m.image.view_types,
      caption:              m.image.customer_description,
      staircase_type:       m.image.staircase_type,
      design_style:         m.image.design_style,
      confidence:           Math.round(m.confidence * 100) / 100,
      matched_attributes:   m.matched_attributes,
      image_state,
      image_state_badge:    IMAGE_STATE_BADGE[image_state],
      transparency_caption: IMAGE_STATE_CAPTION[image_state],
    };
  });
}

// ─── Response shape (matches Pipeline C + adds advisor metadata) ───

export type AdvisorAction =
  | "identity_response"       // Nex identity · never confirms being AI/LLM (Philip 2026-08-01)
  | "feedback_acknowledgment" // User frustration acknowledged · offers to recover previous topic (Philip 2026-08-01)
  | "capability_question"     // Answers "what can you do / show images / etc." honestly (Philip 2026-08-01)
  | "escalation_request"      // Asks for a human/boss · offers Stairplan team paths (Philip 2026-08-01)
  | "social_affection"        // Warm acknowledgment for love/thanks/compliments (Philip 2026-08-01)
  | "greeting"                // Warm greeting + offer to help (Philip 2026-08-01)
  | "kitchen_redirect"        // Kitchen Centre coming soon · attaches ONE kitchen reference image (Philip 2026-08-01)
  | "scope_redirect"          // Warm off-topic redirect (Philip 2026-08-01)
  | "question"
  | "teaching_response"       // G20 · comparative-question teaching (Philip 2026-08-01)
  | "truth_answer"            // Hand-coded topic answer
  | "truth_retrieval"         // Auto-retrieved verbatim (fallback if LLM unavailable)
  | "grounded_composition"    // LLM composes over retrieved evidence · Philip 2026-08-01 unified pipeline
  | "ambiguity_clarify"       // G06 · Nex names ambiguity with two hypotheses (Philip 2026-08-01)
  | "stage_1_recommendation"
  | "boundary_handoff"
  | "branch_limitation"
  | "flow_cap_handoff"
  | "supplier_collecting"     // Philip 2026-08-02 · Business Brain · gathering supplier-workflow requirements
  | "supplier_brief_ready";   // Philip 2026-08-02 · Business Brain · Supplier Brief + professional handoff

export type AdvisorCitation = {
  module:  "advisor";
  ref_id:  string;
  snippet: string;
  source:  "staircase-advisor-v0";
};

// Parallel Visual Brain attachment · UI displays separately from text answer
// Visual Brain v2 shape (Philip 2026-08-01): one staircase = one design record with many views.
// design_id is the single canonical identifier across Knowledge · DNA · Estimator · CRM · Projects.
export type AdvisorImageAttachment = {
  design_id:            string;      // canonical id · e.g. "NEX-DESIGN-000012"
  title?:               string;      // short display name · e.g. "Modern Black Steel and Oak Staircase"
  design_family?:       string;      // "Modern" | "Traditional" | "Floating" | "Industrial" | "Contemporary" | "Commercial" | "Biophilic"
  image_id?:            string;      // legacy alias · defaults to design_id
  url:                  string;      // primary/hero URL for display
  additional_views?:    string[];    // other views of the SAME staircase (for gallery expansion)
  view_types?:          string[];    // why each image exists · parallel to [url, ...additional_views]
  caption:              string;      // customer-facing description · one sentence
  staircase_type:       string;
  design_style:         string;
  confidence:           number;      // 0-1 · retrieval confidence
  matched_attributes:   string[];    // debugging aid · which query attrs matched

  // Philip 2026-08-02 · Visual Brain Connection v1 · transparency layer
  image_state:          ImageState;  // concept | reference | manufacturer | customer_project
  image_state_badge:    string;      // short chip label rendered as a badge on the tile
  transparency_caption: string;      // prescribed line rendered under every tile
};

export type AdvisorResponse = {
  ok:              true;
  answer:          string;
  citations:       AdvisorCitation[];
  wood_cards:      [];
  visual_intent:   "neutral";
  comparison:      false;
  expertise:       { level: "unknown"; confidence: 0.3; signals: []; score: 0 };
  status:          "answered_by_advisor";
  brain_versions:  Record<string, string>;
  presentation:    undefined;
  conversation_id: string;
  stage:           string;
  retrieved_ids:   string[];
  visual_brain?:   AdvisorImageAttachment[];   // Philip 2026-08-01 · confirmed images alongside answer
  supplier_brief?: {                            // Philip 2026-08-02 · Business Brain · Supplier Workflow v1 output
    enquiry_id:   string;
    brief_record: Record<string, unknown>;
    matches:      Array<{ name: string; handoff_message: string; matched_capabilities: string[] }>;
  };
  advisor: {
    action:              AdvisorAction;
    recommendation_id?:  string;
    sources_used:        string[];
    confidence:          string;
    state_snapshot: {
      project_type?:         string;
      style?:                string;
      timber?:               string;
      balustrade?:           string;
      layout?:               string;
      recommendation_stage:  string;
      questions_asked_count: number;
      handoff_reason?:       string;
    };
  };
};

export type TryAdvisorInput = {
  message:        string;
  conversationId: string;
  stage:          string;
};

// ─── Shape helper ─────────────────────────────────────────────────

function shape(
  state: AdvisorState,
  params: {
    text:              string;
    action:            AdvisorAction;
    sources:           string[];
    confidence:        string;
    stageValue:        string;
    recommendationId?: string;
    images?:           AdvisorImageAttachment[];
    supplierBrief?: {
      enquiry_id:   string;
      brief_record: Record<string, unknown>;
      matches:      Array<{ name: string; handoff_message: string; matched_capabilities: string[] }>;
    };
  },
): AdvisorResponse {
  // Philip 2026-08-02 · Citation transparency fix (Check 2).
  // Extract a readable slug from the source string so ref_id reveals WHICH
  // article produced the answer. Previous behaviour returned "advisor-src-N"
  // (opaque). New behaviour returns e.g. "newel-posts-phase-17-troubleshooting"
  // so Philip can trace every answer back to its authored source.
  const citations: AdvisorCitation[] = params.sources.map((src, i) => {
    const s = String(src);
    // Look for a filename slug · e.g. "nex-knowledge-base-newel-posts-phase-1-foundations.md · Structural"
    const fileMatch = s.match(/([a-z0-9][a-z0-9-]*?)(?:\.md)?(?:\s*·|\s*$)/i);
    const slug = fileMatch
      ? fileMatch[1].replace(/^nex-knowledge-base-/i, "").replace(/^nex-/i, "")
      : `src-${i}`;
    return {
      module:  "advisor",
      ref_id:  slug,
      snippet: src,
      source:  "staircase-advisor-v0",
    };
  });
  return {
    ok:              true,
    answer:          params.text,
    citations,
    wood_cards:      [],
    visual_intent:   "neutral",
    comparison:      false,
    expertise:       { level: "unknown", confidence: 0.3, signals: [], score: 0 },
    status:          "answered_by_advisor",
    brain_versions:  { "staircase:advisor-v0": "0.1" },
    presentation:    undefined,
    conversation_id: state.conversation_id,
    stage:           params.stageValue,
    retrieved_ids:   [],
    visual_brain:    params.images && params.images.length > 0 ? params.images : undefined,
    supplier_brief:  params.supplierBrief,
    advisor: {
      action:             params.action,
      recommendation_id:  params.recommendationId,
      sources_used:       params.sources,
      confidence:         params.confidence,
      state_snapshot: {
        project_type:            state.project_type,
        install_location:        state.install_location,       // Philip 2026-08-01 · design-enquiry continuation field
        style:                   state.style,
        timber:                  state.timber,
        balustrade:              state.balustrade,
        layout:                  state.layout,
        recommendation_stage:    state.recommendation_stage,
        questions_asked_count:   state.questions_asked_count,
        next_decision_required:  state.next_decision_required, // observability for conversation-continuation flow
        user_country:            state.user_country,           // Philip 2026-08-02 · Regional Language Layer observability
        handoff_reason:          state.handoff_reason,
      } as any,
    },
  };
}

// ─── Main entry ────────────────────────────────────────────────────

export async function tryStaircaseAdvisor(input: TryAdvisorInput): Promise<AdvisorResponse | null> {
  const { message, conversationId, stage } = input;
  if (typeof message !== "string" || message.trim().length === 0) return null;

  const state = getOrCreateState(conversationId);

  // Trigger check · fall through if no Advisor intent
  if (!shouldTriggerAdvisor(message, state)) return null;

  state.advisor_active = true;

  // Philip 2026-08-02 · Regional Language Layer (Priority 1 intelligence layer).
  // Detect country from THIS message · sticky in state once set · re-detected
  // each turn so the customer can correct it ("actually I'm in Australia").
  // Never demoted to null by absence — only overwritten by a new detection.
  const detectedCountry = detectCountry(message);
  if (detectedCountry) {
    state.user_country = detectedCountry;
  }

  // Philip 2026-08-02 · Priority 2 · Statement-form design extraction.
  // Journey-validation gap: customers say "I want a modern oak and glass
  // staircase" as a statement, not a question. isDesignEnquiry only matches
  // question forms, so the design signals were dropped. Solution: run
  // extractDesignEnquiryContext on EVERY message and merge non-empty results
  // into state.design_enquiry_context. Idempotent · later refinements fold in.
  // This runs BEFORE the supplier workflow check so seed data is present when
  // the workflow triggers.
  const ambientCtx = extractDesignEnquiryContext(message);
  const hasAmbient = !!(ambientCtx.staircase_type || ambientCtx.design_style || (ambientCtx.materials && ambientCtx.materials.length > 0));
  if (hasAmbient) {
    const existing = state.design_enquiry_context ?? {};
    const mergedMaterials = ambientCtx.materials
      ? Array.from(new Set<string>([...(existing.materials ?? []), ...ambientCtx.materials])).slice(0, 8)
      : existing.materials;
    state.design_enquiry_context = {
      staircase_type: ambientCtx.staircase_type ?? existing.staircase_type,
      design_style:   ambientCtx.design_style   ?? existing.design_style,
      materials:      mergedMaterials,
    };
    if (ambientCtx.design_style && !state.style) state.style = ambientCtx.design_style;
  }
  // Same pass for install_location phrases mid-sentence ("we're renovating our
  // hallway" · "for our loft conversion") · captured only if not already set.
  if (!state.install_location) {
    for (const [rx, canonical] of INSTALL_LOCATION_PHRASES) {
      if (rx.test(message)) { state.install_location = canonical; break; }
    }
  }

  // Philip 2026-08-01 · Runtime instrumentation.
  // One line per request · confirms state actually persists across turns and
  // makes future audits observable-first. Values reset would jump out immediately.
  if (process.env.NEX_ADVISOR_TRACE !== "0") {
    // eslint-disable-next-line no-console
    console.log(
      "[nex-advisor]",
      "conv=", conversationId.slice(0, 8),
      "| msg=", JSON.stringify(message.slice(0, 40)),
      "| last_user_query=", JSON.stringify((state.last_user_query ?? "(none)").slice(0, 40)),
      "| install_location=", state.install_location ?? "(none)",
      "| next_decision_required=", state.next_decision_required ?? "(none)",
      "| style=", state.style ?? "(none)",
      "| country=", state.user_country ?? "(none)",
      "| stage=", state.recommendation_stage,
      "| questions_asked=", state.questions_asked_count,
    );
  }

  // Philip 2026-08-01 · Short follow-up topic memory (P0 conversation-quality fix).
  // Detect "ok show me" · "images please" · "examples" · "yes" style short replies
  // and enrich the effective query with the last user query. Downstream Visual
  // Brain retrieval + knowledge composition then see the FULL topic context
  // instead of only the tiny reply. Original `message` is preserved for
  // rendering decisions · `effectiveMessage` drives retrieval + composition.
  const isFollowUp = isShortFollowUp(message) && !!state.last_user_query;
  const effectiveMessage = isFollowUp
    ? enrichWithLastTopic(message, state.last_user_query)
    : message;

  // Parallel Visual Brain retrieval · Philip 2026-08-01 architecture.
  // Runs once per turn · attached to any content-serving path (truth_answer,
  // truth_retrieval, grounded_composition, stage_1_recommendation).
  // NOT attached to identity · feedback_acknowledgment · scope_redirect ·
  // boundary_handoff · branch_limitation · kitchen_redirect (which attaches
  // its own ONE kitchen reference image via kitchenReferenceAttachment()).
  //
  // Philip 2026-08-01 · state passed so accumulated conversation context
  // (design_enquiry_context from Turn 1 + style/timber/balustrade extracted
  // across turns) enriches the query · Turn N's short reply is scored against
  // everything the customer has already told Nex, not only the latest message.
  const visualMatches = retrieveConfirmedImages(effectiveMessage, state);
  const visualBrainImages = imagesToAttachments(visualMatches);

  // Identity probe · never confirms being AI/LLM · answers as Nex
  // (Philip 2026-08-01 "never mention LLM online · Nex is super intelligence")
  if (isIdentityProbe(message)) {
    persistState(state);
    return shape(state, {
      text:       nexIdentityResponse(message),
      action:     "identity_response",
      sources:    ["Nex identity rule"],
      confidence: "evidence-backed",
      stageValue: stage,
    });
  }

  // Philip 2026-08-01 · Negative feedback acknowledgment (P0 UX fix).
  // Customer expressions of frustration ("you're stupid", "no that's wrong",
  // "useless") must be recognised as FEEDBACK about the previous answer, not
  // as a new staircase question. Acknowledge without arguing, name the
  // previous topic, and offer to try again. Never reset to project_type gate.
  if (isNegativeFeedback(message)) {
    persistState(state);
    return shape(state, {
      text:       buildFeedbackResponse(state.last_user_query),
      action:     "feedback_acknowledgment",
      sources:    ["Nex feedback-recovery rule · owns the miss · offers to re-address the previous topic"],
      confidence: "evidence-backed",
      stageValue: stage,
    });
  }

  // Philip 2026-08-01 · Social & meta intents (P0/P1 conversation-quality).
  // "Why can't you show images?" · "Can I speak to your boss?" · "I love you" ·
  // "Hi" · "Thanks" — all must bypass the staircase pipeline entirely. A real
  // specialist acknowledges these warmly · never treats them as staircase
  // questions or off-topic refusals. Placed BEFORE kitchen_redirect and scope
  // classifier so they never reach either.
  const social = matchSocialIntent(message);
  if (social) {
    persistState(state);
    return shape(state, {
      text:       social.response,
      action:     social.intent,
      sources:    social.sources,
      confidence: "evidence-backed",
      stageValue: stage,
    });
  }

  // Kitchen-adjacent redirect · Philip 2026-08-01 · takes precedence over
  // the generic scope classifier so a customer asking "can you design my kitchen?"
  // gets the specific "Kitchen Centre coming soon" message + ONE kitchen reference
  // image instead of the generic off-topic response. Kitchen reference image is
  // NOT part of the Staircase Visual Brain and is NEVER returned for staircase
  // retrieval — it exists only to support this conversation.
  if (isKitchenAdjacent(message)) {
    persistState(state);
    return shape(state, {
      text:       KITCHEN_REDIRECT_MESSAGE,
      action:     "kitchen_redirect",
      sources:    ["Nex kitchen redirect · Kitchen Centre coming soon"],
      confidence: "evidence-backed",
      stageValue: stage,
      images:     kitchenReferenceAttachment(),
    });
  }

  // Scope check · Philip 2026-08-01 · replaced off-topic regex sprawl
  // with a fast heuristic + LLM classifier. Fast path: staircase-keyword
  // messages skip the LLM entirely. Slow path (rare · no keyword hits):
  // ask Haiku "is this in scope?" · redirect if off-topic.
  //
  // Philip 2026-08-01 · conversation-continuation bypass: when the Advisor
  // just asked a specific question (state.next_decision_required set), OR
  // when the current message is a short follow-up ("ok show me" · "images
  // please") that inherits the previous topic, treat as mid-conversation.
  // Short follow-ups are by definition answers to the prior turn — never
  // fresh off-topic messages — so they must never hit the scope classifier.
  // Philip 2026-08-02 · Supplier Preparation Workflow (Business Brain).
  // Runs BEFORE scope classifier so an explicit supplier verb ("Can I buy this?"
  // · "Who can make this?" · "Find me a supplier") is never bounced as
  // off-topic. Runs BEFORE boundary/branch/comparison so "who can make this"
  // doesn't get eaten by the generic price handoff. The workflow itself owns
  // pricing discipline (brief never quotes prices · handoff line has no price).
  //
  // Two entry conditions:
  //   (1) Fresh trigger — customer message matches supplier intent.
  //   (2) Continuation — a supplier enquiry is already open in "collecting"
  //       step (we are mid-workflow, this message is an answer to the last
  //       field we asked for). Continuation bypasses scope because a mid-flow
  //       short answer like "oak" or "3m rise" is not a fresh off-topic message.
  const existingEnquiry = getOrCreateEnquiry(conversationId);
  const supplierContinuation = existingEnquiry.step === "collecting";
  const supplierFreshTrigger = isSupplierIntent(message);

  if (supplierContinuation || supplierFreshTrigger) {
    // Philip 2026-08-02 · Opportunity 1 · Visual Brain → Supplier Workflow Bridge v1.
    // Extract trusted metadata from any Visual Brain images retrieved for this
    // turn's context. NEVER treats image as specification · customer's own words
    // remain authoritative for style/materials · this only ADDS references +
    // fills gaps + carries the state-appropriate transparency caveat.
    const visualMatchesForBridge = visualMatches.slice(0, 3).map((m) => {
      const raw = m.image.customer_description ?? "";
      const rawLower = raw.toLowerCase();
      const bridgedMaterials: string[] = [];
      if (/\boak\b/.test(rawLower))                bridgedMaterials.push("oak");
      if (/\bwalnut\b/.test(rawLower))             bridgedMaterials.push("walnut");
      if (/\bash\b/.test(rawLower))                bridgedMaterials.push("ash");
      if (/\bmaple\b/.test(rawLower))              bridgedMaterials.push("maple");
      if (/\bglass\b/.test(rawLower))              bridgedMaterials.push("glass_balustrade");
      if (/\bstainless\b/.test(rawLower))          bridgedMaterials.push("stainless");
      if (/\bbrass\b/.test(rawLower))              bridgedMaterials.push("brass");
      if (/\bbronze\b/.test(rawLower))             bridgedMaterials.push("bronze");
      // Normalise staircase_type from the free-text field to canonical tokens
      const st = (m.image.staircase_type ?? "").toLowerCase();
      let staircase_type: string | undefined;
      if      (/floating/.test(st))                staircase_type = "floating";
      else if (/spiral|helical/.test(st))          staircase_type = "spiral";
      else if (/curved|sweeping/.test(st))         staircase_type = "curved";
      else if (/quarter.?turn|l.?shape/.test(st))  staircase_type = "quarter_turn";
      else if (/half.?turn|u.?shape|dog.?leg/.test(st)) staircase_type = "half_turn";
      else if (/straight/.test(st))                staircase_type = "straight_flight";
      // Normalise design_style
      const ds = (m.image.design_style ?? "").toLowerCase();
      let design_style: string | undefined;
      if      (/contemporary|modern|minimal/.test(ds)) design_style = "modern";
      else if (/traditional|classic|heritage/.test(ds)) design_style = "traditional";
      else if (/industrial|loft/.test(ds))              design_style = "industrial";
      else if (/luxury|premium|bespoke/.test(ds))       design_style = "luxury";
      const image_state = m.image.image_state ?? "concept";
      const caption =
        image_state === "concept"          ? "Nex generated design concept — showing possible appearance."
      : image_state === "reference"        ? "Style direction reference — exact manufacture may vary."
      : image_state === "manufacturer"     ? "Supplied product image from a manufacturer."
      :                                       "Real customer installation.";
      return {
        design_id:            m.image.design_id ?? m.image.image_id ?? "unknown",
        title:                m.image.title,
        image_state,
        transparency_caption: caption,
        design_style,
        staircase_type,
        materials:            bridgedMaterials,
      };
    });

    const result = runSupplierWorkflow({
      conversationId,
      message,
      isNewTrigger: supplierFreshTrigger && !supplierContinuation,
      seed: {
        country:          state.user_country,
        staircase_type:   state.design_enquiry_context?.staircase_type,
        design_style:     state.design_enquiry_context?.design_style ?? state.style,
        materials:        state.design_enquiry_context?.materials,
        install_location: state.install_location,
        project_type:     state.project_type && state.project_type !== "unknown"
          ? state.project_type.replace(/-/g, "_")
          : undefined,
        visual_matches:   visualMatchesForBridge.length > 0 ? visualMatchesForBridge : undefined,
      },
    });
    persistState(state);
    return shape(state, {
      text:       result.text,
      action:     result.action === "supplier_collecting" ? "supplier_collecting" : "supplier_brief_ready",
      sources:    ["Business Brain · Supplier Preparation Workflow v1", `enquiry:${result.enquiry_id}`],
      confidence: "evidence-backed",
      stageValue: stage,
      // Philip 2026-08-02 · Bridge · attach the same visual references the brief cites
      // so the customer sees the tiles (with concept badge + transparency caveat) below
      // the workflow answer. Only attached when the brief has been assembled.
      images:     result.action === "supplier_brief_ready" && visualBrainImages.length > 0
        ? visualBrainImages
        : undefined,
      supplierBrief: result.brief_record && result.matches
        ? { enquiry_id: result.enquiry_id, brief_record: result.brief_record, matches: result.matches }
        : undefined,
    });
  }

  // Scope check · Philip 2026-08-01 · replaced off-topic regex sprawl
  // with a fast heuristic + LLM classifier.
  const midConversation = !!state.next_decision_required || isFollowUp;
  if (!midConversation && !isObviouslyInScope(message)) {
    const scope = await classifyScope(message);
    if (scope === "off_topic") {
      persistState(state);
      return shape(state, {
        text:       offTopicResponse(message),
        action:     "scope_redirect",
        sources:    ["Nex scope classifier · off-topic"],
        confidence: "evidence-backed",
        stageValue: stage,
      });
    }
  }

  // Section 6.2 boundary check · takes priority
  const boundary = isBoundaryRequest(message);
  if (boundary === "price") {
    state.handoff_reason = "price_boundary";
    persistState(state);
    return shape(state, {
      text:       PRICE_HANDOFF_MESSAGE,
      action:     "boundary_handoff",
      sources: [
        "customer-buying-guide-principles.md · Principle C (survey required · handoff timing)",
        "staircase-design-principles.md · Principle A (measurements are prerequisite)",
      ],
      confidence: "evidence-backed",
      stageValue: stage,
    });
  }
  if (boundary === "fit") {
    state.handoff_reason = "fit_boundary";
    persistState(state);
    return shape(state, {
      text:       FIT_HANDOFF_MESSAGE,
      action:     "boundary_handoff",
      sources: [
        "staircase-design-principles.md · Principle A (measurements are prerequisite)",
        "customer-buying-guide-principles.md · Principle C (designer measurement required)",
      ],
      confidence: "evidence-backed",
      stageValue: stage,
    });
  }

  // G20 · Comparative-question teaching (Philip 2026-08-01)
  // A real staircase specialist EXPLAINS trade-offs when asked "what's
  // better X or Y" · a form-style bot asks another question instead.
  // Check comparisons BEFORE field extraction · comparison responses
  // include a follow-up question so the conversation still progresses.
  const cmp = matchComparison(message);
  if (cmp) {
    if (!isFollowUp) state.last_user_query = message;   // Philip 2026-08-01 · topic memory
    persistState(state);
    return shape(state, {
      text:       cmp.response_text,
      action:     "teaching_response",
      sources:    cmp.sources,
      confidence: "evidence-backed",
      stageValue: stage,
      images:     visualBrainImages,
    });
  }

  // Truth Answer Composer (Philip 2026-08-01 · "bring nex alive to answer
  // from truth herself"). When customer asks a direct topic question that
  // maps to a Philip-authored snippet, Nex answers in her voice with the
  // verbatim truth · then optionally invites returning to the advisor flow.
  const truth = matchTruthTopic(message);
  if (truth) {
    if (!isFollowUp) state.last_user_query = message;   // Philip 2026-08-01 · topic memory
    persistState(state);
    return shape(state, {
      text:       stripImageLanguageWhenEmpty(truth.text, visualBrainImages.length > 0),
      action:     "truth_answer",
      sources:    truth.sources,
      confidence: "evidence-backed",
      stageValue: stage,
      images:     visualBrainImages,
    });
  }

  // G06 · Ambiguity clarification (Philip 2026-08-01)
  // If message is genuinely ambiguous, present two named hypotheses rather
  // than silently guessing. Fires BEFORE field extraction so Nex doesn't
  // commit to one interpretation of an ambiguous message.
  const amb = matchAmbiguity(message);
  if (amb) {
    persistState(state);
    return shape(state, {
      text:       amb.response_text,
      action:     "ambiguity_clarify",
      sources:    amb.sources,
      confidence: "evidence-backed",
      stageValue: stage,
    });
  }

  // Truth Retrieval · early check for definition-shaped questions
  // "what is X" / "tell me about X" / "define X" should route to retrieval
  // BEFORE field extraction — otherwise "what is european oak" gets
  // greedy-extracted as timber=oak and never hits the terminology answer.
  const isDefinitionQuestion = /\b(what\s+(is|are|does|do)|tell\s+me\s+about|define|explain)\b/i.test(message);
  if (isDefinitionQuestion) {
    // Philip 2026-08-01 · use effectiveMessage so follow-ups inherit topic
    const retrieved = retrieveTruth(effectiveMessage);
    if (retrieved) {
      if (!isFollowUp) state.last_user_query = message;   // Philip 2026-08-01 · topic memory
      persistState(state);
      return shape(state, {
        text:       stripImageLanguageWhenEmpty(retrieved.text, visualBrainImages.length > 0),
        action:     "truth_retrieval",
        sources:    retrieved.sources,
        confidence: "evidence-backed",
        stageValue: stage,
        images:     visualBrainImages,
      });
    }
  }

  // Philip 2026-08-01 · unified LLM composition · run BEFORE field extraction
  // for question-shaped messages. Otherwise a knowledge question like
  // "how should i maintain oak stairs" gets extracted as timber=oak and
  // never reaches LLM composition. Only preference-answers ("modern") should
  // skip LLM and go straight to state extraction.
  const isQuestionShaped =
    /\?$/.test(message.trim())
    || /\b(what|how|why|when|which|who|can|should|does|do|is|are|will|would|could|tell\s+me|explain|show\s+me|give\s+me)\b/i.test(message)
    || message.trim().split(/\s+/).length >= 6;

  if (isQuestionShaped || isFollowUp) {
    try {
      // Philip 2026-08-01 · use effectiveMessage (topic-enriched for short follow-ups)
      // so the LLM composer sees the full topic context, not the tiny reply.
      // Philip 2026-08-02 · pass user_country so composer adopts regional terminology.
      const grounded = await composeGroundedAnswer(effectiveMessage, {
        country: state.user_country,
      });
      if (grounded && grounded.text && grounded.text.length > 20) {
        // Philip 2026-08-01 · conversation-continuation tag.
        // If the customer message was a design-enquiry ("have you got X stairs?"),
        // set expectation for Turn 2 so a single-word reply ("hallway") gets
        // extracted as install_location instead of restarting the mandatory
        // project_type flow. Remember the design signals (staircase_type / style /
        // materials) parsed from Turn 1 so downstream retrieval can filter with
        // them even after the message scrolls off.
        if (isDesignEnquiry(message) && !state.install_location && !state.project_type) {
          state.next_decision_required = "install_location";
          state.design_enquiry_context = extractDesignEnquiryContext(message);
        }
        // Philip 2026-08-01 · Topic memory · record the ORIGINAL user question
        // (not the enriched form) so short follow-ups later this session can
        // inherit this topic. Only record substantive user queries, not the
        // short follow-up itself (which would replace the real topic).
        if (!isFollowUp) state.last_user_query = message;

        // Philip 2026-08-01 · Image honesty caveat.
        // If the user asked for images (short image-shaped follow-up) but the
        // Visual Brain returned NOTHING (all matches below MIN_IMAGE_CONFIDENCE),
        // prepend an honest "I don't currently have those images" note instead
        // of letting the LLM prose imply images exist.
        const imageRequestedNoResults = isImageFollowUp(message) && visualBrainImages.length === 0;
        // Philip 2026-08-01 · Image-language safety net · when NO images are attached
        // (visual_brain empty), strip image-referring phrases from the composed text
        // so the customer doesn't read about an image that doesn't accompany the answer.
        const cleanedGrounded = stripImageLanguageWhenEmpty(grounded.text, visualBrainImages.length > 0);
        const finalText = imageRequestedNoResults
          ? "I don't currently have images of that specific topic in my confirmed design library — rather than showing you unrelated staircases, I'll stick to the description. " + cleanedGrounded
          : cleanedGrounded;

        persistState(state);
        return shape(state, {
          text:       finalText,
          action:     "grounded_composition",
          sources:    grounded.used_snippet_ids,
          confidence: grounded.confidence,
          stageValue: stage,
          images:     visualBrainImages,     // Parallel Visual Brain retrieval attached (may be empty · caveat prepended above)
        });
      }
    } catch {
      // LLM failure · silent fallback to remaining pipeline
    }
  }

  // Field extraction · update state with anything the message contains
  // G05 · extractFields now returns { updates, corrections } · corrections
  // is a list of already-answered fields the customer explicitly changed
  // ("actually make it walnut"). Used below to prepend an acknowledgment.
  const { updates, corrections } = extractFields(message, state);
  Object.assign(state, updates);
  for (const key of Object.keys(updates)) {
    if (!state.answered_order.includes(key)) state.answered_order.push(key);
  }

  // G05 · Correction acknowledgment (Philip 2026-08-01)
  // If customer explicitly changed a previously-answered field, prepend a
  // warm acknowledgment so the change feels heard. Stored on state so the
  // next response includes it.
  const correctionAckPrefix = corrections.length > 0
    ? corrections.length === 1
      ? `Got it — switching ${corrections[0].replace(/_/g, " ")} to ${(state as any)[corrections[0]]}. `
      : `Got it — I've updated ${corrections.map(c => c.replace(/_/g, " ")).join(" and ")}. `
    : "";

  // Section 4.1 · Replacement branch (unauthored · Option A limitation message)
  if (state.project_type === "replacement" || isReplacementBranch(message)) {
    state.project_type   = "replacement";
    state.handoff_reason = "replacement_branch_unauthored";
    persistState(state);
    return shape(state, {
      text:       REPLACEMENT_HANDOFF_MESSAGE,
      action:     "branch_limitation",
      sources:    ["Section 4.1 · Replacement branch pending Philip authoring · Option A 2026-08-01"],
      confidence: "partial-evidence",
      stageValue: stage,
    });
  }
  if (state.project_type === "extension" || isExtensionBranch(message)) {
    state.project_type   = "extension";
    state.handoff_reason = "extension_branch_unauthored";
    persistState(state);
    return shape(state, {
      text:       EXTENSION_HANDOFF_MESSAGE,
      action:     "branch_limitation",
      sources:    ["Section 4.1 · Extension branch pending Philip authoring · Option A 2026-08-01"],
      confidence: "partial-evidence",
      stageValue: stage,
    });
  }

  // Section 5.2 · Stage 1 threshold check
  // Philip 2026-08-01 · install_location satisfies the project_type gate for the
  // design-enquiry continuation path (customer entered via "have you got X stairs?"
  // and answered a physical-location question · never went through the mandatory
  // project_type gate).
  if ((state.project_type || state.install_location) && state.style && state.recommendation_stage === "none") {
    const rec = composeStageOne(state);
    if (rec) {
      state.recommendation_stage = "stage_1_direction";
      persistState(state);
      return shape(state, {
        text:              correctionAckPrefix + rec.text,
        action:            "stage_1_recommendation",
        sources:           rec.sources,
        confidence:        rec.confidence,
        stageValue:        stage,
        recommendationId:  rec.recommendation_id,
        images:            visualBrainImages,   // Philip 2026-08-01 · attach Visual Brain to design-enquiry Stage 1 responses
      });
    }
  }

  // G05 · If a correction fired but Stage 1 already emitted (recommendation_stage
  // is already stage_1_direction), we still want to acknowledge the change and
  // re-emit an updated Stage 1 direction reflecting the new state.
  if (corrections.length > 0 && (state.project_type || state.install_location) && state.style && state.recommendation_stage === "stage_1_direction") {
    const rec = composeStageOne(state);
    if (rec) {
      persistState(state);
      return shape(state, {
        text:              correctionAckPrefix + rec.text,
        action:            "stage_1_recommendation",
        sources:           rec.sources,
        confidence:        rec.confidence,
        stageValue:        stage,
        recommendationId:  rec.recommendation_id,
      });
    }
  }

  // Fallback verbatim retrieval when LLM composition wasn't tried (message
  // was preference-answer shaped) AND state didn't advance either.
  const stateAdvanced = Object.keys(updates).length > 0 || corrections.length > 0;
  if (!stateAdvanced && !isQuestionShaped) {
    const retrieved = retrieveTruth(message);
    if (retrieved) {
      persistState(state);
      return shape(state, {
        text:       retrieved.text,
        action:     "truth_retrieval",
        sources:    retrieved.sources,
        confidence: "evidence-backed",
        stageValue: stage,
        images:     visualBrainImages,
      });
    }
  }

  // Section 4.1 · ask next question
  const q = nextQuestion(state);
  if (q) {
    state.questions_asked_count += 1;
    // 5-turn cap
    if (state.questions_asked_count > 5) {
      state.handoff_reason = "flow_cap_reached";
      persistState(state);
      return shape(state, {
        text:       FIVE_TURN_HANDOFF_MESSAGE,
        action:     "flow_cap_handoff",
        sources:    ["Section 4.1 · flow rules · max 5 turns before handoff"],
        confidence: "evidence-backed",
        stageValue: stage,
      });
    }
    // T09 fix 2026-08-01 · if customer asked for images DURING Advisor flow,
    // prepend an honest acknowledgment before the next question · keeps
    // conversation progressing rather than stalling on an unmet ask.
    const imagePrefix = isImageRequest(message)
      ? "I can describe staircase styles for you — visual browsing isn't wired into this chat yet, but I can help you explore directions. "
      : "";
    // Track which decision we're asking so bare-word answers on next turn
    // ("glass" → balustrade=glass) can be extracted correctly · fix 2026-08-01.
    state.next_decision_required = q.key;
    persistState(state);
    return shape(state, {
      text:       correctionAckPrefix + imagePrefix + q.question_text,
      action:     "question",
      sources:    q.sources,
      confidence: "evidence-backed",
      stageValue: stage,
    });
  }

  // No question left AND no recommendation composed · advisor has nothing more
  // to add · fall through so the knowledge bridge can help.
  persistState(state);
  return null;
}
