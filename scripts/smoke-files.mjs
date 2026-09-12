#!/usr/bin/env node
// scripts/smoke-files.mjs
//
// Founder BEGIN Phase 3.9 · File-upload regression.
//
// Verifies:
//   A · request WITHOUT attached_files → no file extraction fired
//   B · request WITH 1 attached brochure PDF (mock) → 4 file items extracted
//        file_extra_items_count=4, source_type=file, ref_ids file:<hash>:<page>:<i>
//   C · LLM (mock, cite:real) picks first evidence which is a file ref →
//        rescue verified, cited_source_refs contain a file: prefix
//   D · Fabrication guard on file cites: cite:orphan tries to cite a fake
//        file ref → rejected, honest limitation returned, no fabrication leak
//   E · file ref_ids follow file:<hash16>:<page>:<idx> format
//   F · MULTIPLE files uploaded together (brochure + menu) → items merge
//   G · file exceeding _FILE_MAX_BYTES is silently dropped (count=0)
//   H · empty content (hint=empty) → 0 items, provider still logged
//
// Requires: NEX_FILES=on NEX_FILE_PROVIDER=mock NEX_LLM_RESCUE=1
//           NEX_LLM_RESCUE_PROVIDER=mock (already in .env.local)

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function chat(cid, message, extra = {}) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true, ...extra }),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: { _parse_error: text.slice(0, 200) } }; }
}

// Deterministic base64 payloads · mock only hashes them for ref_id.
const BROCHURE_B64 = Buffer.from("mock-pdf-brochure-content-hotel-gaotama-45-rooms").toString("base64");
const MENU_B64 = Buffer.from("mock-image-menu-content-nasi-goreng-45000-es-teh-8000").toString("base64");
const EMPTY_B64 = Buffer.from("mock-empty-content-no-legible-facts-inside").toString("base64");
// Very large payload > 5MB default cap: 8MB of base64 → decoded 6MB (over 5MB cap).
const OVERSIZE_B64 = "A".repeat(8_000_000);

const failures = [];

try { await chat(randomUUID(), "warmup"); } catch {}

// ══════════════════════════════════════════════════════════════════
// A · no attached_files → no file extraction
// ══════════════════════════════════════════════════════════════════
console.log("\n══ A · request WITHOUT attached_files → no file extraction");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real hotel gaotama info");
  const dbg = r.body?._debug_timings ?? {};
  const count = dbg.file_extra_items_count ?? 0;
  const uploaded = dbg.file_upload_count ?? 0;
  const list = dbg.file_provider_meta_list ?? [];
  console.log(`  uploaded=${uploaded} extracted=${count} providers=${list.length}`);
  if (uploaded > 0) failures.push({ case: "no_files", reason: "upload_count_nonzero" });
  if (count > 0) failures.push({ case: "no_files", reason: "file_items_added_without_upload" });
  if (list.length > 0) failures.push({ case: "no_files", reason: "provider_ran_without_upload" });
}

// ══════════════════════════════════════════════════════════════════
// B · WITH 1 brochure PDF → 4 file items extracted
// ══════════════════════════════════════════════════════════════════
console.log("\n══ B · request WITH 1 brochure → 4 file facts");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real hotel brochure attached", {
    attached_files: [{
      filename: "gaotama-brochure.pdf",
      mime_type: "application/pdf",
      content_base64: BROCHURE_B64,
      hint: "brochure",
    }],
  });
  const dbg = r.body?._debug_timings ?? {};
  const count = dbg.file_extra_items_count ?? 0;
  const uploaded = dbg.file_upload_count ?? 0;
  const list = dbg.file_provider_meta_list ?? [];
  console.log(`  uploaded=${uploaded} extracted=${count} providers=${list.length} completed=${list[0]?.completed} hash=${String(list[0]?.file_hash ?? "").slice(0, 8)}`);
  if (uploaded !== 1) failures.push({ case: "brochure", reason: `expected_1_upload_got_${uploaded}` });
  if (count !== 4) failures.push({ case: "brochure", reason: `expected_4_items_got_${count}` });
  if (list.length !== 1 || list[0]?.completed !== true) failures.push({ case: "brochure", reason: "provider_did_not_complete" });
}

// ══════════════════════════════════════════════════════════════════
// C · LLM (mock, cite:real) picks first evidence which is a file ref
// ══════════════════════════════════════════════════════════════════
console.log("\n══ C · cite:real + attached brochure → rescue cites file ref");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh brochure attached", {
    attached_files: [{
      filename: "xyzzy-brochure.pdf",
      mime_type: "application/pdf",
      content_base64: BROCHURE_B64,
      hint: "brochure",
    }],
  });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const count = dbg.file_extra_items_count ?? 0;
  console.log(`  rescue.verified=${rescue?.verified} cited=${JSON.stringify(rescue?.cited_source_refs)}`);
  console.log(`  file_items_extracted=${count}`);
  if (!rescue) failures.push({ case: "cite_file", reason: "rescue_did_not_fire" });
  else {
    const cited = rescue.cited_source_refs ?? [];
    const hasFile = cited.some((c) => c.startsWith("file:"));
    if (!rescue.verified) failures.push({ case: "cite_file", reason: "verdict_not_verified" });
    if (!hasFile) failures.push({ case: "cite_file", reason: `expected_file_prefix_in_cited_got_${JSON.stringify(cited)}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// D · Fabrication guard rejects orphan file citation
// ══════════════════════════════════════════════════════════════════
console.log("\n══ D · Fabrication guard rejects orphan file citation");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:orphan xyzzy plugh with brochure attached", {
    attached_files: [{
      filename: "xyzzy-brochure.pdf",
      mime_type: "application/pdf",
      content_base64: BROCHURE_B64,
      hint: "brochure",
    }],
  });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const reply = String(r.body?.reply ?? "");
  console.log(`  rescue.verified=${rescue?.verified} rejected=${rescue?.rejected_claims_count}`);
  console.log(`  reply: ${JSON.stringify(reply.slice(0, 80))}`);
  if (!rescue) failures.push({ case: "file_fabrication", reason: "rescue_did_not_fire" });
  else {
    if (rescue.verified) failures.push({ case: "file_fabrication", reason: "orphan_claim_accepted" });
    if ((rescue.rejected_claims_count ?? 0) < 1) failures.push({ case: "file_fabrication", reason: "no_rejection_recorded" });
    if (reply.toLowerCase().includes("ritz fabricated hotel")) failures.push({ case: "file_fabrication", reason: "FABRICATED_LEAKED" });
    if (!reply.includes("couldn't verify") && !reply.startsWith("Based on research:")) {
      failures.push({ case: "file_fabrication", reason: "no_honest_reply_pattern" });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// E · file ref_ids format check
// ══════════════════════════════════════════════════════════════════
console.log("\n══ E · file ref_ids follow file:<hash16>:<page>:<idx> format");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real menu photo attached", {
    attached_files: [{
      filename: "menu.jpg",
      mime_type: "image/jpeg",
      content_base64: MENU_B64,
      hint: "menu",
    }],
  });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const cited = rescue?.cited_source_refs ?? [];
  const goodFormat = cited.filter((c) => /^file:[a-f0-9]{16}:\d+:\d+$/.test(c));
  console.log(`  cited=${JSON.stringify(cited)}`);
  console.log(`  well-formed file refs: ${goodFormat.length}/${cited.length}`);
  if (rescue?.verified && cited.length > 0 && goodFormat.filter((c) => c.startsWith("file:")).length === 0) {
    failures.push({ case: "ref_format", reason: "no_well_formed_file_ref" });
  }
}

// ══════════════════════════════════════════════════════════════════
// F · Multiple files uploaded together
// ══════════════════════════════════════════════════════════════════
console.log("\n══ F · brochure + menu together → items merge");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real hotel + menu photos attached", {
    attached_files: [
      { filename: "brochure.pdf", mime_type: "application/pdf", content_base64: BROCHURE_B64, hint: "brochure" },
      { filename: "menu.jpg",     mime_type: "image/jpeg",      content_base64: MENU_B64,     hint: "menu"     },
    ],
  });
  const dbg = r.body?._debug_timings ?? {};
  const count = dbg.file_extra_items_count ?? 0;
  const uploaded = dbg.file_upload_count ?? 0;
  const list = dbg.file_provider_meta_list ?? [];
  console.log(`  uploaded=${uploaded} extracted=${count} providers=${list.length}`);
  if (uploaded !== 2) failures.push({ case: "multi_file", reason: `expected_2_uploads_got_${uploaded}` });
  // brochure→4 + menu→3 = 7
  if (count !== 7) failures.push({ case: "multi_file", reason: `expected_7_items_got_${count}` });
  if (list.length !== 2) failures.push({ case: "multi_file", reason: `expected_2_provider_metas_got_${list.length}` });
}

// ══════════════════════════════════════════════════════════════════
// G · oversize file silently dropped
// ══════════════════════════════════════════════════════════════════
console.log("\n══ G · oversize file above _FILE_MAX_BYTES → silently dropped");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real big brochure attached", {
    attached_files: [{
      filename: "huge.pdf",
      mime_type: "application/pdf",
      content_base64: OVERSIZE_B64,
      hint: "brochure",
    }],
  });
  const dbg = r.body?._debug_timings ?? {};
  const uploaded = dbg.file_upload_count ?? 0;
  const count = dbg.file_extra_items_count ?? 0;
  console.log(`  uploaded=${uploaded} extracted=${count}`);
  if (uploaded !== 0) failures.push({ case: "oversize", reason: `oversize_not_dropped_uploaded_${uploaded}` });
  if (count !== 0) failures.push({ case: "oversize", reason: `oversize_extracted_items_${count}` });
}

// ══════════════════════════════════════════════════════════════════
// H · empty file → 0 items, provider still logged
// ══════════════════════════════════════════════════════════════════
console.log("\n══ H · empty content (hint=empty) → 0 items, provider logged");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real blank file attached", {
    attached_files: [{
      filename: "empty.pdf",
      mime_type: "application/pdf",
      content_base64: EMPTY_B64,
      hint: "empty",
    }],
  });
  const dbg = r.body?._debug_timings ?? {};
  const count = dbg.file_extra_items_count ?? 0;
  const list = dbg.file_provider_meta_list ?? [];
  console.log(`  extracted=${count} providers=${list.length} completed=${list[0]?.completed}`);
  if (count !== 0) failures.push({ case: "empty_file", reason: `expected_0_items_got_${count}` });
  if (list.length !== 1) failures.push({ case: "empty_file", reason: "provider_meta_missing" });
  if (list[0]?.completed !== true) failures.push({ case: "empty_file", reason: "provider_not_completed" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · file → evidence → gate → verified · fabrication guard preserved.");
  process.exit(0);
}
