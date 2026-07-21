// Backfill embeddings for hammerex_knowledge_entries rows that
// have embedding IS NULL. Idempotent — safe to re-run.
//
// Usage: node scripts/backfill-knowledge-embeddings.mjs
// Requires: OPENAI_API_KEY + SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

// Load .env.local + .env.tools.local
for (const f of [".env.local", ".env.tools.local"]) {
  const p = path.join(process.cwd(), f);
  if (fs.existsSync(p)) {
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }
}

const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const SB_TOKEN     = process.env.SUPABASE_ACCESS_TOKEN;
const SB_REF       = process.env.SUPABASE_PROJECT_REF;

if (!OPENAI_KEY) { console.error("OPENAI_API_KEY missing — cannot embed."); process.exit(1); }
if (!SB_TOKEN || !SB_REF) { console.error("SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF missing."); process.exit(1); }

const SB_URL = `https://api.supabase.com/v1/projects/${SB_REF}/database/query`;

async function sql(query) {
  const res = await fetch(SB_URL, {
    method:  "POST",
    headers: { "Authorization": `Bearer ${SB_TOKEN}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`sql failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function embed(input) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
    body:    JSON.stringify({ model: "text-embedding-3-small", input, encoding_format: "float" })
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data.map(r => r.embedding);
}

function toVectorLiteral(v) { return "[" + v.map(n => n.toFixed(6)).join(",") + "]"; }

// SQL literal escape single quotes
function esc(s) { return String(s).replace(/'/g, "''"); }

async function main() {
  const rows = await sql(`
    select id, title, ai_summary, coalesce(detailed_explanation,'') as detail, video_tags, trade_slug, content_type
    from hammerex_knowledge_entries
    where embedding is null
    order by created_at
    limit 500
  `);

  if (rows.length === 0) {
    console.log("No entries need embedding. All done.");
    return;
  }

  console.log(`Embedding ${rows.length} entries...`);

  // Build embed inputs: title + summary + first ~1000 chars of detail + tags
  const inputs = rows.map(r =>
    [
      `[${r.trade_slug}/${r.content_type}]`,
      r.title,
      r.ai_summary,
      r.detail.slice(0, 1200),
      "Tags: " + (r.video_tags ?? []).join(", ")
    ].filter(Boolean).join("\n")
  );

  // Batch of 100 max per OpenAI request
  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < inputs.length; i += BATCH) {
    const chunk    = inputs.slice(i, i + BATCH);
    const chunkIds = rows.slice(i, i + BATCH).map(r => r.id);
    const vectors  = await embed(chunk);

    // Update rows — do it one-by-one via UPDATE (Postgres pgvector
    // via management API doesn't handle bulk cleanly).
    for (let j = 0; j < chunkIds.length; j++) {
      const id  = chunkIds[j];
      const vec = toVectorLiteral(vectors[j]);
      await sql(`update hammerex_knowledge_entries set embedding = '${vec}'::vector where id = '${id}'`);
      done++;
    }
    console.log(`  ${done} / ${inputs.length} embedded`);
  }

  console.log(`Done. Embedded ${done} entries.`);
}

main().catch(e => { console.error(e); process.exit(1); });
