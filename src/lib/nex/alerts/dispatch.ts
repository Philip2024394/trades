// NEX Operational Alerts · dispatcher orchestrator
//
// Dispatchers are DUMB: they deliver an already-evaluated alert to
// a channel. They do NOT evaluate rules, filter severity, or decide
// dedup. Those are all handled by the evaluator.
//
// Channel config lives in env vars for MVP:
//   NEX_ALERTS_MIN_SEVERITY       'info'|'warning'|'critical'  (default 'warning')
//   NEX_ALERTS_EMAIL_TO           comma-separated recipient addresses
//   NEX_ALERTS_EMAIL_FROM         from-address (falls back to NEX Email Runtime default)
//   NEX_ALERTS_WEBHOOK_URL        POST target
//   NEX_ALERTS_SLACK_WEBHOOK_URL  Slack incoming webhook

import { withClient } from "@/lib/nex/delivery/db";
import type { Alert, DispatchChannel, Severity } from "./types";

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

function meetsMinSeverity(sev: Severity): boolean {
  const min = (process.env.NEX_ALERTS_MIN_SEVERITY ?? "warning").toLowerCase() as Severity;
  return SEVERITY_RANK[sev] >= (SEVERITY_RANK[min] ?? 1);
}

export type DispatchResult = { sent: number; failed: number; skipped: number };

export async function dispatchAlert(alert: Alert, channels: DispatchChannel[]): Promise<DispatchResult> {
  const out: DispatchResult = { sent: 0, failed: 0, skipped: 0 };

  if (!meetsMinSeverity(alert.severity)) {
    // Info-severity alerts don't dispatch when MIN_SEVERITY=warning ·
    // still record a skipped audit row so history is complete.
    for (const ch of channels) {
      await recordDispatch({ alert_id: alert.alert_id, channel: ch, status: "skipped", error: `severity ${alert.severity} < min ${process.env.NEX_ALERTS_MIN_SEVERITY ?? "warning"}`, latency_ms: 0 });
      out.skipped++;
    }
    return out;
  }

  for (const channel of channels) {
    const t0 = Date.now();
    try {
      const res = await dispatchOne(channel, alert);
      const latency_ms = Date.now() - t0;
      if (res.sent) {
        await recordDispatch({ alert_id: alert.alert_id, channel, status: "sent", destination: res.destination, latency_ms });
        out.sent++;
      } else if (res.skipped) {
        await recordDispatch({ alert_id: alert.alert_id, channel, status: "skipped", error: res.reason ?? "not configured", latency_ms });
        out.skipped++;
      } else {
        await recordDispatch({ alert_id: alert.alert_id, channel, status: "failed", error: res.error ?? "unknown", latency_ms });
        out.failed++;
      }
    } catch (e) {
      const latency_ms = Date.now() - t0;
      await recordDispatch({ alert_id: alert.alert_id, channel, status: "failed", error: e instanceof Error ? e.message : "exception", latency_ms });
      out.failed++;
    }
  }
  return out;
}

// ── One-of-N dispatch ────────────────────────────────────────────
type OneResult = { sent: true; destination: string } | { sent: false; skipped: true; reason: string } | { sent: false; skipped?: false; error: string };

async function dispatchOne(channel: DispatchChannel, alert: Alert): Promise<OneResult> {
  switch (channel) {
    case "email":   return dispatchEmail(alert);
    case "webhook": return dispatchWebhook(alert);
    case "slack":   return dispatchSlack(alert);
  }
}

// ── Email · via the NEX Email Runtime (transactional) ────────────
async function dispatchEmail(alert: Alert): Promise<OneResult> {
  const to = (process.env.NEX_ALERTS_EMAIL_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (to.length === 0) return { sent: false, skipped: true, reason: "NEX_ALERTS_EMAIL_TO not set" };

  const from = process.env.NEX_ALERTS_EMAIL_FROM ?? process.env.HAMMEREX_TRADE_FROM_EMAIL ?? "";
  if (!from) return { sent: false, skipped: true, reason: "sender address not configured" };

  // Call the internal /api/nex/email/send · keeps the Alert layer
  // decoupled from any specific email adapter.
  const base = process.env.NEX_PUBLIC_URL ?? "http://localhost:3008";
  try {
    const r = await fetch(`${base}/api/nex/email/send`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: to[0], to_bcc: to.slice(1), from,
        subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        html: renderAlertHtml(alert),
        text: renderAlertText(alert),
        kind: "transactional", caller: "nex-alerts",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return { sent: true, destination: to.join(",") };
    return { sent: false, error: `email endpoint ${r.status}` };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "email exception" };
  }
}

// ── Generic webhook ──────────────────────────────────────────────
async function dispatchWebhook(alert: Alert): Promise<OneResult> {
  const url = process.env.NEX_ALERTS_WEBHOOK_URL;
  if (!url) return { sent: false, skipped: true, reason: "NEX_ALERTS_WEBHOOK_URL not set" };
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(canonicalPayload(alert)),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return { sent: true, destination: hostOf(url) };
    return { sent: false, error: `webhook ${r.status}` };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "webhook exception" };
  }
}

// ── Slack incoming webhook ───────────────────────────────────────
async function dispatchSlack(alert: Alert): Promise<OneResult> {
  const url = process.env.NEX_ALERTS_SLACK_WEBHOOK_URL;
  if (!url) return { sent: false, skipped: true, reason: "NEX_ALERTS_SLACK_WEBHOOK_URL not set" };
  const emoji = alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "🟡" : "🔵";
  const payload = {
    text: `${emoji} *[${alert.severity.toUpperCase()}]* ${alert.title}`,
    attachments: [{
      color: alert.severity === "critical" ? "#f0665a" : alert.severity === "warning" ? "#f0b45a" : "#5aa6f0",
      title: alert.title,
      text: alert.detail ?? "",
      fields: [
        { title: "Rule",           value: alert.rule_id,          short: true },
        { title: "Trigger count",  value: String(alert.trigger_count), short: true },
        { title: "First detected", value: new Date(alert.first_detected_at).toISOString(), short: true },
        { title: "Last triggered", value: new Date(alert.last_triggered_at).toISOString(), short: true },
      ],
      footer: `alert_id ${alert.alert_id}`,
    }],
  };
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
    if (r.ok) return { sent: true, destination: hostOf(url) };
    return { sent: false, error: `slack ${r.status}` };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "slack exception" };
  }
}

// ── Shared helpers ───────────────────────────────────────────────
function canonicalPayload(alert: Alert) {
  return {
    type: "system.health_alert",
    alert_id: alert.alert_id, rule_id: alert.rule_id, incident_id: alert.incident_id,
    severity: alert.severity, state: alert.state,
    title: alert.title, detail: alert.detail,
    first_detected_at: alert.first_detected_at, last_triggered_at: alert.last_triggered_at,
    trigger_count: alert.trigger_count, snapshot: alert.snapshot,
  };
}

function renderAlertHtml(alert: Alert): string {
  const color = alert.severity === "critical" ? "#dc2626" : alert.severity === "warning" ? "#d97706" : "#2563eb";
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;padding:20px;">
    <div style="border-left:4px solid ${color};padding:12px 16px;background:#f9fafb;">
      <div style="font-size:11px;letter-spacing:.2em;font-weight:800;color:${color};">${alert.severity.toUpperCase()}</div>
      <h2 style="margin:4px 0 8px;font-size:20px;">${escape(alert.title)}</h2>
      <p style="margin:0 0 12px;color:#374151;">${escape(alert.detail ?? "")}</p>
      <table style="font-size:12px;color:#6b7280;">
        <tr><td style="padding:2px 8px 2px 0;">rule_id</td><td><code>${escape(alert.rule_id)}</code></td></tr>
        <tr><td style="padding:2px 8px 2px 0;">first detected</td><td>${escape(alert.first_detected_at)}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;">last triggered</td><td>${escape(alert.last_triggered_at)}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;">trigger count</td><td>${alert.trigger_count}</td></tr>
        ${alert.incident_id ? `<tr><td style="padding:2px 8px 2px 0;">incident</td><td><code>${escape(alert.incident_id)}</code></td></tr>` : ""}
      </table>
    </div>
    <p style="margin-top:16px;font-size:11px;color:#9ca3af;">alert_id ${escape(alert.alert_id)}</p>
  </body></html>`;
}
function renderAlertText(alert: Alert): string {
  return `[${alert.severity.toUpperCase()}] ${alert.title}\n\n${alert.detail ?? ""}\n\nrule_id: ${alert.rule_id}\nfirst detected: ${alert.first_detected_at}\nlast triggered: ${alert.last_triggered_at}\ntrigger count: ${alert.trigger_count}\n${alert.incident_id ? `incident: ${alert.incident_id}\n` : ""}alert_id: ${alert.alert_id}\n`;
}
function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return "unknown"; }
}

async function recordDispatch(input: {
  alert_id: string; channel: DispatchChannel;
  status: "sent" | "failed" | "skipped";
  destination?: string; error?: string; latency_ms: number;
}): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO nex.alert_dispatches (alert_id, channel, destination, status, error, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.alert_id, input.channel, input.destination ?? null, input.status, input.error ?? null, input.latency_ms],
    );
    return null;
  });
}

// ── Read helpers (used by UI + API) ──────────────────────────────
export async function recentDispatches(limit = 100) {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.alert_dispatches ORDER BY dispatched_at DESC LIMIT ${Math.max(1, Math.min(500, limit))}`);
    return res.rows;
  });
  return r ?? [];
}
