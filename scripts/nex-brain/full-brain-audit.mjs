// scripts/nex-brain/full-brain-audit.mjs
//
// READ-ONLY NEX Brain audit (Philip 2026-08-14). Produces a definitive
// answer to: "Has all intended NEX Brain data actually been processed,
// indexed, connected, and made callable by NEX — or is anything still
// sitting unprocessed, disconnected, queued, orphaned, or only stored
// as raw files?"
//
// NEVER modifies, deletes, migrates, re-scores, or fabricates any data.
// Observed numbers only. No estimation. No extrapolation.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const NEX = createClient(
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL,
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const TRADES = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const NEX_HOST = new URL(process.env.NEXT_PUBLIC_NEX_SUPABASE_URL).host;
const TRADES_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;

const REPORT = { sections: {}, B: [], C: [] };

// ─── section helpers ─────────────────────────────────────────────────
function section(name) {
  const bar = "─".repeat(72);
  console.log("");
  console.log(bar);
  console.log(`§ ${name}`);
  console.log(bar);
  REPORT.sections[name] = {};
  return REPORT.sections[name];
}
function print(k, v) {
  const line = `  ${String(k).padEnd(40)} ${v}`;
  console.log(line);
}
function flagB(item, reason, action) {
  REPORT.B.push({ item, reason, action });
  console.log(`  [B] ${item} · ${reason} · ${action}`);
}
function flagC(item, reason, action) {
  REPORT.C.push({ item, reason, action });
  console.log(`  [C] ${item} · ${reason} · ${action}`);
}

// ─── NEX Supabase probe ──────────────────────────────────────────────
async function probeTable(client, table) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, exists: false, err: error.message, code: error.code };
  return { table, exists: true, rows: count ?? 0 };
}

async function nexTableInventory() {
  const s = section("A · NEX Supabase table inventory (NEX project only)");
  const tables = [
    "directory_seeds",
    "nex_collection_url_queue",
    "nex_collection_fetch_errors",
    "nex_materials_boards",
    "nex_materials_measurements",
    "nex_materials_packs",
    "nex_materials_stock",
    "nex_materials_worker_links",
    "nex_events",
    "nex_contacts",
    "nex_refacing_cases",
    "nex_reference_images",
    "nex_membership_activations",
    "nex_chat_threads",
    "images_v3", // hero pool per memory
  ];
  const results = [];
  for (const t of tables) {
    const r = await probeTable(NEX, t);
    results.push(r);
    if (r.exists) print(t, `${r.rows} row(s)`);
    else print(t, `MISSING (${r.code ?? r.err ?? "?"})`);
  }
  s.tables = results;
  return results;
}

// ─── Directory seeds detail ──────────────────────────────────────────
async function directorySeedDetail() {
  const s = section("B · directory_seeds detail");
  const { data, error } = await NEX
    .from("directory_seeds")
    .select("id, admin_ref, name, category, refacing_qualification, directory_state, lifecycle_status, verified, claimed, primary_trade, capabilities, created_at");
  if (error) {
    print("query error", error.message);
    s.error = error.message;
    return s;
  }
  const total = data.length;
  const byCategory = {};
  const byState = {};
  const byQual = {};
  const byClass = { BOTH: 0, REFACING: 0, MANUFACTURE: 0, INSTALLER: 0, SUPPLIER: 0, NEEDS_REVIEW: 0, NOT_RELEVANT: 0, unknown: 0 };
  let noCapabilities = 0, noEmail = 0, noPhone = 0, noWebsite = 0;
  for (const r of data) {
    byCategory[r.category ?? "(null)"] = (byCategory[r.category ?? "(null)"] ?? 0) + 1;
    byState[r.directory_state ?? "(null)"] = (byState[r.directory_state ?? "(null)"] ?? 0) + 1;
    byQual[r.refacing_qualification ?? "(null)"] = (byQual[r.refacing_qualification ?? "(null)"] ?? 0) + 1;
    const caps = r.capabilities ?? {};
    const capKeys = typeof caps === "object" && caps !== null ? Object.keys(caps) : [];
    if (capKeys.length === 0) noCapabilities += 1;
  }
  // Duplicate detection · same name or website within category
  const seenName = new Map(), seenSite = new Map(), dupNames = 0, dupSites = 0;
  for (const r of data) {
    if (r.name) {
      const k = `${r.category}::${r.name.toLowerCase()}`;
      seenName.set(k, (seenName.get(k) ?? 0) + 1);
    }
  }
  const nameDups = [...seenName.entries()].filter(([, n]) => n > 1);

  print("total seeds", total);
  print("by category", JSON.stringify(byCategory));
  print("by directory_state", JSON.stringify(byState));
  print("by refacing_qualification", JSON.stringify(byQual));
  print("seeds with 0 capabilities", noCapabilities);
  print("name+category duplicate groups", nameDups.length);
  s.total = total; s.byCategory = byCategory; s.byState = byState; s.byQual = byQual;
  s.noCapabilities = noCapabilities; s.dupNameGroups = nameDups.length;

  if (noCapabilities > 0) flagB("directory_seeds with 0 capabilities", `${noCapabilities} seed(s)`, "extractor should populate capabilities · check whether these predate the multi-service classifier");
  if (nameDups.length > 0) flagB("directory_seeds name+category duplicates", `${nameDups.length} group(s)`, "review; may require merge via mergeCapabilitiesIntoSeed");
  return s;
}

// ─── URL queue detail (both campaigns) ───────────────────────────────
async function urlQueueDetail() {
  const s = section("C · nex_collection_url_queue detail (per campaign)");
  const campaigns = ["staircase_refacing", "staircase_manufacture"];
  s.campaigns = {};
  for (const c of campaigns) {
    const { data, error } = await NEX
      .from("nex_collection_url_queue")
      .select("id, status, kind, classification, confidence_score, result_listing_id, refacing_qualification, processing_started_at");
    if (error) { print(c + " error", error.message); continue; }
    // Filter on client side because we selected everything (need to sum both campaigns anyway)
  }
  // Do it properly · one query per campaign
  for (const c of campaigns) {
    const { data, error } = await NEX
      .from("nex_collection_url_queue")
      .select("id, status, kind, classification, confidence_score, result_listing_id, processing_started_at")
      .eq("collection_type", c);
    if (error) { print(c + " error", error.message); s.campaigns[c] = { err: error.message }; continue; }
    const byStatus = {}, byKind = {}, byClass = {};
    let candidateNonFailed = 0, verifiedReachablePool = 0;
    let completedWithoutClass = 0, completedWithoutListing = 0, stuckProcessing = 0;
    const now = Date.now();
    for (const r of data) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byKind[r.kind ?? "?"] = (byKind[r.kind ?? "?"] ?? 0) + 1;
      byClass[r.classification ?? "unclassified"] = (byClass[r.classification ?? "unclassified"] ?? 0) + 1;
      if (r.kind === "candidate" && r.status !== "failed") candidateNonFailed += 1;
      if (r.kind === "candidate" && ["queued", "completed", "duplicate", "needs_review"].includes(r.status)) verifiedReachablePool += 1;
      if (r.status === "completed" && !r.classification) completedWithoutClass += 1;
      if (r.status === "completed" && !r.result_listing_id) completedWithoutListing += 1;
      if (r.status === "processing" && r.processing_started_at) {
        const age = now - new Date(r.processing_started_at).getTime();
        if (age > 30 * 60_000) stuckProcessing += 1;
      }
    }
    const campaign = { total: data.length, byStatus, byKind, byClass, candidateNonFailed, verifiedReachablePool, completedWithoutClass, completedWithoutListing, stuckProcessing };
    s.campaigns[c] = campaign;
    print(c + " total", data.length);
    print("  byStatus", JSON.stringify(byStatus));
    print("  byKind", JSON.stringify(byKind));
    print("  byClassification", JSON.stringify(byClass));
    print("  verified-reachable pool (candidate · non-failed)", candidateNonFailed);
    print("  completed with classification", (byStatus.completed ?? 0) - completedWithoutClass);
    print("  completed WITHOUT classification", completedWithoutClass);
    print("  completed with result_listing_id", (byStatus.completed ?? 0) - completedWithoutListing);
    print("  completed WITHOUT result_listing_id", completedWithoutListing);
    print("  processing rows stuck > 30min", stuckProcessing);

    if (completedWithoutClass > 0) flagC(`${c} · completed without classification`, `${completedWithoutClass} row(s)`, "worker completed fetch but classifier didn't run — orphaned in pipeline");
    if (completedWithoutListing > 0) flagB(`${c} · completed without result_listing_id`, `${completedWithoutListing} row(s)`, "worker completed but didn't persist a directory_seed — review why");
    if (stuckProcessing > 0) flagC(`${c} · rows stuck in processing >30min`, `${stuckProcessing} row(s)`, "run recover-stuck-once.mjs or wait for auto-recovery batch start");
  }
  return s;
}

// ─── Fetch errors detail ─────────────────────────────────────────────
async function fetchErrorsDetail() {
  const s = section("D · nex_collection_fetch_errors detail");
  const { data, error, count } = await NEX
    .from("nex_collection_fetch_errors")
    .select("*", { count: "exact" });
  if (error) { print("error", error.message); s.err = error.message; return s; }
  const byCat = {}, deadCount = data.filter((r) => r.dead).length;
  for (const r of data) byCat[r.error_category ?? "(null)"] = (byCat[r.error_category ?? "(null)"] ?? 0) + 1;
  print("total rows", count);
  print("by error_category", JSON.stringify(byCat));
  print("marked dead (attempt_count >= 3)", deadCount);
  s.total = count; s.byCategory = byCat; s.dead = deadCount;
  return s;
}

// ─── Image manifest audit ────────────────────────────────────────────
function imageManifestAudit() {
  const s = section("E · Image Brain · nex-image-manifest.json");
  const MANI = join(process.cwd(), "data", "nex-image-manifest.json");
  if (!existsSync(MANI)) { print("manifest", "MISSING"); flagC("nex-image-manifest.json", "missing", "restore from backup"); return s; }
  const mani = JSON.parse(readFileSync(MANI, "utf8"));
  const urls = Object.keys(mani.images ?? {});
  const total = urls.length;
  let onImageKit = 0, onTradesSupa = 0, onNexSupa = 0, otherHost = 0;
  let missingPrimaryBrain = 0, missingDnaScore = 0, missingTags = 0, notAStaircase = 0, aPlus = 0;
  let anyValidationFlag = 0, criticalFlag = 0;
  const byBrain = {};
  const hostSample = new Set();
  for (const u of urls) {
    let host = "?"; try { host = new URL(u).host; } catch {}
    hostSample.add(host);
    if (host === "ik.imagekit.io") onImageKit += 1;
    else if (host === TRADES_HOST) onTradesSupa += 1;
    else if (host === NEX_HOST) onNexSupa += 1;
    else otherHost += 1;
    const m = mani.images[u] ?? {};
    if (!m.primary_brain) missingPrimaryBrain += 1;
    if (!m.image_dna || (m.image_dna.score ?? 0) === 0) missingDnaScore += 1;
    if (!m.tags || m.tags.length === 0) missingTags += 1;
    if (m.not_a_staircase) notAStaircase += 1;
    if (m.a_plus) aPlus += 1;
    const flags = m.validation_flags ?? [];
    if (flags.length) {
      anyValidationFlag += 1;
      if (flags.some((f) => f.severity === "critical")) criticalFlag += 1;
    }
    const b = m.primary_brain ?? "(null)";
    byBrain[b] = (byBrain[b] ?? 0) + 1;
  }
  print("total URLs", total);
  print("hosts", JSON.stringify({ ik: onImageKit, trades: onTradesSupa, nex: onNexSupa, other: otherHost }));
  print("by primary_brain", JSON.stringify(byBrain));
  print("a_plus (A+ tagged)", aPlus);
  print("missing primary_brain", missingPrimaryBrain);
  print("missing image_dna.score (=0)", missingDnaScore);
  print("missing tags", missingTags);
  print("not_a_staircase (Brain-Isolation flag)", notAStaircase);
  print("rows with any validation_flag", anyValidationFlag);
  print("rows with CRITICAL validation_flag", criticalFlag);

  s.total = total; s.hosts = { ik: onImageKit, trades: onTradesSupa, nex: onNexSupa, other: otherHost };
  s.byBrain = byBrain; s.aPlus = aPlus; s.missingPrimaryBrain = missingPrimaryBrain;
  s.missingDnaScore = missingDnaScore; s.missingTags = missingTags;
  s.notAStaircase = notAStaircase; s.anyValidationFlag = anyValidationFlag; s.criticalFlag = criticalFlag;

  if (onTradesSupa > 0) flagC("Image manifest URLs on TRADES Supabase", `${onTradesSupa} url(s)`, "run scripts/nex-brain/migrate-127-to-imagekit.mjs (needs ImageKit credentials in .env.local)");
  if (missingPrimaryBrain > 0) flagB("Image manifest rows with primary_brain=null", `${missingPrimaryBrain} row(s)`, "cannot route via ADR-0033 Rule #6 — must be classified into a specific Brain before intelligence retrieval");
  if (criticalFlag > 0) flagB("Image manifest rows with critical validation flags", `${criticalFlag} row(s)`, "resolve missing DNA / low confidence per ADR-0027");
  if (missingTags > 0) flagB("Image manifest rows without tags", `${missingTags} row(s)`, "matcher relies on tag intersection · rows without tags won't surface in tag-based retrieval (still may via primary_brain)");
  return s;
}

// ─── Reference Brain drafts audit ────────────────────────────────────
function referenceBrainAudit() {
  const s = section("F · Reference Brain · data/nex-reference-brains");
  const ROOT = join(process.cwd(), "data", "nex-reference-brains");
  if (!existsSync(ROOT)) { print("root", "MISSING"); flagC("nex-reference-brains root", "missing", "restore"); return s; }
  function walk(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      let entries; try { entries = readdirSync(cur); } catch { continue; }
      for (const e of entries) {
        const p = join(cur, e);
        let st; try { st = statSync(p); } catch { continue; }
        if (st.isDirectory()) stack.push(p);
        else if (st.isFile() && p.endsWith(".md")) out.push({ path: p, size: st.size });
      }
    }
    return out;
  }
  const files = walk(ROOT);
  const byTopDir = {};
  for (const f of files) {
    const rel = f.path.substring(ROOT.length + 1);
    const top = rel.split(/[\\\/]/)[0];
    byTopDir[top] = (byTopDir[top] ?? 0) + 1;
  }
  print("total markdown files", files.length);
  print("by top directory", JSON.stringify(byTopDir));
  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  print("total size", (totalBytes / 1024).toFixed(1) + " KB");
  s.totalMarkdown = files.length; s.byTopDir = byTopDir; s.totalBytes = totalBytes;
  // The connectivity part is handled by the sub-agent.
  return s;
}

// ─── directory-seeds/ file cache audit ───────────────────────────────
function directorySeedFilesAudit() {
  const s = section("G · data/directory-seeds/ file cache");
  const ROOT = join(process.cwd(), "data", "directory-seeds");
  if (!existsSync(ROOT)) { print("root", "MISSING"); return s; }
  const cats = readdirSync(ROOT).filter((e) => statSync(join(ROOT, e)).isDirectory());
  const byCat = {};
  for (const c of cats) {
    const files = readdirSync(join(ROOT, c)).filter((f) => f.endsWith(".json"));
    byCat[c] = files.length;
    print("  " + c, files.length + " file(s)");
  }
  s.byCategory = byCat;
  return s;
}

// ─── Supabase-client-routing audit (existing script surface) ─────────
async function runRoutingAuditScript() {
  const s = section("H · Supabase-client-routing audit (existing script)");
  print("script", "scripts/nex-brain/audit-supabase-client-usage.mjs");
  print("note", "run separately with: npm run nex:audit-supabase-routing");
  s.note = "run npm run nex:audit-supabase-routing to see live output";
  return s;
}

// ─── Trades-project contamination check (data-side) ──────────────────
async function tradesContaminationCheck() {
  const s = section("I · TRADES-project · check any NEX table still hosts data there");
  const nexTables = [
    "directory_seeds", "nex_collection_url_queue", "nex_collection_fetch_errors",
    "nex_events", "nex_contacts", "nex_refacing_cases", "nex_reference_images",
    "nex_membership_activations", "nex_chat_threads",
    "nex_materials_boards", "nex_materials_measurements", "nex_materials_packs",
    "nex_materials_stock", "nex_materials_worker_links",
  ];
  const contamination = [];
  for (const t of nexTables) {
    const r = await probeTable(TRADES, t);
    if (r.exists && (r.rows ?? 0) > 0) {
      contamination.push({ table: t, rows: r.rows });
      print("CONTAMINATION", `${t} exists in TRADES with ${r.rows} rows`);
    } else if (r.exists) {
      // Empty shell — the 13 known ones flagged in an earlier session.
      print("empty shell", `${t} exists but has 0 rows (per prior session's cleanup SQL)`);
    }
  }
  if (contamination.length === 0) {
    print("verdict", "no NEX table in TRADES has any rows · clean per data-side");
  } else {
    for (const c of contamination) flagC(`TRADES-project NEX table with data: ${c.table}`, `${c.rows} rows`, "investigate before dropping · data would be lost");
  }
  s.contamination = contamination;
  return s;
}

// ─── Manifest / seeds cross-check ────────────────────────────────────
async function manifestVsSeedsCrossCheck() {
  const s = section("J · Cross-check · seeds without any Brain images vs manifest coverage");
  const { data, error } = await NEX
    .from("directory_seeds")
    .select("id, name, category");
  if (error) { print("error", error.message); return s; }
  print("directory_seeds probed", data.length);
  print("note", "per-seed image mapping is not stored in nex-image-manifest.json (which is a global brain, not per-company). No 'seeds without images' orphan check applies at this layer.");
  return s;
}

// ─── main ─────────────────────────────────────────────────────────────
console.log("=".repeat(72));
console.log("NEX BRAIN · FULL READ-ONLY AUDIT · 2026-08-14");
console.log("=".repeat(72));
console.log(`NEX project    : ${NEX_HOST}`);
console.log(`TRADES project : ${TRADES_HOST}`);

await nexTableInventory();
await directorySeedDetail();
await urlQueueDetail();
await fetchErrorsDetail();
imageManifestAudit();
referenceBrainAudit();
directorySeedFilesAudit();
await runRoutingAuditScript();
await tradesContaminationCheck();
await manifestVsSeedsCrossCheck();

// ─── Verdict ─────────────────────────────────────────────────────────
console.log("");
console.log("=".repeat(72));
console.log("VERDICT");
console.log("=".repeat(72));
console.log(`B · items present but incomplete/needing processing: ${REPORT.B.length}`);
console.log(`C · items broken/orphaned/disconnected             : ${REPORT.C.length}`);
console.log("");
if (REPORT.B.length) {
  console.log("─── B items ─────────────────────────────────────────────");
  for (const b of REPORT.B) console.log(`  · ${b.item}\n      reason: ${b.reason}\n      action: ${b.action}`);
  console.log("");
}
if (REPORT.C.length) {
  console.log("─── C items ─────────────────────────────────────────────");
  for (const c of REPORT.C) console.log(`  · ${c.item}\n      reason: ${c.reason}\n      action: ${c.action}`);
  console.log("");
}

const OUT = join(process.cwd(), "data", "audit", `nex-brain-full-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const { mkdirSync, writeFileSync } = await import("node:fs");
mkdirSync(join(process.cwd(), "data", "audit"), { recursive: true });
writeFileSync(OUT, JSON.stringify(REPORT, null, 2), "utf8");
console.log(`Full JSON report: ${OUT}`);

console.log("");
console.log("NOTE · code-connectivity survey runs separately (Explore sub-agent).");
console.log("       Final verdict combines both this audit + the connectivity report.");
