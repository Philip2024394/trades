// NEX Security · Signature-based content scanner + file-integrity manifest
// Narrow · high-precision rules · zero false-positives on legitimate NEX code.
//
// Design principles:
//   · Only flag patterns that are unambiguously suspicious (not "any child_process
//     import" — legitimate code uses those).
//   · Exempt paths that legitimately match a pattern (test files may call eval).
//   · Never mutate scanned files.
//   · Every hit carries file + line + reason so remediation is unambiguous.
//   · Integrity manifest is append-only per-run · never overwrites prior baselines.

import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";

const REPO_ROOT = process.cwd();

export type SecuritySeverity = "critical" | "warning" | "info";

export interface SecurityHit {
  readonly pattern_id: string;
  readonly severity: SecuritySeverity;
  readonly reason: string;
  readonly line_number: number;
  readonly line_preview: string;
}

export interface ScanResult {
  readonly path: string; // repo-relative
  readonly sha256: string;
  readonly size: number;
  readonly hits: readonly SecurityHit[];
  readonly ok: boolean; // no critical hits
  readonly scanned_at: string;
}

export interface DirectoryScanResult {
  readonly root: string;
  readonly files_scanned: number;
  readonly results: readonly ScanResult[];
  readonly critical_count: number;
  readonly warning_count: number;
  readonly info_count: number;
  readonly ok: boolean;
  readonly scanned_at: string;
  readonly duration_ms: number;
}

interface Signature {
  readonly id: string;
  readonly severity: SecuritySeverity;
  readonly pattern: RegExp;
  readonly reason: string;
  readonly allowlist_paths?: RegExp; // paths where this pattern is legitimate
}

// Paths where our OWN scanner code, docs, or trusted mirrors legitimately mention
// the same substrings we scan for. Kept centralised so every signature reuses it.
// (Regex quoted with double-escaped backslashes because it's a JS string literal
// only when written raw — here it's a literal RegExp.)
const SELF_MIRROR_PATHS =
  /nex-security[\\/]scanner\.ts$|nex-coding-team[\\/]queue-executor\.mjs$|nex-coding-team[\\/]git-integration\.ts$|nex-coding-team[\\/]agents[\\/][0-9]+-[a-z\-]+\.md$/;

const TEST_PATHS = /__tests__|\.test\.|\.spec\./;

// Narrow, high-precision signatures. Each MUST be genuinely suspicious in application code.
const SIGNATURES: readonly Signature[] = [
  {
    id: "eval-call",
    severity: "critical",
    pattern: /\beval\s*\(/,
    reason: "eval() enables arbitrary code execution",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "function-constructor",
    severity: "critical",
    pattern: /\bnew\s+Function\s*\(/,
    reason: "Function constructor enables dynamic code eval",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "shell-template-interpolation",
    severity: "warning",
    pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/,
    reason: "shell command uses template-literal interpolation · injection risk if input is user-controlled",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "hook-bypass-flag",
    severity: "warning",
    pattern: /--no-verify\b|--no-gpg-sign\b/,
    reason: "flag bypasses pre-commit hooks or commit signing",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "known-exfil-host",
    severity: "warning",
    pattern: /\b(?:pastebin\.com|transfer\.sh|termbin\.com|hastebin\.com|0x0\.st|file\.io|anonfiles)\b/i,
    reason: "string references an anonymous file-drop host · exfiltration adjacent",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "crypto-miner-signature",
    severity: "critical",
    pattern: /\b(?:coinhive|cryptonight|xmr-stak|xmrig|monero-miner|coinimp|jsecoin)\b/i,
    reason: "known crypto-miner substring",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "tracker-analytics",
    severity: "info",
    pattern: /\b(?:google-analytics\.com|mixpanel|fullstory|hotjar|segment\.io)\b/i,
    reason: "third-party analytics tracker · verify explicit consent per NEX privacy posture",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "innerHTML-with-input-sink",
    severity: "warning",
    pattern: /\.innerHTML\s*=\s*(?:[a-zA-Z_$][a-zA-Z0-9_$]*\.(?:value|input|userInput)|req\.body|req\.query|params\.)/,
    reason: "innerHTML assignment sinks user input · XSS risk",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "large-base64-blob",
    severity: "warning",
    pattern: /["'`][A-Za-z0-9+/=]{500,}["'`]/,
    reason: "large base64-encoded string literal · may hide embedded payload",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
  {
    id: "keylogger-signature",
    severity: "critical",
    // Uses non-greedy `.*?` (not `[^)]*`) so arrow-function params like (e)=>...
    // don't break the match. Scans line-by-line so `.` is fine (no /s flag).
    pattern: /addEventListener\s*\(\s*['"](?:keydown|keypress|keyup)['"]\s*,.*?(?:fetch|xhr|XMLHttpRequest|navigator\.sendBeacon)/,
    reason: "keyboard event listener with network exfiltration · keylogger pattern",
    allowlist_paths: combine(TEST_PATHS, SELF_MIRROR_PATHS),
  },
];

function combine(a: RegExp, b: RegExp): RegExp {
  return new RegExp(`${a.source}|${b.source}`);
}

/** Scan a single file's content. Non-existent paths return null. */
export function scanFile(rel_or_abs: string): ScanResult | null {
  const abs = path.isAbsolute(rel_or_abs) ? rel_or_abs : path.resolve(REPO_ROOT, rel_or_abs);
  if (!existsSync(abs)) return null;
  const st = statSync(abs);
  if (!st.isFile()) return null;
  if (st.size > 5_000_000) {
    // Too large — return metadata only, don't scan.
    return {
      path: path.relative(REPO_ROOT, abs).replace(/\\/g, "/"),
      sha256: "",
      size: st.size,
      hits: [
        {
          pattern_id: "file-too-large",
          severity: "info",
          reason: `file size ${st.size} > 5MB · scan skipped`,
          line_number: 0,
          line_preview: "",
        },
      ],
      ok: true,
      scanned_at: new Date().toISOString(),
    };
  }
  const buf = readFileSync(abs);
  const content = buf.toString("utf8");
  return scanContent(path.relative(REPO_ROOT, abs).replace(/\\/g, "/"), content, buf);
}

/** Scan raw content · used by tests. */
export function scanContent(rel_path: string, content: string, buf?: Buffer): ScanResult {
  const hits: SecurityHit[] = [];
  const lines = content.split(/\r?\n/);
  for (const sig of SIGNATURES) {
    if (sig.allowlist_paths && sig.allowlist_paths.test(rel_path)) continue;
    for (let i = 0; i < lines.length; i++) {
      if (sig.pattern.test(lines[i] ?? "")) {
        hits.push({
          pattern_id: sig.id,
          severity: sig.severity,
          reason: sig.reason,
          line_number: i + 1,
          line_preview: (lines[i] ?? "").slice(0, 200),
        });
      }
    }
  }
  const sha256 = createHash("sha256").update(buf ?? Buffer.from(content, "utf8")).digest("hex");
  return {
    path: rel_path,
    sha256,
    size: (buf ?? Buffer.from(content, "utf8")).length,
    hits,
    ok: hits.filter((h) => h.severity === "critical").length === 0,
    scanned_at: new Date().toISOString(),
  };
}

/** Scan every text file in a directory (recursive). */
export function scanDirectory(rel_dir: string, opts: { include?: RegExp; exclude?: RegExp } = {}): DirectoryScanResult {
  const t0 = Date.now();
  const abs_root = path.isAbsolute(rel_dir) ? rel_dir : path.resolve(REPO_ROOT, rel_dir);
  const results: ScanResult[] = [];
  const include = opts.include ?? /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|sh|ps1|py)$/i;
  const exclude = opts.exclude ?? /(?:^|[\\/])(?:node_modules|\.next|\.git|dist|build|coverage)(?:[\\/]|$)/;

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(REPO_ROOT, full).replace(/\\/g, "/");
      if (exclude.test(rel)) continue;
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && include.test(entry.name)) {
        const r = scanFile(full);
        if (r) results.push(r);
      }
    }
  }
  walk(abs_root);

  const critical = results.reduce((n, r) => n + r.hits.filter((h) => h.severity === "critical").length, 0);
  const warning = results.reduce((n, r) => n + r.hits.filter((h) => h.severity === "warning").length, 0);
  const info = results.reduce((n, r) => n + r.hits.filter((h) => h.severity === "info").length, 0);

  return {
    root: path.relative(REPO_ROOT, abs_root).replace(/\\/g, "/"),
    files_scanned: results.length,
    results,
    critical_count: critical,
    warning_count: warning,
    info_count: info,
    ok: critical === 0,
    scanned_at: new Date().toISOString(),
    duration_ms: Date.now() - t0,
  };
}

// ── File-integrity manifest ─────────────────────────────────────────────

export interface IntegrityBaselineEntry {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly mtime_iso: string;
}

export interface IntegrityBaseline {
  readonly version: 1;
  readonly created_at: string;
  readonly files: readonly IntegrityBaselineEntry[];
}

export interface IntegrityDrift {
  readonly path: string;
  readonly kind: "modified" | "deleted" | "added";
  readonly expected_sha256?: string;
  readonly actual_sha256?: string;
  readonly noticed_at: string;
}

/** Build a baseline from a list of repo-relative paths. */
export function createBaseline(rel_paths: readonly string[]): IntegrityBaseline {
  const files: IntegrityBaselineEntry[] = [];
  for (const rel of rel_paths) {
    const abs = path.resolve(REPO_ROOT, rel);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (!st.isFile()) continue;
    const buf = readFileSync(abs);
    files.push({
      path: rel.replace(/\\/g, "/"),
      sha256: createHash("sha256").update(buf).digest("hex"),
      size: st.size,
      mtime_iso: new Date(st.mtimeMs).toISOString(),
    });
  }
  return { version: 1, created_at: new Date().toISOString(), files };
}

/** Compare on-disk state to a baseline · returns any drift. */
export function compareToBaseline(baseline: IntegrityBaseline): readonly IntegrityDrift[] {
  const drifts: IntegrityDrift[] = [];
  const now = new Date().toISOString();
  for (const entry of baseline.files) {
    const abs = path.resolve(REPO_ROOT, entry.path);
    if (!existsSync(abs)) {
      drifts.push({ path: entry.path, kind: "deleted", expected_sha256: entry.sha256, noticed_at: now });
      continue;
    }
    const buf = readFileSync(abs);
    const actual = createHash("sha256").update(buf).digest("hex");
    if (actual !== entry.sha256) {
      drifts.push({
        path: entry.path,
        kind: "modified",
        expected_sha256: entry.sha256,
        actual_sha256: actual,
        noticed_at: now,
      });
    }
  }
  return drifts;
}

const BASELINE_DIR = path.join(REPO_ROOT, "data", "nex-security", "baselines");

/** Persist a baseline · append-only · timestamped filename. */
export function saveBaseline(baseline: IntegrityBaseline): string {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  const fname = `baseline-${baseline.created_at.replace(/[:.]/g, "-")}.json`;
  const abs = path.join(BASELINE_DIR, fname);
  writeFileSync(abs, JSON.stringify(baseline, null, 2), "utf8");
  return path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
}

/** Load the most recent baseline · null if none exist. */
export function loadLatestBaseline(): IntegrityBaseline | null {
  if (!existsSync(BASELINE_DIR)) return null;
  const files = readdirSync(BASELINE_DIR).filter((f) => f.startsWith("baseline-") && f.endsWith(".json")).sort();
  if (files.length === 0) return null;
  const last = files[files.length - 1];
  if (last === undefined) return null;
  return JSON.parse(readFileSync(path.join(BASELINE_DIR, last), "utf8")) as IntegrityBaseline;
}

/** Default set of files to keep integrity baselines for. */
export const DEFAULT_INTEGRITY_TARGETS: readonly string[] = [
  "CLAUDE.md",
  "src/lib/nex-v3/v3-engine-registry.ts",
  "supabase/migrations/20260915180000_nex_visual_structural_lock_architecture.sql",
  "src/lib/nex-coding-team/permissions.ts",
  "src/lib/nex-coding-team/safe-write.ts",
  "src/lib/nex-coding-team/runtime.ts",
  "src/lib/nex-coding-team/orchestrator.ts",
];
