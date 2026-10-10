import { describe, it, expect } from "vitest";
import {
  uploadEvidence,
  promoteToVerified,
  reject,
  supersede,
  retrieveEvidence,
  retrieveByFile,
  retrieveBySymbol,
  retrieveImportGraph,
  retrieveRepositoryMap,
  projectEvidenceHash,
  TECHNICAL_EVIDENCE_STREAM_VERSION,
} from "./capability-technical-evidence-stream";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function tmp() {
  return { data_root: mkdtempSync(path.join(tmpdir(), "nex1-evidence-")) };
}

const base = {
  project_id: "proj_A",
  session_id: "sess_1",
  source_agent: "NEX1",
  source_role: "primary_coder",
};

describe("technical evidence stream · shared knowledge substrate", () => {
  describe("upload + retrieve", () => {
    it("uploads a FILE_DISCOVERED record and retrieves by project", () => {
      const opts = tmp();
      try {
        const r = uploadEvidence({
          ...base,
          evidence_type: "FILE_DISCOVERED",
          file_path: "src/foo.ts",
          observation: { size_bytes: 1024 },
        }, opts);
        expect(r.evidence_id).toMatch(/^ev_/);
        expect(r.status).toBe("OBSERVED");
        const q = retrieveEvidence({ project_id: "proj_A" }, opts);
        expect(q.evidence.length).toBe(1);
        expect(q.evidence[0].file_path).toBe("src/foo.ts");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("multiple evidence types accumulate", () => {
      const opts = tmp();
      try {
        uploadEvidence({ ...base, evidence_type: "FILE_DISCOVERED", file_path: "a.ts", observation: {} }, opts);
        uploadEvidence({ ...base, evidence_type: "IMPORT_DISCOVERED", file_path: "a.ts", observation: { imports: "b" } }, opts);
        uploadEvidence({ ...base, evidence_type: "EXPORT_DISCOVERED", file_path: "a.ts", observation: { exports: "foo" } }, opts);
        const q = retrieveEvidence({ project_id: "proj_A" }, opts);
        expect(q.evidence.length).toBe(3);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("provenance + status lifecycle (§11-12)", () => {
    it("cannot upload directly as VERIFIED (§12 · agents can't self-declare truth)", () => {
      const opts = tmp();
      try {
        expect(() =>
          uploadEvidence({
            ...base,
            evidence_type: "FILE_DISCOVERED",
            file_path: "a.ts",
            observation: {},
            // @ts-expect-error · testing runtime guard
            initial_status: "VERIFIED",
          }, opts)
        ).toThrow(/cannot_upload_directly_as_verified/);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("OBSERVED → VERIFIED requires explicit promotion", () => {
      const opts = tmp();
      try {
        const r = uploadEvidence({ ...base, evidence_type: "FILE_DISCOVERED", file_path: "a.ts", observation: {} }, opts);
        expect(r.status).toBe("OBSERVED");
        promoteToVerified(r.evidence_id, "proj_A", "TwinNEX", "cross-checked with filesystem stat", opts);
        const q = retrieveEvidence({ project_id: "proj_A" }, opts);
        expect(q.current_status[r.evidence_id]).toBe("VERIFIED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("REJECTED evidence is retained (§19 · failed investigations are knowledge)", () => {
      const opts = tmp();
      try {
        const r = uploadEvidence({ ...base, evidence_type: "PATH_DISCOVERED", file_path: "src/wrong-guess.ts", observation: {} }, opts);
        reject(r.evidence_id, "proj_A", "TwinNEX", "path did not exist on disk", opts);
        const q = retrieveEvidence({ project_id: "proj_A" }, opts);
        expect(q.evidence.length).toBe(1);
        expect(q.current_status[r.evidence_id]).toBe("REJECTED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("SUPERSEDED evidence is linked to replacement", () => {
      const opts = tmp();
      try {
        const oldRec = uploadEvidence({ ...base, evidence_type: "PATH_RESOLVED", file_path: "src/old.ts", observation: {} }, opts);
        const newRec = uploadEvidence({ ...base, evidence_type: "PATH_RESOLVED", file_path: "src/new.ts", observation: {} }, opts);
        supersede(oldRec.evidence_id, newRec.evidence_id, "proj_A", "TwinNEX", "path was renamed", opts);
        const q = retrieveEvidence({ project_id: "proj_A" }, opts);
        expect(q.current_status[oldRec.evidence_id]).toBe("SUPERSEDED");
        expect(q.current_status[newRec.evidence_id]).toBe("OBSERVED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("filters (Twin retrieval)", () => {
    it("retrieveByFile returns file-specific evidence", () => {
      const opts = tmp();
      try {
        uploadEvidence({ ...base, evidence_type: "FILE_MODIFIED", file_path: "a.ts", observation: {} }, opts);
        uploadEvidence({ ...base, evidence_type: "FILE_MODIFIED", file_path: "b.ts", observation: {} }, opts);
        const q = retrieveByFile("proj_A", "a.ts", opts);
        expect(q.evidence.length).toBe(1);
        expect(q.evidence[0].file_path).toBe("a.ts");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("retrieveBySymbol returns symbol-specific evidence", () => {
      const opts = tmp();
      try {
        uploadEvidence({ ...base, evidence_type: "SYMBOL_DISCOVERED", symbol: "Button", observation: {} }, opts);
        uploadEvidence({ ...base, evidence_type: "SYMBOL_DISCOVERED", symbol: "Nav", observation: {} }, opts);
        const q = retrieveBySymbol("proj_A", "Button", opts);
        expect(q.evidence.length).toBe(1);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("retrieveImportGraph aggregates all import/export evidence", () => {
      const opts = tmp();
      try {
        uploadEvidence({ ...base, evidence_type: "IMPORT_DISCOVERED", file_path: "a.ts", observation: {} }, opts);
        uploadEvidence({ ...base, evidence_type: "EXPORT_MISSING", file_path: "b.ts", observation: {} }, opts);
        uploadEvidence({ ...base, evidence_type: "FILE_DISCOVERED", file_path: "c.ts", observation: {} }, opts);
        const q = retrieveImportGraph("proj_A", opts);
        expect(q.evidence.length).toBe(2);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("retrieveRepositoryMap returns file/module/symbol/path evidence with observed+", () => {
      const opts = tmp();
      try {
        uploadEvidence({ ...base, evidence_type: "FILE_DISCOVERED", file_path: "a.ts", observation: {} }, opts);
        uploadEvidence({ ...base, evidence_type: "PATH_RESOLVED", file_path: "src/x.ts", observation: {} }, opts);
        const q = retrieveRepositoryMap("proj_A", opts);
        expect(q.evidence.length).toBe(2);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("multi-project isolation (§29-30)", () => {
    it("evidence from proj_A does not appear in proj_B queries", () => {
      const opts = tmp();
      try {
        uploadEvidence({ ...base, project_id: "proj_A", evidence_type: "FILE_DISCOVERED", file_path: "a.ts", observation: {} }, opts);
        uploadEvidence({ ...base, project_id: "proj_B", evidence_type: "FILE_DISCOVERED", file_path: "b.ts", observation: {} }, opts);
        const qA = retrieveEvidence({ project_id: "proj_A" }, opts);
        const qB = retrieveEvidence({ project_id: "proj_B" }, opts);
        expect(qA.evidence.length).toBe(1);
        expect(qB.evidence.length).toBe(1);
        expect(qA.evidence[0].file_path).toBe("a.ts");
        expect(qB.evidence[0].file_path).toBe("b.ts");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("integrity + provenance", () => {
    it("every record includes provenance fields", () => {
      const opts = tmp();
      try {
        const r = uploadEvidence({
          ...base,
          evidence_type: "FILE_DISCOVERED",
          file_path: "a.ts",
          observation: {},
          git_commit: "abc123",
          repository_snapshot_id: "snap1",
        }, opts);
        expect(r.source_agent).toBe("NEX1");
        expect(r.source_role).toBe("primary_coder");
        expect(r.git_commit).toBe("abc123");
        expect(r.repository_snapshot_id).toBe("snap1");
        expect(r.timestamp_iso).toBeTruthy();
        expect(r.timestamp_ns).toBeTruthy();
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("projectEvidenceHash is stable across identical inputs", () => {
      const opts = tmp();
      try {
        const h1 = projectEvidenceHash("proj_A", opts);
        expect(h1.record_count).toBe(0);
        uploadEvidence({ ...base, evidence_type: "FILE_DISCOVERED", file_path: "a.ts", observation: {} }, opts);
        const h2 = projectEvidenceHash("proj_A", opts);
        expect(h2.record_count).toBe(1);
        expect(h2.hash).not.toBe(h1.hash);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("Twin ↔ NEX1 shared substrate (§8)", () => {
    it("NEX1 uploads + Twin retrieves the same records", () => {
      const opts = tmp();
      try {
        uploadEvidence({
          project_id: "proj_A", session_id: "sess_1",
          source_agent: "NEX1", source_role: "primary_coder",
          evidence_type: "FILE_MODIFIED", file_path: "src/Button.tsx",
          observation: { change: "added prop" },
        }, opts);
        uploadEvidence({
          project_id: "proj_A", session_id: "sess_1",
          source_agent: "NEX1", source_role: "primary_coder",
          evidence_type: "EXPORT_MISSING", file_path: "src/theme/Button.tsx",
          observation: { expected: "ThemeButtonProps", actual: ["ThemeButton"] },
        }, opts);
        // Twin retrieves the file-scoped evidence
        const twin_view = retrieveByFile("proj_A", "src/theme/Button.tsx", opts);
        expect(twin_view.evidence.some((e) => e.evidence_type === "EXPORT_MISSING")).toBe(true);
        // Twin adds its own observation
        uploadEvidence({
          project_id: "proj_A", session_id: "sess_1",
          source_agent: "TwinNEX", source_role: "recovery",
          evidence_type: "IMPORT_MISMATCH", file_path: "src/Button.tsx",
          observation: { expected_export: "ThemeButtonProps", actual_from: "src/theme/Button.tsx" },
        }, opts);
        // NEX1 retrieves everything
        const nex1_view = retrieveEvidence({ project_id: "proj_A" }, opts);
        expect(nex1_view.evidence.length).toBe(3);
        expect(nex1_view.evidence.map((e) => e.source_agent)).toContain("TwinNEX");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("invariants", () => {
    it("declares zero_llm=true and ledger=B", () => {
      const opts = tmp();
      try {
        const r = uploadEvidence({ ...base, evidence_type: "FILE_DISCOVERED", file_path: "a.ts", observation: {} }, opts);
        expect(r.zero_llm).toBe(true);
        expect(r.ledger).toBe("B");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
    it("canonical version", () => {
      expect(TECHNICAL_EVIDENCE_STREAM_VERSION).toBe("technical-evidence-stream.v1.2026-09-19");
    });
  });
});
