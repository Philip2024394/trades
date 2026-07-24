// AB answer router — "what needs my approval?" / "what did you do
// overnight?" / "what mode am I on?" / multi-agent invocations.

import { buildApprovalQueue } from "./queue";
import { buildOvernightRun, overnightRunToText, approvalQueueToText } from "./overnight";
import { detectAgent, routeToAgent } from "./agents";
import { resolveAutonomy, DEFAULT_MODE } from "./modes";
import { MODE_LABELS } from "./types";

export type ABQuestion =
  | { kind: "approvals" }
  | { kind: "overnight" }
  | { kind: "mode" }
  | { kind: "agent"; agent: import("./types").NexAgent; rest: string }
  | { kind: "none" };

export function classifyABQuestion(text: string): ABQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  // Agent handles first so the question routes correctly.
  const agentHit = detectAgent(text);
  if (agentHit) return { kind: "agent", agent: agentHit.agent, rest: agentHit.rest };

  if (/\bwhat\s+needs\s+my\s+approval\b|\bapproval\s+queue\b|\bpending\s+approvals?\b/.test(t)) return { kind: "approvals" };
  if (/\bwhat\s+did\s+you\s+do\s+overnight\b|\bovernight\s+run\b|\bwhat'?s\s+happened\s+overnight\b/.test(t)) return { kind: "overnight" };
  if (/\bwhat\s+mode\s+am\s+i\s+on\b|\bautonomy\s+mode\b|\bwhat'?s\s+my\s+autonomy\b/.test(t)) return { kind: "mode" };

  return { kind: "none" };
}

export type AnswerABInput = {
  question:     ABQuestion;
  merchantSlug: string;
};

export async function answerAB(input: AnswerABInput): Promise<string> {
  switch (input.question.kind) {
    case "approvals": {
      const q = await buildApprovalQueue({ merchantSlug: input.merchantSlug });
      return approvalQueueToText(q.actions);
    }
    case "overnight": {
      const run = await buildOvernightRun({ merchantSlug: input.merchantSlug });
      return overnightRunToText(run);
    }
    case "mode": {
      const settings = resolveAutonomy({ merchantSlug: input.merchantSlug });
      const lines = [
        `Autonomy mode: ${settings.mode} (${MODE_LABELS[settings.mode]}).`,
        `Source: ${settings.source === "engine_default" ? "engine default (no per-merchant preference set)" : "your override"}.`,
        `Trusted categories: ${settings.trusted_categories.length === 0 ? "none" : settings.trusted_categories.join(", ")}.`
      ];
      if (settings.mode === DEFAULT_MODE) {
        lines.push("");
        lines.push("Everything I prepare waits for you. No action fires without your explicit approval.");
      }
      return lines.join("\n");
    }
    case "agent": {
      return routeToAgent({ agent: input.question.agent, question: input.question.rest, merchantSlug: input.merchantSlug });
    }
    case "none":
      return "";
  }
}
