// scripts/nex-brain/enrichment-audit.mjs
//
// NEX Brain Enrichment Audit (Philip 2026-08-14).
//
// Governed by:
//   · project_nex_record_state_model_2026_08_14.md · RAW → PROCESSED → ENRICHED → VERIFIED → ROUTABLE
//   · project_nex_image_domain_rule_2026_08_14.md · every image gets a primary_domain
//   · project_nex_brain_confidence_rule_2026_08_13.md · never inflate · never fabricate
//   · feedback_nex_migration_verification_protocol_2026_08_14.md · dry-run first · sign-off before apply
//
// Objective: bring every legitimate NEX record as far as the available evidence
// allows. Never fabricate. Never silently discard.
//
// Runs DRY-RUN by default. --apply required to actually mutate.
//
// Usage:
//   node scripts/nex-brain/enrichment-audit.mjs                    # dry-run · shows what would change
//   node scripts/nex-brain/enrichment-audit.mjs --apply            # actually mutate manifest + seeds
//   node scripts/nex-brain/enrichment-audit.mjs --images-only      # skip seeds
//   node scripts/nex-brain/enrichment-audit.mjs --seeds-only       # skip images

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

const DRY = !process.argv.includes("--apply");
const IMAGES_ONLY = process.argv.includes("--images-only");
const SEEDS_ONLY = process.argv.includes("--seeds-only");

const NEX = createClient(
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL,
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

console.log("=".repeat(72));
console.log(`NEX BRAIN ENRICHMENT AUDIT ${DRY ? "· DRY RUN (no mutations)" : "· LIVE APPLY"}`);
console.log("=".repeat(72));

// ═══════════════════════════════════════════════════════════════════════
// IMAGE DOMAIN CLASSIFIER
// Uses ONLY existing evidence stored on the manifest row.
// Never fabricates. NEEDS_REVIEW when evidence is insufficient.
// ═══════════════════════════════════════════════════════════════════════

/** @param {object} m manifest row @returns {{domain:string, brain:string|null, reason:string}} */
function classifyImageDomain(m) {
  const subj = String(m.subject_domain ?? "").toLowerCase();
  const type = String(m.image_type ?? "").toLowerCase();
  const col  = String(m.collection_id ?? "").toLowerCase();
  const tags = Array.isArray(m.tags) ? m.tags.map((t) => String(t).toLowerCase()) : [];
  const memb = Array.isArray(m.collection_memberships) ? m.collection_memberships.map((s) => String(s).toLowerCase()) : [];
  const desc = String(m.description ?? "").toLowerCase();

  // Rule 1 — avatars (subject_domain OR image_type)
  if (subj === "avatar" || type === "avatar") {
    return { domain: "MARKETING", brain: "marketing_design_brain", reason: "avatar_asset" };
  }
  // Rule 2 — logos
  if (subj === "logo" || type === "logo") {
    return { domain: "MARKETING", brain: "marketing_design_brain", reason: "brand_logo" };
  }
  // Rule 3 — generic hero banner (labelled explicitly)
  if (subj === "hero-banner") {
    return { domain: "MARKETING", brain: "marketing_design_brain", reason: "generic_hero_banner" };
  }
  // Rule 4 — diagrams: too few · needs human eye
  if (subj === "diagram" || type === "diagram") {
    return { domain: "NEEDS_REVIEW", brain: null, reason: "diagram_needs_human_eye" };
  }
  // Rule 5 — explicitly excluded from staircase brain AND is hero/marketing collateral
  if (m.not_a_staircase === true && (type === "hero_image" || col === "hero_banner" || memb.includes("hero_images"))) {
    return { domain: "MARKETING", brain: "marketing_design_brain", reason: "not_a_staircase_hero_marketing_asset" };
  }
  // Rule 6 — kitchen content · (matches existing kitchen_brain-classified rows)
  if (subj === "kitchen" || tags.includes("kitchen") || col.includes("kitchen") || desc.includes("kitchen_")) {
    return { domain: "KITCHEN", brain: "kitchen_brain", reason: "kitchen_signal" };
  }
  // Rule 7 — timber-brain existing rows (5 rows have timber_brain today; preserve those)
  if (tags.includes("timber") && subj !== "staircase") {
    return { domain: "MATERIALS", brain: "timber_brain", reason: "timber_material_reference" };
  }
  // Rule 8 — garden staircase existing bucket
  if (tags.includes("garden") || tags.includes("outdoor") || col.includes("garden") || col.includes("outdoor")) {
    return { domain: "GARDEN", brain: "garden_staircase_brain", reason: "outdoor_garden_signal" };
  }
  // Rule 9 — staircase content · not excluded
  if (subj === "staircase" && m.not_a_staircase !== true) {
    // Prefer strong signals · staircase reference tag set, DNA score, description keyword
    const strongStaircase =
      tags.includes("staircase") ||
      desc.includes("staircase reference") ||
      desc.includes("staircase workshop") ||
      (m.image_dna?.score ?? 0) > 0;
    if (strongStaircase) return { domain: "STAIRCASE", brain: "staircase_brain", reason: "staircase_subject_domain_plus_signal" };
    return { domain: "STAIRCASE", brain: "staircase_brain", reason: "staircase_subject_domain_default" };
  }
  // Rule 10 — subject_domain=staircase BUT not_a_staircase=true and NOT hero/marketing → needs review
  if (subj === "staircase" && m.not_a_staircase === true) {
    return { domain: "NEEDS_REVIEW", brain: null, reason: "excluded_from_staircase_but_no_marketing_signal" };
  }
  // Default · unknown
  return { domain: "NEEDS_REVIEW", brain: null, reason: "no_matching_signal" };
}

// Cross-cutting: what's ROUTABLE at the image layer per the Record State Model?
//   RAW       — exists in manifest, no metadata
//   PROCESSED — has subject_domain / image_type / image_purpose from ingestion
//   ENRICHED  — has primary_domain assigned (+ primary_brain if the target brain exists)
//   ROUTABLE  — has primary_brain AND (has tags OR has strong DNA)
function imageRecordState(m) {
  const hasBasic = m.subject_domain || m.image_type || m.image_purpose;
  const hasBrain = !!m.primary_brain;
  const hasTagsOrDna = (Array.isArray(m.tags) && m.tags.length > 0) || (m.image_dna?.score ?? 0) > 0;
  if (!hasBasic) return "raw";
  if (!hasBrain) return "processed";
  if (!hasTagsOrDna) return "enriched";
  return "routable";
}

// ═══════════════════════════════════════════════════════════════════════
// IMAGE ENRICHMENT PASS
// ═══════════════════════════════════════════════════════════════════════

function imagePass() {
  console.log("");
  console.log("─".repeat(72));
  console.log("§ IMAGE BRAIN · Domain classification pass");
  console.log("─".repeat(72));

  const MANI_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
  const mani = JSON.parse(readFileSync(MANI_PATH, "utf8"));
  const entries = Object.entries(mani.images);

  const before = {
    byPrimaryBrain: {},
    byState: { raw: 0, processed: 0, enriched: 0, routable: 0 },
  };
  const proposed = {
    byDomain: {},
    byNewBrain: {},
    byReason: {},
    byState: { raw: 0, processed: 0, enriched: 0, routable: 0 },
  };
  const changes = [];
  const noOpKeepAsIs = [];

  for (const [url, m] of entries) {
    // BEFORE state
    before.byPrimaryBrain[m.primary_brain ?? "(null)"] =
      (before.byPrimaryBrain[m.primary_brain ?? "(null)"] ?? 0) + 1;
    before.byState[imageRecordState(m)] += 1;

    // Classify
    const c = classifyImageDomain(m);
    proposed.byDomain[c.domain] = (proposed.byDomain[c.domain] ?? 0) + 1;
    proposed.byNewBrain[c.brain ?? "(null)"] = (proposed.byNewBrain[c.brain ?? "(null)"] ?? 0) + 1;
    proposed.byReason[c.reason] = (proposed.byReason[c.reason] ?? 0) + 1;

    // Movement · only if this is a genuine change AND respects existing values
    const currentDomain = m.primary_domain ?? null;
    const currentBrain = m.primary_brain ?? null;
    const wouldChangeDomain = currentDomain !== c.domain;
    const wouldChangeBrain = c.brain && currentBrain !== c.brain;

    if (wouldChangeDomain || wouldChangeBrain) {
      // Never DOWNGRADE an existing primary_brain from a live brain to null.
      // Only set primary_brain if currently null, OR if the brain is the same.
      const applyBrain = !currentBrain || currentBrain === c.brain;
      changes.push({
        url,
        current_domain: currentDomain,
        proposed_domain: c.domain,
        current_brain: currentBrain,
        proposed_brain: applyBrain ? c.brain : currentBrain,
        reason: c.reason,
        respected_existing_brain: !applyBrain && !!currentBrain,
      });
    } else {
      noOpKeepAsIs.push(url);
    }

    // Compute AFTER state (assumes proposed changes applied)
    const afterM = { ...m, primary_domain: c.domain, primary_brain: c.brain ?? m.primary_brain };
    proposed.byState[imageRecordState(afterM)] += 1;
  }

  console.log("");
  console.log("BEFORE · by primary_brain:");
  for (const [k, n] of Object.entries(before.byPrimaryBrain).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
  console.log("");
  console.log("BEFORE · by state (Record State Model):");
  for (const k of ["raw", "processed", "enriched", "routable"]) console.log(`  ${String(before.byState[k]).padStart(5)}  ${k}`);
  console.log("");
  console.log("PROPOSED · Domain / Images / Status:");
  const statusOf = (d) => {
    if (d === "STAIRCASE") return "Active";
    if (d === "MARKETING") return "Active (cross-cutting)";
    if (d === "NEEDS_REVIEW") return "Human review";
    return "Future Brain";
  };
  for (const [d, n] of Object.entries(proposed.byDomain).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(16)} ${String(n).padStart(5)}   ${statusOf(d)}`);
  }
  console.log("");
  console.log("PROPOSED · by primary_brain (after apply · existing brains preserved):");
  for (const [k, n] of Object.entries(proposed.byNewBrain).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
  console.log("");
  console.log("PROPOSED · by state (Record State Model):");
  for (const k of ["raw", "processed", "enriched", "routable"]) console.log(`  ${String(proposed.byState[k]).padStart(5)}  ${k}`);
  console.log("");
  console.log("PROPOSED · classification reason breakdown:");
  for (const [r, n] of Object.entries(proposed.byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${r}`);
  }
  console.log("");
  console.log(`Total rows                       : ${entries.length}`);
  console.log(`Rows that would change           : ${changes.length}`);
  console.log(`Rows with respected-existing-brain (proposed brain differs but existing kept): ${changes.filter((c) => c.respected_existing_brain).length}`);
  console.log(`Rows already correctly classified: ${noOpKeepAsIs.length}`);

  // ─── APPLY (if not dry-run) ────────────────────────────────────────
  if (!DRY) {
    console.log("");
    console.log("─── APPLYING changes to manifest ───");
    let applied = 0;
    for (const ch of changes) {
      const m = mani.images[ch.url];
      m.primary_domain = ch.proposed_domain;
      // Only set primary_brain when it's currently null (never overwrite existing brain)
      if (!m.primary_brain && ch.proposed_brain) m.primary_brain = ch.proposed_brain;
      m._enrichment = {
        ...(m._enrichment ?? {}),
        domain_classified_at: new Date().toISOString(),
        domain_classified_reason: ch.reason,
      };
      applied += 1;
    }
    mani.generated_at = new Date().toISOString();
    writeFileSync(MANI_PATH, JSON.stringify(mani, null, 2), "utf8");
    console.log(`  ${applied} row(s) updated in manifest`);
  }

  return { entries: entries.length, changes: changes.length, byDomain: proposed.byDomain, byStateBefore: before.byState, byStateAfter: proposed.byState };
}

// ═══════════════════════════════════════════════════════════════════════
// DIRECTORY-SEED CAPABILITIES CLASSIFIER
// Derives capabilities from stored category + services text only.
// Never fabricates. Never invents contact info. Ambiguous → left alone.
// ═══════════════════════════════════════════════════════════════════════

/** @returns {Object.<string, true> | null} — null if no unambiguous signal */
function deriveCapabilitiesFromSeed(seed) {
  const cat = String(seed.category ?? "").toLowerCase();
  const svc = String(seed.services ?? "").toLowerCase();
  const text = `${cat} ${svc}`;
  const caps = {};

  // STAIRCASE domain — refacing / manufacture / joinery / balustrade
  if (/\brefac(e|ing)|refurb|renovat|revamp|makeover|restor(e|ation)/.test(text))
    caps["staircase_refacing"] = true;
  if (/\bmanufactur(er?|e|ing)|bespoke staircase|designer & manufacturer|design & manufacture/.test(text))
    caps["staircase_manufacture"] = true;
  if (/\bjoinery|bespoke joinery|carpenter/.test(text))
    caps["bespoke_joinery"] = true;
  if (/\bbalustrade/.test(text))
    caps["balustrade_manufacture"] = true;
  if (/\bhandrail/.test(text))
    caps["handrail_manufacture"] = true;
  if (/\bnewel/.test(text))
    caps["newel_manufacture"] = true;
  if (/\binstall(er|ation)?/.test(text))
    caps["installation"] = true;
  if (/\bstair parts|parts supplier|component supplier/.test(text))
    caps["staircase_parts_supply"] = true;
  if (/\bglass balustrade|glass staircase/.test(text))
    caps["glass_staircase"] = true;
  if (/\bspiral staircase/.test(text))
    caps["spiral_staircases"] = true;
  if (/\bhelical staircase/.test(text))
    caps["helical_staircases"] = true;
  if (/\bfloating staircase|cantilever staircase/.test(text))
    caps["floating_staircases"] = true;
  if (/\btimber staircase|wooden staircase|oak staircase/.test(text))
    caps["timber_staircases"] = true;
  if (/\bsteel staircase|metal staircase/.test(text))
    caps["steel_staircases"] = true;

  return Object.keys(caps).length > 0 ? caps : null;
}

// Category-to-campaign mapping · unambiguous only. Anything not listed here
// stays as-is (ambiguous → review, not a guess).
const CAMPAIGN_MAP_UNAMBIGUOUS = new Map([
  ["staircase refacing", "staircase_refacing"],
  ["bespoke staircase manufacturer", "staircase_manufacture"],
  ["staircase manufacturer", "staircase_manufacture"],
  ["bespoke staircase designer & manufacturer", "staircase_manufacture"],
  ["luxury staircase designer & manufacturer", "staircase_manufacture"],
  ["staircase manufacturer & joinery", "staircase_manufacture"],
  ["bespoke staircase manufacturer & joinery", "staircase_manufacture"],
  ["bespoke staircase & joinery manufacturer", "staircase_manufacture"],
  ["architectural joinery & bespoke staircase manufacturer", "staircase_manufacture"],
  ["staircase manufacturer & stair parts supplier", "staircase_manufacture"],
  ["staircase manufacturer & stair renovation specialist", "staircase_manufacture"],
]);

function seedCampaignFromCategory(seed) {
  const key = String(seed.category ?? "").toLowerCase().trim();
  return CAMPAIGN_MAP_UNAMBIGUOUS.get(key) ?? null; // null = leave ambiguous
}

function seedRecordState(seed) {
  // RAW       — exists but missing basic identity fields (business_name / category)
  // PROCESSED — has category, has slug, no capabilities/qualification
  // ENRICHED  — has capabilities OR refacing_qualification
  // VERIFIED  — verified = true
  // ROUTABLE  — directory_state = 'paid_member' (Trade Exchange eligible)
  if (!seed.business_name || !seed.category) return "raw";
  const capsCount = seed.capabilities && typeof seed.capabilities === "object" ? Object.keys(seed.capabilities).length : 0;
  if (seed.directory_state === "paid_member") return "routable";
  if (seed.verified) return "verified";
  if (capsCount > 0 || seed.refacing_qualification) return "enriched";
  return "processed";
}

async function seedPass() {
  console.log("");
  console.log("─".repeat(72));
  console.log("§ DIRECTORY_SEEDS · Capability enrichment pass");
  console.log("─".repeat(72));

  const { data, error } = await NEX
    .from("directory_seeds")
    .select("id, business_name, category, services, capabilities, refacing_qualification, verified, directory_state, primary_trade, slug, email, telephone, website, refacing_evidence");
  if (error) { console.error(error); return { entries: 0, changes: 0 }; }
  const seeds = data;

  const before = { byState: { raw: 0, processed: 0, enriched: 0, verified: 0, routable: 0 } };
  const proposedChanges = [];
  const stillEmpty = [];
  const missingContact = { email: 0, telephone: 0, website: 0 };
  const campaignAssignments = {};
  const ambiguousCategory = new Map(); // category -> count

  for (const s of seeds) {
    before.byState[seedRecordState(s)] += 1;
    if (!s.email) missingContact.email += 1;
    if (!s.telephone) missingContact.telephone += 1;
    if (!s.website) missingContact.website += 1;

    const currentCaps = s.capabilities && typeof s.capabilities === "object" ? s.capabilities : {};
    const currentCapsKeys = Object.keys(currentCaps);
    let capsToAdd = null;
    if (currentCapsKeys.length === 0) {
      capsToAdd = deriveCapabilitiesFromSeed(s);
      if (!capsToAdd) {
        stillEmpty.push({ id: s.id, business_name: s.business_name, category: s.category });
      }
    }

    const campaign = seedCampaignFromCategory(s);
    if (campaign) campaignAssignments[campaign] = (campaignAssignments[campaign] ?? 0) + 1;
    else ambiguousCategory.set(s.category, (ambiguousCategory.get(s.category) ?? 0) + 1);

    if (capsToAdd || campaign) {
      proposedChanges.push({
        id: s.id,
        business_name: s.business_name,
        category: s.category,
        current_capabilities_count: currentCapsKeys.length,
        proposed_capabilities: capsToAdd,
        proposed_campaign: campaign,
      });
    }
  }

  const after = { byState: { raw: 0, processed: 0, enriched: 0, verified: 0, routable: 0 } };
  for (const s of seeds) {
    const change = proposedChanges.find((c) => c.id === s.id);
    const projected = change
      ? { ...s, capabilities: change.proposed_capabilities ?? s.capabilities }
      : s;
    after.byState[seedRecordState(projected)] += 1;
  }

  console.log("");
  console.log("BEFORE · seed state (Record State Model):");
  for (const k of ["raw", "processed", "enriched", "verified", "routable"]) console.log(`  ${String(before.byState[k]).padStart(5)}  ${k}`);
  console.log("");
  console.log("PROPOSED · seed changes:");
  console.log(`  Seeds that would gain capabilities from stored evidence  : ${proposedChanges.filter((c) => c.proposed_capabilities).length}`);
  console.log(`  Seeds that would receive unambiguous campaign assignment : ${proposedChanges.filter((c) => c.proposed_campaign).length}`);
  console.log(`  Seeds that remain empty (no unambiguous evidence)        : ${stillEmpty.length}`);
  console.log("");
  console.log("PROPOSED · unambiguous campaign assignments:");
  for (const [k, n] of Object.entries(campaignAssignments).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
  console.log("");
  console.log("AMBIGUOUS categories (left as-is · human review):");
  for (const [cat, n] of [...ambiguousCategory.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${cat}`);
  console.log("");
  console.log("AFTER · seed state (projected):");
  for (const k of ["raw", "processed", "enriched", "verified", "routable"]) console.log(`  ${String(after.byState[k]).padStart(5)}  ${k}`);
  console.log("");
  console.log("HONEST MISSING (unchanged · not fabricated):");
  console.log(`  seeds with no email     : ${missingContact.email}`);
  console.log(`  seeds with no telephone : ${missingContact.telephone}`);
  console.log(`  seeds with no website   : ${missingContact.website}`);
  console.log("  (per NEX Record State Model · missing data is a legitimate honest state)");

  // ─── APPLY (if not dry-run) ────────────────────────────────────────
  if (!DRY) {
    console.log("");
    console.log("─── APPLYING changes to directory_seeds ───");
    let capsApplied = 0;
    for (const ch of proposedChanges) {
      if (!ch.proposed_capabilities) continue;
      const { error: upErr } = await NEX
        .from("directory_seeds")
        .update({ capabilities: ch.proposed_capabilities, updated_at: new Date().toISOString() })
        .eq("id", ch.id);
      if (upErr) console.log(`  FAIL ${ch.id} · ${upErr.message}`);
      else capsApplied += 1;
    }
    console.log(`  ${capsApplied} seed row(s) had capabilities enriched from stored evidence`);
    // NOTE: we do NOT overwrite the category text · we do NOT set refacing_qualification
    // (that requires human judgement per rubric · not derivable from category text alone)
  }

  return { entries: seeds.length, changes: proposedChanges.length, byStateBefore: before.byState, byStateAfter: after.byState };
}

// ═══════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════

const REPORT = { dry: DRY, ran_at: new Date().toISOString() };
if (!SEEDS_ONLY)  REPORT.images = imagePass();
if (!IMAGES_ONLY) REPORT.seeds  = await seedPass();

// ─── Save report ─────────────────────────────────────────────────────
const OUT_DIR = join(process.cwd(), "data", "audit");
mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = join(OUT_DIR, `enrichment-audit-${DRY ? "dryrun" : "applied"}-${stamp}.json`);
writeFileSync(OUT, JSON.stringify(REPORT, null, 2), "utf8");

console.log("");
console.log("=".repeat(72));
console.log(`Report saved: ${OUT}`);
console.log("=".repeat(72));
if (DRY) {
  console.log("");
  console.log("DRY RUN COMPLETE · nothing was mutated.");
  console.log("Review the numbers above. To apply, re-run with --apply:");
  console.log("  node scripts/nex-brain/enrichment-audit.mjs --apply");
} else {
  console.log("");
  console.log("APPLY COMPLETE. Re-run the full brain audit to verify state transitions.");
}
