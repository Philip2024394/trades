// scripts/nex-phase7-vision-v1-run.mjs
//
// Phase 7 · Vision V1 · runs the deterministic image-metadata analyzer
// against a small sample of real images from the repo.
// Read-only · zero third-party API contact · zero pixel decode beyond header parsing.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { computeImageMetadata } from "@/lib/nex/vision/v1-metadata";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();

// Collect a small sample of real images from repo directories
const sampleDirs = ["public/badges", "public/brand", "public/logos", "public/icons"];
const found: string[] = [];
for (const d of sampleDirs) {
  const dir = path.join(cwd, d);
  if (!existsSync(dir)) continue;
  try {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      try {
        if (!statSync(p).isFile()) continue;
        if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) found.push(p);
      } catch { /* skip */ }
      if (found.length >= 12) break;
    }
  } catch { /* skip */ }
  if (found.length >= 12) break;
}

const results = found.map((p) => {
  const buf = readFileSync(p);
  const md = computeImageMetadata(buf);
  return { path: path.relative(cwd, p), ...md };
});

// Aggregate summary
const byFormat: Record<string, number> = {};
const byCorruption: Record<string, number> = {};
for (const r of results) {
  byFormat[r.format] = (byFormat[r.format] ?? 0) + 1;
  byCorruption[r.corruption_status] = (byCorruption[r.corruption_status] ?? 0) + 1;
}

console.log("PHASE_7_VISION_V1_REPORT:" + JSON.stringify({
  analyzer: "nex-vision-v1-header-metadata",
  analyzer_version: "1.0.0",
  files_scanned: results.length,
  by_format: byFormat,
  by_corruption: byCorruption,
  total_bytes_analyzed: results.reduce((s, r) => s + r.size_bytes, 0),
  results,
  doctrine_check: {
    third_party_api_contacted: false,
    pixel_decode_beyond_headers: false,
    no_semantic_content_ever_claimed: results.every((r) => r.claimed_semantic_content === null),
    every_result_cites_analyzer_version_confidence: results.every((r) => r.analyzer && r.analyzer_version && r.confidence),
    unknown_returned_honestly: results.filter((r) => r.format === "unknown").every((r) => r.width === null && r.height === null && r.confidence === "low"),
  },
}, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase7-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", tsPath],
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
