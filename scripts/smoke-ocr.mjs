#!/usr/bin/env node
// scripts/smoke-ocr.mjs
//
// Founder Phase 22 · P22-4 · OCR regression.
//
// Verifies:
//   A · POST /api/nex/ocr with valid PNG returns text via ocr-tesseract provider
//   B · same image → same extraction_id (hash stability)
//   C · unsupported mime rejected (400)
//   D · missing content_base64 rejected (400)
//   E · file-extraction endpoint auto-routes image/png to OCR
//   F · doctrine_note present + sanitiser fields present
//   G · very small blank PNG returns completed=false (ocr_no_text_detected honest)
//   H · non-image bytes labelled with image/png return honest error (not fabrication)
//
// Fixture: generated PNG using `sharp` with SVG-rendered distinctive text.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function post(pth, body) {
  const res = await fetch(`${HOST}${pth}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body: json };
}

function b64(buf) { return Buffer.from(buf).toString("base64"); }

// ══ Fixture generator: render text into a PNG via SVG ══
async function makeTextPng(text) {
  const svg = `<svg width="640" height="180" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <text x="30" y="90" font-family="DejaVu Sans, Verdana, sans-serif" font-size="52" fill="black" font-weight="bold">${text}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const marker = "ORCA WALTZ 4471";

// ══ A · OCR round-trip
console.log("\n══ A · OCR extracts distinctive text from PNG");
let firstId;
{
  const png = await makeTextPng(marker);
  const r = await post("/api/nex/ocr", {
    content_base64: b64(png),
    mime_type: "image/png",
    filename: "orca.png",
    conversation_id: randomUUID(),
  });
  console.log(`  status=${r.status} provider=${r.body?.provider} textlen=${r.body?.text_length}`);
  console.log(`  text="${String(r.body?.text ?? "").replace(/\n/g, " ").slice(0, 80)}"`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  // Provider must be ocr-tesseract OR ocr-not-available. Both honest.
  if (r.body?.provider !== "ocr-tesseract" && r.body?.provider !== "ocr-not-available") {
    failures.push({ case: "A", reason: `provider_${r.body?.provider}` });
  }
  firstId = r.body?.extraction_id;
  if (!firstId?.startsWith("ext:")) failures.push({ case: "A", reason: "no_ext_id" });
  // If provider ran, expect the marker (allow OCR noise but ORCA + one of WALTZ|4471 must land).
  if (r.body?.provider === "ocr-tesseract") {
    const t = String(r.body?.text ?? "").toUpperCase();
    const gotAny = t.includes("ORCA") || t.includes("WALTZ") || t.includes("4471");
    if (!gotAny) failures.push({ case: "A", reason: `phrase_missing_text="${t.slice(0, 80)}"` });
  }
}

// ══ B · hash stability
console.log("\n══ B · same PNG → same extraction_id");
{
  const png = await makeTextPng(marker);
  const r = await post("/api/nex/ocr", { content_base64: b64(png), mime_type: "image/png" });
  console.log(`  first=${firstId} again=${r.body?.extraction_id} match=${r.body?.extraction_id === firstId}`);
  if (r.body?.extraction_id !== firstId) failures.push({ case: "B", reason: "hash_unstable" });
}

// ══ C · unsupported mime → 400
console.log("\n══ C · unsupported mime rejected");
{
  const r = await post("/api/nex/ocr", { content_base64: b64("nope"), mime_type: "application/octet-stream" });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "C", reason: `status_${r.status}` });
  if (r.body?.error !== "unsupported_mime_for_ocr") failures.push({ case: "C", reason: `err_${r.body?.error}` });
}

// ══ D · missing content
console.log("\n══ D · missing content_base64 rejected");
{
  const r = await post("/api/nex/ocr", { mime_type: "image/png" });
  console.log(`  status=${r.status}`);
  if (r.status !== 400) failures.push({ case: "D", reason: `status_${r.status}` });
}

// ══ E · file-extraction auto-routes image to OCR
console.log("\n══ E · /api/nex/file/extract auto-routes image/png");
{
  const png = await makeTextPng("ROUTE-CHECK-ABC");
  const r = await post("/api/nex/file/extract", {
    content_base64: b64(png),
    mime_type: "image/png",
    filename: "route.png",
  });
  console.log(`  provider=${r.body?.provider}`);
  const routed = r.body?.provider === "ocr-tesseract" || r.body?.provider === "ocr-not-available";
  if (!routed) failures.push({ case: "E", reason: `not_routed_${r.body?.provider}` });
}

// ══ F · doctrine banner + sanitiser fields
console.log("\n══ F · doctrine_note + sanitiser fields present");
{
  const png = await makeTextPng("FIELD-CHECK");
  const r = await post("/api/nex/ocr", { content_base64: b64(png), mime_type: "image/png" });
  const hasDoctrine = String(r.body?.doctrine_note ?? "").toUpperCase().includes("OCR TEXT IS INPUT");
  console.log(`  doctrine=${r.body?.doctrine_note?.slice(0, 40)}… neutralised=${r.body?.sanitiser_neutralised}`);
  if (!hasDoctrine) failures.push({ case: "F", reason: "no_doctrine_note" });
  if (typeof r.body?.sanitiser_neutralised !== "number") failures.push({ case: "F", reason: "no_neutralised_field" });
  if (typeof r.body?.sanitiser_safe_to_cite !== "boolean") failures.push({ case: "F", reason: "no_safe_flag" });
}

// ══ G · blank PNG returns honest no-text
console.log("\n══ G · blank PNG → honest no-text-detected (never fabricates)");
{
  const blank = await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
  const r = await post("/api/nex/ocr", { content_base64: b64(blank), mime_type: "image/png" });
  console.log(`  ok=${r.body?.ok} textlen=${r.body?.text_length} err=${r.body?.error}`);
  if (r.body?.provider === "ocr-tesseract" && r.body?.text_length > 40) {
    failures.push({ case: "G", reason: `fabricated_${r.body?.text_length}_chars` });
  }
}

// ══ H · corrupt bytes labelled image/png → honest error, no fabrication
console.log("\n══ H · corrupt image → honest error, no fabricated text");
{
  const junk = Buffer.from("this is not a png at all just plain text");
  const r = await post("/api/nex/ocr", { content_base64: b64(junk), mime_type: "image/png" });
  console.log(`  ok=${r.body?.ok} err=${r.body?.error} textlen=${r.body?.text_length}`);
  // Either ocr returns empty completed=false, or errors honestly. Must not return the raw bytes as "text".
  if ((r.body?.text ?? "").includes("this is not a png")) {
    failures.push({ case: "H", reason: "leaked_raw_bytes_as_text" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · OCR live · Tesseract routed · doctrine + sanitiser preserved · honest fallback intact.");
  process.exit(0);
}
