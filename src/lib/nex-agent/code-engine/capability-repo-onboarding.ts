// src/lib/nex-agent/code-engine/capability-repo-onboarding.ts
//
// NEX1 · Native Repo-Onboarding Capability · 2026-09-17.
// Founder-authorised · workstation upload → report.
//
// PURPOSE
//   When a repository is uploaded to the workstation (currently: one of the
//   corpus repos under data/nex-training-corpus/), NEX1 must be able to report
//   to the user, BEFORE the first code prompt, everything the user needs to
//   know about the repo:
//
//     · Total size (bytes + MB)
//     · Code-type distribution (file extensions)
//     · Framework(s) detected · what the repo was created with
//     · Scan errors located during upload (from safety-scanner output)
//     · Suggested restructure candidates (CODE-level · not UI-level)
//     · Any other info that would be useful before the first prompt
//
// DISCIPLINE
//   · Zero LLM · zero external network calls · zero fabrication.
//   · Read-only: the capability never modifies any file in the target repo.
//   · Read-only sandbox: refuses to inspect any path outside
//     data/nex-training-corpus/ (returns onboarding_denied for anything else).
//   · Every finding cites the exact file it came from · no aggregate claims
//     without concrete evidence.
//
// STREAMING SHAPE
//   The capability emits an ORDERED list of `OnboardingEvent`s that a
//   consumer (chat feed / SSE route) can render one by one. Every event
//   carries an `at_ms` (ms since start) so the chat feed can reproduce
//   arrival ordering. There are NO artificial delays — events emit as fast
//   as the extractors complete.

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// ─── Public types ────────────────────────────────────────────────────────

export type OnboardingEventKind =
  | "started"
  | "path_resolved"
  | "size_computed"
  | "code_types"
  | "framework_detected"
  | "package_details"
  | "scan_error"
  | "scan_summary"
  | "restructure_suggestion"
  | "readme_summary"
  | "notable_signal"
  | "ready_for_prompt"
  | "onboarding_denied";

export interface OnboardingEvent {
  readonly kind: OnboardingEventKind;
  readonly at_ms: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface OnboardingResult {
  readonly repo_id: string;
  readonly repo_root_abs: string | null;
  readonly ok: boolean;
  readonly denied_reason?: string;
  readonly events: readonly OnboardingEvent[];
  readonly duration_ms: number;
  readonly zero_llm: true;
}

export interface OnboardingInput {
  readonly repo_id: string;         // e.g. "corpus-website"
  readonly repo_root: string;       // absolute or repo-root-relative
  readonly corpus_dir_abs: string;  // e.g. .../data/nex-training-corpus
  readonly max_files_scanned?: number;
  readonly safety_scan_json?: unknown;  // optional prior safety-scan output
}

// ─── Small utils ─────────────────────────────────────────────────────────

function normalise(p: string): string {
  return p.replace(/\\/g, "/");
}

function isInsideCorpus(target: string, corpus: string): boolean {
  const t = path.resolve(target).toLowerCase();
  const c = path.resolve(corpus).toLowerCase();
  return t === c || t.startsWith(c + path.sep) || normalise(t).startsWith(normalise(c) + "/");
}

function walkFiles(dir: string, opts: { excludeDirs?: Set<string>; limit?: number } = {}): { path: string; size: number }[] {
  const excludeDirs = opts.excludeDirs ?? new Set([".git", "node_modules", "dist", "build", ".next", "coverage", ".turbo", ".cache"]);
  const limit = opts.limit ?? 50000;
  const out: { path: string; size: number }[] = [];
  const stack: string[] = [dir];
  while (stack.length && out.length < limit) {
    const cur = stack.pop()!;
    let stat: fs.Stats;
    try { stat = fs.statSync(cur); } catch { continue; }
    if (stat.isDirectory()) {
      const base = path.basename(cur);
      if (excludeDirs.has(base)) continue;
      let entries: string[] = [];
      try { entries = fs.readdirSync(cur); } catch { continue; }
      for (const name of entries) stack.push(path.join(cur, name));
    } else if (stat.isFile()) {
      out.push({ path: cur, size: stat.size });
    }
  }
  return out;
}

// ─── Framework detection ────────────────────────────────────────────────

function detectFrameworks(pkg: any, files: string[]): {
  frameworks: string[];
  testing: string[];
  styling: string[];
  state: string[];
  build: string[];
  data: string[];
  typescript: boolean;
  runtime_files_present: string[];
} {
  const all: Record<string, string> = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const has = (name: string) => Object.keys(all).some((k) => k === name || k.startsWith(name + "/"));
  const frameworks: string[] = [];
  const testing: string[] = [];
  const styling: string[] = [];
  const state: string[] = [];
  const build: string[] = [];
  const data: string[] = [];
  if (has("next")) frameworks.push("Next.js");
  if (has("react")) frameworks.push("React");
  if (has("vue")) frameworks.push("Vue");
  if (has("svelte")) frameworks.push("Svelte");
  if (has("astro")) frameworks.push("Astro");
  if (has("@remix-run")) frameworks.push("Remix");
  if (has("express")) frameworks.push("Express");
  if (has("fastify")) frameworks.push("Fastify");
  if (has("vitest")) testing.push("Vitest");
  if (has("jest")) testing.push("Jest");
  if (has("@playwright/test") || has("@playwright")) testing.push("Playwright");
  if (has("cypress")) testing.push("Cypress");
  if (has("@testing-library")) testing.push("Testing-Library");
  if (has("tailwindcss")) styling.push("Tailwind CSS");
  if (has("styled-components")) styling.push("styled-components");
  if (has("@emotion")) styling.push("Emotion");
  if (has("zustand")) state.push("Zustand");
  if (has("@reduxjs/toolkit") || has("@reduxjs")) state.push("Redux Toolkit");
  if (has("jotai")) state.push("Jotai");
  if (has("recoil")) state.push("Recoil");
  if (has("vite")) build.push("Vite");
  if (has("webpack")) build.push("Webpack");
  if (has("turbo")) build.push("Turborepo");
  if (has("esbuild")) build.push("esbuild");
  if (has("@supabase/supabase-js") || has("@supabase")) data.push("Supabase");
  if (has("firebase") || has("@firebase")) data.push("Firebase");
  if (has("prisma") || has("@prisma")) data.push("Prisma");
  if (has("drizzle-orm")) data.push("Drizzle");
  if (has("appwrite")) data.push("Appwrite");
  if (has("mongoose")) data.push("Mongoose (MongoDB)");
  if (has("stripe")) data.push("Stripe");
  if (has("@tanstack/react-query")) data.push("TanStack Query");
  const tsPresent = files.some((f) => f.endsWith("tsconfig.json"));
  const typescript = tsPresent || has("typescript");
  const runtime_files_present: string[] = [];
  const runtimeCandidates = ["next.config.js", "next.config.ts", "next.config.mjs", "vite.config.ts", "vite.config.js", "svelte.config.js", "astro.config.mjs", "tailwind.config.js", "tailwind.config.ts", "tsconfig.json"];
  for (const c of runtimeCandidates) if (files.some((f) => path.basename(f) === c)) runtime_files_present.push(c);
  return { frameworks, testing, styling, state, build, data, typescript, runtime_files_present };
}

// ─── Code-type distribution ─────────────────────────────────────────────

function codeTypeDistribution(files: { path: string; size: number }[]): Array<{ ext: string; count: number; total_bytes: number }> {
  const map = new Map<string, { count: number; total_bytes: number }>();
  for (const f of files) {
    const ext = path.extname(f.path).toLowerCase() || "(none)";
    const entry = map.get(ext) ?? { count: 0, total_bytes: 0 };
    entry.count++;
    entry.total_bytes += f.size;
    map.set(ext, entry);
  }
  return [...map.entries()]
    .map(([ext, v]) => ({ ext, count: v.count, total_bytes: v.total_bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

// ─── Restructure suggestions (deterministic heuristics · CODE not UI) ───

interface RestructureSuggestion {
  readonly severity: "info" | "moderate" | "important";
  readonly kind: string;
  readonly rationale: string;
  readonly evidence: readonly string[];
  readonly targeted_files_count: number;
  readonly sample_files: readonly string[];
}

function restructureSuggestions(
  repoRoot: string,
  files: { path: string; size: number }[],
  fw: ReturnType<typeof detectFrameworks>,
  pkg: any,
): RestructureSuggestion[] {
  const rel = (p: string) => normalise(path.relative(repoRoot, p));
  const out: RestructureSuggestion[] = [];

  // Heuristic 1 · very-large source files (> 500 lines or > 25 KB)
  const largeSourceFiles: string[] = [];
  for (const f of files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f.path)) continue;
    if (f.size < 25 * 1024) continue;
    largeSourceFiles.push(rel(f.path) + " · " + Math.round(f.size / 1024) + " KB");
  }
  if (largeSourceFiles.length > 0) {
    out.push({
      severity: largeSourceFiles.length >= 5 ? "important" : "moderate",
      kind: "large_source_files",
      rationale: `${largeSourceFiles.length} source file(s) exceed 25 KB · consider splitting into focused modules for testability and readability.`,
      evidence: largeSourceFiles.slice(0, 8),
      targeted_files_count: largeSourceFiles.length,
      sample_files: largeSourceFiles.slice(0, 8),
    });
  }

  // Heuristic 2 · test file ratio
  const sourceFiles = files.filter((f) => /\.(ts|tsx|js|jsx)$/i.test(f.path));
  const testFiles = files.filter((f) => /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(f.path) || /(?:^|\/)__tests__\//.test(rel(f.path)) || /(?:^|\/)tests?\//.test(rel(f.path)));
  const ratio = sourceFiles.length > 0 ? testFiles.length / sourceFiles.length : 0;
  if (sourceFiles.length >= 100 && ratio < 0.05) {
    out.push({
      severity: "important",
      kind: "very_low_test_ratio",
      rationale: `Test file ratio is ${(ratio * 100).toFixed(2)}% (${testFiles.length}/${sourceFiles.length} source files) · industry norm is 5-20% · adding smoke + behavioural tests would materially reduce regression risk.`,
      evidence: testFiles.slice(0, 5).map((f) => rel(f.path)),
      targeted_files_count: sourceFiles.length,
      sample_files: [],
    });
  }

  // Heuristic 3 · mixed .cjs and .js in scripts/
  const scriptCjs = files.filter((f) => normalise(f.path).includes("/scripts/") && f.path.endsWith(".cjs"));
  const scriptJs = files.filter((f) => normalise(f.path).includes("/scripts/") && (f.path.endsWith(".js") || f.path.endsWith(".mjs")));
  if (scriptCjs.length > 0 && scriptJs.length > 0) {
    out.push({
      severity: "moderate",
      kind: "mixed_module_types_in_scripts",
      rationale: `scripts/ contains ${scriptCjs.length} .cjs and ${scriptJs.length} .js/.mjs files · consolidate to one module system to reduce confusion.`,
      evidence: [...scriptCjs.slice(0, 3).map((f) => rel(f.path)), ...scriptJs.slice(0, 3).map((f) => rel(f.path))],
      targeted_files_count: scriptCjs.length + scriptJs.length,
      sample_files: scriptCjs.slice(0, 2).concat(scriptJs.slice(0, 2)).map((f) => rel(f.path)),
    });
  }

  // Heuristic 4 · package.json has many npm scripts
  const scripts = pkg?.scripts ?? {};
  const scriptKeys = Object.keys(scripts);
  if (scriptKeys.length > 30) {
    out.push({
      severity: "moderate",
      kind: "heavy_npm_scripts",
      rationale: `package.json declares ${scriptKeys.length} npm scripts · consider consolidating with flags or extracting into a task runner.`,
      evidence: scriptKeys.slice(0, 10),
      targeted_files_count: 1,
      sample_files: ["package.json"],
    });
  }

  // Heuristic 5 · testing framework declared but few / no test files
  if (fw.testing.length > 0 && testFiles.length === 0) {
    out.push({
      severity: "important",
      kind: "testing_framework_unused",
      rationale: `Testing framework(s) declared in package.json (${fw.testing.join(", ")}) but no test files present · either write tests or remove unused dependencies.`,
      evidence: fw.testing,
      targeted_files_count: 0,
      sample_files: [],
    });
  }

  // Heuristic 6 · long directory paths (> 6 segments) hint at over-nesting
  const deepFiles = files.filter((f) => normalise(rel(f.path)).split("/").length > 8 && /\.(ts|tsx|js|jsx)$/i.test(f.path));
  if (deepFiles.length >= 5) {
    out.push({
      severity: "moderate",
      kind: "deeply_nested_directories",
      rationale: `${deepFiles.length} source file(s) live more than 8 directories deep · flatter structures are easier to navigate.`,
      evidence: deepFiles.slice(0, 5).map((f) => rel(f.path)),
      targeted_files_count: deepFiles.length,
      sample_files: deepFiles.slice(0, 5).map((f) => rel(f.path)),
    });
  }

  // Heuristic 7 · duplicate filenames across the tree hint at inconsistent naming
  const nameCounts = new Map<string, string[]>();
  for (const f of files) {
    if (!/\.(ts|tsx|js|jsx)$/i.test(f.path)) continue;
    const b = path.basename(f.path);
    const arr = nameCounts.get(b) ?? [];
    arr.push(rel(f.path));
    nameCounts.set(b, arr);
  }
  const dupes = [...nameCounts.entries()].filter(([, arr]) => arr.length >= 5).slice(0, 5);
  if (dupes.length > 0) {
    out.push({
      severity: "info",
      kind: "repeated_filenames",
      rationale: `${dupes.length} filename(s) repeat 5+ times across the tree (e.g. ${dupes.map(([n]) => n).join(", ")}) · verify these are intentional co-located components vs unintentional duplicates.`,
      evidence: dupes.flatMap(([n, arr]) => [n + " · x" + arr.length, ...arr.slice(0, 3)]),
      targeted_files_count: dupes.reduce((s, [, arr]) => s + arr.length, 0),
      sample_files: dupes[0]?.[1]?.slice(0, 3) ?? [],
    });
  }

  return out;
}

// ─── Notable signals (helpful pre-prompt context) ────────────────────────

function notableSignals(files: { path: string; size: number }[], repoRoot: string, pkg: any): string[] {
  const notes: string[] = [];
  const rel = (p: string) => normalise(path.relative(repoRoot, p));
  const hasSql = files.some((f) => f.path.endsWith(".sql"));
  const sqlCount = files.filter((f) => f.path.endsWith(".sql")).length;
  if (hasSql) notes.push(`SQL migration discipline observed · ${sqlCount} .sql file(s) present.`);
  const androidCompanion = files.some((f) => normalise(rel(f.path)).startsWith("android/"));
  if (androidCompanion) notes.push(`Android companion detected · Gradle-based mobile app embedded as sibling directory.`);
  const dockerFile = files.some((f) => path.basename(f.path) === "Dockerfile");
  if (dockerFile) notes.push(`Dockerfile present · containerised deployment supported.`);
  const supabase = files.some((f) => normalise(rel(f.path)).startsWith("supabase/"));
  if (supabase) notes.push(`Supabase config directory present · migrations + edge functions may live here.`);
  if (pkg?.private === true) notes.push(`package.json is marked "private": true · not intended for npm publish.`);
  const nodeVersion = pkg?.engines?.node ?? null;
  if (nodeVersion) notes.push(`Node engine pinned: ${nodeVersion}.`);
  return notes;
}

// ─── Main entry ──────────────────────────────────────────────────────────

export function runRepoOnboarding(input: OnboardingInput): OnboardingResult {
  const t0 = Date.now();
  const events: OnboardingEvent[] = [];
  const emit = (kind: OnboardingEventKind, data: Readonly<Record<string, unknown>>) =>
    events.push({ kind, at_ms: Date.now() - t0, data });

  emit("started", { repo_id: input.repo_id });

  // Sandbox check.
  const repoAbs = path.resolve(input.repo_root);
  if (!isInsideCorpus(repoAbs, input.corpus_dir_abs)) {
    emit("onboarding_denied", {
      reason: "path_outside_corpus_sandbox",
      requested: repoAbs,
      corpus_dir: input.corpus_dir_abs,
    });
    return {
      repo_id: input.repo_id,
      repo_root_abs: null,
      ok: false,
      denied_reason: "path_outside_corpus_sandbox",
      events,
      duration_ms: Date.now() - t0,
      zero_llm: true,
    };
  }
  if (!fs.existsSync(repoAbs) || !fs.statSync(repoAbs).isDirectory()) {
    emit("onboarding_denied", { reason: "repo_not_found", requested: repoAbs });
    return {
      repo_id: input.repo_id,
      repo_root_abs: null,
      ok: false,
      denied_reason: "repo_not_found",
      events,
      duration_ms: Date.now() - t0,
      zero_llm: true,
    };
  }
  emit("path_resolved", { abs: repoAbs });

  // File walk.
  const files = walkFiles(repoAbs, { limit: input.max_files_scanned ?? 20000 });
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  emit("size_computed", {
    file_count: files.length,
    total_bytes: totalBytes,
    total_mb: +(totalBytes / 1024 / 1024).toFixed(2),
  });

  // Code-type distribution.
  const codeTypes = codeTypeDistribution(files);
  emit("code_types", { distribution: codeTypes });

  // package.json / framework detection.
  const pkgPath = path.join(repoAbs, "package.json");
  let pkg: any = null;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch { pkg = null; }
  if (pkg) {
    emit("package_details", {
      name: pkg.name ?? null,
      version: pkg.version ?? null,
      description: (pkg.description ?? "").slice(0, 200),
      dependencies_count: Object.keys(pkg.dependencies ?? {}).length,
      dev_dependencies_count: Object.keys(pkg.devDependencies ?? {}).length,
      scripts_count: Object.keys(pkg.scripts ?? {}).length,
      private: pkg.private ?? null,
    });
  }
  const fileNames = files.map((f) => f.path);
  const fw = detectFrameworks(pkg, fileNames);
  emit("framework_detected", {
    frameworks: fw.frameworks,
    testing: fw.testing,
    styling: fw.styling,
    state: fw.state,
    build: fw.build,
    data: fw.data,
    typescript: fw.typescript,
    runtime_files_present: fw.runtime_files_present,
  });

  // Scan errors (from optional safety-scan JSON).
  const scan = input.safety_scan_json as any;
  if (scan && Array.isArray(scan.results)) {
    const forRepo = scan.results.find((r: any) => r.repo === input.repo_id) ?? null;
    if (forRepo && Array.isArray(forRepo.indicators)) {
      for (const ind of forRepo.indicators.filter((i: any) => i.severity === "HIGH")) {
        emit("scan_error", { severity: "HIGH", kind: ind.kind, file: ind.file, note: ind.note ?? null, size: ind.size ?? null });
      }
      emit("scan_summary", {
        HIGH: forRepo.indicator_counts_by_severity?.HIGH ?? 0,
        MEDIUM: forRepo.indicator_counts_by_severity?.MEDIUM ?? 0,
        LOW: forRepo.indicator_counts_by_severity?.LOW ?? 0,
        quarantine: !!forRepo.quarantine,
      });
    } else {
      emit("scan_summary", { note: "no prior safety-scan record for this repo · run scan before first prompt for full assurance" });
    }
  } else {
    emit("scan_summary", { note: "no safety-scan JSON supplied to onboarding · run scan before first prompt for full assurance" });
  }

  // README summary.
  for (const candidate of ["README.md", "README", "readme.md", "Readme.md"]) {
    const p = path.join(repoAbs, candidate);
    if (fs.existsSync(p)) {
      const src = fs.readFileSync(p, "utf8");
      emit("readme_summary", {
        file: candidate,
        length: src.length,
        first_line: (src.split("\n")[0] || "").slice(0, 160),
        first_200_chars: src.slice(0, 200),
      });
      break;
    }
  }

  // Restructure suggestions.
  const suggestions = restructureSuggestions(repoAbs, files, fw, pkg);
  for (const s of suggestions) {
    emit("restructure_suggestion", {
      severity: s.severity,
      kind: s.kind,
      rationale: s.rationale,
      evidence: s.evidence,
      targeted_files_count: s.targeted_files_count,
      sample_files: s.sample_files,
    });
  }

  // Notable signals.
  const notes = notableSignals(files, repoAbs, pkg);
  for (const n of notes) emit("notable_signal", { text: n });

  // Ready.
  emit("ready_for_prompt", {
    repo_id: input.repo_id,
    file_count: files.length,
    frameworks_detected: fw.frameworks.length,
    restructure_suggestions_count: suggestions.length,
    zero_llm: true,
  });

  return {
    repo_id: input.repo_id,
    repo_root_abs: repoAbs,
    ok: true,
    events,
    duration_ms: Date.now() - t0,
    zero_llm: true,
  };
}
