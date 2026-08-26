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
import {
  REJECTION_REASONS,
  createRejectionCounter,
  computeCycleOutcome,
} from "../nex-worker/rejection-reasons.mjs";

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

/**
 * Persistence contract enforcement · Philip 2026-08-26.
 *
 * For each candidate:
 *   1. INSERT via config.persistence.buildInsert (must include worker_id +
 *      cycle_run_id, ON CONFLICT DO NOTHING RETURNING <primary_key>).
 *   2. rowCount === 0 → conflict · counted as conflictSkipped, continue.
 *   3. rowCount === 1 → read returned PK from insertResult.rows[0].
 *   4. SELECT pk FROM destination WHERE pk=$1 AND cycle_run_id=$2 AND worker_id=$3.
 *      Three-way match rules out any race where two cycles collide on the same PK.
 *      If verify returns exactly one row → insertVerified++.
 *      Otherwise → verificationFailed++.
 *   5. If verified AND config.persistence.writeSideEffects present → call it for
 *      snapshot + provenance rows. Side-write errors surface as `errors` but do
 *      NOT unverify the row (row is already persisted correctly).
 */
export async function persistCandidates(pool, candidates, config, { workerId, cycleRunId }) {
  const results = {
    insertAttempted: 0, insertReturned: 0, insertVerified: 0,
    conflictSkipped: 0, verificationFailed: 0, errors: 0,
  };
  const { destinationTable, primaryKeyColumn, buildInsert, writeSideEffects } = config.persistence;

  for (const c of candidates) {
    results.insertAttempted++;
    // buildInsert is invoked with `this` bound to config so it can read
    // this.city / this.country / this.tables / etc. exactly like the
    // legacy insertNewRecord method did.
    const { sql, values } = buildInsert.call(config, c, {
      workerId, cycleRunId, sourceName: c.sourceName,
    });
    let insertRes;
    try {
      insertRes = await pool.query(sql, values);
    } catch (err) {
      results.errors++;
      continue;
    }
    if (insertRes.rowCount === 0) { results.conflictSkipped++; continue; }
    results.insertReturned++;

    const returnedPk = insertRes.rows[0]?.[primaryKeyColumn];
    if (returnedPk == null) {
      results.verificationFailed++;
      continue;
    }
    // Three-way strict verify per Philip 2026-08-26.
    const ver = await pool.query(
      `SELECT ${primaryKeyColumn} FROM ${destinationTable}
       WHERE ${primaryKeyColumn} = $1 AND cycle_run_id = $2 AND worker_id = $3`,
      [returnedPk, cycleRunId, workerId]
    );
    if (ver.rowCount !== 1) {
      results.verificationFailed++;
      continue;
    }
    results.insertVerified++;

    if (writeSideEffects) {
      try {
        await writeSideEffects.call(config, pool, c, {
          workerId, cycleRunId, sourceName: c.sourceName, primaryKeyValue: returnedPk,
        });
      } catch (err) {
        results.errors++;
      }
    }
  }
  return results;
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

  // Persistence contract 2026-08-26 · workerId + cycleRunId flow through so
  // every INSERT + verify SELECT can attribute rows to the walker cycle.
  // Contract mode requires both; legacy insertNewRecord path still works
  // with only jobId (accommodation/market/transport until P5).
  const workerId   = options.workerId   ?? null;
  const cycleRunId = options.cycleRunId ?? options.jobId ?? null;

  if (config.persistence && !options.dryRun) {
    if (!workerId || !cycleRunId) {
      throw new Error(
        `Persistence contract requires workerId + cycleRunId when config.persistence is present. ` +
        `Got workerId=${workerId} cycleRunId=${cycleRunId}. ` +
        `run-live-cycle.mjs must pass both in runAgent options.`
      );
    }
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
      // new_candidates counts items that CLASSIFIED as "new" in Phase B (dedupe
      // step) · this is a SCORING count · NOT the number of rows actually
      // persisted. Keep it here for backwards-compat + operator visibility, but
      // NEVER let a dashboard-facing "records_new" metric read from it. The
      // authoritative persistence count lives in `records_persisted` below.
      new_candidates: 0,
      // records_persisted counts rows that the DB actually accepted (ON CONFLICT
      // DO NOTHING → rowCount>0). This is the truth · use this when reporting
      // records_new to worker_cycle_run. Introduced 2026-08-24 · P1 records_new
      // pollution fix (Philip greenlight after cutover-3 acceptance).
      records_persisted: 0,
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

  // Phase 1 rejection telemetry (2026-08-25) · per-reason histogram written
  // into worker_cycle_run.summary.rejected_by_reason. Policy unchanged.
  const rejectionCounter = createRejectionCounter();
  let providerErroredCount = 0;

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
      providerErroredCount++;
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
      case "unnamed":
        audit.counts.unnamed++;
        rejectionCounter.increment(REJECTION_REASONS.MALFORMED);
        break;
      case "exact":
        audit.counts.matched_exact++;
        rejectionCounter.increment(REJECTION_REASONS.MATCHED_EXISTING);
        enrichableMatches.push({ candidate: c, existing: match.existing });
        break;
      case "high":
        audit.counts.matched_high++;
        rejectionCounter.increment(REJECTION_REASONS.MATCHED_EXISTING);
        enrichableMatches.push({ candidate: c, existing: match.existing });
        break;
      case "ambiguous":
        audit.counts.ambiguous++;
        rejectionCounter.increment(REJECTION_REASONS.MATCHED_EXISTING);
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
          if (gain && Object.keys(gain).length > 0) {
            enrichedCount++;
            // Enrichment pivot 2026-08-27 · Chief Architect. Write gain BACK to
            // the existing row when config supports it. COALESCE semantics ·
            // NEVER overwrites non-null values · NEVER touches owner_verified
            // rows (enforced in the SQL). Errors captured in audit.errors ·
            // never crash the cycle.
            if (config.persistence?.applyEnrichmentToExisting) {
              try {
                const written = await config.persistence.applyEnrichmentToExisting.call(
                  config, pool, m.existing, gain, { workerId, cycleRunId, sourceName: source.name }
                );
                if (written > 0) audit.counts.enrichment_writes_applied = (audit.counts.enrichment_writes_applied ?? 0) + 1;
              } catch (err) {
                audit.errors.push({ source: source.name, phase: "enrichment-write", ref: m.existing.public_listing_ref, message: err.message });
                audit.counts.errors++;
              }
            }
          }
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
      rejectionCounter.increment(REJECTION_REASONS.CONTACT_MISSING);
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
      rejectionCounter.increment(REJECTION_REASONS.INELIGIBLE);
      if (audit.samples.rejected.length < 5) {
        audit.samples.rejected.push({ publicRef: c.publicRef, name: c.name, reason: result.reason ?? "ineligible" });
      }
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

  // ── Phase E · persist new records with STRICT contract ────────────────────
  // Philip 2026-08-26 persistence contract:
  //   INSERT with worker_id + cycle_run_id → RETURNING pk → SELECT-verify by pk
  //   → records_new derived from SELECT COUNT(*) WHERE cycle_run_id=$1
  //   → invariant: db_count === insert_verified · mismatch = FAILED cycle
  //   → NO errors_count escape hatch
  //
  // Legacy path preserved for verticals not yet on the contract (P5 rollout).
  if (!dryRun && config.persistence) {
    log(`── PERSIST · contract mode · ${newRecords.length} candidates ──`);
    const results = await persistCandidates(pool, newRecords, config, {
      workerId, cycleRunId,
    });
    audit.counts.insert_attempted    = results.insertAttempted;
    audit.counts.insert_conflicts    = results.conflictSkipped;
    audit.counts.insert_returned     = results.insertReturned;
    audit.counts.insert_verified     = results.insertVerified;
    audit.counts.verification_failed = results.verificationFailed;
    audit.counts.persist_errors      = results.errors;
    audit.counts.errors             += results.errors;
    log(`  attempted=${results.insertAttempted}  returned=${results.insertReturned}  ` +
        `verified=${results.insertVerified}  conflicts=${results.conflictSkipped}  ` +
        `verify_failed=${results.verificationFailed}  errors=${results.errors}`);
    log("");
  } else if (!dryRun && config.insertNewRecord) {
    // Legacy path (accommodation/market/transport until P5).
    // Preserved 2026-08-24 concurrent-safety property: ON CONFLICT DO NOTHING
    // → only the walker that genuinely created the row gets credit.
    log(`── PERSIST · legacy mode · ${newRecords.length} candidates ──`);
    for (const c of newRecords) {
      try {
        const ok = await config.insertNewRecord(pool, c, { jobId: cycleRunId, sourceName: c.sourceName });
        if (ok) audit.counts.records_persisted++;
      } catch (err) {
        audit.errors.push({ phase: "persist", ref: c.publicRef, message: err.message });
        audit.counts.errors++;
      }
    }
    log(`  inserted: ${audit.counts.records_persisted} / ${newRecords.length}`);
    log("");
  } else if (dryRun) {
    log(`── PERSIST · SKIPPED (dry-run) ──`);
    log(`  would insert ${newRecords.length} new records`);
    log("");
  }

  // ── Strict invariant · DB is source of truth ──────────────────────────────
  // Philip 2026-08-26: records_new = COUNT(destination WHERE cycle_run_id=$1)
  // ALWAYS. Any mismatch = FAILED cycle. NO errors_count escape hatch.
  if (!dryRun && config.persistence && cycleRunId) {
    const q = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${config.persistence.destinationTable}
       WHERE cycle_run_id = $1`,
      [cycleRunId]
    );
    const recordsNewFromDb = q.rows[0].n;
    audit.counts.records_new_from_db = recordsNewFromDb;
    audit.counts.records_persisted    = recordsNewFromDb;   // DB truth wins

    const verified = audit.counts.insert_verified ?? 0;
    const invariantHeld = recordsNewFromDb === verified;

    audit.persistenceInvariant = {
      held: invariantHeld,
      db_count: recordsNewFromDb,
      insert_verified: verified,
      delta: verified - recordsNewFromDb,
    };
    if (!invariantHeld) {
      audit.persistenceInvariantFailed = true;
      log(`  ✗ INVARIANT FAILED · db_count=${recordsNewFromDb} · insert_verified=${verified}`);
    } else {
      log(`  ✓ INVARIANT HELD · db_count=${recordsNewFromDb} · insert_verified=${verified}`);
    }
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

  // Phase 1 rejection telemetry · fold histogram + cycle-outcome bucket into audit
  // so run-live-cycle.mjs can lift both into worker_cycle_run.summary.
  audit.counts.rejected_by_reason = rejectionCounter.toObject();
  // Prefer DB-truth (records_new_from_db) when persistence contract is active;
  // fall back to records_persisted (legacy counter) for legacy-path verticals.
  audit.cycle_outcome = computeCycleOutcome({
    recordsProcessed: allCandidates.length,
    recordsNew:       audit.counts.records_new_from_db ?? audit.counts.records_persisted,
    recordsRejected:  audit.counts.rejected_by_gate,
    matchedExisting:  audit.counts.matched_exact + audit.counts.matched_high + audit.counts.ambiguous,
    providerReturned: audit.counts.discovered,
    providerErrored:  providerErroredCount,
  });

  const reportPath = await writeReport(audit);
  log(`── AUDIT REPORT WRITTEN ──`);
  log(`  ${reportPath}`);

  return audit;
}
