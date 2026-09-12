#!/usr/bin/env node
// scripts/smoke-chat-streaming.mjs
//
// Founder Phase 11 · P11-4 · Chat UI streaming regression.
//
// Verifies:
//   A · Accept:text/event-stream returns text/event-stream response
//   B · hello event fires first
//   C · at least one stage + one meta event
//   D · done event fires with full envelope
//   E · abort mid-stream honored (no crash on server)
//   F · fabrication guard preserved under streaming (cite:orphan still rejected)
//   G · /nex/chat page has SSE parser markers
//   H · /nex/chat page has edit + stop markers

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const failures = [];

async function collectSse(message, opts = {}) {
  const controller = new AbortController();
  if (opts.abortAfterMs) setTimeout(() => controller.abort(), opts.abortAfterMs);
  let res;
  try {
    res = await fetch(`${HOST}/api/nex-conv/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
      body: JSON.stringify({ message, conversation_id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, market: "ID", useLiveWorld: true }),
      signal: controller.signal,
    });
  } catch (e) {
    return { status: 0, contentType: "", events: [], doneEnvelope: null, aborted: (e?.name === "AbortError") };
  }
  const contentType = res.headers.get("content-type") ?? "";
  const events = [];
  const reader = res.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let doneEnvelope = null;
  try {
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\n\n/);
      buffer = frames.pop() ?? "";
      for (const f of frames) {
        let evt = "message", data = "";
        for (const line of f.split(/\n/)) {
          if (line.startsWith("event:")) evt = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        let parsed = data;
        try { parsed = JSON.parse(data); } catch {}
        events.push({ event: evt, data: parsed });
        if (evt === "done") doneEnvelope = parsed;
      }
    }
  } catch { /* abort or network · silent */ }
  return { status: res.status, contentType, events, doneEnvelope };
}

console.log("\n══ A · Accept: text/event-stream returns event-stream");
{
  const r = await collectSse("hello");
  console.log(`  status=${r.status} content-type=${r.contentType.slice(0, 60)}`);
  if (!r.contentType.includes("text/event-stream")) failures.push({ case: "A", reason: `bad_content_type_${r.contentType}` });
}

console.log("\n══ B · hello event fires first");
{
  const r = await collectSse("hello there stream");
  const first = r.events[0];
  console.log(`  first_event=${first?.event}`);
  if (first?.event !== "hello") failures.push({ case: "B", reason: `first_${first?.event}` });
}

console.log("\n══ C · at least one stage + one meta event");
{
  const r = await collectSse("cite:none Java maritime trade history " + Date.now());
  const stages = r.events.filter((e) => e.event === "stage").length;
  const metas = r.events.filter((e) => e.event === "meta").length;
  console.log(`  stages=${stages} metas=${metas}`);
  if (stages < 1) failures.push({ case: "C", reason: "no_stage_events" });
  if (metas < 1) failures.push({ case: "C", reason: "no_meta_events" });
}

console.log("\n══ D · done event fires with envelope");
{
  const r = await collectSse("simple chat test " + Date.now());
  console.log(`  done_present=${!!r.doneEnvelope} reply_len=${r.doneEnvelope?.reply?.length}`);
  if (!r.doneEnvelope) failures.push({ case: "D", reason: "no_done_event" });
  if (!r.doneEnvelope?.reply) failures.push({ case: "D", reason: "no_reply_in_done" });
  if (!Array.isArray(r.doneEnvelope?.cited_sources)) failures.push({ case: "D", reason: "no_cited_sources" });
}

console.log("\n══ E · abort mid-stream is honored (no crash on server side)");
{
  const r = await collectSse("streaming test " + Date.now(), { abortAfterMs: 200 });
  // Follow-up request must still succeed to prove server didn't crash.
  const followup = await collectSse("recovery ping " + Date.now());
  console.log(`  followup_status=${followup.status} events=${followup.events.length}`);
  if (followup.status !== 200) failures.push({ case: "E", reason: `follow_status_${followup.status}` });
}

console.log("\n══ F · fabrication guard preserved under streaming (cite:orphan)");
{
  const r = await collectSse("cite:orphan xyzzy plugh detail " + Date.now());
  const doneEnv = r.doneEnvelope;
  const rescue = doneEnv?._debug_timings?.llm_rescue_verdict;
  console.log(`  rescue.verified=${rescue?.verified} rejected=${rescue?.rejected_claims_count}`);
  if (rescue?.verified) failures.push({ case: "F", reason: "orphan_accepted" });
  const reply = String(doneEnv?.reply ?? "");
  if (reply.toLowerCase().includes("ritz fabricated hotel")) {
    failures.push({ case: "F", reason: "FABRICATED_LEAKED" });
  }
}

console.log("\n══ G · SSE parser markers present in /nex/chat");
{
  const src = await readFile(path.join(REPO, "src/app/nex/chat/page.tsx"), "utf8");
  if (!src.includes("readSse") || !src.includes("text/event-stream")) failures.push({ case: "G", reason: "no_sse_client" });
}

console.log("\n══ H · edit + stop markers present");
{
  const src = await readFile(path.join(REPO, "src/app/nex/chat/page.tsx"), "utf8");
  if (!src.includes("startEdit") || !src.includes("stopGeneration")) failures.push({ case: "H", reason: "no_edit_or_stop" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · SSE streaming live · edit + stop present · fabrication guard preserved.");
  process.exit(0);
}
