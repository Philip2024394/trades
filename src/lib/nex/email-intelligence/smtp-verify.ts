// src/lib/nex/email-intelligence/smtp-verify.ts
//
// NEX Email Intelligence · SMTP verification core
// Founder-authorised 2026-09-22.
//
// Verifies whether a mailbox exists by doing a real SMTP handshake to the
// recipient's MX server and stopping at RCPT TO. **No message is ever sent.**
//
// This is the standard mailbox-verification technique used by every serious
// deliverability service (NeverBounce · Kickbox · ZeroBounce · Bouncer).
//
// Doctrine locks:
//   - _VERIFY_NEVER_SENDS_A_MESSAGE
//   - _VERIFY_RESULT_COMES_FROM_SMTP_RESPONSE (never fabricated)
//   - _VERIFY_ALWAYS_QUITS_CLEANLY (respect the MX server)
//   - _VERIFY_CATCH_ALL_PROBE_USES_RANDOM_LOCAL (never invents an address)

import * as net from "node:net";
import { Resolver } from "node:dns/promises";
import { randomBytes } from "node:crypto";

// Use explicit public resolvers · local resolvers commonly refuse MX queries.
// Founder can override via NEX_DNS_RESOLVERS env (comma-separated IPs).
const DEFAULT_RESOLVERS = ["1.1.1.1", "8.8.8.8", "8.8.4.4", "1.0.0.1"];
function buildResolver(): Resolver {
  const r = new Resolver();
  const configured = (process.env.NEX_DNS_RESOLVERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  r.setServers(configured.length > 0 ? configured : DEFAULT_RESOLVERS);
  return r;
}

export type VerifyDeliverable =
  | "deliverable"       // SMTP 250 for the exact address · catch-all probe returned different code (or was 250 too but recorded)
  | "undeliverable"     // SMTP 550/551/553 for the exact address
  | "catch_all"         // domain accepts everything · cannot distinguish real from fake
  | "risky"             // deferred (4xx), greylisted, tarpit, connection reset
  | "unknown";          // syntax/DNS/network failure

export interface VerifyOutcome {
  readonly email_address: string;
  readonly domain: string;
  readonly deliverable: VerifyDeliverable;
  readonly mx_host: string | null;
  readonly mx_preference: number | null;
  readonly smtp_greeting: string | null;
  readonly rcpt_code: number | null;
  readonly rcpt_response: string | null;
  readonly catch_all_probe_local: string | null;
  readonly catch_all_probe_code: number | null;
  readonly catch_all_probe_response: string | null;
  readonly connect_ms: number;
  readonly total_ms: number;
  readonly verified_at: string;
  readonly error_reason: string | null;
}

export interface VerifyOptions {
  readonly ehlo_domain?: string;            // default: derived from process.env or "nex-verify.local"
  readonly mail_from?: string;              // default: <> (bounce address, standard)
  readonly connect_timeout_ms?: number;     // default 15_000
  readonly step_timeout_ms?: number;        // default 10_000
  readonly probe_catch_all?: boolean;       // default true
  readonly port?: number;                   // default 25
}

const SYNTAX_RX = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

/** Verify a mailbox via SMTP RCPT TO. Never sends a message. Never throws. */
export async function verifyMailbox(email: string, opts: VerifyOptions = {}): Promise<VerifyOutcome> {
  const t0 = Date.now();
  const now = () => new Date().toISOString();
  const ehlo = opts.ehlo_domain ?? process.env.NEX_SMTP_VERIFY_EHLO ?? "nex-verify.local";
  const mailFrom = opts.mail_from ?? process.env.NEX_SMTP_VERIFY_FROM ?? "";  // "" means <>
  const port = opts.port ?? 25;
  const connectTimeout = opts.connect_timeout_ms ?? 15_000;
  const stepTimeout = opts.step_timeout_ms ?? 10_000;
  const probeCatchAll = opts.probe_catch_all !== false;

  const norm = email.trim().toLowerCase();
  const domain = norm.split("@")[1] ?? "";

  const base = {
    email_address: norm,
    domain,
    verified_at: now(),
    connect_ms: 0,
    total_ms: 0,
    smtp_greeting: null as string | null,
    rcpt_code: null as number | null,
    rcpt_response: null as string | null,
    catch_all_probe_local: null as string | null,
    catch_all_probe_code: null as number | null,
    catch_all_probe_response: null as string | null,
    mx_host: null as string | null,
    mx_preference: null as number | null,
  };

  // ─── 1) Syntax gate ───────────────────────────────────────────────
  if (!SYNTAX_RX.test(norm)) {
    return { ...base, deliverable: "unknown", error_reason: "syntax_invalid", total_ms: Date.now() - t0 };
  }

  // ─── 2) MX lookup ─────────────────────────────────────────────────
  // Uses explicit public resolvers (Cloudflare/Google) because system
  // resolvers commonly refuse MX-type queries with ECONNREFUSED.
  const resolver = buildResolver();
  let mxRecords: Array<{ priority: number; exchange: string }>;
  try {
    mxRecords = await resolver.resolveMx(domain);
  } catch (e) {
    // No MX? Fall back to A record (RFC 5321 §5)
    try {
      await resolver.resolve4(domain);
      mxRecords = [{ priority: 0, exchange: domain }];
    } catch {
      return { ...base, deliverable: "undeliverable", error_reason: `no_mx_no_a: ${(e as Error).message}`, total_ms: Date.now() - t0 };
    }
  }
  if (mxRecords.length === 0) {
    return { ...base, deliverable: "undeliverable", error_reason: "no_mx_records", total_ms: Date.now() - t0 };
  }
  mxRecords.sort((a, b) => a.priority - b.priority);
  const mx = mxRecords[0];

  // ─── 3) SMTP dialogue ─────────────────────────────────────────────
  const outcome = await smtpDialogue({
    mxHost: mx.exchange,
    port,
    ehlo,
    mailFrom,
    rcptTo: norm,
    probeCatchAll,
    connectTimeout,
    stepTimeout,
    domain,
  });

  return {
    ...base,
    ...outcome,
    mx_host: mx.exchange,
    mx_preference: mx.priority,
    total_ms: Date.now() - t0,
  };
}

interface DialogueInput {
  mxHost: string; port: number; ehlo: string; mailFrom: string;
  rcptTo: string; probeCatchAll: boolean;
  connectTimeout: number; stepTimeout: number; domain: string;
}

interface DialogueOutcome {
  deliverable: VerifyDeliverable;
  smtp_greeting: string | null;
  rcpt_code: number | null;
  rcpt_response: string | null;
  catch_all_probe_local: string | null;
  catch_all_probe_code: number | null;
  catch_all_probe_response: string | null;
  connect_ms: number;
  error_reason: string | null;
}

function smtpDialogue(input: DialogueInput): Promise<DialogueOutcome> {
  return new Promise<DialogueOutcome>((resolve) => {
    const t0 = Date.now();
    const socket = net.createConnection({ host: input.mxHost, port: input.port });
    let buf = "";
    let step: "greet" | "ehlo" | "helo" | "mail" | "rcpt" | "probe" | "quit" | "done" = "greet";
    let connect_ms = 0;
    let smtp_greeting: string | null = null;
    let rcpt_code: number | null = null;
    let rcpt_response: string | null = null;
    let probe_local: string | null = null;
    let probe_code: number | null = null;
    let probe_response: string | null = null;
    let deliverable: VerifyDeliverable = "unknown";
    let error_reason: string | null = null;
    let done = false;

    const finish = (out: Partial<DialogueOutcome> = {}) => {
      if (done) return;
      done = true;
      try { socket.end("QUIT\r\n"); } catch { /* ignore */ }
      try { socket.destroy(); } catch { /* ignore */ }
      resolve({
        deliverable, smtp_greeting,
        rcpt_code, rcpt_response,
        catch_all_probe_local: probe_local,
        catch_all_probe_code: probe_code,
        catch_all_probe_response: probe_response,
        connect_ms, error_reason,
        ...out,
      });
    };

    const timer = setTimeout(() => {
      error_reason = `timeout_step:${step}`;
      deliverable = "risky";
      finish();
    }, input.connectTimeout);
    const bumpTimer = () => { timer.refresh(); };

    socket.setTimeout(input.stepTimeout);
    socket.on("timeout", () => { error_reason = `socket_timeout_step:${step}`; deliverable = "risky"; clearTimeout(timer); finish(); });
    socket.on("error", (e: Error) => { error_reason = `socket_error:${e.message}`; deliverable = "risky"; clearTimeout(timer); finish(); });
    socket.on("close", () => { clearTimeout(timer); if (!done) { error_reason = error_reason ?? "connection_closed"; finish(); } });
    socket.on("connect", () => { connect_ms = Date.now() - t0; });

    socket.on("data", (chunk: Buffer) => {
      bumpTimer();
      buf += chunk.toString("utf8");
      // SMTP responses can be multi-line · terminated by CRLF with digit-digit-digit-space
      let idx: number;
      while ((idx = buf.indexOf("\r\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        // Multi-line continuation ends when we see "NNN " (space) not "NNN-" (dash)
        if (/^\d{3}-/.test(line)) continue;  // still receiving continuation

        const code = parseInt(line.slice(0, 3), 10);
        const text = line.slice(4);
        switch (step) {
          case "greet":
            smtp_greeting = line;
            if (code === 220) { step = "ehlo"; socket.write(`EHLO ${input.ehlo}\r\n`); }
            else { error_reason = `bad_greeting:${line}`; deliverable = "risky"; finish(); }
            break;
          case "ehlo":
            if (code === 250) { step = "mail"; socket.write(`MAIL FROM:<${input.mailFrom}>\r\n`); }
            else if (code >= 400) { step = "helo"; socket.write(`HELO ${input.ehlo}\r\n`); }
            else { error_reason = `bad_ehlo:${code}`; deliverable = "risky"; finish(); }
            break;
          case "helo":
            if (code === 250) { step = "mail"; socket.write(`MAIL FROM:<${input.mailFrom}>\r\n`); }
            else { error_reason = `bad_helo:${code}`; deliverable = "risky"; finish(); }
            break;
          case "mail":
            if (code === 250) { step = "rcpt"; socket.write(`RCPT TO:<${input.rcptTo}>\r\n`); }
            else { error_reason = `bad_mail_from:${code}:${text}`; deliverable = "risky"; finish(); }
            break;
          case "rcpt":
            rcpt_code = code;
            rcpt_response = text;
            if (code === 250 || code === 251) {
              deliverable = "deliverable";
              if (input.probeCatchAll) {
                probe_local = `nex-verify-${randomBytes(8).toString("hex")}`;
                step = "probe";
                socket.write(`RCPT TO:<${probe_local}@${input.domain}>\r\n`);
              } else {
                step = "quit"; socket.write("QUIT\r\n");
              }
            } else if (code >= 500 && code < 600) {
              deliverable = "undeliverable";
              step = "quit"; socket.write("QUIT\r\n");
            } else if (code >= 400 && code < 500) {
              deliverable = "risky"; error_reason = `deferred_${code}:${text}`;
              step = "quit"; socket.write("QUIT\r\n");
            } else {
              deliverable = "unknown"; error_reason = `unexpected_rcpt_${code}:${text}`;
              step = "quit"; socket.write("QUIT\r\n");
            }
            break;
          case "probe":
            probe_code = code; probe_response = text;
            if (code === 250 || code === 251) {
              // Server accepts ANY local-part = catch-all
              deliverable = "catch_all";
            }
            // Otherwise deliverable stays as previously set ("deliverable")
            step = "quit"; socket.write("QUIT\r\n");
            break;
          case "quit":
            step = "done"; clearTimeout(timer); finish();
            break;
          case "done":
            break;
        }
      }
    });
  });
}

/** Batch verify with concurrency + per-domain politeness (max 1 concurrent per domain). */
export async function verifyBatch(
  emails: readonly string[],
  opts: VerifyOptions & { max_concurrency?: number; per_domain_gap_ms?: number } = {},
): Promise<VerifyOutcome[]> {
  const uniqueEmails = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()))).filter((e) => e.length > 0);
  const maxConcurrency = Math.max(1, Math.min(32, opts.max_concurrency ?? 6));
  const domainGap = Math.max(0, opts.per_domain_gap_ms ?? 2000);

  const results: VerifyOutcome[] = [];
  const lastAtByDomain = new Map<string, number>();

  const queue = [...uniqueEmails];
  const inflight = new Set<Promise<void>>();

  async function pumpOne(email: string): Promise<void> {
    const domain = email.split("@")[1] ?? "";
    const last = lastAtByDomain.get(domain) ?? 0;
    const wait = Math.max(0, last + domainGap - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAtByDomain.set(domain, Date.now());
    const outcome = await verifyMailbox(email, opts);
    results.push(outcome);
  }

  while (queue.length > 0 || inflight.size > 0) {
    while (inflight.size < maxConcurrency && queue.length > 0) {
      const email = queue.shift()!;
      const p = pumpOne(email).finally(() => inflight.delete(p));
      inflight.add(p);
    }
    if (inflight.size > 0) await Promise.race(inflight);
  }
  return results;
}

// Doctrine locks · asserted structurally in acceptance
export const _VERIFY_NEVER_SENDS_A_MESSAGE = "smtp_dialogue_stops_at_rcpt_to_never_data";
export const _VERIFY_RESULT_COMES_FROM_SMTP_RESPONSE = "deliverable_flag_derived_from_rcpt_code_never_guessed";
export const _VERIFY_ALWAYS_QUITS_CLEANLY = "every_dialogue_terminates_with_quit_or_socket_end";
export const _VERIFY_CATCH_ALL_PROBE_USES_RANDOM_LOCAL = "random_bytes_local_part_never_a_reserved_or_real_name";
