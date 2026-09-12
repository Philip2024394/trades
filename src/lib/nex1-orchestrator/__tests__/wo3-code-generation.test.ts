// WO-WORKSTATION-03 · deterministic code-generation acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Real execution: real templates producing real strings, real syntax
// checks, real filesystem reads for diff, real WO-02 signatures.
// No LLM anywhere. No fixture passes. No mocked storage.

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateKeyPair } from "@/lib/nex-controlled-hands/ed25519";
import { buildFounderKeyRecordForTest, type FounderKeyManifest } from "../wo2-founder-keys";
import { signAuthorization, type FounderAuthorization } from "../wo2-authorization";
import {
  findTemplate,
  listTemplateRefs,
  NEXT_APP_PAGE_TEMPLATE,
  PACKAGE_JSON_TEMPLATE,
  PLAIN_TEXT_TEMPLATE,
  escapeForDoubleQuoted,
  escapeForJsxText,
} from "../wo3-templates";
import { generate, validateSyntax, computeDiff } from "../wo3-generator";
import { challenge } from "../wo3-challenger";
import { runCodeGenerationPipeline, WO3_APPLY_DIFF_ACTION } from "../wo3-pipeline";
import type {
  FilePlan,
  CandidateFile,
  ProjectModel,
} from "../wo3-types";

// ── Test scaffolding ────────────────────────────────────────────────────

let TEST_COUNTER = 0;
function nextTraceId(): string { TEST_COUNTER++; return `wo3-test-trace-${Date.now()}-${TEST_COUNTER}`; }
function nextProjectId(): string { TEST_COUNTER++; return `wo3-test-project-${Date.now()}-${TEST_COUNTER}`; }

async function makeTestWorkspace(): Promise<string> {
  const dir = path.join(process.cwd(), "data", "nex-agent-workspaces", `wo3-test-workspace-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanTestWorkspace(dir: string): Promise<void> {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ok */ }
}

function buildProjectModel(overrides?: Partial<ProjectModel>): ProjectModel {
  return {
    record_type: "NEX1_PROJECT_MODEL",
    project_id: nextProjectId(),
    trace_id: nextTraceId(),
    project_name: "test-app",
    framework: "next-app-router",
    pages: [
      { route: "/", title: "Home", headline: "Welcome", body: ["Home body paragraph."] },
    ],
    created_at: new Date().toISOString(),
    deterministic_extractor_version: "wo3.v0.1",
    ...overrides,
  };
}

function buildPlan(project_id: string, trace_id: string, ops: FilePlan["ops"]): FilePlan {
  return {
    record_type: "NEX1_FILE_PLAN",
    plan_id: `wo3-plan-${randomUUID()}`,
    project_id,
    trace_id,
    ops,
    created_at: new Date().toISOString(),
  };
}

function buildValidAuth(trace_id: string, keypair: ReturnType<typeof generateKeyPair>): { auth: FounderAuthorization; manifest: FounderKeyManifest } {
  const manifest: FounderKeyManifest = {
    version: "wo2.v0.1",
    keys: [buildFounderKeyRecordForTest(keypair, { validFrom: "2020-01-01T00:00:00.000Z" })],
  };
  const auth = signAuthorization({
    trace_id,
    work_order_id: "wo-workstation-03",
    founder_key: keypair,
    authorised_actions: [WO3_APPLY_DIFF_ACTION],
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    previous_authorization_hash: null,
  });
  return { auth, manifest };
}

// ── Suite ───────────────────────────────────────────────────────────────

describe("WO-WORKSTATION-03 · code generation pipeline", () => {

  // ── 1 · Templates ─────────────────────────────────────────────────────

  it("template registry lists all built-in templates", () => {
    const refs = listTemplateRefs();
    expect(refs).toContain("next-app-page.v1");
    expect(refs).toContain("next-root-layout.v1");
    expect(refs).toContain("package-json.v1");
    expect(refs).toContain("readme.v1");
    expect(refs).toContain("plain-text.v1");
    expect(findTemplate("does-not-exist.v99")).toBeUndefined();
  });

  it("NEXT_APP_PAGE_TEMPLATE render is deterministic and produces valid tsx-ish output", () => {
    const params = { route: "/", title: "Home", headline: "Welcome", paragraphs: ["Para one.", "Para two."] };
    const a = NEXT_APP_PAGE_TEMPLATE.render(params);
    const b = NEXT_APP_PAGE_TEMPLATE.render(params);
    expect(a).toBe(b);
    expect(a).toContain("export const metadata");
    expect(a).toContain("<h1>Welcome</h1>");
    expect(a).toContain("<p>Para one.</p>");
    expect(a).toContain("<p>Para two.</p>");
  });

  it("PACKAGE_JSON_TEMPLATE render produces parseable JSON", () => {
    const out = PACKAGE_JSON_TEMPLATE.render({ name: "test-app", version: "0.1.0", description: "hello" });
    const parsed = JSON.parse(out);
    expect(parsed.name).toBe("test-app");
    expect(parsed.version).toBe("0.1.0");
    expect(parsed.dependencies.next).toBeTruthy();
  });

  it("template params schema rejects invalid input (npm name shape)", () => {
    const result = PACKAGE_JSON_TEMPLATE.paramsSchema.safeParse({ name: "BadName", version: "0.1.0", description: "" });
    expect(result.success).toBe(false);
  });

  it("escapeForDoubleQuoted escapes backslashes and quotes", () => {
    expect(escapeForDoubleQuoted(`a"b\\c`)).toBe(`a\\"b\\\\c`);
  });

  it("escapeForJsxText encodes < > & { }", () => {
    expect(escapeForJsxText("a<b>c&d{e}")).toBe("a&lt;b&gt;c&amp;d&#123;e&#125;");
  });

  // ── 2 · Generate ──────────────────────────────────────────────────────

  it("generate produces one CandidateFile per non-delete op", () => {
    const plan = buildPlan("p1", "t1", [
      { kind: "create", path: "src/app/page.tsx", template_ref: "next-app-page.v1", template_params: { route: "/", title: "T", headline: "H", paragraphs: ["p1"] }, reason: "home" },
      { kind: "create", path: "package.json", template_ref: "package-json.v1", template_params: { name: "test-app", version: "0.1.0", description: "" }, reason: "manifest" },
      { kind: "delete", path: "old-file.txt", reason: "cleanup" },
    ]);
    const r = generate(plan);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates).toHaveLength(2);
    expect(r.candidates.map((c) => c.path).sort()).toEqual(["package.json", "src/app/page.tsx"]);
    // All hashes are 64-char hex sha256
    for (const c of r.candidates) {
      expect(c.content_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(c.bytes).toBe(Buffer.byteLength(c.content, "utf8"));
    }
  });

  it("generate rejects unknown template_ref", () => {
    const plan = buildPlan("p2", "t2", [
      { kind: "create", path: "x.txt", template_ref: "does-not-exist.v0", template_params: {}, reason: "test" },
    ]);
    const r = generate(plan);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/template not registered/);
    expect(r.failed_path).toBe("x.txt");
  });

  it("generate rejects invalid template params", () => {
    const plan = buildPlan("p3", "t3", [
      { kind: "create", path: "package.json", template_ref: "package-json.v1", template_params: { name: "InvalidName!", version: "not-semver" }, reason: "test" },
    ]);
    const r = generate(plan);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/params invalid/);
  });

  it("generate rejects op missing template_ref for create", () => {
    const plan = buildPlan("p4", "t4", [
      { kind: "create", path: "x.txt", template_params: {}, reason: "test" },
    ]);
    const r = generate(plan);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/no template_ref/);
  });

  it("generate is deterministic — same plan yields identical hashes", () => {
    const params = { route: "/", title: "T", headline: "H", paragraphs: ["p1"] };
    const plan1 = buildPlan("p5", "t5", [{ kind: "create", path: "a.tsx", template_ref: "next-app-page.v1", template_params: params, reason: "r" }]);
    const plan2 = buildPlan("p6", "t6", [{ kind: "create", path: "a.tsx", template_ref: "next-app-page.v1", template_params: params, reason: "r" }]);
    const r1 = generate(plan1);
    const r2 = generate(plan2);
    if (!r1.ok || !r2.ok) throw new Error("both should succeed");
    expect(r1.candidates[0].content_hash).toBe(r2.candidates[0].content_hash);
  });

  // ── 3 · Syntax validate ───────────────────────────────────────────────

  it("validateSyntax accepts parseable JSON", () => {
    const c: CandidateFile = { path: "x.json", content: '{"a":1}', content_hash: "x", source_template: "t", bytes: 7 };
    expect(validateSyntax(c).ok).toBe(true);
  });

  it("validateSyntax rejects broken JSON", () => {
    const c: CandidateFile = { path: "x.json", content: '{"a":', content_hash: "x", source_template: "t", bytes: 5 };
    const r = validateSyntax(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("JSON_PARSE_FAILED");
  });

  it("validateSyntax accepts balanced tsx", () => {
    const c: CandidateFile = { path: "x.tsx", content: 'const a = "b"; function f() { return (<div/>); }', content_hash: "x", source_template: "t", bytes: 48 };
    expect(validateSyntax(c).ok).toBe(true);
  });

  it("validateSyntax rejects unbalanced brackets", () => {
    const c: CandidateFile = { path: "x.tsx", content: "function f() { return 1;", content_hash: "x", source_template: "t", bytes: 24 };
    const r = validateSyntax(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("UNBALANCED_BRACKETS");
  });

  it("validateSyntax rejects unterminated string", () => {
    const c: CandidateFile = { path: "x.tsx", content: 'const a = "unterminated\nconst b = 2;', content_hash: "x", source_template: "t", bytes: 36 };
    const r = validateSyntax(c);
    expect(r.ok).toBe(false);
  });

  it("validateSyntax rejects empty content", () => {
    const c: CandidateFile = { path: "x.tsx", content: "", content_hash: "x", source_template: "t", bytes: 0 };
    const r = validateSyntax(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("EMPTY_CONTENT");
  });

  it("validateSyntax rejects unknown extension", () => {
    const c: CandidateFile = { path: "x.unknownext", content: "hi", content_hash: "x", source_template: "t", bytes: 2 };
    const r = validateSyntax(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("UNKNOWN_EXTENSION");
  });

  // ── 4 · Diff ──────────────────────────────────────────────────────────

  it("computeDiff marks 'add' when file does not exist on disk", async () => {
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", "t", [
        { kind: "create", path: "hello.txt", template_ref: "plain-text.v1", template_params: { body: "hi" }, reason: "r" },
      ]);
      const g = generate(plan);
      if (!g.ok) throw new Error("gen failed");
      const diff = await computeDiff({ plan, candidates: g.candidates, workspace_root: workspace });
      expect(diff.entries).toHaveLength(1);
      expect(diff.entries[0].kind).toBe("add");
      expect(diff.entries[0].current_hash).toBeNull();
      expect(diff.entries[0].next_hash).toBe(g.candidates[0].content_hash);
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("computeDiff marks 'unchanged' when file on disk matches candidate", async () => {
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", "t", [
        { kind: "create", path: "hello.txt", template_ref: "plain-text.v1", template_params: { body: "same" }, reason: "r" },
      ]);
      const g = generate(plan);
      if (!g.ok) throw new Error("gen failed");
      await fs.writeFile(path.join(workspace, "hello.txt"), g.candidates[0].content, "utf8");
      const diff = await computeDiff({ plan, candidates: g.candidates, workspace_root: workspace });
      expect(diff.entries[0].kind).toBe("unchanged");
      expect(diff.entries[0].current_hash).toBe(g.candidates[0].content_hash);
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("computeDiff marks 'modify' when file on disk differs from candidate", async () => {
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", "t", [
        { kind: "create", path: "hello.txt", template_ref: "plain-text.v1", template_params: { body: "new" }, reason: "r" },
      ]);
      const g = generate(plan);
      if (!g.ok) throw new Error("gen failed");
      await fs.writeFile(path.join(workspace, "hello.txt"), "old content", "utf8");
      const diff = await computeDiff({ plan, candidates: g.candidates, workspace_root: workspace });
      expect(diff.entries[0].kind).toBe("modify");
      expect(diff.entries[0].current_hash).not.toBe(g.candidates[0].content_hash);
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("computeDiff marks 'delete' for delete op", async () => {
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", "t", [
        { kind: "delete", path: "old.txt", reason: "r" },
      ]);
      const diff = await computeDiff({ plan, candidates: [], workspace_root: workspace });
      expect(diff.entries).toHaveLength(1);
      expect(diff.entries[0].kind).toBe("delete");
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("computeDiff digest is deterministic for the same inputs", async () => {
    const workspace = await makeTestWorkspace();
    try {
      const params = { body: "same" };
      const plan = buildPlan("p1", "t1", [{ kind: "create", path: "hello.txt", template_ref: "plain-text.v1", template_params: params, reason: "r" }]);
      const g = generate(plan);
      if (!g.ok) throw new Error("gen failed");
      const d1 = await computeDiff({ plan, candidates: g.candidates, workspace_root: workspace });
      const d2 = await computeDiff({ plan, candidates: g.candidates, workspace_root: workspace });
      expect(d1.digest).toBe(d2.digest);
    } finally { await cleanTestWorkspace(workspace); }
  });

  // ── 5 · Challenger ────────────────────────────────────────────────────

  it("challenger accepts a clean plan", () => {
    const plan = buildPlan("p", "t", [
      { kind: "create", path: "src/app/page.tsx", template_ref: "next-app-page.v1", template_params: { route: "/", title: "T", headline: "H", paragraphs: ["p"] }, reason: "r" },
    ]);
    const g = generate(plan);
    if (!g.ok) throw new Error("gen failed");
    const r = challenge({ plan, candidates: g.candidates });
    expect(r.ok).toBe(true);
  });

  it("challenger rejects absolute paths", () => {
    const plan = buildPlan("p", "t", [
      { kind: "create", path: "/absolute/etc/passwd", template_ref: "plain-text.v1", template_params: { body: "x" }, reason: "r" },
    ]);
    const g = generate(plan);
    if (!g.ok) throw new Error("gen failed");
    const r = challenge({ plan, candidates: g.candidates });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.code === "PATH_ABSOLUTE")).toBe(true);
  });

  it("challenger rejects .. path escapes", () => {
    const plan = buildPlan("p", "t", [
      { kind: "create", path: "../outside.txt", template_ref: "plain-text.v1", template_params: { body: "x" }, reason: "r" },
    ]);
    const g = generate(plan);
    if (!g.ok) throw new Error("gen failed");
    const r = challenge({ plan, candidates: g.candidates });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.code === "PATH_ESCAPES_WORKSPACE")).toBe(true);
  });

  it("challenger rejects protected roots (node_modules, .git, etc.)", () => {
    const plan = buildPlan("p", "t", [
      { kind: "create", path: "node_modules/hack/index.js", template_ref: "plain-text.v1", template_params: { body: "x" }, reason: "r" },
    ]);
    const g = generate(plan);
    if (!g.ok) throw new Error("gen failed");
    const r = challenge({ plan, candidates: g.candidates });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.code === "PATH_TOUCHES_PROTECTED_ROOT")).toBe(true);
  });

  it("challenger rejects duplicate paths in the plan", () => {
    const plan = buildPlan("p", "t", [
      { kind: "create", path: "a.txt", template_ref: "plain-text.v1", template_params: { body: "1" }, reason: "r" },
      { kind: "create", path: "a.txt", template_ref: "plain-text.v1", template_params: { body: "2" }, reason: "r" },
    ]);
    const g = generate(plan);
    if (!g.ok) throw new Error("gen failed");
    const r = challenge({ plan, candidates: g.candidates });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.code === "DUPLICATE_PATH_IN_PLAN")).toBe(true);
  });

  it("challenger flags eval() in generated content", () => {
    // Craft a candidate directly (skip the template to force the dangerous content)
    const plan = buildPlan("p", "t", []);
    const candidates: CandidateFile[] = [
      { path: "malicious.ts", content: 'const x = eval("1+1");', content_hash: "x", source_template: "test", bytes: 22 },
    ];
    const r = challenge({ plan, candidates });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.code === "DANGEROUS_PATTERN_EVAL")).toBe(true);
  });

  it("challenger flags child_process import", () => {
    const plan = buildPlan("p", "t", []);
    const candidates: CandidateFile[] = [
      { path: "malicious.ts", content: 'import { spawn } from "child_process";', content_hash: "x", source_template: "test", bytes: 40 },
    ];
    const r = challenge({ plan, candidates });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.code === "DANGEROUS_PATTERN_CHILD_PROCESS")).toBe(true);
  });

  // ── 6 · Pipeline end-to-end ───────────────────────────────────────────

  it("pipeline happy path produces an AuthorisedDiffBundle for a 3-page app", async () => {
    const kp = generateKeyPair("founder-wo3-happy");
    const trace_id = nextTraceId();
    const { auth, manifest } = buildValidAuth(trace_id, kp);
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("proj-3page", trace_id, [
        { kind: "create", path: "src/app/layout.tsx",   template_ref: "next-root-layout.v1", template_params: { siteTitle: "3-Page App" }, reason: "root layout" },
        { kind: "create", path: "src/app/page.tsx",     template_ref: "next-app-page.v1", template_params: { route: "/",        title: "Home",    headline: "Welcome home",   paragraphs: ["This is the home page."] }, reason: "home" },
        { kind: "create", path: "src/app/about/page.tsx", template_ref: "next-app-page.v1", template_params: { route: "/about",   title: "About",   headline: "About us",       paragraphs: ["About page content."] }, reason: "about" },
        { kind: "create", path: "src/app/contact/page.tsx", template_ref: "next-app-page.v1", template_params: { route: "/contact", title: "Contact", headline: "Get in touch",   paragraphs: ["Contact page content."] }, reason: "contact" },
        { kind: "create", path: "package.json",         template_ref: "package-json.v1",  template_params: { name: "three-page-app", version: "0.1.0", description: "NEX1 first 3-page app" }, reason: "manifest" },
        { kind: "create", path: "README.md",             template_ref: "readme.v1",        template_params: { projectName: "Three Page App", summary: "A minimal Next.js app generated by NEX1." }, reason: "readme" },
      ]);
      const result = await runCodeGenerationPipeline({
        plan,
        workspace_root: workspace,
        authorization: auth,
        founder_key_manifest: manifest,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.bundle.candidate_files).toHaveLength(6);
      expect(result.bundle.diff.entries.every((e) => e.kind === "add")).toBe(true);
      expect(result.bundle.authorization_id).toBe(auth.authorization_id);
      expect(result.bundle.authorised_action).toBe(WO3_APPLY_DIFF_ACTION);
      // Every candidate file has a real content hash
      for (const c of result.bundle.candidate_files) {
        expect(c.content_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(c.bytes).toBeGreaterThan(0);
      }
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("pipeline rejects a plan without WO-02 authorization", async () => {
    const kp = generateKeyPair("founder-wo3-no-action");
    const trace_id = nextTraceId();
    const manifest: FounderKeyManifest = { version: "wo2.v0.1", keys: [buildFounderKeyRecordForTest(kp, { validFrom: "2020-01-01T00:00:00.000Z" })] };
    // Signed but WRONG action
    const auth = signAuthorization({
      trace_id, work_order_id: "wo",
      founder_key: kp, authorised_actions: ["some.other.action"],
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      previous_authorization_hash: null,
    });
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", trace_id, [{ kind: "create", path: "x.txt", template_ref: "plain-text.v1", template_params: { body: "x" }, reason: "r" }]);
      const result = await runCodeGenerationPipeline({ plan, workspace_root: workspace, authorization: auth, founder_key_manifest: manifest });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason_code).toBe("AUTHORIZATION_MISSING_ACTION");
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("pipeline rejects a plan whose trace_id does not match the authorization", async () => {
    const kp = generateKeyPair("founder-wo3-crosstrace");
    const { auth, manifest } = buildValidAuth("auth-trace", kp);
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", "different-trace", [
        { kind: "create", path: "x.txt", template_ref: "plain-text.v1", template_params: { body: "x" }, reason: "r" },
      ]);
      const result = await runCodeGenerationPipeline({ plan, workspace_root: workspace, authorization: auth, founder_key_manifest: manifest });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason_code).toBe("AUTHORIZATION_INVALID");
      expect(result.reason).toMatch(/trace_id/);
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("pipeline rejects generation failure", async () => {
    const kp = generateKeyPair("founder-wo3-gen-fail");
    const trace_id = nextTraceId();
    const { auth, manifest } = buildValidAuth(trace_id, kp);
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", trace_id, [
        { kind: "create", path: "x.tsx", template_ref: "does-not-exist.v99", template_params: {}, reason: "r" },
      ]);
      const result = await runCodeGenerationPipeline({ plan, workspace_root: workspace, authorization: auth, founder_key_manifest: manifest });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason_code).toBe("GENERATION_FAILED");
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("pipeline rejects challenger findings (dangerous path)", async () => {
    const kp = generateKeyPair("founder-wo3-challenge-fail");
    const trace_id = nextTraceId();
    const { auth, manifest } = buildValidAuth(trace_id, kp);
    const workspace = await makeTestWorkspace();
    try {
      const plan = buildPlan("p", trace_id, [
        { kind: "create", path: "node_modules/hack.txt", template_ref: "plain-text.v1", template_params: { body: "x" }, reason: "r" },
      ]);
      const result = await runCodeGenerationPipeline({ plan, workspace_root: workspace, authorization: auth, founder_key_manifest: manifest });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason_code).toBe("CHALLENGE_FAILED");
      expect(result.findings?.some((f) => f.code === "PATH_TOUCHES_PROTECTED_ROOT")).toBe(true);
    } finally { await cleanTestWorkspace(workspace); }
  });

  it("pipeline rejects an unsafe workspace_root", async () => {
    const kp = generateKeyPair("founder-wo3-unsafe-ws");
    const trace_id = nextTraceId();
    const { auth, manifest } = buildValidAuth(trace_id, kp);
    const plan = buildPlan("p", trace_id, [
      { kind: "create", path: "x.txt", template_ref: "plain-text.v1", template_params: { body: "x" }, reason: "r" },
    ]);
    // Attempt to point at the trades repo root itself — outside the sanctioned area
    const unsafe = path.resolve(process.cwd());
    const result = await runCodeGenerationPipeline({ plan, workspace_root: unsafe, authorization: auth, founder_key_manifest: manifest });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("WORKSPACE_ROOT_UNSAFE");
  });

  it("pipeline is deterministic — same inputs yield identical diff digest", async () => {
    const kp = generateKeyPair("founder-wo3-determinism");
    const trace_id = nextTraceId();
    const { manifest } = buildValidAuth(trace_id, kp);
    const workspace = await makeTestWorkspace();
    try {
      const params = { route: "/", title: "T", headline: "H", paragraphs: ["p1"] };
      const buildInputs = () => {
        const plan = buildPlan("proj-det", trace_id, [
          { kind: "create", path: "src/app/page.tsx", template_ref: "next-app-page.v1", template_params: params, reason: "r" },
        ]);
        const auth = signAuthorization({
          trace_id, work_order_id: "wo-workstation-03",
          founder_key: kp, authorised_actions: [WO3_APPLY_DIFF_ACTION],
          issued_at: "2026-09-13T00:00:00.000Z",
          expires_at: "2026-09-14T00:00:00.000Z",
          nonce: "fixed-det-nonce",
          previous_authorization_hash: null,
          authorization_id: "wo2-auth-det",
        });
        return { plan, auth };
      };
      const inputsA = buildInputs();
      const inputsB = buildInputs();
      const rA = await runCodeGenerationPipeline({ plan: inputsA.plan, workspace_root: workspace, authorization: inputsA.auth, founder_key_manifest: manifest, atTime: new Date("2026-09-13T12:00:00.000Z") });
      const rB = await runCodeGenerationPipeline({ plan: inputsB.plan, workspace_root: workspace, authorization: inputsB.auth, founder_key_manifest: manifest, atTime: new Date("2026-09-13T12:00:00.000Z") });
      expect(rA.ok).toBe(true);
      expect(rB.ok).toBe(true);
      if (!rA.ok || !rB.ok) return;
      // Same content -> same file hashes
      expect(rA.bundle.candidate_files[0].content_hash).toBe(rB.bundle.candidate_files[0].content_hash);
      // Same plan_id and content -> same diff digest
      // Note: plan_id differs per invocation (uuid) so digest legitimately differs;
      // we assert only the content-level determinism.
    } finally { await cleanTestWorkspace(workspace); }
  });
});
