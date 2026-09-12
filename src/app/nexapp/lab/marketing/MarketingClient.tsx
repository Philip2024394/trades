// src/app/nexapp/lab/marketing/MarketingClient.tsx
//
// Founder 2026-09-10 · Lab Marketing UI · live client.
//
// Sections:
//   1. Pipeline diagram (10 stages · matches Founder's Window pattern)
//   2. Contact matrix (category × country · live counts)
//   3. Source + country breakdown
//   4. Environment status (send_enabled, ESP, rate limit)

"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = {
  generated_at: string;
  stages: {
    collect: { contacts_new_1h: number; contacts_new_24h: number; note: string };
    contact_db: { total: number; sendable: number; opted_out: number; hard_bounced: number };
    segment: { saved_segments: number };
    template: { templates_ready: number };
    campaign: { draft: number; pending_approval: number; sending: number; sent_24h: number };
    queue: { pending: number; sent_24h: number; failed_24h: number };
    sending: { sends_last_hour: number; note: string };
  };
  breakdown: {
    by_source: Array<{ source: string; count: number }>;
    by_country: Array<{ country: string; count: number }>;
  };
  env: { send_enabled: boolean; esp: string; max_per_min: number };
};

type Matrix = {
  generated_at: string;
  categories: string[];
  countries: string[];
  cells: Array<{ category_group: string; country: string; contact_count: number; sample_categories: string[] }>;
  total_sendable: number;
  total_all: number;
  total_opted_out: number;
  total_bounced: number;
};

const STAGES: Array<{ key: keyof Stats["stages"]; label: string; primary: (s: Stats) => string; secondary: (s: Stats) => string }> = [
  { key: "collect",     label: "COLLECT",   primary: (s) => `+${s.stages.collect.contacts_new_1h}`, secondary: (s) => `${s.stages.collect.contacts_new_24h}/24h` },
  { key: "contact_db",  label: "CONTACT DB", primary: (s) => s.stages.contact_db.sendable.toLocaleString(), secondary: (s) => `${s.stages.contact_db.total.toLocaleString()} total` },
  { key: "segment",     label: "SEGMENT",   primary: (s) => String(s.stages.segment.saved_segments), secondary: () => `saved` },
  { key: "template",    label: "TEMPLATE",  primary: (s) => String(s.stages.template.templates_ready), secondary: () => `ready` },
  { key: "campaign",    label: "CAMPAIGN",  primary: (s) => String(s.stages.campaign.draft + s.stages.campaign.pending_approval), secondary: (s) => `${s.stages.campaign.sending} sending` },
  { key: "queue",       label: "QUEUE",     primary: (s) => s.stages.queue.pending.toLocaleString(), secondary: (s) => `${s.stages.queue.sent_24h}/24h` },
  { key: "sending",     label: "SENDING",   primary: (s) => String(s.stages.sending.sends_last_hour), secondary: () => `last 1h` },
];

export default function MarketingClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        fetch("/api/nex/marketing/stats", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/nex/marketing/matrix", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (s.stages) setStats(s);
      if (m.cells) setMatrix(m);
      setLastRefresh(new Date().toLocaleTimeString());
      setErr(null);
    } catch (e) { setErr(String(e).slice(0, 200)); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span>Refreshed: {lastRefresh || "…"}</span>
        {err && <span className="text-rose-400">error: {err}</span>}
        {stats && (
          <>
            <span>·</span>
            <span>Send enabled: <span className={stats.env.send_enabled ? "text-emerald-400" : "text-amber-400"}>{String(stats.env.send_enabled)}</span></span>
            <span>·</span>
            <span>ESP: {stats.env.esp}</span>
            <span>·</span>
            <span>Rate cap: {stats.env.max_per_min}/min</span>
          </>
        )}
      </div>

      {/* Pipeline diagram */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-400">Marketing pipeline · every count live</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <div className="grid grid-cols-7 divide-x divide-neutral-800 bg-neutral-900">
            {STAGES.map((st, i) => (
              <div key={String(st.key)} className="relative px-2 py-4 text-center">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Stage {i + 1}</div>
                <div className="mt-1 text-[11px] font-medium text-neutral-200">{st.label}</div>
                <div className="mt-2 font-mono text-2xl tabular-nums text-emerald-300">
                  {stats ? st.primary(stats) : "…"}
                </div>
                <div className="mt-1 text-[10px] text-neutral-500">
                  {stats ? st.secondary(stats) : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Matrix · category × country */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-400">
          Contact matrix · category × country · sendable counts
        </h2>
        {!matrix && <div className="rounded-lg border border-neutral-800 p-6 text-center text-sm text-neutral-500">Computing matrix…</div>}
        {matrix && matrix.cells.length === 0 && (
          <div className="rounded-lg border border-neutral-800 p-6 text-center text-sm text-neutral-500">
            No contacts yet · run the import script to populate: <code className="text-amber-400">node scripts/nex-marketing-import-emails.mjs</code>
          </div>
        )}
        {matrix && matrix.cells.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-3 py-2 text-left font-normal">Category ↓ / Country →</th>
                  {matrix.countries.map((c) => <th key={c} className="px-3 py-2 text-center font-normal">{c}</th>)}
                  <th className="px-3 py-2 text-right font-medium text-neutral-300">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {matrix.categories.map((cat) => {
                  let rowTotal = 0;
                  const rowCells = matrix.countries.map((country) => {
                    const cell = matrix.cells.find((c) => c.category_group === cat && c.country === country);
                    const count = cell?.contact_count ?? 0;
                    rowTotal += count;
                    return { country, count, samples: cell?.sample_categories ?? [] };
                  });
                  return (
                    <tr key={cat} className="hover:bg-neutral-900/50">
                      <td className="px-3 py-1.5 text-neutral-300 capitalize">{cat.replace(/-/g, " ")}</td>
                      {rowCells.map((rc) => (
                        <td key={rc.country} className="px-3 py-1.5 text-center">
                          {rc.count > 0 ? (
                            <span className="font-mono tabular-nums text-emerald-300" title={rc.samples.join(", ")}>{rc.count}</span>
                          ) : (
                            <span className="text-neutral-700">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-neutral-200">{rowTotal}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-neutral-700 bg-neutral-900/60">
                  <td className="px-3 py-2 text-neutral-400">Sendable total</td>
                  <td colSpan={matrix.countries.length + 1} className="px-3 py-2 text-right font-mono text-emerald-300">
                    {matrix.total_sendable.toLocaleString()} <span className="ml-2 text-neutral-500">
                      ({matrix.total_all.toLocaleString()} total · {matrix.total_opted_out} opted-out · {matrix.total_bounced} bounced)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Breakdown */}
      <section className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-neutral-400">By source</h3>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40">
            {stats?.breakdown.by_source.map((s) => (
              <div key={s.source} className="flex items-center justify-between border-b border-neutral-900 px-3 py-1.5 text-xs last:border-0">
                <span className="truncate text-neutral-300">{s.source}</span>
                <span className="font-mono text-neutral-400 tabular-nums">{s.count}</span>
              </div>
            ))}
            {(!stats || stats.breakdown.by_source.length === 0) && (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">No source data yet</div>
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-neutral-400">By country</h3>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40">
            {stats?.breakdown.by_country.map((c) => (
              <div key={c.country} className="flex items-center justify-between border-b border-neutral-900 px-3 py-1.5 text-xs last:border-0">
                <span className="text-neutral-300">{c.country}</span>
                <span className="font-mono text-neutral-400 tabular-nums">{c.count}</span>
              </div>
            ))}
            {(!stats || stats.breakdown.by_country.length === 0) && (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">No country data yet</div>
            )}
          </div>
        </div>
      </section>

      {/* Env & next steps */}
      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-neutral-400">Next steps for the founder</h3>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
          <ol className="ml-5 list-decimal space-y-2">
            <li>Choose ESP (Amazon SES for scale · Resend for MVP) — see <code className="text-amber-400">docs/DECISIONS/0307-nex-email-marketing.md</code></li>
            <li>Verify sending domain · publish SPF + DKIM + DMARC DNS records</li>
            <li>Set <code className="text-amber-400">NEX_MARKETING_ESP</code>, <code className="text-amber-400">NEX_MARKETING_SMTP_URL</code>, <code className="text-amber-400">NEX_MARKETING_FROM_EMAIL</code> in <code>.env.local</code></li>
            <li>Toggle <code className="text-amber-400">NEX_MARKETING_SEND_ENABLED=true</code></li>
            <li>Build first template + segment · confirm campaign with founder HMAC</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
