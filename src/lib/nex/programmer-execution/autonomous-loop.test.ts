// src/lib/nex/programmer-execution/autonomous-loop.test.ts
//
// Phase 12 · Bounded Autonomous Engineering Under Founder Governance · contract tests
// Every hard preserve from the doctrine must be mechanically enforced.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  openSandbox,
  applyChange,
  closeSandbox,
  runAutonomousCycle,
  REPAIR_SKILL_WHITELIST,
  CYCLE_BOUNDS,
  HARD_REJECT_PATH_SEGMENTS,
  PROHIBITED_CONTENT_KEYWORDS,
  type ProposedChange,
} from "./autonomous-loop";

function safeChange(overrides: Partial<ProposedChange> = {}): ProposedChange {
  return {
    change_id: "chg_safe",
    candidate_id: "cand_test",
    description: "add a small documentation file",
    repair_skill: "add_documentation",
    founder_authorization_id: "founder_auth_TEST",
    files: [
      { relative_path: "docs/note.md", content: "# minor documentation note\n\nsafe content", action: "create" },
    ],
    ...overrides,
  };
}

// ─── Sandbox escape protection ─────────────────────────

describe("Phase 12 · sandbox escape protection", () => {
  it("applyChange rejects absolute paths", () => {
    const session = openSandbox();
    try {
      const change = safeChange({ files: [{ relative_path: "/etc/passwd", content: "x", action: "create" }] });
      const r = applyChange(session, change);
      expect(r.applied).toBe(false);
      expect(r.errors.some((e) => /absolute path/i.test(e))).toBe(true);
    } finally { closeSandbox(session, "DISCARDED"); }
  });

  it("applyChange rejects path-traversal segments (..)", () => {
    const session = openSandbox();
    try {
      const change = safeChange({ files: [{ relative_path: "../../escape.txt", content: "x", action: "create" }] });
      const r = applyChange(session, change);
      expect(r.applied).toBe(false);
      expect(r.errors.some((e) => /path-traversal/i.test(e))).toBe(true);
    } finally { closeSandbox(session, "DISCARDED"); }
  });
});

// ─── Hard preserves ────────────────────────────────────

describe("Phase 12 · RepairSkill whitelist · off-whitelist REJECTED", () => {
  it("repair_skill 'delete_everything' → REJECTED", () => {
    const session = openSandbox();
    try {
      const r = applyChange(session, safeChange({ repair_skill: "delete_everything" as any }));
      expect(r.applied).toBe(false);
      expect(r.errors.some((e) => /not in whitelist/i.test(e))).toBe(true);
    } finally { closeSandbox(session, "DISCARDED"); }
  });
  it("all 9 whitelisted skills are enumerated", () => {
    expect(REPAIR_SKILL_WHITELIST.length).toBe(9);
  });
});

describe("Phase 12 · Founder authorization required", () => {
  it("empty founder_authorization_id → REJECTED", () => {
    const session = openSandbox();
    try {
      const r = applyChange(session, safeChange({ founder_authorization_id: "" }));
      expect(r.applied).toBe(false);
      expect(r.errors.some((e) => /founder_authorization_id/i.test(e))).toBe(true);
    } finally { closeSandbox(session, "DISCARDED"); }
  });
});

describe("Phase 12 · Project B / INDOLOCAL / node_modules / .git / .env ALL rejected", () => {
  for (const seg of HARD_REJECT_PATH_SEGMENTS) {
    it(`hard-reject path segment '${seg}' → REJECTED`, () => {
      const session = openSandbox();
      try {
        const r = applyChange(session, safeChange({ files: [{ relative_path: `some/dir/${seg}/file.md`, content: "x", action: "create" }] }));
        expect(r.applied).toBe(false);
        expect(r.errors.some((e) => e.includes(seg))).toBe(true);
      } finally { closeSandbox(session, "DISCARDED"); }
    });
  }
});

describe("Phase 12 · prohibited content keywords rejected", () => {
  for (const kw of PROHIBITED_CONTENT_KEYWORDS.slice(0, 5)) {
    it(`prohibited keyword '${kw}' in content → REJECTED`, () => {
      const session = openSandbox();
      try {
        const r = applyChange(session, safeChange({ files: [{ relative_path: "docs/x.md", content: `this contains ${kw} which is banned`, action: "create" }] }));
        expect(r.applied).toBe(false);
        expect(r.errors.some((e) => e.includes(kw))).toBe(true);
      } finally { closeSandbox(session, "DISCARDED"); }
    });
  }
});

describe("Phase 12 · bounded runtime / files / bytes", () => {
  it("file count above max_files_written → REJECTED", () => {
    const session = openSandbox();
    try {
      const files = Array.from({ length: CYCLE_BOUNDS.max_files_written + 1 }, (_, i) => ({
        relative_path: `docs/f${i}.md`, content: "x", action: "create" as const,
      }));
      const r = applyChange(session, safeChange({ files }));
      expect(r.applied).toBe(false);
      expect(r.errors.some((e) => /file count/i.test(e))).toBe(true);
    } finally { closeSandbox(session, "DISCARDED"); }
  });
  it("file size above max_bytes_written_per_file → REJECTED", () => {
    const session = openSandbox();
    try {
      const bigContent = "x".repeat(CYCLE_BOUNDS.max_bytes_written_per_file + 1);
      const r = applyChange(session, safeChange({ files: [{ relative_path: "docs/big.md", content: bigContent, action: "create" }] }));
      expect(r.applied).toBe(false);
      expect(r.errors.some((e) => /byte cap/i.test(e))).toBe(true);
    } finally { closeSandbox(session, "DISCARDED"); }
  });
});

// ─── Safe positive path ────────────────────────────────

describe("Phase 12 · safe change writes to sandbox only · production unchanged", () => {
  it("safe change applies · file appears in sandbox root · nowhere else", () => {
    const session = openSandbox();
    try {
      const r = applyChange(session, safeChange());
      expect(r.applied).toBe(true);
      expect(r.paths_written_absolute.length).toBe(1);
      const written = r.paths_written_absolute[0];
      expect(existsSync(written)).toBe(true);
      // path is under sandbox root
      expect(written.startsWith(session.root_dir)).toBe(true);
      // path is NOT under process.cwd() (repo root)
      expect(written.startsWith(process.cwd() + path.sep)).toBe(false);
    } finally { closeSandbox(session, "DISCARDED"); }
  });

  it("runAutonomousCycle: production reference files unchanged before/after", () => {
    const refFiles = [
      path.resolve(process.cwd(), "package.json"),
      path.resolve(process.cwd(), "CLAUDE.md"),
    ];
    const bytesBefore = refFiles.reduce((s, f) => existsSync(f) ? s + statSync(f).size : s, 0);
    const result = runAutonomousCycle({
      change: safeChange(),
      production_reference_files: refFiles,
    });
    const bytesAfter = refFiles.reduce((s, f) => existsSync(f) ? s + statSync(f).size : s, 0);
    expect(result.production_unchanged).toBe(true);
    expect(bytesBefore).toBe(bytesAfter);
    expect(result.disposition).toBe("COMPLETED_WET_RUN");
    expect(result.requires_founder_approval_before_merge).toBe(true);
  });
});

// ─── Dry-run ────────────────────────────────────────────

describe("Phase 12 · dry-run leaves everything untouched", () => {
  it("dry-run returns disposition COMPLETED_DRY_RUN · writes nothing", () => {
    const result = runAutonomousCycle({ change: safeChange(), dry_run: true });
    expect(result.disposition).toBe("COMPLETED_DRY_RUN");
    expect(result.change_applied).toBe(false);
    expect(result.paths_written_in_sandbox.length).toBe(0);
    expect(result.production_unchanged).toBe(true);
  });
});

// ─── Aborted safety violation ──────────────────────────

describe("Phase 12 · violation → disposition ABORTED_SAFETY_VIOLATION", () => {
  it("cycle with off-whitelist repair_skill → ABORTED_SAFETY_VIOLATION", () => {
    const result = runAutonomousCycle({
      change: safeChange({ repair_skill: "wipe_repo" as any }),
    });
    expect(result.disposition).toBe("ABORTED_SAFETY_VIOLATION");
    expect(result.safety_violations.length).toBeGreaterThan(0);
  });
});

// ─── Immutable audit ledger ─────────────────────────────

describe("Phase 12 · immutable command audit ledger (opt-in via persist_audit)", () => {
  it("persist_audit=true appends to data/programmer-execution/command_audit.jsonl", () => {
    // Use a temp repo_root so we don't touch production
    const tempRepo = path.join(process.cwd(), "scripts", ".phase12-audit-test");
    // Force run under a temp root by supplying repo_root
    const result = runAutonomousCycle({
      change: safeChange({ candidate_id: "cand_audit_test" }),
      persist_audit: true,
      repo_root: tempRepo,
    });
    expect(result.requires_founder_approval_before_merge).toBe(true);
    const auditPath = path.join(tempRepo, "data", "programmer-execution", "command_audit.jsonl");
    expect(existsSync(auditPath)).toBe(true);
    const content = readFileSync(auditPath, "utf8");
    expect(content).toContain("cand_audit_test");
    expect(content).toContain("requires_founder_approval_before_merge");
  });
});
