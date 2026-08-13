// Path C · URL queue processor · runs the collection worker end-to-end.
//
// For each item pulled from nex_collection_url_queue:
//   1. Fetch the URL (+ up to 2 useful internal pages)
//   2. Extract structured CandidateReport (email/phone/postcode/evidence)
//   3. Run findDuplicateCandidates() against directory_seeds
//   4. If not a duplicate + qualification ≥ C, save via insertDirectorySeed()
//   5. Mark queue item with a terminal status (completed/duplicate/needs_review/failed)
//
// GOVERNANCE (Philip 2026-08-13):
//   · Failure of a single URL NEVER stops the queue — we log it and move on.
//   · NEVER fabricates missing data.
//   · No paid search API. Uses only Node's built-in fetch.
//   · Every saved seed goes through insertDirectorySeed() so it immediately
//     appears at /nex-app/refacing/companies + in the Trade Center.

import "server-only";
import { randomUUID } from "node:crypto";
import { fetchCandidateSurface } from "./candidateFetcher";
import { extractCandidateReport } from "./candidateExtractor";
import {
  claimNextQueued,
  completeQueueItem,
  recordFetchError,
  recoverStuckProcessing,
  updateQueueItem,
  type QueueItem,
} from "./urlQueueDb";
import {
  findDuplicateCandidates,
  insertDirectorySeed,
  mergeCapabilitiesIntoSeed,
} from "@/lib/nex/centre-publishing/directorySeedsDb";
import { getTradeCategory } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";
import type {
  DirectorySeed,
  EmailStatus,
} from "@/lib/nex/centre-publishing/directorySeedLoader";

export type ProcessOutcome =
  | { kind: "completed"; queue_item_id: string; listing_id: string; slug: string; qualification: string }
  | { kind: "duplicate"; queue_item_id: string; matched_slug: string; signal: string }
  | { kind: "needs_review"; queue_item_id: string; reason: string }
  | { kind: "failed"; queue_item_id: string; error_category: string; error_message: string };

export type BatchReport = {
  collection_type: string;
  processed: number;
  completed: number;
  duplicate: number;
  needs_review: number;
  failed: number;
  outcomes: ProcessOutcome[];
  drained: boolean;
  time_ms: number;
  /** Count of rows auto-recovered from stuck 'processing' before the batch ran
   *  (Philip 2026-08-13). Non-zero = a previous worker crashed / timed out
   *  mid-fetch and left the row hanging · this batch put it back in 'queued'. */
  auto_recovered_stuck: number;
};

/**
 * Drain the queue for a given collection type. Each URL is processed
 * independently — a failure on URL N never stops URL N+1.
 *
 * `maxItems` caps a single invocation so we can call this from cron every
 * few minutes without long-running requests. Pass a big number (or omit)
 * for manual drain-everything runs.
 */
export async function processUrlQueue(input: {
  collectionType: string;
  maxItems?: number;
}): Promise<BatchReport> {
  const start = Date.now();
  const cap = input.maxItems ?? 25;
  const outcomes: ProcessOutcome[] = [];
  let drained = false;

  // Auto-recover any rows that got stuck in 'processing' from an earlier
  // worker that crashed / timed out. Threshold: 30 minutes · well beyond
  // the 45-second fetch budget so genuinely in-flight rows are untouched.
  // Runs BEFORE the main claim loop so recovered rows become claimable in
  // this same batch.
  const recovery = await recoverStuckProcessing({
    collectionType: input.collectionType,
    olderThanMinutes: 30,
  });
  const auto_recovered_stuck = recovery.recovered;

  for (let i = 0; i < cap; i++) {
    const item = await claimNextQueued(input.collectionType);
    if (!item) { drained = true; break; }
    try {
      const outcome = await processOneItem(item);
      outcomes.push(outcome);
    } catch (err) {
      // Belt-and-braces: even an unexpected exception must not stop the loop.
      const msg = err instanceof Error ? err.message : String(err);
      await completeQueueItem(item.id, {
        status: "failed",
        last_error: `processor_exception: ${msg}`,
      });
      outcomes.push({
        kind: "failed",
        queue_item_id: item.id,
        error_category: "other",
        error_message: msg,
      });
    }
  }

  const report: BatchReport = {
    collection_type: input.collectionType,
    processed: outcomes.length,
    completed: outcomes.filter((o) => o.kind === "completed").length,
    duplicate: outcomes.filter((o) => o.kind === "duplicate").length,
    needs_review: outcomes.filter((o) => o.kind === "needs_review").length,
    failed: outcomes.filter((o) => o.kind === "failed").length,
    outcomes,
    drained,
    time_ms: Date.now() - start,
    auto_recovered_stuck,
  };
  return report;
}

// ─── single-item processing ───────────────────────────────────────

async function processOneItem(item: QueueItem): Promise<ProcessOutcome> {
  const category = getTradeCategory(item.collection_type);
  if (!category || !category.enabled) {
    await completeQueueItem(item.id, {
      status: "failed",
      last_error: `category_not_enabled: ${item.collection_type}`,
    });
    return {
      kind: "failed",
      queue_item_id: item.id,
      error_category: "other",
      error_message: `category_not_enabled: ${item.collection_type}`,
    };
  }

  // ── 1. Fetch ────────────────────────────────────────────────
  const fetched = await fetchCandidateSurface(item.candidate_url);
  if (!fetched.ok) {
    await recordFetchError({
      target_url: item.candidate_url,
      queue_item_id: item.id,
      error_category: fetched.error_category,
      last_error: fetched.error_message,
    });
    await completeQueueItem(item.id, {
      status: "failed",
      last_error: `${fetched.error_category}: ${fetched.error_message}`,
    });
    return {
      kind: "failed",
      queue_item_id: item.id,
      error_category: fetched.error_category,
      error_message: fetched.error_message,
    };
  }

  // ── 2. Extract ──────────────────────────────────────────────
  const report = extractCandidateReport(fetched);

  // Store the fingerprint + classification + confidence_score on the queue
  // row regardless of outcome. Uses updateQueueItem (not completeQueueItem)
  // so we don't stamp completed_at before the terminal outcome is decided.
  await updateQueueItem(item.id, {
    extracted_company_name: report.company_name,
    extracted_email:        report.email,
    extracted_phone:        report.phone,
    extracted_postcode:     report.postcode,
    evidence_snippet:       report.evidence_snippet,
    refacing_qualification: report.refacing_qualification,
    classification:         report.classification,
    confidence_score:       report.confidence_score,
  });

  // ── 3. Qualification gate ───────────────────────────────────
  if (report.refacing_qualification === "excluded") {
    await completeQueueItem(item.id, {
      status: "needs_review",
      result_summary: `excluded · score ${report.confidence_score}/100 · ${report.qualification_reasoning}`,
    });
    return { kind: "needs_review", queue_item_id: item.id, reason: `excluded · ${report.qualification_reasoning}` };
  }
  if (!report.company_name) {
    await completeQueueItem(item.id, {
      status: "needs_review",
      result_summary: `no_company_name_extracted · score ${report.confidence_score}/100`,
    });
    return { kind: "needs_review", queue_item_id: item.id, reason: "no_company_name_extracted" };
  }

  // ── 4. Duplicate check (against existing directory_seeds) ────
  //
  // One-company-many-services model (Philip 2026-08-13): a strong duplicate is
  // NOT dropped. Instead we merge the newly-detected capabilities + evidence
  // into the existing seed so a single business ends up with every service its
  // various URLs prove — never fragmented into duplicate records.
  const duplicates = await findDuplicateCandidates({
    business_name: report.company_name,
    website:       fetched.finalUrl,
    telephone:     report.phone,
    email:         report.email,
    postcode:      report.postcode,
    town:          null,
  });
  const strong = duplicates.find((d) => d.match_type === "strong");
  if (strong) {
    const todayDate = new Date().toISOString().slice(0, 10);
    const evidenceItems: DirectorySeed["refacing_evidence"] = report.evidence_snippet
      ? [{
          url:        report.evidence_source_url ?? fetched.finalUrl,
          type:       "company_website",
          category:   pickEvidenceCategory(report),
          summary:    report.evidence_snippet,
          checked_at: todayDate,
        }]
      : [];

    const merge = await mergeCapabilitiesIntoSeed(strong.id, {
      capabilities:            report.capabilities,
      refacing_evidence:       evidenceItems,
      refacing_qualification:  report.refacing_qualification,
      fillIfEmpty: {
        email:       report.email,
        telephone:   report.phone,
        postcode:    report.postcode,
        description: report.description,
      },
    });

    const mergeSummary = merge.ok
      ? `merged into ${strong.slug} · ${strong.signal}`
      : `duplicate detected but merge failed: ${merge.error}`;

    await completeQueueItem(item.id, {
      status: merge.ok ? "duplicate" : "needs_review",
      result_summary: mergeSummary,
      result_listing_slug: strong.slug,
      result_listing_id: strong.id,
    });
    return {
      kind: "duplicate",
      queue_item_id: item.id,
      matched_slug: strong.slug,
      signal: `${strong.signal} · ${merge.ok ? "capabilities merged" : "merge failed"}`,
    };
  }

  // ── 5. NEX Brain Confidence Rule (Philip 2026-08-13 · FINAL) ────
  //
  // memory: project_nex_brain_confidence_rule_2026_08_13.md
  //   ≥80  → auto-pass · build + save the seed as normal
  //   <80  → park queue row as needs_review · do NOT create the seed
  //          (human reviewer decides whether to promote it later)
  //
  // Duplicates already handled above via mergeCapabilitiesIntoSeed, which is
  // upgrade-only — never downgrades an already-accepted record. So this gate
  // only applies to NEW records that would otherwise be inserted fresh.
  const CONFIDENCE_PASS_THRESHOLD = 80;
  if (report.confidence_score < CONFIDENCE_PASS_THRESHOLD) {
    await completeQueueItem(item.id, {
      status: "needs_review",
      result_summary:
        `score ${report.confidence_score}/100 (<${CONFIDENCE_PASS_THRESHOLD}) · human review · ` +
        `${report.classification} · ${report.qualification_reasoning}`,
    });
    return {
      kind: "needs_review",
      queue_item_id: item.id,
      reason: `confidence ${report.confidence_score} below ${CONFIDENCE_PASS_THRESHOLD}`,
    };
  }

  // ── 6. Build + save the seed ────────────────────────────────
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);
  const town = ""; // extractor doesn't reliably split town from address; leave admin to fill
  const slug = slugify(report.company_name, town || extractTopLevelDomain(fetched.finalUrl));
  const emailStatus: EmailStatus = report.email ? "needs_manual_verification" : "not_found";

  const seed: Partial<DirectorySeed> = {
    id:              randomUUID(),
    slug,
    business_name:   report.company_name,
    category:        category.displayName,
    primary_trade:   category.primaryTradeSlug,
    tags:            [],
    enrichment_status: "partial",
    last_verified_at: nowIso,

    address_line_1:  null,
    address_line_2:  null,
    town:            null,
    county:          null,
    postcode:        report.postcode,
    country:         "United Kingdom",

    telephone:       report.phone,
    website:         fetched.finalUrl,
    email:           report.email,

    opening_hours:   null,
    description:     report.description,
    services:        [],

    google_rating:       null,
    google_review_count: null,
    google_maps_url:     null,

    latitude:  null,
    longitude: null,

    status:     "listed",
    claimed:    false,
    verified:   false,
    visibility: "public",

    photos:      [],
    cover_image: null,

    source:      "refacing_discovery",
    imported_at: nowIso,

    capabilities:           report.capabilities,
    refacing_qualification: report.refacing_qualification as DirectorySeed["refacing_qualification"],
    refacing_evidence:      report.evidence_snippet
      ? [{
          url:        report.evidence_source_url ?? fetched.finalUrl,
          type:       "company_website",
          category:   pickEvidenceCategory(report),
          summary:    report.evidence_snippet,
          checked_at: todayDate,
        }]
      : [],
    email_source:     report.email ? "company_website" : null,
    email_verified:   false,
    email_checked_at: report.email ? todayDate : null,
    lifecycle_status: "unclaimed",
    directory_state:  "listed",
    email_status:     emailStatus,
  };

  const saved = await insertDirectorySeed(seed);
  if (!saved.ok) {
    if (saved.error.startsWith("duplicate:")) {
      await completeQueueItem(item.id, {
        status: "duplicate",
        result_summary: `db_unique_violation: ${saved.error}`,
      });
      return { kind: "duplicate", queue_item_id: item.id, matched_slug: slug, signal: saved.error };
    }
    await completeQueueItem(item.id, {
      status: "failed",
      last_error: `insert_failed: ${saved.error}`,
    });
    return {
      kind: "failed",
      queue_item_id: item.id,
      error_category: "other",
      error_message: saved.error,
    };
  }

  await completeQueueItem(item.id, {
    status: "completed",
    result_listing_id: saved.id,
    result_listing_slug: saved.slug,
    result_summary:
      `saved · score ${report.confidence_score}/100 · ${report.classification} · ` +
      `${report.refacing_qualification} · ${report.qualification_reasoning}`,
  });
  return {
    kind: "completed",
    queue_item_id: item.id,
    listing_id: saved.id,
    slug: saved.slug,
    qualification: report.refacing_qualification,
  };
}

// ─── helpers ──────────────────────────────────────────────────────

/** Map the extractor's detected services to the valid RefacingEvidenceItem.category
 *  union. Prefer the strongest signal (refacing > refurbishment > cladding > other)
 *  so the evidence snippet is labelled with the most specific service the site proves. */
function pickEvidenceCategory(report: import("./candidateExtractor").CandidateReport):
  NonNullable<DirectorySeed["refacing_evidence"]>[number]["category"] {
  if (report.services.staircase_refacing)      return "staircase_refacing";
  if (report.services.staircase_refurbishment) return "staircase_refurbishment";
  if (report.services.staircase_cladding)      return "staircase_cladding";
  if (report.services.installation)            return "installation";
  return "other";
}

function slugify(name: string, tail: string): string {
  const base = `${name}-${tail}`.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || randomUUID().slice(0, 8);
}

function extractTopLevelDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").split(".")[0]; }
  catch { return "uk"; }
}
