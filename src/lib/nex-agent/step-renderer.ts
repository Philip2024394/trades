// src/lib/nex-agent/step-renderer.ts
//
// Pure helpers · extract structured content from a NEX1 step body:
//   - Decision options (with a "recommended" flag)
//   - Fenced code blocks (```lang ... ``` inside text fields)
//   - Explicit code fields (body.code / body.sql / body.migration_sql)
//
// The UI renders these differently: decision cards + copy-clean code containers.

export interface DecisionOption {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly recommended: boolean;
}

export interface StepDecision {
  readonly question: string;
  readonly options: readonly DecisionOption[];
}

export interface StepCodeBlock {
  readonly language: string;
  readonly code: string;
  readonly note: string | null;
}

/**
 * Extract decision options from a step body. Supports two shapes:
 *   1. body.options = [{ id, label, description, recommended }]
 *   2. body.decision = { question, options }
 * Returns null if the step is not a decision step.
 */
export function extractDecision(body: unknown): StepDecision | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const rawOptions =
    (Array.isArray(b.options) && b.options) ||
    (b.decision && typeof b.decision === "object" && Array.isArray((b.decision as Record<string, unknown>).options)
      ? ((b.decision as Record<string, unknown>).options as unknown[])
      : null);

  if (!rawOptions || rawOptions.length < 2) return null;

  const question =
    (typeof b.question === "string" ? b.question : null) ??
    (b.decision && typeof b.decision === "object" && typeof (b.decision as Record<string, unknown>).question === "string"
      ? String((b.decision as Record<string, unknown>).question)
      : "NEX1 needs a decision");

  const options: DecisionOption[] = [];
  let sawRecommended = false;
  for (const raw of rawOptions) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = String(o.id ?? o.value ?? o.key ?? "").trim();
    const label = String(o.label ?? o.title ?? o.name ?? id).trim();
    if (!id || !label) continue;
    const description = typeof o.description === "string" ? o.description : (typeof o.detail === "string" ? o.detail : null);
    const recommended = !!(o.recommended ?? o.suggested ?? o.best);
    if (recommended) sawRecommended = true;
    options.push({ id, label, description, recommended });
  }
  if (options.length < 2) return null;
  // Ensure exactly one recommended · if none marked, mark the first
  if (!sawRecommended) {
    options[0] = { ...options[0], recommended: true };
  }
  return { question, options };
}

/**
 * Extract explicit code fields from a step body: body.code / body.sql / body.migration_sql.
 * These are separate from the fenced-code extraction (which reads from text).
 */
export function extractExplicitCodeBlocks(body: unknown): readonly StepCodeBlock[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  const out: StepCodeBlock[] = [];

  if (typeof b.sql === "string" && b.sql.trim().length > 0) {
    out.push({ language: "sql", code: b.sql, note: typeof b.sql_note === "string" ? b.sql_note : null });
  }
  if (typeof b.migration_sql === "string" && b.migration_sql.trim().length > 0) {
    out.push({ language: "sql", code: b.migration_sql, note: "migration" });
  }
  if (typeof b.code === "string" && b.code.trim().length > 0) {
    const lang = typeof b.language === "string" ? b.language : "text";
    out.push({ language: lang, code: b.code, note: null });
  }
  // proposed_files (from the plan) with preview_content
  if (Array.isArray(b.proposed_files)) {
    for (const raw of b.proposed_files) {
      if (!raw || typeof raw !== "object") continue;
      const pf = raw as Record<string, unknown>;
      const preview = typeof pf.preview_content === "string" ? pf.preview_content : "";
      if (!preview) continue;
      const lang = typeof pf.language === "string" ? pf.language : "text";
      const path = typeof pf.path === "string" ? pf.path : "file";
      out.push({ language: lang, code: preview, note: path });
    }
  }
  return out;
}

/**
 * Parse fenced code blocks from an arbitrary text string. Handles ```lang ... ```
 * and returns each code block plus the surrounding prose split into segments.
 */
export interface TextSegment {
  readonly kind: "text" | "code";
  readonly text: string;
  readonly language?: string;
}

const FENCE_RE = /```([A-Za-z0-9_+-]*)\n([\s\S]*?)```/g;

export function splitTextAndCode(input: string): readonly TextSegment[] {
  if (!input) return [];
  const segments: TextSegment[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(input)) !== null) {
    if (m.index > cursor) {
      const prose = input.slice(cursor, m.index).trim();
      if (prose) segments.push({ kind: "text", text: prose });
    }
    segments.push({ kind: "code", text: m[2], language: m[1] || "text" });
    cursor = FENCE_RE.lastIndex;
  }
  if (cursor < input.length) {
    const tail = input.slice(cursor).trim();
    if (tail) segments.push({ kind: "text", text: tail });
  }
  return segments;
}

/**
 * Best-effort summary text for a step body when it isn't a decision or code
 * block. Same output as the previous compactBody helper.
 */
export function compactBodySummary(body: unknown): string {
  if (!body || typeof body !== "object") return String(body ?? "").slice(0, 240);
  try {
    const b = body as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof b.summary === "string") parts.push(String(b.summary));
    if (typeof b.round === "number") parts.push(`round ${b.round}`);
    if (typeof b.gate === "string") parts.push(`gate ${b.gate}`);
    if (typeof b.ok === "boolean") parts.push(b.ok ? "ok" : "fail");
    if (typeof b.error_count === "number" && b.error_count > 0) parts.push(`${b.error_count} error(s)`);
    if (Array.isArray(b.changes_applied)) parts.push(`applied ${b.changes_applied.length}`);
    if (typeof b.branch_deleted === "string") parts.push(`branch ${b.branch_deleted} dropped`);
    if (parts.length > 0) return parts.join(" · ");
    return JSON.stringify(b).slice(0, 240);
  } catch {
    return String(body).slice(0, 240);
  }
}
