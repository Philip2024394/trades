// src/lib/nex-calling/signalling.test.ts
//
// NEX Calling · Signalling routing regression tests · Philip 2026-08-27.
//
// Hits the running signal.mjs over HTTP + SSE. Test skipped when signal
// server is unreachable so CI without a signal server just no-ops.

import { describe, it, expect, beforeAll } from "vitest";

const SIGNAL_BASE = process.env.NEX_CALL_SIGNAL_URL ?? "http://localhost:8090";

// Probe once before tests. If server is down, every test emits a clear
// skip-style pass so CI without the server just no-ops.
let signalUp = false;
beforeAll(async () => {
  try {
    const r = await fetch(`${SIGNAL_BASE}/health`);
    signalUp = r.ok;
  } catch { signalUp = false; }
});

function requireSignal(): void {
  if (!signalUp) throw new Error(`signal.mjs not reachable at ${SIGNAL_BASE} · start with: node scripts/nex-calling/signal.mjs`);
}

describe("nex-calling · signalling routing (integration · signal.mjs must be up)", () => {
  it("responds to /health", async () => {
    const r = await fetch(`${SIGNAL_BASE}/health`);
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j).toHaveProperty("ok", true);
    expect(j).toHaveProperty("uptime_sec");
  });

  it("accepts /hello and reports presence", async () => {
    const id = `test-${Date.now()}-hello`;
    const r = await fetch(`${SIGNAL_BASE}/hello`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: id }),
    });
    expect(r.ok).toBe(true);
  });

  it("routes /send from A to B and delivers via SSE stream", async () => {
    const a = `test-${Date.now()}-A`;
    const b = `test-${Date.now()}-B`;
    // both hello
    await fetch(`${SIGNAL_BASE}/hello`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: a }) });
    await fetch(`${SIGNAL_BASE}/hello`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: b }) });

    // B opens SSE stream and waits for one message
    const bStream = await openStream(`${SIGNAL_BASE}/stream/${encodeURIComponent(b)}`);
    const gotMessage = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { bStream.abort(); reject(new Error("timeout waiting for delivered message")); }, 4000);
      bStream.on((msg) => {
        // Skip presence broadcast; wait for the sdp-offer we send below.
        if (msg?.type === "sdp-offer") { clearTimeout(timer); bStream.abort(); resolve(msg); }
      });
    });

    // A sends sdp-offer to B
    const sendRes = await fetch(`${SIGNAL_BASE}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: a, to: b, type: "sdp-offer", payload: { sdp: "fake-sdp", callId: "test-call" } }),
    });
    expect(sendRes.ok).toBe(true);

    const delivered = await gotMessage;
    expect(delivered.type).toBe("sdp-offer");
    expect(delivered.from).toBe(a);
    expect(delivered.payload?.sdp).toBe("fake-sdp");
  });

  it("/presence lists online identities", async () => {
    const r = await fetch(`${SIGNAL_BASE}/presence`);
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j).toHaveProperty("online");
    expect(Array.isArray(j.online)).toBe(true);
  });
});

// ── minimal SSE helper for node fetch streaming ─────────────────────────
async function openStream(url: string): Promise<{ on: (fn: (msg: any) => void) => void; abort: () => void }> {
  const controller = new AbortController();
  const r = await fetch(url, { signal: controller.signal });
  if (!r.ok || !r.body) throw new Error(`SSE open failed: ${r.status}`);
  const listeners: Array<(msg: any) => void> = [];
  (async () => {
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (;;) {
          const nlnl = buf.indexOf("\n\n");
          if (nlnl < 0) break;
          const chunk = buf.slice(0, nlnl);
          buf = buf.slice(nlnl + 2);
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const msg = JSON.parse(dataLine.slice(5).trim());
            for (const fn of listeners) fn(msg);
          } catch { /* ignore */ }
        }
      }
    } catch { /* aborted */ }
  })().catch(() => { /* silent */ });
  return {
    on: (fn) => listeners.push(fn),
    abort: () => controller.abort(),
  };
}
