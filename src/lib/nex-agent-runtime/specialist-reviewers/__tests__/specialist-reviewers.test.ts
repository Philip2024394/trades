// §36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers
// NEX bounded infrastructure · specialist-reviewers tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { runSpecialistReviewers } from "../specialist-reviewers";
import type {
  RunSpecialistsFailure,
  RunSpecialistsSuccess,
  SpecialistFindingId,
  SpecialistId,
} from "../specialist-reviewer-types";
import {
  FINDING_ID_SEVERITY_MAP,
  SPECIALIST_IDS,
} from "../specialist-reviewer-types";
import type { SkillCandidate } from "../../skills/skill-schema-types";

// ── Fixture builder ─────────────────────────────────────────────────────

function candidate(overrides: Partial<SkillCandidate> = {}): SkillCandidate {
  return {
    workspace_relative_path: "src/lib/nex-agent-runtime/example.ts",
    change_kind: "file_new",
    current_sha256_hex: null,
    proposed_content: "// §36-EX · WAVE-EX · 2026-09-14 · example\nexport type XRefusalCode = 'X_A' | 'X_B';\n",
    proposed_content_sha256_hex: null,
    declared_symbols: [],
    imported_symbols: [],
    imported_from_specifiers: [],
    authorised: true,
    test_count_declared: null,
    ...overrides,
  };
}

function findingIdsOf(r: RunSpecialistsSuccess, id: SpecialistId): SpecialistFindingId[] {
  const entry = r.per_specialist.find((p) => p.specialist_id === id);
  return entry ? entry.findings.map((f) => f.finding_id) : [];
}

// ── §A · Refusal codes ─────────────────────────────────────────────────

describe("§36-E-5 · E5 · §A · refusal codes", () => {
  it("A-1 · SREV_INVALID_REQUEST when request is null", () => {
    const r = runSpecialistReviewers(null as never) as RunSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SREV_INVALID_REQUEST");
  });

  it("A-2 · SREV_INVALID_CANDIDATE when candidate is missing", () => {
    const r = runSpecialistReviewers({
      candidate: null as never,
      specialists_to_run: "all",
    }) as RunSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SREV_INVALID_CANDIDATE");
  });

  it("A-3 · SREV_UNKNOWN_SPECIALIST when a specialist_id is not in the locked list", () => {
    const r = runSpecialistReviewers({
      candidate: candidate(),
      specialists_to_run: ["does-not-exist"] as never,
    }) as RunSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SREV_UNKNOWN_SPECIALIST");
  });

  it("A-4 · SREV_INVALID_REQUEST when specialists_to_run is neither array nor 'all'", () => {
    const r = runSpecialistReviewers({
      candidate: candidate(),
      specialists_to_run: 123 as never,
    }) as RunSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SREV_INVALID_REQUEST");
  });
});

// ── §B · Grep marker ───────────────────────────────────────────────────

describe("§36-E-5 · E5 · §B · grep marker", () => {
  it("B-1 · success carries §36-E-5 marker", () => {
    const r = runSpecialistReviewers({ candidate: candidate(), specialists_to_run: "all" });
    expect(r.grep_marker).toBe("§36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers");
  });
  it("B-2 · failure carries §36-E-5 marker", () => {
    const r = runSpecialistReviewers(null as never);
    expect(r.grep_marker).toBe("§36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers");
  });
});

// ── §C · Catalogue integrity ───────────────────────────────────────────

describe("§36-E-5 · E5 · §C · locked-catalogue integrity", () => {
  it("C-1 · exactly 5 specialist_ids in the locked list", () => {
    expect(SPECIALIST_IDS.length).toBe(5);
  });
  it("C-2 · every finding_id has a severity mapping", () => {
    // There are 25 finding_ids in the locked union; the map should have 25 entries.
    const entries = Object.keys(FINDING_ID_SEVERITY_MAP);
    expect(entries.length).toBe(25);
    for (const [_id, sev] of Object.entries(FINDING_ID_SEVERITY_MAP)) {
      expect(["advisory", "warning", "critical"]).toContain(sev);
    }
  });
});

// ── §D · TypeScript Architecture reviewer ──────────────────────────────

describe("§36-E-5 · E5 · §D · typescript-architecture-reviewer", () => {
  it("D-1 · TSA_DEEP_RELATIVE_IMPORT when path has ../../../..", () => {
    const c = candidate({ proposed_content: 'import { X } from "../../../../lib/foo";' });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-architecture-reviewer"] }) as RunSpecialistsSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(findingIdsOf(r, "typescript-architecture-reviewer")).toContain("TSA_DEEP_RELATIVE_IMPORT");
  });
  it("D-2 · TSA_TYPE_FILE_HAS_RUNTIME_IMPORT for -types.ts with non-type import", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/foo/bar-types.ts",
      proposed_content: 'import { helper } from "./util";\nexport type Foo = string;',
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-architecture-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-architecture-reviewer")).toContain("TSA_TYPE_FILE_HAS_RUNTIME_IMPORT");
  });
  it("D-3 · TSA_INTERNAL_IMPORT_BYPASS when importing from _internal path", () => {
    const c = candidate({ proposed_content: 'import { X } from "@/lib/_internal/private-helper";' });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-architecture-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-architecture-reviewer")).toContain("TSA_INTERNAL_IMPORT_BYPASS");
  });
  it("D-4 · TSA_CIRCULAR_SIBLING_IMPORT when 3+ sibling imports", () => {
    const c = candidate({
      proposed_content: 'import { a } from "./a";\nimport { b } from "./b";\nimport { c } from "./c";',
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-architecture-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-architecture-reviewer")).toContain("TSA_CIRCULAR_SIBLING_IMPORT");
  });
});

// ── §E · TypeScript Type Safety reviewer ───────────────────────────────

describe("§36-E-5 · E5 · §E · typescript-type-safety-reviewer", () => {
  it("E-1 · TTS_EXPLICIT_ANY when : any appears", () => {
    const c = candidate({ proposed_content: "function f(x: any) { return x; }" });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-type-safety-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-type-safety-reviewer")).toContain("TTS_EXPLICIT_ANY");
  });
  it("E-2 · TTS_UNCHECKED_CAST when 'as unknown as' is used", () => {
    const c = candidate({ proposed_content: "const x = value as unknown as MyType;" });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-type-safety-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-type-safety-reviewer")).toContain("TTS_UNCHECKED_CAST");
  });
  it("E-3 · TTS_UNCONTROLLED_THROW when file exports Result yet throws", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export type FooResult = { ok: true } | { ok: false };\nfunction go() { throw new Error('nope'); }",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-type-safety-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-type-safety-reviewer")).toContain("TTS_UNCONTROLLED_THROW");
  });
  it("E-4 · TTS_NON_EXHAUSTIVE_SWITCH when switch has no default", () => {
    const c = candidate({ proposed_content: "switch (x) { case 'a': return 1; case 'b': return 2; }" });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-type-safety-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-type-safety-reviewer")).toContain("TTS_NON_EXHAUSTIVE_SWITCH");
  });
  it("E-5 · TTS_MISSING_RESULT_TYPE when async function has no Result union", () => {
    const c = candidate({ proposed_content: "export async function doWork() { return 42; }" });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["typescript-type-safety-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "typescript-type-safety-reviewer")).toContain("TTS_MISSING_RESULT_TYPE");
  });
});

// ── §F · React Component reviewer ──────────────────────────────────────

describe("§36-E-5 · E5 · §F · react-component-reviewer", () => {
  it("F-1 · RCR_STATE_IN_SERVER_COMPONENT when useState without 'use client'", () => {
    const c = candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: "import { useState } from 'react';\nexport default function Page() { const [x] = useState(0); return null; }",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["react-component-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "react-component-reviewer")).toContain("RCR_STATE_IN_SERVER_COMPONENT");
  });
  it("F-2 · RCR_HOOK_INSIDE_CONDITIONAL when useX called inside if", () => {
    const c = candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: "'use client';\nimport { useEffect } from 'react';\nfunction C() { if (cond) { useEffect(() => {}); } return null; }",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["react-component-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "react-component-reviewer")).toContain("RCR_HOOK_INSIDE_CONDITIONAL");
  });
  it("F-3 · RCR_MISSING_EFFECT_DEPS when useEffect with empty deps", () => {
    const c = candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: "'use client';\nimport { useEffect } from 'react';\nfunction C() { useEffect(() => { doWork(); }, []); return null; }",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["react-component-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "react-component-reviewer")).toContain("RCR_MISSING_EFFECT_DEPS");
  });
  it("F-4 · RCR_DIRECT_DOM_ACCESS when document. used without 'use client'", () => {
    const c = candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: "import { X } from 'react';\nexport default function Page() { document.body; return null; }",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["react-component-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "react-component-reviewer")).toContain("RCR_DIRECT_DOM_ACCESS");
  });
  it("F-5 · RCR_ASYNC_CLIENT_COMPONENT when async default export in 'use client' file", () => {
    const c = candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: "'use client';\nimport { X } from 'react';\nexport default async function Page() { return null; }",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["react-component-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "react-component-reviewer")).toContain("RCR_ASYNC_CLIENT_COMPONENT");
  });
});

// ── §G · SQL Migration reviewer ────────────────────────────────────────

describe("§36-E-5 · E5 · §G · sql-migration-reviewer", () => {
  it("G-1 · SMR_DROP_WITHOUT_IF_EXISTS", () => {
    const c = candidate({
      workspace_relative_path: "supabase/migrations/2026_09_14_drop.sql",
      proposed_content: "DROP TABLE users;",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["sql-migration-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "sql-migration-reviewer")).toContain("SMR_DROP_WITHOUT_IF_EXISTS");
  });
  it("G-2 · SMR_ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT", () => {
    const c = candidate({
      workspace_relative_path: "supabase/migrations/2026_09_14_addcol.sql",
      proposed_content: "ALTER TABLE users ADD COLUMN email TEXT NOT NULL; -- down: drop",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["sql-migration-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "sql-migration-reviewer")).toContain("SMR_ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT");
  });
  it("G-3 · SMR_UNSCOPED_DELETE", () => {
    const c = candidate({
      workspace_relative_path: "supabase/migrations/2026_09_14_del.sql",
      proposed_content: "DELETE FROM users; -- down: nothing",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["sql-migration-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "sql-migration-reviewer")).toContain("SMR_UNSCOPED_DELETE");
  });
  it("G-4 · SMR_INDEX_NOT_CONCURRENT", () => {
    const c = candidate({
      workspace_relative_path: "supabase/migrations/2026_09_14_idx.sql",
      proposed_content: "CREATE INDEX users_email_idx ON users(email); -- down: drop index",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["sql-migration-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "sql-migration-reviewer")).toContain("SMR_INDEX_NOT_CONCURRENT");
  });
  it("G-5 · SMR_MISSING_DOWN_MIGRATION when no down/reverse mention", () => {
    const c = candidate({
      workspace_relative_path: "supabase/migrations/2026_09_14_change.sql",
      proposed_content: "ALTER TABLE x ADD COLUMN y TEXT DEFAULT 'z';",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["sql-migration-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "sql-migration-reviewer")).toContain("SMR_MISSING_DOWN_MIGRATION");
  });
});

// ── §H · NEX Runtime Boundary reviewer ────────────────────────────────

describe("§36-E-5 · E5 · §H · nex-agent-runtime-boundary-reviewer", () => {
  it("H-1 · NRB_MISSING_GREP_MARKER when runtime file lacks §36 marker", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/new.ts",
      proposed_content: "// NEX bounded infrastructure · new · 2026-09-14\nexport type XRefusalCode = 'X_A';",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["nex-agent-runtime-boundary-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "nex-agent-runtime-boundary-reviewer")).toContain("NRB_MISSING_GREP_MARKER");
  });
  it("H-2 · NRB_FS_WRITE_IN_RUNTIME", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/bad.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · bad\n// NEX bounded infrastructure · bad · 2026-09-14\nexport type XRefusalCode = 'X_A';\nfs.writeFileSync('x', 'y');",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["nex-agent-runtime-boundary-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "nex-agent-runtime-boundary-reviewer")).toContain("NRB_FS_WRITE_IN_RUNTIME");
  });
  it("H-3 · NRB_SUBPROCESS_IN_RUNTIME", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/bad.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · bad\n// NEX bounded infrastructure · bad · 2026-09-14\nexport type XRefusalCode = 'X_A';\nimport 'child_process';",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["nex-agent-runtime-boundary-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "nex-agent-runtime-boundary-reviewer")).toContain("NRB_SUBPROCESS_IN_RUNTIME");
  });
  it("H-4 · NRB_NETWORK_IN_RUNTIME", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/bad.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · bad\n// NEX bounded infrastructure · bad · 2026-09-14\nexport type XRefusalCode = 'X_A';\nfetch('https://x');",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["nex-agent-runtime-boundary-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "nex-agent-runtime-boundary-reviewer")).toContain("NRB_NETWORK_IN_RUNTIME");
  });
  it("H-5 · NRB_MISSING_REFUSAL_UNION", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/plain.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · plain\n// NEX bounded infrastructure · plain · 2026-09-14\nexport const N = 1;",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["nex-agent-runtime-boundary-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "nex-agent-runtime-boundary-reviewer")).toContain("NRB_MISSING_REFUSAL_UNION");
  });
  it("H-6 · NRB_MISSING_NEX_AUTHORSHIP_HEADER", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/plain.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · plain\nexport type XRefusalCode = 'X_A';",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["nex-agent-runtime-boundary-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "nex-agent-runtime-boundary-reviewer")).toContain("NRB_MISSING_NEX_AUTHORSHIP_HEADER");
  });
  it("H-7 · specialist not applied to file outside src/lib/nex-agent-runtime", () => {
    const c = candidate({
      workspace_relative_path: "src/app/some/route.ts",
      proposed_content: "fs.writeFileSync('bad', 'x');",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: ["nex-agent-runtime-boundary-reviewer"] }) as RunSpecialistsSuccess;
    expect(findingIdsOf(r, "nex-agent-runtime-boundary-reviewer").length).toBe(0);
  });
});

// ── §I · Overall verdict derivation ────────────────────────────────────

describe("§36-E-5 · E5 · §I · overall verdict derivation", () => {
  it("I-1 · no_findings when candidate is clean of every rule", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/some-clean/thing.ts",
      // No violations, no hooks, no SQL, no runtime path.
      proposed_content: "export const value = 42;",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: "all" }) as RunSpecialistsSuccess;
    expect(r.overall_verdict).toBe("no_findings");
  });
  it("I-2 · action_required when any critical/warning present", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/bad.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · bad\nexport type XRefusalCode = 'X_A';\nfs.writeFileSync('x','y');",
    });
    const r = runSpecialistReviewers({ candidate: c, specialists_to_run: "all" }) as RunSpecialistsSuccess;
    expect(r.overall_verdict).toBe("action_required");
    expect(r.critical_count).toBeGreaterThan(0);
  });
  it("I-3 · per_specialist array has one entry per requested specialist, in order", () => {
    const requested: SpecialistId[] = ["typescript-type-safety-reviewer", "react-component-reviewer"];
    const r = runSpecialistReviewers({ candidate: candidate(), specialists_to_run: requested }) as RunSpecialistsSuccess;
    expect(r.per_specialist.length).toBe(2);
    expect(r.per_specialist[0].specialist_id).toBe("typescript-type-safety-reviewer");
    expect(r.per_specialist[1].specialist_id).toBe("react-component-reviewer");
  });
});
