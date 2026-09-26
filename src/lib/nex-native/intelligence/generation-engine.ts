// src/lib/nex-native/intelligence/generation-engine.ts
//
// NEX Generation Engine · orchestrator (server-only).
// ---------------------------------------------------
// This is the NEX-owned engine that sits between the NEX Intelligence
// runtime (runProviderStream / NexBrainProvider) and the raw open-weight
// model. It is the layer that makes NEX responsible for output quality.
//
// One generation cycle:
//   1. Ask the selected model to generate a reply.
//   2. Validate the output (validator.ts).
//   3. If invalid AND retries remain, ask again with a correction hint.
//   4. Repeat up to `maxAttempts`.
//   5. Return the accepted output OR an honest gap describing why
//      generation failed after all attempts.
//
// The engine deliberately does NOT rewrite failed output itself. If the
// model cannot produce a valid reply, NEX honestly returns nothing rather
// than shipping a bad one · matches Founder honesty doctrine.

import "server-only";
import type {
  NexGenerationModel,
  NexChatMessage,
  NexModelGenerateOptions,
} from "./models/types";
import {
  validateOutput,
  buildCorrectionHint,
  type ValidatorFinding,
} from "./validator";
import { recordEngineEvent } from "./telemetry";

export interface EngineInput {
  systemPrompt: string;
  messages: NexChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface EngineAttempt {
  attempt: number;
  latencyMs: number;
  outputPreview: string;
  outputLength: number;
  findings: ValidatorFinding[];
  correctionHintApplied: string | null;
}

export type EngineOutcome =
  | {
      ok: true;
      text: string;
      modelId: string;
      totalLatencyMs: number;
      attempts: EngineAttempt[];
    }
  | {
      ok: false;
      error: string;
      modelId: string | null;
      totalLatencyMs: number;
      attempts: EngineAttempt[];
    };

export interface EngineOptions {
  maxAttempts?: number; // total attempts including initial · default 3
}

export async function runGenerationEngine(
  model: NexGenerationModel,
  input: EngineInput,
  opts: EngineOptions = {}
): Promise<EngineOutcome> {
  const maxAttempts = Math.max(1, Math.min(5, opts.maxAttempts ?? 3));
  const overallStart = Date.now();
  const attemptRecords: EngineAttempt[] = [];

  const genOpts: NexModelGenerateOptions = {
    maxNewTokens: input.maxTokens ?? 400,
    temperature: input.temperature ?? 0.35,
  };

  // Locate the last user message (used by validator + correction hints)
  const lastUserMessage = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  let correctionHint: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Assemble the messages for THIS attempt. On retries we amend the
    // system prompt with a correction hint appended (not the messages
    // themselves) — keeps the conversation clean and doesn't confuse the
    // model with a fake prior turn.
    const systemForAttempt = correctionHint
      ? `${input.systemPrompt}\n\nCORRECTION: ${correctionHint}`
      : input.systemPrompt;

    const messages: NexChatMessage[] = [
      { role: "system", content: systemForAttempt },
      ...input.messages,
    ];

    // Retries use slightly higher temperature to escape a stuck loop
    const attemptTemperature = attempt === 1
      ? (genOpts.temperature ?? 0.35)
      : Math.min(0.9, (genOpts.temperature ?? 0.35) + 0.15 * (attempt - 1));

    const gen = await model.generate(messages, {
      ...genOpts,
      temperature: attemptTemperature,
    });

    if (!gen.ok) {
      attemptRecords.push({
        attempt,
        latencyMs: 0,
        outputPreview: "",
        outputLength: 0,
        findings: [],
        correctionHintApplied: correctionHint,
      });
      // Model itself failed hard · no retry can fix that.
      const totalMs = Date.now() - overallStart;
      recordEngineEvent({
        ts: new Date().toISOString(),
        modelId: model.id,
        outcome: "errored",
        attempts: attemptRecords.length,
        findings: [],
        totalLatencyMs: totalMs,
        error: gen.error,
      });
      return {
        ok: false,
        error: gen.error,
        modelId: model.id,
        totalLatencyMs: totalMs,
        attempts: attemptRecords,
      };
    }

    const validated = validateOutput({
      systemPrompt: systemForAttempt,
      userMessage: lastUserMessage,
      output: gen.result.text,
    });

    attemptRecords.push({
      attempt,
      latencyMs: gen.result.latencyMs,
      outputPreview: gen.result.text.slice(0, 180),
      outputLength: gen.result.text.length,
      findings: validated.findings,
      correctionHintApplied: correctionHint,
    });

    if (validated.ok) {
      const totalMs = Date.now() - overallStart;
      recordEngineEvent({
        ts: new Date().toISOString(),
        modelId: model.id,
        outcome: "accepted",
        attempts: attemptRecords.length,
        findings: Array.from(new Set(attemptRecords.flatMap((a) => a.findings))),
        totalLatencyMs: totalMs,
      });
      return {
        ok: true,
        text: gen.result.text,
        modelId: model.id,
        totalLatencyMs: totalMs,
        attempts: attemptRecords,
      };
    }

    // Prepare correction for next attempt
    correctionHint = buildCorrectionHint(validated);
  }

  const lastFindings = attemptRecords[attemptRecords.length - 1]?.findings ?? [];
  const totalMs = Date.now() - overallStart;
  recordEngineEvent({
    ts: new Date().toISOString(),
    modelId: model.id,
    outcome: "rejected",
    attempts: attemptRecords.length,
    findings: Array.from(new Set(attemptRecords.flatMap((a) => a.findings))),
    totalLatencyMs: totalMs,
    error: `validator_rejected_all_attempts · findings=${lastFindings.join("|")}`,
  });
  return {
    ok: false,
    error: `validator_rejected_all_attempts · findings=${lastFindings.join("|")}`,
    modelId: model.id,
    totalLatencyMs: totalMs,
    attempts: attemptRecords,
  };
}
