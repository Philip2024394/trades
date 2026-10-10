// §36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers
// NEX bounded infrastructure · specialist-reviewers primitive · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O. Five domain-specific reviewers + dispatcher.
// Each reviewer emits categorical findings using deterministic string
// analysis. Zero LLM · zero AST · zero subprocess.

import type { SkillCandidate } from "../skills/skill-schema-types";
import type {
  RunSpecialistsFailure,
  RunSpecialistsRequest,
  RunSpecialistsResult,
  RunSpecialistsSuccess,
  SpecialistFinding,
  SpecialistFindingId,
  SpecialistFindingSeverity,
  SpecialistId,
  SpecialistOverallVerdict,
  SpecialistPerFindingsResult,
} from "./specialist-reviewer-types";
import {
  FINDING_ID_SEVERITY_MAP,
  SPECIALIST_IDS,
} from "./specialist-reviewer-types";

const GREP_MARKER = "§36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers" as const;

// ── Failure helper ──────────────────────────────────────────────────────

function fail(
  code: RunSpecialistsFailure["refusal_code"],
  reason: string,
  offending_specialist: SpecialistId | null = null,
): RunSpecialistsFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    offending_specialist,
    grep_marker: GREP_MARKER,
  };
}

// ── Finding constructor with severity lookup ────────────────────────────

function finding(
  specialist_id: SpecialistId,
  finding_id: SpecialistFindingId,
  evidence_summary: string,
): SpecialistFinding {
  return {
    specialist_id,
    finding_id,
    severity: FINDING_ID_SEVERITY_MAP[finding_id],
    evidence_summary,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function content(candidate: SkillCandidate): string {
  return candidate.proposed_content ?? "";
}

function hasRegex(text: string, regex: RegExp): boolean {
  return regex.test(text);
}

// ── Specialist 1 · typescript-architecture-reviewer ─────────────────────

function typescriptArchitectureReviewer(c: SkillCandidate): SpecialistFinding[] {
  const findings: SpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;

  // Deep relative imports (../../../ or deeper).
  if (hasRegex(text, /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\//)) {
    findings.push(
      finding(
        "typescript-architecture-reviewer",
        "TSA_DEEP_RELATIVE_IMPORT",
        "import path contains ../../../ or deeper · consider re-organising modules or using a workspace alias",
      ),
    );
  }
  // Types-file that has a non-type runtime import.
  if (/-types\.ts$/.test(path) && hasRegex(text, /^import\s+[^t]/m)) {
    // Anything not starting with 'import type' after 'import '
    const runtimeImport = /^import\s+(?!type\b)/m.exec(text);
    if (runtimeImport) {
      findings.push(
        finding(
          "typescript-architecture-reviewer",
          "TSA_TYPE_FILE_HAS_RUNTIME_IMPORT",
          `file matching *-types.ts imports non-type module ('${runtimeImport[0].trim()}...')`,
        ),
      );
    }
  }
  // Bypass of module boundary via _internal / private path segment.
  if (hasRegex(text, /from\s+['"][^'"]*\/(?:_internal|private)\//)) {
    findings.push(
      finding(
        "typescript-architecture-reviewer",
        "TSA_INTERNAL_IMPORT_BYPASS",
        "import references a /_internal/ or /private/ path · module boundary bypass",
      ),
    );
  }
  // Same-directory sibling that could form a cycle · advisory heuristic.
  const siblingImports = text.match(/from\s+['"]\.\/[a-zA-Z0-9_-]+['"]/g) ?? [];
  if (siblingImports.length >= 3) {
    findings.push(
      finding(
        "typescript-architecture-reviewer",
        "TSA_CIRCULAR_SIBLING_IMPORT",
        `${siblingImports.length} same-directory sibling imports detected · verify no cycles`,
      ),
    );
  }
  return findings;
}

// ── Specialist 2 · typescript-type-safety-reviewer ──────────────────────

function typescriptTypeSafetyReviewer(c: SkillCandidate): SpecialistFinding[] {
  const findings: SpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;

  if (hasRegex(text, /:\s*any\b|\bas\s+any\b/)) {
    findings.push(
      finding(
        "typescript-type-safety-reviewer",
        "TTS_EXPLICIT_ANY",
        "explicit 'any' type used · replace with a specific type or 'unknown'",
      ),
    );
  }
  if (hasRegex(text, /\bas\s+unknown\s+as\s+/)) {
    findings.push(
      finding(
        "typescript-type-safety-reviewer",
        "TTS_UNCHECKED_CAST",
        "chained 'as unknown as' cast detected · bypasses TypeScript type safety",
      ),
    );
  }
  // throw in a non-test file that also exports a Result-shaped type.
  const isTestFile = /\.test\.ts$|\/__tests__\//.test(path);
  const hasResultType = hasRegex(text, /\btype\s+\w*Result\s*=|\binterface\s+\w*Failure\b/);
  if (!isTestFile && hasResultType && hasRegex(text, /\bthrow\s+new\s+/)) {
    findings.push(
      finding(
        "typescript-type-safety-reviewer",
        "TTS_UNCONTROLLED_THROW",
        "file declares a Result/Failure type yet also throws · prefer refusal via Result",
      ),
    );
  }
  // switch without default when a typed union is switched on (heuristic: presence of both).
  if (hasRegex(text, /\bswitch\s*\(/) && !hasRegex(text, /\bdefault\s*:/)) {
    findings.push(
      finding(
        "typescript-type-safety-reviewer",
        "TTS_NON_EXHAUSTIVE_SWITCH",
        "switch without default clause · exhaustive discrimination not guaranteed",
      ),
    );
  }
  // async function returning Promise without an obvious Result union.
  if (hasRegex(text, /\basync\s+function\b/) && !hasRegex(text, /\|\s*\w*Failure\b|Result</)) {
    findings.push(
      finding(
        "typescript-type-safety-reviewer",
        "TTS_MISSING_RESULT_TYPE",
        "async function without a Result/Failure union in signature · consider refusal-first design",
      ),
    );
  }
  return findings;
}

// ── Specialist 3 · react-component-reviewer ─────────────────────────────

function reactComponentReviewer(c: SkillCandidate): SpecialistFinding[] {
  const findings: SpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;

  // Only meaningful for TSX / component files.
  const isReactCandidate = /\.tsx$/.test(path) || hasRegex(text, /\bfrom\s+['"]react['"]/);
  if (!isReactCandidate) return findings;

  const hasUseClient = hasRegex(text, /^\s*['"]use client['"]\s*;?\s*$/m);

  // Hook inside conditional heuristic: use\w+\( inside an if-block on same line.
  if (hasRegex(text, /\bif\s*\([^)]*\)[^{]*\{[^}]*\buse[A-Z]\w+\s*\(/)) {
    findings.push(
      finding(
        "react-component-reviewer",
        "RCR_HOOK_INSIDE_CONDITIONAL",
        "hook (useX) invoked inside an if-block · violates rules of hooks",
      ),
    );
  }
  // State primitives in server component (no "use client").
  if (!hasUseClient && hasRegex(text, /\b(useState|useReducer|useRef)\s*\(/)) {
    findings.push(
      finding(
        "react-component-reviewer",
        "RCR_STATE_IN_SERVER_COMPONENT",
        "useState/useReducer/useRef in a server component · add 'use client' or move state to client component",
      ),
    );
  }
  // Empty deps array while referencing outer variables in an effect (advisory heuristic).
  if (hasRegex(text, /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*\}\s*,\s*\[\s*\]\s*\)/)) {
    // If the effect body has more than 1 line, deps=[] is suspicious.
    findings.push(
      finding(
        "react-component-reviewer",
        "RCR_MISSING_EFFECT_DEPS",
        "useEffect with empty dependency array · verify no captured variables are missing",
      ),
    );
  }
  // Direct DOM access outside a client component.
  if (!hasUseClient && hasRegex(text, /\b(document|window)\./)) {
    findings.push(
      finding(
        "react-component-reviewer",
        "RCR_DIRECT_DOM_ACCESS",
        "document. or window. accessed in a non-client-marked file",
      ),
    );
  }
  // Async client component.
  if (hasUseClient && hasRegex(text, /export\s+default\s+async\s+function/)) {
    findings.push(
      finding(
        "react-component-reviewer",
        "RCR_ASYNC_CLIENT_COMPONENT",
        "'use client' file has an async default export · async components are server-only",
      ),
    );
  }
  return findings;
}

// ── Specialist 4 · sql-migration-reviewer ───────────────────────────────

function sqlMigrationReviewer(c: SkillCandidate): SpecialistFinding[] {
  const findings: SpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;

  const looksLikeMigration = /\.(sql|ts|js|mts|cts)$/.test(path) && (
    hasRegex(text, /\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+INDEX|DROP\s+INDEX|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+)/i)
  );
  if (!looksLikeMigration) return findings;

  if (hasRegex(text, /\bDROP\s+(TABLE|COLUMN|INDEX)\b(?!\s+IF\s+EXISTS)/i)) {
    findings.push(
      finding(
        "sql-migration-reviewer",
        "SMR_DROP_WITHOUT_IF_EXISTS",
        "DROP TABLE|COLUMN|INDEX without IF EXISTS · migration is not idempotent",
      ),
    );
  }
  if (hasRegex(text, /ADD\s+COLUMN\s+\w+\s+\w+[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)/i)) {
    findings.push(
      finding(
        "sql-migration-reviewer",
        "SMR_ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT",
        "ADD COLUMN ... NOT NULL without DEFAULT · will fail on non-empty tables",
      ),
    );
  }
  if (hasRegex(text, /\bDELETE\s+FROM\s+\w+\s*;/i)) {
    findings.push(
      finding(
        "sql-migration-reviewer",
        "SMR_UNSCOPED_DELETE",
        "DELETE FROM table without WHERE clause · deletes every row",
      ),
    );
  }
  if (hasRegex(text, /\bCREATE\s+INDEX\b(?!\s+CONCURRENTLY\b)/i)) {
    findings.push(
      finding(
        "sql-migration-reviewer",
        "SMR_INDEX_NOT_CONCURRENT",
        "CREATE INDEX without CONCURRENTLY · takes an exclusive lock during creation",
      ),
    );
  }
  if (!hasRegex(text, /\bdown\b|\breverse\b|\brollback\b/i)) {
    findings.push(
      finding(
        "sql-migration-reviewer",
        "SMR_MISSING_DOWN_MIGRATION",
        "no down/reverse/rollback reference · migration may be irreversible",
      ),
    );
  }
  return findings;
}

// ── Specialist 5 · nex-agent-runtime-boundary-reviewer ──────────────────

function nexAgentRuntimeBoundaryReviewer(c: SkillCandidate): SpecialistFinding[] {
  const findings: SpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;

  const isNexRuntime = /^src\/lib\/nex-agent-runtime\//.test(path);
  if (!isNexRuntime) return findings;

  if (!hasRegex(text, /§36-[A-Z0-9-]+ · [A-Z]+-[A-Z0-9-]+ · \d{4}-\d{2}-\d{2}/)) {
    findings.push(
      finding(
        "nex-agent-runtime-boundary-reviewer",
        "NRB_MISSING_GREP_MARKER",
        "runtime file lacks §36 grep marker · governance traceability broken",
      ),
    );
  }
  if (hasRegex(text, /\bfs\.(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)\b/)) {
    findings.push(
      finding(
        "nex-agent-runtime-boundary-reviewer",
        "NRB_FS_WRITE_IN_RUNTIME",
        "fs write operation in runtime primitive · zero-I/O boundary violated",
      ),
    );
  }
  if (hasRegex(text, /["']child_process["']|from\s+["']node:child_process["']/)) {
    findings.push(
      finding(
        "nex-agent-runtime-boundary-reviewer",
        "NRB_SUBPROCESS_IN_RUNTIME",
        "child_process referenced in runtime · zero-subprocess boundary violated",
      ),
    );
  }
  if (hasRegex(text, /\bfetch\s*\(|\bhttp\.[a-z]+\(|\bhttps\.[a-z]+\(|\bWebSocket\b/)) {
    findings.push(
      finding(
        "nex-agent-runtime-boundary-reviewer",
        "NRB_NETWORK_IN_RUNTIME",
        "network primitive referenced · runtime should have zero network access",
      ),
    );
  }
  if (!hasRegex(text, /\btype\s+\w*RefusalCode\b|\|\s*"[A-Z]{2,}_[A-Z_]+"/)) {
    findings.push(
      finding(
        "nex-agent-runtime-boundary-reviewer",
        "NRB_MISSING_REFUSAL_UNION",
        "no RefusalCode union detected · runtime primitives should be refusal-first",
      ),
    );
  }
  if (!hasRegex(text, /NEX bounded infrastructure|Coded by NEX1/)) {
    findings.push(
      finding(
        "nex-agent-runtime-boundary-reviewer",
        "NRB_MISSING_NEX_AUTHORSHIP_HEADER",
        "file lacks 'NEX bounded infrastructure' or 'Coded by NEX1' authorship header",
      ),
    );
  }
  return findings;
}

// ── Dispatcher ─────────────────────────────────────────────────────────

const SPECIALIST_IMPLEMENTATIONS: Record<SpecialistId, (c: SkillCandidate) => SpecialistFinding[]> = {
  "typescript-architecture-reviewer": typescriptArchitectureReviewer,
  "typescript-type-safety-reviewer": typescriptTypeSafetyReviewer,
  "react-component-reviewer": reactComponentReviewer,
  "sql-migration-reviewer": sqlMigrationReviewer,
  "nex-agent-runtime-boundary-reviewer": nexAgentRuntimeBoundaryReviewer,
};

// ── Candidate structural check ─────────────────────────────────────────

function isValidCandidate(candidate: unknown): candidate is SkillCandidate {
  if (!candidate || typeof candidate !== "object") return false;
  const c = candidate as Record<string, unknown>;
  return typeof c.workspace_relative_path === "string"
    && typeof c.change_kind === "string"
    && typeof c.authorised === "boolean";
}

// ── Overall verdict derivation (locked) ────────────────────────────────

function deriveOverallVerdict(counts: {
  critical: number;
  warning: number;
  advisory: number;
}): SpecialistOverallVerdict {
  if (counts.critical > 0 || counts.warning > 0) return "action_required";
  if (counts.advisory > 0) return "advisory_only";
  return "no_findings";
}

// ── Entry point ────────────────────────────────────────────────────────

export function runSpecialistReviewers(request: RunSpecialistsRequest): RunSpecialistsResult {
  if (!request || typeof request !== "object") {
    return fail("SREV_INVALID_REQUEST", "request required");
  }
  if (!isValidCandidate(request.candidate)) {
    return fail("SREV_INVALID_CANDIDATE", "candidate must be a well-formed SkillCandidate");
  }
  const requested: readonly SpecialistId[] = request.specialists_to_run === "all"
    ? SPECIALIST_IDS
    : request.specialists_to_run;
  if (!Array.isArray(requested)) {
    return fail("SREV_INVALID_REQUEST", "specialists_to_run must be an array or 'all'");
  }
  for (const id of requested) {
    if (!SPECIALIST_IDS.includes(id)) {
      return fail("SREV_UNKNOWN_SPECIALIST", `unknown specialist_id '${id}'`, id as SpecialistId);
    }
  }

  const per_specialist: SpecialistPerFindingsResult[] = [];
  const counts = { critical: 0, warning: 0, advisory: 0 };
  let total = 0;

  for (const id of requested) {
    const impl = SPECIALIST_IMPLEMENTATIONS[id];
    const findings = impl(request.candidate);
    per_specialist.push({
      specialist_id: id,
      findings: Object.freeze(findings),
    });
    for (const f of findings) {
      total++;
      counts[f.severity as keyof typeof counts]++;
    }
  }

  const success: RunSpecialistsSuccess = {
    kind: "SUCCESS",
    per_specialist: Object.freeze(per_specialist),
    total_findings: total,
    critical_count: counts.critical,
    warning_count: counts.warning,
    advisory_count: counts.advisory,
    overall_verdict: deriveOverallVerdict(counts),
    grep_marker: GREP_MARKER,
  };
  return success;
}

// Re-export locked catalogue for consumers.
export { SPECIALIST_IDS, FINDING_ID_SEVERITY_MAP } from "./specialist-reviewer-types";
