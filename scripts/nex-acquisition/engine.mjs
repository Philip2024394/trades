// NEX Universal Acquisition Engine · framework · vertical-agnostic.
//
// This is the ONE machine parametrised per vertical (Food · Hotels · Villas ·
// Drivers · Trades · Shops · Services). It is NEVER forked per vertical.
// A vertical is a CONFIG passed in — never a separate codebase.
//
// Governing doctrines:
//   · project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
//   · project_nex_acquisition_machine_scheduled_agents_2026_08_21
//   · project_nex_food_flywheel_over_scraping_2026_08_21
//
// Constitutional invariants enforced by this engine:
//   · Discovery ≠ Outreach — Gates 1-4 run freely; Gate 5 is NEVER invoked
//     from smoke mode. Outreach only from a dedicated outreach worker with
//     kill switch + limits + cooldowns + audit + eligibility recheck.
//   · Never overwrites owner_verified fields.
//   · Every record carries provenance (source · source_reference · licence).
//   · Every candidate passes every gate in order · no bypass.
//   · Audit report captures every discover · match · gate transition.
//
// This file MUST stay vertical-agnostic. Any food/hotel/villa-specific logic
// belongs in the config file (configs/*.mjs), NOT here.

import { runGates } from "./gates.mjs";
import { writeReport } from "./report.mjs";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function crockfordSuffix(n) {
  const digits = [];
  for (let i = 0; i < 5; i++) { digits.unshift(CROCKFORD[n & 31] ?? "0"); n >>>= 5; }
  return digits.join("");
}

function crockfordToInt(s) {
  let n = 0;
  for (const c of s) {
    const v = CROCKFORD.indexOf(c);
    if (v < 0) return 0;
    n = (n << 5) + v;
  }
  return n;
}

function normaliseName(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function computeDedupeHash({ name, address, phone, lat, lng }) {
  const nameNorm = normaliseName(name);
  const addrNorm = normaliseName(address);
  const phoneTail = String(phone ?? "").replace(/\D+/g, "").slice(-6);
  const latR = lat != null ? Number(lat).toFixed(3) : "";
  const lngR = lng != null ? Number(lng).toFixed(3) : "";
  return [nameNorm, addrNorm, phoneTail, latR, lngR].join("|");
}

function coordDist(aLat, aLng, bLat, bLng) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function tokenJaccard(a, b) {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

async function loadExistingUniverse(pool, config) {
  const q = `
    SELECT public_listing_ref, business_name, dedupe_hash,
           coordinates_lat, coordinates_lng,
           whatsapp_number, phone, website, city
    FROM ${config.tables.business}
    WHERE city = $1
  `;
  const res = await pool.query(q, [config.city]);
  return res.rows;
}

async function nextPublicRefCounter(pool, config, yearPrefix) {
  const q = `
    SELECT public_listing_ref FROM ${config.tables.business}
    WHERE public_listing_ref LIKE $1
    ORDER BY public_listing_ref DESC LIMIT 1
  `;
  const res = await pool.query(q, [`${config.publicRefPrefix}-${yearPrefix}-%`]);
  if (res.rowCount === 0) return 1;
  const suffix = res.rows[0].public_listing_ref.split("-").at(-1);
  return crockfordToInt(suffix) + 1;
}

function formatPublicRef(config, year, counter) {
  return `${config.publicRefPrefix}-${year}-${crockfordSuffix(counter)}`;
}

function matchAgainstExisting(candidate, existing) {
  if (!candidate.name) return { kind: "unnamed" };
  const hash = computeDedupeHash({
    name: candidate.name,
    address: candidate.address,
    phone: candidate.phone,
    lat: candidate.lat,
    lng: candidate.lng,
  });
  candidate.dedupeHash = hash;

  for (const ex of existing) {
    if (ex.dedupe_hash === hash) return { kind: "exact", existing: ex };
  }

  let bestScore = 0, bestExisting = null;
  const candName = normaliseName(candidate.name);
  for (const ex of existing) {
    const nameScore = tokenJaccard(normaliseName(ex.business_name), candName);
    const dist = coordDist(ex.coordinates_lat, ex.coordinates_lng, candidate.lat, candidate.lng);
    let s;
    if (dist != null) {
      if (dist < 100) s = nameScore * 0.6 + 0.4;
      else if (dist < 300) s = nameScore * 0.7 + 0.15;
      else if (dist < 500) s = nameScore * 0.8 + 0.05;
      else s = nameScore * 0.9;
    } else s = nameScore * 0.7;
    if (s > bestScore) { bestScore = s; bestExisting = ex; }
  }
  if (bestExisting && bestScore >= 0.85) return { kind: "high", existing: bestExisting, score: bestScore };
  if (bestExisting && bestScore >= 0.60) return { kind: "ambiguous", existing: bestExisting, score: bestScore };
  return { kind: "new" };
}

export async function runAgent(pool, config, options = {}) {
  // Country Foundation Step 4 (2026-08-22) · validate config.country explicitly BEFORE any DB access.
  // Country MUST be a valid ISO 3166-1 alpha-2 code. NEVER inferred from city.
  // Per Truth Invariant: fail loudly rather than default silently.
  // Cross-refs:
  //   project_nex_country_foundation_phased_plan_2026_08_22 (Step 4)
  //   project_nex_truth_invariant_2026_08_22
  //   project_nex_country_scope_from_phone_country_code_2026_08_22
  if (typeof config.country !== "string" || !/^[A-Z]{2}$/.test(config.country)) {
    throw new Error(
      `Universal Acquisition Engine · config.country is REQUIRED and must be a valid ISO 3166-1 alpha-2 code (e.g. "ID", "GB", "US"). ` +
      `Got: ${JSON.stringify(config.country)}. ` +
      `Country must be declared explicitly per Country Foundation Step 4 doctrine · never inferred from city.`
    );
  }

  const smokeMode = options.smokeMode ?? true;
  const dryRun = options.dryRun ?? true;
  const bbox = options.bbox ?? config.defaultBbox;
  const jobId = options.jobId ?? `${config.vertical}-${config.city}-${Date.now()}`.toLowerCase();
  const startedAt = new Date();

  const audit = {
    jobId,
    vertical: config.vertical,
    country: config.country,   // Country Foundation Step 4 (2026-08-22) · audit records the country too
    city: config.city,
    bbox,
    smokeMode,
    dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    sources: [],
    counts: {
      discovered: 0,
      matched_exact: 0,
      matched_high: 0,
      ambiguous: 0,
      unnamed: 0,
      new_candidates: 0,
      enriched: 0,
      gate3_contactable: 0,
      gate4_eligible: 0,
      gate5_outreach_sent: 0,
      gate5_outreach_blocked_by_smoke: 0,
      rejected_by_gate: 0,
      errors: 0,
    },
    samples: {
      new: [],
      ambiguous: [],
      contactable: [],
      rejected: [],
    },
    errors: [],
  };

  const log = (msg) => { console.log(`  [${config.vertical}] ${msg}`); };

  log(`── UNIVERSAL ACQUISITION ENGINE ──`);
  log(`  vertical: ${config.vertical}`);
  log(`  country:  ${config.country}`);
  log(`  city:     ${config.city}`);
  log(`  bbox:     ${JSON.stringify(bbox)}`);
  log(`  mode:     ${smokeMode ? "SMOKE (outreach hard-noop)" : "PRODUCTION"} · ${dryRun ? "DRY RUN" : "APPLY"}`);
  log(`  sources:  ${config.sources.map((s) => s.name).join(" · ")}`);
  log("");

  const existing = await loadExistingUniverse(pool, config);
  log(`  existing NEX universe (${config.vertical}·${config.city}): ${existing.length}`);
  log("");

  const year = String(startedAt.getUTCFullYear());
  let nextCounter = await nextPublicRefCounter(pool, config, year);

  // ── Phase A · discovery from each configured source ───────────────────────
  const allCandidates = [];
  for (const source of config.sources.filter((s) => s.discover)) {
    log(`── DISCOVERY · source: ${source.name} ──`);
    const sourceReport = { name: source.name, discovered: 0, errors: [] };
    try {
      const candidates = await source.discover({ config, bbox, log });
      sourceReport.discovered = candidates.length;
      audit.counts.discovered += candidates.length;
      for (const c of candidates) allCandidates.push({ ...c, sourceName: source.name });
      log(`  → ${candidates.length} candidates from ${source.name}`);
    } catch (err) {
      sourceReport.errors.push(err.message);
      audit.errors.push({ source: source.name, phase: "discover", message: err.message });
      audit.counts.errors++;
      log(`  ✗ discover failed: ${err.message}`);
    }
    audit.sources.push(sourceReport);
    log("");
  }

  // ── Phase B · classify each candidate against existing universe ───────────
  log(`── VALIDATION · dedupe + fuzzy match ──`);
  const newRecords = [];
  const enrichableMatches = [];
  for (const c of allCandidates) {
    const match = matchAgainstExisting(c, existing);
    switch (match.kind) {
      case "unnamed": audit.counts.unnamed++; break;
      case "exact":
        audit.counts.matched_exact++;
        enrichableMatches.push({ candidate: c, existing: match.existing });
        break;
      case "high":
        audit.counts.matched_high++;
        enrichableMatches.push({ candidate: c, existing: match.existing });
        break;
      case "ambiguous":
        audit.counts.ambiguous++;
        if (audit.samples.ambiguous.length < 8) {
          audit.samples.ambiguous.push({
            candidateName: c.name,
            existingName: match.existing.business_name,
            existingRef: match.existing.public_listing_ref,
            score: match.score.toFixed(3),
          });
        }
        break;
      case "new":
        audit.counts.new_candidates++;
        c.publicRef = formatPublicRef(config, year, nextCounter++);
        newRecords.push(c);
        break;
    }
  }
  log(`  exact-match:  ${audit.counts.matched_exact}`);
  log(`  high-fuzzy:   ${audit.counts.matched_high}`);
  log(`  ambiguous:    ${audit.counts.ambiguous}`);
  log(`  unnamed:      ${audit.counts.unnamed}`);
  log(`  new:          ${audit.counts.new_candidates}`);
  log("");

  // ── Phase C · enrichment (only for new records + existing matches) ────────
  const enrichmentSources = config.sources.filter((s) => s.enrich);
  if (enrichmentSources.length > 0) {
    log(`── ENRICHMENT · ${enrichmentSources.map((s) => s.name).join(" · ")} ──`);
    for (const source of enrichmentSources) {
      let enrichedCount = 0;
      try {
        for (const c of newRecords) {
          const gain = await source.enrich({ record: c, config, log });
          if (gain && Object.keys(gain).length > 0) {
            Object.assign(c, gain);
            enrichedCount++;
          }
        }
        for (const m of enrichableMatches) {
          const gain = await source.enrich({ record: { ...m.candidate, existing: m.existing }, config, log });
          if (gain && Object.keys(gain).length > 0) enrichedCount++;
        }
      } catch (err) {
        audit.errors.push({ source: source.name, phase: "enrich", message: err.message });
        audit.counts.errors++;
        log(`  ✗ enrich failed: ${err.message}`);
      }
      log(`  ${source.name}: enriched ${enrichedCount} records`);
      audit.counts.enriched += enrichedCount;
    }
    log("");
  }

  // ── Phase D · run 5-gate flow on each NEW record ──────────────────────────
  log(`── GATES · discover → validate → contactable → eligible → outreach ──`);
  for (const c of newRecords) {
    const result = runGates(c, { smokeMode, config });
    c.gateResult = result;
    if (!result.passedContactable) {
      audit.counts.rejected_by_gate++;
      if (audit.samples.rejected.length < 5) {
        audit.samples.rejected.push({ publicRef: c.publicRef, name: c.name, reason: result.reason });
      }
      continue;
    }
    audit.counts.gate3_contactable++;
    if (audit.samples.contactable.length < 8) {
      audit.samples.contactable.push({
        publicRef: c.publicRef, name: c.name,
        whatsapp: c.whatsapp, phone: c.phone, website: c.website,
      });
    }
    if (!result.passedEligible) {
      audit.counts.rejected_by_gate++;
      continue;
    }
    audit.counts.gate4_eligible++;
    if (result.outreachAttempted) audit.counts.gate5_outreach_sent++;
    if (result.outreachBlockedBySmoke) audit.counts.gate5_outreach_blocked_by_smoke++;
  }
  log(`  contactable (Gate 3): ${audit.counts.gate3_contactable}`);
  log(`  eligible    (Gate 4): ${audit.counts.gate4_eligible}`);
  log(`  outreach sent (Gate 5): ${audit.counts.gate5_outreach_sent}`);
  log(`  outreach blocked by SMOKE: ${audit.counts.gate5_outreach_blocked_by_smoke}`);
  log(`  rejected by any gate: ${audit.counts.rejected_by_gate}`);
  log("");

  // ── Phase E · persist new records to DB (unless dry-run) ──────────────────
  if (!dryRun) {
    log(`── PERSIST · inserting ${newRecords.length} new records ──`);
    let inserted = 0;
    for (const c of newRecords) {
      try {
        const ok = await config.insertNewRecord(pool, c, { jobId, sourceName: c.sourceName });
        if (ok) inserted++;
      } catch (err) {
        audit.errors.push({ phase: "persist", ref: c.publicRef, message: err.message });
        audit.counts.errors++;
      }
    }
    log(`  inserted: ${inserted} / ${newRecords.length}`);
    log("");
  } else {
    log(`── PERSIST · SKIPPED (dry-run) ──`);
    log(`  would insert ${newRecords.length} new records`);
    log("");
  }

  for (const c of newRecords.slice(0, 8)) {
    audit.samples.new.push({
      publicRef: c.publicRef, name: c.name, category: c.category,
      hasCoord: c.lat != null, hasContact: Boolean(c.whatsapp || c.phone),
      sourceName: c.sourceName,
    });
  }

  audit.finishedAt = new Date().toISOString();

  const reportPath = await writeReport(audit);
  log(`── AUDIT REPORT WRITTEN ──`);
  log(`  ${reportPath}`);

  return audit;
}
