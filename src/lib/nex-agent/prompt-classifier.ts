// src/lib/nex-agent/prompt-classifier.ts
//
// Heuristic classifier · when the founder types a NEW prompt while NEX1 is
// still coding the ACTIVE task, decide:
//
//   MERGE_WITH_ACTIVE — the new prompt adds important knowledge to the current
//                       task (append as addendum · NEX1 sees it at next checkpoint).
//   QUEUE_AS_NEW      — the new prompt is a separate task (add to queue · NEX1
//                       picks it up when the current task finishes).
//
// Rules of engagement:
//   1. Explicit "new task" / "queue this" language → force QUEUE.
//   2. Explicit continuation cues ("also", "and", "make sure") → lean MERGE.
//   3. High keyword overlap with active prompt → lean MERGE.
//   4. Very short additions (< 40 chars) → lean MERGE (probably a small tweak).
//   5. Ambiguous → default QUEUE (never disrupts the active task).
//
// No LLM call · pure heuristic · fast (~0.1 ms).

export interface ClassificationResult {
  readonly decision: "MERGE_WITH_ACTIVE" | "QUEUE_AS_NEW";
  readonly confidence: number;          // 0..1 · higher = clearer signal
  readonly merge_score: number;
  readonly queue_score: number;
  readonly reasoning: string;
  readonly matched_cues: readonly string[];
  readonly shared_keywords: readonly string[];
}

const CONTINUATION_CUES = [
  "also", "and also", "plus", "make sure", "don't forget", "dont forget",
  "add to", "as well", "in addition", "with that", "along with",
  "same task", "same file", "actually", "wait", "one more", "another thing",
  "along the way", "additionally", "furthermore",
] as const;

const NEW_TASK_CUES = [
  "new task", "separately", "next task", "different thing", "unrelated",
  "afterwards", "after this", "when done", "queue this", "queue that",
  "add to queue", "after that", "later", "second task", "third task",
] as const;

const CODE_KEYWORDS = new Set([
  "file", "route", "page", "component", "endpoint", "api", "database", "table",
  "column", "migration", "schema", "test", "types", "props", "state", "hook",
  "css", "style", "class", "function", "method", "prop", "import", "export",
  "button", "form", "input", "modal", "card", "list", "grid", "layout",
  "header", "footer", "nav", "sidebar", "panel", "toggle", "dropdown",
]);

function extractKeywords(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
  // Keep code-related keywords + words 5+ chars that appear meaningful
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (seen.has(t)) continue;
    if (CODE_KEYWORDS.has(t) || t.length >= 6) {
      kept.push(t);
      seen.add(t);
    }
  }
  return kept;
}

function stripPunctuation(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function classifyPrompt(activePrompt: string, newPrompt: string): ClassificationResult {
  const active = stripPunctuation(activePrompt);
  const incoming = stripPunctuation(newPrompt);
  const matched: string[] = [];
  let mergeScore = 0;
  let queueScore = 0;

  // 1 · Continuation cues bias toward MERGE
  for (const cue of CONTINUATION_CUES) {
    if (incoming.includes(cue)) {
      mergeScore += 1;
      matched.push(`+merge: "${cue}"`);
    }
  }
  // 2 · New-task cues bias toward QUEUE (stronger weight)
  for (const cue of NEW_TASK_CUES) {
    if (incoming.includes(cue)) {
      queueScore += 2;
      matched.push(`+queue: "${cue}"`);
    }
  }
  // 3 · Shared keywords
  const activeWords = extractKeywords(activePrompt);
  const newWords = extractKeywords(newPrompt);
  const activeSet = new Set(activeWords);
  const shared = newWords.filter((w) => activeSet.has(w));
  if (shared.length >= 3) {
    const bonus = Math.min(shared.length, 5);
    mergeScore += bonus;
    matched.push(`+merge: shared keywords x${shared.length}`);
  } else if (shared.length === 0 && activeWords.length > 3 && newWords.length > 3) {
    queueScore += 1;
    matched.push(`+queue: zero shared keywords`);
  }
  // 4 · Very short prompts are usually addendums
  if (newPrompt.length < 40) {
    mergeScore += 1;
    matched.push(`+merge: short (${newPrompt.length} chars)`);
  }
  // 5 · Explicit "queue" / "later" language → strong queue signal
  if (/\bqueue\b/i.test(newPrompt)) {
    queueScore += 2;
    matched.push(`+queue: explicit "queue"`);
  }

  // Decision: MERGE only if it clearly wins · otherwise safe default is QUEUE
  const decision: ClassificationResult["decision"] =
    mergeScore >= queueScore + 2 ? "MERGE_WITH_ACTIVE" : "QUEUE_AS_NEW";

  const total = mergeScore + queueScore;
  const confidence = total > 0 ? Math.min(0.95, Math.abs(mergeScore - queueScore) / Math.max(total, 1)) : 0.3;

  const reasoning = decision === "MERGE_WITH_ACTIVE"
    ? `MERGE · merge_score=${mergeScore} beats queue_score=${queueScore} by ≥2 · new prompt adds context to the active task.`
    : `QUEUE · merge_score=${mergeScore} · queue_score=${queueScore} · not enough signal to interrupt the active task · queued as a separate task.`;

  return {
    decision,
    confidence,
    merge_score: mergeScore,
    queue_score: queueScore,
    reasoning,
    matched_cues: matched,
    shared_keywords: shared,
  };
}
