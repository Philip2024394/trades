#!/usr/bin/env node
// scripts/nex-workforce/_image-rotation-tick.mjs
//
// NEX Directory Image Rotation Tick · Philip 2026-08-28.
//
// One tick = one walker cycle. Picks the (table, category, city) tuple with
// the most rows missing images that hasn't been imaged in the last ROTATION_
// COOLDOWN_MIN minutes, then spawns enrich-directory-images.mjs for it.
//
// Sweeps all food_business + accommodation_business categories × cities over
// time without hard-coding 80+ scheduler entries. Adding a new city is
// automatic — as soon as its rows exist, the tick finds them.
//
// Constitutional anchors:
//   · project_nex_cc_category_placeholder_imagery_2026_08_28.md
//   · project_nex_free_infrastructure_principle_2026_08_27.md
//
// Owner protection: walker itself skips owner-approved rows. Rotation tick
// only picks tuples where hero_image_url IS NULL AND hero_image_approved IS
// NOT TRUE actually exist.

import pg from "pg";
import { spawn } from "node:child_process";

const ROTATION_COOLDOWN_MIN = Number(process.env.NEX_IMAGE_ROTATION_COOLDOWN_MIN ?? 120); // 2h per tuple
const PER_CYCLE_LIMIT       = Number(process.env.NEX_IMAGE_PER_CYCLE_LIMIT ?? 25);

const TABLES = ["nex.food_business", "nex.accommodation_business"];

const pool = new pg.Pool({
  connectionString:
    process.env.NEX_POSTGRES_URL ??
    "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 1,
});

async function pickNext() {
  const client = await pool.connect();
  try {
    for (const table of TABLES) {
      const { rows } = await client.query(
        `
        WITH candidates AS (
          SELECT category, city, count(*) AS missing
          FROM ${table}
          WHERE hero_image_url IS NULL
            AND (hero_image_approved IS NOT TRUE)
            AND category IS NOT NULL
            AND city IS NOT NULL
          GROUP BY category, city
          HAVING count(*) > 0
        ),
        last_run AS (
          SELECT
            (summary->>'category') AS category,
            (summary->>'city')     AS city,
            max(started_at)        AS last_at
          FROM nex.worker_cycle_run
          WHERE worker_type = $1
            AND (summary->>'category') IS NOT NULL
            AND (summary->>'city') IS NOT NULL
          GROUP BY (summary->>'category'), (summary->>'city')
        )
        SELECT c.category, c.city, c.missing, lr.last_at
        FROM candidates c
        LEFT JOIN last_run lr USING (category, city)
        WHERE lr.last_at IS NULL
           OR lr.last_at < now() - ($2 || ' minutes')::interval
        ORDER BY c.missing DESC, lr.last_at NULLS FIRST
        LIMIT 1
        `,
        [`images:${table.replace("nex.", "")}`, ROTATION_COOLDOWN_MIN],
      );
      if (rows.length > 0) {
        return { table, category: rows[0].category, city: rows[0].city, missing: Number(rows[0].missing) };
      }
    }
    return null;
  } finally {
    client.release();
  }
}

function runWalker(pick) {
  return new Promise((resolve) => {
    const args = [
      "scripts/nex-workforce/enrich-directory-images.mjs",
      `--table=${pick.table}`,
      `--category=${pick.category}`,
      `--city=${pick.city}`,
      `--limit=${PER_CYCLE_LIMIT}`,
    ];
    console.log(`[image-rotation-tick] spawning · ${args.slice(1).join(" ")}`);
    const child = spawn("node", args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    const chunks = [];
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => chunks.push(c));
    child.on("close", (code) => {
      const outcome = code === 0 ? "OK" : "FAIL";
      console.log(`[image-rotation-tick] exit=${code} · ${outcome}`);
      if (code !== 0) {
        const tail = Buffer.concat(chunks).toString("utf8").split(/\r?\n/).filter(Boolean).slice(-15).join("\n");
        console.log(tail.split("\n").map((l) => `  ${l}`).join("\n"));
      }
      resolve();
    });
    child.on("error", (err) => {
      console.error(`[image-rotation-tick] spawn error · ${err.message}`);
      resolve();
    });
  });
}

async function main() {
  const pick = await pickNext();
  if (!pick) {
    console.log("[image-rotation-tick] no eligible (table, category, city) tuples · every candidate cycled within cooldown");
    await pool.end();
    return;
  }
  console.log(`[image-rotation-tick] pick · ${pick.table} · ${pick.category} · ${pick.city} · missing=${pick.missing}`);
  await pool.end();
  await runWalker(pick);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
