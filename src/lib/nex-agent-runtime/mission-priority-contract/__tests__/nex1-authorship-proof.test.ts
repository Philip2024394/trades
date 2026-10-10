// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit · nex1-authorship-proof
// NEX bounded infrastructure · authorship-proof harness · 2026-09-14
//
// This harness persists the NEX1-emitted MissionPriorityContract bytes to
// a real repo path on first run and, on every subsequent run, VERIFIES the
// persisted file is byte-identical to the primitive's deterministic
// emission. If the two diverge, the test fails and the persisted file
// must be re-emitted from the primitive (never hand-edited).

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { authorTypedDataContract } from "../../programming-mission/typed-data-contract-authoring";
import {
  MISSION_PRIORITY_STYLE,
  MISSION_PRIORITY_TARGET_PATH,
  buildMissionPrioritySpec,
} from "../../workstation-cockpit/mission-priority-spec";

const PERSISTED_PATH = path.resolve(
  process.cwd(),
  "src/lib/nex-agent-runtime/mission-priority-contract/mission-priority-contract.ts",
);

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function emitBytes(): { content: string; sha: string } {
  const r = authorTypedDataContract({
    spec: buildMissionPrioritySpec(),
    style: MISSION_PRIORITY_STYLE,
    target_path: MISSION_PRIORITY_TARGET_PATH,
  });
  if (!r.ok) throw new Error(`authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

// ── Persist on first run · ensures the real repo file exists ──────────

beforeAll(() => {
  const emitted = emitBytes();
  const dir = path.dirname(PERSISTED_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(PERSISTED_PATH)) {
    writeFileSync(PERSISTED_PATH, emitted.content, "utf8");
  }
});

// ── §A · Persistence + byte-identity ───────────────────────────────────

describe("§36-W-2 · W2 · nex1-authorship-proof", () => {
  it("A-1 · persisted file exists at the target path", () => {
    expect(existsSync(PERSISTED_PATH)).toBe(true);
  });

  it("A-2 · persisted bytes are byte-identical to the primitive's deterministic emission", () => {
    const persisted = readFileSync(PERSISTED_PATH, "utf8");
    const emitted = emitBytes();
    expect(sha256Hex(persisted)).toBe(emitted.sha);
  });

  it("A-3 · persisted file carries the 'Coded by NEX1 via typed_data_contract' header", () => {
    const persisted = readFileSync(PERSISTED_PATH, "utf8");
    expect(persisted).toContain("Coded by NEX1 via typed_data_contract");
    expect(persisted).toContain("§36-W-2 · WAVE-W2 · 2026-09-14 · mission-priority-contract");
  });

  it("A-4 · persisted file contains all 4 declared symbols · verifies real capability content", () => {
    const persisted = readFileSync(PERSISTED_PATH, "utf8");
    expect(persisted).toContain("MISSION_PRIORITY_BOUNDS");
    expect(persisted).toContain("MissionPriorityBand");
    expect(persisted).toContain("MissionPriorityRefusalReason");
    expect(persisted).toContain("MissionPriorityRecord");
    // Real vocabulary members
    expect(persisted).toContain('"low"');
    expect(persisted).toContain('"critical"');
    expect(persisted).toContain('"MP_PRIORITY_OUT_OF_BOUNDS"');
  });

  it("A-5 · determinism · re-emitting the primitive produces byte-identical content", () => {
    const a = emitBytes();
    const b = emitBytes();
    expect(a.sha).toBe(b.sha);
    expect(a.content).toBe(b.content);
  });

  it("A-6 · authorship provenance is honestly labelled (NEX1 emitted the bytes · MAI shipped the spec)", () => {
    // MissionPriorityContract itself declares itself NEX1-authored via the
    // primitive header. The spec module at workstation-cockpit/mission-priority-spec.ts
    // declares itself NEX bounded infrastructure. These are separate files.
    const spec = readFileSync(
      path.resolve(process.cwd(), "src/lib/nex-agent-runtime/workstation-cockpit/mission-priority-spec.ts"),
      "utf8",
    );
    expect(spec).toContain("NEX bounded infrastructure");
    // The BYTES the spec produces are NEX1-authored · verified by header on persisted file (A-3).
  });
});
