// NEX1 · CAPABILITY A · v5.0.0-alpha.8 · Phase 1.10-alpha.3
// FOUNDER KILL TEST CORPUS · project-directory detector
//
// Founder direction 2026-09-16:
//   "After alpha.2, I would want a dedicated directory-context false-positive
//    test suite, not just membership tests. That will tell us whether NEX1
//    actually understands when a directory word is being used as a directory."
//
//   "Proceed with alpha.3, keep it uncommitted, and make the Kill Test corpus
//    the priority."
//
//   "Don't blindly suppress `in`, because `in src/lib` is useful. The question
//    is whether NEX can distinguish `in src/lib` from `in services rendered`.
//    That's the real intelligence problem."
//
//   "And the TEST question should also be tested rather than guessed."
//
// SCOPE OF THIS FILE:
//   - Aggressive positive + negative + ambiguous corpus (~150 cases)
//   - Does NOT change the detector or the three open semantics
//   - Ambiguous cases assert the CURRENT behaviour with an open-question note
//   - If future work refines the detector, these tests fail loudly — which is
//     exactly what should happen when a documented behaviour changes.
//
// This file is the direct answer to: "can NEX distinguish a directory
// reference from an English use of the same word?" Where the detector
// currently gets it wrong, we say so.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import { VOCABULARY_VERSION } from "../vocabulary";
import type {
  Nex1IntentClassified,
  Nex1ProjectDirEvidenceKind,
  Nex1ProjectDirReference,
} from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") {
    throw new Error(
      `expected classified for kill-test goal, got ${result.kind}. Goals must include a controlled-vocabulary verb.`,
    );
  }
  return result;
}

function refs(goal: string): readonly Nex1ProjectDirReference[] {
  return classified(classifyFounderIntent(goal)).project_dir_references;
}

interface PositiveCase {
  readonly goal: string;
  readonly expected_path: string;
  readonly expected_evidence: Nex1ProjectDirEvidenceKind;
  readonly expected_segments?: readonly string[];
}

interface NegativeCase {
  readonly goal: string;
  readonly disallowed_path: string;
  readonly reason: string;
}

// ── §0 · version guard ──────────────────────────────────────────────────────

describe("Kill Test · version", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.8 or later", () => {
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
    const suffix = Number(VOCABULARY_VERSION.slice("v5.0.0-alpha.".length));
    expect(suffix).toBeGreaterThanOrEqual(8);
  });
});

// ── §1 · Positive · trailing_slash ──────────────────────────────────────────

const TRAILING_SLASH_CASES: readonly PositiveCase[] = [
  { goal: "build a helper and place it into components/", expected_path: "components", expected_evidence: "trailing_slash", expected_segments: ["components"] },
  { goal: "modify the util and put it in hooks/", expected_path: "hooks", expected_evidence: "trailing_slash", expected_segments: ["hooks"] },
  { goal: "build the new route into pages/", expected_path: "pages", expected_evidence: "trailing_slash", expected_segments: ["pages"] },
  { goal: "add a fresh entry into lib/", expected_path: "lib", expected_evidence: "trailing_slash", expected_segments: ["lib"] },
  { goal: "verify tests in specs/", expected_path: "specs", expected_evidence: "trailing_slash", expected_segments: ["specs"] },
  { goal: "build something under src/", expected_path: "src", expected_evidence: "trailing_slash", expected_segments: ["src"] },
  { goal: "add features into features/", expected_path: "features", expected_evidence: "trailing_slash", expected_segments: ["features"] },
  { goal: "remove old files from dist/", expected_path: "dist", expected_evidence: "trailing_slash", expected_segments: ["dist"] },
  { goal: "modify code inside providers/", expected_path: "providers", expected_evidence: "trailing_slash", expected_segments: ["providers"] },
  { goal: "generate migrations into migrations/", expected_path: "migrations", expected_evidence: "trailing_slash", expected_segments: ["migrations"] },
];

describe("Kill Test · Positive · trailing_slash (10 cases)", () => {
  it.each(TRAILING_SLASH_CASES)("$goal → emits path=$expected_path", ({ goal, expected_path, expected_evidence, expected_segments }) => {
    const r = refs(goal);
    const match = r.find((x) => x.path === expected_path);
    expect(match, `no reference for '${expected_path}' in '${goal}'`).toBeDefined();
    expect(match!.evidence).toBe(expected_evidence);
    if (expected_segments) expect(match!.segments).toEqual(expected_segments);
  });
});

// ── §2 · Positive · path_segment (compound multi-segment) ───────────────────

const COMPOUND_PATH_CASES: readonly PositiveCase[] = [
  { goal: "add a new page to the src/app directory", expected_path: "src/app", expected_evidence: "path_segment", expected_segments: ["src", "app"] },
  { goal: "modify code under src/lib/util", expected_path: "src/lib/util", expected_evidence: "path_segment", expected_segments: ["src", "lib", "util"] },
  { goal: "build components in src/components/shared", expected_path: "src/components/shared", expected_evidence: "path_segment", expected_segments: ["src", "components", "shared"] },
  { goal: "verify tests in src/lib/nex-agent/tests", expected_path: "src/lib/nex-agent/tests", expected_evidence: "path_segment", expected_segments: ["src", "lib", "nex-agent", "tests"] },
  { goal: "investigate src/app/models issue", expected_path: "src/app/models", expected_evidence: "path_segment", expected_segments: ["src", "app", "models"] },
  { goal: "refactor code inside packages/core/services", expected_path: "packages/core/services", expected_evidence: "path_segment", expected_segments: ["packages", "core", "services"] },
  { goal: "modify apps/web/pages structure", expected_path: "apps/web/pages", expected_evidence: "path_segment", expected_segments: ["apps", "web", "pages"] },
  { goal: "build a helper under lib/utils", expected_path: "lib/utils", expected_evidence: "path_segment", expected_segments: ["lib", "utils"] },
  { goal: "add tests to tests/unit", expected_path: "tests/unit", expected_evidence: "path_segment", expected_segments: ["tests", "unit"] },
  { goal: "verify config under config/env", expected_path: "config/env", expected_evidence: "path_segment", expected_segments: ["config", "env"] },
];

describe("Kill Test · Positive · path_segment · compound multi-segment (10 cases)", () => {
  it.each(COMPOUND_PATH_CASES)("$goal → emits ONE compound $expected_path", ({ goal, expected_path, expected_evidence, expected_segments }) => {
    const r = refs(goal);
    const compound = r.find((x) => x.path === expected_path);
    expect(compound, `no compound '${expected_path}' in '${goal}'`).toBeDefined();
    expect(compound!.evidence).toBe(expected_evidence);
    expect(compound!.segments).toEqual(expected_segments);
    // Founder rule #3 · no independent per-segment refs alongside the compound.
    for (const seg of expected_segments!) {
      expect(r.filter((x) => x.path === seg).length, `segment '${seg}' emitted as independent ref (rule #3 violation)`).toBe(0);
    }
  });
});

// ── §3 · Positive · path_noun_anchor ────────────────────────────────────────

const PATH_NOUN_CASES: readonly PositiveCase[] = [
  { goal: "investigate the services directory", expected_path: "services", expected_evidence: "path_noun_anchor" },
  { goal: "investigate the hooks folder", expected_path: "hooks", expected_evidence: "path_noun_anchor" },
  { goal: "investigate the models dir", expected_path: "models", expected_evidence: "path_noun_anchor" },
  { goal: "verify the components subdirectory", expected_path: "components", expected_evidence: "path_noun_anchor" },
  { goal: "explore the features tree", expected_path: "features", expected_evidence: "path_noun_anchor" },
  { goal: "examine the pages layout", expected_path: "pages", expected_evidence: "path_noun_anchor" },
  { goal: "audit the providers structure", expected_path: "providers", expected_evidence: "path_noun_anchor" },
  { goal: "investigate the api path", expected_path: "api", expected_evidence: "path_noun_anchor" },
  { goal: "build a new helper in the templates folder", expected_path: "templates", expected_evidence: "path_noun_anchor" },
  { goal: "verify the routing in the middleware directory", expected_path: "middleware", expected_evidence: "path_noun_anchor" },
  { goal: "investigate the stores subdir", expected_path: "stores", expected_evidence: "path_noun_anchor" },
  { goal: "audit the layouts folders", expected_path: "layouts", expected_evidence: "path_noun_anchor" },
  { goal: "modify the assets tree", expected_path: "assets", expected_evidence: "path_noun_anchor" },
  { goal: "build handlers in the domain directory", expected_path: "domain", expected_evidence: "path_noun_anchor" },
  { goal: "investigate the widgets subdirectory", expected_path: "widgets", expected_evidence: "path_noun_anchor" },
];

describe("Kill Test · Positive · path_noun_anchor (15 cases)", () => {
  it.each(PATH_NOUN_CASES)("$goal → emits path=$expected_path via $expected_evidence", ({ goal, expected_path, expected_evidence }) => {
    const r = refs(goal);
    const match = r.find((x) => x.path === expected_path);
    expect(match, `no reference for '${expected_path}' in '${goal}'`).toBeDefined();
    expect(match!.evidence).toBe(expected_evidence);
  });
});

// ── §4 · Positive · path_verb_anchor ────────────────────────────────────────
// Founder decision #1: `in` IS included. This section exercises the full
// PATH_VERBS_PREPS set (cd/check/open/list/ls/view/explore/into/in/inside/
// under/at/to/from/within).

const PATH_VERB_CASES: readonly PositiveCase[] = [
  { goal: "modify code inside hooks", expected_path: "hooks", expected_evidence: "path_verb_anchor" },
  { goal: "modify code in services", expected_path: "services", expected_evidence: "path_verb_anchor" }, // founder #1 · `in`
  { goal: "modify code under components", expected_path: "components", expected_evidence: "path_verb_anchor" },
  { goal: "modify code into providers", expected_path: "providers", expected_evidence: "path_verb_anchor" },
  { goal: "modify code within middleware", expected_path: "middleware", expected_evidence: "path_verb_anchor" },
  { goal: "modify code from lib", expected_path: "lib", expected_evidence: "path_verb_anchor" },
  { goal: "modify code to hooks", expected_path: "hooks", expected_evidence: "path_verb_anchor" },
  { goal: "modify code at pages", expected_path: "pages", expected_evidence: "path_verb_anchor" },
  { goal: "build a page and cd pages", expected_path: "pages", expected_evidence: "path_verb_anchor" },
  { goal: "investigate then check pages", expected_path: "pages", expected_evidence: "path_verb_anchor" },
  { goal: "build code then open src", expected_path: "src", expected_evidence: "path_verb_anchor" },
  { goal: "verify results then list templates", expected_path: "templates", expected_evidence: "path_verb_anchor" },
  { goal: "investigate then view assets", expected_path: "assets", expected_evidence: "path_verb_anchor" },
  { goal: "test then explore features", expected_path: "features", expected_evidence: "path_verb_anchor" },
  { goal: "investigate and ls migrations", expected_path: "migrations", expected_evidence: "path_verb_anchor" },
];

describe("Kill Test · Positive · path_verb_anchor · full PATH_VERBS_PREPS coverage (15 cases)", () => {
  it.each(PATH_VERB_CASES)("$goal → emits path=$expected_path via $expected_evidence", ({ goal, expected_path, expected_evidence }) => {
    const r = refs(goal);
    const match = r.find((x) => x.path === expected_path);
    expect(match, `no reference for '${expected_path}' in '${goal}'`).toBeDefined();
    expect(match!.evidence).toBe(expected_evidence);
  });
});

// ── §5 · Positive · framework_anchor (mandatory path_noun co-occurrence) ────

const FRAMEWORK_ANCHOR_CASES: readonly PositiveCase[] = [
  { goal: "modify the Rails app directory", expected_path: "app", expected_evidence: "framework_anchor" },
  { goal: "investigate the Rails models directory", expected_path: "models", expected_evidence: "framework_anchor" },
  { goal: "verify the Next.js pages folder", expected_path: "pages", expected_evidence: "framework_anchor" },
  { goal: "audit the React components folder", expected_path: "components", expected_evidence: "framework_anchor" },
  { goal: "examine the Django views directory", expected_path: "views", expected_evidence: "framework_anchor" },
];

describe("Kill Test · Positive · framework_anchor · REQUIRES path_noun co-occurrence (founder #2 · 5 cases)", () => {
  it.each(FRAMEWORK_ANCHOR_CASES)("$goal → emits path=$expected_path via framework_anchor (both framework AND path_noun present)", ({ goal, expected_path, expected_evidence }) => {
    const r = refs(goal);
    const match = r.find((x) => x.path === expected_path);
    expect(match, `no reference for '${expected_path}' in '${goal}'`).toBeDefined();
    expect(match!.evidence).toBe(expected_evidence);
  });
});

// ── §6 · Positive · adjacent_file_ref ───────────────────────────────────────

const ADJACENT_FILE_REF_CASES: readonly PositiveCase[] = [
  { goal: "fix bug in src/lib/auth.ts:42", expected_path: "src/lib", expected_evidence: "adjacent_file_ref", expected_segments: ["src", "lib"] },
  { goal: "modify src/components/Button.tsx", expected_path: "src/components", expected_evidence: "adjacent_file_ref", expected_segments: ["src", "components"] },
  { goal: "verify the export in packages/core/index.ts", expected_path: "packages/core", expected_evidence: "adjacent_file_ref", expected_segments: ["packages", "core"] },
  { goal: "fix the handler in src/app/api/route.ts", expected_path: "src/app/api", expected_evidence: "adjacent_file_ref", expected_segments: ["src", "app", "api"] },
  { goal: "test the flow in tests/integration/e2e.test.ts", expected_path: "tests/integration", expected_evidence: "adjacent_file_ref", expected_segments: ["tests", "integration"] },
  { goal: "refactor the type in src/lib/types.ts", expected_path: "src/lib", expected_evidence: "adjacent_file_ref", expected_segments: ["src", "lib"] },
  { goal: "investigate the config in config/prod/db.json", expected_path: "config/prod", expected_evidence: "adjacent_file_ref", expected_segments: ["config", "prod"] },
  { goal: "modify the schema in migrations/2026/schema.sql", expected_path: "migrations/2026", expected_evidence: "adjacent_file_ref", expected_segments: ["migrations", "2026"] },
];

describe("Kill Test · Positive · adjacent_file_ref (8 cases)", () => {
  it.each(ADJACENT_FILE_REF_CASES)("$goal → adjacent_file_ref for $expected_path", ({ goal, expected_path, expected_evidence, expected_segments }) => {
    const r = refs(goal);
    const match = r.find((x) => x.evidence === expected_evidence && x.path === expected_path);
    expect(match, `no adjacent_file_ref for '${expected_path}' in '${goal}'`).toBeDefined();
    expect(match!.segments).toEqual(expected_segments);
  });
});

// ── §7 · Negative · bare English words · NO ANCHOR ──────────────────────────

const NEGATIVE_BARE_ENGLISH: readonly NegativeCase[] = [
  { goal: "investigate why the company provides services", disallowed_path: "services", reason: "bare 'services', no anchor" },
  { goal: "investigate why the services are slow", disallowed_path: "services", reason: "bare 'services', 'the' + 'are' — no anchor" },
  { goal: "verify the pages of the book", disallowed_path: "pages", reason: "'pages of the book' — no path anchor" },
  { goal: "investigate why our features include free shipping", disallowed_path: "features", reason: "'features' as noun, 'include' verb — no anchor" },
  { goal: "verify the domain of the problem", disallowed_path: "domain", reason: "'domain' as abstract noun, 'of' — no anchor" },
  { goal: "investigate models on the runway", disallowed_path: "models", reason: "'models on the runway' — fashion sense" },
  { goal: "verify the templates are beautifully designed", disallowed_path: "templates", reason: "no path anchor near 'templates'" },
  { goal: "build handlers that are experienced professionals", disallowed_path: "handlers", reason: "'handlers' as professionals" },
  { goal: "investigate the app of the year", disallowed_path: "app", reason: "'app of the year' — no path anchor" },
  { goal: "verify the widgets on the shelf", disallowed_path: "widgets", reason: "shelf widgets, not code" },
  { goal: "investigate whether shared knowledge is enough", disallowed_path: "shared", reason: "'shared' as adjective" },
  { goal: "verify our processes are documented well", disallowed_path: "processes", reason: "'processes' as noun without anchor" },
  { goal: "modify the events that occurred last night", disallowed_path: "events", reason: "'events' as noun without anchor" },
  { goal: "investigate the commands the user typed", disallowed_path: "commands", reason: "'commands' as noun without anchor" },
  { goal: "verify all the queries returned expected data", disallowed_path: "queries", reason: "'queries' as noun without anchor" },
  { goal: "investigate how repositories work in principle", disallowed_path: "repositories", reason: "'repositories' abstract, no anchor" },
  { goal: "verify the adapters are compliant with standards", disallowed_path: "adapters", reason: "'adapters' — no anchor" },
  { goal: "investigate the tests that were performed", disallowed_path: "tests", reason: "'tests' as noun — no anchor" },
  { goal: "verify the aggregates make sense", disallowed_path: "aggregates", reason: "'aggregates' — no anchor" },
  { goal: "investigate a scheme with several ports", disallowed_path: "ports", reason: "'ports' — no anchor" },
];

describe("Kill Test · Negative · bare English words · NO emission (20 cases)", () => {
  it.each(NEGATIVE_BARE_ENGLISH)("$goal → does NOT emit '$disallowed_path' ($reason)", ({ goal, disallowed_path }) => {
    const r = refs(goal);
    const hit = r.find((x) => x.path === disallowed_path);
    expect(hit, `false positive: '${disallowed_path}' emitted from '${goal}'`).toBeUndefined();
  });
});

// ── §8 · Negative · framework mentioned but no path_noun ────────────────────
// Founder rule #2 · framework_anchor requires path_noun co-occurrence.

const FRAMEWORK_WITHOUT_PATH_NOUN: readonly NegativeCase[] = [
  { goal: "modify code because React components are stateful", disallowed_path: "components", reason: "React nearby, but no path_noun" },
  { goal: "investigate why Rails models are objects", disallowed_path: "models", reason: "Rails nearby, but 'objects' is not path_noun" },
  { goal: "verify that Next.js pages support SSR", disallowed_path: "pages", reason: "Next.js nearby, but no path_noun ('support', 'SSR' are not)" },
  { goal: "investigate how Django views handle requests", disallowed_path: "views", reason: "Django nearby, but no path_noun" },
  { goal: "verify Vue composables are reactive", disallowed_path: "composables", reason: "Vue nearby, but no path_noun" },
];

describe("Kill Test · Negative · framework_anchor rejected without path_noun (5 cases)", () => {
  it.each(FRAMEWORK_WITHOUT_PATH_NOUN)("$goal → does NOT emit '$disallowed_path' (framework alone insufficient)", ({ goal, disallowed_path }) => {
    const r = refs(goal);
    const hit = r.find((x) => x.path === disallowed_path);
    expect(hit, `founder rule #2 violated: framework alone triggered emission of '${disallowed_path}' in '${goal}'`).toBeUndefined();
  });
});

// ── §9 · Terminal-position rule (RESOLVED in alpha.9 · v5.0.0-alpha.9) ──────
// Alpha.8 documented these as OPEN QUESTIONS. Alpha.9 shipped a native
// deterministic terminal-position rule that resolves them without an LLM.
//
// path_verb_anchor bare-word emission now requires the target to be at a
// "path-terminal" position (EOF, sentence punctuation, followed by another
// well-known dir, followed by path_noun, or connector+dir). Otherwise
// English continuations like `in services rendered` correctly suppress.
//
// The assertions below now reflect the CORRECT post-alpha.9 behaviour.

describe("Kill Test · Terminal-position rule RESOLVED · alpha.9 native fix", () => {
  it("`in src/lib` emits compound path_segment (unchanged · Pass 2 compound)", () => {
    const r = refs("modify code in src/lib");
    const compound = r.find((x) => x.path === "src/lib");
    expect(compound).toBeDefined();
    expect(compound!.evidence).toBe("path_segment");
    expect(compound!.segments).toEqual(["src", "lib"]);
  });

  it("`in services rendered` correctly SUPPRESSED (English continuation · alpha.9)", () => {
    const r = refs("investigate why the promise was made in services rendered");
    expect(r.find((x) => x.path === "services")).toBeUndefined();
  });

  it("`from tests written last year` correctly SUPPRESSED", () => {
    const r = refs("investigate results from tests written last year");
    expect(r.find((x) => x.path === "tests")).toBeUndefined();
  });

  it("`to pages listed in the report` correctly SUPPRESSED", () => {
    const r = refs("verify all links point to pages listed in the report");
    expect(r.find((x) => x.path === "pages")).toBeUndefined();
  });

  it("`at hooks and loops` correctly SUPPRESSED (`loops` is not a well-known dir → chain fails)", () => {
    const r = refs("investigate the process at hooks and loops");
    expect(r.find((x) => x.path === "hooks")).toBeUndefined();
  });

  it("`under models developed by our team` correctly SUPPRESSED", () => {
    const r = refs("verify all metrics under models developed by our team");
    expect(r.find((x) => x.path === "models")).toBeUndefined();
  });

  it("`inside layouts printed by the vendor` correctly SUPPRESSED", () => {
    const r = refs("investigate defects inside layouts printed by the vendor");
    expect(r.find((x) => x.path === "layouts")).toBeUndefined();
  });
});

// ── §10 · Compound path structural verification ─────────────────────────────

describe("Kill Test · Compound path structure (10 cases)", () => {
  it("`src/lib/util` — segments in order + no per-segment refs", () => {
    const r = refs("modify src/lib/util");
    expect(r.length).toBe(1);
    expect(r[0]!.path).toBe("src/lib/util");
    expect(r[0]!.segments).toEqual(["src", "lib", "util"]);
  });

  it("`apps/web/pages/api` — 4-segment compound stays as one ref", () => {
    const r = refs("modify apps/web/pages/api");
    const compound = r.find((x) => x.path === "apps/web/pages/api");
    expect(compound).toBeDefined();
    expect(compound!.segments).toEqual(["apps", "web", "pages", "api"]);
  });

  it("compound path emitted even when one segment is unknown ('src' known, 'myapp' unknown)", () => {
    const r = refs("modify src/myapp/config");
    const compound = r.find((x) => x.path === "src/myapp/config");
    expect(compound).toBeDefined();
    expect(compound!.segments).toEqual(["src", "myapp", "config"]);
  });

  it("compound with trailing slash: `src/lib/` → trailing_slash evidence", () => {
    const r = refs("modify src/lib/");
    const compound = r.find((x) => x.path === "src/lib");
    expect(compound).toBeDefined();
    expect(compound!.evidence).toBe("trailing_slash");
    expect(compound!.segments).toEqual(["src", "lib"]);
  });

  it("only-unknown-segments path: no emission", () => {
    const r = refs("modify unknown/random/junk");
    expect(r.length).toBe(0);
  });

  it("compound + trailing English word — compound wins", () => {
    const r = refs("modify src/lib and the code");
    const c = r.find((x) => x.path === "src/lib");
    expect(c).toBeDefined();
    expect(c!.evidence).toBe("path_segment");
  });

  it("two independent compound refs in same goal", () => {
    const r = refs("modify src/lib and also apps/web");
    const a = r.find((x) => x.path === "src/lib");
    const b = r.find((x) => x.path === "apps/web");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  it("compound + bare with anchor in same goal", () => {
    const r = refs("modify src/lib and investigate the hooks directory");
    const compound = r.find((x) => x.path === "src/lib");
    const bare = r.find((x) => x.path === "hooks");
    expect(compound).toBeDefined();
    expect(bare).toBeDefined();
    expect(bare!.evidence).toBe("path_noun_anchor");
  });

  it("file-ref span not double-claimed as bare-word", () => {
    // `src/lib/auth.ts` fires adjacent_file_ref for 'src/lib'. The 'src' and
    // 'lib' bare tokens inside the file-ref span must NOT also fire.
    const r = refs("modify src/lib/auth.ts");
    expect(r.length).toBe(1);
    expect(r[0]!.path).toBe("src/lib");
    expect(r[0]!.evidence).toBe("adjacent_file_ref");
  });

  it("references are sorted by span start", () => {
    const r = refs("modify components/ first then check the hooks directory afterwards");
    const starts = r.map((x) => x.span.start);
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
  });
});

// ── §11 · Verb-word / dir-word coexistence ──────────────────────────────────

describe("Kill Test · Verb-word / dir-word coexistence (6 cases)", () => {
  it("'test the services directory' — `test` = TEST verb, `services` = dir", () => {
    const result = classified(classifyFounderIntent("test the services directory"));
    expect(result.verb_family).toBe("TEST");
    const svc = result.project_dir_references.find((r) => r.path === "services");
    expect(svc).toBeDefined();
    expect(svc!.evidence).toBe("path_noun_anchor");
  });

  it("'build a page and test the pages directory' — build wins verb, pages surfaces as dir", () => {
    const result = classified(classifyFounderIntent("build a page and test the pages directory"));
    expect(result.verb_family).toBe("BUILD");
    const pgs = result.project_dir_references.find((r) => r.path === "pages");
    expect(pgs).toBeDefined();
    expect(pgs!.evidence).toBe("path_noun_anchor");
  });

  it("'test the app' — `test` = verb, `app` bare — no anchor, no dir emission", () => {
    const result = classified(classifyFounderIntent("test the app"));
    expect(result.verb_family).toBe("TEST");
    const app = result.project_dir_references.find((r) => r.path === "app");
    expect(app).toBeUndefined();
  });

  it("'investigate the tests' — `investigate` = verb, `tests` bare no anchor → no dir emit", () => {
    const result = classified(classifyFounderIntent("investigate the tests"));
    const t = result.project_dir_references.find((r) => r.path === "tests");
    expect(t).toBeUndefined();
  });

  it("dir tokens may coexist in coding_concepts (concept extractor unchanged by design)", () => {
    const result = classified(classifyFounderIntent("investigate the hooks folder"));
    // project_dir_references has hooks (via path_noun_anchor):
    expect(result.project_dir_references.some((r) => r.path === "hooks")).toBe(true);
    // coding_concepts may also list hooks (pre-existing v4 concept — not removed):
    // Design intentionally preserves this coexistence.
    // No assertion on coding_concepts.length — that is the concept extractor's business.
    expect(result.coding_concepts).toBeDefined();
  });

  it("'remove the hooks folder' — REMOVE verb + path_noun anchor on hooks", () => {
    const result = classified(classifyFounderIntent("remove the hooks folder"));
    expect(result.verb_family).toBe("REMOVE");
    const h = result.project_dir_references.find((r) => r.path === "hooks");
    expect(h).toBeDefined();
    expect(h!.evidence).toBe("path_noun_anchor");
  });
});

// ── §11.5 · Underscore-prefixed dir tokenization (RESOLVED in alpha.9) ─────
// Alpha.8 documented this limitation. Alpha.9 fixed it by expanding
// TOKEN_RE first-char class from `[A-Za-z]` to `[A-Za-z_]`, so
// __tests__ / __mocks__ / __snapshots__ / __pycache__ now tokenise.

describe("Kill Test · Underscore-prefixed dirs RESOLVED · alpha.9 tokenizer fix", () => {
  const UNDERSCORE_DIRS = ["__tests__", "__mocks__", "__snapshots__", "__pycache__"];

  it.each(UNDERSCORE_DIRS)("registry contains '%s' (WELL_KNOWN_PROJECT_DIRS)", async (dir) => {
    const { WELL_KNOWN_PROJECT_DIRS } = await import("../vocabulary");
    expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
  });

  it("bare '__tests__/' in a goal → DETECTED via trailing_slash (alpha.9)", () => {
    const r = refs("verify tests and place fixtures in __tests__/");
    const hit = r.find((x) => x.path === "__tests__");
    expect(hit).toBeDefined();
    expect(hit!.evidence).toBe("trailing_slash");
  });

  it("compound with underscore-prefixed segment → DETECTED as compound path_segment", () => {
    const r = refs("add tests to __tests__/unit");
    const compound = r.find((x) => x.path === "__tests__/unit");
    expect(compound).toBeDefined();
    expect(compound!.segments).toEqual(["__tests__", "unit"]);
  });
});

// ── §12 · Total-count summary (sanity check) ────────────────────────────────

describe("Kill Test · corpus size sanity", () => {
  it("this file provides at least 90 test cases (Founder Kill Test threshold)", () => {
    const total =
      1 + // version
      TRAILING_SLASH_CASES.length +
      COMPOUND_PATH_CASES.length +
      PATH_NOUN_CASES.length +
      PATH_VERB_CASES.length +
      FRAMEWORK_ANCHOR_CASES.length +
      ADJACENT_FILE_REF_CASES.length +
      NEGATIVE_BARE_ENGLISH.length +
      FRAMEWORK_WITHOUT_PATH_NOUN.length +
      7 + // ambiguous documented cases
      10 + // compound structure
      6; // verb/dir coexistence
    expect(total).toBeGreaterThanOrEqual(90);
  });
});
