// src/lib/nex/brain/capabilities.ts
//
// Stage 3.9 · Brain Capability Registry (Philip 2026-08-31).
//
// ONE NEX Brain. Named cognitive capabilities inside it. This module
// is the canonical registry — every capability has a stable id, a
// status (GREEN / PARTIAL / MISSING), the files that implement it, and
// (when active) the trigger that activates it.
//
// The registry is CONSUMED by the orchestrator via `recordActivation`
// so every turn produces an audit trail of which capabilities the
// Brain actually exercised. That trail is returned in the response
// under `metrics.brain_capabilities` for debug / HQ.
//
// Anti-pattern this replaces: capabilities living implicitly in
// composers and comments. Now every claim like "NEX has Insight" is
// backed by a registry entry + activation trace.

export type BrainCapability =
  | "perception"
  | "intent"
  | "context"
  | "memory"
  | "world_knowledge"
  | "reasoning"
  | "goal_tracking"
  | "planning"
  | "decision"
  | "insight"
  | "curiosity"
  | "smart_questioning"
  | "prediction"
  | "reflection"
  | "confidence"
  | "truth_honesty"
  | "attention"
  | "conversation_control"
  | "tone"
  | "personalization"
  | "creativity"
  | "problem_solving"
  | "tool_selection"
  | "action"
  | "verification"
  | "learning"
  | "safety"
  | "commerce"
  | "negotiation"
  | "time_awareness"
  | "spatial_awareness"
  | "social_context"
  | "self_awareness"
  | "initiative"
  | "meta_cognition"
  | "entity_intelligence"
  | "reference_resolution"
  | "comparison"
  | "recommendation"
  | "governance"
  | "adaptation"
  | "long_term_memory"
  | "personality";

export type CapabilityStatus = "GREEN" | "PARTIAL" | "MISSING";

export type CapabilityRecord = {
  id: BrainCapability;
  name: string;
  baby: string; // one-line "baby words" description
  status: CapabilityStatus;
  files: string[];
  activatesWhen?: string;
  notes?: string;
};

// ─── Registry (single source of truth) ────────────────────────────────

const REGISTRY: readonly CapabilityRecord[] = [
  { id: "perception",           name: "Perception",           baby: "See/hear input",
    status: "PARTIAL",
    files: ["src/lib/nex-voice/useNexVoice.ts", "src/app/api/nex-conv/chat/route.ts"],
    notes: "Text ✅ · voice ✅ (STT via browser) · image bytes never reach Brain yet" },
  { id: "intent",               name: "Intent",               baby: "What do they want?",
    status: "GREEN",
    files: ["src/lib/nex/conversation-intent.ts"],
    activatesWhen: "every turn" },
  { id: "context",              name: "Context",              baby: "What's happening?",
    status: "GREEN",
    files: ["src/lib/nex/brain/session.ts"],
    activatesWhen: "when conversationId is present" },
  { id: "memory",               name: "Memory",               baby: "Remember slots",
    status: "GREEN",
    files: ["src/lib/nex/brain/accommodation-slots.ts", "src/lib/nex/brain/session.ts"],
    activatesWhen: "accommodation intent + conversationId" },
  { id: "world_knowledge",      name: "World Knowledge",      baby: "Retrieve grounded facts",
    status: "GREEN",
    files: ["src/lib/nex/indonesia/knowledge.ts", "src/lib/nex/indonesia/commerce/retrieval.ts"],
    activatesWhen: "knowledge / accommodation / food / tourism / commerce intents" },
  { id: "reasoning",            name: "Reasoning",            baby: "Think through it",
    status: "PARTIAL",
    files: ["src/lib/nex/brain/orchestrate.ts"],
    notes: "Deterministic reasoning inside composer · no explicit reasoning step" },
  { id: "goal_tracking",        name: "Goal Tracking",        baby: "Don't lose the mission",
    status: "GREEN",
    files: ["src/lib/nex/brain/goal-tracking.ts", "src/lib/nex/brain/session.ts"],
    activatesWhen: "any turn with conversationId (creates/updates/pauses/resumes goal)",
    notes: "Stage 3.9 Phase 2 · explicit Goal object + state machine + resume prompt" },
  { id: "planning",             name: "Planning",             baby: "Break request into steps",
    status: "GREEN",
    files: ["src/lib/nex/brain/planning.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · builds accommodation plan from current state (v1 accommodation-only)",
    notes: "Stage 3.29 · deterministic multi-step plan builder above Insight · 8 step kinds: narrow_location · narrow_type · narrow_budget · narrow_area · present_candidates · resolve_reference · confirm_action · complete · Each step: number+kind+description+status(done/current/pending)+reason · currentStepIndex marks NEX's position · Observational v1 (UI/audit can render plan · doesn't auto-execute)" },
  { id: "decision",             name: "Decision",             baby: "Choose best next action",
    status: "GREEN",
    files: ["src/lib/nex/brain/insight.ts", "src/lib/nex/brain/orchestrate.ts"] },
  { id: "insight",              name: "Insight",              baby: "Notice something useful",
    status: "GREEN",
    files: ["src/lib/nex/brain/insight.ts"],
    activatesWhen: "accommodation intent (v1 vertical)" },
  { id: "curiosity",            name: "Curiosity",            baby: "Want to know more",
    status: "GREEN",
    files: ["src/lib/nex/brain/insight.ts"],
    notes: "Realised as Insight's useful_preference + learning_gap signals" },
  { id: "smart_questioning",    name: "Smart Questioning",    baby: "Ask ONE best question",
    status: "GREEN",
    files: ["src/lib/nex/brain/insight.ts"] },
  { id: "prediction",           name: "Prediction",           baby: "Anticipate next need",
    status: "GREEN",
    files: ["src/lib/nex/brain/prediction.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every accommodation turn · reads slot state + this turn's outcomes (comparison/recommendation/action/boundary) · produces 0-3 candidate next actions",
    notes: "Stage 3.23 · deterministic rules · 10 prediction kinds: narrow_area · narrow_budget · narrow_type · narrow_amenities · widen_search · compare · recommend · book_reference · contact_seller · next_related_task · confidence levels low/med/high · never fabricates a hint the state doesn't support · v1 observational (composer text unchanged) · v2 could surface predictions as suggestion pills" },
  { id: "reflection",           name: "Reflection",           baby: "Check yourself",
    status: "GREEN",
    files: ["src/lib/nex/brain/reflection.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · runs after composer, before return",
    notes: "Stage 3.10 · CONSTITUTIONAL · 5 checks: answersUserMessage · internallyConsistent · hasEvidenceForClaims · respectsHonestBoundary · respectsMarketBoundary · v1 observational (attaches report · doesn't rewrite reply)" },
  { id: "confidence",           name: "Confidence",           baby: "How sure am I?",
    status: "GREEN",
    files: ["src/lib/nex/brain/confidence.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · reply is classified into evidence types + overall level",
    notes: "Stage 3.11 · CONSTITUTIONAL pair with Truth + Reflection · levels: high | medium | low | unavailable · v1 observational (attaches report · doesn't hedge reply text)" },
  { id: "truth_honesty",        name: "Truth / Honesty",      baby: "Don't fabricate",
    status: "GREEN",
    files: ["src/lib/nex/brain/orchestrate.ts", "src/lib/nex/indonesia/commerce/validators.ts"],
    notes: "Provenance · honest boundaries · geographic area filter · strict type filter · nullable price/stock" },
  { id: "attention",            name: "Attention",            baby: "What matters right now?",
    status: "GREEN",
    files: ["src/lib/nex/brain/attention.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · ranks slots · entities · goal by attention score",
    notes: "Stage 3.28 · deterministic scorer · Slots: base 1.0 + introduced (+0.6) + corrected (+0.4) · Entities: base 0.8 + resolved reference (+1.2) + user-message mention (+0.5) · Goal: active 1.5 · resumed 1.3 · paused 0.8 · completed 0.3 · abandoned 0.2 · Returns top-K (default 5) sorted desc · Observational v1 · future consumers: composer default reference · Insight preferred question focus · Personalization weighting" },
  { id: "conversation_control", name: "Conversation Control", baby: "Ask, answer or stay silent",
    status: "GREEN",
    files: ["src/lib/nex/brain/orchestrate.ts", "src/lib/nex/brain/insight.ts"] },
  { id: "tone",                 name: "Tone / Emotional",     baby: "Read the room",
    status: "MISSING", files: [] },
  { id: "personality",          name: "Personality",          baby: "Configurable voice/register",
    status: "GREEN",
    files: ["src/lib/nex/brain/personality.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · post-processes reply text based on personalityProfile option (default: friendly)",
    notes: "Stage 3.30 · Three profiles: friendly (default passthrough) · concise (strips fillers) · professional (casual→neutral verbs) · NEVER touches numbers/names/entities/boundaries · Truth doctrine preserved · Bounded regex transformations only · Attached PersonalityReport for audit trail" },
  { id: "personalization",      name: "Personalization",      baby: "Know the person",
    status: "GREEN",
    files: ["src/lib/nex/brain/personalization.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn when userId + consent granted AND LTM has interactionCount ≥ 2",
    notes: "Stage 3.27 · consumer of Long-Term Memory · Fires only when returning user (interactionCount ≥ 2) with at least one preference of count ≥ 2 · Surfaces greeting on FIRST accommodation turn of new conversation only (avoids spam) · Marks preferences as reinforced when LTM value matches current session slot · Never fabricates preferences the LTM doesn't hold · Composer optionally prepends greeting to reply · v1 signal: returning_user_ack | preference_reinforced | none"  },
  { id: "creativity",           name: "Creativity",           baby: "Come up with ideas",
    status: "MISSING", files: [] },
  { id: "problem_solving",      name: "Problem Solving",      baby: "Fix things",
    status: "MISSING", files: [] },
  { id: "tool_selection",       name: "Tool Selection",       baby: "Which tool?",
    status: "GREEN",
    files: ["src/lib/nex/brain/tool-selection.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · emits ToolDecision BEFORE composer runs",
    notes: "Stage 3.18 · deterministic decision function · tools: world_retrieval (available) · commerce_retrieval (declared_not_wired · Stage 4 data model exists) · live_source (declared_not_wired · BMKG) · calculator (declared) · user_action (declared_not_wired · needs Action layer) · none · availability field never fabricates a tool call · book intent on resolved reference maps to user_action honestly" },
  { id: "action",               name: "Action / Execution",   baby: "Do it",
    status: "GREEN",
    files: ["src/lib/nex/brain/action.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "accommodation turn with resolved reference · proposes action + safely executes (v1 only open_directory link generation)",
    notes: "Stage 3.21 · CONSTITUTIONAL boundary · consumes Reference Resolution (target) + Tool Selection (routing) + Governance (consent) · v1 action kinds declared: open_directory (available) · contact_via_whatsapp/email_seller (requires_data · seller contact not in commerce records yet) · save_to_list (needs long_term_memory) · book_now/add_to_cart (needs payment/commerce session) · NEVER claims execution success that didn't happen · consent_gated actions surface proposal + linkPreview only" },
  { id: "verification",         name: "Verification",         baby: "Did it work?",
    status: "GREEN",
    files: ["src/lib/nex/brain/verification.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn after Action · confirms execution matched intent",
    notes: "Stage 3.22 · CONSTITUTIONAL fifth · closes honesty five loop (Truth · Reflection · Confidence · Meta-Cognition · Learning · Verification) · 4 checks: target_consistency · link_round_trip · kind_matches_proposal · capability_registered · Reports applicable=false honestly when nothing executed (never claims pass/fail on non-events) · Consumed by Meta-Cognition's didItWork · future transaction verification lands with Stage 6 payment integration" },
  { id: "learning",             name: "Learning / Feedback",  baby: "Get better over time",
    status: "GREEN",
    files: ["src/lib/nex/brain/learning.ts", "src/lib/nex/brain/insight-gaps.ts", "src/lib/nex/indonesia/gaps/gap-registry.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "insight_gap_detected · slot_correction_observed · reflection_failure · confidence_low",
    notes: "Stage 3.13 · rolling ledger (200 entries · in-memory globalThis) · consumed by Meta-Cognition's whatILearned · gaps also persisted to GapRegistry for workforce prioritisation · v2 will add feedback ingestion loop" },
  { id: "safety",               name: "Safety",               baby: "Don't do dangerous things",
    status: "GREEN",
    files: ["src/lib/nex/safety.ts"],
    activatesWhen: "highest priority · runs before every other capability" },
  { id: "commerce",             name: "Commerce",             baby: "Sellers / products / offers",
    status: "GREEN",
    files: ["src/lib/nex/brain/commerce-composer.ts", "src/lib/nex/indonesia/commerce/types.ts", "src/lib/nex/indonesia/commerce/retrieval.ts", "src/lib/nex/brain/orchestrate.ts", "src/lib/nex/conversation-intent.ts"],
    activatesWhen: "user message hits COMMERCE regex (buy me headphones · cari laptop · order a phone · etc)",
    notes: "Stage 3.19 · commerce Brain intent wired · classifier + commerce composer + Tool Selection routing (commerce_retrieval now availability=available for commerce intent) · Composer uses Stage 4 findProducts + findOffers + joinOffers · When corpus empty (files start empty per Stage 4 doctrine) reply honestly says no listings yet + acquisition pipeline ready · Never fabricates product/seller/offer" },
  { id: "negotiation",          name: "Negotiation",          baby: "Trade-offs",
    status: "MISSING", files: [] },
  { id: "time_awareness",       name: "Time Awareness",       baby: "When?",
    status: "PARTIAL",
    files: ["src/lib/nex/brain/accommodation-slots.ts"],
    notes: "Date extractor captures 'tonight' · no temporal reasoning" },
  { id: "spatial_awareness",    name: "Spatial Awareness",    baby: "Where?",
    status: "PARTIAL",
    files: ["src/lib/nex/brain/orchestrate.ts", "src/lib/nex/brain/accommodation-slots.ts"],
    notes: "Area extractor + haversine geo filter ✅ · no route / distance-to-user reasoning" },
  { id: "social_context",       name: "Social Context",       baby: "Relationships / groups",
    status: "MISSING", files: [] },
  { id: "self_awareness",       name: "Self-awareness",       baby: "Know own capabilities",
    status: "GREEN",
    files: ["src/lib/nex/brain/capabilities.ts"],
    notes: "This module IS the self-awareness · Brain can introspect its capabilities" },
  { id: "initiative",           name: "Initiative",           baby: "Take next useful step",
    status: "GREEN",
    files: ["src/lib/nex/brain/initiative.ts", "src/lib/nex/brain/orchestrate.ts", "src/lib/nex/brain/session.ts"],
    activatesWhen: "every gated-reply turn after Prediction · decides whether to volunteer the top prediction",
    notes: "Stage 3.24 · consumer of Prediction · 5 suppression gates: no prediction · session cap (default 3) · confidence < high · composer already asked (?)  · already proactive (comparison/recommendation/action) · Persists sessionCount in SessionState.initiativeCount · Rate-limited per conversation · never spams · v1 attaches decision to response (composer text unchanged · UI/Speaking surfaces suggestion as pill/voice)" },
  { id: "meta_cognition",       name: "Meta-Cognition",       baby: "What do I know? · How sure? · Am I wrong?",
    status: "GREEN",
    files: ["src/lib/nex/brain/meta-cognition.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · runs after Reflection + Confidence · composes them + Truth + Goal into a self-awareness summary",
    notes: "Stage 3.12 · CONSTITUTIONAL umbrella · composes Truth + Reflection + Confidence · v1 answers whatIKnow / howSure / amIWrong / whatShouldIDo · Learning ingestion (Stage 3.13) added whatILearned · Entity roll-up (Stage 3.14) added entitiesSeen" },
  { id: "entity_intelligence",  name: "Entity Intelligence",  baby: "Identify people/places/products/dates",
    status: "GREEN",
    files: ["src/lib/nex/brain/entities.ts", "src/lib/nex/brain/session.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every accommodation turn · extracts entities from user message + captures businesses NEX presented · persists rolling window to session · surfaced in Meta-Cognition's whatIKnow.entitiesSeen",
    notes: "Stage 3.14 · deterministic bilingual EN+ID · kinds: place · area · business_name · ordinal · pronoun · date_ref · quantity · phone · email · url · money · Foundation for Reference Resolution / Comparison / Recommendation" },
  { id: "reference_resolution", name: "Reference Resolution",  baby: "\"the second one\" · \"book it\" · \"yang kedua\"",
    status: "GREEN",
    files: ["src/lib/nex/brain/reference-resolution.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every accommodation turn · resolves this turn's ordinals/pronouns against the session's presented-business window",
    notes: "Stage 3.15 · deterministic · ordinals map to 1-indexed offsets in the most-recent presentation batch · pronouns resolve ONLY when batch size is 1 (unambiguous) · never guesses · session.currentReference exposed via HTTP + Meta-Cognition · composer acknowledges resolved reference on book intent" },
  { id: "comparison",           name: "Comparison",            baby: "Compare 2-3 candidates side by side",
    status: "GREEN",
    files: ["src/lib/nex/brain/comparison.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "accommodation turn with 'compare'/'vs'/'bandingkan'/'difference between' or ≥2 ordinals",
    notes: "Stage 3.16 · deterministic · attributes: name · type · area_proximity (haversine to known centroids) · coords · provenance · Honest boundaries surfaced for price/rating/amenities/availability/reviews · 2-3 candidates · falls back to top-N of most-recent batch when no ordinals given" },
  { id: "recommendation",       name: "Recommendation",        baby: "Evidence-based ranking with a defensible reason",
    status: "GREEN",
    files: ["src/lib/nex/brain/recommendation.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "accommodation turn with 'recommend'/'which is best'/'your pick'/'rekomendasi'/'pilihkan'",
    notes: "Stage 3.17 · consumer of Comparison + Entity Intelligence · ranks by area proximity (haversine to slot area centroid) with retrieval-position fallback · never claims 'best' without a reason · surfaces tie-break prompt when top two candidates within 100m · honestly acknowledges what it can't rank (price/rating/amenities/availability/reviews)" },
  { id: "governance",           name: "Governance",            baby: "Permissions + policy audit",
    status: "GREEN",
    files: ["src/lib/nex/brain/governance.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn · audits which permissions this turn exercised against the active policy",
    notes: "Stage 3.20 · CONSTITUTIONAL · 11 permission types: read.world_knowledge · read.commerce · read.session · write.session · write.workforce_gap · write.learning_ledger · write.long_term_memory · execute.user_action · call.live_source · call.external_llm · read.image_bytes · Default policy allows safe reads/writes · requires_consent for long_term_memory/user_action/image_bytes · Unblocks Action + Verification + Long-Term Memory + Perception when their consent gates land · Never fabricates permissions the caller didn't declare · Unknown permissions default to deny" },
  { id: "long_term_memory",     name: "Long-Term Memory",     baby: "Remember across sessions",
    status: "GREEN",
    files: ["src/lib/nex/brain/long-term-memory.ts", "src/lib/nex/brain/orchestrate.ts", "src/lib/nex/brain/governance.ts"],
    activatesWhen: "every gated-reply turn when userId + consent.long_term_memory both present",
    notes: "Stage 3.26 · cross-session preference store · keyed by opaque userId · Consent-gated by Governance (default policy write.long_term_memory=require_consent · consent grant flips to allow) · Reads + writes preferences derived from accommodation slots (location · type · budget · area) with frequency counts · Bubble-up algorithm: most-often-picked value wins · When userId absent OR consent not granted → LTM inactive (honest null in response) · Foundation for Personalization (future) · v1 in-memory globalThis-bound (HMR-safe) · Postgres persistence lands with user-auth wiring" },
  { id: "adaptation",           name: "Adaptation",            baby: "Get better from validated feedback",
    status: "GREEN",
    files: ["src/lib/nex/brain/adaptation.ts", "src/lib/nex/brain/orchestrate.ts"],
    activatesWhen: "every gated-reply turn after Initiative · reads Learning ledger for this conversation",
    notes: "Stage 3.25 · closes second loop (Learning → Adaptation) · 4 pattern kinds: repeated_gap_scope (≥2 same-scope gaps) · frequent_corrections (≥2 slot changes) · recurring_reflection_failure (≥2 same-check failures) · persistent_low_confidence (≥3 low-conf turns) · Reads recentLearningForConversation() · window 20 · v1 observational · attaches AdaptationReport{signals[],hasSignals,summary} · v2 composer would consume adjustments to actually change reply text · Bounded thresholds prevent noise" },
];

export function listCapabilities(): readonly CapabilityRecord[] {
  return REGISTRY;
}

export function getCapability(id: BrainCapability): CapabilityRecord | undefined {
  return REGISTRY.find((c) => c.id === id);
}

export function capabilitiesByStatus(status: CapabilityStatus): CapabilityRecord[] {
  return REGISTRY.filter((c) => c.status === status);
}

export function capabilitySummary(): { GREEN: number; PARTIAL: number; MISSING: number; total: number } {
  const s = { GREEN: 0, PARTIAL: 0, MISSING: 0, total: REGISTRY.length };
  for (const c of REGISTRY) s[c.status]++;
  return s;
}

// ─── Per-turn activation trace ───────────────────────────────────────
//
// Not persisted · scoped to a single turn. The orchestrator creates a
// fresh trace at turn start, records activations along the way, and
// returns it under metrics.brain_capabilities so every reply carries
// an honest audit of what the Brain actually did.

export type ActivationEvent = {
  capability: BrainCapability;
  reason: string;
  atMs: number;
};

export class ActivationTrace {
  private readonly events: ActivationEvent[] = [];
  private readonly startedAt: number = Date.now();

  record(capability: BrainCapability, reason: string): void {
    this.events.push({ capability, reason, atMs: Date.now() - this.startedAt });
  }

  activated(capability: BrainCapability): boolean {
    return this.events.some((e) => e.capability === capability);
  }

  list(): readonly ActivationEvent[] {
    return this.events;
  }

  summary(): { capabilities: BrainCapability[]; count: number; totalMs: number } {
    const set = new Set(this.events.map((e) => e.capability));
    return {
      capabilities: [...set],
      count: set.size,
      totalMs: Date.now() - this.startedAt,
    };
  }
}
