// Platform AI Cost Router.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Cost routing is a platform concern. If each App
//    picked its own model, we'd have inconsistent budgets, no
//    per-tier quotas, and no way to swap models globally without
//    App changes.
//
// 2. Which future Apps benefit?  Every App that ships AI tools —
//    which is every App per §7 of PLATFORM_ARCHITECTURE.
//
// 3. Which doc authorises?  ADR-052 + TRADE_CENTER_2_SPEC.md §19.5
//    "AI as infrastructure — cost routing" + PLATFORM_ARCHITECTURE
//    §7 "AI Platform Service".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Route by task class, not by App. Simple lookups → Haiku (fast +
// cheap). Reasoning + business advice → Opus. Voice → Whisper.
// Image gen → only on explicit user request.
//
// Classifier is a pure function of the incoming request. Real
// classification uses Haiku itself in production (ADR-052b); Week 4
// ships a heuristic classifier for the demo.

export type ModelTier =
  | "haiku"    // fast + cheap — palette intent, fuzzy search, simple Q&A
  | "opus"     // reasoning — estimator, business advice, complex Q&A
  | "whisper"  // voice-to-text
  | "image";   // image generation (rare, explicit only)

export type TaskClass =
  | "intent_classification"   // "did the user want a product, a merchant, an action?"
  | "product_recommendation"  // "find alternatives for this trowel"
  | "product_search"          // "what plaster do I need for a 3m wall?"
  | "business_advice"         // "how do I price this job?"
  | "estimator"               // "how many bags of plaster for 25 sqm?"
  | "quote_generation"        // "draft a quote for this job list"
  | "voice_transcription"     // WebRTC recording
  | "image_generation"        // explicit user request only
  | "unknown";                // fallback → route to Haiku

export type RouteInput = {
  taskClass?: TaskClass;
  /** Raw prompt text — used by the heuristic classifier. */
  prompt?: string;
  /** Tools available for this dispatch. */
  toolCount?: number;
  /** Requested tier (Enterprise may pin Opus). */
  requestedTier?: ModelTier;
  /** User's platform tier — Free/Professional/Enterprise. Free
   *  users default to Haiku regardless of task class. */
  userTier?: "free" | "professional" | "enterprise";
};

export type RouteDecision = {
  model: ModelTier;
  reason: string;
  taskClass: TaskClass;
};

// ─── Heuristic classifier ────────────────────────────────────

/** Classify a prompt into a task class. Real classifier calls Haiku
 *  itself; this heuristic runs in-process at zero cost and is good
 *  enough for the demo + telemetry. */
export function classifyTaskClass(input: RouteInput): TaskClass {
  if (input.taskClass) return input.taskClass;

  const prompt = (input.prompt ?? "").toLowerCase();
  if (!prompt) return "unknown";

  // Ordered from most specific → least
  if (/how many|estimate|calculate|sqm|square metre|bags of/.test(prompt)) {
    return "estimator";
  }
  if (/quote|invoice|labour|markup/.test(prompt)) {
    return "quote_generation";
  }
  if (/alternative|cheaper|comparable|instead of/.test(prompt)) {
    return "product_recommendation";
  }
  if (/how much|price|charge|pricing|competitor/.test(prompt)) {
    return "business_advice";
  }
  if (/find|show me|search|list|browse/.test(prompt)) {
    return "product_search";
  }
  if (/^what$|^which$|^who$|^intent/.test(prompt)) {
    return "intent_classification";
  }
  return "unknown";
}

// ─── Route ───────────────────────────────────────────────────

export function route(input: RouteInput): RouteDecision {
  const taskClass = classifyTaskClass(input);
  const userTier = input.userTier ?? "professional";

  // Free tier is Haiku-only, per §19.5
  if (userTier === "free") {
    return {
      model: "haiku",
      reason: "free_tier_haiku_only",
      taskClass
    };
  }

  // Enterprise pin
  if (input.requestedTier && userTier === "enterprise") {
    return {
      model: input.requestedTier,
      reason: "enterprise_pinned",
      taskClass
    };
  }

  // Task-class based routing
  switch (taskClass) {
    case "voice_transcription":
      return { model: "whisper", reason: "voice_needs_whisper", taskClass };
    case "image_generation":
      return { model: "image", reason: "explicit_image_gen", taskClass };
    case "business_advice":
    case "estimator":
    case "quote_generation":
      return { model: "opus", reason: "reasoning_needs_opus", taskClass };
    case "intent_classification":
    case "product_recommendation":
    case "product_search":
    case "unknown":
      return { model: "haiku", reason: "haiku_sufficient", taskClass };
  }
}
