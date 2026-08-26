// NEX Actions · type system · F1 (2026-08-25).
//
// This file is the type contract for the entire NEX Action platform. Every
// mascot in the tray — from a ❤️ reaction to a 💣 grenade — implements one
// of these interfaces. Nothing here executes. Handlers live in ./handlers/
// and the orchestrator lives in ./runtime/.
//
// God-object avoidance rule (Philip 2026-08-25 · locked):
//   · registry.ts declares WHAT actions exist (identity · tier · visual ·
//     capabilities · handlerKey · action-level cost requirement).
//   · runtime/ implements HOW they run (auth · rate limits · wallet · audit).
//   · handlers/ implements the specific EFFECT of each action.
//   · wallet/ owns commercial pricing (GBP · IDR · Stripe products · promos).
// A file may never import across these layers in a way that puts business
// logic inside the declarative catalog. Reviewer must reject any PR that
// adds functions to registry.ts.

// ── Tier ───────────────────────────────────────────────────────────────
export type NexActionTier =
  | "reaction"       // Tier 1 · lightweight expression · client-fast
  | "intelligence"   // Tier 2 · NEX composes a bubble (weather · currency · reminders)
  | "action"         // Tier 3 · NEX creates an interactive experience (venues · dates)
  | "consumable";    // Tier 4 · costs NEX Sparks · server-authoritative

// ── Mascot identity · the visual half of a NEX Action ──────────────────
export type NexMascotExpression =
  | "laugh" | "approve" | "boss" | "sunny" | "rainy" | "cozy" | "romantic"
  | "celebrate" | "birthday" | "explosive" | "confused" | "premium"
  | "generic";
export type NexActionMascot = {
  imageUrl: string;
  label: string;                 // ARIA / preview label · never truncated
  expression: NexMascotExpression;
};

// ── Landing + milestone animations · declarative reference to CSS ──────
export type NexBubbleAnimation =
  | "pop" | "drop" | "ripple" | "flyin" | "sparkle" | "wobble" | "glow" | "flip";
export type NexFullScreenEffect =
  | "confetti" | "fireworks" | "hearts";

// ── Capabilities · declarative permission requirements ─────────────────
// The runtime turns these into permission checks. Adding a capability to a
// mascot does NOT grant it — the runtime must recognise + gate it.
export type NexActionCapability =
  | "delete-own-message"        // grenade needs this
  | "delete-any-message"        // reserved for moderation · not exposed yet
  | "location:read"             // weather, all Tier-3 actions
  | "tool:weather"              // provider-agnostic weather tool
  | "tool:venues"               // provider-agnostic venue tool
  | "tool:currency"             // FX rates
  | "wallet:sparks:spend";      // any consumable

// ── Cost requirement · ACTION-LEVEL only ────────────────────────────────
// Philip 2026-08-25 · locked: commercial pricing (GBP · IDR · promos ·
// Stripe products) lives in the wallet layer. This field states only the
// abstract Sparks required to invoke the action. Free actions omit it.
export type NexActionCost = { sparks: number };

// ── Rate limiting · declarative · runtime enforces ─────────────────────
export type NexRateLimitScope = "second" | "minute" | "hour" | "day";
export type NexActionRateLimit = {
  per: NexRateLimitScope;
  max: number;
};

// ── The NexAction declarative row ──────────────────────────────────────
// This is the ENTIRE public contract of a mascot definition. Anything else
// (handler body, wallet math, provider choice, price in GBP) is elsewhere.
export type NexAction = {
  /** Stable unique id · never reuse · used as handlerKey lookup by default. */
  id: string;
  tier: NexActionTier;
  mascot: NexActionMascot;

  /** Runtime resolves this to a handler in ./handlers/<key>.ts. String, not
   *  function, so registry.ts never imports handler code (dependency
   *  cycle protection + keeps the registry compile-time cheap). */
  handlerKey: string;

  /** Static handler parameters baked into the definition. Runtime passes
   *  these to the handler alongside the runtime context. Useful when many
   *  actions share the same handler (e.g., all Tier-3 venue actions share
   *  "find-venue" with different category filters). */
  handlerParams?: Readonly<Record<string, unknown>>;

  /** Bubble-only landing animation · Tier 1-3 default to a soft "pop" ·
   *  Tier 4 (grenade) uses "drop" for cinematic entry. */
  animation?: NexBubbleAnimation;

  /** Full-screen milestone effect · omit unless the action is a milestone
   *  (celebration · birthday · anniversary). Never fires on every reaction. */
  fullScreen?: NexFullScreenEffect;

  /** Permission requirements · runtime enforces. */
  capabilities?: readonly NexActionCapability[];

  /** Sparks required to invoke · Tier 4 only. Commercial pricing (GBP · IDR)
   *  lives in the wallet layer · never here. */
  cost?: NexActionCost;

  /** Rate limit applied per user. Runtime returns 429 if exceeded. */
  rateLimit?: NexActionRateLimit;

  /** Audit severity for the log writer. "high" = irreversible / consumable ·
   *  "normal" = ephemeral. Grenade = high. Reaction = normal. */
  audit?: "high" | "normal";

  /** Optional grouping key for tray filtering (React · Ask NEX · Discover ·
   *  Special). Derived from tier by default but overridable. */
  section?: "react" | "ask-nex" | "discover" | "special";
};

// ── Runtime context · what the orchestrator hands to a handler ─────────
// Handlers see WHO invoked WHAT on WHICH target. They never touch wallet /
// audit / rate limit / permissions themselves — those are handled UPSTREAM
// by run.ts before the handler is called.
export type NexActionContext = {
  actionId: string;
  invokedAt: number;             // ms epoch
  user: { id: string; displayName: string };
  target?: { kind: "message"; messageId: string; conversationId: string };
  /** Convenience payload for handlers that need free-form params passed
   *  from the client (e.g., weather emoji doesn't need any, but a reminder
   *  emoji might need a target time). */
  clientPayload?: Readonly<Record<string, unknown>>;
};

// ── Handler contract ────────────────────────────────────────────────────
// Handlers live in ./handlers/<key>.ts and export a default matching this.
// Pure effect · returns a result the runtime translates into UI + audit.
export type NexActionHandler = {
  key: string;
  execute: (
    ctx: NexActionContext,
    params?: Readonly<Record<string, unknown>>,
  ) => Promise<NexActionResult>;
};

// ── Result envelope ─────────────────────────────────────────────────────
// Every action returns one of these · union type keeps consumers exhaustive.
export type NexActionResult =
  | { ok: true; kind: "noop" }                                        // reactions
  | { ok: true; kind: "message-posted"; messageId: string }          // intelligence
  | { ok: true; kind: "message-deleted"; messageId: string; historyLine: string } // grenade
  | { ok: true; kind: "interactive"; messageId: string; expiresAt?: number }       // actions
  | { ok: false; error: NexActionError };

export type NexActionError =
  | { code: "unauthorised" }
  | { code: "forbidden"; reason: string }
  | { code: "rate-limited"; retryAfterSec: number }
  | { code: "insufficient-sparks"; required: number; balance: number }
  | { code: "handler-not-found"; handlerKey: string }
  | { code: "handler-failed"; message: string };
