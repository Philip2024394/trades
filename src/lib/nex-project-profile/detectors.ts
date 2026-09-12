// src/lib/nex-project-profile/detectors.ts
//
// NEX1 · PROJECT PROFILE · deterministic detectors.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Every detector returns a ProfileSignal<T> with confidence + evidence_files
// + evidence_hashes + sample_size + supporting_count + counter_count.
// No universal style judgement. Descriptive only.

import { existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import type { ProfileSignal, ProfileConfidence, EvidenceHash } from "./types";
import { safeReadFile, sha256Prefix, type WalkedFile } from "./scanner";

function signal<T>(value: T | null, state: ProfileConfidence, evidence_files: readonly string[], evidence_hashes: readonly EvidenceHash[], sample_size: number, supporting_count: number, counter_count: number, method: string, notes?: string): ProfileSignal<T> {
  return { value, state, evidence_files, evidence_hashes, sample_size, supporting_count, counter_count, detection_method: method, notes };
}

// ─── Identity ────────────────────────────────────────────────────

export function detectProjectType(files: readonly WalkedFile[], root: string): ProfileSignal<string> {
  const has = (rel: string) => files.some((f) => f.rel_path === rel);
  const evidence: string[] = [];
  const hashes: EvidenceHash[] = [];
  const observed: string[] = [];
  const addEv = (path: string) => {
    if (!evidence.includes(path)) {
      evidence.push(path);
      const abs = resolve(root, path);
      const c = safeReadFile(abs, 8192);
      if (c) hashes.push({ path, sha256_prefix: sha256Prefix(c) });
    }
  };
  if (has("package.json"))   { observed.push("node.js"); addEv("package.json"); }
  if (has("Cargo.toml"))     { observed.push("rust"); addEv("Cargo.toml"); }
  if (has("pyproject.toml") || has("requirements.txt") || has("setup.py")) { observed.push("python"); if (has("pyproject.toml")) addEv("pyproject.toml"); if (has("requirements.txt")) addEv("requirements.txt"); }
  if (has("go.mod"))         { observed.push("go"); addEv("go.mod"); }
  if (has("composer.json"))  { observed.push("php"); addEv("composer.json"); }
  if (has("Gemfile"))        { observed.push("ruby"); addEv("Gemfile"); }
  if (files.some((f) => f.rel_path.endsWith(".csproj") || f.rel_path.endsWith(".sln"))) { observed.push("dotnet"); }
  if (has("pom.xml") || has("build.gradle") || has("build.gradle.kts")) { observed.push("jvm"); }

  const uniq = Array.from(new Set(observed));
  if (uniq.length === 0) return signal(null, "UNKNOWN", [], [], 0, 0, 0, "manifest-file-detection", "no known manifest found");
  const value = uniq.length === 1 ? uniq[0] : "mixed";
  const state: ProfileConfidence = "OBSERVED";
  return signal(value, state, evidence, hashes, evidence.length, evidence.length, 0, "manifest-file-detection");
}

export function detectRepositoryStructure(files: readonly WalkedFile[], root: string): ProfileSignal<"monorepo" | "single_package" | "unknown"> {
  const evidence: string[] = [];
  const hashes: EvidenceHash[] = [];
  const push = (p: string) => {
    if (!evidence.includes(p)) {
      evidence.push(p);
      const c = safeReadFile(resolve(root, p), 4096);
      if (c) hashes.push({ path: p, sha256_prefix: sha256Prefix(c) });
    }
  };
  // Monorepo signals: workspaces in package.json · pnpm-workspace.yaml · lerna.json · turbo.json · Cargo workspace
  const pkgPath = files.find((f) => f.rel_path === "package.json");
  if (pkgPath) {
    const c = safeReadFile(pkgPath.abs_path);
    if (c) {
      try {
        const j = JSON.parse(c);
        if (j.workspaces) { push("package.json"); return signal("monorepo", "OBSERVED", evidence, hashes, 1, 1, 0, "package.json workspaces field"); }
      } catch { /* invalid JSON · skip */ }
    }
  }
  if (files.some((f) => f.rel_path === "pnpm-workspace.yaml")) { push("pnpm-workspace.yaml"); return signal("monorepo", "OBSERVED", evidence, hashes, 1, 1, 0, "pnpm workspace file"); }
  if (files.some((f) => f.rel_path === "lerna.json"))          { push("lerna.json"); return signal("monorepo", "OBSERVED", evidence, hashes, 1, 1, 0, "lerna.json"); }
  if (files.some((f) => f.rel_path === "turbo.json"))          { push("turbo.json"); return signal("monorepo", "OBSERVED", evidence, hashes, 1, 1, 0, "turbo.json"); }
  if (pkgPath) return signal("single_package", "STRONGLY_INFERRED", ["package.json"], [], 1, 1, 0, "package.json without workspaces field");
  return signal("unknown", "UNKNOWN", [], [], 0, 0, 0, "no manifest evidence");
}

const EXT_TO_LANG: Readonly<Record<string, string>> = Object.freeze({
  ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
  ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".jsx": "javascript",
  ".py": "python", ".pyi": "python", ".pyw": "python",
  ".rs": "rust", ".go": "go",
  ".java": "java", ".kt": "kotlin", ".scala": "scala",
  ".cs": "csharp", ".cpp": "cpp", ".cxx": "cpp", ".cc": "cpp", ".hpp": "cpp", ".h": "cpp",
  ".c": "c",
  ".rb": "ruby", ".php": "php", ".swift": "swift", ".dart": "dart",
  ".lua": "lua", ".pl": "perl", ".r": "r", ".sh": "shell", ".bash": "bash", ".zsh": "zsh",
  ".ps1": "powershell",
  ".html": "html", ".htm": "html", ".css": "css", ".scss": "scss", ".sass": "scss",
  ".md": "markdown", ".markdown": "markdown", ".mdx": "markdown",
  ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".xml": "xml", ".svg": "svg",
});

export function detectLanguages(files: readonly WalkedFile[]): { primary: ProfileSignal<readonly string[]>; secondary: ProfileSignal<readonly string[]> } {
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = EXT_TO_LANG[f.extension];
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  if (counts.size === 0) {
    const u = signal<readonly string[]>(null, "UNKNOWN", [], [], 0, 0, 0, "extension-count");
    return { primary: u, secondary: u };
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((a, [, n]) => a + n, 0);
  // Threshold: at least 1 file · scales up with project size (10%). Very small
  // projects still detect their language · large projects require ≥10% to
  // avoid a stray file inflating the primary list.
  const majorityThreshold = Math.max(1, Math.floor(total * 0.1));
  const primary = sorted.filter(([, n]) => n >= majorityThreshold).slice(0, 3).map(([lang]) => lang);
  const secondary = sorted.filter(([lang]) => !primary.includes(lang)).slice(0, 3).map(([lang]) => lang);
  return {
    primary: signal(primary, primary.length > 0 ? "STRONGLY_INFERRED" : "UNKNOWN", [], [], total, sorted.slice(0, primary.length).reduce((a, [, n]) => a + n, 0), 0, "extension-count · top-10%-threshold"),
    secondary: signal(secondary, secondary.length > 0 ? "STRONGLY_INFERRED" : "UNKNOWN", [], [], total, sorted.slice(primary.length, primary.length + secondary.length).reduce((a, [, n]) => a + n, 0), 0, "extension-count · below-primary-threshold"),
  };
}

export function detectFrameworks(files: readonly WalkedFile[], root: string): ProfileSignal<readonly string[]> {
  const evidence: string[] = [];
  const hashes: EvidenceHash[] = [];
  const found = new Set<string>();
  const pkg = files.find((f) => f.rel_path === "package.json");
  if (pkg) {
    const c = safeReadFile(pkg.abs_path);
    if (c) {
      evidence.push("package.json");
      hashes.push({ path: "package.json", sha256_prefix: sha256Prefix(c) });
      try {
        const j = JSON.parse(c);
        const deps = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
        const check = (n: string, label: string) => { if (deps[n]) found.add(label); };
        check("react", "react"); check("next", "next.js"); check("vue", "vue"); check("svelte", "svelte");
        check("@angular/core", "angular"); check("astro", "astro"); check("express", "express");
        check("fastify", "fastify"); check("koa", "koa"); check("nestjs/core", "nestjs");
        check("@nestjs/core", "nestjs"); check("vitest", "vitest"); check("jest", "jest");
        check("mocha", "mocha"); check("playwright", "playwright"); check("cypress", "cypress");
        check("prettier", "prettier"); check("eslint", "eslint"); check("typescript", "typescript");
        check("tailwindcss", "tailwind"); check("bun", "bun");
      } catch { /* invalid · skip */ }
    }
  }
  const cargo = files.find((f) => f.rel_path === "Cargo.toml");
  if (cargo) {
    const c = safeReadFile(cargo.abs_path);
    if (c) {
      evidence.push("Cargo.toml");
      hashes.push({ path: "Cargo.toml", sha256_prefix: sha256Prefix(c) });
      if (/\bactix-web\s*=/.test(c)) found.add("actix-web");
      if (/\brocket\s*=/.test(c))     found.add("rocket");
      if (/\btokio\s*=/.test(c))      found.add("tokio");
      if (/\baxum\s*=/.test(c))       found.add("axum");
    }
  }
  const py = files.find((f) => f.rel_path === "pyproject.toml") ?? files.find((f) => f.rel_path === "requirements.txt");
  if (py) {
    const c = safeReadFile(py.abs_path);
    if (c) {
      evidence.push(py.rel_path);
      hashes.push({ path: py.rel_path, sha256_prefix: sha256Prefix(c) });
      if (/\bdjango\b/i.test(c))  found.add("django");
      if (/\bflask\b/i.test(c))   found.add("flask");
      if (/\bfastapi\b/i.test(c)) found.add("fastapi");
    }
  }
  const value = Array.from(found).sort();
  return signal(value, value.length > 0 ? "OBSERVED" : "UNKNOWN", evidence, hashes, evidence.length, value.length, 0, "package-manifest-dep-scan");
}

export function detectPackageManagers(files: readonly WalkedFile[], root: string): ProfileSignal<readonly string[]> {
  const has = (rel: string) => files.some((f) => f.rel_path === rel);
  const found = new Set<string>();
  const evidence: string[] = [];
  const hashes: EvidenceHash[] = [];
  const push = (p: string) => { evidence.push(p); const c = safeReadFile(resolve(root, p), 4096); if (c) hashes.push({ path: p, sha256_prefix: sha256Prefix(c) }); };
  if (has("package-lock.json")) { found.add("npm"); push("package-lock.json"); }
  if (has("yarn.lock"))          { found.add("yarn"); push("yarn.lock"); }
  if (has("pnpm-lock.yaml"))     { found.add("pnpm"); push("pnpm-lock.yaml"); }
  if (has("bun.lockb"))           { found.add("bun"); push("bun.lockb"); }
  if (has("Pipfile"))              { found.add("pipenv"); push("Pipfile"); }
  if (has("poetry.lock"))          { found.add("poetry"); push("poetry.lock"); }
  if (has("Cargo.lock"))           { found.add("cargo"); push("Cargo.lock"); }
  if (has("go.sum"))               { found.add("go modules"); push("go.sum"); }
  if (has("composer.lock"))        { found.add("composer"); push("composer.lock"); }
  const value = Array.from(found).sort();
  return signal(value, value.length > 0 ? "OBSERVED" : "UNKNOWN", evidence, hashes, evidence.length, value.length, 0, "lockfile-detection");
}

export function detectBuildSystems(files: readonly WalkedFile[], root: string): ProfileSignal<readonly string[]> {
  const has = (rel: string) => files.some((f) => f.rel_path === rel);
  const found = new Set<string>();
  const evidence: string[] = [];
  const hashes: EvidenceHash[] = [];
  const push = (p: string) => { evidence.push(p); const c = safeReadFile(resolve(root, p), 8192); if (c) hashes.push({ path: p, sha256_prefix: sha256Prefix(c) }); };
  if (has("Makefile"))                    { found.add("make"); push("Makefile"); }
  if (has("CMakeLists.txt"))               { found.add("cmake"); push("CMakeLists.txt"); }
  if (has("build.gradle") || has("build.gradle.kts")) { found.add("gradle"); push(has("build.gradle") ? "build.gradle" : "build.gradle.kts"); }
  if (has("pom.xml"))                       { found.add("maven"); push("pom.xml"); }
  if (has("Dockerfile") || has("Containerfile")) { found.add("docker"); }
  if (has("turbo.json"))                     { found.add("turbo"); push("turbo.json"); }
  if (has("nx.json"))                        { found.add("nx"); push("nx.json"); }
  if (has("bazel") || has("BUILD.bazel"))    { found.add("bazel"); }
  const value = Array.from(found).sort();
  return signal(value, value.length > 0 ? "OBSERVED" : "UNKNOWN", evidence, hashes, evidence.length, value.length, 0, "build-manifest-detection");
}

// ─── Organisation ────────────────────────────────────────────────

export function detectOrganisation(files: readonly WalkedFile[], excludedPaths: readonly string[] = []): {
  source: ProfileSignal<readonly string[]>;
  tests: ProfileSignal<readonly string[]>;
  config: ProfileSignal<readonly string[]>;
  generated: ProfileSignal<readonly string[]>;
  vendor: ProfileSignal<readonly string[]>;
  assets: ProfileSignal<readonly string[]>;
} {
  const topDirs = new Map<string, number>();
  for (const f of files) {
    const idx = f.rel_path.indexOf("/");
    const top = idx > 0 ? f.rel_path.slice(0, idx) : "";
    if (top) topDirs.set(top, (topDirs.get(top) ?? 0) + 1);
  }
  // Excluded top-level directory names (vendor/generated skipped by scanner)
  const excludedTops = new Set<string>();
  for (const p of excludedPaths) {
    const idx = p.indexOf("/");
    const top = idx > 0 ? p.slice(0, idx) : p;
    if (top) excludedTops.add(top);
  }
  const known: Record<string, string[]> = {
    source:     ["src", "lib", "app", "packages"],
    tests:      ["test", "tests", "__tests__", "spec", "specs", "e2e"],
    config:     [".vscode", ".github", ".config", "config", ".husky"],
    generated:  ["dist", "build", "out", ".next", ".nuxt", "target", ".turbo"],
    vendor:     ["node_modules", "vendor", ".venv", "venv", "__pycache__", ".cargo"],
    assets:     ["public", "static", "assets", "docs"],
  };
  const pick = (family: keyof typeof known, useExcluded: boolean): { paths: string[]; support: number } => {
    const paths: string[] = [];
    let support = 0;
    for (const name of known[family]) {
      if (topDirs.has(name)) { paths.push(name); support += topDirs.get(name)!; }
      else if (useExcluded && excludedTops.has(name)) { paths.push(name); support += 1; }
    }
    return { paths, support };
  };
  const total = files.length;
  const mk = (fam: keyof typeof known, useExcluded: boolean): ProfileSignal<readonly string[]> => {
    const r = pick(fam, useExcluded);
    if (r.paths.length === 0) return signal([], "UNKNOWN", [], [], total, 0, 0, "top-level-directory-name-match");
    return signal(r.paths, "OBSERVED", r.paths, [], total, r.support, 0, "top-level-directory-name-match");
  };
  return {
    source:     mk("source", false),
    tests:      mk("tests", false),
    config:     mk("config", false),
    generated:  mk("generated", true),   // scanner may have excluded these · check excluded list too
    vendor:     mk("vendor", true),      // vendor dirs are always excluded · check excluded list
    assets:     mk("assets", false),
  };
}

// ─── Tooling ─────────────────────────────────────────────────────

export function detectTooling(files: readonly WalkedFile[], root: string): {
  package_manager: ProfileSignal<string>;
  build_command: ProfileSignal<string>;
  test_command: ProfileSignal<string>;
  lint_config: ProfileSignal<string>;
  formatter_config: ProfileSignal<string>;
  type_checker_config: ProfileSignal<string>;
  framework_config: ProfileSignal<readonly string[]>;
} {
  const has = (rel: string) => files.some((f) => f.rel_path === rel);
  const findPkg = files.find((f) => f.rel_path === "package.json");
  let scripts: Record<string, string> = {};
  const evidence: string[] = [];
  const hashes: EvidenceHash[] = [];
  if (findPkg) {
    const c = safeReadFile(findPkg.abs_path);
    if (c) {
      evidence.push("package.json");
      hashes.push({ path: "package.json", sha256_prefix: sha256Prefix(c) });
      try { scripts = (JSON.parse(c).scripts ?? {}) as Record<string, string>; } catch { /* skip */ }
    }
  }
  const pkgManager: string =
    has("bun.lockb") ? "bun" :
    has("pnpm-lock.yaml") ? "pnpm" :
    has("yarn.lock") ? "yarn" :
    has("package-lock.json") ? "npm" :
    has("Cargo.lock") ? "cargo" :
    has("poetry.lock") ? "poetry" :
    has("Pipfile") ? "pipenv" :
    has("go.sum") ? "go modules" :
    has("composer.lock") ? "composer" : "";
  const build = scripts.build ?? "";
  const test = scripts.test ?? scripts["test:unit"] ?? "";
  const lintConfig =
    has(".eslintrc.js") ? ".eslintrc.js" :
    has(".eslintrc.json") ? ".eslintrc.json" :
    has(".eslintrc.cjs") ? ".eslintrc.cjs" :
    has(".eslintrc.yaml") ? ".eslintrc.yaml" :
    has("eslint.config.js") ? "eslint.config.js" :
    has("ruff.toml") ? "ruff.toml" : "";
  const formatterConfig =
    has(".prettierrc") ? ".prettierrc" :
    has(".prettierrc.json") ? ".prettierrc.json" :
    has(".prettierrc.js") ? ".prettierrc.js" :
    has("prettier.config.js") ? "prettier.config.js" :
    has("pyproject.toml") ? "pyproject.toml (may include black/ruff format)" :
    "";
  const typeCheckerConfig = has("tsconfig.json") ? "tsconfig.json" : has("jsconfig.json") ? "jsconfig.json" : "";
  const frameworkConfig: string[] = [];
  if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) frameworkConfig.push("next.config");
  if (has("vite.config.js") || has("vite.config.ts")) frameworkConfig.push("vite.config");
  if (has("svelte.config.js")) frameworkConfig.push("svelte.config");
  if (has("astro.config.mjs") || has("astro.config.js")) frameworkConfig.push("astro.config");
  if (has("tailwind.config.js") || has("tailwind.config.ts")) frameworkConfig.push("tailwind.config");

  const emit = (val: string, method: string): ProfileSignal<string> =>
    val ? signal(val, "OBSERVED", evidence, hashes, evidence.length, 1, 0, method) : signal(null, "UNKNOWN", [], [], 0, 0, 0, method);
  return {
    package_manager:      pkgManager ? signal(pkgManager, "OBSERVED", evidence, hashes, evidence.length, 1, 0, "lockfile-detection") : signal(null, "UNKNOWN", [], [], 0, 0, 0, "lockfile-detection"),
    build_command:        emit(build, "package.json scripts.build"),
    test_command:         emit(test, "package.json scripts.test"),
    lint_config:          emit(lintConfig, "config-file-existence"),
    formatter_config:     emit(formatterConfig, "config-file-existence"),
    type_checker_config:  emit(typeCheckerConfig, "tsconfig/jsconfig existence"),
    framework_config:     signal(frameworkConfig, frameworkConfig.length > 0 ? "OBSERVED" : "UNKNOWN", frameworkConfig, [], frameworkConfig.length, frameworkConfig.length, 0, "framework-config-file-existence"),
  };
}

// ─── Style signals ───────────────────────────────────────────────

export function detectStyleSignals(files: readonly WalkedFile[], maxSample: number): {
  indentation: ProfileSignal<"tabs" | "2_spaces" | "4_spaces" | "other">;
  quote_convention: ProfileSignal<"single" | "double" | "backtick" | "mixed">;
  semicolon_convention: ProfileSignal<"always" | "never" | "mixed">;
  file_naming_pattern: ProfileSignal<"kebab-case" | "camelCase" | "PascalCase" | "snake_case" | "mixed">;
  test_naming_pattern: ProfileSignal<".test.ts" | ".spec.ts" | "__tests__" | "test_" | "mixed" | "none_detected">;
} {
  const codeFiles = files.filter((f) =>
    /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(f.extension) && !f.is_vendor && !f.is_generated
  ).slice(0, maxSample);
  const sampleSize = codeFiles.length;

  // Indentation: for each file, look at first 200 lines · classify as tab / 2-space / 4-space
  let indentTab = 0, indent2 = 0, indent4 = 0, indentOther = 0;
  const indentEv: string[] = [];
  const indentHashes: EvidenceHash[] = [];
  for (const f of codeFiles.slice(0, Math.min(sampleSize, 100))) {
    const c = safeReadFile(f.abs_path, 128 * 1024);
    if (!c) continue;
    const lines = c.split("\n").slice(0, 200).filter((l) => /^\s/.test(l));
    let tab = 0, sp2 = 0, sp4 = 0, other = 0;
    for (const l of lines) {
      if (l.startsWith("\t")) tab++;
      else if (/^ {4,}\S/.test(l) && !/^ {6}\S/.test(l)) sp4++;
      else if (/^ {2}\S/.test(l)) sp2++;
      else if (/^ +\S/.test(l)) other++;
    }
    const max = Math.max(tab, sp2, sp4, other);
    if (max === 0) continue;
    if (max === tab) indentTab++;
    else if (max === sp2) indent2++;
    else if (max === sp4) indent4++;
    else indentOther++;
    if (indentEv.length < 6) { indentEv.push(f.rel_path); indentHashes.push({ path: f.rel_path, sha256_prefix: sha256Prefix(c) }); }
  }
  const indentTotal = indentTab + indent2 + indent4 + indentOther;
  const indentValue: "tabs" | "2_spaces" | "4_spaces" | "other" | null = indentTotal === 0 ? null
    : indentTab === Math.max(indentTab, indent2, indent4, indentOther) ? "tabs"
    : indent2 === Math.max(indentTab, indent2, indent4, indentOther) ? "2_spaces"
    : indent4 === Math.max(indentTab, indent2, indent4, indentOther) ? "4_spaces"
    : "other";
  const indentSupport = indentValue === "tabs" ? indentTab : indentValue === "2_spaces" ? indent2 : indentValue === "4_spaces" ? indent4 : indentOther;
  const indentState: ProfileConfidence =
    indentTotal === 0 ? "UNKNOWN"
    : indentSupport / indentTotal >= 0.8 ? "STRONGLY_INFERRED"
    : indentSupport / indentTotal >= 0.55 ? "WEAKLY_INFERRED"
    : "CONFLICTING";

  // Quote convention (JS/TS · sample first 4000 chars per file)
  let single = 0, double = 0, backtick = 0;
  const quoteEv: string[] = [];
  for (const f of codeFiles.slice(0, Math.min(sampleSize, 100))) {
    const c = safeReadFile(f.abs_path, 64 * 1024);
    if (!c) continue;
    const head = c.slice(0, 8000);
    single += (head.match(/'[^'\n]{0,60}'/g) ?? []).length;
    double += (head.match(/"[^"\n]{0,60}"/g) ?? []).length;
    backtick += (head.match(/`[^`\n]{0,60}`/g) ?? []).length;
    if (quoteEv.length < 6) quoteEv.push(f.rel_path);
  }
  const quoteTotal = single + double + backtick;
  const quoteValue: "single" | "double" | "backtick" | "mixed" | null = quoteTotal === 0 ? null
    : single > double && single > backtick ? "single"
    : double > single && double > backtick ? "double"
    : backtick > single && backtick > double ? "backtick"
    : "mixed";
  const quoteSupport = quoteValue === "single" ? single : quoteValue === "double" ? double : quoteValue === "backtick" ? backtick : Math.max(single, double, backtick);
  const quoteState: ProfileConfidence =
    quoteTotal === 0 ? "UNKNOWN"
    : quoteValue === "mixed" ? "CONFLICTING"
    : quoteSupport / quoteTotal >= 0.7 ? "STRONGLY_INFERRED"
    : "WEAKLY_INFERRED";

  // Semicolon convention (JS/TS · sample line endings)
  let withSemi = 0, withoutSemi = 0;
  const semiEv: string[] = [];
  for (const f of codeFiles.slice(0, Math.min(sampleSize, 100))) {
    const c = safeReadFile(f.abs_path, 64 * 1024);
    if (!c) continue;
    const lines = c.split("\n").slice(0, 200);
    for (const l of lines) {
      const t = l.trimEnd();
      // Only count "statement-like" lines · rough heuristic
      if (!/[a-zA-Z0-9_\])"'`]\s*$/.test(t) && !/;$/.test(t)) continue;
      if (t.endsWith(";")) withSemi++;
      else if (/[a-zA-Z0-9_\])"'`]$/.test(t)) withoutSemi++;
    }
    if (semiEv.length < 6) semiEv.push(f.rel_path);
  }
  const semiTotal = withSemi + withoutSemi;
  const semiValue: "always" | "never" | "mixed" | null = semiTotal === 0 ? null
    : withSemi / semiTotal >= 0.85 ? "always"
    : withoutSemi / semiTotal >= 0.85 ? "never"
    : "mixed";
  const semiState: ProfileConfidence =
    semiTotal === 0 ? "UNKNOWN"
    : semiValue === "mixed" ? "CONFLICTING" : "STRONGLY_INFERRED";

  // File naming pattern (sample basenames · exclude special ones)
  let kebab = 0, camel = 0, pascal = 0, snake = 0, other = 0;
  const namingEv: string[] = [];
  for (const f of codeFiles.slice(0, Math.min(sampleSize, 200))) {
    const name = basename(f.rel_path).replace(f.extension, "");
    if (!name || /^\./.test(name)) continue;
    if (/^[a-z]+(-[a-z0-9]+)+$/.test(name)) kebab++;
    else if (/^[a-z][a-zA-Z0-9]*$/.test(name)) camel++;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascal++;
    else if (/^[a-z]+(_[a-z0-9]+)+$/.test(name)) snake++;
    else other++;
    if (namingEv.length < 6) namingEv.push(f.rel_path);
  }
  const namingTotal = kebab + camel + pascal + snake + other;
  const namingValue: "kebab-case" | "camelCase" | "PascalCase" | "snake_case" | "mixed" | null = namingTotal === 0 ? null
    : kebab === Math.max(kebab, camel, pascal, snake) && kebab / namingTotal >= 0.55 ? "kebab-case"
    : camel === Math.max(kebab, camel, pascal, snake) && camel / namingTotal >= 0.55 ? "camelCase"
    : pascal === Math.max(kebab, camel, pascal, snake) && pascal / namingTotal >= 0.55 ? "PascalCase"
    : snake === Math.max(kebab, camel, pascal, snake) && snake / namingTotal >= 0.55 ? "snake_case"
    : "mixed";
  const namingSupport = namingValue === "kebab-case" ? kebab
    : namingValue === "camelCase" ? camel
    : namingValue === "PascalCase" ? pascal
    : namingValue === "snake_case" ? snake
    : Math.max(kebab, camel, pascal, snake);
  const namingState: ProfileConfidence =
    namingTotal === 0 ? "UNKNOWN"
    : namingValue === "mixed" ? "CONFLICTING"
    : namingSupport / namingTotal >= 0.8 ? "STRONGLY_INFERRED"
    : "WEAKLY_INFERRED";

  // Test naming pattern
  let dotTest = 0, dotSpec = 0, dirTests = 0, prefixTest = 0;
  for (const f of files) {
    const bn = basename(f.rel_path);
    if (/\.test\.(ts|tsx|js|mjs|jsx|mts|cts)$/.test(bn)) dotTest++;
    else if (/\.spec\.(ts|tsx|js|mjs|jsx|mts|cts)$/.test(bn)) dotSpec++;
    if (f.rel_path.includes("/__tests__/")) dirTests++;
    if (/^test_[a-zA-Z0-9_]+\.py$/.test(bn)) prefixTest++;
  }
  const testMax = Math.max(dotTest, dotSpec, dirTests, prefixTest);
  const testValue: ".test.ts" | ".spec.ts" | "__tests__" | "test_" | "mixed" | "none_detected" =
    testMax === 0 ? "none_detected"
    : testMax === dotTest ? ".test.ts"
    : testMax === dotSpec ? ".spec.ts"
    : testMax === dirTests ? "__tests__"
    : "test_";
  const testTotal = dotTest + dotSpec + dirTests + prefixTest;
  const testState: ProfileConfidence = testTotal === 0 ? "UNKNOWN" : testMax / testTotal >= 0.7 ? "STRONGLY_INFERRED" : "CONFLICTING";

  return {
    indentation: signal(indentValue, indentState, indentEv, indentHashes, indentTotal, indentSupport, indentTotal - indentSupport, "line-leading-whitespace-sampling"),
    quote_convention: signal(quoteValue, quoteState, quoteEv, [], quoteTotal, quoteSupport, quoteTotal - quoteSupport, "quote-character-counting"),
    semicolon_convention: signal(semiValue, semiState, semiEv, [], semiTotal, semiValue === "always" ? withSemi : semiValue === "never" ? withoutSemi : Math.max(withSemi, withoutSemi), semiValue === "always" ? withoutSemi : withSemi, "line-ending-semicolon-sampling"),
    file_naming_pattern: signal(namingValue, namingState, namingEv, [], namingTotal, namingSupport, namingTotal - namingSupport, "basename-pattern-classification"),
    test_naming_pattern: signal(testValue, testState, [], [], testTotal, testMax, testTotal - testMax, "test-basename-pattern-count"),
  };
}

// ─── Structure signals ───────────────────────────────────────────

export function detectStructureSignals(files: readonly WalkedFile[]): {
  top_level_dirs: ProfileSignal<Readonly<Record<string, number>>>;
  typical_source_location: ProfileSignal<string>;
  typical_test_location: ProfileSignal<string>;
  index_files: ProfileSignal<number>;
  barrel_files: ProfileSignal<number>;
} {
  const topDirs: Record<string, number> = {};
  for (const f of files) {
    const idx = f.rel_path.indexOf("/");
    const top = idx > 0 ? f.rel_path.slice(0, idx) : "";
    if (top) topDirs[top] = (topDirs[top] ?? 0) + 1;
  }
  const indexFiles = files.filter((f) => /(^|\/)index\.(ts|tsx|js|mjs|cjs|jsx)$/.test(f.rel_path)).length;
  const barrelFiles = files.filter((f) => /(^|\/)index\.(ts|js)$/.test(f.rel_path)).length;
  const sourceLoc = files.some((f) => f.rel_path.startsWith("src/")) ? "src/" : files.some((f) => f.rel_path.startsWith("lib/")) ? "lib/" : files.some((f) => f.rel_path.startsWith("app/")) ? "app/" : "";
  const testLoc = files.some((f) => f.rel_path.startsWith("test/")) ? "test/" : files.some((f) => f.rel_path.startsWith("tests/")) ? "tests/" : files.some((f) => f.rel_path.includes("__tests__")) ? "**/__tests__/" : "";
  return {
    top_level_dirs: signal(topDirs, Object.keys(topDirs).length > 0 ? "OBSERVED" : "UNKNOWN", [], [], files.length, Object.values(topDirs).reduce((a, n) => a + n, 0), 0, "top-level-file-count-by-dir"),
    typical_source_location: sourceLoc ? signal(sourceLoc, "OBSERVED", [], [], files.length, files.filter((f) => f.rel_path.startsWith(sourceLoc)).length, 0, "prefix-detection") : signal(null, "UNKNOWN", [], [], files.length, 0, 0, "prefix-detection"),
    typical_test_location: testLoc ? signal(testLoc, "OBSERVED", [], [], files.length, files.filter((f) => f.rel_path.startsWith(testLoc)).length, 0, "prefix-detection") : signal(null, "UNKNOWN", [], [], files.length, 0, 0, "prefix-detection"),
    index_files: signal(indexFiles, indexFiles > 0 ? "OBSERVED" : "UNKNOWN", [], [], files.length, indexFiles, 0, "index-basename-count"),
    barrel_files: signal(barrelFiles, barrelFiles > 0 ? "OBSERVED" : "UNKNOWN", [], [], files.length, barrelFiles, 0, "index-basename-count"),
  };
}
