// src/lib/nex/ecosystem/supply-chain-audit.ts
//
// UWI · Wave 8.A · Supply-chain security audit
// Founder-authorised programme (Rule 5o.F).
//
// Deterministic risk assessment for an ecosystem candidate:
//   - postinstall / preinstall / prepare script presence
//   - binary-download instructions
//   - dynamic-code-execution (eval · Function ctor · vm module)
//   - telemetry / phone-home endpoints
//   - typosquat similarity to well-known package names (via Wave 4 SimHash)
//   - unexpected transitive dep count
//   - maintainer count sanity
//
// No external service · no LLM · no network.

import type {
  SupplyChainReport,
  SupplyChainSignals,
} from "./types";
import { simhashText, hammingDistance64 } from "../research-signals/simhash";

// Well-known package names to detect typosquats against (bounded set).
// Full production version would be a much larger allowlist.
const CANONICAL_PACKAGE_NAMES: ReadonlyArray<string> = [
  "react", "next", "typescript", "eslint", "vitest", "jest",
  "express", "fastify", "koa", "axios", "undici",
  "cheerio", "jsdom", "playwright", "puppeteer",
  "pg", "mysql2", "sqlite3", "redis", "ioredis",
  "openai", "anthropic", "langchain", "crewai",
  "lodash", "underscore", "ramda",
  "moment", "date-fns", "dayjs",
];

export interface AuditInput {
  /** Parsed package.json contents (or null if not applicable). */
  readonly package_json: Readonly<Record<string, unknown>> | null;
  /** Names of transitive deps if resolvable · empty if unknown. */
  readonly transitive_deps: ReadonlyArray<string>;
  /** Source-code text sample for eval/dynamic-code scanning (bounded). */
  readonly code_sample: string | null;
  /** Maintainer names if resolvable · empty if unknown. */
  readonly maintainers: ReadonlyArray<string>;
  /** Package name being audited (for typosquat comparison). */
  readonly package_name: string | null;
}

function extractScripts(pkg_json: Readonly<Record<string, unknown>> | null): Record<string, string> {
  if (!pkg_json) return {};
  const s = pkg_json["scripts"];
  if (!s || typeof s !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function hasPostinstall(scripts: Record<string, string>): boolean {
  return Boolean(scripts["postinstall"] || scripts["preinstall"] || scripts["prepare"] || scripts["install"]);
}

function hasBinaryDownloadInScripts(scripts: Record<string, string>): boolean {
  const dangerous_patterns = [
    /curl.*(-o|--output|>)/i,
    /wget/i,
    /node-gyp rebuild/i,      // native builds · not strictly binary download but flag for review
    /prebuild-install/i,      // downloads prebuilt binaries
    /https:\/\/[^"'\s]+\.(?:sh|py|exe|dll|so|dylib|bin|tar\.gz|zip)/i,
  ];
  for (const s of Object.values(scripts)) {
    if (dangerous_patterns.some(p => p.test(s))) return true;
  }
  return false;
}

function hasDynamicCodeExecution(code: string | null): boolean {
  if (!code) return false;
  const patterns = [
    /\beval\s*\(/,
    /new\s+Function\s*\(/,
    /\bvm\.runIn/,
    /\brequire\s*\(\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\)/,   // dynamic-string require
  ];
  return patterns.some(p => p.test(code));
}

function hasTelemetryOrPhoneHome(code: string | null, pkg_json: Readonly<Record<string, unknown>> | null): { telemetry: boolean; phone_home: boolean } {
  const telemetry_endpoints = [
    /segment\.io/i, /amplitude\.com/i, /mixpanel\.com/i,
    /posthog\.com/i, /telemetry\./i, /"analytics":/i,
  ];
  const phone_home_patterns = [
    /https?:\/\/(api|telemetry|track|stats|metrics|log)\.[a-z0-9-]+\.(com|io|dev|ai)/i,
  ];
  const text = (code ?? "") + JSON.stringify(pkg_json ?? {});
  return {
    telemetry: telemetry_endpoints.some(p => p.test(text)),
    phone_home: phone_home_patterns.some(p => p.test(text)),
  };
}

function typosquatSimilarity(candidate: string | null): number {
  if (!candidate) return 0;
  const cand_fp = simhashText(candidate);
  let best = 0;
  for (const canonical of CANONICAL_PACKAGE_NAMES) {
    if (canonical === candidate) continue; // exact match is not a typosquat
    const canon_fp = simhashText(canonical);
    const dist = hammingDistance64(cand_fp, canon_fp);
    const sim = 1 - dist / 64;
    // Only interesting for names that are close in edit distance too
    const name_close = Math.abs(canonical.length - candidate.length) <= 2
      && (canonical.startsWith(candidate.slice(0, Math.min(3, candidate.length)))
          || candidate.startsWith(canonical.slice(0, Math.min(3, canonical.length))));
    if (name_close && sim > best) best = sim;
  }
  return best;
}

function computeRisk(signals: SupplyChainSignals): "low" | "medium" | "high" | "critical" {
  let score = 0;
  if (signals.has_binary_download) score += 3;
  if (signals.has_postinstall_script) score += 2;
  if (signals.has_dynamic_code_execution) score += 3;
  if (signals.has_phone_home) score += 4;
  if (signals.has_telemetry) score += 1;
  if (signals.typosquat_similarity_score > 0.9) score += 5;
  if (signals.maintainer_count === 0) score += 2;
  if (signals.transitive_dep_count > 50) score += 1;
  if (signals.suspicious_deps.length > 0) score += 2;
  if (score >= 8) return "critical";
  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

const SUSPICIOUS_DEP_NAMES = new Set([
  // Known typosquats or suspicious packages · extend with security-advisory feed later
  "colors", "faker", "coa", "rc",   // historical incident targets
  "flatmap-stream", "event-stream", // bitcoin-wallet incident
]);

export function auditSupplyChain(input: AuditInput): SupplyChainReport {
  const scripts = extractScripts(input.package_json);
  const { telemetry, phone_home } = hasTelemetryOrPhoneHome(input.code_sample, input.package_json);
  const suspicious = input.transitive_deps.filter(d => SUSPICIOUS_DEP_NAMES.has(d));
  const typosquat = typosquatSimilarity(input.package_name);

  const signals: SupplyChainSignals = {
    has_postinstall_script: hasPostinstall(scripts),
    has_binary_download: hasBinaryDownloadInScripts(scripts),
    has_dynamic_code_execution: hasDynamicCodeExecution(input.code_sample),
    has_telemetry: telemetry,
    has_phone_home: phone_home,
    maintainer_count: input.maintainers.length,
    transitive_dep_count: input.transitive_deps.length,
    typosquat_similarity_score: typosquat,
    suspicious_deps: suspicious,
  };

  const risk_level = computeRisk(signals);
  const notes: string[] = [];
  if (signals.has_binary_download) notes.push("install/postinstall script downloads a binary or executes a shell script — sandbox before adopting");
  if (signals.has_postinstall_script) notes.push("postinstall/preinstall/prepare script present — execute inside isolated environment only");
  if (signals.has_dynamic_code_execution) notes.push("dynamic code execution (eval / new Function / vm) detected — high supply-chain risk");
  if (signals.has_phone_home) notes.push("phone-home endpoint pattern detected · runtime purity concern");
  if (signals.typosquat_similarity_score > 0.9) notes.push(`possible typosquat · similarity ${(signals.typosquat_similarity_score * 100).toFixed(0)}% to a well-known package`);
  if (signals.maintainer_count === 0) notes.push("no known maintainer · single-point-of-failure supply-chain risk");
  if (suspicious.length > 0) notes.push(`suspicious dependency names detected: ${suspicious.join(", ")}`);

  return {
    checked_at_iso: new Date().toISOString(),
    signals,
    risk_level,
    notes,
  };
}
