// NEX Code Brain · Engineering-patterns seed
// A "code bible" of widely-adopted, evidence-supported engineering rules that
// NEX1 can search when facing a known task class.
//
// HONESTY POSTURE:
//   · Each entry carries its `source` citation in `body` and its confidence
//     in `tags` (industry-standard / contextual / debatable).
//   · Every entry lands as `founder_approved: false` until the Founder
//     explicitly promotes it. Search callers must respect that.
//   · No pattern is claimed as "the only way" · alternatives are listed.
//   · This file is DATA. Zero runtime side-effects on import.

import type { KnowledgeEntry } from "../types";

/** The minimum data an entry needs to be seeded. Runtime fields (entry_id,
 *  created_at, founder_approved) are added by the seed loader. */
export interface SeedPattern {
  readonly kind: KnowledgeEntry["kind"];
  readonly title: string;
  readonly body: string; // markdown-ish · MUST include source citation
  readonly applicable_paths: readonly string[];
  readonly tags: readonly string[];
  readonly contributed_by_lane: string;
}

const CODING_PRIMARY = "nex-coding-primary";
const SEC_LANE = "nex-security";
const MIG_LANE = "nex-migration";
const VISUAL_LANE = "nex-visual";

// ── Section A · TypeScript language & typing ─────────────────────────────
const TYPESCRIPT: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "Prefer readonly for interface fields that never mutate",
    body: `**Rule.** Every interface property that the runtime never assigns after construction should be marked \`readonly\`.

**Rationale.** Turns "should not mutate" into a compile-time guarantee. Removes an entire class of bugs (accidental array push · shared reference mutation) at zero runtime cost.

**Example.**
\`\`\`ts
export interface AgentResult {
  readonly agent_id: AgentId;
  readonly verdict: AgentVerdict;
  readonly evidence: readonly string[];
}
\`\`\`

**Applicability.** Every DTO · every event · every read-only manifest.

**Alternatives.** \`Readonly<T>\` utility type for wholesale readonly · pick one style per module and be consistent.

**Source.** TypeScript Handbook · "Readonly Properties" section. Widely adopted in Effective TypeScript (item 46).
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/"],
    tags: ["typescript", "immutability", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Use discriminated unions for state machines",
    body: `**Rule.** Model states as a union of objects with a common literal \`kind\` field. Never a single object with optional fields per state.

**Example.**
\`\`\`ts
type LeaseResult =
  | { ok: true; lease: WriteLease; reclaimed_from?: WriteLease }
  | { ok: false; kind: "CONFLICT"; reason: string; conflict?: WriteLease }
  | { ok: false; kind: "WRONG_LANE"; reason: string; expected_lane?: string };
\`\`\`

**Rationale.** The type checker forces exhaustive handling · impossible states become unrepresentable · IDEs give correct autocompletion in each branch.

**Alternative.** Class hierarchies work but carry runtime cost and prevent JSON serialisation.

**Source.** TypeScript Handbook · "Discriminated Unions". Effective TypeScript item 34.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/"],
    tags: ["typescript", "state-machine", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "anti-pattern",
    title: "Avoid `any` · prefer `unknown` when the type is genuinely unknown",
    body: `**Rule.** \`any\` opts out of type checking · \`unknown\` requires narrowing before use.

**Rationale.** \`any\` silently disables the type system for that value and every value derived from it. \`unknown\` preserves the safety net: the compiler forces you to prove what the value is before you use it.

**Applicability.** Every public API surface · every JSON parse result · every third-party callback with weak typing.

**Alternatives.** For third-party libs without types, prefer authoring narrow type-guard helpers over reaching for \`any\`. \`@ts-ignore\` is worse than either.

**Example (bad).**
\`\`\`ts
function parse(input: any) { return input.data.value; } // no protection
\`\`\`

**Example (good).**
\`\`\`ts
function parse(input: unknown) {
  if (typeof input === "object" && input !== null && "data" in input) { ... }
}
\`\`\`

**Source.** TypeScript Handbook · "The unknown type". Effective TypeScript item 42.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/"],
    tags: ["typescript", "type-safety", "anti-pattern", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Exhaustiveness checks with `never`",
    body: `**Rule.** When switching on a discriminated union · add a \`default\` that assigns the argument to a \`never\`-typed variable. Compilation fails if a case is added later without updating the switch.

**Example.**
\`\`\`ts
function label(v: AgentVerdict): string {
  switch (v) {
    case "APPROVE": return "ok";
    case "REJECT": return "no";
    // ...all cases...
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}
\`\`\`

**Source.** TypeScript Handbook · "Exhaustiveness checking". Effective TypeScript item 59.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/"],
    tags: ["typescript", "exhaustiveness", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
];

// ── Section B · Error handling ────────────────────────────────────────────
const ERROR_HANDLING: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "Result-shaped returns for expected failures · exceptions for programmer errors",
    body: `**Rule.** Distinguish operational failures (network down · file missing · lease conflict) from programmer errors (null deref · type violation).

- **Operational** → return \`{ ok: false, reason }\` so the caller MUST handle.
- **Programmer** → throw · so the failure is loud and unmissable.

**Example.**
\`\`\`ts
function acquireLease(req: LeaseRequest): LeaseResult { // never throws for CONFLICT
  if (!isSafeIdentifier(req.path)) throw new Error("caller bug: unsafe path"); // programmer error
  ...
}
\`\`\`

**Source.** Rust community (\`Result<T, E>\`); adopted broadly by Go (multi-return err) and modern TypeScript codebases. Joyent Node.js Best Practices article "Operational vs Programmer Errors".
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/"],
    tags: ["error-handling", "result-pattern", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "anti-pattern",
    title: "Never silent-catch",
    body: `**Rule.** \`try { ... } catch {}\` with an empty catch is nearly always a bug. Either handle the specific error, log it, or rethrow.

**Rationale.** Silent catches hide problems until production. Every catch site should record enough to diagnose later.

**Example (good).**
\`\`\`ts
try { unlinkSync(p); } catch (err) {
  log(run_id, { kind: "file_unlink_failed", detail: { path: p, error: String(err) } });
}
\`\`\`

**Source.** Google TypeScript Style Guide · Node.js Best Practices repo (goldbergyoni/nodebestpractices) point 4.7.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/"],
    tags: ["error-handling", "anti-pattern", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Every network / subprocess call needs a timeout",
    body: `**Rule.** Never call \`fetch\`, \`spawn\`, or a database query without either an explicit timeout or a documented reason it cannot hang.

**Rationale.** A request without a timeout can wedge the entire event loop / worker.

**Example.**
\`\`\`ts
const child = spawn("npx", ["vitest", "run"], { cwd, shell: true });
const timer = setTimeout(() => child.kill("SIGKILL"), timeout_ms);
child.on("exit", () => clearTimeout(timer));
\`\`\`

**Source.** Node.js Best Practices point 5.1. AWS Well-Architected Framework · Reliability Pillar.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/api/"],
    tags: ["reliability", "timeout", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
];

// ── Section C · Testing ───────────────────────────────────────────────────
const TESTING: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "Arrange · Act · Assert (AAA) test structure",
    body: `**Rule.** Every test has three visually-separated sections: set up preconditions (Arrange), invoke the code under test (Act), assert observable outcomes (Assert).

**Example.**
\`\`\`ts
it("acquires an exclusive lease", () => {
  // Arrange
  seedLanes();
  const req = { agent_lane: "nex-coding-primary", path: "src/lib/x.ts" };
  // Act
  const r = acquireLease(req);
  // Assert
  expect(r.ok).toBe(true);
});
\`\`\`

**Source.** Kent Beck · Test-Driven Development: By Example. xUnit Patterns (Meszaros).
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/", "tests/"],
    tags: ["testing", "aaa", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Adversarial cases required for every public API",
    body: `**Rule.** For each public exported function, write at least one test that supplies HOSTILE input: empty, oversized, null-byte, path-traversal, unicode homoglyph, concurrent access, expired timestamp.

**Rationale.** Bugs cluster at boundaries. Adversarial tests move discovery from production to CI.

**Example.**
\`\`\`ts
it("rejects path traversal", () => {
  const r = acquireLease({ agent_lane: "nex-coding-primary", path: "../../etc/passwd" });
  expect(r.ok).toBe(false);
});
\`\`\`

**Source.** OWASP Testing Guide · adopted by Google's fuzzing initiatives · established practice in mission-critical software.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/api/"],
    tags: ["testing", "adversarial", "security", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Tests must be independent · order should not matter",
    body: `**Rule.** No test should depend on another test having run first. Every test's \`beforeEach\` sets up its own state.

**Rationale.** Independent tests can be sharded across CPUs · re-run in isolation · fail visibly when broken.

**Common leak.** Shared JSON file at \`data/nex-code-brain/lanes.json\` when tests run in parallel · solved by \`NEX_CODE_BRAIN_ROOT\` env var per test file (see \`__tests__/lane-registry.test.ts\`).

**Source.** xUnit Patterns · Kent Beck · Uncle Bob's Clean Code chapter 9.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "tests/"],
    tags: ["testing", "isolation", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
];

// ── Section D · Security ──────────────────────────────────────────────────
const SECURITY: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "Validate at the trust boundary · never inside the trusted core",
    body: `**Rule.** Every user-supplied value must be validated at the earliest server-side entry point (route handler · CLI argv). Downstream code trusts the shape.

**Example.**
\`\`\`ts
export async function POST(req: Request) {
  const body = await req.json();
  if (!isSafeIdentifier(body.table_name)) return err(400, "unsafe identifier");
  // downstream now trusts body.table_name is safe
}
\`\`\`

**Source.** OWASP ASVS Level 2 · V5 (Validation). Google Secure Coding Guide.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/app/api/", "src/lib/"],
    tags: ["security", "input-validation", "industry-standard"],
    contributed_by_lane: SEC_LANE,
  },
  {
    kind: "anti-pattern",
    title: "Never trust client-supplied identity",
    body: `**Rule.** A \`session_id\`, \`user_id\` or \`tenant_id\` sent by the browser is a claim, not a proof. Always derive identity from an authenticated token.

**Example (bad).**
\`\`\`ts
const userId = req.headers["x-user-id"]; // browser can set anything
\`\`\`

**Example (good).**
\`\`\`ts
const userId = verifyJwt(req.headers.authorization).sub; // signed, server-validated
\`\`\`

**Source.** OWASP Top 10 A01:2021 · Broken Access Control.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/app/api/"],
    tags: ["security", "authentication", "industry-standard"],
    contributed_by_lane: SEC_LANE,
  },
  {
    kind: "convention",
    title: "Parameterise SQL · never string-concatenate",
    body: `**Rule.** Use parameter placeholders \`$1, $2\` (Postgres) or \`?\` (SQLite). Never build SQL by string concatenation from user data.

**Example (dangerous).**
\`\`\`ts
const q = \`SELECT * FROM users WHERE email = '\${email}'\`; // SQL injection
\`\`\`

**Example (safe).**
\`\`\`ts
await client.query("SELECT * FROM users WHERE email = $1", [email]);
\`\`\`

**Source.** OWASP Top 10 A03:2021 · Injection. CWE-89.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/api/", "supabase/"],
    tags: ["security", "sql-injection", "industry-standard"],
    contributed_by_lane: SEC_LANE,
  },
  {
    kind: "convention",
    title: "Defend against path traversal · normalise and check",
    body: `**Rule.** Any user-supplied path must be normalised via \`path.resolve\` and then checked to be inside an expected prefix.

**Example.**
\`\`\`ts
const abs = path.resolve(REPO_ROOT, userSuppliedRel);
const rel = path.relative(REPO_ROOT, abs);
if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("path traversal");
\`\`\`

**Source.** OWASP · CWE-22 (Path Traversal). CVE-2007-0450 (Apache) is the classic case study.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/api/"],
    tags: ["security", "path-traversal", "industry-standard"],
    contributed_by_lane: SEC_LANE,
  },
  {
    kind: "anti-pattern",
    title: "Never log secrets · never return internal filesystem paths to clients",
    body: `**Rule.** Redact tokens, passwords, API keys in every log path. Return sanitised error messages to callers; log the details server-side.

**Rationale.** Logs are frequently shipped to third-party observability tools or accessible by ops staff without the same trust level as the codebase authors. Stack traces returned to browsers leak internal structure to attackers.

**Applicability.** Every logger call · every error-response body · every debug-mode output.

**Example.** Return \`{ error: "operation failed" }\` to the client; log \`{ error, stack, request_id }\` server-side. Never both in the same channel.

**Source.** OWASP ASVS V7 (Errors and Logging). SANS Top 25.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/api/"],
    tags: ["security", "logging", "industry-standard"],
    contributed_by_lane: SEC_LANE,
  },
];

// ── Section E · Performance & reliability ─────────────────────────────────
const PERFORMANCE: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "Measure before optimising",
    body: `**Rule.** No performance change without a measured baseline (before) and a measured comparison (after). Guess-and-tune is regression-inducing.

**Rationale.** Donald Knuth: "Premature optimisation is the root of all evil (or at least most of it) in programming."

**Source.** Knuth · "Structured Programming with go to Statements" (1974) · restated in every senior engineering handbook.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/"],
    tags: ["performance", "measurement", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "anti-pattern",
    title: "N+1 query problem",
    body: `**Rule.** Fetching a parent row then looping to fetch each child row separately is O(N) round-trips. Use a JOIN or a single WHERE-IN query.

**Example (bad).**
\`\`\`ts
const users = await db.query("SELECT * FROM users");
for (const u of users) {
  u.orders = await db.query("SELECT * FROM orders WHERE user_id = $1", [u.id]);
}
\`\`\`

**Example (good).**
\`\`\`ts
const rows = await db.query("SELECT u.*, o.* FROM users u LEFT JOIN orders o ON o.user_id = u.id");
\`\`\`

**Source.** Rails community · O'Reilly "SQL Antipatterns" (Karwin).
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/api/"],
    tags: ["performance", "database", "anti-pattern", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
];

// ── Section F · React / Next.js ───────────────────────────────────────────
const REACT_NEXT: readonly SeedPattern[] = [
  {
    kind: "anti-pattern",
    title: "Never use innerHTML with dynamic data (XSS)",
    body: `**Rule.** In React · avoid \`dangerouslySetInnerHTML\` unless the content is server-side-sanitised. Prefer JSX (auto-escapes).

**Example (dangerous).**
\`\`\`tsx
<div dangerouslySetInnerHTML={{ __html: userComment }} /> // XSS
\`\`\`

**Example (safe).**
\`\`\`tsx
<div>{userComment}</div> // React escapes
\`\`\`

**Source.** React docs · Security. OWASP XSS Prevention Cheat Sheet.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/app/", "src/components/"],
    tags: ["react", "security", "xss", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Use `key` for list items · not the array index",
    body: `**Rule.** When rendering an array, key by a stable id (\`item.id\`), not by \`index\`. Index-as-key breaks reordering, filtering, and animations.

**Source.** React docs · Lists and Keys.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/app/", "src/components/"],
    tags: ["react", "list-keys", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Server Components must not import client-only APIs",
    body: `**Rule.** Next.js App Router server components run without a DOM. Do not import \`useState\`, \`useEffect\`, \`window\`, \`document\` inside them. Add \`"use client"\` if browser-side state is required.

**Source.** Next.js docs · Server and Client Components.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/app/"],
    tags: ["react", "nextjs", "server-components", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
];

// ── Section G · Database & migrations ─────────────────────────────────────
const DATABASE: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "Prefer additive migrations · avoid destructive ones",
    body: `**Rule.** \`ADD COLUMN\`, \`CREATE TABLE IF NOT EXISTS\`, and \`CREATE INDEX CONCURRENTLY\` are safe under load. \`DROP\`, \`ALTER COLUMN TYPE\`, and \`RENAME\` require multi-step migrations with feature flags.

**Rationale.** Zero-downtime deploys need old code + new code + old schema + new schema to all be simultaneously valid during the rollout.

**Source.** Stripe engineering blog "Online migrations at scale". GitHub gh-ost. Braintree engineering.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["supabase/migrations/", "src/lib/nex-migration/"],
    tags: ["database", "migrations", "industry-standard"],
    contributed_by_lane: MIG_LANE,
  },
  {
    kind: "convention",
    title: "Always transact multi-row writes",
    body: `**Rule.** If two or more writes must succeed together, wrap them in a transaction. A crash in the middle should leave neither.

**Example.**
\`\`\`sql
BEGIN;
INSERT INTO orders ...;
UPDATE inventory SET count = count - 1 WHERE product_id = ...;
COMMIT;
\`\`\`

**Source.** ACID properties · CJ Date "Introduction to Database Systems". Postgres docs · Transactions.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "supabase/"],
    tags: ["database", "transactions", "industry-standard"],
    contributed_by_lane: MIG_LANE,
  },
  {
    kind: "convention",
    title: "Add indexes for query patterns · not preemptively",
    body: `**Rule.** Every index costs write throughput. Add an index only when a query pattern is proven slow (via EXPLAIN or measurement).

**Source.** Postgres docs · Index Types. "Use the Index, Luke!" (Winand).
**Confidence.** high · industry-standard.`,
    applicable_paths: ["supabase/migrations/"],
    tags: ["database", "indexes", "performance", "industry-standard"],
    contributed_by_lane: MIG_LANE,
  },
];

// ── Section H · Debugging ─────────────────────────────────────────────────
const DEBUGGING: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "Root cause first · symptom last",
    body: `**Rule.** When a test fails, do not patch the assertion. Ask why the code produced the wrong output. Only when the mechanism is understood can the correct fix be chosen.

**Symptom-first is a smell.** If you have to change a test to make it pass, you may have changed the meaning of the code without noticing.

**Source.** The Pragmatic Programmer (Hunt & Thomas) · chapter on debugging. "Working Effectively with Legacy Code" (Feathers).
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/", "src/app/"],
    tags: ["debugging", "root-cause", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "convention",
    title: "Capture evidence before hypothesising",
    body: `**Rule.** On a failure, first record: exact error message · stack trace · inputs · environment (OS · Node version · disk) · the last successful state. THEN form a hypothesis. Hypothesising without evidence produces plausible but wrong fixes.

**Source.** The Pragmatic Programmer. Google's SRE book · postmortem chapter.
**Confidence.** high · industry-standard.`,
    applicable_paths: ["src/lib/"],
    tags: ["debugging", "evidence", "industry-standard"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "gotcha",
    title: "Windows filesystem: renameSync collides under vitest parallel test files",
    body: `**Rule.** When multiple vitest test files write to the same JSON file (e.g. \`data/nex-code-brain/lanes.json\`), Windows can reject \`renameSync\` if another process holds a handle.

**Symptom.** Intermittent \`EPERM: operation not permitted\` under \`vitest run\`.

**Fix.** Isolate the state directory per test file via an env var override (\`NEX_CODE_BRAIN_ROOT\`) · set in \`beforeAll\`, restored in \`afterAll\`.

**Evidence.** Reproduced 2026-09-15 in \`src/lib/nex-code-brain/__tests__/\` when the seed lanes file collided across three parallel test files. Fixed by making \`getBrainDir()\` lazy and configurable.

**Source.** Verified in this workstation · not just theory.
**Confidence.** high · verified.`,
    applicable_paths: ["src/lib/nex-code-brain/"],
    tags: ["debugging", "vitest", "windows", "gotcha", "verified"],
    contributed_by_lane: CODING_PRIMARY,
  },
];

// ── Section I · Visual / image pipelines ──────────────────────────────────
const VISUAL: readonly SeedPattern[] = [
  {
    kind: "convention",
    title: "SDXL local generation requires ≥8 GB VRAM for full base + IP-Adapter",
    body: `**Rule.** Full SDXL 1.0 base with IP-Adapter at 1024×1024 needs ~9–10 GB VRAM. 4 GB cards (RTX 2050) can only run at 512×512 with aggressive offload, and cannot run video-diffusion (I2V) at all.

**Applicability.** Hardware gating in nex-video-adapter.ts. Refuse honestly rather than crash or downscale silently.

**Source.** Stability AI SDXL memory specs · verified empirically 2026-09-15 in \`data/nex-visual-proving/\`.
**Confidence.** high · verified.`,
    applicable_paths: ["src/lib/nex-video/", "src/lib/nex-image/", "scripts/nex-sd-webui-shim/"],
    tags: ["visual", "hardware", "sdxl", "verified"],
    contributed_by_lane: VISUAL_LANE,
  },
  {
    kind: "anti-pattern",
    title: "Do not claim visual identity preservation from perceptual similarity alone",
    body: `**Rule.** "Looks similar" ≠ "same object". Identity preservation must be measured against a defined metric on a defined dataset with a defined threshold set BEFORE seeing the failing case.

**Rationale.** Metric-tuning after seeing a failing case is fitting the metric to the outcome (see NEX Validation Metric Integrity Doctrine 2026-09-15).

**Source.** NEX doctrine sealed 2026-09-15 · M-4 acceptance receipt.
**Confidence.** high · Founder-verified.`,
    applicable_paths: ["src/lib/nex-video/", "src/lib/nex-image/", "src/lib/nex-visual-proving/"],
    tags: ["visual", "evaluation", "governance", "verified"],
    contributed_by_lane: VISUAL_LANE,
  },
];

// ── Section J · Concurrency / process ─────────────────────────────────────
const CONCURRENCY: readonly SeedPattern[] = [
  {
    kind: "gotcha",
    title: "Node fs.writeFileSync with { flag: 'wx' } is the correct exclusive-create primitive",
    body: `**Rule.** For cross-process lock files, use \`writeFileSync(path, content, { flag: "wx" })\`. This is atomic on both POSIX (\`O_EXCL\`) and NTFS. A user-mode "check-then-write" is racy.

**Applicability.** Every file-lock system (leases, sentinel files, watchdog PIDs).

**Example.** \`src/lib/nex-code-brain/leases.ts:87\` uses this pattern.

**Source.** POSIX open(2) O_EXCL semantics · Node.js fs docs · verified in Code Brain lease tests.
**Confidence.** high · verified.`,
    applicable_paths: ["src/lib/nex-code-brain/", "src/lib/nex-agent-runtime/"],
    tags: ["concurrency", "filesystem", "verified"],
    contributed_by_lane: CODING_PRIMARY,
  },
  {
    kind: "anti-pattern",
    title: "Never `Stop-Process -Name node` on a shared workstation",
    body: `**Rule.** Killing every node.exe kills the dev server · queue-executor · Claude Code · and every other Node process on the machine. Use a sentinel file or a targeted PID from a supervisor process instead.

**Source.** Verified on 2026-09-15 · rejected \`nex-signal-watcher.ps1\` suggestion for this reason. Replaced with sentinel-file interrupt at \`src/lib/nex-coding-team/interrupt.ts\`.
**Confidence.** high · verified.`,
    applicable_paths: ["scripts/"],
    tags: ["concurrency", "windows", "anti-pattern", "verified"],
    contributed_by_lane: CODING_PRIMARY,
  },
];

// ── The full seed · sorted for stable output ──────────────────────────────
export const CODE_BIBLE_SEED: readonly SeedPattern[] = [
  ...TYPESCRIPT,
  ...ERROR_HANDLING,
  ...TESTING,
  ...SECURITY,
  ...PERFORMANCE,
  ...REACT_NEXT,
  ...DATABASE,
  ...DEBUGGING,
  ...VISUAL,
  ...CONCURRENCY,
];

/** Sections exposed for targeted seeding / testing. */
export const CODE_BIBLE_SECTIONS = {
  typescript: TYPESCRIPT,
  error_handling: ERROR_HANDLING,
  testing: TESTING,
  security: SECURITY,
  performance: PERFORMANCE,
  react_nextjs: REACT_NEXT,
  database: DATABASE,
  debugging: DEBUGGING,
  visual: VISUAL,
  concurrency: CONCURRENCY,
} as const;
