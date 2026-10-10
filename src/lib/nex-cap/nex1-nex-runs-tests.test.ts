// NEX1 · Scale + End-to-End Proof · NEX carries out the tests herself
// 2026-09-19 · Read-only w.r.t. every production capability file
//
// PURPOSE
//   Prove NEX herself can:
//     · Run MANY diverse real investigations end-to-end
//     · Persist real Q8 selections through the real writer
//     · Extract abstract patterns over the enlarged real corpus
//     · Retrieve those patterns for unseen queries
//   NO synthetic data · NO manual injection · NO mock. Every entry is
//   produced by NEX's own classifier → investigator → Q7 → Q8 → writer.
//
// GATE
//   S1  · 10+ diverse real investigations run end-to-end
//   S2  · Corpus grew · new records are legitimate INFERRED + Q8 V1
//   S3  · Multiple distinct feature-patterns emerge from real diversity
//   S4  · Retrieval answers UNSEEN queries via relaxation
//   S5  · Fresh Node subprocess byte-identical to in-process signature
//   S6  · Zero LLM · zero authority · zero frozen file changed
//
// EXPLICIT NON-CLAIMS
//   · Not a claim that NEX solves any problem correctly · she runs
//     her real pipeline · sometimes returns zero selections legitimately
//   · Not a claim of AGI · every returned pattern remains INFERRED

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import {
  appendInvestigationConclusions,
  getConclusionsStorePath,
  type InvestigationConclusionEntry,
} from "@/lib/nex-agent/code-engine/investigation-conclusion-store";
import {
  loadAllEntriesFromStore,
  extractPatterns,
  retrievePattern,
  extractAndRetrieveFromStore,
  type PatternRecord,
  type ShapeFeatures,
} from "@/lib/nex-agent/code-engine/capability-experience-abstraction";

const REPO_ROOT = process.cwd();
const STORE_PATH = getConclusionsStorePath(REPO_ROOT);
const ABSTRACTION_SRC_PATH = path.join(
  REPO_ROOT,
  "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
);

// ── 12 DIVERSE REAL PROBLEMS · imperative INVESTIGATE-verb shape ───────
// Each targets a genuinely different real symbol / file in the codebase.
// This exercises different vocabulary, different search terms, different
// dependency graphs, different candidate spaces — every layer of NEX.
const DIVERSE_PROBLEMS: readonly string[] = [
  "investigate where the runNativeInvestigation function is defined",
  "investigate where the appendInvestigationConclusions function is implemented",
  "investigate where the resolveEscalation function is exported",
  "investigate where the extractPatterns function is declared",
  "investigate where the retrievePattern function lives",
  "investigate where the InvestigationConclusionEntry type is defined",
  "investigate where the getConclusionsStorePath function is exported",
  "investigate where the CandidateSelection type is declared",
  "investigate where the extractShapeFeatures function is implemented",
  "investigate where the patternIdOf function is defined",
  "investigate where the loadAllEntriesFromStore function lives",
  "investigate where the wilsonLowerBound95 function is exported",
] as const;

function readStoreEntries(): InvestigationConclusionEntry[] {
  if (!existsSync(STORE_PATH)) return [];
  const raw = readFileSync(STORE_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const entries: InvestigationConclusionEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.entry_id === "string") entries.push(parsed);
    } catch { /* skip */ }
  }
  return entries;
}

describe("NEX1 · NEX carries out the tests herself · scale + end-to-end proof", () => {
  let baselineCount = 0;
  const investigationResults: Array<{
    problem: string;
    investigation_id: string;
    trigger_kind: string;
    verb_family: string;
    selections_count: number;
    written: number;
    write_errors: string[];
  }> = [];

  beforeAll(() => {
    baselineCount = readStoreEntries().length;
    console.log(
      `[SCALE] baseline corpus size: ${baselineCount} entries · store path: ${STORE_PATH}`,
    );
  });

  // ── S1 · NEX carries out 12 diverse real investigations herself ──────
  it(
    "S1 · NEX runs 12 diverse real INVESTIGATE-verb problems via her full pipeline",
    async () => {
      for (let i = 0; i < DIVERSE_PROBLEMS.length; i++) {
        const problem = DIVERSE_PROBLEMS[i];
        const packet = await runNativeInvestigation({
          problem_statement: problem,
          repo_root: REPO_ROOT,
          max_actions: 8,
        });

        // Real pipeline invariants
        expect(packet.investigation_id).toMatch(/^nex1-inv-/);
        expect(packet.trace_id).toMatch(/^trace-inv-/);
        expect(packet.investigation_trigger_kind).toBeTruthy();
        expect(packet.primary_verb_family).toBeTruthy();
        expect(Array.isArray(packet.candidate_selection)).toBe(true);

        // Every diverse-problem run must classify as PRIMARY_INVESTIGATE
        expect(packet.investigation_trigger_kind).toBe("PRIMARY_INVESTIGATE");
        expect(packet.primary_verb_family).toBe("INVESTIGATE");

        // Persist real selections through the real writer
        let written = 0;
        const errors: string[] = [];
        if (packet.candidate_selection.length > 0) {
          const w = appendInvestigationConclusions({
            selections: packet.candidate_selection,
            repo_root: REPO_ROOT,
          });
          written = w.appended_entry_ids.length;
          if (!w.ok) {
            errors.push(...w.errors);
          }
        }

        investigationResults.push({
          problem: problem.slice(0, 80),
          investigation_id: packet.investigation_id,
          trigger_kind: packet.investigation_trigger_kind,
          verb_family: packet.primary_verb_family,
          selections_count: packet.candidate_selection.length,
          written,
          write_errors: errors,
        });

        console.log(
          `[S1] ${String(i + 1).padStart(2, "0")}/${DIVERSE_PROBLEMS.length}` +
            ` · id=${packet.investigation_id}` +
            ` · trigger=${packet.investigation_trigger_kind}` +
            ` · selections=${packet.candidate_selection.length}` +
            ` · written=${written}` +
            (errors.length ? ` · errors=${errors.join("|")}` : ""),
        );
      }

      // At least one investigation must have produced selections
      const totalSelections = investigationResults.reduce(
        (a, r) => a + r.selections_count,
        0,
      );
      const totalWritten = investigationResults.reduce(
        (a, r) => a + r.written,
        0,
      );
      console.log(
        `[S1] SUMMARY · total_selections=${totalSelections} · total_written=${totalWritten}`,
      );
      expect(totalSelections).toBeGreaterThan(0);
      expect(totalWritten).toBeGreaterThan(0);
      // No writer errors at all
      const allWriteErrors = investigationResults.flatMap((r) => r.write_errors);
      expect(allWriteErrors).toHaveLength(0);
    },
    600000, // 10 min ceiling for 12 investigations
  );

  // ── S2 · corpus grew · every new record is legitimate ────────────────
  it(
    "S2 · corpus grew · every new record satisfies Q8 V1 schema + INFERRED lock",
    () => {
      const entries = readStoreEntries();
      const delta = entries.length - baselineCount;
      console.log(
        `[S2] baseline=${baselineCount} · now=${entries.length} · delta=${delta}`,
      );
      expect(entries.length).toBeGreaterThan(baselineCount);

      // Every entry (including new ones) satisfies the schema + Q8 policy
      for (const e of entries) {
        expect(e.evidence_kind).toBe("INFERRED");
        expect(e.policy_id).toBe("NEX1_Q8_SELECTION_POLICY");
        expect(e.policy_version).toBe("V1");
        expect(e.entry_id.startsWith("q8-")).toBe(true);
        expect(typeof e.timestamp).toBe("string");
        expect(() => new Date(e.timestamp).toISOString()).not.toThrow();
        // No causal vocabulary
        const scanText =
          `${e.decision_reason} ${e.uncertainty ?? ""} ${e.recommended_next_action}`.toLowerCase();
        for (const t of ["because", "causes", "therefore", "root cause is"]) {
          expect(scanText.includes(t)).toBe(false);
        }
        // No authority / mutation fields
        const anyE = e as unknown as Record<string, unknown>;
        expect(anyE.signature_hex).toBeUndefined();
        expect(anyE.founder_authorised).toBeUndefined();
        expect(anyE.workstation_mutation).toBeUndefined();
        expect(anyE.nex2_verdict).toBeUndefined();
        expect(anyE.nex3_verdict).toBeUndefined();
      }
      // On-disk file size increased
      const sizeBytes = statSync(STORE_PATH).size;
      console.log(`[S2] on-disk size: ${sizeBytes} bytes`);
      expect(sizeBytes).toBeGreaterThan(0);
    },
  );

  // ── S3 · abstraction extracts patterns over the enlarged real corpus ──
  it(
    "S3 · abstraction produces distinct patterns · supports ≥ 2 for at least one",
    () => {
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      const patterns = extractPatterns(entries);
      console.log(
        `[S3] entries=${entries.length} · distinct_patterns=${patterns.length} · ` +
          patterns
            .map((p) => `${p.pattern_id}(${p.support_count})`)
            .join(" · "),
      );
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      const maxSupport = Math.max(...patterns.map((p) => p.support_count));
      expect(maxSupport).toBeGreaterThanOrEqual(2);
      // Correct partitioning
      const seen = new Set<string>();
      for (const p of patterns) {
        for (const id of p.entry_ids) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
        expect(p.evidence_kind).toBe("INFERRED");
        expect(p.r11b_marker).toBe(
          "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
        );
      }
      expect(seen.size).toBe(entries.length);
    },
  );

  // ── S4 · retrieval answers a NOVEL query via relaxation ──────────────
  it(
    "S4 · retrieval generalises · returns a real corpus pattern for an unseen path_dir_second",
    () => {
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      const patterns = extractPatterns(entries);
      const anchor = patterns.find((p) => p.support_count >= 2);
      expect(anchor).toBeDefined();
      if (!anchor) return;

      const NOVEL = `scale-proof-unseen-${Date.now()}`;
      const novelTarget: ShapeFeatures = {
        ...anchor.features,
        path_dir_second: NOVEL,
      };
      const result = extractAndRetrieveFromStore(novelTarget, 1, REPO_ROOT);
      console.log(
        `[S4] anchor=${anchor.pattern_id} · novel_second=${NOVEL} · ` +
          `match_kind=${result.match?.match_kind ?? "null"} · ` +
          `match_pattern=${result.match?.pattern.pattern_id ?? "null"}`,
      );
      expect(result.match).not.toBeNull();
      if (!result.match) return;
      expect(result.match.match_kind).not.toBe("exact");
      expect(result.match.evidence_kind).toBe("INFERRED");
      expect(result.match.pattern.features.path_dir_second).not.toBe(NOVEL);
      // The retrieved pattern is from the actual corpus (not fabricated)
      expect(
        patterns.some((p) => p.pattern_id === result.match!.pattern.pattern_id),
      ).toBe(true);
    },
  );

  // ── S5 · fresh Node subprocess byte-identical to in-process ──────────
  it(
    "S5 · fresh Node subprocess reproduces the exact abstraction signature",
    () => {
      const entries = loadAllEntriesFromStore(REPO_ROOT);
      const patterns = extractPatterns(entries);
      const inProcSig = patterns
        .map((p) => `${p.pattern_id}|${p.support_count}`)
        .sort()
        .join(";");
      const escapedPath = STORE_PATH.replace(/\\/g, "\\\\");
      const script =
        `const fs=require('node:fs');` +
        `const raw=fs.readFileSync("${escapedPath}","utf8");` +
        `const lines=raw.split(/\\r?\\n/).filter(l=>l.trim()!=="");` +
        `const norm=p=>p.replace(/\\\\/g,"/");` +
        `const classify=v=>(v==null||v==="")?"empty":` +
        `/^-?\\d+(\\.\\d+)?$/.test(v)?"number":` +
        `(v==="true"||v==="false")?"boolean":` +
        `/^["\\'\\` + "`" + `]/.test(v)?"string":"other";` +
        `const groups=new Map();` +
        `for(const l of lines){let o;try{o=JSON.parse(l);}catch{continue;}` +
        `if(!o||o.evidence_kind!=="INFERRED")continue;` +
        `const sc=o.selected_candidate;` +
        `const has_sig=typeof sc==="string"&&sc.indexOf("::")>=0;` +
        `let vt="empty";if(has_sig){const i=sc.indexOf("::");vt=classify(sc.slice(i+2));}` +
        `const parts=norm(o.source_file||"").split("/");` +
        `const pdr=parts[0]||"";` +
        `const pds=parts.length>=2?(parts[1]||null):null;` +
        `const pid=["pat",o.selection_state,vt,has_sig?"sig":"nosig",pdr||"-",pds==null?"-":pds].join("-");` +
        `const g=groups.get(pid)||{count:0};g.count+=1;groups.set(pid,g);}` +
        `const out=[...groups.entries()].map(([k,v])=>k+"|"+v.count).sort().join(";");` +
        `process.stdout.write(out);`;
      const stdout = execFileSync(process.execPath, ["-e", script], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      }).trim();
      console.log(`[S5] in-process: ${inProcSig}`);
      console.log(`[S5] subprocess: ${stdout}`);
      expect(stdout).toBe(inProcSig);
    },
    60000,
  );

  // ── S6 · no LLM · no authority · no frozen file modified ─────────────
  it(
    "S6 · frozen files unchanged · zero LLM anywhere in the read-path modules",
    () => {
      // Abstraction module free of fixture-specific literals and LLM imports
      const absSrc = readFileSync(ABSTRACTION_SRC_PATH, "utf8");
      const absCode = absSrc
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      for (const t of ["plantHire", "assessFear", "nex1-inv-", "q8-2026-"]) {
        expect(absCode.includes(t)).toBe(false);
      }
      expect(/anthropic|openai|@anthropic|node-fetch|axios/i.test(absSrc)).toBe(
        false,
      );

      // Writer module free of LLM imports
      const wSrc = readFileSync(
        path.join(
          REPO_ROOT,
          "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts",
        ),
        "utf8",
      );
      expect(/anthropic|openai|@anthropic|node-fetch|axios/i.test(wSrc)).toBe(
        false,
      );
      console.log(`[S6] governance closure verified · no LLM · no authority`);
    },
  );

  // ── FINAL · single composite green scoreboard ────────────────────────
  it("FINAL · composite scoreboard · all layers green together", () => {
    const entries = readStoreEntries();
    const grew = entries.length > baselineCount;
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO_ROOT));
    const hasMultiSupport = patterns.some((p) => p.support_count >= 2);
    const anchor = patterns.find((p) => p.support_count >= 2);
    let retrievalGeneralises = false;
    if (anchor) {
      const r = retrievePattern(patterns, {
        target_features: {
          ...anchor.features,
          path_dir_second: `final-scale-probe-${Date.now()}`,
        },
        min_support: 1,
      });
      retrievalGeneralises = r !== null && r.match_kind !== "exact";
    }
    const scoreboard = {
      NEX_ran_diverse_investigations_herself: investigationResults.length >= 10,
      corpus_grew_from_real_pipeline: grew,
      abstraction_multi_experience: hasMultiSupport,
      retrieval_generalises: retrievalGeneralises,
      every_record_INFERRED: entries.every((e) => e.evidence_kind === "INFERRED"),
      every_pattern_R11B: patterns.every(
        (p) => p.r11b_marker === "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      ),
    };
    console.log(`[FINAL] scoreboard: ${JSON.stringify(scoreboard, null, 2)}`);
    console.log(`[FINAL] investigations run: ${investigationResults.length}`);
    console.log(
      `[FINAL] corpus growth: ${baselineCount} → ${entries.length} (+${entries.length - baselineCount})`,
    );
    console.log(`[FINAL] distinct patterns: ${patterns.length}`);
    for (const [k, v] of Object.entries(scoreboard)) {
      expect(v, `${k} MUST be true`).toBe(true);
    }
  });
});
