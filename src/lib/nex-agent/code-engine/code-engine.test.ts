// src/lib/nex-agent/code-engine/code-engine.test.ts
//
// Sprint 1 test suite · deterministic · fixture-driven · zero network egress.
// Proves NEX1's programming loop is fully owned by NEX1 · adapter is narrow.
import { describe, expect, it } from "vitest";
import { Nex1ReasoningRegistry, TemplateOnlyAdapter, TEMPLATE_ONLY_ID, NEX1_ENGINE_ERRORS, normaliseDiff, applyWholeFileDiff, enforceScope, isProtected, extractTouchedPaths, buildContext, sha256, containsSecret, computeIndependenceStats, Nex1DecisionTrailBuilder, recordProvenance, type Nex1AttemptProvenance, } from "./index";
import { runNex1AuthoringLoop } from "./nex1-authoring-loop";
describe("NEX1 Code Engine · types + constants", () => {
    it("exposes constitutional error codes with nex1_ prefix", () => {
        for (const [_, val] of Object.entries(NEX1_ENGINE_ERRORS)) {
            expect(val.startsWith("sec.nex1_")).toBe(true);
        }
    });
});
describe("template-only adapter · identity floor", () => {
    it("always reports available", async () => {
        expect(await TemplateOnlyAdapter.isAvailable()).toBe(true);
    });
    it("declares deterministic + no egress", () => {
        const cap = TemplateOnlyAdapter.capabilities();
        expect(cap.deterministic).toBe(true);
        expect(cap.network_egress).toBe("none");
    });
    it("returns diff_malformed when no template_directive supplied", async () => {
        const r = await TemplateOnlyAdapter.reason({
            task_id: "t", attempt_id: "a", intent: "add_scaffold", output_kind: "diff",
            context: { task_prompt: "x", repo_snapshot_hash: "h", file_slices: [], relevant_adrs: [], declared_scope: [] },
        });
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.code).toBe(NEX1_ENGINE_ERRORS.diff_malformed);
    });
});
describe("registry · NEX1 selection", () => {
    it("registers template-only automatically", async () => {
        const reg = new Nex1ReasoningRegistry();
        expect(reg.hasAdapter(TEMPLATE_ONLY_ID)).toBe(true);
        expect(await reg.available()).toContain(TEMPLATE_ONLY_ID);
    });
    it("returns null (not fallthrough) when no adapter supports the intent", async () => {
        const reg = new Nex1ReasoningRegistry();
        // fix_bug is not in the template-only adapter's supported list
        const chosen = await reg.chooseFor({
            task_id: "t", attempt_id: "a", intent: "fix_bug", output_kind: "diff",
            context: { task_prompt: "x", repo_snapshot_hash: "h", file_slices: [], relevant_adrs: [], declared_scope: [] },
        });
        expect(chosen).toBeNull();
    });
    it("unregister removes an adapter", () => {
        const reg = new Nex1ReasoningRegistry();
        reg.unregister(TEMPLATE_ONLY_ID);
        expect(reg.hasAdapter(TEMPLATE_ONLY_ID)).toBe(false);
    });
});
describe("diff normaliser", () => {
    it("rejects empty diff", () => {
        expect(normaliseDiff("").ok).toBe(false);
    });
    it("rejects binary marker", () => {
        expect(normaliseDiff("Binary files a and b differ").ok).toBe(false);
    });
    it("accepts a valid unified diff", () => {
        const diff = "--- a/src/x.ts\n+++ b/src/x.ts\n@@ -0,0 +1,1 @@\n+export const A = 1;\n";
        const r = normaliseDiff(diff);
        expect(r.ok).toBe(true);
        expect(r.touched_paths).toEqual(["src/x.ts"]);
    });
    it("applyWholeFileDiff reconstructs content", () => {
        const diff = "--- a/src/x.ts\n+++ b/src/x.ts\n@@ -0,0 +1,2 @@\n+export const A = 1;\n+export const B = 2;\n";
        const files = applyWholeFileDiff(diff);
        expect(files.get("src/x.ts")).toBe("export const A = 1;\nexport const B = 2;");
    });
});
describe("scope enforcer · protected paths", () => {
    it("recognises .env as protected", () => expect(isProtected(".env")).toBe(true));
    it("recognises image constitution ADRs as protected", () => {
        expect(isProtected("docs/DECISIONS/0024-image-manifest-rule.md")).toBe(true);
        expect(isProtected("docs/DECISIONS/0028-nex-intelligence-constitution.md")).toBe(true);
    });
    it("permits ordinary src paths", () => expect(isProtected("src/lib/x/y.ts")).toBe(false));
    it("rejects out-of-scope diff", () => {
        const diff = "--- a/src/x.ts\n+++ b/src/x.ts\n@@ -0,0 +1,1 @@\n+x\n";
        const r = enforceScope(diff, ["src/y.ts"]);
        expect(r.ok).toBe(false);
        expect(r.violation).toBe("out_of_scope");
    });
    it("rejects protected-path diff", () => {
        const diff = "--- a/.env\n+++ b/.env\n@@ -0,0 +1,1 @@\n+SECRET=xxx\n";
        const r = enforceScope(diff, [".env"]);
        expect(r.ok).toBe(false);
        expect(r.violation).toBe("protected_path");
    });
    it("extracts touched paths correctly", () => {
        const diff = "--- a/a.ts\n+++ b/a.ts\n@@ -0,0 +1,1 @@\n+x\n";
        expect(extractTouchedPaths(diff)).toEqual(["a.ts"]);
    });
});
describe("context builder · security", () => {
    it("rejects declared_scope containing a protected path", () => {
        const r = buildContext({ taskPrompt: "x", declaredScope: [".env"] });
        expect(r.ok).toBe(false);
        expect(r.reason).toContain("protected");
    });
    it("detects secret patterns · loose (non-test files)", () => {
        expect(containsSecret("sk-abcdefghij0123456789")).toBe(true);
        expect(containsSecret("just some code")).toBe(false);
    });
    it("sha256 is stable + deterministic", () => {
        expect(sha256("nex1")).toBe(sha256("nex1"));
        expect(sha256("nex1")).not.toBe(sha256("nex2"));
    });
});
// Sprint-1 hardening (Challenge 3.B follow-up)
describe("context builder · hardened containsSecret", () => {
    it("test-path: regex fixtures for secret shapes are ALLOWED", () => {
        const fixture = "const S = /sk-[A-Za-z0-9_-]{20,}/;";
        expect(containsSecret(fixture, "src/lib/x/y.test.ts")).toBe(false);
        expect(containsSecret(fixture, "tests/fixtures/foo.ts")).toBe(false);
    });
    it("test-path: quoted actual token literal is BLOCKED", () => {
        // Fixture assembled at RUNTIME so this source file itself does not
        // contain a full secret-shaped literal · avoids scanner self-collision.
        const q = "\"";
        const real = "const K = " + q + "sk-l" + "ive_" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" + q + ";";
        expect(containsSecret(real, "src/lib/x/y.test.ts")).toBe(true);
    });
    it("PEM private-key banner is always blocked regardless of path", () => {
        // Assemble at runtime · scanner must not self-collide on this source file.
        const dash = "-".repeat(5);
        const pem = dash + "BEGIN RSA PRIVATE KEY" + dash;
        expect(containsSecret(pem, "src/lib/x/y.test.ts")).toBe(true);
        expect(containsSecret(pem, "src/lib/x/y.ts")).toBe(true);
    });
    it("non-test-path: bare token literal is BLOCKED (loose)", () => {
        expect(containsSecret("sk-abcdefghij0123456789")).toBe(true);
    });
});
describe("decision trail · builder invariants", () => {
    it("throws when task_interpretation missing", () => {
        const b = new Nex1DecisionTrailBuilder();
        expect(() => b.build()).toThrow();
    });
    it("throws when context hash missing", () => {
        const b = new Nex1DecisionTrailBuilder();
        b.interpretTask("h");
        expect(() => b.build()).toThrow();
    });
    it("builds a complete trail when all required fields set", () => {
        const b = new Nex1DecisionTrailBuilder();
        b.interpretTask("h");
        b.composeContext("c");
        b.acceptCandidate(true);
        b.evaluateDiff("passed");
        const t = b.build();
        expect(t.task_interpretation.hash).toBe("h");
        expect(t.candidate_accepted).toBe(true);
    });
});
describe("provenance · attribution firewall", () => {
    it("attempted_by is hardcoded to nex1", () => {
        const b = new Nex1DecisionTrailBuilder();
        b.interpretTask("h");
        b.composeContext("c");
        b.acceptCandidate(true);
        b.evaluateDiff("passed");
        const p = recordProvenance({
            taskId: "t", attemptId: "a", promptHash: "p", contextHash: "c",
            result: {
                adapter_id: "template-only", model_id: null, model_version: null,
                proposed_diff: "--- a/x\n+++ b/x\n@@ -0,0 +1,1 @@\n+x\n",
                rationale: "r", confidence: 1, tokens_in: 0, tokens_out: 0,
                latency_ms: 1, deterministic: true, adapter_scope: "code_proposal_only",
            },
            trail: b.build(),
        });
        expect(p.attempted_by).toBe("nex1");
        expect(p.adapter_scope).toBe("code_proposal_only");
    });
});
describe("independent score · Amendment 1.D", () => {
    it("100% when every attempt used template-only", () => {
        const provenances = mkProvenances(["template-only", "template-only", "template-only"]);
        expect(computeIndependenceStats(provenances).independent_pct).toBe(100);
    });
    it("0% when zero attempts used template-only", () => {
        const provenances = mkProvenances(["future-adapter", "future-adapter"]);
        expect(computeIndependenceStats(provenances).independent_pct).toBe(0);
    });
    it("50% for balanced mix", () => {
        const provenances = mkProvenances(["template-only", "future-adapter"]);
        expect(computeIndependenceStats(provenances).independent_pct).toBe(50);
    });
});
// Sprint-1 hardening (Challenge 3.B follow-up) · isValidImportSpec
describe("template-only · isValidImportSpec", () => {
    it("accepts named imports", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec('import { A, B } from "./x";')).toBe(true);
    });
    it("accepts default imports", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec('import X from "./x";')).toBe(true);
    });
    it("accepts namespace imports", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec('import * as Y from "./x";')).toBe(true);
    });
    it("accepts type-only imports", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec('import type { T } from "./x";')).toBe(true);
    });
    it("accepts side-effect imports", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec('import "./polyfill";')).toBe(true);
    });
    it("REJECTS a comment masquerading as an import", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec("// TODO: NEX1 could not compose a directive")).toBe(false);
    });
    it("REJECTS arbitrary text", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec("const x = 1;")).toBe(false);
        expect(isValidImportSpec("import")).toBe(false);
        expect(isValidImportSpec("")).toBe(false);
    });
    it("REJECTS multi-line input", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec('import X from "./x";\nimport Y from "./y";')).toBe(false);
    });
    it("REJECTS dynamic import call syntax", async () => {
        const { isValidImportSpec } = await import("./adapters/template-only");
        expect(isValidImportSpec('import("./x")')).toBe(false);
    });
});
describe("NEX1 authoring loop · end-to-end via template-only", () => {
    it("produces a scaffold diff for a new module and records provenance", async () => {
        const reg = new Nex1ReasoningRegistry();
        const targetPath = "src/lib/nex-agent/code-engine/version-info.ts";
        const out = await runNex1AuthoringLoop(reg, {
            task_prompt: "Scaffold NEX1 code-engine version-info module.",
            intent: "add_scaffold",
            declared_scope: [targetPath],
            template_directive: {
                kind: "scaffold_ts_module",
                target_path: targetPath,
                module_purpose: "Publishes NEX1 Code Authoring Engine sprint version metadata.",
                exported_constants: [
                    { name: "NEX1_CODE_ENGINE_SPRINT", value_literal: "1", annotation: "Current sprint number." },
                    { name: "NEX1_CODE_ENGINE_IDENTITY_FLOOR", value_literal: '"template-only"' },
                ],
            },
        });
        expect(out.ok).toBe(true);
        expect(out.provenance?.attempted_by).toBe("nex1");
        expect(out.provenance?.adapter_id).toBe("template-only");
        expect(out.provenance?.nex1_decisions.candidate_accepted).toBe(true);
        expect(out.applied_files?.[targetPath]).toContain("NEX1_CODE_ENGINE_SPRINT");
    });
    it("refuses when target_path is not in declared_scope", async () => {
        const reg = new Nex1ReasoningRegistry();
        const out = await runNex1AuthoringLoop(reg, {
            task_prompt: "Try to scaffold outside declared scope.",
            intent: "add_scaffold",
            declared_scope: ["src/lib/nex-agent/code-engine/x.ts"],
            template_directive: {
                kind: "scaffold_ts_module",
                target_path: "src/lib/some/other/y.ts", // deliberately different
                module_purpose: "should be refused",
            },
        });
        expect(out.ok).toBe(false);
        expect(out.failure_code).toBe(NEX1_ENGINE_ERRORS.scope_violation);
    });
    it("refuses when declared_scope contains a protected path", async () => {
        const reg = new Nex1ReasoningRegistry();
        const out = await runNex1AuthoringLoop(reg, {
            task_prompt: "Attempt to touch .env",
            intent: "add_scaffold",
            declared_scope: [".env"],
            template_directive: {
                kind: "scaffold_ts_module",
                target_path: ".env",
                module_purpose: "should be refused",
            },
        });
        expect(out.ok).toBe(false);
    });
});
describe("Amendment 1.B · remove-the-adapter conformance", () => {
    it("removing every non-template adapter leaves template-only intact + NEX1 still authoring", async () => {
        const reg = new Nex1ReasoningRegistry();
        // Register a fake non-template adapter · then unregister it · confirm NEX1 still works
        reg.register({
            id: "fake-non-template",
            deterministic: false,
            isAvailable: async () => true,
            capabilities: () => ({ deterministic: false, supported_intents: ["add_feature"], network_egress: "none", declared_max_context_bytes: 1000 }),
            reason: async () => ({ ok: false, code: "sec.nex1_reasoning_not_bound", reason: "n/a" }),
        });
        expect(reg.hasAdapter("fake-non-template")).toBe(true);
        reg.unregister("fake-non-template");
        expect(reg.hasAdapter("fake-non-template")).toBe(false);
        expect(reg.hasAdapter(TEMPLATE_ONLY_ID)).toBe(true);
        // Prove NEX1 can still author
        const out = await runNex1AuthoringLoop(reg, {
            task_prompt: "Prove NEX1 still authors after adapter removal.",
            intent: "add_scaffold",
            declared_scope: ["src/lib/nex-agent/code-engine/conformance-fixture.ts"],
            template_directive: {
                kind: "scaffold_ts_module",
                target_path: "src/lib/nex-agent/code-engine/conformance-fixture.ts",
                module_purpose: "Adapter-removal conformance fixture.",
            },
        });
        expect(out.ok).toBe(true);
        expect(out.provenance?.adapter_id).toBe(TEMPLATE_ONLY_ID);
    });
});
// ── helpers ─────────────────────────────────────────────────────────
function mkProvenances(adapterIds: readonly string[]): Nex1AttemptProvenance[] {
    return adapterIds.map((adapter_id, i) => ({
        task_id: `t${i}`,
        attempt_id: `a${i}`,
        at: new Date().toISOString(),
        adapter_id,
        adapter_scope: "code_proposal_only",
        model_id: null,
        model_version: null,
        prompt_hash: "p", context_hash: "c", diff_hash: "d",
        diff_size_lines: 1, latency_ms: 1, deterministic: true,
        nex1_decisions: {
            task_interpretation: { at: new Date().toISOString(), hash: "h" },
            files_selected: [], context_composed_hash: "c",
            candidate_accepted: true, candidate_rejected_count: 0,
            diff_evaluated: "passed", tests_run: [], diagnosis_notes: "",
            repair_attempts: 0, evidence_recorded_at: new Date().toISOString(), completion_decided_at: new Date().toISOString(),
        },
        attempted_by: "nex1",
    }));
}
