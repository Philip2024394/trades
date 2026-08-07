// NEX Email · in-memory queue (Phase 1)
//
// Simple per-process queue with concurrency cap + exponential retry. Every
// send that lands here goes through the adapter, then to the audit trail.
// Not persistent — good enough for Phase 1 (transactional sends survive
// via caller retries; bulk campaigns will land in Phase 6 with a
// persistent queue backed by nex.jobs).
//
// Doctrine: constitution_nex_email_runtime_8_phase_roadmap_2026_08_07.md

import { getEmail } from "./registry";
import { emailAudit } from "./audit";
import { checkCompliance, type ComplianceContact } from "./compliance";
import type { EmailKind, EmailMessage, SendResult } from "./types";

const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 500;

type QueueOptions = {
  maxConcurrency?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
};

type SendJob = {
  message: EmailMessage;
  contact?: ComplianceContact & { contact_id?: string };
  caller: string;
  campaign_id?: string;
  business_id?: string;
  onResult?: (r: SendResult & { blocked?: true; reason?: string }) => void;
};

class EmailQueue {
  private inFlight = 0;
  private waiting: Array<() => Promise<void>> = [];
  private readonly max: number;
  private readonly maxRetries: number;
  private readonly baseBackoff: number;
  private stats = { sent: 0, blocked: 0, failed: 0, in_flight: 0, waiting: 0 };

  constructor(opts: QueueOptions = {}) {
    this.max = opts.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseBackoff = opts.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  }

  snapshot() {
    return { ...this.stats, in_flight: this.inFlight, waiting: this.waiting.length };
  }

  enqueue(job: SendJob): Promise<SendResult & { blocked?: true; reason?: string }> {
    return new Promise((resolve) => {
      const task = async () => {
        const result = await this.execute(job);
        job.onResult?.(result);
        resolve(result);
      };
      if (this.inFlight < this.max) void this.run(task);
      else this.waiting.push(task);
    });
  }

  private async run(task: () => Promise<void>) {
    this.inFlight += 1;
    try { await task(); }
    finally {
      this.inFlight -= 1;
      const next = this.waiting.shift();
      if (next) void this.run(next);
    }
  }

  private async execute(job: SendJob): Promise<SendResult & { blocked?: true; reason?: string }> {
    const to = job.message.to[0];
    if (!to) {
      const failure: SendResult = { ok: false, provider: "queue", reason: "no recipient in message.to[]", retryable: false };
      return failure;
    }

    // Compliance gate · uses the contact if supplied, otherwise treats the raw address as consent-unknown.
    const complianceContact: ComplianceContact = job.contact ?? {
      email: to.address,
      consent_marketing: null,
      consent_transactional: null,
    };
    const gate = checkCompliance(complianceContact, job.message.kind);
    if (!gate.allowed) {
      this.stats.blocked += 1;
      await emailAudit.blocked({
        contact_id: job.contact?.contact_id ?? null,
        to_email: to.address,
        kind: job.message.kind,
        campaign_id: job.campaign_id ?? null,
        business_id: job.business_id ?? null,
        caller: job.caller,
        reason: gate.reason,
        detail: gate.detail,
      });
      return { ok: false, provider: "queue", reason: `blocked: ${gate.reason} · ${gate.detail}`, retryable: false, blocked: true } as SendResult & { blocked: true; reason: string };
    }

    // Send with retry
    const adapter = getEmail();
    let attempt = 0;
    let lastFailure: SendResult & { ok: false } = { ok: false, provider: adapter.name, reason: "no attempt", retryable: false };
    while (attempt <= this.maxRetries) {
      const started = Date.now();
      const result = await adapter.send(job.message);
      const latency = Date.now() - started;
      if (result.ok) {
        this.stats.sent += 1;
        await emailAudit.sent({
          contact_id: job.contact?.contact_id ?? null,
          to_email: to.address,
          kind: job.message.kind,
          campaign_id: job.campaign_id ?? null,
          business_id: job.business_id ?? null,
          caller: job.caller,
          provider: result.provider,
          provider_message_id: result.provider_message_id,
          latency_ms: latency,
        });
        return result;
      }
      lastFailure = result;
      if (!result.retryable || attempt === this.maxRetries) break;
      await new Promise((r) => setTimeout(r, this.baseBackoff * 2 ** attempt));
      attempt += 1;
    }

    this.stats.failed += 1;
    await emailAudit.failed({
      contact_id: job.contact?.contact_id ?? null,
      to_email: to.address,
      kind: job.message.kind,
      campaign_id: job.campaign_id ?? null,
      business_id: job.business_id ?? null,
      caller: job.caller,
      provider: lastFailure.provider,
      reason: lastFailure.reason,
      retryable: lastFailure.retryable,
      latency_ms: 0,
    });
    return lastFailure;
  }
}

// One shared queue per process. Sufficient for Phase 1.
let queue: EmailQueue | null = null;

export function getEmailQueue(): EmailQueue {
  if (!queue) queue = new EmailQueue();
  return queue;
}

/** High-level entry point. Every caller (route · worker · library) uses this. */
export async function sendEmail(job: SendJob) {
  return getEmailQueue().enqueue(job);
}
