#!/usr/bin/env node
// scripts/nex-calling/signal.mjs
//
// NEX Internal Calling · Stage 1 signalling server · Philip 2026-08-27.
//
// ZERO NEW DEPENDENCIES. Uses only Node built-in modules.
// SSE (Server-Sent Events) for server→client · POST for client→server.
// No WebSocket library required.
//
// Signalling only. Never touches media. When two browsers exchange SDP + ICE
// via this server, WebRTC establishes a direct P2P connection between them.
// The measurement log records whether media actually bypassed this server.
//
// Endpoints:
//   GET  /health                       liveness check
//   POST /hello                        register identity {identity}
//   GET  /stream/:identity             SSE · receive messages for this identity
//   POST /send                         route message {from, to, type, payload}
//   POST /measure                      append call event to JSONL
//   GET  /presence                     list currently-connected identities
//
// Run: node scripts/nex-calling/signal.mjs
// Port: NEX_CALL_SIGNAL_PORT (default 8090)

import { createServer } from "node:http";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVENTS_LOG = join(__dirname, "..", "..", "data", "nex-calling", "call_events.jsonl");
if (!existsSync(dirname(EVENTS_LOG))) mkdirSync(dirname(EVENTS_LOG), { recursive: true });

const PORT = Number(process.env.NEX_CALL_SIGNAL_PORT ?? 8090);

// In-memory state · Stage 1 · single process · dies with the process.
// This is deliberate: zero external state, zero external cost. Presence
// persistence is not a Stage 1 concern.
const streams = new Map();          // identity → SSE ServerResponse
const helloTs  = new Map();          // identity → last seen ms

function logEvent(evt) {
  const line = JSON.stringify({ ts: Date.now(), ...evt }) + "\n";
  try { appendFileSync(EVENTS_LOG, line, "utf8"); } catch { /* silent · dev only */ }
}

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      if (buf.length === 0) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(obj));
}

function pushToIdentity(identity, message) {
  const res = streams.get(identity);
  if (!res) return false;
  try {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
    return true;
  } catch { return false; }
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    });
    return res.end();
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // ── Health check ──
  if (url.pathname === "/health" && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      identities_online: streams.size,
      uptime_sec: Math.round(process.uptime()),
      events_log: EVENTS_LOG,
    });
  }

  // ── Presence list ──
  if (url.pathname === "/presence" && req.method === "GET") {
    return sendJson(res, 200, {
      online: Array.from(streams.keys()),
      last_seen: Object.fromEntries(helloTs),
    });
  }

  // ── Register identity ──
  if (url.pathname === "/hello" && req.method === "POST") {
    try {
      const body = await jsonBody(req);
      const identity = String(body.identity ?? "").trim();
      if (!identity) return sendJson(res, 400, { error: "identity required" });
      helloTs.set(identity, Date.now());
      logEvent({ kind: "hello", identity });
      // Notify other clients that presence changed
      const online = Array.from(streams.keys());
      for (const other of online) {
        if (other !== identity) pushToIdentity(other, { type: "presence", online });
      }
      return sendJson(res, 200, { ok: true, online });
    } catch (err) {
      return sendJson(res, 400, { error: "bad json" });
    }
  }

  // ── SSE stream (server → client) ──
  if (url.pathname.startsWith("/stream/") && req.method === "GET") {
    const identity = decodeURIComponent(url.pathname.slice("/stream/".length));
    if (!identity) return sendJson(res, 400, { error: "identity required" });
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
      "x-accel-buffering": "no",
    });
    // Comment line prevents proxy buffering
    res.write(": nex-calling stream open\n\n");
    streams.set(identity, res);
    helloTs.set(identity, Date.now());
    logEvent({ kind: "stream_open", identity });
    // Broadcast presence
    const online = Array.from(streams.keys());
    for (const id of online) pushToIdentity(id, { type: "presence", online });
    // Heartbeat every 20 sec keeps the connection warm
    const hb = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch { /* connection dead */ }
    }, 20000);
    req.on("close", () => {
      clearInterval(hb);
      streams.delete(identity);
      logEvent({ kind: "stream_close", identity });
      const stillOnline = Array.from(streams.keys());
      for (const id of stillOnline) pushToIdentity(id, { type: "presence", online: stillOnline });
    });
    return;
  }

  // ── Send message (client → target) ──
  if (url.pathname === "/send" && req.method === "POST") {
    try {
      const body = await jsonBody(req);
      const { from, to, type, payload } = body;
      if (!from || !to || !type) return sendJson(res, 400, { error: "from, to, type required" });
      const delivered = pushToIdentity(to, { type, from, payload });
      logEvent({ kind: "send", from, to, message_type: type, delivered });
      return sendJson(res, 200, { delivered });
    } catch {
      return sendJson(res, 400, { error: "bad json" });
    }
  }

  // ── Measurement event ──
  if (url.pathname === "/measure" && req.method === "POST") {
    try {
      const body = await jsonBody(req);
      logEvent({ kind: "measure", ...body });
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { error: "bad json" });
    }
  }

  return sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`[nex-calling/signal] listening on http://localhost:${PORT}`);
  console.log(`[nex-calling/signal] events → ${EVENTS_LOG}`);
});

process.on("SIGINT", () => {
  console.log(`\n[nex-calling/signal] shutting down`);
  for (const [id, res] of streams) { try { res.end(); } catch { /* ignore */ } }
  server.close(() => process.exit(0));
});
