#!/usr/bin/env node
// load-brain-package.mjs
//
// NEX Founding Reference Brain Package Loader (Philip 2026-07-28)
// ────────────────────────────────────────────────────────────────
// Operational utility · NOT a platform feature. Imports a Founding
// Reference Brain Package JSON into Supabase in a governance-safe
// sequence with cleanup-on-failure.
//
// Sequence:
//   1. Load + validate the package JSON (required fields, schema shape)
//   2. Check preconditions (brain not already present · or --force)
//   3. INSERT hammerex_nex_brains row
//   4. INSERT hammerex_nex_brain_certifications row
//   5. INSERT hammerex_nex_brain_versions row
//   6. UPDATE hammerex_nex_brains.current_version_id → new version
//   7. INSERT hammerex_nex_events row (import audit)
//   8. On any failure · roll back in reverse order + report
//
// Governance:
//   · Does NOT author trade knowledge · uses ONLY what's in the JSON.
//   · Refuses to overwrite existing brains unless --force is set.
//   · Every step logs so a partial failure is diagnosable.
//   · Uses SUPABASE_SERVICE_ROLE_KEY (server-side write).
//
// Usage:
//   node scripts/load-brain-package.mjs \
//     --package data/nex-reference-brains/staircase-founding-reference-brain-package-v0.1.0.json \
//     [--dry-run]     # validate only · no writes
//     [--force]       # allow overwriting existing brain (dangerous)
//     [--env .env.local]
//
// Env required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------- CLI ----------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) args[key] = true;
      else { args[key] = next; i++; }
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const PKG_PATH = args.package ?? "data/nex-reference-brains/staircase-founding-reference-brain-package-v0.1.0.json";
const DRY_RUN  = args["dry-run"] === true;
const FORCE    = args.force === true;
const ENV_FILE = args.env ?? ".env.local";

if (args.help || args.h) {
  console.log(readFileSync(new URL(import.meta.url), "utf-8").split("\n").filter(l => l.startsWith("//")).map(l => l.slice(3)).join("\n"));
  process.exit(0);
}

// ---------- Env loader (minimal · no dotenv dep) ----------

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv(resolve(process.cwd(), ENV_FILE));

// ---------- Validation ----------

function validatePackage(pkg) {
  const errors = [];
  if (!pkg || typeof pkg !== "object") { errors.push("package is not an object"); return errors; }
  if (!pkg.brain_row_upsert || typeof pkg.brain_row_upsert !== "object") errors.push("missing brain_row_upsert");
  else {
    const b = pkg.brain_row_upsert;
    for (const field of ["slug", "namespace", "display_name", "category"]) {
      if (!b[field]) errors.push(`brain_row_upsert.${field} missing`);
    }
    if (b.role && !["author", "reviewer", "admin", "system", "runtime"].includes(b.role)) {
      errors.push(`brain_row_upsert.role invalid: ${b.role}`);
    }
  }
  if (!pkg.initial_version || typeof pkg.initial_version !== "object") errors.push("missing initial_version");
  else {
    const v = pkg.initial_version;
    for (const field of ["version_semver", "authored_by", "manifest_json", "modules_json"]) {
      if (v[field] === undefined || v[field] === null) errors.push(`initial_version.${field} missing`);
    }
    if (v.version_semver && !/^\d+\.\d+\.\d+$/.test(v.version_semver)) errors.push(`version_semver malformed: ${v.version_semver}`);
  }
  // Cert is optional but recommended
  if (!pkg.initial_certification_row) {
    console.warn("⚠ No initial_certification_row · brain will start Uncertified (Maturity Level 2 max)");
  }
  return errors;
}

// ---------- Rollback tracker ----------

class Rollback {
  constructor(sb) { this.sb = sb; this.actions = []; }
  push(desc, undo) { this.actions.push({ desc, undo }); }
  async run() {
    console.log(`\n⚠ Rolling back ${this.actions.length} action(s)…`);
    while (this.actions.length > 0) {
      const { desc, undo } = this.actions.pop();
      try {
        await undo();
        console.log(`  ✓ Rolled back: ${desc}`);
      } catch (err) {
        console.error(`  ✗ Rollback failed for '${desc}': ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

// ---------- Main ----------

async function main() {
  console.log(`\n═════ NEX Founding Reference Brain Package Loader ═════`);
  console.log(`Package: ${PKG_PATH}`);
  if (DRY_RUN) console.log(`⚠ DRY RUN · validation only, no writes`);
  if (FORCE)   console.log(`⚠ FORCE · will overwrite existing brain if present`);
  console.log();

  // 1 · Load + validate
  const pkgPath = resolve(process.cwd(), PKG_PATH);
  if (!existsSync(pkgPath)) {
    console.error(`✗ Package file not found: ${pkgPath}`);
    process.exit(1);
  }
  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, "utf-8")); }
  catch (err) {
    console.error(`✗ Package JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  console.log(`✓ Package loaded (${(readFileSync(pkgPath).length / 1024).toFixed(1)} KB)`);

  const errors = validatePackage(pkg);
  if (errors.length > 0) {
    console.error(`✗ Package validation failed:`);
    for (const e of errors) console.error(`    · ${e}`);
    process.exit(1);
  }
  console.log(`✓ Package validated`);
  console.log(`   slug: ${pkg.brain_row_upsert.slug}`);
  console.log(`   namespace: ${pkg.brain_row_upsert.namespace}`);
  console.log(`   display_name: ${pkg.brain_row_upsert.display_name}`);
  console.log(`   version: ${pkg.initial_version.version_semver}`);
  console.log(`   modules: ${Object.keys(pkg.initial_version.modules_json).length}`);
  console.log(`   has_certification_row: ${!!pkg.initial_certification_row}`);

  if (DRY_RUN) {
    console.log(`\n✓ Dry run complete · package is valid`);
    return;
  }

  // 2 · Supabase connection
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (checked ${ENV_FILE})`);
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 3 · Precondition · does brain already exist?
  const slug = pkg.brain_row_upsert.slug;
  const { data: existing, error: existErr } = await sb.from("hammerex_nex_brains").select("slug, current_version_id").eq("slug", slug).maybeSingle();
  if (existErr) {
    console.error(`✗ Precondition check failed: ${existErr.message}`);
    process.exit(1);
  }
  if (existing) {
    if (!FORCE) {
      console.error(`✗ Brain '${slug}' already exists in hammerex_nex_brains. Refusing to overwrite.`);
      console.error(`  Use --force to proceed (DANGEROUS · will replace current_version_id + append version).`);
      process.exit(1);
    }
    console.warn(`⚠ Brain '${slug}' exists · --force enabled · will insert new version + reassign pointer`);
  }

  const rollback = new Rollback(sb);
  console.log(`\n═════ Applying package ═════`);

  try {
    // 4 · INSERT brain row (or skip if exists + force)
    if (!existing) {
      const { data, error } = await sb.from("hammerex_nex_brains").insert(pkg.brain_row_upsert).select("slug").single();
      if (error) throw new Error(`brain insert failed: ${error.message}`);
      rollback.push(`hammerex_nex_brains slug=${slug}`, async () => {
        await sb.from("hammerex_nex_brains").delete().eq("slug", slug);
      });
      console.log(`✓ hammerex_nex_brains · inserted ${data.slug}`);
    } else {
      console.log(`⏭ hammerex_nex_brains · slug=${slug} already exists · skipping insert (--force mode)`);
    }

    // 5 · INSERT certification row (if provided)
    let certId = null;
    if (pkg.initial_certification_row) {
      const certRow = { ...pkg.initial_certification_row, brain_slug: slug };
      const { data: cert, error: certErr } = await sb.from("hammerex_nex_brain_certifications").insert(certRow).select("id").single();
      if (certErr) throw new Error(`certification insert failed: ${certErr.message}`);
      certId = cert.id;
      rollback.push(`hammerex_nex_brain_certifications id=${certId}`, async () => {
        await sb.from("hammerex_nex_brain_certifications").delete().eq("id", certId);
      });
      console.log(`✓ hammerex_nex_brain_certifications · inserted ${certId}`);
    }

    // 6 · INSERT initial version row
    const versionRow = { ...pkg.initial_version, brain_slug: slug };
    // Add authored_at if missing
    if (!versionRow.authored_at) versionRow.authored_at = new Date().toISOString();
    // Mark as published immediately since this is the founding version
    if (!versionRow.published_at) versionRow.published_at = new Date().toISOString();
    if (!versionRow.published_by) versionRow.published_by = versionRow.authored_by;

    const { data: version, error: versionErr } = await sb.from("hammerex_nex_brain_versions").insert(versionRow).select("id, version_semver").single();
    if (versionErr) throw new Error(`version insert failed: ${versionErr.message}`);
    const versionId = version.id;
    rollback.push(`hammerex_nex_brain_versions id=${versionId}`, async () => {
      // Note: DELETE will hit the D4 trigger unless we set the session variable
      await sb.rpc("exec_sql", { sql: `SET LOCAL nex.permit_version_delete = 'true'; DELETE FROM public.hammerex_nex_brain_versions WHERE id = '${versionId}';` }).then(() => {}).catch(() => {
        // Fallback: try direct delete (will error if D4 trigger present without the session var)
        return sb.from("hammerex_nex_brain_versions").delete().eq("id", versionId);
      });
    });
    console.log(`✓ hammerex_nex_brain_versions · inserted ${versionId} (v${version.version_semver})`);

    // 7 · UPDATE brain pointer
    const { error: pointerErr } = await sb.from("hammerex_nex_brains").update({ current_version_id: versionId }).eq("slug", slug);
    if (pointerErr) throw new Error(`brain pointer update failed: ${pointerErr.message}`);
    console.log(`✓ hammerex_nex_brains.current_version_id → ${versionId}`);

    // 8 · Audit event
    const { error: eventErr } = await sb.from("hammerex_nex_events").insert({
      event_type: "brain_founding_package_loaded",
      entity_type: "brain",
      entity_id: slug,
      actor_id: "load-brain-package-script",
      actor_role: "system",
      before_json: existing ? { previous_version_id: existing.current_version_id } : null,
      after_json: {
        version_id: versionId,
        version_semver: version.version_semver,
        package_path: PKG_PATH,
        modules_count: Object.keys(pkg.initial_version.modules_json).length,
      },
      metadata: { certification_id: certId, force: FORCE },
    });
    if (eventErr) {
      // Audit failure is non-blocking · warn but don't rollback
      console.warn(`⚠ Audit event insert failed (non-blocking): ${eventErr.message}`);
    } else {
      console.log(`✓ hammerex_nex_events · logged brain_founding_package_loaded`);
    }

    console.log(`\n═════ Load complete ═════`);
    console.log(`  Brain:   ${slug}`);
    console.log(`  Version: ${version.version_semver} (${versionId})`);
    console.log(`  Modules: ${Object.keys(pkg.initial_version.modules_json).length}`);
    console.log(`  Cert:    ${certId ? "yes · " + certId : "no · brain will be Uncertified"}`);
    console.log(`\nNext: verify at /admin/brains/${slug}`);

  } catch (err) {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
    await rollback.run();
    process.exit(1);
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
