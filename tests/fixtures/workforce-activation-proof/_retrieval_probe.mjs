// Conversational Retrieval Probe — audit whether agent-processed data
// is actually reachable by users asking questions in the NEX chat surface.
//
// SAFETY:
//   · READ-ONLY · uses the same retrieveKnowledge() function the chat
//     route (/api/nex-conv/chat) calls at runtime.
//   · No user session · no LLM composition · no state mutation.
//   · Reports per-question: hits · top score · top topic · which SOURCE
//     the record came from (walker · seed · promoted).
//
// This isolates the KNOWLEDGE RETRIEVAL hop of the audit path.
// It does NOT test intent classification, composition, or UI rendering —
// those are separate hops.
//
// USAGE: node tests/fixtures/workforce-activation-proof/_retrieval_probe.mjs

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

const TAX_URL = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!TAX_URL) {
  console.error("NEX_TAXONOMY_POSTGRES_URL missing · required for isolation");
  process.exit(2);
}
const INNER_ENV = { ...process.env, NEX_POSTGRES_URL: TAX_URL };

if (!process.env.__PROBE_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...INNER_ENV, __PROBE_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { retrieveKnowledge } = await import("../../../src/lib/nex/indonesia/knowledge.ts");
  const { retrieveDirectoryAsKnowledge } = await import("../../../src/lib/nex/indonesia/directory-knowledge.ts");

  // The 4 conversation tracks · verbatim from Philip's authorization message.
  const tracks = [
    {
      domain: "food",
      position: "restaurant_food",
      turns: [
        "What Indonesian food should I try if I like spicy seafood?",
        "Tell me about tuna.",
        "Could I export it?",
        "What about Japan?",
      ],
    },
    {
      domain: "hotels",
      position: "hotel_accommodation",
      turns: [
        "Find me somewhere to stay near Malioboro.",
        "Which one would you choose?",
        "What rooms does it have?",
        "Which is cheapest?",
      ],
    },
    {
      domain: "travel",
      position: "travel_transport",
      turns: [
        "I'm flying to Bali.",
        "Which airports could I use?",
        "What if I'm coming from Jakarta?",
      ],
    },
    {
      domain: "gym",
      position: "gym_fitness",
      turns: [
        "Find me a gym.",
        "Which ones are actually near me?",
        "Which would you choose for someone starting out?",
      ],
    },
  ];

  const results = [];
  for (const track of tracks) {
    for (let i = 0; i < track.turns.length; i++) {
      const q = track.turns[i];
      let seedHits = [];
      let dirHits = [];
      let err = null;
      try {
        seedHits = retrieveKnowledge(q, { market: "ID", limit: 6, minConfidence: 0.5 });
        dirHits = await retrieveDirectoryAsKnowledge(q, { market: "ID", perVerticalLimit: 2, timeoutMs: 2000 });
      } catch (e) {
        err = String(e?.message ?? e);
      }
      const seenIds = new Set(seedHits.map((h) => h.id));
      const hits = [...seedHits];
      for (const d of dirHits) {
        if (!seenIds.has(d.id)) { hits.push(d); seenIds.add(d.id); }
      }
      const top = hits[0] ?? null;
      const topDir = dirHits[0] ?? null;
      results.push({
        domain: track.domain,
        position: track.position,
        turn_index: i + 1,
        question: q,
        hits_count: hits.length,
        seed_hits: seedHits.length,
        directory_hits: dirHits.length,
        top_score: top?.score ?? null,
        top_topic: top?.topic ?? null,
        top_source: top?.source ?? null,
        top_walker_id: top?.walker_id ?? null,
        top_region: top?.region ?? null,
        top_content_preview: top?.content ? String(top.content).slice(0, 200) : null,
        top_directory_source: topDir?.source ?? null,
        top_directory_topic: topDir?.topic ?? null,
        top_directory_content_preview: topDir?.content ? String(topDir.content).slice(0, 200) : null,
        all_topics: hits.slice(0, 6).map((h) => `${h.topic}`),
        error: err,
      });
    }
  }

  const outPath = path.join(here, "_retrieval_probe.json");
  writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2) + "\n", "utf8");

  console.log("\n═══ CONVERSATIONAL RETRIEVAL PROBE ═══\n");
  let lastDomain = "";
  for (const r of results) {
    if (r.domain !== lastDomain) {
      console.log(`\n── ${r.domain.toUpperCase()} (${r.position}) ──`);
      lastDomain = r.domain;
    }
    const status = r.hits_count > 0 ? "🟢" : "⚫";
    console.log(`${status} T${r.turn_index}  "${r.question}"`);
    console.log(`   hits=${r.hits_count} (seed=${r.seed_hits} · directory=${r.directory_hits})  top=${r.top_topic ?? "(none)"}  src=${r.top_source ?? "(none)"}`);
    if (r.top_content_preview) console.log(`   preview: ${r.top_content_preview}`);
    if (r.top_directory_source) console.log(`   directory-top: ${r.top_directory_topic} · ${r.top_directory_content_preview}`);
    if (r.error) console.log(`   error: ${r.error}`);
  }
  console.log(`\n→ ${outPath}\n`);
}
