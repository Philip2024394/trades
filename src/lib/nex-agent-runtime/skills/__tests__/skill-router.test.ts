// §36-E-4 · WAVE-E4 · 2026-09-14 · skill-router
// NEX bounded infrastructure · skill-router tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { routeSkillsAgainstCandidate } from "../skill-router";
import type { SkillRouterFailure, SkillRouterSuccess } from "../skill-router-types";
import type { Skill, SkillCandidate } from "../skill-schema-types";
import { FIRST_SKILLS_LIBRARY } from "../library";
import { NEX_AGENT_RUNTIME_BOUNDARY_SKILL } from "../library/nex-agent-runtime-boundary.skill";
import { TYPESCRIPT_REFUSAL_FIRST_SKILL } from "../library/typescript-refusal-first.skill";

// ── Fixtures ─────────────────────────────────────────────────────────────

function baseCandidate(overrides: Partial<SkillCandidate> = {}): SkillCandidate {
  return {
    workspace_relative_path: "src/lib/nex-agent-runtime/example.ts",
    change_kind: "file_new",
    current_sha256_hex: null,
    proposed_content:
      "// §36-E-4 · WAVE-E4 · 2026-09-14 · example\n" +
      "export interface ExampleFailure { readonly ok: false; readonly refusal_code: 'X_INVALID'; readonly reason: string; }\n" +
      "export interface ExampleSuccess { readonly ok: true; readonly value: number; }\n" +
      "export type ExampleResult = ExampleFailure | ExampleSuccess;\n" +
      "export type ExampleRefusalCode = 'X_INVALID';\n",
    proposed_content_sha256_hex: null,
    declared_symbols: ["ExampleFailure", "ExampleSuccess", "ExampleResult", "ExampleRefusalCode"],
    imported_symbols: [],
    imported_from_specifiers: [],
    authorised: true,
    test_count_declared: null,
    ...overrides,
  };
}

function sortedLibrary(): readonly Skill[] {
  // The router requires the library to be sorted ascending by identity.slug.
  return [...FIRST_SKILLS_LIBRARY].sort((a, b) => a.identity.slug.localeCompare(b.identity.slug));
}

// ── §A · Refusal-code coverage ──────────────────────────────────────────

describe("§36-E-4 · E4 · §A · router refusal codes", () => {
  it("A-1 · SR_INVALID_REQUEST when request is null", () => {
    const r = routeSkillsAgainstCandidate(null as never) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_INVALID_REQUEST");
  });

  it("A-2 · SR_INVALID_CANDIDATE when candidate is missing", () => {
    const r = routeSkillsAgainstCandidate({
      candidate: null as never,
      skill_library: sortedLibrary(),
    }) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_INVALID_CANDIDATE");
  });

  it("A-3 · SR_INVALID_REQUEST when skill_library is not an array", () => {
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: "not-an-array" as never,
    }) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_INVALID_REQUEST");
  });

  it("A-4 · SR_EMPTY_LIBRARY when skill_library is empty", () => {
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: [],
    }) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_EMPTY_LIBRARY");
  });

  it("A-5 · SR_SKILL_LIBRARY_TOO_LARGE when library exceeds 64 skills", () => {
    const oversized: Skill[] = [];
    for (let i = 0; i < 65; i++) {
      oversized.push({
        ...NEX_AGENT_RUNTIME_BOUNDARY_SKILL,
        identity: {
          ...NEX_AGENT_RUNTIME_BOUNDARY_SKILL.identity,
          slug: `filler-skill-${i.toString().padStart(3, "0")}`,
        },
      });
    }
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: oversized,
    }) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_SKILL_LIBRARY_TOO_LARGE");
  });

  it("A-6 · SR_DUPLICATE_SKILL_SLUGS when two skills share a slug", () => {
    const dup: Skill[] = [
      NEX_AGENT_RUNTIME_BOUNDARY_SKILL,
      { ...NEX_AGENT_RUNTIME_BOUNDARY_SKILL }, // same slug
    ];
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: dup,
    }) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_DUPLICATE_SKILL_SLUGS");
    expect(r.offending_slug).toBe("nex-agent-runtime-boundary");
  });

  it("A-7 · SR_NON_DETERMINISTIC_ORDER when library is not sorted by slug", () => {
    // Reverse sort deliberately.
    const reversed = [...sortedLibrary()].reverse();
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: reversed,
    }) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_NON_DETERMINISTIC_ORDER");
  });

  it("A-8 · SR_MALFORMED_SKILL surfaces the underlying skill-definition failure", () => {
    const bad: Skill = {
      ...NEX_AGENT_RUNTIME_BOUNDARY_SKILL,
      // Force an invalid slug shape that violateSkillDefinition would reject.
      identity: {
        ...NEX_AGENT_RUNTIME_BOUNDARY_SKILL.identity,
        slug: "InvalidSlug With Spaces",
      },
    };
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: [bad],
    }) as SkillRouterFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SR_MALFORMED_SKILL");
  });
});

// ── §B · Verdict-derivation logic ──────────────────────────────────────

describe("§36-E-4 · E4 · §B · router verdict derivation", () => {
  it("B-1 · library that all violate → router_verdict = 'violations_present'", () => {
    // Empty file content violates most anti-pattern validators
    // (no grep marker, no refusal_code union, etc.).
    const candidate = baseCandidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/hostile.ts",
      proposed_content: "child_process.spawn('bad'); eval('bad');",
      declared_symbols: [],
    });
    const r = routeSkillsAgainstCandidate({
      candidate,
      skill_library: sortedLibrary(),
    }) as SkillRouterSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.router_verdict).toBe("violations_present");
    expect(r.total_violations_across_library).toBeGreaterThan(0);
  });

  it("B-2 · candidate whose change_kind matches no skill → 'no_applicable_skills'", () => {
    const candidate = baseCandidate({ change_kind: "file_delete" });
    const r = routeSkillsAgainstCandidate({
      candidate,
      skill_library: sortedLibrary(),
    }) as SkillRouterSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.router_verdict).toBe("no_applicable_skills");
    expect(r.total_applicable_skills).toBe(0);
  });

  it("B-3 · candidate that satisfies the TS-refusal-first skill alone → 'clean' or 'inconclusive'", () => {
    // Route against ONLY the TS-refusal-first skill for a candidate that satisfies it.
    const candidate = baseCandidate();
    const r = routeSkillsAgainstCandidate({
      candidate,
      skill_library: [TYPESCRIPT_REFUSAL_FIRST_SKILL],
    }) as SkillRouterSuccess;
    expect(r.kind).toBe("SUCCESS");
    // With one applicable skill, all_satisfied → clean; anything else → inconclusive.
    expect(["clean", "inconclusive"]).toContain(r.router_verdict);
  });

  it("B-4 · router emits one per-skill result per library entry, in library order", () => {
    const lib = sortedLibrary();
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: lib,
    }) as SkillRouterSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.per_skill_results.length).toBe(lib.length);
    for (let i = 0; i < lib.length; i++) {
      expect(r.per_skill_results[i].skill_slug).toBe(lib[i].identity.slug);
    }
  });
});

// ── §C · Determinism / SHA stability ────────────────────────────────────

describe("§36-E-4 · E4 · §C · determinism", () => {
  it("C-1 · identical inputs produce identical invocation_sha256", () => {
    const candidate = baseCandidate();
    const a = routeSkillsAgainstCandidate({
      candidate,
      skill_library: sortedLibrary(),
    }) as SkillRouterSuccess;
    const b = routeSkillsAgainstCandidate({
      candidate,
      skill_library: sortedLibrary(),
    }) as SkillRouterSuccess;
    expect(a.invocation_sha256).toBe(b.invocation_sha256);
  });

  it("C-2 · invocation_sha256 is a 64-hex string", () => {
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: sortedLibrary(),
    }) as SkillRouterSuccess;
    expect(r.invocation_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("C-3 · candidate difference changes invocation_sha256", () => {
    const a = routeSkillsAgainstCandidate({
      candidate: baseCandidate({ workspace_relative_path: "src/lib/nex-agent-runtime/a.ts" }),
      skill_library: sortedLibrary(),
    }) as SkillRouterSuccess;
    const b = routeSkillsAgainstCandidate({
      candidate: baseCandidate({ workspace_relative_path: "src/lib/nex-agent-runtime/b.ts" }),
      skill_library: sortedLibrary(),
    }) as SkillRouterSuccess;
    expect(a.invocation_sha256).not.toBe(b.invocation_sha256);
  });
});

// ── §D · Grep marker ────────────────────────────────────────────────────

describe("§36-E-4 · E4 · §D · grep marker", () => {
  it("D-1 · every success carries the router grep marker", () => {
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: sortedLibrary(),
    });
    expect(r.router_grep_marker).toBe("§36-E-4 · WAVE-E4 · 2026-09-14 · skill-router");
  });

  it("D-2 · every failure carries the router grep marker", () => {
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: [],
    });
    expect(r.router_grep_marker).toBe("§36-E-4 · WAVE-E4 · 2026-09-14 · skill-router");
  });
});

// ── §E · Real-repo integration (light) ──────────────────────────────────

describe("§36-E-4 · E4 · §E · real library integration", () => {
  it("E-1 · routing the whole FIRST_SKILLS_LIBRARY produces per-skill results for every skill", () => {
    const lib = sortedLibrary();
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: lib,
    }) as SkillRouterSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.per_skill_results.length).toBe(lib.length);
    // Applicable results must reference an invocation_result; non-applicable must be null.
    for (const p of r.per_skill_results) {
      if (p.applicable) expect(p.invocation_result).not.toBeNull();
      else expect(p.invocation_result).toBeNull();
    }
  });

  it("E-2 · at least one skill in the library is applicable to a file_new TS candidate", () => {
    const lib = sortedLibrary();
    const r = routeSkillsAgainstCandidate({
      candidate: baseCandidate(),
      skill_library: lib,
    }) as SkillRouterSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.total_applicable_skills).toBeGreaterThan(0);
  });
});
