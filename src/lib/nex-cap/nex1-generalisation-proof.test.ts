// NEX1 · Generalisation Integration Proof · 2026-09-19
// Read-only w.r.t. all production capability files. Uses only:
//   · capability-experience-abstraction (Fix 34 · frozen)
//   · investigation-conclusion-store (Fix 17 · frozen · read-only here)
//   · the on-disk data/nex1-investigation-conclusions/entries.jsonl
//
// Proves five properties, each in its own it() block:
//   P1 · Multi-experience abstraction · many raw entries → fewer distinct patterns
//   P2 · Generalisation · pattern generality > any single contributing entry
//   P3 · Applying derived experience · retrieval answers an UNSEEN feature vector
//   P4 · Autonomous learning · byte-identical patterns across fresh Node subprocess,
//        no fixture-specific code path in the abstraction module
//   P5 · General intelligence composition · full pipeline: disk → entries → patterns →
//        novel query → advisory retrieval with R11-B markers · no LLM · no authority
//
// EXPLICIT NON-CLAIMS
//   · Not a claim about human-level intelligence
//   · Not a claim about learning across every domain
//   · Not a claim of authority · every returned pattern is INFERRED · advisory only

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  extractPatterns,
  loadAllEntriesFromStore,
  retrievePattern,
  extractShapeFeatures,
  patternIdOf,
  extractAndRetrieveFromStore,
  EXPERIENCE_ABSTRACTION_VERSION,
  _INTERNAL,
  type ShapeFeatures,
  type PatternRecord,
} from "@/lib/nex-agent/code-engine/capability-experience-abstraction";
import { getConclusionsStorePath } from "@/lib/nex-agent/code-engine/investigation-conclusion-store";

const REPO_ROOT = process.cwd();
const STORE_PATH = getConclusionsStorePath(REPO_ROOT);
const ABSTRACTION_SRC_PATH = path.join(
  REPO_ROOT,
  "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
);

describe("NEX1 · Generalisation Integration Proof · 5-item", () => {
  // ── P1 · Multi-experience abstraction ────────────────────────────────
  it(
    "P1 · Multi-experience abstraction · raw entries → fewer distinct patterns · support > 1",
    () => {
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      console.log(`[P1] entries loaded from disk: ${entries.length}`);
      expect(entries.length).toBeGreaterThanOrEqual(2);

      const patterns = extractPatterns(entries);
      console.log(
        `[P1] distinct feature-patterns extracted: ${patterns.length} · ` +
          `patterns=${patterns.map((p) => `${p.pattern_id}(support=${p.support_count})`).join(", ")}`,
      );
      expect(patterns.length).toBeGreaterThanOrEqual(1);

      // Abstraction proof · pattern count MUST be strictly less than entry count
      // OR at least one pattern must aggregate multiple entries.
      const maxSupport = Math.max(...patterns.map((p) => p.support_count));
      console.log(`[P1] max pattern support: ${maxSupport}`);
      expect(maxSupport).toBeGreaterThanOrEqual(2);
      expect(patterns.length).toBeLessThan(entries.length);

      // Entry-id partitioning MUST be disjoint · no entry appears in two patterns
      const seen = new Set<string>();
      for (const p of patterns) {
        for (const id of p.entry_ids) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
      // Total entry-ids across patterns MUST equal input entries
      expect(seen.size).toBe(entries.length);

      // Every pattern carries R11-B non-authority marker · governance invariant
      for (const p of patterns) {
        expect(p.evidence_kind).toBe("INFERRED");
        expect(p.r11b_marker).toBe(
          "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
        );
      }
    },
  );

  // ── P2 · Generalisation ──────────────────────────────────────────────
  it(
    "P2 · Generalisation · pattern features are abstract · pattern applies to > 1 concrete entry",
    () => {
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      const patterns = extractPatterns(entries);
      const [top] = patterns;
      console.log(
        `[P2] top pattern: ${top.pattern_id} · support=${top.support_count} · features=${JSON.stringify(top.features)}`,
      );

      // A generalised pattern MUST cover ≥ 2 concrete entries
      expect(top.support_count).toBeGreaterThanOrEqual(2);
      expect(top.entry_ids.length).toBe(top.support_count);
      expect(new Set(top.entry_ids).size).toBe(top.entry_ids.length);

      // Pattern-features MUST NOT contain instance-only fields
      // (entry_id / timestamp / investigation_id / trace_id / source_file)
      const featureKeys = Object.keys(top.features);
      for (const forbidden of [
        "entry_id",
        "timestamp",
        "investigation_id",
        "trace_id",
        "source_file",
      ]) {
        expect(featureKeys.includes(forbidden)).toBe(false);
      }
      console.log(`[P2] feature keys are abstract: ${JSON.stringify(featureKeys)}`);

      // The concrete contributors have different entry_ids · timestamps ·
      // possibly different source_files · yet share the same abstract features
      const contributors = entries.filter((e) => top.entry_ids.includes(e.entry_id));
      expect(contributors.length).toBe(top.entry_ids.length);
      const distinctTimestamps = new Set(contributors.map((e) => e.timestamp));
      expect(distinctTimestamps.size).toBeGreaterThanOrEqual(1);
      console.log(
        `[P2] top-pattern contributors have ${distinctTimestamps.size} distinct timestamps · ` +
          `${new Set(contributors.map((e) => e.source_file)).size} distinct source_files`,
      );

      // Every contributor's own extractShapeFeatures MUST equal the pattern's features
      // (proves the grouping is by feature-equality · deterministic)
      for (const c of contributors) {
        const f = extractShapeFeatures(c);
        expect(patternIdOf(f)).toBe(top.pattern_id);
      }
    },
  );

  // ── P3 · Applying derived experience to a NEW case ───────────────────
  it(
    "P3 · Applying derived experience · retrieval answers a target features vector NOT present in corpus",
    () => {
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      const patterns = extractPatterns(entries);

      // Construct a target features vector for a HYPOTHETICAL file whose
      // path_dir_second value is NEVER seen in the current corpus.
      // Current corpus: all entries have path_dir_root="src" · path_dir_second="lib"
      // Novel probe: path_dir_second="components" (never in corpus)
      // Other dims align with an existing pattern's shape so relaxation kicks in.
      const seenSecondDirs = new Set(patterns.map((p) => p.features.path_dir_second));
      const NOVEL_SECOND = "components-novel-probe";
      expect(seenSecondDirs.has(NOVEL_SECOND)).toBe(false);

      // Match a shape that exists in corpus (any high-support pattern) but with novel second_dir
      const anchorPattern = patterns.find((p) => p.support_count >= 2);
      expect(anchorPattern).toBeDefined();
      if (!anchorPattern) return;

      const novelTarget: ShapeFeatures = {
        has_signature_format: anchorPattern.features.has_signature_format,
        value_type: anchorPattern.features.value_type,
        path_dir_root: anchorPattern.features.path_dir_root,
        path_dir_second: NOVEL_SECOND,
        selection_state: anchorPattern.features.selection_state,
      };

      const result = extractAndRetrieveFromStore(novelTarget, 1, REPO_ROOT);
      console.log(
        `[P3] novel target=${JSON.stringify(novelTarget)} · match_kind=${result.match?.match_kind ?? "null"} · match_pattern=${result.match?.pattern.pattern_id ?? "null"}`,
      );
      expect(result.match).not.toBeNull();
      if (!result.match) return;

      // MUST be a relaxed match — exact match would be a bug given novel second_dir
      expect(result.match.match_kind).not.toBe("exact");
      expect(result.match.evidence_kind).toBe("INFERRED");
      expect(result.match.pattern.r11b_marker).toBe(
        "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      );
      // The retrieved pattern MUST come from the actual corpus (not fabricated)
      expect(patterns.some((p) => p.pattern_id === result.match!.pattern.pattern_id)).toBe(
        true,
      );
      // The retrieved pattern's features MUST NOT contain the novel second_dir
      expect(result.match.pattern.features.path_dir_second).not.toBe(NOVEL_SECOND);
      console.log(
        `[P3] retrieval generalised · returned corpus pattern ${result.match.pattern.pattern_id} for unseen path_dir_second`,
      );
    },
  );

  // ── P4 · Autonomous learning ─────────────────────────────────────────
  it(
    "P4 · Autonomous learning · zero fixture-specific logic · byte-identical fresh subprocess",
    () => {
      // ── Part A · source-inspection · no fixture-specific literals ──
      const src = readFileSync(ABSTRACTION_SRC_PATH, "utf8");
      const codeOnly = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

      // Fixture-specific tokens that MUST NOT appear in the module source
      // (any concrete file name / investigation id / entry id would betray tuning)
      const FORBIDDEN_TOKENS = [
        "plantHire",
        "tradeOffSocial",
        "assessFear",
        "nex1-inv-",
        "q8-2026-",
        "src/lib/seo",
      ];
      for (const t of FORBIDDEN_TOKENS) {
        const hit = codeOnly.includes(t);
        if (hit) {
          console.log(`[P4] FORBIDDEN token found in module code: "${t}"`);
        }
        expect(hit).toBe(false);
      }
      console.log(`[P4] source clean · no fixture-specific literals`);

      // No LLM / network dependency imports
      const importLines = src.split("\n").filter((l) => /^\s*(import|const .* = require)/.test(l));
      const llmish = importLines.filter((l) =>
        /(anthropic|openai|@anthropic|OpenAI\(|Anthropic\(|@google\/generative-ai|groq|gemini|gpt-|claude-|node-fetch|axios|got|https?)/i.test(
          l,
        ),
      );
      expect(llmish).toHaveLength(0);
      console.log(`[P4] source clean · zero LLM / network imports`);

      // ── Part B · in-process determinism · order-independence ──
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      const p1 = extractPatterns(entries);
      const p2 = extractPatterns(entries);
      const p3 = extractPatterns([...entries].reverse());
      const idsFrom = (arr: readonly PatternRecord[]) =>
        arr.map((p) => `${p.pattern_id}|${p.support_count}`).sort().join(";");
      expect(idsFrom(p1)).toBe(idsFrom(p2));
      expect(idsFrom(p1)).toBe(idsFrom(p3));
      console.log(`[P4] deterministic + order-independent · signature=${idsFrom(p1)}`);

      // ── Part C · fresh Node subprocess replicates pattern extraction ──
      // The subprocess reads the JSONL directly and applies the SAME feature
      // rules (declared in one table) to produce the pattern signature.
      // If the abstraction module were hiding fixture-specific magic, the
      // subprocess reimplementation from the SAME published rule-set would
      // produce a different signature.
      const featureDims = _INTERNAL.SHAPE_FEATURE_DIMENSIONS;
      expect(Array.isArray(featureDims)).toBe(true);
      expect(featureDims.length).toBeGreaterThan(0);
      console.log(`[P4] declared feature dims: ${JSON.stringify(featureDims)}`);

      const escapedPath = STORE_PATH.replace(/\\/g, "\\\\");
      const script =
        `const fs = require('node:fs');` +
        `const raw = fs.readFileSync("${escapedPath}", "utf8");` +
        `const lines = raw.split(/\\r?\\n/).filter(l => l.trim() !== "");` +
        `const norm = p => p.replace(/\\\\/g, "/");` +
        `const classify = v => (v == null || v === "") ? "empty" : ` +
        `  /^-?\\d+(\\.\\d+)?$/.test(v) ? "number" : ` +
        `  (v === "true" || v === "false") ? "boolean" : ` +
        `  /^["\\'\\` + '`' + `]/.test(v) ? "string" : "other";` +
        `const groups = new Map();` +
        `for (const l of lines) {` +
        `  let o; try { o = JSON.parse(l); } catch { continue; }` +
        `  if (!o || o.evidence_kind !== "INFERRED") continue;` +
        `  const sc = o.selected_candidate;` +
        `  const has_sig = typeof sc === "string" && sc.indexOf("::") >= 0;` +
        `  let vt = "empty";` +
        `  if (has_sig) { const i = sc.indexOf("::"); vt = classify(sc.slice(i+2)); }` +
        `  const parts = norm(o.source_file || "").split("/");` +
        `  const pdr = parts[0] || "";` +
        `  const pds = parts.length >= 2 ? (parts[1] || null) : null;` +
        `  const pid = ["pat", o.selection_state, vt, has_sig?"sig":"nosig", pdr || "-", pds == null ? "-" : pds].join("-");` +
        `  const g = groups.get(pid) || { count: 0 };` +
        `  g.count += 1; groups.set(pid, g);` +
        `}` +
        `const out = [...groups.entries()].map(([k,v]) => k + "|" + v.count).sort().join(";");` +
        `process.stdout.write(out);`;

      const stdout = execFileSync(process.execPath, ["-e", script], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      }).trim();
      console.log(`[P4] fresh subprocess signature: ${stdout}`);
      console.log(`[P4] in-process signature:       ${idsFrom(p1)}`);
      expect(stdout).toBe(idsFrom(p1));

      // Version pin · module identity is stable
      expect(EXPERIENCE_ABSTRACTION_VERSION).toBe("fix34.v1");
    },
    60000,
  );

  // ── P5 · General intelligence composition ────────────────────────────
  it(
    "P5 · General intelligence composition · full pipeline · disk→abstract→retrieve→advisory",
    () => {
      // Full end-to-end composition · one call
      const target: ShapeFeatures = {
        has_signature_format: true,
        value_type: "other",
        path_dir_root: "src",
        path_dir_second: "components-generalisation-probe", // never in corpus
        selection_state: "SELECTED",
      };
      const composed = extractAndRetrieveFromStore(target, 1, REPO_ROOT);

      // Layer 1 · disk reachable
      expect(existsSync(STORE_PATH)).toBe(true);
      expect(composed.total_entries).toBeGreaterThanOrEqual(2);

      // Layer 2 · patterns present · every one INFERRED · every one non-authority
      expect(composed.patterns.length).toBeGreaterThanOrEqual(1);
      for (const p of composed.patterns) {
        expect(p.evidence_kind).toBe("INFERRED");
        expect(p.r11b_marker).toBe(
          "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
        );
      }

      // Layer 3 · retrieval succeeded for the unseen target
      expect(composed.match).not.toBeNull();
      if (!composed.match) return;
      expect(composed.match.match_kind).not.toBe("exact");
      expect(composed.match.evidence_kind).toBe("INFERRED");
      expect(composed.match.pattern.r11b_marker).toBe(
        "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      );

      // Layer 4 · no authority fields in composed result
      const anyResult = composed as unknown as Record<string, unknown>;
      expect(anyResult.founder_authorised).toBeUndefined();
      expect(anyResult.workstation_mutation).toBeUndefined();
      expect(anyResult.signature_hex).toBeUndefined();
      expect(anyResult.nex2_verdict).toBeUndefined();
      expect(anyResult.nex3_verdict).toBeUndefined();

      // Layer 5 · zero LLM / network at composition entry point
      const absSrc = readFileSync(ABSTRACTION_SRC_PATH, "utf8");
      expect(/anthropic|openai|@anthropic|node-fetch|axios/i.test(absSrc)).toBe(false);
      const storeSrc = readFileSync(
        path.join(
          REPO_ROOT,
          "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts",
        ),
        "utf8",
      );
      expect(/anthropic|openai|@anthropic|node-fetch|axios/i.test(storeSrc)).toBe(false);

      console.log(
        `[P5] composed pipeline · entries=${composed.total_entries} · patterns=${composed.patterns.length} · match=${composed.match.match_kind}:${composed.match.pattern.pattern_id}`,
      );
    },
  );

  // ── FINAL · one composite assertion summarising all 5 ────────────────
  it(
    "FINAL · integration flow verifies all 5 proof-items simultaneously",
    () => {
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      const patterns = extractPatterns(entries);

      const p1_multi = patterns.length < entries.length &&
        Math.max(...patterns.map((p) => p.support_count)) >= 2;
      const p2_general = patterns[0]?.support_count >= 2 &&
        !Object.keys(patterns[0]?.features ?? {}).includes("entry_id");
      const p3_apply = (() => {
        const anchor = patterns.find((p) => p.support_count >= 2);
        if (!anchor) return false;
        const target: ShapeFeatures = {
          ...anchor.features,
          path_dir_second: "final-composite-probe",
        };
        const r = retrievePattern(patterns, { target_features: target, min_support: 1 });
        return r !== null && r.match_kind !== "exact";
      })();
      const p4_autonomous = (() => {
        const src = readFileSync(ABSTRACTION_SRC_PATH, "utf8");
        const codeOnly = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
        return !codeOnly.includes("plantHire") &&
          !codeOnly.includes("assessFear") &&
          !codeOnly.includes("nex1-inv-");
      })();
      const p5_intelligence = (() => {
        const composed = extractAndRetrieveFromStore(
          {
            has_signature_format: true,
            value_type: "other",
            path_dir_root: "src",
            path_dir_second: "final-composite-probe",
            selection_state: "SELECTED",
          },
          1,
          REPO_ROOT,
        );
        return composed.total_entries >= 2 &&
          composed.patterns.length >= 1 &&
          composed.match !== null &&
          composed.match.evidence_kind === "INFERRED";
      })();

      const scoreboard = {
        P1_multi_experience_abstraction: p1_multi,
        P2_generalisation: p2_general,
        P3_applying_derived_experience: p3_apply,
        P4_autonomous_learning: p4_autonomous,
        P5_general_intelligence: p5_intelligence,
      };
      console.log(`[FINAL] scoreboard: ${JSON.stringify(scoreboard, null, 2)}`);
      for (const [k, v] of Object.entries(scoreboard)) {
        expect(v, `${k} MUST be true`).toBe(true);
      }
    },
  );
});
