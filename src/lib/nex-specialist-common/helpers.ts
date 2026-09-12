// src/lib/nex-specialist-common/helpers.ts
//
// Shared helpers · deterministic · no LLM · no network.

import { createHash, randomBytes } from "node:crypto";
import type { ReproducibilityInformation } from "./types";

export function sha256Prefix(s: string): string { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

export function newId(prefix: string): string {
  return prefix + "-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
}

export function makeReproducibility(command: string, seed: string): ReproducibilityInformation {
  const parts = ["node=" + process.version, "platform=" + process.platform, "arch=" + process.arch, "seed=" + seed];
  return {
    command,
    cwd: process.cwd(),
    env_fingerprint: sha256Prefix(parts.join("|")),
    node_version: process.version,
    platform: process.platform,
    seed,
  };
}

// Shared forbidden-vocab list across all specialists · each specialist can extend.
export const BASE_FORBIDDEN_VOCAB = [
  "quality_score","overall_quality","health_score","technical_debt","better_score","winner_score",
  "superiority_score","code_grade","overall_grade","aggregate_quality","weighted_total",
  "87% better","92% confidence","confidence_percent","confidence_score","probably","likely_87","likely_92",
  "bad code","good code","clean code","poor code","optimal code","better code","worse code",
  "code smell","anti-pattern","best practice","worst practice",
  "poorly designed","well designed",
];

function buildRegexes(words: readonly string[]) {
  return words.map((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { word: w, re: new RegExp(`(?<![a-z0-9_-])${escaped}(?![a-z0-9_-])`, "i") };
  });
}

export function makeForbiddenVocabGuard(extra: readonly string[] = []) {
  const regexes = buildRegexes([...BASE_FORBIDDEN_VOCAB, ...extra]);
  const walkForForbiddenVocab = (obj: unknown): { hit: boolean; word?: string; where?: string } => {
    const seen = new WeakSet<object>();
    const walk = (v: unknown, path: string): { hit: boolean; word?: string; where?: string } => {
      if (typeof v === "string") {
        for (const { word, re } of regexes) if (re.test(v)) return { hit: true, word, where: path };
        return { hit: false };
      }
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) { const r = walk(v[i], path + "[" + i + "]"); if (r.hit) return r; }
        return { hit: false };
      }
      if (v && typeof v === "object") {
        if (seen.has(v as object)) return { hit: false };
        seen.add(v as object);
        for (const [k, val] of Object.entries(v as object)) {
          const r = walk(val, path + "." + k);
          if (r.hit) return r;
        }
        return { hit: false };
      }
      return { hit: false };
    };
    return walk(obj, "$");
  };
  return { walkForForbiddenVocab };
}
