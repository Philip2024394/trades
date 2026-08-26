#!/usr/bin/env node
// scripts/nex-promotion/_analyse-current-scorer.mjs
//
// DRY-RUN ANALYSIS · no DB writes.
//
// Runs the existing scoreBusiness() (from quality-score.mjs) against all
// discovered food rows AND all accommodation rows (mapping accommodation
// columns into the FoodBusiness input shape). Reports:
//
//   · score distribution per vertical (bands ≥90 / 80-89 / 70-79 / 60-69 / 40-59 / <40)
//   · per-criterion earn rate (% of rows that earn each criterion's full points)
//   · per-criterion missing-point contribution (avg lost points per criterion · shows
//     which criteria are actually gating rows below 90)
//   · comparison table food vs accommodation
//
// Purpose: inform the redesign of the scorer for the ≥90 doctrine
// (project_nex_90pct_business_listing_doctrine_2026_08_23).
//
// Reads only · zero writes · zero mutations.

import pg from "pg";
import { scoreBusiness } from "./quality-score.mjs";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

async function loadFoodDiscovered() {
  const q = await pool.query(
    `SELECT public_listing_ref AS business_ref, business_name, category, categories,
            coordinates_lat, coordinates_lng, address, phone, whatsapp_number,
            website, public_social_links, last_verified_at
       FROM nex.food_business
      WHERE city='Yogyakarta' AND claim_status='discovered'`,
  );
  return q.rows;
}

async function loadAccommodationDiscovered() {
  // Column mapping: accommodation table uses `address` (not address_line_1)
  // and does have `phone` `whatsapp_number` `website` `public_social_links`
  // `categories[]` `last_verified_at` — same shape as food.
  const q = await pool.query(
    `SELECT public_listing_ref AS business_ref, business_name, category, categories,
            coordinates_lat, coordinates_lng, address, phone, whatsapp_number,
            website, public_social_links, last_verified_at
       FROM nex.accommodation_business
      WHERE city='Yogyakarta' AND claim_status='discovered'`,
  );
  return q.rows;
}

function analyse(rows, label) {
  const scores = [];
  const bands = { "ge_90": 0, "80_89": 0, "70_79": 0, "60_69": 0, "40_59": 0, "lt_40": 0 };
  const criteriaEarned = {
    name: 0, coord: 0, category: 0, addr_any: 0, addr_detail: 0,
    contact: 0, website: 0, social: 0, secondary: 0, freshness: 0,
  };
  const criteriaMissedContribution = { ...criteriaEarned };
  // The full weight of each criterion (in points) — for the "missed points" calc
  const criteriaMaxWeight = {
    name: 15, coord: 20, category: 10, addr_any: 5, addr_detail: 5,
    contact: 15, website: 10, social: 5, secondary: 5, freshness: 10,
  };

  for (const row of rows) {
    const { score, breakdown } = scoreBusiness(row);
    scores.push(score);

    if      (score >= 90) bands.ge_90++;
    else if (score >= 80) bands["80_89"]++;
    else if (score >= 70) bands["70_79"]++;
    else if (score >= 60) bands["60_69"]++;
    else if (score >= 40) bands["40_59"]++;
    else                  bands.lt_40++;

    for (const key of Object.keys(criteriaEarned)) {
      if (breakdown[key] === criteriaMaxWeight[key]) {
        criteriaEarned[key]++;
      } else {
        // Points missed for this criterion on this row
        criteriaMissedContribution[key] += (criteriaMaxWeight[key] - (breakdown[key] || 0));
      }
    }
  }

  const n = rows.length;
  const min = n > 0 ? Math.min(...scores) : null;
  const max = n > 0 ? Math.max(...scores) : null;
  const avg = n > 0 ? (scores.reduce((a, b) => a + b, 0) / n) : null;
  const median = n > 0 ? [...scores].sort((a, b) => a - b)[Math.floor(n / 2)] : null;

  return {
    label,
    n,
    scores: { min, max, avg: avg?.toFixed(1), median },
    bands,
    // Percent of rows earning each criterion in full
    criteriaEarnedPct: Object.fromEntries(
      Object.entries(criteriaEarned).map(([k, v]) => [k, n > 0 ? `${((v / n) * 100).toFixed(1)}%` : "-"]),
    ),
    // Points lost to each criterion averaged across all rows · sort DESC = biggest score-drag
    avgPointsLostPerCriterion: Object.fromEntries(
      Object.entries(criteriaMissedContribution)
        .map(([k, total]) => [k, n > 0 ? Number((total / n).toFixed(2)) : 0])
        .sort((a, b) => b[1] - a[1]),
    ),
  };
}

function fmtBands(bands) {
  return Object.entries(bands).map(([k, v]) => `${k.padEnd(6)}: ${String(v).padStart(4)}`).join("  ");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  CURRENT SCORER · DRY-RUN AGAINST REAL DATA · no writes                  ║");
  console.log("║  Doctrine: project_nex_90pct_business_listing_doctrine_2026_08_23        ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝");
  console.log("");

  const food  = await loadFoodDiscovered();
  const accom = await loadAccommodationDiscovered();

  const foodAnalysis  = analyse(food,  "food:Yogyakarta");
  const accomAnalysis = analyse(accom, "accommodation:Yogyakarta");

  for (const a of [foodAnalysis, accomAnalysis]) {
    console.log("═════════════════════════════════════════════════════════════════════════");
    console.log(`VERTICAL: ${a.label}   ·   rows: ${a.n}`);
    console.log("─────────────────────────────────────────────────────────────────────────");
    console.log(`  score min=${a.scores.min}  avg=${a.scores.avg}  median=${a.scores.median}  max=${a.scores.max}`);
    console.log(`  bands:  ${fmtBands(a.bands)}`);
    console.log("");
    console.log("  Criterion earn rate (% of rows earning full points):");
    for (const [k, v] of Object.entries(a.criteriaEarnedPct)) console.log(`    ${k.padEnd(12)} ${v}`);
    console.log("");
    console.log("  Avg points LOST per criterion (biggest drag on top):");
    for (const [k, v] of Object.entries(a.avgPointsLostPerCriterion)) console.log(`    ${k.padEnd(12)} -${v} pts avg`);
    console.log("");
  }

  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log("COMPARISON · food vs accommodation");
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log("  Criterion      food earn %    accommodation earn %");
  for (const k of Object.keys(foodAnalysis.criteriaEarnedPct)) {
    console.log(`    ${k.padEnd(12)} ${foodAnalysis.criteriaEarnedPct[k].padStart(8)}       ${accomAnalysis.criteriaEarnedPct[k].padStart(8)}`);
  }
  console.log("");
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log("BOTTOM LINE");
  console.log("─────────────────────────────────────────────────────────────────────────");
  const foodGe90 = foodAnalysis.bands.ge_90;
  const accomGe90 = accomAnalysis.bands.ge_90;
  console.log(`  Under CURRENT scorer + ≥90 rule:`);
  console.log(`    food would auto-list          : ${foodGe90} / ${foodAnalysis.n} rows`);
  console.log(`    accommodation would auto-list : ${accomGe90} / ${accomAnalysis.n} rows`);
  console.log(`    total auto-list candidates    : ${foodGe90 + accomGe90}`);
  console.log("");
  console.log("  The 'avg points LOST per criterion' block above shows exactly which");
  console.log("  criteria are gating rows below 90 — that's the input for the scorer redesign.");
  console.log("");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
