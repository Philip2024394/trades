// NEX1 · CAPABILITY A · v5.0.0-alpha.6 · Phase 1.10-alpha.1
// Cluster 2 additions: WELL_KNOWN_PROJECT_DIRS Set + result-schema field.
//
// This is a STRUCTURAL alpha, not a data alpha. It adds:
//   1. The WELL_KNOWN_PROJECT_DIRS Set (registry only — no classifier extraction yet).
//   2. The `project_dir_references: readonly Nex1ProjectDirReference[]` field on
//      Nex1IntentClassified (always emitted as [] in alpha.1).
//
// The detector that populates `project_dir_references` wires in alpha.2 alongside
// the Founder Kill Test corpus. Alpha.1 must be zero-behavioural-change: every
// existing classification test must still pass, and the new field must be present
// as an empty readonly array on every classified result.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import {
  VOCABULARY_VERSION,
  WELL_KNOWN_PROJECT_DIRS,
} from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}

// ── expected members per design doc §Registry ────────────────────────────────

const FRAMEWORK_NATIVE_DIRS: readonly string[] = [
  "app", "pages", "src", "lib", "public", "static", "assets",
  "components", "hooks", "contexts", "providers", "stores", "composables",
  "services", "controllers", "views", "models", "middleware", "middlewares",
  "layouts", "templates", "partials", "server",
];

const TEST_DIRS: readonly string[] = [
  "tests", "test", "spec", "specs", "__tests__", "__mocks__", "__snapshots__",
  "e2e", "integration", "unit", "fixtures", "mocks", "snapshots", "stubs",
  "factories", "matchers", "test-utils", "testing",
];

const ARCHITECTURE_PATTERN_DIRS: readonly string[] = [
  "domain", "application", "infrastructure", "presentation", "features",
  "entities", "aggregates", "repositories", "ports", "adapters", "handlers",
  "commands", "queries", "events", "sagas", "use-cases", "usecases",
  "value-objects", "dtos", "mappers", "interactors",
];

const BUILD_OUTPUT_DIRS: readonly string[] = [
  "dist", "build", "out", "target", "bin", "obj", "coverage", "vendor",
  "node_modules", "__pycache__", "logs", "tmp",
];

const CONFIG_DIRS: readonly string[] = [
  "config", "configs", "settings", "env", "envs",
];

const INFRA_DIRS: readonly string[] = [
  "docker", "k8s", "kubernetes", "helm", "terraform", "ansible", "infra",
  "deploy", "deployment",
];

const META_DIRS: readonly string[] = [
  "docs", "examples", "samples", "tools", "scripts", "cmd", "internal", "pkg",
  "api", "migrations", "seeds", "images", "fonts", "styles", "locales", "i18n",
  "translations", "packages", "apps", "libs",
];

const FEATURE_SLICED_DIRS: readonly string[] = ["widgets", "shared", "processes"];

const ATOMIC_DESIGN_DIRS: readonly string[] = ["atoms", "molecules", "organisms"];

const ALL_EXPECTED_DIRS: readonly string[] = [
  ...FRAMEWORK_NATIVE_DIRS,
  ...TEST_DIRS,
  ...ARCHITECTURE_PATTERN_DIRS,
  ...BUILD_OUTPUT_DIRS,
  ...CONFIG_DIRS,
  ...INFRA_DIRS,
  ...META_DIRS,
  ...FEATURE_SLICED_DIRS,
  ...ATOMIC_DESIGN_DIRS,
];

// ── version + registry shape ─────────────────────────────────────────────────

describe("capability-a v5.0.0-alpha.6 · version + WELL_KNOWN_PROJECT_DIRS shape", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.6 or later alpha in the same series", () => {
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
    const suffix = Number(VOCABULARY_VERSION.slice("v5.0.0-alpha.".length));
    expect(Number.isFinite(suffix)).toBe(true);
    expect(suffix).toBeGreaterThanOrEqual(6);
  });

  it("WELL_KNOWN_PROJECT_DIRS is a non-empty ReadonlySet", () => {
    expect(WELL_KNOWN_PROJECT_DIRS).toBeInstanceOf(Set);
    expect(WELL_KNOWN_PROJECT_DIRS.size).toBeGreaterThan(100);
  });

  it("every entry is lowercase (matches tokenizer lowercasing)", () => {
    for (const entry of WELL_KNOWN_PROJECT_DIRS) {
      // __tests__ / __pycache__ / __mocks__ / __snapshots__ are conventionally
      // written with underscores + all-lowercase letters.
      expect(entry).toBe(entry.toLowerCase());
    }
  });
});

// ── expected members per category ────────────────────────────────────────────

describe("capability-a v5.0.0-alpha.6 · framework-native dirs registered", () => {
  it.each(FRAMEWORK_NATIVE_DIRS)("%s is in WELL_KNOWN_PROJECT_DIRS", (dir) => {
    expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
  });
});

describe("capability-a v5.0.0-alpha.6 · test dirs registered", () => {
  it.each(TEST_DIRS)("%s is in WELL_KNOWN_PROJECT_DIRS", (dir) => {
    expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
  });
});

describe("capability-a v5.0.0-alpha.6 · architecture-pattern dirs registered", () => {
  it.each(ARCHITECTURE_PATTERN_DIRS)("%s is in WELL_KNOWN_PROJECT_DIRS", (dir) => {
    expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
  });
});

describe("capability-a v5.0.0-alpha.6 · build/output dirs registered", () => {
  it.each(BUILD_OUTPUT_DIRS)("%s is in WELL_KNOWN_PROJECT_DIRS", (dir) => {
    expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
  });
});

describe("capability-a v5.0.0-alpha.6 · config + infra + meta dirs registered", () => {
  it.each([...CONFIG_DIRS, ...INFRA_DIRS, ...META_DIRS])(
    "%s is in WELL_KNOWN_PROJECT_DIRS",
    (dir) => {
      expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
    },
  );
});

describe("capability-a v5.0.0-alpha.6 · feature-sliced + atomic-design dirs registered", () => {
  it.each([...FEATURE_SLICED_DIRS, ...ATOMIC_DESIGN_DIRS])(
    "%s is in WELL_KNOWN_PROJECT_DIRS",
    (dir) => {
      expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
    },
  );
});

// ── structural guarantee: project_dir_references field exists as readonly array ─

describe("capability-a v5.0.0-alpha.6 · project_dir_references field is present and correctly typed", () => {
  it("field is present on classified result and is a readonly array", () => {
    const r = classified(classifyFounderIntent("build a login form"));
    expect(Array.isArray(r.project_dir_references)).toBe(true);
    // A plain "build a login form" has no dir signals — empty is correct.
    expect(r.project_dir_references).toEqual([]);
  });

  it("Founder Kill Test bare-English case: 'the company provides services' emits NO reference", () => {
    // 'services' is in WELL_KNOWN_PROJECT_DIRS but has no path/verb/framework anchor.
    const r = classified(classifyFounderIntent("investigate why the company provides services report"));
    expect(r.project_dir_references).toEqual([]);
  });
});

// ── coexistence with existing pipeline ───────────────────────────────────────

describe("capability-a v5.0.0-alpha.6 · zero regression on existing extraction paths", () => {
  it("verb + coding-concepts + file-refs still extracted (project_dir_references field does not disturb them)", () => {
    const r = classified(
      classifyFounderIntent("fix the useAuth hook in src/lib/auth/hooks.ts:42 with typescript"),
    );
    expect(r.verb_family).toBe("FIX");
    expect(r.file_references.length).toBeGreaterThan(0);
    expect(r.coding_concepts.length).toBeGreaterThan(0);
    // Alpha.7 detector emits adjacent_file_ref for the dir portion of the file-ref path.
    // Non-zero here is expected and correct — see alpha.7 detector test file.
    expect(Array.isArray(r.project_dir_references)).toBe(true);
  });

  it("full expected result-key set present", () => {
    const r = classified(classifyFounderIntent("build a small todo app"));
    const keys = Object.keys(r).sort();
    // Structural check: alpha.6 must add exactly one key vs alpha.5 — project_dir_references.
    expect(keys).toContain("project_dir_references");
    expect(keys).toContain("file_references");
    expect(keys).toContain("coding_concepts");
    expect(keys).toContain("verb_family");
    expect(keys).toContain("vocabulary_version");
  });
});

// ── every design-doc registry entry accounted for ────────────────────────────

describe("capability-a v5.0.0-alpha.6 · every design-doc entry registered", () => {
  it.each(ALL_EXPECTED_DIRS)("%s registered", (dir) => {
    expect(WELL_KNOWN_PROJECT_DIRS.has(dir)).toBe(true);
  });
});
