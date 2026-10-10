// §36-WAVE-B · WAVE-B · 2026-09-15 · wave-b-cross-cutting
// NEX bounded infrastructure · Wave B cross-cutting specialist reviewers · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Four deterministic specialist reviewers · pure function · zero I/O · zero LLM.
//
// Entry point: runWaveBCrossCuttingReviewers(request) →
//   RunWaveBSpecialistsResult (SUCCESS | FAILURE · discriminated union).

import type { SkillCandidate } from "../skills/skill-schema-types";
import {
  WAVE_B_FINDING_ID_SEVERITY_MAP,
  WAVE_B_GREP_MARKER,
  WAVE_B_SPECIALIST_IDS,
  type RunWaveBSpecialistsFailure,
  type RunWaveBSpecialistsRequest,
  type RunWaveBSpecialistsResult,
  type RunWaveBSpecialistsSuccess,
  type WaveBPerSpecialistResult,
  type WaveBSpecialistFinding,
  type WaveBSpecialistFindingId,
  type WaveBSpecialistId,
  type WaveBSpecialistOverallVerdict,
} from "./wave-b-cross-cutting-types";

// ── Helpers ─────────────────────────────────────────────────────────────

function fail(
  code: RunWaveBSpecialistsFailure["refusal_code"],
  reason: string,
  offending_specialist: WaveBSpecialistId | null = null,
): RunWaveBSpecialistsFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    offending_specialist,
    grep_marker: WAVE_B_GREP_MARKER,
  };
}

function finding(
  specialist_id: WaveBSpecialistId,
  finding_id: WaveBSpecialistFindingId,
  evidence_summary: string,
): WaveBSpecialistFinding {
  return {
    specialist_id,
    finding_id,
    severity: WAVE_B_FINDING_ID_SEVERITY_MAP[finding_id],
    evidence_summary,
  };
}

function content(candidate: SkillCandidate): string {
  return candidate.proposed_content ?? "";
}

function hasRe(text: string, regex: RegExp): boolean {
  return regex.test(text);
}

function isTestFile(path: string): boolean {
  return /\.test\.(ts|tsx|mts|cts)$/.test(path) || /__tests__\//.test(path);
}

function isScriptFile(path: string): boolean {
  return /^scripts\//.test(path) || /\.mjs$|\.mts$|\.cjs$/.test(path);
}

// ── Specialist 1 · nex-debugging-specialist ─────────────────────────────

function nexDebuggingSpecialist(c: SkillCandidate): WaveBSpecialistFinding[] {
  const findings: WaveBSpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;

  // console.log in production code (non-test, non-script)
  if (!isTestFile(path) && !isScriptFile(path) && hasRe(text, /\bconsole\.log\s*\(/)) {
    findings.push(
      finding(
        "nex-debugging-specialist",
        "NDG_CONSOLE_LOG_IN_PRODUCTION",
        "console.log(...) in production code · prefer a structured logger or remove before merge",
      ),
    );
  }
  // debugger; keyword
  if (hasRe(text, /(^|[\s;{}])debugger\s*;/)) {
    findings.push(
      finding(
        "nex-debugging-specialist",
        "NDG_DEBUGGER_STATEMENT",
        "'debugger;' statement left in source · will pause the runtime under DevTools · never merge",
      ),
    );
  }
  // Empty catch body
  if (hasRe(text, /catch\s*\(\s*\w+\s*(?::\s*\w+\s*)?\)\s*\{\s*\}/)) {
    findings.push(
      finding(
        "nex-debugging-specialist",
        "NDG_UNSILENCED_CATCH",
        "empty catch block · swallowing errors hides real failures · at minimum log or re-throw",
      ),
    );
  }
  // catch(e: any) explicit any
  if (hasRe(text, /catch\s*\(\s*\w+\s*:\s*any\s*\)/)) {
    findings.push(
      finding(
        "nex-debugging-specialist",
        "NDG_BROAD_CATCH_ANY",
        "catch(e: any) · unknown is preferable in TypeScript strict mode; narrow before use",
      ),
    );
  }
  // .catch(() => {}) swallowed promise
  if (hasRe(text, /\.catch\s*\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*\{\s*\}\s*\)/)) {
    findings.push(
      finding(
        "nex-debugging-specialist",
        "NDG_SWALLOWED_PROMISE",
        ".catch(() => {}) swallows a rejection · at minimum log the error or return a Result",
      ),
    );
  }
  // throw new Error(...) with a short message
  const shortErrRe = /throw\s+new\s+Error\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/g;
  let em: RegExpExecArray | null;
  while ((em = shortErrRe.exec(text)) !== null) {
    if (em[1] !== undefined && em[1].length > 0 && em[1].length <= 20) {
      findings.push(
        finding(
          "nex-debugging-specialist",
          "NDG_SHORT_ERROR_MESSAGE",
          `throw new Error("${em[1]}") · ${em[1].length}-char message lacks operational context`,
        ),
      );
      break;
    }
  }
  // process.exit in library code (not scripts, not tests, not clis)
  const isLibrary = /^src\/lib\//.test(path);
  if (isLibrary && hasRe(text, /\bprocess\.exit\s*\(/)) {
    findings.push(
      finding(
        "nex-debugging-specialist",
        "NDG_UNCONDITIONAL_PROCESS_EXIT",
        "process.exit(...) in library code · libraries must never terminate the host process · return a Result instead",
      ),
    );
  }
  return findings;
}

// ── Specialist 2 · nex-git-change-impact-specialist ─────────────────────

function nexGitChangeImpactSpecialist(c: SkillCandidate): WaveBSpecialistFinding[] {
  const findings: WaveBSpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;

  // Large new file (>1000 lines)
  if (c.change_kind === "file_new") {
    const lineCount = (text.match(/\n/g)?.length ?? 0) + 1;
    if (lineCount > 1000) {
      findings.push(
        finding(
          "nex-git-change-impact-specialist",
          "NGI_LARGE_FILE_NEW_1000LINES",
          `new file is ${lineCount} lines · consider splitting for reviewability and testability`,
        ),
      );
    }
  }
  // File delete
  if (c.change_kind === "file_delete") {
    findings.push(
      finding(
        "nex-git-change-impact-specialist",
        "NGI_FILE_DELETE_OP",
        "file_delete change_kind · confirm no live consumers, no protected-baseline entry, no active tests reference this path",
      ),
    );
  }
  // Touches protected module (skills/ or specialist-reviewers/ / wave-a / wave-b)
  const isProtected =
    /^src\/lib\/nex-agent-runtime\/skills\//.test(path) ||
    /^src\/lib\/nex-agent-runtime\/specialist-reviewers\//.test(path) ||
    /^src\/lib\/nex-agent-runtime\/wave-a-language-framework\//.test(path) ||
    /^src\/lib\/nex-agent-runtime\/wave-b-cross-cutting\//.test(path);
  if (isProtected && (c.change_kind === "file_content" || c.change_kind === "file_delete")) {
    findings.push(
      finding(
        "nex-git-change-impact-specialist",
        "NGI_TOUCHES_PROTECTED_MODULE",
        `${c.change_kind} on protected module '${path}' · needs an amendment referencing the affected wave`,
      ),
    );
  }
  // New .test.ts (verify source exists)
  if (c.change_kind === "file_new" && /\.test\.(ts|tsx|mts|cts)$/.test(path)) {
    findings.push(
      finding(
        "nex-git-change-impact-specialist",
        "NGI_TEST_FILE_WITHOUT_KNOWN_SOURCE",
        "new test file · verify a matching source file exists and its import path resolves",
      ),
    );
  }
  // New src/lib/ .ts source without an accompanying test-path suggestion
  if (
    c.change_kind === "file_new" &&
    /^src\/lib\/.*\.ts$/.test(path) &&
    !/\.test\.ts$/.test(path) &&
    !/-types\.ts$/.test(path) &&
    !/\/__tests__\//.test(path)
  ) {
    findings.push(
      finding(
        "nex-git-change-impact-specialist",
        "NGI_SOURCE_WITHOUT_TEST_HINT",
        "new library source without a co-located __tests__/ · every new lib module should ship with tests",
      ),
    );
  }
  // Cross-module fanout: 3+ distinct src/lib/<top-dir> in imported_from_specifiers
  if (c.imported_from_specifiers.length > 0) {
    const tops = new Set<string>();
    for (const spec of c.imported_from_specifiers) {
      // Look for src/lib/<top>/ prefix or bare specifier
      const m = /^(?:.*\/)?src\/lib\/([^/]+)\//.exec(spec);
      if (m) tops.add(m[1]);
    }
    if (tops.size >= 3) {
      findings.push(
        finding(
          "nex-git-change-impact-specialist",
          "NGI_CROSS_MODULE_FANOUT",
          `imports from ${tops.size} distinct src/lib/ sub-modules · high fan-out increases blast radius`,
        ),
      );
    }
  }
  // Migration modified in-place
  if (/^db\/migrations\//.test(path) && c.change_kind === "file_content") {
    findings.push(
      finding(
        "nex-git-change-impact-specialist",
        "NGI_MIGRATION_MODIFIED_IN_PLACE",
        "existing migration modified in-place · migrations are immutable once applied · add a new migration instead",
      ),
    );
  }
  return findings;
}

// ── Specialist 3 · nex-security-specialist ──────────────────────────────

function nexSecuritySpecialist(c: SkillCandidate): WaveBSpecialistFinding[] {
  const findings: WaveBSpecialistFinding[] = [];
  const text = content(c);

  // Hardcoded secret lookalike
  if (
    hasRe(text, /['"](sk|pk)[-_][A-Za-z0-9]{20,}['"]/) ||
    hasRe(text, /['"]ghp_[A-Za-z0-9]{20,}['"]/) ||
    hasRe(text, /['"][0-9a-fA-F]{32,}['"]/)
  ) {
    findings.push(
      finding(
        "nex-security-specialist",
        "NSE_HARDCODED_SECRET_LOOKALIKE",
        "string literal matches a known secret pattern (sk-/pk-/ghp_/32+ hex) · move to environment or vault",
      ),
    );
  }
  // eval-like execution
  if (hasRe(text, /\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\([^)]*\)\s*\(/)) {
    findings.push(
      finding(
        "nex-security-specialist",
        "NSE_EVAL_LIKE_EXECUTION",
        "eval(...) / new Function(...) / Function()() detected · dynamic code execution is a strict refusal in NEX runtime",
      ),
    );
  }
  // Unsafe HTML insertion (unless DOMPurify or sanitize nearby)
  const hasSanitiser = hasRe(text, /DOMPurify|sanitiseHtml|sanitize_html|xss\s*\(/i);
  if (!hasSanitiser && hasRe(text, /dangerouslySetInnerHTML|\.innerHTML\s*=/)) {
    findings.push(
      finding(
        "nex-security-specialist",
        "NSE_UNSAFE_HTML_INSERTION",
        "dangerouslySetInnerHTML / innerHTML= without a nearby sanitiser · XSS risk",
      ),
    );
  }
  // Unvalidated redirect
  if (hasRe(text, /\b(?:res\.)?redirect\s*\(\s*\w+\s*\)/)) {
    findings.push(
      finding(
        "nex-security-specialist",
        "NSE_UNVALIDATED_REDIRECT",
        "redirect(<variable>) · validate against an allow-list before redirecting to user-supplied URLs",
      ),
    );
  }
  // SQL string concatenation in a template literal
  if (hasRe(text, /`[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{/i)) {
    findings.push(
      finding(
        "nex-security-specialist",
        "NSE_SQL_STRING_CONCATENATION",
        "SQL keyword in a template literal with ${...} interpolation · use parameterised queries",
      ),
    );
  }
  // Path traversal via template literal in path.join / path.resolve
  if (hasRe(text, /path\.(join|resolve)\s*\([^)]*\$\{/)) {
    findings.push(
      finding(
        "nex-security-specialist",
        "NSE_PATH_TRAVERSAL_LITERAL",
        "path.join/resolve with interpolated variable · verify inputs cannot escape the workspace via '..'",
      ),
    );
  }
  // Disabled TLS
  if (hasRe(text, /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/)) {
    findings.push(
      finding(
        "nex-security-specialist",
        "NSE_DISABLED_TLS",
        "TLS verification disabled · never acceptable in production · fix the certificate chain instead",
      ),
    );
  }
  return findings;
}

// ── Specialist 4 · nex-playwright-engineering ───────────────────────────

function nexPlaywrightEngineeringReviewer(c: SkillCandidate): WaveBSpecialistFinding[] {
  const findings: WaveBSpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;
  // Only playwright test files (heuristic: import from @playwright/test or `.spec.ts` under tests/ or e2e)
  const isPlaywright =
    hasRe(text, /from\s+['"]@playwright\/test['"]/) ||
    /\/e2e\//.test(path) ||
    /\.spec\.(ts|tsx)$/.test(path);
  if (!isPlaywright) return findings;

  // Missing await on locator action
  // Detect "(page|locator|frame|<name>Page).click(" NOT preceded by "await "
  const actionRe = /(?<!\bawait\s{1,10})\b(?:page|locator|frame|\w+Page)\.(click|fill|type|goto|press|selectOption|check|uncheck|hover|focus|blur|dblclick)\s*\(/;
  if (actionRe.test(text)) {
    findings.push(
      finding(
        "nex-playwright-engineering",
        "NPW_MISSING_AWAIT_ON_ACTION",
        "Playwright locator action without preceding 'await' · action returns a Promise that must be awaited",
      ),
    );
  }
  // Large hardcoded timeout (waitForTimeout(N) with N >= 5000)
  const timeoutRe = /waitForTimeout\s*\(\s*(\d+)\s*\)/g;
  let tm: RegExpExecArray | null;
  while ((tm = timeoutRe.exec(text)) !== null) {
    const ms = Number.parseInt(tm[1], 10);
    if (Number.isFinite(ms) && ms >= 5000) {
      findings.push(
        finding(
          "nex-playwright-engineering",
          "NPW_HARDCODED_LARGE_TIMEOUT",
          `waitForTimeout(${ms}) · fixed sleeps ≥ 5s are anti-pattern · use expect.toBeVisible / waitForResponse`,
        ),
      );
      break;
    }
  }
  // getByText used but no getByRole / getByLabel / getByTestId in same file
  if (
    hasRe(text, /\bgetByText\s*\(/) &&
    !hasRe(text, /\bgetByRole\s*\(|\bgetByLabel\s*\(|\bgetByTestId\s*\(/)
  ) {
    findings.push(
      finding(
        "nex-playwright-engineering",
        "NPW_GETBYTEXT_WITHOUT_ROLE",
        "only getByText used · text-only selectors are fragile · prefer getByRole/getByLabel/getByTestId",
      ),
    );
  }
  // .screenshot( used but no toHaveScreenshot( in same file
  if (
    hasRe(text, /\.screenshot\s*\(/) &&
    !hasRe(text, /toHaveScreenshot\s*\(/)
  ) {
    findings.push(
      finding(
        "nex-playwright-engineering",
        "NPW_SCREENSHOT_WITHOUT_ASSERTION",
        ".screenshot(...) captured but no toHaveScreenshot(...) assertion · screenshots without assertions do not gate",
      ),
    );
  }
  // test name mentions localhost
  if (hasRe(text, /\btest\s*\(\s*['"`][^'"`]*localhost[^'"`]*['"`]/)) {
    findings.push(
      finding(
        "nex-playwright-engineering",
        "NPW_TEST_NAME_MENTIONS_LOCALHOST",
        "test title mentions localhost · configure baseURL and refer to the environment, not the host",
      ),
    );
  }
  // test.skip or test.fixme left in
  if (hasRe(text, /\btest\.(skip|fixme)\s*\(/)) {
    findings.push(
      finding(
        "nex-playwright-engineering",
        "NPW_TEST_SKIP_OR_FIXME_LEFT_IN",
        "test.skip( or test.fixme( present · skipped e2e tests hide broken UI paths · track why or delete",
      ),
    );
  }
  // page. used but no test.beforeEach / beforeAll / fixture init
  if (
    hasRe(text, /\bpage\.\w+\s*\(/) &&
    !hasRe(text, /\btest\.beforeEach\s*\(|\bbeforeEach\s*\(|\bbeforeAll\s*\(|\btest\.use\s*\(/)
  ) {
    findings.push(
      finding(
        "nex-playwright-engineering",
        "NPW_NO_PAGE_INITIALIZER",
        "page fixture used with no beforeEach/beforeAll/test.use initialiser · verify shared setup exists",
      ),
    );
  }
  return findings;
}

// ── Dispatcher ─────────────────────────────────────────────────────────

const WAVE_B_SPECIALIST_IMPLEMENTATIONS: Record<WaveBSpecialistId, (c: SkillCandidate) => WaveBSpecialistFinding[]> = {
  "nex-debugging-specialist": nexDebuggingSpecialist,
  "nex-git-change-impact-specialist": nexGitChangeImpactSpecialist,
  "nex-security-specialist": nexSecuritySpecialist,
  "nex-playwright-engineering": nexPlaywrightEngineeringReviewer,
};

// ── Candidate structural check ─────────────────────────────────────────

function isValidCandidate(candidate: unknown): candidate is SkillCandidate {
  if (!candidate || typeof candidate !== "object") return false;
  const c = candidate as Record<string, unknown>;
  return typeof c.workspace_relative_path === "string"
    && typeof c.change_kind === "string"
    && typeof c.authorised === "boolean";
}

// ── Overall verdict derivation ─────────────────────────────────────────

function deriveOverallVerdict(counts: {
  critical: number;
  warning: number;
  advisory: number;
}): WaveBSpecialistOverallVerdict {
  if (counts.critical > 0 || counts.warning > 0) return "action_required";
  if (counts.advisory > 0) return "advisory_only";
  return "no_findings";
}

// ── Entry point ────────────────────────────────────────────────────────

export function runWaveBCrossCuttingReviewers(
  request: RunWaveBSpecialistsRequest,
): RunWaveBSpecialistsResult {
  if (!request || typeof request !== "object") {
    return fail("WB_INVALID_REQUEST", "request required");
  }
  if (!isValidCandidate(request.candidate)) {
    return fail("WB_INVALID_CANDIDATE", "candidate must be a well-formed SkillCandidate");
  }
  const requested: readonly WaveBSpecialistId[] = request.specialists_to_run === "all"
    ? WAVE_B_SPECIALIST_IDS
    : request.specialists_to_run;
  if (!Array.isArray(requested)) {
    return fail("WB_INVALID_REQUEST", "specialists_to_run must be an array or 'all'");
  }
  for (const id of requested) {
    if (!WAVE_B_SPECIALIST_IDS.includes(id)) {
      return fail("WB_UNKNOWN_SPECIALIST", `unknown specialist_id '${id}'`, id as WaveBSpecialistId);
    }
  }

  const per_specialist: WaveBPerSpecialistResult[] = [];
  const counts = { critical: 0, warning: 0, advisory: 0 };
  let total = 0;

  for (const id of requested) {
    const impl = WAVE_B_SPECIALIST_IMPLEMENTATIONS[id];
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

  const success: RunWaveBSpecialistsSuccess = {
    kind: "SUCCESS",
    per_specialist: Object.freeze(per_specialist),
    total_findings: total,
    critical_count: counts.critical,
    warning_count: counts.warning,
    advisory_count: counts.advisory,
    overall_verdict: deriveOverallVerdict(counts),
    grep_marker: WAVE_B_GREP_MARKER,
  };
  return success;
}

// Re-export locked catalogue for consumers.
export {
  WAVE_B_FINDING_ID_SEVERITY_MAP,
  WAVE_B_GREP_MARKER,
  WAVE_B_REFUSAL_CODES,
  WAVE_B_SPECIALIST_IDS,
} from "./wave-b-cross-cutting-types";
