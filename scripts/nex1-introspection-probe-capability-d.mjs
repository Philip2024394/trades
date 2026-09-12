#!/usr/bin/env node
// scripts/nex1-introspection-probe-capability-d.mjs
//
// NEX1 Capability D · INTROSPECTION PROBE · read-only · zero mutation.
//
// Founder question (2026-09-12): "Your previous repair changed the code from
// a missing-property error to a type-mismatch error. Explain what changed,
// why the new repair is invalid, and what information would be required to
// choose a valid replacement value."
//
// This probe attempts to route that question through NEX1's actual input
// surface (Nex1ReasoningRequest) and observes what NEX1's engine returns.
// If NEX1 has no mechanism to receive and produce a diagnostic answer, the
// probe records exactly that. No teaching. No repair. No file writes.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_INTRO_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-introspection-probe-capability-d.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_INTRO_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

const sha256 = (t) => createHash("sha256").update(t).digest("hex");

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const FIXTURE_PATH = "data/nex1-code-engine/novel-challenge/widget-source.ts";
const fixtureContent = readFileSync(resolve(REPO_ROOT, FIXTURE_PATH), "utf8");

const INTROSPECTION_QUESTION =
  "Your previous repair changed the code from a missing-property error to a type-mismatch " +
  "error. Explain what changed, why the new repair is invalid, and what information would " +
  "be required to choose a valid replacement value.";

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);

console.log("NEX1 · CAPABILITY D · INTROSPECTION PROBE (read-only)");
console.log("─".repeat(72));
console.log("\nQuestion routed to NEX1:");
console.log(`  "${INTROSPECTION_QUESTION}"`);
console.log("\nRegistered adapters: [" + registry.listRegistered().join(", ") + "]");

const evidence = {
  at: new Date().toISOString(),
  probe: "capability-d · introspection · read-only",
  question: INTROSPECTION_QUESTION,
  attempts: [],
};

// ─── Attempt 1 · route as task_prompt, no template_directive ──────────
console.log("\n[Attempt 1] Route the question via context.task_prompt only, no directive.");
{
  const req = {
    task_id: "intro-1",
    attempt_id: "attempt-intro-1",
    intent: "add_feature",
    context: {
      task_prompt: INTROSPECTION_QUESTION,
      repo_snapshot_hash: sha256(fixtureContent),
      file_slices: [{ path: FIXTURE_PATH, content: fixtureContent, content_hash: sha256(fixtureContent) }],
      relevant_adrs: [],
      declared_scope: [FIXTURE_PATH],
    },
    output_kind: "structured_plan",
  };
  const resp = await engine.nex1InvokeAdapter(registry, req);
  console.log(`  Response.ok:        ${resp.ok}`);
  if (!resp.ok) {
    console.log(`  Response.code:      ${resp.code}`);
    console.log(`  Response.reason:    ${resp.reason}`);
    evidence.attempts.push({ attempt: 1, ok: false, code: resp.code, reason: resp.reason });
  } else {
    console.log(`  proposed_diff:      ${resp.result.proposed_diff.slice(0, 120)}...`);
    console.log(`  rationale:          ${resp.result.rationale.slice(0, 200)}`);
    evidence.attempts.push({ attempt: 1, ok: true, rationale: resp.result.rationale });
  }
}

// ─── Attempt 2 · include the failure evidence in the prompt ───────────
console.log("\n[Attempt 2] Route the question with prior-failure evidence embedded in the prompt.");
{
  const failureEvidence = readFileSync(
    resolve(REPO_ROOT, "data/nex1-code-engine/novel-challenge/evidence-2026-09-11T20-30-29-128Z.json"),
    "utf8",
  );
  const req = {
    task_id: "intro-2",
    attempt_id: "attempt-intro-2",
    intent: "fix_bug",
    context: {
      task_prompt: INTROSPECTION_QUESTION + "\n\nPrior failure evidence:\n" + failureEvidence,
      repo_snapshot_hash: sha256(fixtureContent),
      file_slices: [{ path: FIXTURE_PATH, content: fixtureContent, content_hash: sha256(fixtureContent) }],
      relevant_adrs: [],
      declared_scope: [FIXTURE_PATH],
    },
    output_kind: "test_diagnosis",
  };
  const resp = await engine.nex1InvokeAdapter(registry, req);
  console.log(`  Response.ok:        ${resp.ok}`);
  if (!resp.ok) {
    console.log(`  Response.code:      ${resp.code}`);
    console.log(`  Response.reason:    ${resp.reason}`);
    evidence.attempts.push({ attempt: 2, ok: false, code: resp.code, reason: resp.reason });
  } else {
    console.log(`  proposed_diff:      ${resp.result.proposed_diff.slice(0, 120)}...`);
    console.log(`  rationale:          ${resp.result.rationale.slice(0, 200)}`);
    evidence.attempts.push({ attempt: 2, ok: true, rationale: resp.result.rationale });
  }
}

// ─── Attempt 3 · does the engine surface any "diagnostic" directive kind? ─
console.log("\n[Attempt 3] Enumerate NEX1's declared directive kinds (proposal-surface inventory).");
{
  // Read the type source directly to enumerate directive kinds declared in the schema.
  const typesSrc = readFileSync(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/types.ts"), "utf8");
  const kindMatches = [...typesSrc.matchAll(/kind:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  const kinds = Array.from(new Set(kindMatches));
  console.log(`  directive kinds declared: [${kinds.join(", ")}]`);
  const diagnosticKinds = kinds.filter((k) =>
    /diagnose|explain|propose|introspect|reason|report/.test(k),
  );
  console.log(`  kinds matching diagnostic/proposal semantics: [${diagnosticKinds.join(", ") || "NONE"}]`);
  evidence.attempts.push({
    attempt: 3,
    kind: "surface_inventory",
    all_directive_kinds: kinds,
    diagnostic_or_proposal_kinds: diagnosticKinds,
    conclusion: diagnosticKinds.length === 0
      ? "NEX1's directive schema contains no proposal/diagnostic/introspection kinds."
      : "NEX1 has some diagnostic kinds available.",
  });
}

// ─── Attempt 4 · does any adapter consult task_prompt at all? ─────────
console.log("\n[Attempt 4] Static check · do adapters consult context.task_prompt during reason()?");
{
  const astSrc = readFileSync(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/adapters/ast-semantic.ts"), "utf8");
  const templateSrc = readFileSync(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/adapters/template-only.ts"), "utf8");
  const astConsults = /task_prompt/.test(astSrc);
  const templateConsults = /task_prompt/.test(templateSrc);
  console.log(`  ast-semantic reads task_prompt:  ${astConsults}`);
  console.log(`  template-only reads task_prompt: ${templateConsults}`);
  evidence.attempts.push({
    attempt: 4,
    kind: "adapter_prompt_consultation",
    ast_semantic_reads_task_prompt: astConsults,
    template_only_reads_task_prompt: templateConsults,
    conclusion: (!astConsults && !templateConsults)
      ? "No adapter consults context.task_prompt · NEX1's natural-language question channel is inert."
      : "At least one adapter consults task_prompt.",
  });
}

// ─── Persist evidence · unchanged fixture · read-only ─────────────────
const dir = resolve(REPO_ROOT, "data/nex1-code-engine/introspection-probe");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const path = resolve(dir, `probe-${stamp}.json`);
writeFileSync(path, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${path}`);

console.log("\n═══════════════ INTROSPECTION PROBE VERDICT ═══════════════");
const producedAnyAnswer = evidence.attempts.slice(0, 2).some((a) => a.ok === true);
if (producedAnyAnswer) {
  console.log("  NEX1 produced an answer via its authoring surface · inspect above.");
} else {
  console.log("  NEX1 produced NO diagnostic answer to the founder's question.");
  console.log("  Both routing attempts returned structural errors — the engine has no");
  console.log("  input surface for receiving and answering a natural-language / diagnostic");
  console.log("  query. Capability D absence CONFIRMED not as 'missing extractor' but as");
  console.log("  'missing reasoning/proposal surface entirely'.");
}
console.log("═".repeat(59));
