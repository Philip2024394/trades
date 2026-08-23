#!/usr/bin/env node
// scripts/nex-factory/calibration-report.mjs
//
// Directory Factory · Calibration Harness · Report generator.
//
// Emits a Markdown report of every scored candidate, side-by-side.
// Purpose (Philip 2026-08-23):
//   "Would we actually trust NEX to create this directory automatically?"
//   The report gives you the raw evidence + placeholder score + tier so
//   you can judge each candidate independently.
//
// Latest score per candidate = MAX(computed_at). Older scores are ignored
// in the report but preserved in the DB for score-drift analysis.
//
// Usage:
//   node --env-file=.env.local scripts/nex-factory/calibration-report.mjs                        # writes to stdout
//   node --env-file=.env.local scripts/nex-factory/calibration-report.mjs --out=report.md        # writes to file
//   node --env-file=.env.local scripts/nex-factory/calibration-report.mjs --min-candidates=10    # bail if fewer

import pg from "pg";
import { writeFileSync } from "node:fs";
import { THRESHOLDS, SCORER_VERSION } from "./score-candidate.mjs";

const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1];
const minCandidatesArg = Number(args.find((a) => a.startsWith("--min-candidates="))?.split("=")[1] ?? 0);

const url = process.env.NEX_POSTGRES_URL;
if (!url) {
  console.error("NEX_POSTGRES_URL not set");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 4 });

async function main() {
  // Latest score per candidate.
  const rowsRes = await pool.query(
    `WITH latest AS (
        SELECT DISTINCT ON (candidate_id) *
          FROM nex.category_candidate_score
         ORDER BY candidate_id, computed_at DESC
      )
      SELECT
        c.id                          AS candidate_id,
        c.proposed_category_id,
        c.proposed_name,
        c.display_name_en,
        c.suggested_parent_vertical,
        c.suggested_countries,
        c.brain_keywords,
        c.business_count,
        c.cycle_count,
        c.confidence,
        c.evidence,
        c.discovered_businesses,
        c.image_candidates,
        c.proposed_by,
        c.proposed_cycle_run_id,
        c.created_at                  AS candidate_created_at,
        c.admin_decision,
        c.admin_reviewed_at,
        c.admin_reviewed_by,
        c.admin_notes,
        c.duplicate_of_registry_id,
        c.superseded_by_candidate_id,
        l.quality_score,
        l.safety_score,
        l.provisional_tier,
        l.primary_hazard,
        l.signals,
        l.quality_breakdown,
        l.safety_breakdown,
        l.scorer_version,
        l.computed_at                 AS score_computed_at,
        l.computed_by                 AS score_computed_by,
        (SELECT jsonb_agg(jsonb_build_object(
                  'annotator',    a.annotator,
                  'verdict',      a.verdict,
                  'reason',       a.reason,
                  'annotated_at', a.annotated_at))
           FROM nex.category_candidate_calibration_annotation a
          WHERE a.candidate_id = c.id
          ORDER BY 1)                 AS annotations
      FROM nex.category_candidate c
      LEFT JOIN latest l ON l.candidate_id = c.id
      ORDER BY (l.quality_score) DESC NULLS LAST, c.created_at ASC`,
  );

  const rows = rowsRes.rows;

  if (minCandidatesArg > 0 && rows.length < minCandidatesArg) {
    console.error(`Only ${rows.length} candidates in DB · need ≥ ${minCandidatesArg}. Bailing.`);
    await pool.end();
    process.exit(2);
  }

  const md = buildMarkdown(rows);

  if (outArg) {
    writeFileSync(outArg, md, "utf8");
    console.error(`Wrote ${outArg} (${md.length} bytes · ${rows.length} candidates)`);
  } else {
    process.stdout.write(md);
  }

  await pool.end();
}

function buildMarkdown(rows) {
  const now = new Date().toISOString();
  const tiers = { HIGH: 0, MEDIUM: 0, LOW: 0, UNSCORED: 0 };
  for (const r of rows) {
    if (!r.provisional_tier) tiers.UNSCORED += 1;
    else tiers[r.provisional_tier] += 1;
  }

  const lines = [];
  lines.push(`# NEX Directory Factory · Calibration Report`);
  lines.push(``);
  lines.push(`**Generated:** ${now}`);
  lines.push(`**Scorer version:** \`${SCORER_VERSION}\``);
  lines.push(`**Total candidates:** ${rows.length}`);
  lines.push(`**Tier distribution:** 🟢 HIGH=${tiers.HIGH} · 🟡 MEDIUM=${tiers.MEDIUM} · 🔴 LOW=${tiers.LOW} · ⚪ UNSCORED=${tiers.UNSCORED}`);
  lines.push(``);
  lines.push(`## Placeholder thresholds in use`);
  lines.push(`| Tier | quality_score | safety_score |`);
  lines.push(`|---|---|---|`);
  lines.push(`| 🟢 HIGH | ≥ ${THRESHOLDS.HIGH_QUALITY} | ≥ ${THRESHOLDS.HIGH_SAFETY} |`);
  lines.push(`| 🟡 MEDIUM | ≥ ${THRESHOLDS.MEDIUM_QUALITY} | ≥ ${THRESHOLDS.MEDIUM_SAFETY} (and not HIGH) |`);
  lines.push(`| 🔴 LOW | anything else | |`);
  lines.push(``);
  lines.push(`> ⚠️ **Do NOT lock these thresholds against this report.** Purpose is to observe scorer behaviour against real candidates, not to invent numbers. Philip 2026-08-23.`);
  lines.push(``);
  lines.push(`> ⚠️ **Nothing is auto-activated.** The scorer runs and records · Factory activation (Phase 3) is not yet built · kill switch would be OFF by default even when it is.`);
  lines.push(``);

  // Natural gap analysis
  const scored = rows.filter((r) => r.quality_score !== null);
  if (scored.length >= 2) {
    lines.push(`## Natural score gap analysis`);
    lines.push(``);
    lines.push(`Sorted by \`quality_score\` DESC. Largest adjacent gap suggests a natural threshold.`);
    lines.push(``);
    lines.push(`| Rank | proposed_id | quality | safety | tier | gap to next |`);
    lines.push(`|---|---|---|---|---|---|`);
    const sorted = [...scored].sort((a, b) => Number(b.quality_score) - Number(a.quality_score));
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const next = sorted[i + 1];
      const gap = next ? (Number(r.quality_score) - Number(next.quality_score)).toFixed(4) : "—";
      lines.push(`| ${i + 1} | \`${r.proposed_category_id}\` | ${Number(r.quality_score).toFixed(4)} | ${Number(r.safety_score).toFixed(4)} | ${tierEmoji(r.provisional_tier)} ${r.provisional_tier} | ${gap} |`);
    }
    lines.push(``);
  }

  // Per-candidate detail
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Per-candidate detail`);
  lines.push(``);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    lines.push(`### Candidate ${i + 1} · \`${r.proposed_category_id}\` (${r.suggested_parent_vertical})`);
    lines.push(``);
    lines.push(`- **Candidate id:** \`${r.candidate_id}\``);
    lines.push(`- **Countries:** ${(r.suggested_countries ?? []).join(", ") || "(none)"}`);
    lines.push(`- **Proposed by:** \`${r.proposed_by}\``);
    lines.push(`- **Candidate created:** ${new Date(r.candidate_created_at).toISOString()}`);
    lines.push(`- **Admin decision:** \`${r.admin_decision}\``);
    if (r.admin_reviewed_by) {
      lines.push(`- **Human reviewer:** \`${r.admin_reviewed_by}\` at ${r.admin_reviewed_at ? new Date(r.admin_reviewed_at).toISOString() : "(unknown)"}`);
      if (r.admin_notes) lines.push(`- **Human notes:** ${r.admin_notes}`);
    }
    lines.push(``);

    if (!r.quality_score) {
      lines.push(`> ⚠️ **NOT YET SCORED.** Run the score recorder against this candidate.`);
      lines.push(``);
      continue;
    }

    lines.push(`#### Score`);
    lines.push(`| | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Quality score | **${Number(r.quality_score).toFixed(4)}** |`);
    lines.push(`| Safety score | **${Number(r.safety_score).toFixed(4)}** |`);
    lines.push(`| Provisional tier | ${tierEmoji(r.provisional_tier)} **${r.provisional_tier}** |`);
    lines.push(`| Primary hazard | ${r.primary_hazard ?? "(none)"} |`);
    lines.push(`| Scorer version | \`${r.scorer_version}\` |`);
    lines.push(`| Scored at | ${new Date(r.score_computed_at).toISOString()} |`);
    lines.push(``);

    lines.push(`#### Signals (all 14 Era-1 inputs)`);
    lines.push(`| Signal | Value |`);
    lines.push(`|---|---|`);
    for (const [k, v] of Object.entries(r.signals ?? {})) {
      lines.push(`| \`${k}\` | ${formatVal(v)} |`);
    }
    lines.push(``);

    lines.push(`#### Quality breakdown (weighted contributions)`);
    lines.push(`| Signal | Weight | Raw | Contribution |`);
    lines.push(`|---|---|---|---|`);
    for (const [k, v] of Object.entries(r.quality_breakdown ?? {})) {
      lines.push(`| ${k} | ${v.weight} | ${v.raw} | ${v.contribution} |`);
    }
    lines.push(``);

    if (Object.keys(r.safety_breakdown ?? {}).length > 0) {
      lines.push(`#### Safety penalties applied`);
      lines.push(`| Penalty | Multiplier | Reason |`);
      lines.push(`|---|---|---|`);
      for (const [k, v] of Object.entries(r.safety_breakdown)) {
        lines.push(`| ${k} | ${v.multiplier} | ${v.reason} |`);
      }
      lines.push(``);
    } else {
      lines.push(`#### Safety penalties applied`);
      lines.push(`_(none · safety_score = 1.0)_`);
      lines.push(``);
    }

    lines.push(`#### Evidence`);
    lines.push("```json");
    lines.push(JSON.stringify(r.evidence, null, 2));
    lines.push("```");
    lines.push(``);

    const businesses = Array.isArray(r.discovered_businesses) ? r.discovered_businesses.slice(0, 8) : [];
    if (businesses.length > 0) {
      lines.push(`#### Sample businesses (${businesses.length}/${Array.isArray(r.discovered_businesses) ? r.discovered_businesses.length : 0})`);
      for (const b of businesses) {
        lines.push(`- \`${b.business_ref ?? "?"}\` — ${b.name ?? ""}${b.city ? ` (${b.city})` : ""}${b.source_reference ? ` · ${b.source_reference}` : ""}`);
      }
      lines.push(``);
    }

    lines.push(`#### Human calibration question`);
    lines.push(`> Would you actually trust NEX to create the directory \`/${r.proposed_category_id}\` automatically for ${r.suggested_countries.join(", ")} · vertical=${r.suggested_parent_vertical}?  ${tierEmoji(r.provisional_tier)} scorer says **${r.provisional_tier}**.`);
    lines.push(``);

    const annotations = Array.isArray(r.annotations) ? r.annotations : [];
    if (annotations.length > 0) {
      lines.push(`#### Calibration annotations · human verdicts`);
      lines.push(`| Annotator | Verdict | Reason | When |`);
      lines.push(`|---|---|---|---|`);
      for (const a of annotations) {
        const agree = a.verdict === r.provisional_tier ? "✅ agrees" : "⚠️ disagrees";
        lines.push(`| \`${a.annotator}\` | ${tierEmoji(a.verdict)} **${a.verdict}** (${agree}) | ${a.reason ?? "_(none)_"} | ${a.annotated_at ? new Date(a.annotated_at).toISOString() : "—"} |`);
      }
      lines.push(``);
    } else {
      lines.push(`_No calibration annotations yet · annotate via_ \`node --env-file=.env.local scripts/nex-factory/annotate-candidate.mjs --candidate-id=${r.candidate_id} --verdict=HIGH|MEDIUM|LOW|SKIP --annotator=<name> --reason="..."\``);
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(``);
  }

  // Agreement summary at the bottom (only if annotations exist).
  const scoredWithAnnotations = rows.filter((r) => r.provisional_tier && Array.isArray(r.annotations) && r.annotations.length > 0);
  if (scoredWithAnnotations.length > 0) {
    let agreeCount = 0;
    let disagreeCount = 0;
    for (const r of scoredWithAnnotations) {
      // Take the LATEST annotation per candidate as "the human's current position."
      const latest = [...r.annotations].sort((a, b) => new Date(b.annotated_at) - new Date(a.annotated_at))[0];
      if (latest.verdict === r.provisional_tier) agreeCount += 1;
      else disagreeCount += 1;
    }
    lines.push(`## Scorer-vs-annotator agreement (using latest annotation per candidate)`);
    lines.push(``);
    lines.push(`- Candidates with annotations: **${scoredWithAnnotations.length}**`);
    lines.push(`- Scorer verdict matches annotator: **${agreeCount}**`);
    lines.push(`- Scorer verdict disagrees: **${disagreeCount}**`);
    if (disagreeCount > 0) {
      lines.push(``);
      lines.push(`**Disagreements deserve inspection — those are the calibration signal.**`);
    }
    lines.push(``);
  }

  // Obvious anomalies section
  const anomalies = detectAnomalies(rows);
  if (anomalies.length > 0) {
    lines.push(`## Obvious anomaly callouts`);
    lines.push(``);
    for (const a of anomalies) lines.push(`- ${a}`);
    lines.push(``);
  }

  lines.push(`## What to do with this report`);
  lines.push(``);
  lines.push(`1. Read each candidate's "Human calibration question" and jot your own verdict (approve as HIGH · approve as MEDIUM · reject).`);
  lines.push(`2. Compare your verdict to the scorer's provisional tier.`);
  lines.push(`3. Look at the "Natural score gap analysis" — is there a clean quality/safety gap between the candidates you'd approve as HIGH vs those you'd send to MEDIUM?`);
  lines.push(`4. If the gap is clean, that's your calibrated HIGH threshold. Encode it in a doctrine amendment; do NOT hot-patch the code.`);
  lines.push(`5. Same for MEDIUM vs LOW.`);
  lines.push(``);
  lines.push(`Until Philip explicitly approves calibrated thresholds, Phase 3 stays not-started and no candidate is auto-activated.`);
  lines.push(``);

  return lines.join("\n");
}

function tierEmoji(tier) {
  if (tier === "HIGH")   return "🟢";
  if (tier === "MEDIUM") return "🟡";
  if (tier === "LOW")    return "🔴";
  return "⚪";
}

function formatVal(v) {
  if (v === null || v === undefined) return "_null_";
  if (typeof v === "boolean") return v ? "✅ true" : "❌ false";
  if (typeof v === "number") return v.toString();
  if (typeof v === "object") return "`" + JSON.stringify(v) + "`";
  return String(v);
}

function detectAnomalies(rows) {
  const out = [];
  for (const r of rows) {
    if (!r.quality_score) continue;
    if (r.provisional_tier === "HIGH" && r.business_count < 100) {
      out.push(`🚩 candidate \`${r.proposed_category_id}\` is HIGH but has only ${r.business_count} businesses — check for false-HIGH.`);
    }
    if (r.provisional_tier === "LOW" && r.business_count > 500) {
      out.push(`🚩 candidate \`${r.proposed_category_id}\` is LOW despite ${r.business_count} businesses — check for false-LOW (primary hazard: ${r.primary_hazard}).`);
    }
    if (r.provisional_tier === "HIGH" && (r.signals?.cycle_count ?? 0) < 3) {
      out.push(`🚩 candidate \`${r.proposed_category_id}\` is HIGH after only ${r.signals?.cycle_count} cycles — very fresh evidence.`);
    }
  }
  return out;
}

main().catch((err) => {
  console.error(`FATAL: ${err?.stack ?? err}`);
  pool.end().finally(() => process.exit(1));
});
