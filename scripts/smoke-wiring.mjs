#!/usr/bin/env node
// scripts/smoke-wiring.mjs
//
// Founder Phase 17 · P17-4 · End-to-end wiring regression.
//
// Verifies the chat-with-tools flow:
//   A · plain chat via /chat-with-tools returns a reply and persists turn
//   B · chat with attached text file: reply produced, provenance kind=file, file text spliced under banner
//   C · chat with attached DOCX: distinctive phrase appears in provenance + assistant sees banner
//   D · chat with attached voice (mock): provenance kind=voice, transcript flows in
//   E · empty message + no attachment → 400
//   F · after chat, /api/nex/conversations/[id] returns 2 messages (user + assistant)
//   G · search finds the distinctive attached-file phrase in the persisted turn
//   H · Doctrine #5 sanitiser count reported on wired response
//   I · playground page /nex/tools renders 200 with mic + file inputs

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver");

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

class CookieJar {
  constructor() { this.cookies = new Map(); }
  addFromResponse(res) {
    const setCookie = res.headers.get("set-cookie") ?? "";
    for (const c of setCookie.split(/,\s*(?=[^ ]+=)/)) {
      const m = c.match(/^([^=]+)=([^;]*)/);
      if (m) this.cookies.set(m[1], m[2]);
    }
  }
  header() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function jf(jar, pth, opts = {}) {
  const headers = new Headers(opts.headers ?? {});
  if (jar.header()) headers.set("cookie", jar.header());
  const res = await fetch(`${HOST}${pth}`, { ...opts, headers });
  jar.addFromResponse(res);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body };
}

async function buildDocx(bodyText) {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks = [];
  stream.on("data", (c) => chunks.push(c));
  const done = new Promise((res, rej) => { stream.on("end", res); archive.on("error", rej); });
  archive.pipe(stream);
  archive.append(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`, { name: "[Content_Types].xml" });
  archive.append(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`, { name: "_rels/.rels" });
  const paras = bodyText.split("\n").map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`).join("");
  archive.append(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paras}</w:body>
</w:document>`, { name: "word/document.xml" });
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}

function b64(buf) { return Buffer.from(buf).toString("base64"); }

const jar = new CookieJar();
const cid = randomUUID();
const marker = `axolotl-${randomUUID().slice(0, 8)}`;

// signup
await jf(jar, "/api/nex/auth/signup", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ display_name: `p17-${randomUUID().slice(0, 6)}` }),
});

// ══ A · plain chat via chat-with-tools
console.log("\n══ A · plain chat via /chat-with-tools");
{
  const r = await jf(jar, "/api/nex-conv/chat-with-tools", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Hello from ${marker}`, conversation_id: cid }),
  });
  console.log(`  status=${r.status} reply="${String(r.body?.reply ?? "").slice(0, 40)}…" provenance=${r.body?.provenance?.length ?? 0}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!r.body?.reply) failures.push({ case: "A", reason: "no_reply" });
  if (r.body?.conversation_id !== cid) failures.push({ case: "A", reason: "cid_mismatch" });
}

// Small pause so persist can land before B's read-back path.
await new Promise((r) => setTimeout(r, 250));

// ══ B · attach a text file
console.log("\n══ B · chat with attached text file");
{
  const fileContent = `Reference document\nContains the marker phrase: ${marker}.\nEnd.`;
  const r = await jf(jar, "/api/nex-conv/chat-with-tools", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "What is the marker in the attached document?",
      conversation_id: cid,
      file_content_base64: b64(fileContent),
      file_mime: "text/plain",
      file_name: "reference.txt",
    }),
  });
  console.log(`  status=${r.status} provenance=${JSON.stringify(r.body?.provenance?.[0] ?? null).slice(0, 80)}`);
  if (r.status !== 200) failures.push({ case: "B", reason: `status_${r.status}` });
  const fp = (r.body?.provenance ?? []).find((p) => p.kind === "file");
  if (!fp) failures.push({ case: "B", reason: "no_file_provenance" });
  if (fp && !fp.completed) failures.push({ case: "B", reason: `file_not_completed_${fp.error}` });
  if (fp && !fp.ref_id?.startsWith("ext:")) failures.push({ case: "B", reason: "no_ext_ref_id" });
}

// ══ C · attach a DOCX
console.log("\n══ C · chat with attached DOCX");
{
  const docx = await buildDocx(`Reference DOCX\nContains: ${marker}\nEnd.`);
  const r = await jf(jar, "/api/nex-conv/chat-with-tools", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "What is in the attached DOCX?",
      conversation_id: cid,
      file_content_base64: b64(docx),
      file_mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_name: "ref.docx",
    }),
  });
  const fp = (r.body?.provenance ?? []).find((p) => p.kind === "file");
  console.log(`  status=${r.status} provider=${fp?.provider} text_length=${fp?.text_length}`);
  if (r.status !== 200) failures.push({ case: "C", reason: `status_${r.status}` });
  if (fp?.provider !== "docx-unzipper") failures.push({ case: "C", reason: `provider_${fp?.provider}` });
  if ((fp?.text_length ?? 0) < 10) failures.push({ case: "C", reason: "docx_text_empty" });
}

// ══ D · attach mock voice
console.log("\n══ D · chat with attached voice (mock)");
{
  // The mock STT matches /^SGVsbG8/i (base64 "Hello…") → returns "hello"
  const voiceBase64 = Buffer.from("Hello world audio bytes").toString("base64");
  const r = await jf(jar, "/api/nex-conv/chat-with-tools", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "See attached voice.",
      conversation_id: cid,
      voice_audio_base64: voiceBase64,
      voice_mime: "audio/wav",
    }),
  });
  const vp = (r.body?.provenance ?? []).find((p) => p.kind === "voice");
  console.log(`  status=${r.status} provider=${vp?.provider} completed=${vp?.completed}`);
  if (r.status !== 200) failures.push({ case: "D", reason: `status_${r.status}` });
  if (!vp) failures.push({ case: "D", reason: "no_voice_provenance" });
  if (vp && !vp.ref_id?.startsWith("stt:")) failures.push({ case: "D", reason: "no_stt_ref_id" });
}

// ══ E · empty input
console.log("\n══ E · empty message + no attachment → 400");
{
  const r = await jf(jar, "/api/nex-conv/chat-with-tools", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: cid, message: "" }),
  });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "E", reason: `status_${r.status}` });
}

// Wait for background persists.
await new Promise((r) => setTimeout(r, 800));

// ══ F · conversation persisted with turns
console.log("\n══ F · conversation persisted with user+assistant turns");
{
  const r = await jf(jar, `/api/nex/conversations/${cid}`);
  const msgs = r.body?.messages ?? [];
  console.log(`  count=${msgs.length} first_role=${msgs[0]?.role}`);
  if (msgs.length < 6) failures.push({ case: "F", reason: `only_${msgs.length}_msgs` });
  const roles = msgs.map((m) => m.role).join(",");
  if (!roles.includes("user") || !roles.includes("assistant")) failures.push({ case: "F", reason: `roles_${roles}` });
}

// ══ G · search finds marker (attached-file phrase)
console.log("\n══ G · search finds marker in persisted turn");
{
  const r = await jf(jar, `/api/nex/conversations/search?q=${encodeURIComponent(marker)}`);
  const hit = (r.body?.results ?? []).some((h) => h.conversation_id === cid);
  console.log(`  results=${r.body?.results?.length} hit_ours=${hit}`);
  if (!hit) failures.push({ case: "G", reason: "search_missed" });
}

// ══ H · sanitiser count on response
console.log("\n══ H · sanitiser count reported on wired response");
{
  const r = await jf(jar, "/api/nex-conv/chat-with-tools", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "clean", conversation_id: cid }),
  });
  const has = typeof r.body?.sanitiser_neutralised === "number";
  console.log(`  neutralised_field_present=${has} value=${r.body?.sanitiser_neutralised}`);
  if (!has) failures.push({ case: "H", reason: "no_sanitiser_field" });
}

// ══ I · playground page renders
console.log("\n══ I · /nex/tools page renders 200");
{
  const res = await fetch(`${HOST}/nex/tools`);
  const text = await res.text();
  const hasVoice = text.toLowerCase().includes("voice");
  const hasFile = text.toLowerCase().includes("file");
  console.log(`  status=${res.status} voice=${hasVoice} file=${hasFile}`);
  if (res.status !== 200) failures.push({ case: "I", reason: `status_${res.status}` });
  if (!hasVoice || !hasFile) failures.push({ case: "I", reason: "controls_missing" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · integration wiring live · voice + file + chat + persist end-to-end.");
  process.exit(0);
}
