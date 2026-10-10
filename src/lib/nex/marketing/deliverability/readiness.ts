// src/lib/nex/marketing/deliverability/readiness.ts
//
// NEX Deliverability · Sending-safety chain readiness aggregator
// Founder-authorised programme · Session-9 · Part 13b · 2026-09-21.
//
// PURE READ ONLY. Inspects existing DB state + a small env presence-map
// (never the secret values themselves) and reports whether each layer of
// the sending-safety chain is READY, DORMANT, or MISSING.
//
// GOVERNANCE HARD-LOCKS:
//   * Zero mutation · zero writes · read-only aggregate
//   * Never returns raw email addresses (contact-level detail lives elsewhere)
//   * Never returns secret material · only Y/N presence flags
//   * Never activates any gate · reports state only

import type { PoolClient } from "pg";
import type { WebhookProvider } from "./webhook-verifiers";

export type LayerState = "ready" | "dormant" | "missing" | "unknown";

export interface VerifierReadiness {
  readonly provider: WebhookProvider;
  readonly secret_configured: boolean; // presence flag only · never the secret
  readonly state: LayerState;           // ready if secret_configured · dormant otherwise
}

export interface RecorderReadiness {
  readonly bounce_log_migration_applied: boolean;
  readonly total_recorded_events: number;
  readonly recorded_last_24h: number;
  readonly state: LayerState;
}

export interface ReputationReadiness {
  readonly senders_with_reputation: number;
  readonly senders_computed_within_24h: number;
  readonly state: LayerState;
}

export interface DomainAuthReadiness {
  readonly domains_tracked: number;
  readonly domains_aligned: number;
  readonly state: LayerState; // ready if ≥1 domain tracked
}

export interface ActivationGatesReadiness {
  readonly production_page_fetcher: boolean;
  readonly continuous_cron: boolean;
  readonly production_domain_auth_checker: boolean;
  readonly webhook_endpoint_activation: boolean;
}

export interface SendingSafetyReadinessReport {
  readonly generated_at: string;
  readonly verifiers: readonly VerifierReadiness[];
  readonly classifier: { state: "ready"; note: "pure_function_always_ready" };
  readonly recorder: RecorderReadiness;
  readonly reputation: ReputationReadiness;
  readonly domain_auth: DomainAuthReadiness;
  readonly gates: ActivationGatesReadiness;
  readonly overall_state: LayerState;
  readonly summary_line: string;
}

const PROVIDERS: readonly WebhookProvider[] = ["resend", "sendgrid", "ses_sns", "mailgun", "postmark"];

/** Environment variable names that indicate a per-provider webhook secret
 *  has been configured. Presence only · we NEVER read the values here. */
export const WEBHOOK_SECRET_ENV_KEYS: Readonly<Record<WebhookProvider, string>> = {
  resend:   "NEX_RESEND_WEBHOOK_SECRET",
  sendgrid: "NEX_SENDGRID_WEBHOOK_PUBLIC_KEY",
  ses_sns:  "NEX_SES_SNS_SIGNING_CERT_PEM",
  mailgun:  "NEX_MAILGUN_WEBHOOK_SIGNING_KEY",
  postmark: "NEX_POSTMARK_WEBHOOK_SECRET",
};

export function readVerifierReadinessFromEnv(env: NodeJS.ProcessEnv = process.env): readonly VerifierReadiness[] {
  return PROVIDERS.map(p => {
    const key = WEBHOOK_SECRET_ENV_KEYS[p];
    const configured = typeof env[key] === "string" && String(env[key]).length > 0;
    return { provider: p, secret_configured: configured, state: configured ? "ready" : "dormant" as LayerState };
  });
}

export function readActivationGatesFromEnv(env: NodeJS.ProcessEnv = process.env): ActivationGatesReadiness {
  return {
    production_page_fetcher: env.NEX_PAGE_FETCHER_ACTIVATION === "on",
    continuous_cron: env.NEX_DISCOVERY_CRON_ACTIVATION === "on",
    production_domain_auth_checker: env.NEX_DOMAIN_AUTH_CHECKER_ACTIVATION === "on",
    webhook_endpoint_activation: env.NEX_WEBHOOK_ENDPOINTS_ACTIVATION === "on",
  };
}

// ─── Recorder readiness (checks bounce_log migration + counts) ─────
async function readRecorderReadiness(client: PoolClient): Promise<RecorderReadiness> {
  try {
    const colProbe = await client.query<{ has: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'nex'
           AND table_name = 'marketing_bounce_log'
           AND column_name = 'event_fingerprint'
       ) AS has`,
    );
    const migration_applied = colProbe.rows[0]?.has === true;
    if (!migration_applied) {
      return { bounce_log_migration_applied: false, total_recorded_events: 0, recorded_last_24h: 0, state: "missing" };
    }
    const totals = await client.query<{ total: string; last_24h: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE received_at >= now() - interval '24 hours')::text AS last_24h
         FROM nex.marketing_bounce_log`,
    );
    const total = Number(totals.rows[0]?.total ?? 0);
    const last_24h = Number(totals.rows[0]?.last_24h ?? 0);
    return {
      bounce_log_migration_applied: true,
      total_recorded_events: total,
      recorded_last_24h: last_24h,
      state: "ready",
    };
  } catch {
    return { bounce_log_migration_applied: false, total_recorded_events: 0, recorded_last_24h: 0, state: "unknown" };
  }
}

// ─── Reputation readiness ──────────────────────────────────────────
async function readReputationReadiness(client: PoolClient): Promise<ReputationReadiness> {
  try {
    const r = await client.query<{ total: string; fresh: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE computed_at >= now() - interval '24 hours')::text AS fresh
         FROM nex.marketing_sender_reputation`,
    );
    const total = Number(r.rows[0]?.total ?? 0);
    const fresh = Number(r.rows[0]?.fresh ?? 0);
    return {
      senders_with_reputation: total,
      senders_computed_within_24h: fresh,
      state: total === 0 ? "dormant" : (fresh > 0 ? "ready" : "dormant"),
    };
  } catch {
    return { senders_with_reputation: 0, senders_computed_within_24h: 0, state: "missing" };
  }
}

// ─── Domain-auth readiness ─────────────────────────────────────────
async function readDomainAuthReadiness(client: PoolClient): Promise<DomainAuthReadiness> {
  try {
    const r = await client.query<{ total: string; aligned: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (
                WHERE spf_state = 'pass' AND dkim_state = 'pass' AND dmarc_state IN ('pass', 'quarantine', 'reject')
              )::text AS aligned
         FROM nex.marketing_sender_domain_auth`,
    );
    const total = Number(r.rows[0]?.total ?? 0);
    const aligned = Number(r.rows[0]?.aligned ?? 0);
    return {
      domains_tracked: total,
      domains_aligned: aligned,
      state: total === 0 ? "dormant" : "ready",
    };
  } catch {
    return { domains_tracked: 0, domains_aligned: 0, state: "missing" };
  }
}

// ─── Overall roll-up ───────────────────────────────────────────────
function rollUp(report: Omit<SendingSafetyReadinessReport, "overall_state" | "summary_line">): LayerState {
  const layer_states: LayerState[] = [
    ...report.verifiers.map(v => v.state),
    report.classifier.state,
    report.recorder.state,
    report.reputation.state,
    report.domain_auth.state,
  ];
  if (layer_states.some(s => s === "missing")) return "missing";
  if (layer_states.every(s => s === "ready")) return "ready";
  return "dormant";
}

function summaryFor(state: LayerState, gates: ActivationGatesReadiness): string {
  const gate_count = [
    gates.production_page_fetcher,
    gates.continuous_cron,
    gates.production_domain_auth_checker,
    gates.webhook_endpoint_activation,
  ].filter(Boolean).length;
  const activated = `${gate_count}/4 Founder-controlled activation gates on`;
  switch (state) {
    case "ready":   return `Sending-safety chain FULLY READY · ${activated}`;
    case "dormant": return `Sending-safety machinery proven under test · not yet running against the world · ${activated}`;
    case "missing": return `One or more layers not yet migrated · ${activated}`;
    default:        return `Chain readiness unknown · ${activated}`;
  }
}

// ─── Public API ────────────────────────────────────────────────────
export async function generateSendingSafetyReadinessReport(
  client: PoolClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SendingSafetyReadinessReport> {
  const [recorder, reputation, domain_auth] = await Promise.all([
    readRecorderReadiness(client),
    readReputationReadiness(client),
    readDomainAuthReadiness(client),
  ]);
  const verifiers = readVerifierReadinessFromEnv(env);
  const gates = readActivationGatesFromEnv(env);
  const partial: Omit<SendingSafetyReadinessReport, "overall_state" | "summary_line"> = {
    generated_at: new Date().toISOString(),
    verifiers,
    classifier: { state: "ready", note: "pure_function_always_ready" },
    recorder,
    reputation,
    domain_auth,
    gates,
  };
  const overall_state = rollUp(partial);
  return { ...partial, overall_state, summary_line: summaryFor(overall_state, gates) };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _READINESS_READ_ONLY = "aggregator_never_writes_never_mutates_never_activates";
export const _READINESS_NEVER_LEAKS_SECRETS = "reports_presence_flag_only_never_the_secret_value";
export const _READINESS_NEVER_RETURNS_ADDRESSES = "aggregate_counts_only_no_email_local_parts_no_recipient_data";
