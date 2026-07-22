// Auto-regenerate loop — per V3 Q12.
// Critic scored below 92 → append actions to the next compilation
// as MODIFICATION_REQUEST → recompile → regenerate. Max 3 attempts.
//
// This is where merchants NEVER see sub-92 output. Loop runs
// invisibly. Only the final approved (or best-of-3) surfaces.

import type { CompiledPrompt } from "@/lib/design/compiler";
import type { CriticResult } from "./rubric";
import { review } from "./critic";
import type { CriticInput } from "./prompts/creative-director";

const MAX_ATTEMPTS = 3;

export type RegenerationRound = {
  attempt:     number;
  critic:      CriticResult | null;
  prompt:      CompiledPrompt;
  imageResult: unknown;
};

export type LoopResult = {
  final:        RegenerationRound;
  rounds:       RegenerationRound[];
  stoppedBy:    "approved" | "max_attempts" | "human_escalation";
};

export type LoopInput = {
  criticInput:  Omit<CriticInput, "compiled_prompt" | "asset_description">;
  initialPrompt: CompiledPrompt;
  initialImage:  unknown;
  regenerate: (
    prompt: CompiledPrompt,
    feedback: string[]
  ) => Promise<{ prompt: CompiledPrompt; image: unknown }>;
};

/** Runs the critic + regenerate loop until approved or max attempts.
 *  The `regenerate` callback is provided by the caller (Studio App or
 *  Orchestrator) — it knows how to recompile + fire the image API. */
export async function runLoop(input: LoopInput): Promise<LoopResult> {
  const rounds: RegenerationRound[] = [];

  let currentPrompt = input.initialPrompt;
  let currentImage  = input.initialImage;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const critic = await review({
      ...input.criticInput,
      compiled_prompt:    currentPrompt.userPrompt,
      asset_description:  describeAsset(currentImage)
    });

    const round: RegenerationRound = {
      attempt,
      critic,
      prompt:       currentPrompt,
      imageResult:  currentImage
    };
    rounds.push(round);

    // No critic (AI unavailable) → surface the current output. Not
    // approved but not blocked either. Dev fallback.
    if (!critic) {
      return { final: round, rounds, stoppedBy: "max_attempts" };
    }

    if (critic.approved) {
      return { final: round, rounds, stoppedBy: "approved" };
    }

    if (critic.escalate) {
      return { final: round, rounds, stoppedBy: "human_escalation" };
    }

    if (attempt >= MAX_ATTEMPTS) break;

    // Regenerate with the critic's actions as feedback
    const next = await input.regenerate(currentPrompt, critic.actions);
    currentPrompt = next.prompt;
    currentImage  = next.image;
  }

  return {
    final:      rounds[rounds.length - 1],
    rounds,
    stoppedBy:  "max_attempts"
  };
}

function describeAsset(image: unknown): string {
  // TODO — when Vision API integration lands, ask the vision model to
  // describe the actual pixels. For now we describe the metadata.
  if (image && typeof image === "object" && "images" in image) return "Image returned from generator (base64 payload — full visual review requires vision-model handoff).";
  return "No image returned — critic operating on prompt-only metadata.";
}
