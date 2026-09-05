// World Adapter Probe — audit whether live directory data (hotels, gyms,
// food businesses, marketplace) is reachable via the Brain's world adapter.
//
// This isolates the LIVE-WORLD hop of the chat retrieval path.
// searchWorld() is what /api/nex-conv/chat calls when composed.world_cards
// gets populated.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

if (existsSync(path.join(repoRoot, ".env.local"))) {
  for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// world adapters read the LIVE nex.accommodation_business etc · use
// NEX_POSTGRES_URL as-is (NOT swapped for taxonomy).
if (!process.env.NEX_POSTGRES_URL) {
  console.error("NEX_POSTGRES_URL missing");
  process.exit(2);
}

if (!process.env.__WORLD_PROBE_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __WORLD_PROBE_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { searchWorld } = await import("../../../src/lib/nex/brain/world-adapters/index.ts");

  const tests = [
    // Raw multi-word user queries (test S2's defensive widening)
    { vertical: "accommodation", position: "hotel_accommodation", query: "hotel near Malioboro", city: "Yogyakarta", note: "raw-multi-word" },
    { vertical: "accommodation", position: "hotel_accommodation", query: "cheap guesthouse", city: "Yogyakarta", note: "raw-multi-word" },
    { vertical: "accommodation", position: "hotel_accommodation", query: "villa in Bali", city: "Denpasar", note: "raw-multi-word" },
    // Tokenized single-word queries (proves S2 widen works end-to-end)
    { vertical: "accommodation", position: "hotel_accommodation", query: "Malioboro", city: "Yogyakarta", note: "S2-tokenized" },
    { vertical: "accommodation", position: "hotel_accommodation", query: "Jakarta", note: "S2-tokenized" },
    { vertical: "service", position: "gym_fitness", query: "gym", category: "gyms", city: "Jakarta", note: "raw-worked-already" },
    { vertical: "service", position: "gym_fitness", query: "gym near me", category: "gyms", city: "Denpasar", note: "raw-multi-word" },
    { vertical: "service", position: "gym_fitness", query: "fitness", category: "gyms", note: "S2-tokenized" },
    { vertical: "food", position: "restaurant_food_business", query: "spicy seafood", city: "Yogyakarta", note: "raw-multi-word" },
    { vertical: "food", position: "restaurant_food_business", query: "warung", city: "Jakarta", note: "S2-tokenized" },
    { vertical: "commerce", position: "marketplace_commerce", query: "batik", note: "single-word" },
    { vertical: "transport", position: "travel_transport", query: "airport", city: "Denpasar", note: "S2-tokenized" },
  ];

  const results = [];
  for (const t of tests) {
    let out = null;
    let err = null;
    try {
      out = await searchWorld({
        vertical: t.vertical,
        market: "ID",
        query: t.query,
        category: t.category,
        city: t.city,
        limit: 3,
      });
    } catch (e) {
      err = String(e?.message ?? e);
    }
    results.push({
      vertical: t.vertical,
      position: t.position,
      query: t.query,
      city: t.city ?? null,
      category: t.category ?? null,
      note: t.note ?? null,
      returned: out?.records?.length ?? 0,
      total_available: out?.totalAvailable ?? null,
      latency_ms: out?.latencyMs ?? null,
      degraded_reason: out?.degradedReason ?? null,
      top_records: out?.records?.slice(0, 3).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        city: r.city,
        district: r.district ?? null,
        has_phone: !!r.phone,
        has_website: !!r.website,
        has_hero_image: !!r.heroImage,
      })) ?? [],
      error: err,
    });
  }

  const outPath = path.join(here, "_world_probe.json");
  writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2) + "\n", "utf8");

  console.log("\n═══ WORLD ADAPTER PROBE ═══\n");
  for (const r of results) {
    const status = r.returned > 0 ? "🟢" : r.degraded_reason ? "⚠" : "⚫";
    console.log(`${status} [${r.vertical}] "${r.query}"${r.city ? ` city=${r.city}` : ""}${r.category ? ` cat=${r.category}` : ""}${r.note ? ` · ${r.note}` : ""}`);
    console.log(`   returned=${r.returned}  total=${r.total_available}  latency=${r.latency_ms}ms  degraded=${r.degraded_reason ?? "no"}`);
    for (const rec of r.top_records) {
      console.log(`   · ${rec.name} (${rec.category}) · ${rec.city}${rec.district ? "/" + rec.district : ""}${rec.has_phone ? " · ☎" : ""}${rec.has_website ? " · 🌐" : ""}`);
    }
    if (r.error) console.log(`   error: ${r.error}`);
  }
  console.log(`\n→ ${outPath}\n`);
}
