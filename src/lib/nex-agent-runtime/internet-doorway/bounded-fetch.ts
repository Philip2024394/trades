// WO-NEX-RUNTIME-09 · bounded streaming fetch.
//
// Founder-locked 2026-09-14. Streams bytes with a hard size cap. On
// reaching the cap it STOPS receiving · never accepts oversized data
// then truncates. Optional bounded diagnostic prefix retained for audit
// but MUST NOT be represented as the complete source.
//
// Uses Node's http/https core. A `transport` option allows injecting a
// deterministic in-process transport for tests · production uses the
// real HTTP client.

import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";

export interface BoundedFetchInput {
  readonly url: string;
  readonly method: "GET";
  readonly max_response_bytes: number;
  readonly timeout_ms: number;
  readonly follow_redirects: false;
  /** Test-only injection. If provided, the module bypasses http/https
   *  and calls this transport. Production leaves this undefined. */
  readonly transport?: BoundedFetchTransport;
}

export type BoundedFetchTransport = (req: {
  url: string;
  method: string;
  timeout_ms: number;
  max_response_bytes: number;
}) => Promise<BoundedFetchTransportResult>;

export interface BoundedFetchTransportResult {
  readonly status: number;
  readonly content_type: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly bytes: Buffer;                             // bytes actually received (bounded by transport)
  readonly aborted_due_to_size: boolean;
  readonly aborted_due_to_timeout: boolean;
}

export type BoundedFetchOutcome =
  | { kind: "ok"; status: number; content_type: string | null; bytes: Buffer; effective_host: string }
  | { kind: "size_exceeded"; status: number | null; content_type: string | null; bytes_received: number; effective_host: string; partial_prefix: Buffer }
  | { kind: "timeout"; effective_host: string }
  | { kind: "redirect_escape"; from_host: string; to_host: string; status: number }
  | { kind: "url_malformed"; detail: string }
  | { kind: "scheme_not_allowed"; scheme: string }
  | { kind: "errored"; detail: string };

/** Bounded fetch. Streams bytes, stops receiving as soon as the cap is
 *  hit. Returns detailed outcome so callers can build precise verdicts.
 *  Does NOT follow redirects · a redirect response with a Location that
 *  is a different host produces `redirect_escape`. */
export async function boundedFetch(input: BoundedFetchInput): Promise<BoundedFetchOutcome> {
  let parsed: URL;
  try { parsed = new URL(input.url); }
  catch (e) { return { kind: "url_malformed", detail: (e as Error).message }; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { kind: "scheme_not_allowed", scheme: parsed.protocol.replace(":", "") };
  }
  const effective_host = parsed.hostname.toLowerCase();

  // Test-injection transport
  if (input.transport) {
    const r = await input.transport({
      url: input.url, method: input.method,
      timeout_ms: input.timeout_ms, max_response_bytes: input.max_response_bytes,
    });
    if (r.aborted_due_to_timeout) return { kind: "timeout", effective_host };
    if (r.aborted_due_to_size) return {
      kind: "size_exceeded", status: r.status, content_type: r.content_type,
      bytes_received: r.bytes.length, effective_host,
      partial_prefix: r.bytes.subarray(0, Math.min(r.bytes.length, input.max_response_bytes)),
    };
    // Detect redirect responses whose Location changes origin (host:port).
    // Any 3xx with a differing origin is treated as an escape attempt.
    if (r.status >= 300 && r.status < 400 && typeof r.headers["location"] === "string") {
      try {
        const base = new URL(input.url);
        const loc = new URL(r.headers["location"], input.url);
        const fromOrigin = `${effective_host}:${base.port || (base.protocol === "https:" ? 443 : 80)}`;
        const toOrigin = `${loc.hostname.toLowerCase()}:${loc.port || (loc.protocol === "https:" ? 443 : 80)}`;
        if (toOrigin !== fromOrigin) {
          return { kind: "redirect_escape", from_host: effective_host, to_host: loc.hostname.toLowerCase(), status: r.status };
        }
      } catch { /* malformed location · fall through to ok result · caller decides */ }
    }
    return { kind: "ok", status: r.status, content_type: r.content_type, bytes: r.bytes, effective_host };
  }

  // Production path: real http/https client with byte-counter abort
  return realBoundedFetch(parsed, input.method, input.max_response_bytes, input.timeout_ms);
}

function realBoundedFetch(url: URL, method: "GET", max_bytes: number, timeout_ms: number): Promise<BoundedFetchOutcome> {
  const effective_host = url.hostname.toLowerCase();
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    let settled = false;
    const settle = (r: BoundedFetchOutcome) => { if (!settled) { settled = true; resolve(r); } };
    const chunks: Buffer[] = [];
    let received = 0;
    const req = client.request({
      protocol: url.protocol, hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search, method, headers: { "user-agent": "nex-internet-doorway/09" },
    }, (res) => {
      const status = res.statusCode ?? 0;
      const content_type = typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : null;
      // Redirect escape · compare full origin (host:port) so any origin
      // change (even same-hostname different-port) is treated as escape.
      if (status >= 300 && status < 400 && typeof res.headers.location === "string") {
        try {
          const loc = new URL(res.headers.location, url.toString());
          const fromOrigin = `${effective_host}:${url.port || (url.protocol === "https:" ? 443 : 80)}`;
          const toOrigin = `${loc.hostname.toLowerCase()}:${loc.port || (loc.protocol === "https:" ? 443 : 80)}`;
          if (toOrigin !== fromOrigin) {
            req.destroy();
            settle({ kind: "redirect_escape", from_host: effective_host, to_host: loc.hostname.toLowerCase(), status });
            return;
          }
        } catch { /* ignore */ }
      }
      res.on("data", (chunk: Buffer) => {
        if (settled) return;
        received += chunk.length;
        if (received > max_bytes) {
          const kept = Buffer.concat(chunks).subarray(0, max_bytes);
          req.destroy();
          settle({ kind: "size_exceeded", status, content_type, bytes_received: received, effective_host, partial_prefix: kept });
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        if (settled) return;
        settle({ kind: "ok", status, content_type, bytes: Buffer.concat(chunks), effective_host });
      });
      res.on("error", (e) => settle({ kind: "errored", detail: e.message }));
    });
    req.setTimeout(timeout_ms, () => {
      req.destroy();
      settle({ kind: "timeout", effective_host });
    });
    req.on("error", (e) => settle({ kind: "errored", detail: e.message }));
    req.end();
  });
}
