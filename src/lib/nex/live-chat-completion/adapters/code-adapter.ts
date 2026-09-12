// src/lib/nex/live-chat-completion/adapters/code-adapter.ts
//
// Founder BEGIN 2026-09-10 · CODE domain adapter · Phase 2 of NEX language work.
//
// Programming is a domain OF NEX, not owned by NEX1. NEX1 is the software-
// engineering ROLE of NEX. This adapter lets NEX Chat answer code-domain
// questions from the same conversational surface as accommodation / food /
// etc — and, for operational asks ("create a migration"), route the founder
// to the nex-agent submit endpoint that runs the full plan+review pipeline.
//
// Deterministic · zero LLM · zero third-party. All trust flows through the
// existing contract (known / unknown / requested tri-state · TrustBand).
//
// Post-ADR-0308: the temporary code-intent-registry seed is replaced by
// resolveConcept() reading nex.concept_senses. The API surface here stays.

import type { DomainAdapter, AdapterTurnInput, AdapterReply } from "../contract";
import { parseIntent } from "@/lib/nex/language/intent-parser";
import { CODE_INTENT_REGISTRY } from "@/lib/nex-agent/language/code-intent-registry";
import { resolveConcept, fetchAnswerForSense } from "@/lib/nex/language/concept-resolver";
import { matchQuestion } from "@/lib/nex/language/question-resolver";
import { normalise } from "@/lib/nex/language/normaliser";

const CODE_TRIGGER_RE = /\b(code|codebase|programme|program|programming|migration|schema|table|column|endpoint|api|route|route\.ts|typescript|javascript|react|refactor|bug|broken|not working|error|stack trace|commit|branch|worktree|test|tests|vitest|postgres|postgresql|sql|git|nex1|chuck in|bung in|knock up|sort out|walk me through|run me through|what can you do|what does|what is|meaning of|define|explain)\b/i;

// Meta intents are answered directly by this adapter · not routed to nex-agent.
const META_INTENTS = new Set(["capabilities", "small_talk", "explain_error"]);
// Operational intents route founders to /api/nex/agent/submit for real work.
const OPERATIONAL_INTENTS = new Set(["add_feature", "fix_bug", "refactor", "add_migration", "add_api_route", "add_test"]);
// Explain intent · we can attempt a definition (until nex.concept_senses lands).
const EXPLAIN_INTENTS = new Set(["explain"]);

/**
 * Adapter that surfaces code-domain answers over the shared chat contract.
 * Until nex.concept_senses is seeded, definitional questions ("what is a
 * migration?") honestly return unknown so the knowledge-gap queue picks
 * them up. Meta questions ("what can you do?") answer from a small,
 * hand-curated capability list that IS canonical about nex1 itself.
 */
export function makeCodeAdapter(): DomainAdapter {
  return {
    domain: "code",

    async canHandle(input: AdapterTurnInput): Promise<boolean> {
      return CODE_TRIGGER_RE.test(String(input.message ?? ""));
    },

    async compose(input: AdapterTurnInput): Promise<AdapterReply> {
      const t0 = performance.now();
      const message = String(input.message ?? "").trim();

      // ── Layer 2 · question pattern match (nex.questions) ──────
      // Longer / more specific patterns win. If a strong pattern matches,
      // its intent_slug beats trigger-token scoring.
      let intentSlug = "unknown";
      let entityFromPattern: string | null = null;
      let questionPatternHit: Awaited<ReturnType<typeof matchQuestion>> = null;
      try {
        questionPatternHit = await matchQuestion(message, 0.85);
      } catch { /* soft-fail · fall back to Layer 1 */ }

      // ── Layer 1 · trigger-token scoring (fallback / cross-check) ──
      const parsed = parseIntent(message, { intents: CODE_INTENT_REGISTRY, minConfidence: 0.2 });
      if (questionPatternHit) {
        intentSlug = questionPatternHit.intent_slug;
        entityFromPattern = questionPatternHit.entities.entity ?? questionPatternHit.entities.path ?? null;
      } else {
        intentSlug = parsed.intent_slug ?? "unknown";
      }
      const triggers = parsed.trigger_matches.slice(0, 5);

      // ── Meta · capabilities · small_talk ────────────────────────
      if (META_INTENTS.has(intentSlug) || intentSlug === "capabilities") {
        const body = replyForMeta(intentSlug);
        return {
          answered: true,
          reply_text: body,
          reply_kind: "fact",
          trust: "canonical_verified",
          intent_slug: intentSlug,
          entity_ref: null,
          known: [{ kind: intentSlug, value: body.slice(0, 200), trust: "canonical_verified" }],
          unknown: [],
          requested: [],
          reasoning: [`code_adapter · meta answer for ${intentSlug} · triggers=${triggers.join(",")}`],
          latency_ms: Math.round(performance.now() - t0),
        };
      }

      // ── Operational · route to nex-agent submit ─────────────────
      if (OPERATIONAL_INTENTS.has(intentSlug)) {
        const body = replyForOperational(intentSlug, message);
        return {
          answered: true,
          reply_text: body,
          reply_kind: "fact",
          trust: "canonical_verified",
          intent_slug: intentSlug,
          entity_ref: null,
          known: [{ kind: `${intentSlug}_route_hint`, value: "/api/nex/agent/submit", trust: "canonical_verified" }],
          unknown: [],
          requested: [],
          reasoning: [`code_adapter · operational → nex-agent · intent=${intentSlug}`],
          latency_ms: Math.round(performance.now() - t0),
        };
      }

      // ── Explain · post-ADR-0308 · nex.concept_senses is authoritative ─
      // Layer 2 pattern gave us the entity directly if available · use it.
      // Otherwise fall back to token scanning.
      if (EXPLAIN_INTENTS.has(intentSlug)) {
        const norm = normalise(message);
        let resolved = null as Awaited<ReturnType<typeof resolveConcept>>;
        let tried: string[] = [];
        // Priority 1: entity extracted from a nex.questions surface pattern
        if (entityFromPattern) {
          const entityNorm = normalise(entityFromPattern);
          for (const tok of entityNorm.canonical_tokens) {
            tried.push(tok);
            const attempt = await resolveConcept(tok, { cooccur_tokens: norm.canonical_tokens, domain_hint: ["programming"] });
            if (attempt) { resolved = attempt; break; }
          }
        }
        // Priority 2: token scan across the whole prompt
        if (!resolved) {
          const EXPLAIN_VERBS = new Set(["explain", "what", "mean", "means", "is", "does", "how", "walk", "run", "person", "database"]);
          const candidateTokens = norm.canonical_tokens.filter(t => !EXPLAIN_VERBS.has(t));
          const cooccur = norm.canonical_tokens.filter(t => t !== message.toLowerCase());
          for (const tok of candidateTokens) {
            tried.push(tok);
            const attempt = await resolveConcept(tok, { cooccur_tokens: cooccur, domain_hint: ["programming"] });
            if (attempt) { resolved = attempt; break; }
          }
        }
        if (resolved && resolved.chosen_sense) {
          // If Layer 2 pattern said the founder wants steps, fetch the
          // steps answer specifically · fallback to any authoritative answer.
          const preferKind = questionPatternHit?.answer_type ?? undefined;
          const ans = await fetchAnswerForSense(resolved.chosen_sense.sense_id, preferKind);
          if (ans) {
            return {
              answered: true,
              reply_text: ans.body,
              reply_kind: "fact",
              trust: "canonical_verified",
              intent_slug: intentSlug,
              entity_ref: `concept:${resolved.canonical_key}#${resolved.chosen_sense.sense_key}`,
              known: [{ kind: `concept_${ans.answer_kind}`, value: ans.body.slice(0, 200), trust: "canonical_verified" }],
              unknown: [],
              requested: [],
              reasoning: [
                `code_adapter · resolved concept=${resolved.canonical_key} sense=${resolved.chosen_sense.sense_key} sense_id=${resolved.chosen_sense.sense_id}`,
                `answer_kind=${ans.answer_kind} preferred=${preferKind ?? "none"}`,
                `context_signals=${resolved.context_signals_used.join(",")}`,
                `hot_tier_hit=${resolved.hot_tier_hit}`,
              ],
              latency_ms: Math.round(performance.now() - t0),
            };
          }
        }
        // Ambiguous · fall through to clarify
        if (resolved && !resolved.chosen_sense && resolved.ambiguous) {
          const senseList = resolved.candidate_senses.map(s => s.sense_key).join(" · ");
          return {
            answered: true,
            reply_text: `I know '${resolved.canonical_key}' has several meanings: ${senseList}. Which one did you have in mind?`,
            reply_kind: "clarify",
            trust: "mixed",
            intent_slug: intentSlug,
            entity_ref: `concept:${resolved.canonical_key}`,
            known: [{ kind: "concept_ambiguous", value: senseList.slice(0, 200), trust: "mixed" }],
            unknown: [],
            requested: [],
            reasoning: [`code_adapter · resolved concept=${resolved.canonical_key} · ambiguous · ${resolved.candidate_senses.length} senses`],
            latency_ms: Math.round(performance.now() - t0),
          };
        }
        // No concept found · honest unknown · gap ticket candidate
        return {
          answered: false,
          reply_text: "",
          reply_kind: "unknown",
          trust: "unknown",
          intent_slug: intentSlug,
          entity_ref: null,
          known: [],
          unknown: [{ kind: "concept_definition", trust: "unknown" }],
          requested: [],
          reasoning: [`code_adapter · explain intent · no concept found · tried=${tried.join(",")}`],
          latency_ms: Math.round(performance.now() - t0),
        };
      }

      // ── Fallback · low-confidence · flag as unknown ─────────────
      return {
        answered: false,
        reply_text: "",
        reply_kind: "unknown",
        trust: "unknown",
        intent_slug: null,
        entity_ref: null,
        known: [],
        unknown: [{ kind: "code_intent", trust: "unknown" }],
        requested: [],
        reasoning: [`code_adapter · no confident intent · triggers=${triggers.join(",")} · candidates=${parsed.candidate_intents.slice(0,3).map(c => c.slug + ":" + c.score).join(",")}`],
        latency_ms: Math.round(performance.now() - t0),
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Canonical meta answers · what NEX1 can currently do
// ═══════════════════════════════════════════════════════════════════

function replyForMeta(slug: string): string {
  if (slug === "small_talk") {
    return "Hi. What are we tackling — a bug, a build, or a chat about the code?";
  }
  // capabilities · what NEX1 can do RIGHT NOW
  return [
    "I'm NEX in software-engineering mode. Right now I can help with:",
    "• Adding a new feature or module (say 'add a X that does Y').",
    "• Fixing a bug (say 'sort out the Z error').",
    "• Explaining code (say 'walk me through how X works').",
    "• Refactoring or renaming.",
    "• Adding a PostgreSQL migration (you still type the confirmation phrase before it applies).",
    "• Adding a new API route.",
    "• Adding tests with Vitest.",
    "Type your request as English — slang is fine. I'll classify it, plan it, and hand you a branch. You still merge every change.",
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// Operational route hint · nex-agent submit endpoint
// ═══════════════════════════════════════════════════════════════════

function replyForOperational(slug: string, message: string): string {
  const summary = message.slice(0, 120);
  const kind =
    slug === "add_feature" ? "add a new feature"
    : slug === "fix_bug" ? "fix a bug"
    : slug === "refactor" ? "refactor"
    : slug === "add_migration" ? "add a database migration"
    : slug === "add_api_route" ? "add an API route"
    : slug === "add_test" ? "add tests"
    : "handle this";
  return `That looks like a request to ${kind}. Submit it on the nex-agent page (nex1/nex2/nex3 will debate the plan and hand you a branch — you still merge). Your request: "${summary}".`;
}
