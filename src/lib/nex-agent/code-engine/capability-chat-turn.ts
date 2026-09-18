// src/lib/nex-agent/code-engine/capability-chat-turn.ts
//
// NEX1 · CHAT TURN ORCHESTRATOR · deterministic · zero LLM · zero LLM providers.
// Founder-authorised 2026-09-17.
//
// PURPOSE
//   Adapter/orchestrator that takes a single user chat message and drives it
//   through NEX1's existing native capabilities to produce a composed reply.
//
//   Path:
//     userMessage
//       → conversation-context.resolvePronounToActiveTarget
//       → capability-a-founder-intent.classifyFounderIntent
//       → decide route (understood / clarify / investigate / code-loop / refuse)
//       → OPTIONAL runSpecificationDrivenCodingLoop (only when authorised)
//       → build Nex1RuntimeSummary from actual runtime state
//       → capability-response-composer.composeChatResponse
//       → append user + nex1 turns to conversation-context
//       → return { text, state, source: "NEX1_NATIVE" }
//
//   For this initial adapter (Phase 1 of the mission) the DEFAULT ROUTE is:
//     · run classifier
//     · resolve pronouns
//     · compose a truthful reply based on the classification state
//     · DO NOT auto-execute the coding loop from a chat message (§28: preserve
//       Q7/Q8 + authorization boundaries · coding loops must go through the
//       existing `/api/nex1/native-loop/run` endpoint, not be triggered from
//       casual chat)
//
// DISCIPLINE
//   · Zero LLM · zero external network · zero fabrication.
//   · Explicit "source: NEX1_NATIVE" in every response so downstream telemetry
//     can prove the reply came from NEX1's native runtime.
//   · Never invokes the LLM-backed `src/lib/nex/brain/` codebase.

import { classifyFounderIntent } from "./capability-a-founder-intent";
import type { Nex1IntentResult } from "./capability-a-founder-intent/types";
import {
  composeChatResponse,
  stateFromClassification,
  emptySummary,
  type ComposedResponse,
  type Nex1RuntimeSummary,
  type ChatConversationState,
} from "./capability-response-composer";
import {
  appendTurn,
  getConversationHead,
  toTurnContext,
  updateContextHead,
  resolvePronounToActiveTarget,
  addBinding,
  findBinding,
  scanMessageForBindingMentions,
  openThread,
  activateThread,
  getActiveThread,
  recordFindings,
  recordMutation,
  recordVerification,
  type ConversationHead,
} from "./capability-conversation-context";
import { runSpecificationDrivenCodingLoop } from "./capability-specification-driven-loop";
import { runNativeInvestigation } from "./native-investigation-mode";
import {
  scanConversationIntents,
} from "./capability-conversation-intents";
import {
  ensureCanonicalAgentsRegistered,
  recordHeartbeat as _recordAgentHeartbeat,
} from "./capability-agent-registry";
// Heartbeat helper wrapped so failures never poison the turn.
function beat(agent_id: string, event_type: string, event_data?: Record<string, unknown>): void {
  try {
    _recordAgentHeartbeat({ agent_id, event_type, event_data });
  } catch { /* silent · registry contract */ }
}
// Batch 2B Safety Gate · 2026-09-17 · founder-authorised minimal boundary.
// Sits between UNDERSTAND (classifier) and AUTHORIZATION (wantsRun). Native,
// deterministic, zero LLM. Consumes the founder-authored safety doctrine
// vocabulary (I_CANNOT / I_NEED_PERMISSION) without inventing new taxonomy.
import { evaluateSafetyBoundary, type SafetyBoundaryResult } from "./capability-safety-boundary";

// ── Public shape ─────────────────────────────────────────────────────────

/**
 * Batch 2A Streaming · 2026-09-17 · discriminated event union emitted by
 * runChatTurn at each observable boundary. Each event represents a REAL
 * stage produced by the native runtime · no simulated events, no
 * artificial delays. Consumed by /api/nex1/chat/turn/stream to write
 * SSE frames · downstream callers who don't want streaming pass no
 * onEvent and see zero behavioural difference from Batch 1.
 */
export type ChatTurnEvent =
  | { readonly kind: "classifier"; readonly data: { readonly result_kind: string; readonly verb?: string | null; readonly target?: string | null; readonly overall_confidence?: number } }
  | { readonly kind: "follow_up_synthesis"; readonly data: { readonly inherited_verb: string | null; readonly inherited_target: string | null } }
  | { readonly kind: "safety"; readonly data: { readonly verdict: "PASS" | "I_CANNOT" | "I_NEED_PERMISSION"; readonly rule_id: string; readonly reason: string; readonly protected_layers?: readonly string[] } }
  | { readonly kind: "pending_goal_stored"; readonly data: { readonly thread_id: string; readonly target: string; readonly goal_len: number } }
  | { readonly kind: "recall_dispatch"; readonly data: { readonly recall_kind: string; readonly resolved_state: string } }
  | { readonly kind: "authorization"; readonly data: { readonly wants_run: boolean; readonly verb: string | null; readonly target: string | null; readonly goal_source: "override" | "thread.goal" | null } }
  | { readonly kind: "coding_loop_start"; readonly data: { readonly target: string; readonly verb: string } }
  | { readonly kind: "coding_loop_stage"; readonly data: { readonly stage: string; readonly verdict: string; readonly summary: string; readonly duration_ms?: number } }
  | { readonly kind: "coding_loop_done"; readonly data: { readonly overall_verdict: string; readonly duration_ms: number } }
  | { readonly kind: "investigation_start"; readonly data: { readonly target: string } }
  | { readonly kind: "investigation_done"; readonly data: { readonly verdict: string | null; readonly candidate_count: number; readonly duration_ms: number } }
  | { readonly kind: "composer"; readonly data: { readonly state: string; readonly text_len: number } };

export interface RunChatTurnInput {
  readonly conversation_id: string;
  readonly user_message: string;
  readonly repo_root?: string;
  /** Optional per-turn founder-goal for coding-loop invocation. When the
   *  conversation-context already carries the required goal string from a
   *  previous turn, callers can omit this. */
  readonly coding_goal_override?: string;
  /** Test-only fast path · when true, skip vitest execution in the
   *  invocation (the loop still runs classifier + tracer + preservation).
   *  Never set from production paths. */
  readonly _dry_run_native_invocation?: boolean;
  /**
   * Batch 2A Streaming · 2026-09-17. Optional observer for each real
   * stage boundary reached during this turn. Fire-and-forget: thrown
   * errors are swallowed so a broken consumer never breaks the turn.
   * When absent (Batch 1 default) the turn is byte-identical.
   */
  readonly onEvent?: (e: ChatTurnEvent) => void;
}

export interface RunChatTurnResult {
  readonly ok: true;
  readonly source: "NEX1_NATIVE";
  readonly text: string;
  readonly state: ChatConversationState;
  readonly turn_id: number;
  readonly classification: Nex1IntentResult;
  readonly summary: Nex1RuntimeSummary;
  readonly resolved_target: string | null;
  readonly zero_llm: true;
  readonly evidence_kind: "COMPOSED";
  readonly conversation_head: ConversationHead;
  readonly trace: readonly string[];
}

// ── Public entry ─────────────────────────────────────────────────────────

export async function runChatTurn(input: RunChatTurnInput): Promise<RunChatTurnResult> {
  const trace: string[] = [];
  trace.push(`chat-turn · conversation=${input.conversation_id} · message_len=${input.user_message.length}`);

  // Batch 2A Streaming · 2026-09-17. Safe emit helper. Never throws even
  // if the consumer's callback does. Never adds a delay.
  const emitEvent = (e: ChatTurnEvent): void => {
    if (!input.onEvent) return;
    try { input.onEvent(e); } catch { /* observer must never break the turn */ }
  };

  // Ensure canonical agent roster is registered (idempotent).
  try { ensureCanonicalAgentsRegistered(input.repo_root); } catch { /* silent */ }
  beat("chat_turn_orchestrator", "turn_started", {
    conversation_id: input.conversation_id,
    message_len: input.user_message.length,
  });
  beat("agent_registry", "roster_ensured");

  // Persist the user's utterance
  const userTurn = appendTurn(
    { conversation_id: input.conversation_id, sender: "user", text: input.user_message },
    { repo_root: input.repo_root },
  );
  trace.push(`turn ${userTurn.turn_id} · user message stored`);
  beat("working_memory", "user_turn_appended", { turn_id: userTurn.turn_id });

  // ─── AFRAID · session-scoped mood assessment ────────────────────────
  // Reads recent NEX1 turn states from the persistent turn store and
  // returns CALM / CAUTIOUS / AFRAID. Prepended to composer rationale
  // when non-CALM. Never blocks. Modulates fear thresholds downstream.
  const _priorTurns = (await import("./capability-conversation-context"))
    .getConversationTurns(input.conversation_id);
  const _nex1PriorStates = _priorTurns
    .filter((t) => t.sender === "nex1" && typeof t.state === "string")
    .map((t) => ({ turn_id: t.turn_id, state: t.state as string }));
  const { assessAfraid } = await import("./capability-afraid");
  const afraidAssessment = assessAfraid({ recent_turns: _nex1PriorStates });
  trace.push(
    `afraid · state=${afraidAssessment.state} · score=${afraidAssessment.score} · window=${afraidAssessment.window_examined} · refusals=${afraidAssessment.refusal_count} · failures=${afraidAssessment.failure_count}`,
  );
  beat("metacognition_afraid", "assessed", {
    state: afraidAssessment.state,
    score: afraidAssessment.score,
    window_examined: afraidAssessment.window_examined,
  });
  // ─── END AFRAID ─────────────────────────────────────────────────────

  // Resolve pronouns against the conversation head
  const head = getConversationHead(input.conversation_id);
  const resolvedTarget = resolvePronounToActiveTarget(input.user_message, head);
  if (resolvedTarget) {
    trace.push(`pronoun resolved · active_target=${resolvedTarget}`);
  }

  // ─── World-Class Conversation Intelligence · 2026-09-17 ────────────
  // Unified conversation-state scan · runs BEFORE the classifier so that
  // bindings, recall queries, and thread control get first pass. All three
  // detectors are deterministic pattern-driven · zero LLM.
  const conversationScan = scanConversationIntents(input.user_message);

  // Record any bindings introduced this turn.
  for (const b of conversationScan.bindings) {
    const stored = addBinding(head, {
      name: b.name,
      kind: b.kind_hint,
      reference: b.reference_hint,
      turn: userTurn.turn_id,
    });
    trace.push(`binding stored · '${stored.name}' kind=${stored.kind} ref=${stored.reference ?? "null"}`);
  }
  // §8 · Record any definition-form bindings this turn (independent detector).
  for (const b of conversationScan.definitions) {
    const stored = addBinding(head, {
      name: b.name,
      kind: b.kind_hint,
      reference: b.reference_hint,
      turn: userTurn.turn_id,
    });
    trace.push(`definition-binding stored · '${stored.name}' kind=${stored.kind} ref='${stored.reference ?? "null"}'`);
  }
  // §9 · Record any decision this turn.
  if (conversationScan.decision) {
    const active = getActiveThread(head);
    active.decisions.push({
      turn: userTurn.turn_id,
      text: `${conversationScan.decision.kind}: ${conversationScan.decision.text}`,
      evidence: [conversationScan.decision.evidence],
    });
    trace.push(`decision recorded · kind=${conversationScan.decision.kind} · text='${conversationScan.decision.text.slice(0, 80)}'`);
  }

  // Recall queries short-circuit to a composer recall state fed by
  // real recorded state · no LLM.
  if (conversationScan.recall) {
    const r = conversationScan.recall;
    const active = getActiveThread(head);
    trace.push(`recall intent · kind=${r.kind} · subject=${r.subject ?? "null"}`);
    // Note: the resolved recall state (recall_mutation / recall_verification /
    // recall_insufficient / etc.) is not known yet · it is computed below.
    // We emit a second event after composedRecall is built. Recording the
    // detection here so consumers see the branch taken.
    emitEvent({
      kind: "recall_dispatch",
      data: { recall_kind: r.kind, resolved_state: "pending" },
    });

    let recallState: import("./capability-response-composer").ChatConversationState = "recall_insufficient";
    let recallSummary: import("./capability-response-composer").Nex1RuntimeSummary =
      emptySummary(recallState);

    // Recall queries scan ALL threads. Mutations, verifications, findings
    // and decisions are conversation-level facts · not lost when the user
    // opens a new thread.
    const allDecisions = head.threads.flatMap((t) => t.decisions);
    const allVerifications = head.threads.flatMap((t) => t.verifications);
    const allMutations = head.threads.flatMap((t) => t.mutations);
    const allFindings = head.threads.flatMap((t) => t.findings);

    if (r.kind === "what_did_i_call") {
      const target = r.subject?.toLowerCase() ?? "";
      // Treat bare pronouns as unspecified · return latest entity binding.
      const isPronoun = /^(it|that|this|them|they)$/.test(target);
      const cleaned = isPronoun ? "" : target.replace(/^(that|the|this)\s+/, "").trim();
      const candidates = head.bindings.filter((b) => {
        if (cleaned === "") return true;
        return b.canonical.includes(cleaned) || (b.reference?.toLowerCase().includes(cleaned) ?? false);
      });
      const explicit = candidates.filter((b) => b.kind === "entity");
      const chosen = (explicit[explicit.length - 1] ?? candidates[candidates.length - 1]) ?? null;
      if (chosen) {
        recallState = "recall_binding";
        recallSummary = { ...emptySummary(recallState), rationale: chosen.name };
      }
    } else if (r.kind === "what_did_we_decide") {
      if (allDecisions.length > 0) {
        recallState = "recall_decision";
        const latest = allDecisions[allDecisions.length - 1];
        recallSummary = { ...emptySummary(recallState), rationale: latest.text };
      }
    } else if (r.kind === "did_it_work") {
      const latest = allVerifications[allVerifications.length - 1];
      if (latest) {
        recallState = "recall_verification";
        recallSummary = {
          ...emptySummary(recallState),
          test_exit_code: latest.ok ? 0 : (latest.test_exit_code ?? 1),
          preservation_result:
            latest.preservation_kind === "regressed"
              ? { kind: "regressed", failing_test: latest.notes ?? "unnamed test" }
              : latest.preservation_kind === "preserved"
                ? { kind: "preserved" }
                : { kind: "no_sibling" },
        };
      }
    } else if (r.kind === "what_changed") {
      const latest = allMutations[allMutations.length - 1];
      if (latest) {
        recallState = "recall_mutation";
        recallSummary = {
          ...emptySummary(recallState),
          target_file: latest.target_file,
          target_function: latest.target_function,
          mutation: {
            current_literal: latest.current_literal,
            proposed_literal: latest.proposed_literal,
            line: latest.line,
          },
        };
      }
    } else if (r.kind === "what_did_you_find") {
      const latest = allFindings[allFindings.length - 1];
      if (latest) {
        recallState = "recall_findings";
        recallSummary = {
          ...emptySummary(recallState),
          candidate_targets: latest.candidate_targets,
        };
      }
    } else if (r.kind === "which_file") {
      // Batch 1 Final Closure 2026-09-17 · file recall.
      // Answer from the most recent mutation record if available; otherwise
      // from the most recent findings record; otherwise from the active
      // thread's target. All three are real ConversationHead state.
      const latestMut = allMutations[allMutations.length - 1];
      const latestFind = allFindings[allFindings.length - 1];
      const activeTarget = getActiveThread(head).target;
      const targetFile =
        latestMut?.target_file ??
        latestFind?.candidate_targets?.[0] ??
        activeTarget ??
        null;
      if (targetFile) {
        recallState = "recall_mutation";
        recallSummary = {
          ...emptySummary(recallState),
          target_file: targetFile,
          target_function: latestMut?.target_function ?? null,
          mutation: latestMut
            ? {
                current_literal: latestMut.current_literal,
                proposed_literal: latestMut.proposed_literal,
                line: latestMut.line,
              }
            : null,
        };
      }
    } else if (r.kind === "which_function") {
      // Batch 1 Final Closure 2026-09-17 · function recall.
      const latestMut = allMutations[allMutations.length - 1];
      if (latestMut && latestMut.target_function) {
        recallState = "recall_mutation";
        recallSummary = {
          ...emptySummary(recallState),
          target_file: latestMut.target_file,
          target_function: latestMut.target_function,
          mutation: {
            current_literal: latestMut.current_literal,
            proposed_literal: latestMut.proposed_literal,
            line: latestMut.line,
          },
        };
      }
    } else if (r.kind === "what_was_the_first" || r.kind === "what_was_the_original") {
      const firstThreadWithTarget = head.threads.find((t) => t.target !== null);
      if (firstThreadWithTarget) {
        recallState = "recall_transcript";
        recallSummary = {
          ...emptySummary(recallState),
          rationale: `The first coding target introduced was \`${firstThreadWithTarget.target}\`.`,
        };
      }
    }

    // Compose + persist immediately · skip classifier + Fix 25/GAP A
    const composedRecall = composeChatResponse({
      user_message: input.user_message,
      classification: { kind: "classified", verb_family: "INVESTIGATE" as any, verb_family_confidence: 0.5, verb_hits: [], deliverable_kind: "unclear", deliverable_confidence: 0, domain_tokens: [], coding_concepts: [], file_references: [], project_dir_references: [], requirement_phrases: [], ambiguities: [], overall_confidence: 0.5, reasoning_trace: [], goal_length: input.user_message.length, vocabulary_version: "recall-shortcut-1", taught_by: "master_ai_engineer" } as any,
      summary: recallSummary,
      ctx: toTurnContext(head),
    });
    const nex1TurnR = appendTurn({
      conversation_id: input.conversation_id,
      sender: "nex1",
      text: composedRecall.text,
      state: composedRecall.state,
      trace,
    }, { repo_root: input.repo_root });
    return {
      ok: true,
      source: "NEX1_NATIVE",
      text: composedRecall.text,
      state: composedRecall.state,
      turn_id: nex1TurnR.turn_id,
      classification: { kind: "classified" } as any,
      summary: recallSummary,
      resolved_target: null,
      zero_llm: true,
      evidence_kind: "COMPOSED",
      conversation_head: head,
      trace,
    };
  }

  // Thread intent: leave / go-back-to.
  if (conversationScan.thread) {
    const th = conversationScan.thread;
    trace.push(`thread intent · kind=${th.kind} · subject=${th.subject ?? "null"}`);
    if (th.kind === "leave_current") {
      // Open a fresh thread (no target yet).
      openThread(head, { opened_turn: userTurn.turn_id, parent: head.active_thread_id ?? null });
      const composedT = composeChatResponse({
        user_message: input.user_message,
        classification: { kind: "classified" } as any,
        summary: { ...emptySummary("thread_switched"), rationale: "New thread opened." },
        ctx: toTurnContext(head),
      });
      const nex1TurnT = appendTurn({ conversation_id: input.conversation_id, sender: "nex1", text: composedT.text, state: composedT.state, trace }, { repo_root: input.repo_root });
      return { ok: true, source: "NEX1_NATIVE", text: composedT.text, state: composedT.state, turn_id: nex1TurnT.turn_id, classification: {} as any, summary: emptySummary("thread_switched"), resolved_target: null, zero_llm: true, evidence_kind: "COMPOSED", conversation_head: head, trace };
    }
    if (th.kind === "go_back_to" && th.subject) {
      // Resolve subject against thread targets/goals OR binding names.
      const subLc = th.subject.toLowerCase();
      // Fix A · Semantic entity-kind resolution: if the subject is an anchor
      // noun ("the component", "that function") without a concrete name,
      // resolve against the most recent binding of that kind (§7).
      const anchorKind = conversationScan.anchor_kind;
      let matchingThread = head.threads.find((t) =>
        (t.target?.toLowerCase().includes(subLc.replace(/\bissue|problem|thing\b/g, "").trim())) ||
        (t.goal?.toLowerCase().includes(subLc)) ||
        (t.entity_binding_names.some((n) => subLc.includes(n.toLowerCase())))
      );
      if (!matchingThread && anchorKind !== null) {
        // Look for a thread whose entity_binding_names includes a binding of
        // the anchor kind. Deterministic · zero fabrication · zero LLM.
        const bindingsOfKind = head.bindings.filter((b) => b.kind === anchorKind);
        if (bindingsOfKind.length === 1) {
          const only = bindingsOfKind[0];
          matchingThread = head.threads.find((t) => t.entity_binding_names.includes(only.name)) ?? null;
          trace.push(`semantic-kind resolution · anchor=${anchorKind} → single binding '${only.name}' · thread=${matchingThread?.thread_id ?? "no-thread"}`);
        } else if (bindingsOfKind.length > 1) {
          trace.push(`semantic-kind ambiguous · anchor=${anchorKind} · ${bindingsOfKind.length} candidates · refusing to guess`);
          // Emit a clarification_required composer response.
          const preview = bindingsOfKind.slice(0, 4).map((b) => b.name);
          const composedC = composeChatResponse({
            user_message: input.user_message,
            classification: { kind: "classified" } as any,
            summary: { ...emptySummary("clarification_required"), candidate_targets: preview, ambiguities: [`multiple ${anchorKind} bindings in play`] },
            ctx: toTurnContext(head),
          });
          const nex1TurnC = appendTurn({ conversation_id: input.conversation_id, sender: "nex1", text: composedC.text, state: composedC.state, trace }, { repo_root: input.repo_root });
          return { ok: true, source: "NEX1_NATIVE", text: composedC.text, state: composedC.state, turn_id: nex1TurnC.turn_id, classification: {} as any, summary: { ...emptySummary("clarification_required"), candidate_targets: preview }, resolved_target: null, zero_llm: true, evidence_kind: "COMPOSED", conversation_head: head, trace };
        }
      }
      if (matchingThread) {
        activateThread(head, matchingThread.thread_id);
        const composedT = composeChatResponse({
          user_message: input.user_message,
          classification: { kind: "classified" } as any,
          summary: { ...emptySummary("thread_returned"), target_file: matchingThread.target },
          ctx: toTurnContext(head),
        });
        const nex1TurnT = appendTurn({ conversation_id: input.conversation_id, sender: "nex1", text: composedT.text, state: composedT.state, trace }, { repo_root: input.repo_root });
        return { ok: true, source: "NEX1_NATIVE", text: composedT.text, state: composedT.state, turn_id: nex1TurnT.turn_id, classification: {} as any, summary: { ...emptySummary("thread_returned"), target_file: matchingThread.target }, resolved_target: null, zero_llm: true, evidence_kind: "COMPOSED", conversation_head: head, trace };
      }
      trace.push(`thread go_back_to · no matching thread for '${th.subject}' · falling through to classifier`);
    }
  }

  // Bind-acknowledged short-circuit · if bindings were introduced and the
  // classifier would refuse the message anyway (no coding verb, no target),
  // emit a truthful bind_acknowledged reply from the ONE we just stored.
  if (conversationScan.bindings.length > 0 && !conversationScan.recall && !conversationScan.thread) {
    // Look ahead by cheaply invoking the classifier and checking whether it
    // would have refused on the bare message. If it did refuse for no-verb,
    // we short-circuit here. If it classified (e.g. "Fix X and call it Y"),
    // we let the normal flow run so authorization etc. still applies.
    const lookahead = classifyFounderIntent(input.user_message);
    if (lookahead.kind === "refused" && lookahead.refusal === "refused_no_verb_recognised") {
      const b = conversationScan.bindings[0];
      const composedBind = composeChatResponse({
        user_message: input.user_message,
        classification: lookahead,
        summary: { ...emptySummary("bind_acknowledged"), rationale: b.name },
        ctx: toTurnContext(head),
      });
      const nex1TurnB = appendTurn({ conversation_id: input.conversation_id, sender: "nex1", text: composedBind.text, state: composedBind.state, trace }, { repo_root: input.repo_root });
      return { ok: true, source: "NEX1_NATIVE", text: composedBind.text, state: composedBind.state, turn_id: nex1TurnB.turn_id, classification: lookahead, summary: { ...emptySummary("bind_acknowledged"), rationale: b.name }, resolved_target: null, zero_llm: true, evidence_kind: "COMPOSED", conversation_head: head, trace };
    }
  }

  // Classify
  let classification = classifyFounderIntent(input.user_message);
  beat("perception", "classified", { kind: classification.kind });
  trace.push(`classifier · kind=${classification.kind}` +
    (classification.kind === "classified"
      ? ` · verb=${classification.verb_family} · deliverable=${classification.deliverable_kind} · confidence=${classification.overall_confidence.toFixed(2)}`
      : ` · refusal=${classification.refusal}`));
  emitEvent({
    kind: "classifier",
    data: {
      result_kind: classification.kind,
      verb: classification.kind === "classified" ? classification.verb_family : null,
      target: classification.kind === "classified" ? (classification.file_references[0]?.path ?? null) : null,
      overall_confidence: classification.kind === "classified" ? classification.overall_confidence : undefined,
    },
  });

  // Fix 24 follow-up handler · 2026-09-17.
  //
  // When the classifier refuses with `refused_no_verb_recognised` OR
  // `refused_goal_too_short` BUT the conversation head carries an active
  // verb + target AND the message is short conversational scope-refinement
  // ("what about X" / "no I mean X" / "actually X" / a pronoun-only sentence),
  // treat it as a follow-up: inherit the active verb + target and route to
  // `understood`. This is not intelligence · it's deterministic context reuse.
  const FOLLOW_UP_MARKERS = /\b(what about|no,?\s+i\s+mean|actually|instead|the same|as well|also|try|too)\b/i;
  const isFollowUpShape =
    classification.kind === "refused" &&
    (classification.refusal === "refused_no_verb_recognised" ||
      classification.refusal === "refused_goal_too_short") &&
    head.active_task_verb !== null &&
    head.active_target !== null &&
    (FOLLOW_UP_MARKERS.test(input.user_message) ||
      resolvedTarget !== null ||
      input.user_message.trim().split(/\s+/).length <= 8);

  if (isFollowUpShape) {
    trace.push(
      `follow-up detected · inheriting verb=${head.active_task_verb} · target=${head.active_target}`,
    );
    // Synthesize a minimal classified result so downstream composition can
    // proceed. NEVER lie about the source: mark this synthesis explicitly.
    classification = {
      kind: "classified",
      verb_family: head.active_task_verb as any,
      verb_family_confidence: 0.5,
      verb_hits: [],
      deliverable_kind: "unclear",
      deliverable_confidence: 0.0,
      domain_tokens: [],
      coding_concepts: [],
      file_references: [{ path: head.active_target!, line: null, span: { start: 0, end: 0, text: "" } }],
      project_dir_references: [],
      requirement_phrases: [],
      ambiguities: [],
      overall_confidence: 0.5,
      reasoning_trace: [
        `synthesized-follow-up · inherited from turn ${head.turn_id} · verb=${head.active_task_verb} · target=${head.active_target}`,
      ],
      goal_length: input.user_message.length,
      vocabulary_version: "follow-up-synth-1",
      taught_by: "master_ai_engineer",
    } as any;
    trace.push(`classifier replaced by follow-up synthesis (source: conversation context)`);
    emitEvent({
      kind: "follow_up_synthesis",
      data: {
        inherited_verb: head.active_task_verb,
        inherited_target: head.active_target,
      },
    });
  }

  // ─── Batch 2B · SAFETY BOUNDARY · 2026-09-17 ─────────────────────────
  //
  // Runs BETWEEN UNDERSTAND (classifier) and AUTHORIZATION (wantsRun).
  // Consumes the founder-authored safety-doctrine vocabulary (I_CANNOT /
  // I_NEED_PERMISSION). Refuses on boundary; authorization refuses on
  // missing consent. The two are separate gates by founder rule.
  //
  // If safety returns I_CANNOT or I_NEED_PERMISSION, this turn short-
  // circuits: NO coding loop, NO investigation, NO file mutation. The
  // response is composed truthfully from the safety verdict.
  const safetyResult: SafetyBoundaryResult = evaluateSafetyBoundary({
    classification,
    user_message: input.user_message,
    repo_root: input.repo_root ?? process.cwd(),
  });
  trace.push(
    `safety · verdict=${safetyResult.verdict} · rule=${safetyResult.rule_id}${safetyResult.protected_layers.length > 0 ? ` · layers=[${safetyResult.protected_layers.join(",")}]` : ""}`,
  );
  emitEvent({
    kind: "safety",
    data: {
      verdict: safetyResult.verdict,
      rule_id: safetyResult.rule_id,
      reason: safetyResult.reason,
      protected_layers: safetyResult.protected_layers,
    },
  });

  if (safetyResult.verdict !== "PASS") {
    // Persist the classified intent on the ConversationHead BEFORE returning.
    // Rationale: safety refuses on boundary — it must not erase the topic.
    // If a subsequent turn asserts authorization ("Yes, go ahead"), the
    // follow-up-synthesis path must be able to rebuild the classification
    // so the safety gate can refuse AGAIN. Authorization cannot bypass
    // safety by wiping the head.
    if (classification.kind === "classified" && classification.file_references[0]?.path) {
      updateContextHead({
        conversation_id: input.conversation_id,
        active_target: classification.file_references[0].path,
        active_task_verb: classification.verb_family,
      });
    }
    const safetyState: ChatConversationState =
      safetyResult.verdict === "I_CANNOT" ? "refused" : "external_authorization_required";
    const safetySummary: Nex1RuntimeSummary = {
      ...emptySummary(safetyState),
      verb_family: classification.kind === "classified" ? classification.verb_family : null,
      target_file: classification.kind === "classified"
        ? classification.file_references[0]?.path ?? null
        : null,
      rationale: safetyResult.reason,
      refusal_kind: safetyResult.verdict === "I_CANNOT" ? "safety_boundary" : null,
      external_authorization:
        safetyResult.verdict === "I_NEED_PERMISSION"
          ? safetyResult.permission_scope
          : null,
    };
    const composedSafety = composeChatResponse({
      user_message: input.user_message,
      classification,
      summary: safetySummary,
      ctx: toTurnContext(head),
    });
    const nex1TurnS = appendTurn(
      { conversation_id: input.conversation_id, sender: "nex1", text: composedSafety.text, state: composedSafety.state, trace },
      { repo_root: input.repo_root },
    );
    emitEvent({
      kind: "composer",
      data: { state: composedSafety.state, text_len: composedSafety.text.length },
    });
    return {
      ok: true,
      source: "NEX1_NATIVE",
      text: composedSafety.text,
      state: composedSafety.state,
      turn_id: nex1TurnS.turn_id,
      classification,
      summary: safetySummary,
      resolved_target: resolvedTarget,
      zero_llm: true,
      evidence_kind: "COMPOSED",
      conversation_head: head,
      trace,
    };
  }
  // ─── END Batch 2B SAFETY ─────────────────────────────────────────────

  // Compute the base state from the classification outcome.
  let state: ChatConversationState = classification.kind === "refused"
    ? "refused"
    : stateFromClassification(classification);

  let summary: Nex1RuntimeSummary = {
    ...emptySummary(state),
    verb_family: classification.kind === "classified" ? classification.verb_family : null,
    target_file: classification.kind === "classified"
      ? classification.file_references[0]?.path ?? resolvedTarget
      : null,
    candidate_targets: classification.kind === "classified"
      ? classification.file_references.map((f) => f.path).slice(0, 8)
      : [],
    ambiguities: classification.kind === "classified"
      ? classification.ambiguities.map((a) => a.detail)
      : [],
    rationale: classification.kind === "refused" ? classification.reason : null,
  };

  // ─── Batch 1 Closure · Two-turn coding flow · 2026-09-17 ─────────────
  //
  // When the current turn is classified as a FIX or MODIFY intent with a
  // concrete target AND the user message carries a specification (any prose
  // beyond a bare "fix it"), preserve the entire prose as the active
  // thread's goal on the ConversationHead. This lets a subsequent
  // authorization turn ("yes, go ahead" / "okay, make the correction")
  // re-use the same goal WITHOUT any special `coding_goal_override` field.
  //
  // Deterministic · zero LLM · zero fabrication: the goal is the user's own
  // message text stored on the unified conversation state.
  if (
    classification.kind === "classified" &&
    (classification.verb_family === "FIX" || classification.verb_family === "MODIFY") &&
    classification.file_references.length > 0 &&
    input.user_message.trim().split(/\s+/).length >= 6
  ) {
    // Find-or-create the thread whose target matches this classification
    // (same behaviour as updateContextHead's target promotion, applied here
    // so the pending goal lands on the thread that Turn 2's authorization
    // will read from).
    const targetForGoal = classification.file_references[0].path;
    let targetThread = head.threads.find(
      (t) => t.target === targetForGoal && t.closed_turn === null,
    );
    if (!targetThread) {
      targetThread = openThread(head, {
        target: targetForGoal,
        verb: classification.verb_family,
        opened_turn: userTurn.turn_id,
      });
    }
    if (!targetThread.goal || targetThread.goal.length < input.user_message.length) {
      targetThread.goal = input.user_message;
      trace.push(
        `pending coding intent stored on thread ${targetThread.thread_id} (target=${targetForGoal}) · goal_len=${input.user_message.length}`,
      );
      emitEvent({
        kind: "pending_goal_stored",
        data: {
          thread_id: targetThread.thread_id,
          target: targetForGoal,
          goal_len: input.user_message.length,
        },
      });
    }
  }
  // ─── END Batch 1 Closure two-turn store ──────────────────────────────

  // ─── FIX 25 · Native intelligence connection · 2026-09-17 ────────────
  //
  // Detect an explicit user authorization to actually run a NEX1 native
  // capability. This is deterministic pattern matching · zero LLM · and
  // preserves Q7/Q8/authorization/preservation boundaries because the
  // underlying capability still enforces them.
  //
  // Trigger conditions (ALL required):
  //   1. Message contains an authorization marker (deterministic vocabulary)
  //   2. Conversation context has an active target
  //   3. Conversation context has an active task verb of FIX (or the
  //      classifier just extracted FIX in this same turn)
  //   4. The coding_goal_override provides an executable specification-driven
  //      goal OR the conversation head has one from a previous turn
  //
  // On trigger the chat-turn invokes runSpecificationDrivenCodingLoop and
  // composes the response from ACTUAL RUNTIME STATE — not from templates.
  // Batch 1 Closure · 2026-09-17 · natural authorization vocabulary.
  // Added: "okay/ok/sure/yeah + go|do|make|proceed|fix|correct",
  // "make (the) correction|fix|change|edit|update", "correct it", "go for it".
  // Every addition is a general English authorization phrase · zero
  // task-specific tokens · deterministic pattern · zero LLM.
  const AUTH_MARKERS = /\b(go\s+ahead|yes,?\s+(please|go|do)|please\s+(go|do|proceed|run|fix)|proceed|authori[sz]e|run\s+it|do\s+it|fix\s+it\s+now|make\s+the\s+change|(?:okay|ok|sure|yeah|yep|alright),?\s+(?:go|do|proceed|run|fix|make|correct)|make\s+(?:the\s+)?(?:correction|fix|change|edit|update|repair)|correct\s+it|go\s+for\s+it)\b/i;
  const wantsRun =
    AUTH_MARKERS.test(input.user_message) &&
    (head.active_target !== null || (classification.kind === "classified" && classification.file_references.length > 0));
  // Batch 1 Closure · 2026-09-17 · authorization-time verb precedence.
  // When the user authorizes a coding action ("okay, make the correction",
  // "please make the change") the classifier can extract MAKE→BUILD from
  // "make", which would silently switch the active verb away from the
  // FIX/MODIFY the conversation was actually about. If the head already
  // carries an active FIX/MODIFY task-verb AND the current message is an
  // authorization, prefer the head's context so authorization does not
  // fabricate a new intent.
  const authOverridesClassification =
    wantsRun &&
    (head.active_task_verb === "FIX" || head.active_task_verb === "MODIFY") &&
    classification.kind === "classified" &&
    classification.verb_family !== "FIX" &&
    classification.verb_family !== "MODIFY";
  const activeVerb = authOverridesClassification
    ? head.active_task_verb
    : ((classification.kind === "classified" ? classification.verb_family : head.active_task_verb) ?? head.active_task_verb);
  let activeTarget: string | null =
    (classification.kind === "classified" ? classification.file_references[0]?.path : null) ?? head.active_target;
  if (authOverridesClassification) {
    trace.push(
      `authorization-time verb precedence · classifier=${classification.kind === "classified" ? classification.verb_family : "n/a"} · head=${head.active_task_verb} · using head`,
    );
  }

  // ─── BATCH 2B · Deterministic target discovery ──────────────────────
  //
  // When the classifier extracted NO explicit file reference AND the
  // conversation carries no active_target from a previous turn, but the
  // user prose contains identifier-shaped tokens (camelCase, snake_case,
  // etc.), invoke deterministic repository search to find candidate
  // files. On a strong single-match, adopt it as activeTarget so the
  // subsequent INVESTIGATE branch can enter. On multi-match, emit a
  // targeted clarification listing the candidates. Zero LLM. Zero
  // network. Founder-authorised 2026-09-18.
  //
  // Only fires when:
  //   - activeTarget is currently null
  //   - classifier verb is coding-family (INVESTIGATE / FIX / MODIFY)
  //     OR follow-up-inherited coding-family
  //   - user prose is > 0 length
  //
  // Preserves invariants:
  //   - Never mutates a file; only sets a routing target
  //   - Never bypasses safety-boundary (safety still runs downstream)
  //   - Never authorises modification (still requires Turn 2 auth)
  //   - Q7/Q8/coding-loop UNCHANGED
  let batch2b_discovery_hit: {
    readonly path: string;
    readonly score: number;
    readonly reason: string;
  } | null = null;
  let batch2b_multi_candidates: readonly {
    readonly path: string;
    readonly score: number;
  }[] | null = null;
  if (
    activeTarget === null &&
    (activeVerb === "INVESTIGATE" || activeVerb === "FIX" || activeVerb === "MODIFY") &&
    input.user_message.length > 0
  ) {
    try {
      const { discoverTargets } = await import("./capability-target-discovery");
      beat("semantic_memory", "target_discovery_start", { user_message_len: input.user_message.length });
      const disc = discoverTargets({
        repo_root: input.repo_root ?? process.cwd(),
        user_message: input.user_message,
        scope_dirs: ["src"],
      });
      beat("semantic_memory", "target_discovery_completed", {
        ok: disc.ok,
        candidates_found: disc.ok ? disc.candidates.length : 0,
      });
      if (disc.ok && disc.candidates.length > 0) {
        // Deterministic thresholds:
        //  - Sole-candidate case: exactly one candidate, score ≥ 10
        //    (basename-substring or exported-symbol match is strong enough
        //    when there is no ambiguity)
        //  - Multi-candidate strong-dominance case: top score ≥ 20 AND
        //    (top score ≥ 2× the second)
        //  - Otherwise: emit clarification with all top-8 candidates
        const top = disc.candidates[0];
        const second = disc.candidates[1];
        const soleStrong = !second && top.match_score >= 10;
        const dominantStrong =
          !!second && top.match_score >= 20 && top.match_score >= 2 * second.match_score;
        const singleStrong = soleStrong || dominantStrong;
        if (singleStrong) {
          activeTarget = top.path;
          batch2b_discovery_hit = {
            path: top.path,
            score: top.match_score,
            reason: top.match_reason,
          };
          updateContextHead({
            conversation_id: input.conversation_id,
            active_target: top.path,
          });
          trace.push(
            `batch2b · target discovery · single strong match · path=${top.path} · score=${top.match_score} · matched=${top.matched_tokens.join(",")}`,
          );
        } else {
          batch2b_multi_candidates = disc.candidates.map((c) => ({
            path: c.path,
            score: c.match_score,
          }));
          trace.push(
            `batch2b · target discovery · multiple candidates (${disc.candidates.length}) · surfacing clarification with paths: ${disc.candidates.slice(0, 4).map((c) => c.path).join(", ")}`,
          );
          // Wire the discovered candidates into a light-touch clarification
          // summary so the composer emits a targeted question instead of a
          // generic one. This preserves the existing composer path entirely
          // — we're only pre-populating the fields the composer already
          // consumes. If a later stage (e.g. investigation) overrides these,
          // its own summary wins.
          const previewPaths = disc.candidates.slice(0, 8).map((c) => c.path);
          summary = {
            ...emptySummary("clarification_required"),
            verb_family: activeVerb ?? classification.verb_family,
            candidate_targets: previewPaths,
            ambiguities: [
              `${disc.candidates.length} file(s) matched the identifier tokens ${disc.extracted_tokens.join(", ")}`,
            ],
            rationale:
              `No explicit file path in the request · target discovery found ${disc.candidates.length} matching file(s). Please specify which one to work on.`,
          };
          state = "clarification_required";
        }
      } else if (!disc.ok) {
        trace.push(
          `batch2b · target discovery · refused: ${disc.refusal_kind} · ${disc.detail}`,
        );
      }
    } catch (err) {
      trace.push(
        `batch2b · target discovery threw · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
      );
    }
  }
  // ─── END BATCH 2B ──────────────────────────────────────────────────

  // Batch 1 Closure · 2026-09-17 · derive the effective coding goal from
  // the unified conversation state. Priority:
  //   1. explicit `input.coding_goal_override` (test-only harness override)
  //   2. current turn's active thread `goal` (populated by the two-turn
  //      store block above · this is the load-bearing native path)
  //   3. null · at which point we cannot invoke the loop and must return
  //      a clarification instead of fabricating a goal
  const effectiveCodingGoal =
    input.coding_goal_override ??
    getActiveThread(head).goal ??
    null;

  if (wantsRun && (activeVerb === "FIX" || activeVerb === "MODIFY") && activeTarget && effectiveCodingGoal) {
    trace.push(
      `native intelligence · auth marker detected · invoking runSpecificationDrivenCodingLoop · target=${activeTarget} · verb=${activeVerb} · goal_source=${input.coding_goal_override ? "override" : "thread.goal"}`,
    );
    emitEvent({
      kind: "authorization",
      data: {
        wants_run: true,
        verb: activeVerb,
        target: activeTarget,
        goal_source: input.coding_goal_override ? "override" : "thread.goal",
      },
    });
    emitEvent({
      kind: "coding_loop_start",
      data: { target: activeTarget, verb: activeVerb },
    });
    state = "working";
    try {
      const loopStart = Date.now();
      beat("execution", "coding_loop_started", {
        target: activeTarget,
        verb: activeVerb,
      });
      // Fix 32 · Coding-loop stage evidence surfaced to trace.
      // Every stage's verdict + summary is appended to the trace array so
      // failure can be diagnosed from a single receipt without re-running.
      const _loopStages: Array<{ stage: string; verdict: string; summary: string; duration_ms: number }> = [];
      const loopResult = await runSpecificationDrivenCodingLoop({
        founder_goal: effectiveCodingGoal,
        target_source_file: activeTarget,
        repo_root: input.repo_root ?? process.cwd(),
        test_timeout_ms: 120_000,
        onStage: (s) => {
          _loopStages.push({
            stage: String(s.stage),
            verdict: String(s.verdict),
            summary: String(s.summary ?? "").slice(0, 240),
            duration_ms: Number(s.duration_ms ?? 0),
          });
          trace.push(
            `coding-loop · stage=${s.stage} · verdict=${s.verdict} · dur=${s.duration_ms}ms · ${String(s.summary ?? "").slice(0, 160)}`,
          );
          // Fix 32.1 · surface evidence lines too — critical for diagnosing
          // which underlying capability refused within a compound stage.
          const _ev = (s as { evidence?: unknown }).evidence;
          if (Array.isArray(_ev)) {
            for (const line of _ev.slice(0, 8)) {
              trace.push(`coding-loop ·   evidence · ${String(line).slice(0, 220)}`);
            }
          }
          emitEvent({
            kind: "coding_loop_stage",
            data: {
              stage: s.stage,
              verdict: s.verdict,
              summary: s.summary,
              duration_ms: s.duration_ms,
            },
          });
        },
      });
      const durMs = Date.now() - loopStart;
      emitEvent({
        kind: "coding_loop_done",
        data: { overall_verdict: loopResult.overall_verdict, duration_ms: durMs },
      });
      trace.push(
        `native intelligence · loop completed · overall_verdict=${loopResult.overall_verdict} · duration_ms=${durMs}`,
      );
      beat("execution", "coding_loop_completed", {
        overall_verdict: loopResult.overall_verdict,
        duration_ms: durMs,
      });
      beat("verification", "loop_verdict_observed", {
        verdict: loopResult.overall_verdict,
      });
      beat("learning_signal", "loop_outcome_broadcast", {
        verdict: loopResult.overall_verdict,
      });

      // Translate loop verdict into ChatConversationState (real runtime state)
      switch (loopResult.overall_verdict) {
        case "CODING_LOOP_RUNTIME_VERIFIED":
          state = "verified";
          break;
        case "CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED":
          state = "working";
          break;
        case "CODING_LOOP_NOT_YET_RUNTIME_VERIFIED":
          state = "failed";
          break;
        case "SPECIFICATION_INSUFFICIENT":
          state = "insufficient_evidence";
          break;
        case "NO_VERIFIABLE_CASES":
          state = "clarification_required";
          break;
        case "WRITE_REFUSED":
          state = "failed";
          break;
        case "EARLY_EXIT_TARGET_MISSING":
          state = "failed";
          break;
      }

      // Extract programming-loop stage evidence for the composer.
      const stages = loopResult.programming_loop?.stages ?? [];
      const changeStage = stages.find((s) => s.stage === "change");
      const testStage = stages.find((s) => s.stage === "test");
      const verifyStage = stages.find((s) => s.stage === "verify");
      const gapText = (loopResult.programming_loop?.capability_gaps ?? []).find((g) => g.includes("preservation_regression"));
      const preservation_result: Nex1RuntimeSummary["preservation_result"] =
        gapText
          ? {
              kind: "regressed",
              failing_test:
                gapText.match(/first:\s*([^·]+)·/)?.[1]?.trim() ?? "unnamed existing test",
            }
          : loopResult.overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED"
            ? { kind: "preserved" }
            : { kind: "no_sibling" };

      // GAP D fix · 2026-09-17 · extract mutation from stage.evidence array
      // (NOT stage.summary which is a formatted display string).
      //
      // The native programming loop pushes each applied J.2 mutation into
      // `appliedMutations` with inserted_ids of the form:
      //   `${current_literal}→${proposed_literal}@${line}`
      // and stores per-mutation evidence lines shaped like:
      //   `${target_file} · inserted=['<current>→<proposed>@<line>']`
      //
      // We scan stage.evidence for the first entry containing an
      // `inserted=[...]` payload and parse the arrow-separated tuple. This
      // is a data-flow fix, not a fixture patch — the regex uses no literal
      // values from any test.
      let mutation: Nex1RuntimeSummary["mutation"] = null;
      let mutationTargetFunction: string | null = null;
      const changeEvidenceLines = changeStage?.evidence ?? [];
      const changeTraceLines = changeStage?.reasoning_trace ?? [];
      const INSERTED_RE = /inserted=\[\s*'([^']*→[^']*@\d+)'/;
      const TUPLE_RE = /^(.+?)→(.+?)@(\d+)$/;
      for (const line of changeEvidenceLines) {
        const match = INSERTED_RE.exec(line);
        if (match) {
          const tuple = TUPLE_RE.exec(match[1]);
          if (tuple) {
            mutation = {
              current_literal: tuple[1],
              proposed_literal: tuple[2],
              line: Number(tuple[3]) || null,
            };
            break;
          }
        }
      }
      // Extract target_function from J.2 trace lines · shape:
      //   "iter <n> · J.2 proposal · target=<file>#<fn> · <c>→<p>"
      const FN_RE = /J\.2 proposal · target=[^#]+#([A-Za-z_][\w$]*)/;
      for (const line of changeTraceLines) {
        const m = FN_RE.exec(line);
        if (m) { mutationTargetFunction = m[1]; break; }
      }
      trace.push(
        `native intelligence · mutation extraction · ${mutation ? `${mutation.current_literal}→${mutation.proposed_literal}@${mutation.line}` : "no mutation detected in evidence"}${mutationTargetFunction ? ` · fn=${mutationTargetFunction}` : ""}`,
      );

      summary = {
        state,
        verb_family: activeVerb ?? null,
        target_file: activeTarget,
        target_function: mutationTargetFunction,
        target_field: null,
        mutation,
        refusal_kind:
          state === "failed"
            ? (loopResult.programming_loop?.capability_gaps?.[0] ?? loopResult.overall_verdict)
            : null,
        rationale: loopResult.rationale,
        ambiguities: [],
        candidate_targets: [activeTarget],
        generated_cases: loopResult.generation.case_count,
        test_exit_code:
          verifyStage?.verdict === "VERIFIED"
            ? 0
            : testStage?.verdict === "VERIFIED"
              ? 0
              : null,
        preservation_result,
        unavailable_capability: null,
        external_authorization: null,
      };
      trace.push(
        `native intelligence · summary built from real runtime state · state=${state} · mutation=${mutation ? mutation.current_literal + "→" + mutation.proposed_literal + "@" + mutation.line : "none"}`,
      );

      // Persist the verified result on the conversation head
      if (state === "verified") {
        updateContextHead({
          conversation_id: input.conversation_id,
          last_verified_result: `${activeVerb?.toLowerCase()} on ${activeTarget}${mutation ? ` (${mutation.current_literal}→${mutation.proposed_literal})` : ""}`,
        });
        // Record on unified state · active thread's mutations + verifications
        if (mutation && activeTarget) {
          recordMutation(head, {
            turn: userTurn.turn_id,
            target_file: activeTarget,
            target_function: mutationTargetFunction,
            current_literal: mutation.current_literal,
            proposed_literal: mutation.proposed_literal,
            line: mutation.line,
          });
        }
        recordVerification(head, {
          turn: userTurn.turn_id,
          ok: true,
          test_exit_code: 0,
          preservation_kind:
            (summary.preservation_result?.kind === "preserved" ||
             summary.preservation_result?.kind === "regressed" ||
             summary.preservation_result?.kind === "no_sibling")
              ? summary.preservation_result.kind
              : null,
          notes: null,
        });
      } else if (state === "failed") {
        recordVerification(head, {
          turn: userTurn.turn_id,
          ok: false,
          test_exit_code: null,
          preservation_kind:
            (summary.preservation_result?.kind === "regressed" ||
             summary.preservation_result?.kind === "preserved" ||
             summary.preservation_result?.kind === "no_sibling")
              ? summary.preservation_result.kind
              : null,
          notes: summary.refusal_kind ?? null,
        });
      }
    } catch (err) {
      trace.push(
        `native intelligence · loop threw · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
      );
      state = "failed";
      summary = { ...summary, state, refusal_kind: "loop_exception" };
    }
  }
  // ─── END FIX 25 ──────────────────────────────────────────────────────

  // ─── Batch 1 Closure · authorization-without-goal fallback ───────────
  //
  // If the user's authorization marker fired for a FIX/MODIFY intent with a
  // real target but the ConversationHead has no pending coding goal from a
  // previous turn, we must NOT reply "Understood" (which implies action).
  // Emit an honest clarification_required asking for the missing spec.
  //
  // This is the load-bearing honesty invariant that keeps two-turn coding
  // real: NEX may never manufacture a specification the user did not
  // provide, and NEX may never fall back silently to a hidden default.
  if (
    wantsRun &&
    (activeVerb === "FIX" || activeVerb === "MODIFY") &&
    activeTarget &&
    !effectiveCodingGoal
  ) {
    state = "clarification_required";
    summary = {
      ...summary,
      state,
      target_file: activeTarget,
      verb_family: activeVerb ?? null,
      ambiguities: [
        `I have the target (${activeTarget}) and your authorization, but no specification of the desired behaviour. Tell me what should be true after the fix.`,
      ],
      candidate_targets: [activeTarget],
    };
    trace.push(
      `native intelligence · authorization present without pending goal · emitting clarification_required · target=${activeTarget}`,
    );
  }
  // ─── END Batch 1 Closure fallback ────────────────────────────────────

  // ─── Phase 2 · GAP A · INVESTIGATE routing · 2026-09-17 ──────────────
  //
  // When classifier extracts verb=INVESTIGATE with a real target OR an
  // active investigation-target exists from context AND the message signals
  // "investigate" intent (either the verb itself just fired, or the user
  // asks to investigate/explain/check via follow-up), invoke
  // runNativeInvestigation.
  //
  // CRITICAL INVARIANT: investigation must NOT modify source files.
  // The underlying runNativeInvestigation is already read-only (never
  // writes any file · per §4 of Phase 2 mission and its own contract).
  // Regardless, we snapshot the active_target SHA before + after and
  // record the equality in the trace as absence-of-modification proof.
  const INVESTIGATE_INTENT_MARKERS = /\b(investigate|analy[sz]e|inspect|check|why|explain|what.?s\s+wrong|look\s+at|find\s+out|understand)\b/i;
  // Only fire the investigation from the ORIGINAL classifier output, not
  // from a Fix 24 follow-up synthesis. Follow-ups reference the active
  // target but are not themselves fresh investigation requests · running
  // runNativeInvestigation on a bare follow-up like "what about zero
  // quantity?" produces a REFUSED_CLASSIFIER inside the investigation
  // and would surface as `refused` to the user, obscuring the fact that
  // NEX1 still knows the active context.
  const classificationIsFollowUpSynthesis =
    classification.kind === "classified" &&
    classification.vocabulary_version === "follow-up-synth-1";
  const wantsInvestigate =
    !wantsRun && // don't shadow the FIX/MODIFY invocation
    !classificationIsFollowUpSynthesis && // don't re-invoke on follow-ups
    activeVerb === "INVESTIGATE" &&
    activeTarget !== null &&
    INVESTIGATE_INTENT_MARKERS.test(input.user_message);

  if (wantsInvestigate) {
    trace.push(
      `native intelligence · INVESTIGATE detected · invoking runNativeInvestigation · target=${activeTarget}`,
    );
    emitEvent({
      kind: "investigation_start",
      data: { target: activeTarget! },
    });
    state = "investigating";

    // Absence-of-modification snapshot · read the target file's byte length
    // + first 16 hex of a simple content hash equivalent, using the same
    // node-crypto helpers available downstream. If the file doesn't exist
    // this remains null and we simply skip the equality check.
    const nodeFs = await import("node:fs");
    const nodePath = await import("node:path");
    const nodeCrypto = await import("node:crypto");
    const abs = nodePath.resolve(input.repo_root ?? process.cwd(), activeTarget);
    const sha = (p: string): { size: number; hash: string } | null => {
      try {
        const buf = nodeFs.readFileSync(p);
        return {
          size: buf.length,
          hash: nodeCrypto.createHash("sha256").update(buf).digest("hex").slice(0, 16),
        };
      } catch {
        return null;
      }
    };
    const preSnap = sha(abs);

    try {
      const invStart = Date.now();
      const packet = await runNativeInvestigation({
        problem_statement: input.coding_goal_override ?? input.user_message,
        repo_root: input.repo_root ?? process.cwd(),
      });
      const invDurMs = Date.now() - invStart;
      trace.push(
        `native intelligence · investigation completed · verdict=${packet.verdict ?? "n/a"} · candidates=${packet.candidate_files.length} · duration_ms=${invDurMs}`,
      );
      beat("reasoning", "investigation_completed", {
        verdict: packet.verdict ?? null,
        candidates: packet.candidate_files.length,
        duration_ms: invDurMs,
      });
      emitEvent({
        kind: "investigation_done",
        data: {
          verdict: packet.verdict ?? null,
          candidate_count: packet.candidate_files.length,
          duration_ms: invDurMs,
        },
      });

      // Absence-of-modification proof
      const postSnap = sha(abs);
      const unchanged =
        preSnap !== null && postSnap !== null &&
        preSnap.hash === postSnap.hash && preSnap.size === postSnap.size;
      trace.push(
        `native intelligence · investigation absence-of-modification · ${
          preSnap && postSnap
            ? unchanged
              ? `verified (sha ${preSnap.hash} identical)`
              : `VIOLATED (pre=${preSnap.hash} post=${postSnap.hash})`
            : "no snapshot"
        }`,
      );

      // Map investigation verdict → chat conversational state (real state,
      // never inflated).
      const candidatesCount = packet.candidate_files.length;
      const primaryCandidates = packet.candidate_files
        .slice(0, 5)
        .map((c: any) => (typeof c === "string" ? c : c.path ?? String(c)));
      if (packet.verdict === "REFUSED_CLASSIFIER") {
        state = "refused";
      } else if (candidatesCount === 0) {
        state = "insufficient_evidence";
      } else if (candidatesCount === 1) {
        state = "investigating";
      } else {
        state = "clarification_required";
      }

      summary = {
        state,
        verb_family: "INVESTIGATE",
        target_file: activeTarget,
        target_function: null,
        target_field: null,
        mutation: null,
        refusal_kind:
          state === "refused" ? (packet.verdict ?? "REFUSED_CLASSIFIER") : null,
        rationale:
          state === "insufficient_evidence"
            ? `Investigation ran but produced no candidate files matching the problem statement.`
            : `Investigation completed · ${candidatesCount} candidate file(s) inspected.`,
        ambiguities: [],
        candidate_targets: primaryCandidates,
        generated_cases: 0,
        test_exit_code: null,
        preservation_result: unchanged
          ? { kind: "preserved" }
          : preSnap
            ? {
                kind: "regressed",
                failing_test: `investigation-mutation-invariant-violated · ${abs}`,
              }
            : { kind: "no_sibling" },
        unavailable_capability: null,
        external_authorization: null,
      };

      // Update conversation head so a follow-up ("What did you find?" /
      // "Explain that") continues in this investigation context.
      updateContextHead({
        conversation_id: input.conversation_id,
        last_verified_result: `investigation on ${activeTarget} · candidates=${candidatesCount}`,
      });
      // Record findings on unified state · active thread
      recordFindings(head, {
        turn: userTurn.turn_id,
        candidate_targets: primaryCandidates,
        verdict: packet.verdict ?? "unspecified",
        rationale: `Investigation of ${activeTarget}`,
      });

      // ─── BATCH 2C-2 · emit agent selection into trace (no dispatch) ──
      // Deterministic rule-based selection · zero LLM · no execution.
      // Selection is INFORMATIONAL for audit/observability only. Any
      // authorised execution still requires Turn 2 auth via existing gates.
      try {
        const { selectAgentForInvestigation } = await import(
          "./capability-investigation-to-agent"
        );
        const sel = selectAgentForInvestigation({
          packet: {
            verdict: packet.verdict,
            candidate_files: packet.candidate_files,
            evidence_for: packet.evidence_for,
            evidence_against: packet.evidence_against,
            confidence: packet.confidence,
            confidence_numeric: packet.confidence_numeric,
            unknown_facts: packet.unknown_facts,
            capability_gaps: packet.capability_gaps,
            hypotheses: packet.hypotheses,
          },
          // Class 2 bridge availability is set by Fix 25 later in this
          // turn; at this point we conservatively pass false. When Fix 25
          // fires and promotes state, its own trace lines already indicate
          // the debugger routing.
          class2_bridge_available: false,
          q8_selected: false,
        });
        if (sel.ok) {
          trace.push(
            `batch2c · agent-selector · rule=${sel.rule_id} · selected_agent=${sel.selected_agent} · reason="${sel.reason.slice(0, 120)}"`,
          );
          beat("investigation_to_agent", "selected", {
            rule_id: sel.rule_id,
            selected_agent: sel.selected_agent,
          });
        } else {
          trace.push(
            `batch2c · agent-selector · refused: ${sel.refusal_kind} · ${sel.detail.slice(0, 120)}`,
          );
        }
      } catch (err) {
        trace.push(
          `batch2c · agent-selector threw · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
        );
      }
      // ─── END BATCH 2C-2 ─────────────────────────────────────────────

      // ─── FIX 30B · HOIST · Retrieve prior context BEFORE Fix 25 so its
      //     comparator can inform (never authorise) the promotion decision.
      //     Prior retrieval binds `priorForFix25` for the block below.
      //     Fix 30 fallback rationale-append remains AFTER Fix 25. ────────
    } catch (err) {
      trace.push(
        `native intelligence · investigation threw · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
      );
      state = "failed";
      summary = {
        ...emptySummary(state),
        verb_family: "INVESTIGATE",
        target_file: activeTarget,
        refusal_kind: "investigation_exception",
      };
    }

    // ─── FIX 30B · Prior retrieval hoisted above Fix 25 ───────────────
    // Deterministic · read-only · R11-B preserved. Result is passed into
    // the Fix 25 salience gate below so the RELATIONSHIP between prior and
    // current evidence can inform the promotion decision.
    let priorForFix25:
      | Awaited<
          ReturnType<
            typeof import("./capability-cross-session-learning").buildPriorContext
          >
        >
      | null = null;
    if (activeTarget) {
      try {
        const { buildPriorContext } = await import(
          "./capability-cross-session-learning"
        );
        beat("procedural_memory", "prior_retrieval_start", { source_file: activeTarget });
        priorForFix25 = buildPriorContext({
          repo_root: input.repo_root ?? process.cwd(),
          source_file: activeTarget,
          max_history: 3,
        });
        trace.push(
          `fix30 · prior-context · status=${priorForFix25.status} · total=${priorForFix25.total_prior_entries} · last=${priorForFix25.recent[0]?.selection_state ?? "n/a"}`,
        );
        beat("episodic_memory", "prior_context_built", {
          status: priorForFix25.status,
          total: priorForFix25.total_prior_entries,
        });
      } catch (err) {
        trace.push(
          `fix30 · prior-context threw · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
        );
      }
    }
    // ─── END FIX 30B hoist ────────────────────────────────────────────

    // ─── FIX 25 · Salience Switch · investigate ↔ code promotion ────────
    //
    // Founder-authorised 2026-09-18. When investigation completes on an
    // open-ended prose input but the composer would otherwise emit
    // `clarification_required` (or `insufficient_evidence`), attempt to
    // deterministically synthesise a coding specification from an adjacent
    // failing test via Fix 24's Class 2 Bridge. If successful, promote the
    // state to `understood` and store a pending coding intent on the
    // conversation thread — exactly the state Batch 1 Closure Test C
    // reaches after Turn 1 of the runtime-verified two-turn coding flow.
    //
    // Preconditions (ALL required · deterministic):
    //   1. State currently in {clarification_required, insufficient_evidence, investigating}
    //   2. An active_target is bound
    //   3. An adjacent test asserts against the target and matches the
    //      Fix 24 parser (toBe/toEqual/toStrictEqual + primitive expected)
    //   4. Class 2 Bridge returns ok:true
    //
    // Preserved invariants:
    //   - Authorization boundary intact: this promotes to `understood`
    //     ONLY; the coding loop still requires Turn 2 explicit
    //     authorisation ("yes go ahead" pattern).
    //   - REMEMBER ≠ SELECT ≠ MODIFY ≠ EXECUTE: nothing is executed here.
    //   - Fix 23a/b/c UNCHANGED.
    //   - Q7/Q8 UNCHANGED (the synthesised prose enters the existing
    //     verified extractor path, not any Q8-authority path).
    if (
      activeTarget &&
      (state === "clarification_required" ||
        state === "insufficient_evidence" ||
        state === "investigating")
    ) {
      try {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const repoRoot = input.repo_root ?? process.cwd();
        const targetAbs = path.isAbsolute(activeTarget)
          ? activeTarget
          : path.join(repoRoot, activeTarget);
        if (fs.existsSync(targetAbs)) {
          const targetDir = path.dirname(targetAbs);
          const targetBase = path
            .basename(targetAbs)
            .replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
          const searchPaths = [
            path.join(targetDir, `${targetBase}.test.ts`),
            path.join(targetDir, `${targetBase}.assertion.ts`),
          ];
          let assertionSource: string | null = null;
          let foundAt: string | null = null;
          for (const p of searchPaths) {
            if (fs.existsSync(p)) {
              try {
                assertionSource = fs.readFileSync(p, "utf8");
                foundAt = p;
                break;
              } catch {
                /* ignore */
              }
            }
          }
          if (assertionSource !== null && foundAt !== null) {
            const { findFirstSupportedAssertion } = await import(
              "./capability-class2-runner"
            );
            const assertion = findFirstSupportedAssertion(assertionSource);
            if (assertion !== null) {
              const { composeExpectedBehaviourFromAssertion } = await import(
                "./capability-class2-bridge"
              );
              const bridge = composeExpectedBehaviourFromAssertion({
                assertion_source: assertion,
                test_file_hint: path.relative(repoRoot, foundAt),
              });
              if (bridge.ok) {
                const targetRel = path.relative(repoRoot, targetAbs);
                const synthesisedGoal = `Fix ${targetRel}. ${bridge.synthesised_prose}`;
                const posixTargetRelForFear = targetRel.split(path.sep).join("/");

                // ─── FEAR · Boundary gate BEFORE any promotion ─────────
                // Deterministic. Assesses BLAST RADIUS of the proposed
                // mutation. HIGH_FEAR blocks promotion so the founder can
                // explicitly authorise the action; ALERTED surfaces a
                // warning but does not block. Modulated by AFRAID: when
                // the session is AFRAID, ALERTED escalates to HIGH_FEAR.
                const { assessFear } = await import("./capability-fear");
                const _rawFear = assessFear({
                  target: posixTargetRelForFear,
                  operation_kind: "MUTATION",
                  preservation_baseline_available: true, // Fix 23c is always available
                  repo_root: repoRoot.split(path.sep).join("/"),
                });
                // Afraid-modulation: raise ALERTED → HIGH_FEAR when session AFRAID.
                const fearAssessment =
                  afraidAssessment.state === "AFRAID" && _rawFear.level === "ALERTED"
                    ? {
                        ..._rawFear,
                        level: "HIGH_FEAR" as const,
                        reason: `${_rawFear.reason} · escalated by AFRAID session state`,
                        block_action: true,
                      }
                    : _rawFear;
                trace.push(
                  `fear · level=${fearAssessment.level} · reason=${fearAssessment.reason_code}${fearAssessment.block_action ? " · BLOCK" : ""}`,
                );
                beat("safety_fear", "assessed", {
                  level: fearAssessment.level,
                  reason_code: fearAssessment.reason_code,
                  block_action: fearAssessment.block_action,
                  target: posixTargetRelForFear,
                });
                if (fearAssessment.block_action) {
                  // HOLD: preserve safety boundary — do NOT promote.
                  // Current evidence still independently evaluated (bridge
                  // ran, produced a candidate). Fear surfaces the risk and
                  // asks the founder for explicit confirmation on this
                  // specific action; it does not override the founder.
                  trace.push(
                    `fear · HOLD promotion · fear=${fearAssessment.level} · ${fearAssessment.reason.slice(0, 160)}`,
                  );
                  state = "refused";
                  summary = {
                    ...summary,
                    state: "refused",
                    verb_family: "FIX",
                    target_file: activeTarget,
                    refusal_kind: `fear_${fearAssessment.reason_code}`,
                    rationale:
                      `Fear boundary triggered: ${fearAssessment.reason}. This action is withheld pending explicit founder confirmation. The current investigation ran independently; only the promotion step is held.`,
                  };
                  // Skip Fix 30B comparator + promotion below. Fear is
                  // authoritative for this turn — the else branch of this
                  // `if (fearAssessment.block_action)` guards the rest.
                }
                // Only run the comparator + promotion when fear did NOT block.
                if (!fearAssessment.block_action) {
                // ─── FIX 30B · Comparator consulted BEFORE promotion ────
                // Deterministic classification of the RELATIONSHIP between
                // the current-turn candidate signature (activeTarget +
                // expected_normalised) and the most recent prior entry for
                // the same file (from Fix 30 retrieval hoisted above).
                //
                // R11-B preserved: relationship is INFORMATIONAL. Only when
                // the RELATIONSHIP is a genuine structural conflict does the
                // gate withhold promotion — it preserves the conflict for
                // founder resolution rather than silently overriding memory.
                const {
                  comparePriorToCurrent,
                  signatureFor,
                } = await import("./capability-prior-evidence-comparator");
                // Normalise path separators to POSIX so signature comparison
                // is Windows/POSIX invariant. The Fix 17 store persists
                // forward-slash paths by JS convention; targetRel from
                // path.relative may use backslashes on Windows.
                const posixTargetRel = targetRel.split(path.sep).join("/");
                const currentSignature = signatureFor(
                  posixTargetRel,
                  bridge.provenance.expected_normalised,
                );
                const relation = comparePriorToCurrent({
                  current_source_file: posixTargetRel,
                  current_candidate_signature: currentSignature,
                  priors: priorForFix25?.recent ?? [],
                });
                trace.push(
                  `fix30b · comparator · relationship=${relation.relationship} · current=${relation.current_signature ?? "n/a"} · prior=${relation.prior_signature ?? "n/a"}`,
                );
                beat("prior_evidence_comparator", "assessed", {
                  relationship: relation.relationship,
                  current_signature: relation.current_signature,
                  prior_signature: relation.prior_signature,
                });
                beat("attention_salience", "bridge_ok_promoting_check");
                beat("class2_bridge", "bridge_composed", {
                  target: posixTargetRel,
                  expected: bridge.provenance.expected_normalised,
                });

                // ─── MICRO-BRAINS · broadcast observations to smaller
                //     brains and record cortex-aggregate consensus. Zero LLM.
                //     Predictions never enter R-4 SUPPORTING count.
                try {
                  const { ALL_MICRO_BRAINS } = await import(
                    "./capability-micro-brains-instances"
                  );
                  const { broadcastToBrains } = await import(
                    "./capability-cortex-router"
                  );
                  const _assertionObs = {
                    kind: "assertion",
                    data: { source: assertion.slice(0, 400) },
                  };
                  const _rShape = broadcastToBrains(ALL_MICRO_BRAINS, _assertionObs);
                  trace.push(
                    `micro-brains · assertion · consensus=${_rShape.consensus} · majority=${_rShape.majority_value ?? "n/a"} · responders=${_rShape.non_null_predictions}/${_rShape.responders}`,
                  );
                  const _fixCtxObs = {
                    kind: "fix_context",
                    data: {
                      adjacent_test_present: true,
                      assertion_parseable: true,
                      protected_target: fearAssessment.reason_code === "target_is_protected_path",
                    },
                  };
                  const _rCtx = broadcastToBrains(ALL_MICRO_BRAINS, _fixCtxObs);
                  trace.push(
                    `micro-brains · fix_context · consensus=${_rCtx.consensus} · majority=${_rCtx.majority_value ?? "n/a"}`,
                  );
                } catch (err) {
                  trace.push(
                    `micro-brains · broadcast threw · ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`,
                  );
                }

                if (relation.relationship === "PRIOR_CONFLICTS_CURRENT") {
                  // HOLD: preserve conflict — do NOT promote to understood.
                  // Current evidence remains independently evaluated (bridge
                  // ran, produced a candidate); we withhold promotion so the
                  // founder can resolve the conflict explicitly. Prior does
                  // NOT become authority — it flags a mismatch.
                  trace.push(
                    `fix30b · HOLD promotion · preserving prior/current conflict · ${relation.reason.slice(0, 160)}`,
                  );
                  // state stays as-is (clarification_required / insufficient /
                  // investigating). Overwrite to clarification_required for
                  // downstream composer clarity.
                  state = "clarification_required";
                  summary = {
                    ...summary,
                    state: "clarification_required",
                    verb_family: "INVESTIGATE",
                    target_file: activeTarget,
                    refusal_kind: "prior_selected_conflicts_current_assertion",
                    rationale:
                      `A structural conflict was detected between the current assertion and a prior investigation on the same file. Prior signature: ${relation.prior_signature ?? "n/a"} · Current signature: ${relation.current_signature ?? "n/a"}. The conflict is preserved for founder resolution; current evidence remains independently evaluated. Prior experience is informational · never authority.`,
                  };
                  // Do NOT set thread.goal or verb=FIX; Fix 25 post-
                  // classification override at end of turn will not fire
                  // because summary.state !== "understood".
                } else {
                  // PROMOTE (relationship informs the rationale but does not
                  // change the promotion decision).
                  const relationshipNote =
                    relation.relationship === "PRIOR_MATCHES_CURRENT"
                      ? " Prior investigation selected the same signature on this file (informational · not authority)."
                      : relation.relationship === "PRIOR_UNRESOLVED_SAME_FILE"
                        ? " Prior investigation on this file was unresolved (informational · not authority)."
                        : relation.relationship === "PRIOR_INFORMATIONAL_ONLY"
                          ? " Prior investigation exists on this file but is not structurally comparable (informational · not authority)."
                          : "";
                  let targetThread = head.threads.find(
                    (t) => t.target === activeTarget && t.closed_turn === null,
                  );
                  if (!targetThread) {
                    targetThread = openThread(head, {
                      target: activeTarget,
                      verb: "FIX",
                      opened_turn: userTurn.turn_id,
                    });
                  }
                  targetThread.goal = synthesisedGoal;
                  targetThread.verb = "FIX";
                  updateContextHead({
                    conversation_id: input.conversation_id,
                    active_task_verb: "FIX",
                  });
                  trace.push(
                    `fix25 · salience-switch · Class 2 Bridge synthesised goal from ${path.relative(repoRoot, foundAt)} · promoting state=${state} → understood`,
                  );
                  trace.push(
                    `fix25 · synthesised prose: ${synthesisedGoal}`,
                  );
                  emitEvent({
                    kind: "pending_goal_stored",
                    data: {
                      thread_id: targetThread.thread_id,
                      target: activeTarget,
                      goal_len: synthesisedGoal.length,
                    },
                  });
                  state = "understood";
                  // ─── CONCERN · signal aggregation on promote path ────
                  // Deterministic. Purely additive: concern surfaces risk in
                  // rationale + trace, never blocks. Fed by comparator +
                  // investigation verdict + bridge success.
                  const { assessConcern } = await import("./capability-concern");
                  const concernAssessment = assessConcern({
                    prior_relationship: relation.relationship,
                    investigation_verdict: null, // packet.verdict not in scope here
                    bridge_ok: true,
                    adjacent_test_unparseable: false,
                    target_discovery_low_confidence: false,
                    ambiguity_count: 0,
                  });
                  trace.push(
                    `concern · level=${concernAssessment.level} · score=${concernAssessment.score} · hits=[${concernAssessment.hits.join(",")}]`,
                  );
                  beat("metacognition_concern", "assessed", {
                    level: concernAssessment.level,
                    score: concernAssessment.score,
                    hits: concernAssessment.hits,
                  });
                  summary = {
                    ...summary,
                    state: "understood",
                    verb_family: "FIX",
                    target_file: activeTarget,
                    rationale:
                      `Investigation found an adjacent failing test. Fix 24 Class 2 Bridge synthesised a coding specification. Authorisation required to apply.${relationshipNote}${concernAssessment.rationale_suffix}`,
                  };
                }
                // ─── END FIX 30B comparator gate ────────────────────────
                } // ─── END FEAR guard (was: if !fearAssessment.block_action) ─
              } else {
                trace.push(
                  `fix25 · bridge refused: ${bridge.refusal_kind} · ${bridge.detail}`,
                );
              }
            } else {
              trace.push(
                `fix25 · adjacent test found at ${path.relative(repoRoot, foundAt)} but no supported assertion`,
              );
            }
          } else {
            trace.push(
              `fix25 · no adjacent .test.ts or .assertion.ts for ${activeTarget}`,
            );
          }
        }
      } catch (err) {
        trace.push(
          `fix25 · salience-switch attempt threw · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
        );
      }
    }
    // ─── END FIX 25 ─────────────────────────────────────────────────────

    // ─── FIX 30 · Fallback rationale-surface for cases where Fix 25 did
    // NOT fire (e.g. no adjacent test) but prior context still exists.
    // Reuses `priorForFix25` retrieved above. Deterministic · read-only ·
    // R11-B enforced: retrieved experience is INFORMATIONAL only. When
    // Fix 25's comparator branch fired, its own rationale is authoritative
    // for this turn and this fallback does not overwrite it.
    if (
      priorForFix25 &&
      priorForFix25.status === "PRIOR_EXPERIENCE_INFORM_ONLY" &&
      priorForFix25.recent.length > 0 &&
      // Only append when Fix 25's own comparator rationale did not fire.
      summary.state !== "understood" &&
      summary.refusal_kind !== "prior_selected_conflicts_current_assertion"
    ) {
      const lastVerdict = priorForFix25.recent[0].selection_state;
      const lastTs = priorForFix25.recent[0].timestamp;
      trace.push(
        `fix30 · prior verdict for ${activeTarget}: ${lastVerdict} @ ${lastTs} · informational only · not authority`,
      );
      summary = {
        ...summary,
        rationale:
          (summary.rationale ?? "") +
          ` [Fix 30 · prior context: ${priorForFix25.total_prior_entries} prior investigation(s) · last verdict ${lastVerdict} · informational only]`,
      };
    }
    // ─── END FIX 30 wiring ─────────────────────────────────────────
  }
  // ─── END GAP A ────────────────────────────────────────────────────────

  // If the classifier extracted an explicit new file target, promote it as
  // the active_target for the next turn's pronoun resolution.
  if (classification.kind === "classified" && classification.file_references.length > 0) {
    updateContextHead({
      conversation_id: input.conversation_id,
      active_target: classification.file_references[0].path,
      active_task_verb: classification.verb_family,
    });
    trace.push(`context updated · active_target=${classification.file_references[0].path}`);
  } else if (resolvedTarget) {
    // Keep active_target as-is; ensure it stays present.
    updateContextHead({
      conversation_id: input.conversation_id,
      active_target: resolvedTarget,
    });
  }

  // ─── FIX 25 post-classification override ────────────────────────────
  // If Fix 25's salience-switch promoted this turn from INVESTIGATE to
  // an understood-coding-intent state (summary.verb_family === "FIX" while
  // the underlying classifier said INVESTIGATE), the classifier-based
  // updateContextHead above just reverted active_task_verb to INVESTIGATE.
  // Re-apply the FIX so Turn 2's follow-up-verb-inheritance picks it up.
  // Deterministic; only fires when Fix 25 actually promoted.
  if (
    summary &&
    summary.verb_family === "FIX" &&
    summary.state === "understood" &&
    activeTarget
  ) {
    updateContextHead({
      conversation_id: input.conversation_id,
      active_task_verb: "FIX",
      active_target: activeTarget,
    });
    trace.push(
      `fix25 · post-classification override · active_task_verb=FIX preserved for next-turn authorisation`,
    );
  }
  // ─── END FIX 25 post-classification override ────────────────────────

  // ─── AFRAID · prepend session-mood prefix to composer rationale ─────
  // The prefix is empty when state === CALM · adds a cautious note when
  // CAUTIOUS · adds a stronger note when AFRAID. Never blocks. Reads a
  // pre-computed assessment from the top of the turn.
  if (afraidAssessment.rationale_prefix.length > 0) {
    summary = {
      ...summary,
      rationale:
        afraidAssessment.rationale_prefix + (summary.rationale ?? ""),
    };
    trace.push(
      `afraid · rationale prefix applied · state=${afraidAssessment.state}`,
    );
  }
  // ─── END AFRAID ─────────────────────────────────────────────────────

  // Compose the reply from structured state
  const ctx = toTurnContext(getConversationHead(input.conversation_id));
  const composed: ComposedResponse = composeChatResponse({
    user_message: input.user_message,
    classification,
    summary,
    ctx,
  });
  trace.push(`composer · state=${composed.state} · text_len=${composed.text.length}`);
  emitEvent({
    kind: "composer",
    data: { state: composed.state, text_len: composed.text.length },
  });

  // Persist NEX1's reply
  const nex1Turn = appendTurn(
    {
      conversation_id: input.conversation_id,
      sender: "nex1",
      text: composed.text,
      state: composed.state,
      trace,
    },
    { repo_root: input.repo_root },
  );

  return {
    ok: true,
    source: "NEX1_NATIVE",
    text: composed.text,
    state: composed.state,
    turn_id: nex1Turn.turn_id,
    classification,
    summary,
    resolved_target: resolvedTarget,
    zero_llm: true,
    evidence_kind: "COMPOSED",
    conversation_head: getConversationHead(input.conversation_id),
    trace,
  };
}
