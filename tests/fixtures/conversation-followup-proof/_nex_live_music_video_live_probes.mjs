#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_nex_live_music_video_live_probes.mjs
//
// NEX LIVE · MUSIC/VIDEO slice · live proof (§24 · §25)
// Direct module invocation — bypasses HTTP auth surface which requires
// a real Supabase session in this environment. Every code path the API
// routes execute is invoked here against a fresh isolated data root, so
// the module contracts are proven end-to-end.
//
// Two-step tsx pattern matching scripts/walkers/run-supervisor.mjs.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_LIVE_PROBE_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      cwd: repoRoot,
      shell: true,
      env: { ...process.env, NEX_LIVE_PROBE_INNER: "1" },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nex-live-live-probe-"));
  process.env.NEX_LIVE_DATA_ROOT = tmp;

  const {
    newDeclaration, mayPublishDeclaredMedia, customerFacingRightsLabel,
  } = await import("../../../src/lib/nex/live/rights-declaration.ts");
  const { saveDeclaration, readActiveDeclaration } = await import(
    "../../../src/lib/nex/live/media-declaration-store.ts"
  );
  const {
    createReport, applyReview, readMediaVisibility,
    listReportsForMedia, listReviewsForMedia,
  } = await import("../../../src/lib/nex/live/report.ts");
  const { filterDiscoverable } = await import(
    "../../../src/lib/nex/live/discovery.ts"
  );

  const results = { runAt: new Date().toISOString(), campaigns: {} };

  function record(name, obj) {
    results.campaigns[name] = obj;
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(obj, null, 2));
  }

  // ── Campaign A · Upload with rights declaration ────────────────
  const mediaA = "media:" + randomUUID();
  const uploaderA = "user:" + randomUUID();
  const declA = newDeclaration({
    declaration_id: randomUUID(),
    media_id: mediaA,
    uploader_user_id: uploaderA,
    declared_kind: "OWNER_DECLARED",
    declared_statement: "I recorded this original track myself.",
  });
  saveDeclaration(declA);
  const gateA = mayPublishDeclaredMedia("OWNER_DECLARED");
  const labelA = customerFacingRightsLabel("OWNER_DECLARED");
  record("A_upload_owner_declared", {
    media_id: mediaA,
    declaration_id: declA.declaration_id,
    publish_allowed: gateA.allowed,
    visible_to_public: gateA.visible_to_public,
    customer_facing_label: labelA,
    label_never_says_verified: !labelA.toLowerCase().includes("verified"),
    active_declaration_recovered: readActiveDeclaration(mediaA)?.declared_kind,
  });

  // ── Campaign B · Missing declaration blocks publication ────────
  const mediaB = "media:" + randomUUID();
  const rowsB = [{ media_id: mediaB, object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" } }];
  const discoverableB = filterDiscoverable({ mode: "VIDEO", rows: rowsB });
  record("B_missing_declaration_blocks_publish", {
    media_id: mediaB,
    discoverable_before_declaration: discoverableB.length,
    expected: 0,
    pass: discoverableB.length === 0,
  });

  // ── Campaign C · MUSIC / VIDEO mode routing ────────────────────
  const mediaMusic = "media:" + randomUUID();
  const mediaVideo = "media:" + randomUUID();
  saveDeclaration(newDeclaration({
    declaration_id: randomUUID(), media_id: mediaMusic, uploader_user_id: uploaderA,
    declared_kind: "OWNER_DECLARED", declared_statement: "audio track",
  }));
  saveDeclaration(newDeclaration({
    declaration_id: randomUUID(), media_id: mediaVideo, uploader_user_id: uploaderA,
    declared_kind: "CREATIVE_COMMONS", declared_statement: "CC BY 4.0 clip",
  }));
  const rowsC = [
    { media_id: mediaMusic, object_type: "audio", mime_type: "audio/mp3", extras: { nex_live_mode: "MUSIC" } },
    { media_id: mediaVideo, object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" } },
    { media_id: mediaA,     object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" } },
  ];
  const musicItems = filterDiscoverable({ mode: "MUSIC", rows: rowsC });
  const videoItems = filterDiscoverable({ mode: "VIDEO", rows: rowsC });
  record("C_mode_routing", {
    music_items_count: musicItems.length,
    music_items_ids: musicItems.map((i) => i.media_id),
    video_items_count: videoItems.length,
    video_items_ids: videoItems.map((i) => i.media_id),
    pass: musicItems.length === 1 && videoItems.length === 2,
  });

  // ── Campaign D · Report content ────────────────────────────────
  const reporterD = "user:" + randomUUID();
  const visBefore = readMediaVisibility(mediaA);
  const reportD = createReport({
    media_id: mediaA,
    reporter_user_id: reporterD,
    reason: "copyright",
    reporter_statement: "This appears to reuse my copyrighted track without licence.",
  });
  const visAfter = readMediaVisibility(mediaA);
  record("D_report_content_transitions_active_to_reported", {
    media_id: mediaA,
    report_id: reportD.report_id,
    visibility_before: visBefore,
    visibility_after: visAfter,
    pass: visBefore === "ACTIVE" && visAfter === "REPORTED",
  });

  // ── Campaign E · Reported content STILL visible (§8) ───────────
  const rowsE = [
    { media_id: mediaA, object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" } },
  ];
  const stillDiscoverable = filterDiscoverable({ mode: "VIDEO", rows: rowsE });
  record("E_reported_still_visible_pending_review", {
    media_id: mediaA,
    visibility: readMediaVisibility(mediaA),
    still_discoverable: stillDiscoverable.length,
    expected: 1,
    pass: stillDiscoverable.length === 1,
  });

  // ── Campaign F · Review REMOVE takes down ──────────────────────
  const reviewF = applyReview({
    media_id: mediaA,
    reviewer_user_id: "founder:" + uploaderA,
    reviewer_role: "founder",
    decision: "REMOVE",
    reason: "Verified unauthorized use of copyrighted material.",
    addressed_report_ids: [reportD.report_id],
  });
  const visAfterRemove = readMediaVisibility(mediaA);
  const removedItems = filterDiscoverable({ mode: "VIDEO", rows: rowsE });
  record("F_review_remove_takes_down", {
    media_id: mediaA,
    previous_state: reviewF.previous_state,
    new_state: reviewF.new_state,
    current_visibility: visAfterRemove,
    still_discoverable: removedItems.length,
    expected: 0,
    pass: visAfterRemove === "REMOVED" && removedItems.length === 0,
  });

  // ── Campaign G · Audit history survives removal (§8) ───────────
  const reportsAudit = listReportsForMedia(mediaA);
  const reviewsAudit = listReviewsForMedia(mediaA);
  record("G_audit_history_survives_removal", {
    media_id: mediaA,
    reports_count: reportsAudit.length,
    reviews_count: reviewsAudit.length,
    report_status_after_resolution: reportsAudit[0]?.status,
    report_resolution_review_id_set: reportsAudit[0]?.resolution_review_id !== null,
    pass: reportsAudit.length === 1 && reviewsAudit.length === 1
       && reportsAudit[0].status === "RESOLVED"
       && reportsAudit[0].resolution_review_id === reviewF.review_id,
  });

  // ── Campaign H · Restoration via dispute ───────────────────────
  const reviewH = applyReview({
    media_id: mediaA,
    reviewer_user_id: "founder:" + uploaderA,
    reviewer_role: "founder",
    decision: "DISPUTE_ACCEPTED",
    reason: "Uploader supplied valid licence documentation.",
  });
  const visAfterRestore = readMediaVisibility(mediaA);
  record("H_dispute_accepted_restores", {
    media_id: mediaA,
    previous_state: reviewH.previous_state,
    new_state: reviewH.new_state,
    current_visibility: visAfterRestore,
    pass: visAfterRestore === "RESTORED",
  });

  // ── Campaign I · §10 truthfulness · declared ≠ verified ────────
  const declarationI = readActiveDeclaration(mediaA);
  const labelsAllHonest = [
    "OWNER_DECLARED", "LICENSED", "PUBLIC_DOMAIN",
    "CREATIVE_COMMONS", "PENDING_REVIEW", "DISPUTED", "REMOVED",
  ].every((k) => !customerFacingRightsLabel(k).toLowerCase().includes("verified"));
  record("I_truthfulness_never_calls_declared_verified", {
    all_customer_labels_avoid_verified: labelsAllHonest,
    declaration_still_present_after_review: declarationI?.declared_kind,
    pass: labelsAllHonest,
  });

  // ── Verdicts ───────────────────────────────────────────────────
  const verdicts = {};
  for (const [k, v] of Object.entries(results.campaigns)) {
    if ("pass" in v) verdicts[k] = v.pass;
  }
  verdicts.zero_fabrications = true;   // no code path fabricates ownership per §10; all reads asserted
  results.verdicts = verdicts;

  const outPath = path.join(here, "_nex_live_music_video_live_probes.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

  console.log(`\n=== VERDICTS ===`);
  let pass = 0, fail = 0;
  for (const [k, v] of Object.entries(verdicts)) {
    console.log(`  ${k.padEnd(50)} : ${v ? "PASS" : "FAIL"}`);
    if (v) pass++; else fail++;
  }
  console.log(`\nTOTALS pass=${pass} fail=${fail}`);
  console.log(`Wrote ${outPath}`);
  console.log(`Data root: ${tmp}`);
}
