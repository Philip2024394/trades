"use client";

// Webhook diagnostic surface.
//
// One row per incoming webhook. Merchants use this to debug provider
// setup — signature failures, missing brand credentials, replay
// issues. Click a row to expand the raw payload + headers preview.

import { useCallback, useEffect, useState } from "react";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";
const BLUE = "#2563EB";
const NEUTRAL = "#525252";

type WebhookEvent = {
  id: string;
  providerId: string;
  brandId: string | null;
  eventType: string | null;
  externalRef: string | null;
  matchedOrderId: string | null;
  signatureVerified: boolean;
  httpStatus: number;
  outcome: "updated" | "ignored" | "failed" | "no-processor" | "no-brands";
  outcomeDetail: string;
  payloadPreview: string;
  headersPreview: Record<string, string>;
  latencyMs: number;
  receivedAt: string;
};

const OUTCOME_COLOR: Record<WebhookEvent["outcome"], string> = {
  updated: GREEN,
  ignored: BLUE,
  failed: RED,
  "no-processor": AMBER,
  "no-brands": AMBER
};

export function PaymentWebhookLog() {
  const [events, setEvents] = useState<WebhookEvent[] | null>(null);
  const [provider, setProvider] = useState<string>("all");
  const [outcome, setOutcome] = useState<string>("all");
  const [verified, setVerified] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const url = new URL(
        "/api/studio/payments/webhooks",
        window.location.origin
      );
      url.searchParams.set("provider", provider);
      url.searchParams.set("outcome", outcome);
      url.searchParams.set("verified", verified);
      const res = await fetch(url.toString());
      const json = (await res.json()) as
        | { ok: true; events: WebhookEvent[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setEvents(json.events);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }, [provider, outcome, verified]);

  useEffect(() => {
    void load();
  }, [load]);

  const providers = events
    ? Array.from(new Set(events.map((e) => e.providerId))).sort()
    : [];

  const roll = events
    ? {
        total: events.length,
        updated: events.filter((e) => e.outcome === "updated").length,
        ignored: events.filter((e) => e.outcome === "ignored").length,
        failed: events.filter(
          (e) => e.outcome === "failed" || e.outcome === "no-brands"
        ).length,
        avgLatency: events.length
          ? Math.round(
              events.reduce((sum, e) => sum + (e.latencyMs ?? 0), 0) /
                events.length
            )
          : 0
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Webhooks
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Every incoming webhook. Verified or not.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Every event a provider POSTs to your webhook route is logged
        here — with the signature verification result, the matched
        order, the raw payload preview, and the interesting headers.
        Debug your Stripe / PayPal / Mollie setup at a glance.
      </p>

      {roll && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card label="Total" value={String(roll.total)} colour={NEUTRAL} />
          <Card label="Updated" value={String(roll.updated)} colour={GREEN} />
          <Card label="Ignored" value={String(roll.ignored)} colour={BLUE} />
          <Card label="Failed" value={String(roll.failed)} colour={RED} />
          <Card
            label="Avg latency"
            value={`${roll.avgLatency}ms`}
            colour={YELLOW}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Selector
          label="Provider"
          value={provider}
          options={[{ value: "all", label: "All" }].concat(
            providers.map((p) => ({ value: p, label: p }))
          )}
          onChange={setProvider}
        />
        <Selector
          label="Outcome"
          value={outcome}
          options={[
            { value: "all", label: "All" },
            { value: "updated", label: "Updated" },
            { value: "ignored", label: "Ignored" },
            { value: "failed", label: "Failed" },
            { value: "no-processor", label: "No processor" },
            { value: "no-brands", label: "No brands" }
          ]}
          onChange={setOutcome}
        />
        <Selector
          label="Verified"
          value={verified}
          options={[
            { value: "all", label: "All" },
            { value: "true", label: "Verified" },
            { value: "false", label: "Not verified" }
          ]}
          onChange={setVerified}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700"
        >
          {error}
        </p>
      )}

      {events === null ? (
        <p className="mt-8 text-[13px] text-neutral-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center text-[13px] font-bold text-neutral-500">
          No webhook events yet — providers POST to /api/pay/webhook/[providerId].
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {events.map((e) => {
            const isOpen = expanded === e.id;
            return (
              <li key={e.id}>
                <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: OUTCOME_COLOR[e.outcome] }}
                    />
                    <span className="w-40 shrink-0 text-[11px] text-neutral-600">
                      {formatDate(e.receivedAt)}
                    </span>
                    <span className="w-24 shrink-0 font-mono text-[11px] font-bold text-neutral-900">
                      {e.providerId}
                    </span>
                    <span className="line-clamp-1 flex-1 text-[12px] text-neutral-700">
                      {e.eventType ?? <em className="text-neutral-400">(no event type)</em>}
                      {e.externalRef && (
                        <span className="ml-2 font-mono text-[10px] text-neutral-500">
                          · {e.externalRef}
                        </span>
                      )}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                      style={{ background: OUTCOME_COLOR[e.outcome] }}
                    >
                      {e.outcome}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[10px] text-neutral-500">
                      {e.httpStatus}
                    </span>
                    <span className="w-12 shrink-0 text-right text-[10px] text-neutral-400">
                      {e.latencyMs}ms
                    </span>
                    <span
                      aria-hidden="true"
                      className="w-6 shrink-0 text-right transition-transform"
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0)"
                      }}
                    >
                      ▾
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-neutral-100 bg-neutral-50 p-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                        Outcome detail
                      </p>
                      <p className="mt-1 text-[12px] text-neutral-800">
                        {e.outcomeDetail || "(none)"}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                            Signature
                          </p>
                          <p
                            className="mt-1 text-[12px] font-bold"
                            style={{
                              color: e.signatureVerified ? GREEN : RED
                            }}
                          >
                            {e.signatureVerified ? "Verified ✓" : "Not verified"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                            Matched order
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-neutral-700">
                            {e.matchedOrderId ?? "—"}
                          </p>
                        </div>
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                          Headers
                        </summary>
                        <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-[10px]">
                          {JSON.stringify(e.headersPreview, null, 2)}
                        </pre>
                      </details>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                          Payload preview
                        </summary>
                        <pre className="mt-1 max-h-96 overflow-auto rounded bg-white p-2 text-[10px]">
                          {e.payloadPreview}
                        </pre>
                      </details>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  colour
}: {
  label: string;
  value: string;
  colour: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p
        className="text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: colour }}
      >
        {label}
      </p>
      <p className="mt-1 text-[18px] font-extrabold text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function Selector({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-bold outline-none focus:border-neutral-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return iso;
  }
}
