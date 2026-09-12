// Mock Overpass server for Slice 1f tests · zero external network calls.
// Script the response per test via `server.plan([...])`.
//
// Each plan step defines what the server does for the next incoming request:
//   { status: 200, body: '<json>', headers?: {...} }
//   { status: 502 }
//   { status: 429, retryAfter: 30 }
//   { status: 400, body: 'Query timed out' }
//   { status: 200, body: 'not-json' }          // malformed
//   { status: 200, body: '{"elements":[]}' }   // empty
//   { delayMs: 5000, status: 200, body: '...' }  // slow
//   { hang: true }                              // never respond
//
// Plan is a queue: each request consumes one step. If plan is empty, the
// server responds with { status: 500, body: 'no plan step' } (test misconfig).

import { createServer } from "node:http";

export function startMockOverpass({ port = 0 } = {}) {
  const plan = [];
  let requestsReceived = 0;
  const requestLog = [];
  const activeSockets = new Set();
  let currentReq = null;

  const server = createServer((req, res) => {
    requestsReceived++;
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const step = plan.shift() ?? { status: 500, body: "no plan step" };
      requestLog.push({ method: req.method, url: req.url, body, at: Date.now() });
      currentReq = { req, res, step };

      const applyResponse = () => {
        if (res.writableEnded) return;
        const headers = { "content-type": "application/json", ...(step.headers || {}) };
        if (step.retryAfter != null) headers["retry-after"] = String(step.retryAfter);
        if (step.requestId) headers["x-request-id"] = String(step.requestId);
        res.writeHead(step.status ?? 200, headers);
        res.end(step.body ?? "");
      };

      if (step.hang) {
        // Never respond · server holds the connection until client aborts or server closes
        return;
      }
      if (step.delayMs) {
        setTimeout(applyResponse, step.delayMs);
      } else {
        applyResponse();
      }
    });
  });

  server.on("connection", (socket) => {
    activeSockets.add(socket);
    socket.on("close", () => activeSockets.delete(socket));
  });

  const started = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolve({ port: address.port });
    });
  });

  return started.then(({ port: actualPort }) => ({
    port: actualPort,
    url:  `http://127.0.0.1:${actualPort}/api/interpreter`,
    /** Queue one or more scripted responses */
    plan: (...steps) => plan.push(...steps.flat()),
    /** Clear the queue + reset counters (for tests that assert "no additional requests") */
    reset: () => { plan.length = 0; requestLog.length = 0; requestsReceived = 0; },
    /** Introspection */
    requestsReceived: () => requestsReceived,
    requestLog: () => requestLog.slice(),
    /** Shutdown · closes sockets so hung requests unblock */
    stop: async () => {
      for (const s of activeSockets) { try { s.destroy(); } catch {} }
      await new Promise((resolve) => server.close(() => resolve()));
    },
  }));
}
