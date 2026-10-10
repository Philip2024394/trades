// WO-CAP-EXECUTION-02 · Real workstation adapter adversarial tests.
//
// Founder-locked 2026-09-13 mandatory acceptance:
//   "Give NEX1 a proposal that is validly signed but attempts something
//    outside the authorised scope. It must still be rejected."
//
// The real proof is NOT "NEX can change code" — it is "NEX can change
// exactly what it is authorised to change, through the existing governed
// workstation, and prove the result."
//
// This file is intentionally self-contained · no shared-file purge
// before/after · every test uses unique dedupe keys to survive parallel
// test-file races.

import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { persistCapabilityGap } from "../registry";
import {
  nex1EngineerProposeFor,
  founderSignProposal,
  attachWorkstationScopeToProposal,
  type AuthorisedWorkstationScope,
  type CapEngineeringProposal,
} from "../nex1-engineer";
import {
  realWorkstationAdapter,
  checkScopeBoundary,
  type WorkstationExecutionPlan,
} from "../real-workstation-adapter";
import { executeCapProposal } from "../execution";

function founderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

async function seed(kind: string): Promise<{
  cap: NonNullable<Awaited<ReturnType<typeof nex1EngineerProposeFor>>["proposal"]> extends CapEngineeringProposal ? Awaited<ReturnType<typeof persistCapabilityGap>> : never;
  proposal: CapEngineeringProposal;
  founder: ReturnType<typeof founderKp>;
}> {
  const founder = founderKp();
  const cap = await persistCapabilityGap({
    kind,
    category: "PERFORMANCE",
    priority: "LOW",
    title: `wo02-seed ${kind}`,
    evidence: [{ collection: "test", record_id: `test-ev-${Date.now()}`, kind: "test" }],
    detector_agent_id: null,
    dedupe_key: `${kind}-${Date.now()}-${Math.random()}`,
  });
  const r = await nex1EngineerProposeFor(cap);
  if (!r.proposal) throw new Error("expected proposal");
  return { cap, proposal: r.proposal, founder };
}

const SCOPE_SINGLE_FILE: AuthorisedWorkstationScope = Object.freeze({
  files_may_touch: Object.freeze(["data/nex-agent-workspaces/cap-fix/marker.json"]) as readonly string[],
  build_targets: Object.freeze([]) as readonly string[],
  collections_may_write: Object.freeze([]) as readonly string[],
  stages_required: Object.freeze(["WO-01", "WO-04", "WO-08"]) as readonly ("WO-01" | "WO-04" | "WO-08")[],
  runtime_required: false,
});

const SCOPE_DIR_PREFIX: AuthorisedWorkstationScope = Object.freeze({
  files_may_touch: Object.freeze(["data/nex-agent-workspaces/cap-fix/"]) as readonly string[],
  build_targets: Object.freeze(["npm"]) as readonly string[],
  collections_may_write: Object.freeze([]) as readonly string[],
  stages_required: Object.freeze(["WO-01", "WO-04", "WO-05", "WO-08"]) as readonly ("WO-01" | "WO-04" | "WO-05" | "WO-08")[],
  runtime_required: false,
});

describe("WO-CAP-EXECUTION-02 · scope-boundary pure checks", () => {
  it("SB-1 · plan targeting file INSIDE scope · ok", () => {
    const plan: WorkstationExecutionPlan = {
      file_targets: ["data/nex-agent-workspaces/cap-fix/marker.json"],
      build_executable: null, runtime_check: false, specialists_to_run: [],
    };
    const v = checkScopeBoundary(SCOPE_SINGLE_FILE, plan);
    expect(v.ok).toBe(true);
  });

  it("SB-2 · plan targeting file OUTSIDE scope · rejected", () => {
    const plan: WorkstationExecutionPlan = {
      file_targets: ["src/lib/nex-cap/execution.ts"],
      build_executable: null, runtime_check: false, specialists_to_run: [],
    };
    const v = checkScopeBoundary(SCOPE_SINGLE_FILE, plan);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.rejected_by).toBe("scope_boundary");
      expect(v.scope_field).toBe("files_may_touch");
      expect(v.offending_target).toBe("src/lib/nex-cap/execution.ts");
      expect(v.reason).toMatch(/files_may_touch/);
    }
  });

  it("SB-3 · directory-prefix scope allows children · ok", () => {
    const plan: WorkstationExecutionPlan = {
      file_targets: ["data/nex-agent-workspaces/cap-fix/subdir/nested.json"],
      build_executable: null, runtime_check: false, specialists_to_run: [],
    };
    const v = checkScopeBoundary(SCOPE_DIR_PREFIX, plan);
    expect(v.ok).toBe(true);
  });

  it("SB-4 · directory-prefix scope does NOT allow siblings · rejected", () => {
    const plan: WorkstationExecutionPlan = {
      file_targets: ["data/nex-agent-workspaces/other-project/file.json"],
      build_executable: null, runtime_check: false, specialists_to_run: [],
    };
    const v = checkScopeBoundary(SCOPE_DIR_PREFIX, plan);
    expect(v.ok).toBe(false);
  });

  it("SB-5 · build executable NOT in scope · rejected", () => {
    const plan: WorkstationExecutionPlan = {
      file_targets: ["data/nex-agent-workspaces/cap-fix/marker.json"],
      build_executable: "node", runtime_check: false, specialists_to_run: [],
    };
    const v = checkScopeBoundary(SCOPE_DIR_PREFIX, plan);   // only "npm" allowed
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.scope_field).toBe("build_targets");
  });

  it("SB-6 · runtime_check requested when scope forbids · rejected", () => {
    const plan: WorkstationExecutionPlan = {
      file_targets: ["data/nex-agent-workspaces/cap-fix/marker.json"],
      build_executable: null, runtime_check: true, specialists_to_run: [],
    };
    const v = checkScopeBoundary(SCOPE_SINGLE_FILE, plan);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.scope_field).toBe("runtime_required");
  });

  it("SB-7 · Windows-style path separators normalised · exact-match still works", () => {
    const plan: WorkstationExecutionPlan = {
      file_targets: ["data\\nex-agent-workspaces\\cap-fix\\marker.json"],
      build_executable: null, runtime_check: false, specialists_to_run: [],
    };
    const v = checkScopeBoundary(SCOPE_SINGLE_FILE, plan);
    expect(v.ok).toBe(true);
  });
});

describe("WO-CAP-EXECUTION-02 · adapter-level scope enforcement (integration)", () => {
  it("A-1 · proposal WITHOUT authorised_workstation_scope · every stage fail-closes with scope-boundary reason", async () => {
    const { proposal } = await seed("test.wo02.a1");
    const adapter = realWorkstationAdapter({
      proposal,   // no scope attached
      plan: {
        file_targets: ["data/nex-agent-workspaces/cap-fix/marker.json"],
        build_executable: null, runtime_check: false, specialists_to_run: [],
      },
      workspace_root: "data/nex-agent-workspaces/cap-fix",
    });
    const wo1 = await adapter.run_wo_01_state_setup("trace-a1", {
      cap_id: "CAP-TEST",
      kind: "test.wo02.a1", category: "PERFORMANCE", priority: "LOW",
      status: "PROPOSED", title: "", description: "", detected_at: "", last_updated_at: "",
      evidence: [], record_type: "NEX_CAPABILITY_GAP",
      dedupe_key: "", detector_agent_id: null, resolver_outcome: null, proposed_wo_id: null,
      history: [], provenance_chain_hash: "",
    } as unknown as Parameters<typeof adapter.run_wo_01_state_setup>[1]);
    expect(wo1.ok).toBe(false);
    expect(wo1.evidence_ref).toMatch(/^scope-boundary:/);
    expect(wo1.reason).toMatch(/no authorised_workstation_scope/);
  });

  it("A-2 · MANDATORY NEGATIVE TEST · validly-signed proposal + plan targeting OUT-OF-SCOPE path · adapter rejects", async () => {
    const { proposal, founder } = await seed("test.wo02.a2");
    // Founder attaches a scope that allows ONLY marker.json.
    const scoped = await attachWorkstationScopeToProposal({
      proposal_id: proposal.proposal_id,
      scope: SCOPE_SINGLE_FILE,
    });
    if (!scoped) throw new Error("scope attach failed");
    expect(scoped.authorised_workstation_scope).not.toBeNull();

    // Founder signs the scoped proposal (signature covers scope_hash).
    const sig = await founderSignProposal({ proposal: scoped, founder_private_key_hex: founder.privateKeyHex });
    expect(sig.length).toBeGreaterThan(0);

    // Attacker builds a plan that stays syntactically valid but targets
    // a path OUTSIDE the founder-signed scope.
    const outOfScopePlan: WorkstationExecutionPlan = {
      file_targets: ["src/lib/nex-authority-broker/broker.ts"],   // protected substrate!
      build_executable: null, runtime_check: false, specialists_to_run: [],
    };
    const adapter = realWorkstationAdapter({
      proposal: scoped, plan: outOfScopePlan,
      workspace_root: "data/nex-agent-workspaces/cap-fix",
    });
    const wo1 = await adapter.run_wo_01_state_setup("trace-a2", {
      cap_id: "CAP-TEST", kind: "test.wo02.a2", category: "PERFORMANCE", priority: "LOW",
      status: "PROPOSED", title: "", description: "", detected_at: "", last_updated_at: "",
      evidence: [], record_type: "NEX_CAPABILITY_GAP",
      dedupe_key: "", detector_agent_id: null, resolver_outcome: null, proposed_wo_id: null,
      history: [], provenance_chain_hash: "",
    } as unknown as Parameters<typeof adapter.run_wo_01_state_setup>[1]);
    expect(wo1.ok).toBe(false);
    expect(wo1.evidence_ref).toMatch(/^scope-boundary:src\/lib\/nex-authority-broker/);
    expect(wo1.reason).toMatch(/not in authorised_workstation_scope\.files_may_touch/);
  });

  it("A-3 · end-to-end via executeCapProposal · out-of-scope plan · CAP does NOT reach RESOLVED", async () => {
    const { cap, proposal, founder } = await seed("test.wo02.a3");
    const scoped = await attachWorkstationScopeToProposal({
      proposal_id: proposal.proposal_id, scope: SCOPE_SINGLE_FILE,
    });
    if (!scoped) throw new Error("scope attach failed");
    const sig = await founderSignProposal({ proposal: scoped, founder_private_key_hex: founder.privateKeyHex });
    const adapter = realWorkstationAdapter({
      proposal: scoped,
      plan: {
        file_targets: ["src/app/api/nex/hq/route.ts"],   // outside scope
        build_executable: null, runtime_check: false, specialists_to_run: [],
      },
      workspace_root: "data/nex-agent-workspaces/cap-fix",
    });
    const res = await executeCapProposal({
      cap_id: cap.cap_id,
      proposal_id: scoped.proposal_id,
      founder_signature_hex: sig,
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "TEST",
      workstation: adapter,
    });
    expect(res.outcome).not.toBe("RESOLVED");
    expect(res.attempt.all_10_passed).toBe(false);
    // At least one stage recorded a scope-boundary rejection
    const scopeReject = res.attempt.stages_executed.find((s) => s.evidence_ref.startsWith("scope-boundary:"));
    expect(scopeReject).toBeDefined();
  });

  it("A-4 · Broker rejects a signature made BEFORE scope was attached · scope tamper detection", async () => {
    const { proposal, founder } = await seed("test.wo02.a4");
    // Attacker signs the ORIGINAL scopeless proposal
    const staleSig = await founderSignProposal({ proposal, founder_private_key_hex: founder.privateKeyHex });
    // Then a scope is attached (changing the scope_hash)
    const scoped = await attachWorkstationScopeToProposal({
      proposal_id: proposal.proposal_id,
      scope: SCOPE_SINGLE_FILE,
    });
    if (!scoped) throw new Error("scope attach failed");

    const adapter = realWorkstationAdapter({
      proposal: scoped,
      plan: {
        file_targets: ["data/nex-agent-workspaces/cap-fix/marker.json"],
        build_executable: null, runtime_check: false, specialists_to_run: [],
      },
      workspace_root: "data/nex-agent-workspaces/cap-fix",
    });
    // Present the STALE signature. Broker must refuse.
    const cap2 = await persistCapabilityGap({
      kind: "test.wo02.a4-run", category: "PERFORMANCE", priority: "LOW",
      title: "run", evidence: [{ collection: "test", record_id: "e", kind: "t" }],
      detector_agent_id: null,
      dedupe_key: `wo02-a4-run-${Date.now()}-${Math.random()}`,
    });
    // Note: use the ORIGINAL cap-id-linked proposal for the Broker call
    const res = await executeCapProposal({
      cap_id: cap2.cap_id,   // any CAP; Broker checks proposal not CAP
      proposal_id: scoped.proposal_id,
      founder_signature_hex: staleSig,
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "TEST",
      workstation: adapter,
    });
    expect(res.outcome).toBe("REFUSED");
    expect(res.reason).toMatch(/signature did not verify/);
  });
});
