// Slice 4.1 · Part 1 READ-ONLY inventory of Project B
// Confirms pgcrypto schema layout + persister-chain digest references.
// NO MUTATIONS. Reports only.

import { readFileSync } from "node:fs";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(" Slice 4.1 · READ-ONLY inventory · Project B · " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── 1. Target identity ─────────────────────────────────────────────────────
const id = (await q(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`target · db=${id.db} · pg=${id.ver} · user=${id.usr}\n`);

// ─── 2. pgcrypto schema location on Project B ───────────────────────────────
console.log("─── § A · pgcrypto installation ───");
const ext = await q(`
  SELECT e.extname, n.nspname AS schema, e.extversion
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pgcrypto'
`);
console.log("pgcrypto rows:", JSON.stringify(ext, null, 2));

// ─── 3. Does public.digest exist? Does extensions.digest exist? ─────────────
console.log("\n─── § B · digest function resolution ───");
const digestFuncs = await q(`
  SELECT n.nspname AS schema, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'digest'
   ORDER BY n.nspname
`);
console.log("digest() functions:", JSON.stringify(digestFuncs, null, 2));

// ─── 4. Persister function body · confirm it still contains public.digest ──
console.log("\n─── § C · persist_to_food_business body inspection ───");
const persister = await q(`
  SELECT proname, prosecdef, proconfig,
         (SELECT rolname FROM pg_roles WHERE oid = proowner) AS owner,
         pg_get_functiondef(oid) AS body
    FROM pg_proc
   WHERE pronamespace = 'nex_workforce'::regnamespace
     AND proname = 'persist_to_food_business'
`);
if (persister.length === 0) {
  console.log("  persist_to_food_business NOT FOUND on Project B");
} else {
  const p = persister[0];
  console.log(`  owner:            ${p.owner}`);
  console.log(`  prosecdef:        ${p.prosecdef}`);
  console.log(`  proconfig:        ${JSON.stringify(p.proconfig)}`);
  // Extract all digest references
  const matches = [...p.body.matchAll(/(\w+\.)?digest\s*\(/g)];
  console.log(`  digest references found: ${matches.length}`);
  matches.forEach((m, i) => console.log(`    [${i}] "${m[0]}"`));
  // Extract SET search_path
  const spMatch = p.body.match(/SET\s+search_path\s*=\s*([^\n]+)/i);
  console.log(`  search_path:      ${spMatch ? spMatch[1].trim() : "(none captured)"}`);
}

// ─── 5. _crockford5 body inspection ─────────────────────────────────────────
console.log("\n─── § D · _crockford5 body inspection ───");
const crockford = await q(`
  SELECT proname, prosecdef, proconfig,
         (SELECT rolname FROM pg_roles WHERE oid = proowner) AS owner,
         pg_get_functiondef(oid) AS body
    FROM pg_proc
   WHERE pronamespace = 'nex_workforce'::regnamespace
     AND proname = '_crockford5'
`);
if (crockford.length === 0) {
  console.log("  _crockford5 NOT FOUND on Project B");
} else {
  const c = crockford[0];
  console.log(`  owner:            ${c.owner}`);
  console.log(`  prosecdef:        ${c.prosecdef}`);
  console.log(`  proconfig:        ${JSON.stringify(c.proconfig)}`);
  const matches = [...c.body.matchAll(/(\w+\.)?digest\s*\(/g)];
  console.log(`  digest references found: ${matches.length}`);
  matches.forEach((m, i) => console.log(`    [${i}] "${m[0]}"`));
  const spMatch = c.body.match(/SET\s+search_path\s*=\s*([^\n]+)/i);
  console.log(`  search_path:      ${spMatch ? spMatch[1].trim() : "(none captured)"}`);
}

// ─── 6. evidence_record CHECK constraint · uses bare digest ─────────────────
console.log("\n─── § E · evidence_record CHECK constraint ───");
const check = await q(`
  SELECT conname, pg_get_constraintdef(oid) AS defn
    FROM pg_constraint
   WHERE conrelid = 'nex_workforce.evidence_record'::regclass
     AND contype = 'c'
`);
console.log("CHECK constraints:", JSON.stringify(check, null, 2));

// ─── 7. Full function catalogue for nex_workforce ──────────────────────────
console.log("\n─── § F · all nex_workforce functions · security posture ───");
const allFns = await q(`
  SELECT p.proname,
         p.prosecdef,
         p.proconfig,
         (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
    FROM pg_proc p
   WHERE p.pronamespace = 'nex_workforce'::regnamespace
   ORDER BY p.proname
`);
console.log(JSON.stringify(allFns, null, 2));

// ─── 8. State snapshot · workforce OFF confirmations ──────────────────────
console.log("\n─── § G · workforce OFF · Project B verification ───");
const state = await q(`
  SELECT
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
    (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR query ILIKE '%nex_workforce%') AS wf_sessions,
    (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows
`);
console.log("state:", JSON.stringify(state[0], null, 2));

// ─── 9. Extensions schema owner + members ────────────────────────────────
console.log("\n─── § H · extensions schema (Supabase convention) ───");
const extSchema = await q(`
  SELECT n.nspname, r.rolname AS owner, n.nspacl::text AS acl
    FROM pg_namespace n
    JOIN pg_roles r ON r.oid = n.nspowner
   WHERE n.nspname IN ('extensions','public')
   ORDER BY n.nspname
`);
console.log(JSON.stringify(extSchema, null, 2));

console.log("\n═══════════════════════════════════════════════════════════════════════");
console.log(" READ-ONLY inventory complete · NO MUTATIONS PERFORMED");
console.log("═══════════════════════════════════════════════════════════════════════");
