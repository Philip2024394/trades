// §36-WAVE-A · WAVE-A · 2026-09-15 · wave-a-language-framework
// NEX bounded infrastructure · Wave A language + framework specialist reviewers · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Five deterministic specialist reviewers. Pure function · zero I/O · zero
// LLM · zero AST · zero subprocess · zero network. Grep-heuristic v1.
//
// Entry point: runWaveALanguageFrameworkReviewers(request) →
//   RunWaveASpecialistsResult (SUCCESS | FAILURE · discriminated union).

import type { SkillCandidate } from "../skills/skill-schema-types";
import {
  WAVE_A_FINDING_ID_SEVERITY_MAP,
  WAVE_A_GREP_MARKER,
  WAVE_A_SPECIALIST_IDS,
  type RunWaveASpecialistsFailure,
  type RunWaveASpecialistsRequest,
  type RunWaveASpecialistsResult,
  type RunWaveASpecialistsSuccess,
  type WaveAPerSpecialistResult,
  type WaveASpecialistFinding,
  type WaveASpecialistFindingId,
  type WaveASpecialistId,
  type WaveASpecialistOverallVerdict,
} from "./wave-a-language-framework-types";

// ── Failure helper ──────────────────────────────────────────────────────

function fail(
  code: RunWaveASpecialistsFailure["refusal_code"],
  reason: string,
  offending_specialist: WaveASpecialistId | null = null,
): RunWaveASpecialistsFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    offending_specialist,
    grep_marker: WAVE_A_GREP_MARKER,
  };
}

// ── Finding constructor with locked severity lookup ─────────────────────

function finding(
  specialist_id: WaveASpecialistId,
  finding_id: WaveASpecialistFindingId,
  evidence_summary: string,
): WaveASpecialistFinding {
  return {
    specialist_id,
    finding_id,
    severity: WAVE_A_FINDING_ID_SEVERITY_MAP[finding_id],
    evidence_summary,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function content(candidate: SkillCandidate): string {
  return candidate.proposed_content ?? "";
}

function hasRe(text: string, regex: RegExp): boolean {
  return regex.test(text);
}

// ── Specialist 1 · nex-typescript-engineering ───────────────────────────

function nexTypescriptEngineeringReviewer(c: SkillCandidate): WaveASpecialistFinding[] {
  const findings: WaveASpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;
  // Only applies to .ts/.tsx/.mts/.cts files
  if (!/\.(ts|tsx|mts|cts)$/.test(path)) return findings;

  if (hasRe(text, /@ts-ignore\b/)) {
    findings.push(
      finding(
        "nex-typescript-engineering",
        "NTS_TS_IGNORE_COMMENT",
        "@ts-ignore present · prefer @ts-expect-error with justification or fix the underlying type error",
      ),
    );
  }
  // @ts-expect-error must have a comment justification on the same line ("--" or ": ")
  const expectMatches = text.match(/@ts-expect-error[^\n]*/g);
  if (expectMatches) {
    for (const line of expectMatches) {
      // Justification present if a "--" or ":" separator followed by a non-empty rationale of at least 3 chars.
      if (!/@ts-expect-error\s*(--|:)\s*\S{3,}/.test(line)) {
        findings.push(
          finding(
            "nex-typescript-engineering",
            "NTS_TS_EXPECT_ERROR_UNJUSTIFIED",
            "@ts-expect-error without inline justification · add '-- reason' or ': reason' explaining why",
          ),
        );
        break;
      }
    }
  }
  if (hasRe(text, /(^|\n)\s*\/\/\s*@ts-nocheck\b/)) {
    findings.push(
      finding(
        "nex-typescript-engineering",
        "NTS_TS_NOCHECK",
        "@ts-nocheck disables ALL type checking in the file · never acceptable in NEX runtime code",
      ),
    );
  }
  if (hasRe(text, /(^|\n)\s*(export\s+)?enum\s+\w+/)) {
    findings.push(
      finding(
        "nex-typescript-engineering",
        "NTS_ENUM_DECLARATION",
        "enum declared · prefer literal-union types (`type X = 'a' | 'b'`) for erasable, deterministic output",
      ),
    );
  }
  if (hasRe(text, /(^|\n)\s*(export\s+)?namespace\s+\w+/)) {
    findings.push(
      finding(
        "nex-typescript-engineering",
        "NTS_NAMESPACE_DECLARATION",
        "namespace declaration · prefer ES modules · namespace is a legacy TS pattern",
      ),
    );
  }
  // Non-null assertion chain: two or more `!.` in the same expression.
  if (hasRe(text, /\w+!\.\w+!\./)) {
    findings.push(
      finding(
        "nex-typescript-engineering",
        "NTS_NON_NULL_ASSERTION_CHAIN",
        "chained non-null assertions (a!.b!.c) · consider a proper null check or optional chaining",
      ),
    );
  }
  // JSON.parse( without an immediate `as` type assertion following the parse expression.
  // Look for `JSON.parse(...)` not immediately followed by ` as `.
  const jsonParseMatches = text.matchAll(/JSON\.parse\s*\([^)]*\)(\s*as\s+\w+)?/g);
  for (const m of jsonParseMatches) {
    if (!m[1]) {
      findings.push(
        finding(
          "nex-typescript-engineering",
          "NTS_UNTYPED_JSON_PARSE",
          "JSON.parse(...) without an immediate 'as <Type>' assertion · parsed value is untyped",
        ),
      );
      break;
    }
  }
  if (hasRe(text, /from\s+['"](?:\.\.\/){5,}/)) {
    findings.push(
      finding(
        "nex-typescript-engineering",
        "NTS_DEEP_MODULE_RELATIVE_5PLUS",
        "import path with 5+ '../' segments · consider a path alias or module re-organisation",
      ),
    );
  }
  return findings;
}

// ── Specialist 2 · nex-react-engineering ────────────────────────────────

function nexReactEngineeringReviewer(c: SkillCandidate): WaveASpecialistFinding[] {
  const findings: WaveASpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;
  // Only .tsx or file importing react
  const isReactCandidate = /\.tsx$/.test(path) || hasRe(text, /\bfrom\s+['"]react['"]/);
  if (!isReactCandidate) return findings;

  if (hasRe(text, /key\s*=\s*\{\s*(index|i|idx)\s*\}/)) {
    findings.push(
      finding(
        "nex-react-engineering",
        "NRX_INDEX_AS_KEY",
        "key={index} used for a list element · index-as-key breaks reconciliation on reorder · use a stable id",
      ),
    );
  }
  // .map returning JSX (either <X ... /> or (<X ...)) without a nearby key= within 200 chars after the .map arrow
  const mapReturnRe = /\.map\s*\(\s*\(?[^)]*\)?\s*=>\s*[\s\S]{0,400}/g;
  let m: RegExpExecArray | null;
  while ((m = mapReturnRe.exec(text)) !== null) {
    const slice = m[0];
    // Only complain if JSX appears in the map return AND no key= is present in the slice
    if (/<[A-Za-z][^>]*>/.test(slice) && !/\bkey\s*=/.test(slice)) {
      findings.push(
        finding(
          "nex-react-engineering",
          "NRX_MAP_WITHOUT_KEY",
          ".map(...) returning JSX without an adjacent key= prop · will trigger React key warning",
        ),
      );
      break;
    }
  }
  // Direct mutation of state variable named "state" or ending in "State"
  if (hasRe(text, /\b(state|\w+State)\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/)) {
    findings.push(
      finding(
        "nex-react-engineering",
        "NRX_DIRECT_STATE_MUTATION",
        "direct mutation of state (push/pop/splice/sort/reverse) · React state must be treated as immutable",
      ),
    );
  }
  // useEffect that calls addEventListener/setInterval and no return () => (cleanup)
  const useEffectMatches = text.match(/useEffect\s*\([^)]*\)/g);
  if (useEffectMatches) {
    const withSubscription = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?(addEventListener|setInterval|subscribe)\s*\(/;
    if (withSubscription.test(text) && !hasRe(text, /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?return\s*\(?\s*\(?\s*\)?\s*=>[\s\S]*?(removeEventListener|clearInterval|unsubscribe)/)) {
      findings.push(
        finding(
          "nex-react-engineering",
          "NRX_USEEFFECT_NO_CLEANUP_SUBSCRIPTION",
          "useEffect creates a subscription (addEventListener/setInterval/subscribe) without a matching cleanup return",
        ),
      );
    }
  }
  // Inline style={{...}} inside a .map(
  if (hasRe(text, /\.map\s*\([^)]*\)[\s\S]*?style\s*=\s*\{\{/)) {
    findings.push(
      finding(
        "nex-react-engineering",
        "NRX_INLINE_STYLE_OBJECT_IN_LOOP",
        "style={{ ... }} inside a .map(...) · creates a new object every render for every list item",
      ),
    );
  }
  // Anonymous handler `onXxx={() =>` inside a .map(
  if (hasRe(text, /\.map\s*\([^)]*\)[\s\S]*?\bon[A-Z]\w+\s*=\s*\{\s*\(\)\s*=>/)) {
    findings.push(
      finding(
        "nex-react-engineering",
        "NRX_ANONYMOUS_HANDLER_IN_MAP",
        "anonymous event handler ()=>... inside a .map · reference identity changes every render",
      ),
    );
  }
  // useState called with a function call (expensive init) not wrapped in a factory `() => ...`
  // Detect useState(callSomething()) but not useState(() => callSomething())
  if (hasRe(text, /useState\s*\(\s*\w+\s*\([^)]*\)\s*\)/) && !hasRe(text, /useState\s*\(\s*\(\s*\)\s*=>/)) {
    findings.push(
      finding(
        "nex-react-engineering",
        "NRX_EAGER_USESTATE_INIT",
        "useState(expensiveCall()) invokes the init on every render · pass a lazy initialiser: useState(() => expensiveCall())",
      ),
    );
  }
  return findings;
}

// ── Specialist 3 · nex-nextjs-engineering ───────────────────────────────

function nexNextjsEngineeringReviewer(c: SkillCandidate): WaveASpecialistFinding[] {
  const findings: WaveASpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;
  // Applies to files under src/app/ (route/page/layout/route.ts).
  const isAppRouter = /^src\/app\//.test(path);
  const isApiRoute = /^src\/app\/api\/.*\/route\.ts$/.test(path);
  const isLayout = /\/layout\.tsx$/.test(path);
  if (!isAppRouter && !hasRe(text, /\bnext\/(server|navigation|headers)\b/)) return findings;

  const hasUseClient = hasRe(text, /^\s*['"]use client['"]\s*;?\s*$/m);

  // Server component (no "use client") using a client hook
  if (!hasUseClient && hasRe(text, /\b(useState|useEffect|useReducer|useRef|useLayoutEffect)\s*\(/)) {
    findings.push(
      finding(
        "nex-nextjs-engineering",
        "NNX_SERVER_COMPONENT_WITH_CLIENT_HOOK",
        "server component invokes a client-only React hook · add 'use client' or move the hook to a client component",
      ),
    );
  }
  // API route without an error-shape (Response.json({ok:...}) or return NextResponse.json but no error branch)
  if (isApiRoute && hasRe(text, /\breturn\s+(NextResponse|Response)\.json\s*\(/)) {
    if (!hasRe(text, /\b(error|refusal_code|kind\s*:\s*['"]FAILURE)/)) {
      findings.push(
        finding(
          "nex-nextjs-engineering",
          "NNX_API_ROUTE_NO_ERROR_SHAPE",
          "API route returns Response.json but has no error/failure branch · unexpected inputs will 500",
        ),
      );
    }
  }
  // searchParams used without a validation function call nearby
  if (hasRe(text, /\bsearchParams\b/) && !hasRe(text, /\b(z\.|validate|parseSearch|safeParse|zod)\b/)) {
    findings.push(
      finding(
        "nex-nextjs-engineering",
        "NNX_UNVALIDATED_SEARCHPARAMS",
        "searchParams used without validation · treat all query params as untrusted input",
      ),
    );
  }
  // metadata export in a "use client" file
  if (hasUseClient && hasRe(text, /(^|\n)\s*export\s+const\s+metadata\b/)) {
    findings.push(
      finding(
        "nex-nextjs-engineering",
        "NNX_METADATA_EXPORT_IN_CLIENT_COMPONENT",
        "export const metadata inside a 'use client' file · metadata export is server-only and will be ignored",
      ),
    );
  }
  // Hardcoded http://... or https://... URL in an API route (informational, may be legitimate)
  if (isApiRoute && hasRe(text, /['"]https?:\/\/[^'"]+['"]/)) {
    findings.push(
      finding(
        "nex-nextjs-engineering",
        "NNX_HARDCODED_HTTP_URL",
        "hard-coded http(s):// URL in API route · prefer environment configuration for outbound endpoints",
      ),
    );
  }
  // Missing runtime declaration (edge/nodejs) on an API route
  if (isApiRoute && !hasRe(text, /(^|\n)\s*export\s+const\s+runtime\s*=\s*['"](edge|nodejs)['"]/)) {
    findings.push(
      finding(
        "nex-nextjs-engineering",
        "NNX_MISSING_ROUTE_RUNTIME_DECL",
        "API route has no explicit runtime declaration · declare `export const runtime = 'nodejs' | 'edge'` for clarity",
      ),
    );
  }
  // "use client" in a layout.tsx
  if (isLayout && hasUseClient) {
    findings.push(
      finding(
        "nex-nextjs-engineering",
        "NNX_USE_CLIENT_IN_LAYOUT",
        "layout.tsx marked 'use client' · prefer keeping layouts as server components to preserve tree-level metadata",
      ),
    );
  }
  return findings;
}

// ── Specialist 4 · nex-vitest-engineering ───────────────────────────────

function nexVitestEngineeringReviewer(c: SkillCandidate): WaveASpecialistFinding[] {
  const findings: WaveASpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;
  const isTest = /\.test\.(ts|tsx|mts|cts)$/.test(path) || /__tests__\//.test(path);
  if (!isTest) return findings;

  if (hasRe(text, /\b(describe|it|test)\.only\s*\(/)) {
    findings.push(
      finding(
        "nex-vitest-engineering",
        "NVT_ONLY_LEFT_IN",
        ".only( left in a test file · will silently skip every other test in the suite",
      ),
    );
  }
  // Detect it(...) or test(...) blocks with no expect( inside their body.
  // Heuristic: split on `it(` and `test(` and scan each block up to closing brace pair.
  const testBlockRe = /\b(it|test)\s*\(\s*(['"`])[^'"`]+\2\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;?/g;
  let match: RegExpExecArray | null;
  while ((match = testBlockRe.exec(text)) !== null) {
    const body = match[3];
    if (body && !/\bexpect\s*\(/.test(body)) {
      findings.push(
        finding(
          "nex-vitest-engineering",
          "NVT_TEST_NO_ASSERTION",
          "it/test block with no expect() inside · a test that cannot fail is not a test",
        ),
      );
      break;
    }
  }
  if (hasRe(text, /\b(describe|it|test)\.skip\s*\(/)) {
    findings.push(
      finding(
        "nex-vitest-engineering",
        "NVT_SKIP_LEFT_IN",
        ".skip( left in a test file · skipped tests hide regressions · track why or delete",
      ),
    );
  }
  // async test body with no await
  const asyncTestRe = /\b(it|test)\s*\(\s*(['"`])[^'"`]+\2\s*,\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;?/g;
  let am: RegExpExecArray | null;
  while ((am = asyncTestRe.exec(text)) !== null) {
    const body = am[3];
    if (body && !/\bawait\b/.test(body)) {
      findings.push(
        finding(
          "nex-vitest-engineering",
          "NVT_ASYNC_TEST_NO_AWAIT",
          "async test block with no await · the async wrapper is likely unnecessary or a bug",
        ),
      );
      break;
    }
  }
  // vi.useFakeTimers without restore/useRealTimers/restoreAllMocks
  if (hasRe(text, /vi\.useFakeTimers\s*\(/) && !hasRe(text, /vi\.useRealTimers\s*\(|vi\.restoreAllMocks\s*\(/)) {
    findings.push(
      finding(
        "nex-vitest-engineering",
        "NVT_TIMER_MOCK_NO_RESTORE",
        "vi.useFakeTimers() without a matching vi.useRealTimers()/restoreAllMocks · timer state leaks between tests",
      ),
    );
  }
  // Top-level it( with no surrounding describe(
  if (hasRe(text, /(^|\n)\s*(it|test)\s*\(/) && !hasRe(text, /(^|\n)\s*describe\s*\(/)) {
    findings.push(
      finding(
        "nex-vitest-engineering",
        "NVT_MISSING_DESCRIBE",
        "top-level it/test with no surrounding describe · reports lose grouping context",
      ),
    );
  }
  // Large inline snapshot: toMatchInlineSnapshot(`...`) with > 500 chars between backticks
  const inlineSnapRe = /toMatchInlineSnapshot\s*\(\s*`([\s\S]*?)`/g;
  let sm: RegExpExecArray | null;
  while ((sm = inlineSnapRe.exec(text)) !== null) {
    if (sm[1] && sm[1].length > 500) {
      findings.push(
        finding(
          "nex-vitest-engineering",
          "NVT_LARGE_INLINE_SNAPSHOT",
          "inline snapshot > 500 chars · prefer external snapshot file for reviewability",
        ),
      );
      break;
    }
  }
  return findings;
}

// ── Specialist 5 · nex-postgresql-engineering ───────────────────────────

function nexPostgresqlEngineeringReviewer(c: SkillCandidate): WaveASpecialistFinding[] {
  const findings: WaveASpecialistFinding[] = [];
  const text = content(c);
  const path = c.workspace_relative_path;
  // Applies to .sql or migration-like files
  const isSqlLike = /\.(sql)$/.test(path) || hasRe(text, /\b(CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX|CREATE\s+EXTENSION)\b/i);
  if (!isSqlLike) return findings;

  // CREATE TABLE without a PRIMARY KEY inside the paren-block.
  const createTableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w."]+\s*\(([\s\S]*?)\)\s*;?/gi;
  let ct: RegExpExecArray | null;
  let missingPk = false;
  while ((ct = createTableRe.exec(text)) !== null) {
    const body = ct[1];
    if (body && !/\bPRIMARY\s+KEY\b/i.test(body)) {
      missingPk = true;
      break;
    }
  }
  if (missingPk) {
    findings.push(
      finding(
        "nex-postgresql-engineering",
        "NPG_MISSING_PRIMARY_KEY",
        "CREATE TABLE without a PRIMARY KEY · rows are not addressable and replication may break",
      ),
    );
  }
  // TIMESTAMP not TIMESTAMPTZ (bare TIMESTAMP without WITH TIME ZONE and not TIMESTAMPTZ)
  if (hasRe(text, /\bTIMESTAMP\b(?!\s*TZ)(?!\s+WITH\s+TIME\s+ZONE)/i)) {
    findings.push(
      finding(
        "nex-postgresql-engineering",
        "NPG_TIMESTAMP_WITHOUT_TIMEZONE",
        "TIMESTAMP without time zone · prefer TIMESTAMPTZ (WITH TIME ZONE) for correctness across zones",
      ),
    );
  }
  // VARCHAR without length spec
  if (hasRe(text, /\bVARCHAR\b(?!\s*\()/i)) {
    findings.push(
      finding(
        "nex-postgresql-engineering",
        "NPG_UNBOUNDED_VARCHAR",
        "VARCHAR without explicit length · prefer VARCHAR(n) or TEXT for clarity",
      ),
    );
  }
  // SERIAL / BIGSERIAL preferred over GENERATED AS IDENTITY
  if (hasRe(text, /\b(BIG)?SERIAL\b/i)) {
    findings.push(
      finding(
        "nex-postgresql-engineering",
        "NPG_SERIAL_INSTEAD_OF_IDENTITY",
        "SERIAL/BIGSERIAL used · modern PostgreSQL prefers GENERATED ALWAYS AS IDENTITY (SQL standard, cleaner semantics)",
      ),
    );
  }
  // CREATE TABLE without matching ENABLE ROW LEVEL SECURITY (advisory · applies to public schema)
  if (hasRe(text, /CREATE\s+TABLE\b/i) && !hasRe(text, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i)) {
    findings.push(
      finding(
        "nex-postgresql-engineering",
        "NPG_MISSING_RLS_ENABLE",
        "CREATE TABLE without a matching ENABLE ROW LEVEL SECURITY · Supabase-hosted tables must opt in explicitly",
      ),
    );
  }
  // 3+ DDL statements without a transaction block
  const ddlMatches = text.match(/\b(CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX|DROP\s+TABLE|DROP\s+INDEX)\b/gi) ?? [];
  if (ddlMatches.length >= 3 && !hasRe(text, /\bBEGIN\b/i) && !hasRe(text, /\bCOMMIT\b/i)) {
    findings.push(
      finding(
        "nex-postgresql-engineering",
        "NPG_MULTI_STATEMENT_NO_TRANSACTION",
        `${ddlMatches.length} DDL statements without BEGIN/COMMIT · partial failure will leave the schema inconsistent`,
      ),
    );
  }
  // uuid_generate_v4 used without uuid-ossp extension enabled (and no gen_random_uuid)
  if (hasRe(text, /uuid_generate_v4\s*\(/i) && !hasRe(text, /CREATE\s+EXTENSION[^;]*uuid-ossp/i)) {
    findings.push(
      finding(
        "nex-postgresql-engineering",
        "NPG_UUID_WITHOUT_EXTENSION",
        "uuid_generate_v4() used without CREATE EXTENSION uuid-ossp · function is undefined without the extension",
      ),
    );
  }
  return findings;
}

// ── Dispatcher ─────────────────────────────────────────────────────────

const WAVE_A_SPECIALIST_IMPLEMENTATIONS: Record<WaveASpecialistId, (c: SkillCandidate) => WaveASpecialistFinding[]> = {
  "nex-typescript-engineering": nexTypescriptEngineeringReviewer,
  "nex-react-engineering": nexReactEngineeringReviewer,
  "nex-nextjs-engineering": nexNextjsEngineeringReviewer,
  "nex-vitest-engineering": nexVitestEngineeringReviewer,
  "nex-postgresql-engineering": nexPostgresqlEngineeringReviewer,
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
}): WaveASpecialistOverallVerdict {
  if (counts.critical > 0 || counts.warning > 0) return "action_required";
  if (counts.advisory > 0) return "advisory_only";
  return "no_findings";
}

// ── Entry point ────────────────────────────────────────────────────────

export function runWaveALanguageFrameworkReviewers(
  request: RunWaveASpecialistsRequest,
): RunWaveASpecialistsResult {
  if (!request || typeof request !== "object") {
    return fail("WA_INVALID_REQUEST", "request required");
  }
  if (!isValidCandidate(request.candidate)) {
    return fail("WA_INVALID_CANDIDATE", "candidate must be a well-formed SkillCandidate");
  }
  const requested: readonly WaveASpecialistId[] = request.specialists_to_run === "all"
    ? WAVE_A_SPECIALIST_IDS
    : request.specialists_to_run;
  if (!Array.isArray(requested)) {
    return fail("WA_INVALID_REQUEST", "specialists_to_run must be an array or 'all'");
  }
  for (const id of requested) {
    if (!WAVE_A_SPECIALIST_IDS.includes(id)) {
      return fail("WA_UNKNOWN_SPECIALIST", `unknown specialist_id '${id}'`, id as WaveASpecialistId);
    }
  }

  const per_specialist: WaveAPerSpecialistResult[] = [];
  const counts = { critical: 0, warning: 0, advisory: 0 };
  let total = 0;

  for (const id of requested) {
    const impl = WAVE_A_SPECIALIST_IMPLEMENTATIONS[id];
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

  const success: RunWaveASpecialistsSuccess = {
    kind: "SUCCESS",
    per_specialist: Object.freeze(per_specialist),
    total_findings: total,
    critical_count: counts.critical,
    warning_count: counts.warning,
    advisory_count: counts.advisory,
    overall_verdict: deriveOverallVerdict(counts),
    grep_marker: WAVE_A_GREP_MARKER,
  };
  return success;
}

// Re-export locked catalogue for consumers.
export {
  WAVE_A_FINDING_ID_SEVERITY_MAP,
  WAVE_A_GREP_MARKER,
  WAVE_A_REFUSAL_CODES,
  WAVE_A_SPECIALIST_IDS,
} from "./wave-a-language-framework-types";
