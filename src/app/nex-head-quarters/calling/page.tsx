// NEX HQ · Calling · Philip 2026-08-27.
//
// /nex-head-quarters/calling
//
// Read-only observability page for NEX internal calling. Surfaces:
//   · Signalling server health (uptime, online identities)
//   · Call volume + connected/missed/failed split (24h)
//   · Path distribution (p2p / srflx / relay) — Stage 1 exit criterion evidence
//   · Quality metrics: median + p95 RTT, jitter, packets lost
//   · Resilience: calls that hit quality warnings
//   · Business calling gate config summary
//   · Recent call log (last 50)
//
// No action buttons. No editing. Just visibility.

import Link from "next/link";
import {
  loadCallSummary,
  loadRecentCalls,
  loadSignalHealth,
  loadGateSummary,
} from "@/lib/nex-hq/calling-observability";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "NEX HQ · Calling", robots: { index: false } };

function fmtDuration(sec: number | null): string {
  if (sec == null || sec === 0) return "-";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtBytes(n: bigint | number): string {
  const v = Number(n);
  if (v === 0) return "-";
  if (v < 1024) return `${v}B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)}KB`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)}MB`;
  return `${(v / 1024 ** 3).toFixed(2)}GB`;
}

function pathColor(path: string): string {
  if (path === "p2p") return "bg-emerald-600 text-white";
  if (path === "srflx") return "bg-blue-600 text-white";
  if (path === "relay") return "bg-amber-600 text-white";
  return "bg-slate-500 text-white";
}

function reasonColor(reason: string | null): string {
  if (reason === "completed") return "text-emerald-600";
  if (reason === "missed") return "text-amber-600";
  if (reason === "failed") return "text-rose-600";
  if (reason === "declined") return "text-slate-600";
  return "text-slate-500";
}

export default async function Page() {
  const [summary, recent, signal, gate] = await Promise.all([
    loadCallSummary(24),
    loadRecentCalls(50),
    loadSignalHealth(),
    loadGateSummary(),
  ]);

  const totalPathClassified = summary.pathDistribution.p2p + summary.pathDistribution.srflx + summary.pathDistribution.relay;
  const p2pPct = totalPathClassified > 0 ? Math.round(100 * summary.pathDistribution.p2p / totalPathClassified) : 0;
  const srflxPct = totalPathClassified > 0 ? Math.round(100 * summary.pathDistribution.srflx / totalPathClassified) : 0;
  const relayPct = totalPathClassified > 0 ? Math.round(100 * summary.pathDistribution.relay / totalPathClassified) : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">📞 NEX HQ · Calling</h1>
              <p className="mt-1 text-sm text-slate-600">
                Read-only observability · signalling health · call quality · path distribution · business gate.
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <Link href="/nex-calling/experiment" className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">Stage 1 experiment</Link>
            </div>
          </div>
        </header>

        {/* Signal server health card */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">Signalling server</h2>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${signal.reachable ? "bg-emerald-500" : "bg-rose-500"}`} />
            <span className={`text-sm ${signal.reachable ? "text-emerald-700" : "text-rose-700"}`}>
              {signal.reachable ? "reachable" : "unreachable"}
            </span>
          </div>
          {signal.reachable ? (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Uptime</div>
                <div className="text-lg font-mono text-slate-900">{signal.uptimeSec != null ? `${Math.floor(signal.uptimeSec / 60)}m ${signal.uptimeSec % 60}s` : "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Online now</div>
                <div className="text-lg font-mono text-slate-900">{signal.identitiesOnline ?? 0}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Endpoint</div>
                <code className="text-xs text-slate-700">{process.env.NEXT_PUBLIC_NEX_CALL_SIGNAL_URL ?? "http://localhost:8090"}</code>
              </div>
            </div>
          ) : (
            <div className="text-sm text-rose-700">
              Signal server not reachable. Start with: <code className="rounded bg-slate-100 px-1.5 py-0.5">node scripts/nex-calling/signal.mjs</code>
              {signal.error && <div className="mt-1 text-xs text-rose-600">error: {signal.error}</div>}
            </div>
          )}
        </section>

        {/* Volume + reach cards */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Calls (24h)</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{summary.totalCalls}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Connected</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{summary.totalConnected}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Missed</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{summary.totalMissed}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Failed</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{summary.totalFailed}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Median duration</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{fmtDuration(summary.medianDurationSec)}</div>
          </div>
        </section>

        {/* Path distribution — Stage 1 exit criterion evidence */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Media path distribution</h2>
              <p className="text-xs text-slate-500">Stage 1 exit criterion · high p2p+srflx = NEX transports signalling only, not media.</p>
            </div>
            <div className="text-xs text-slate-500">{totalPathClassified} classified calls · 24h</div>
          </div>
          <div className="flex h-3 overflow-hidden rounded bg-slate-100">
            {totalPathClassified > 0 && (
              <>
                <div className="bg-emerald-500" style={{ width: `${p2pPct}%` }} title={`p2p ${p2pPct}%`} />
                <div className="bg-blue-500" style={{ width: `${srflxPct}%` }} title={`srflx ${srflxPct}%`} />
                <div className="bg-amber-500" style={{ width: `${relayPct}%` }} title={`relay ${relayPct}%`} />
              </>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div><span className="inline-block h-2 w-2 rounded bg-emerald-500 align-middle"/> <span className="text-slate-700">p2p</span> <span className="font-mono text-slate-900">{summary.pathDistribution.p2p}</span> <span className="text-slate-500">({p2pPct}%)</span></div>
            <div><span className="inline-block h-2 w-2 rounded bg-blue-500 align-middle"/> <span className="text-slate-700">srflx</span> <span className="font-mono text-slate-900">{summary.pathDistribution.srflx}</span> <span className="text-slate-500">({srflxPct}%)</span></div>
            <div><span className="inline-block h-2 w-2 rounded bg-amber-500 align-middle"/> <span className="text-slate-700">relay</span> <span className="font-mono text-slate-900">{summary.pathDistribution.relay}</span> <span className="text-slate-500">({relayPct}%)</span></div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            <strong className="text-slate-700">NO TURN required</strong> as long as p2p+srflx dominate. TURN gets enabled only when relay share exceeds Stage 1 threshold (per ADR-0100a).
          </div>
        </section>

        {/* Quality metrics */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">RTT · median</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{summary.medianRttMs ?? "-"} <span className="text-sm font-normal text-slate-500">ms</span></div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">RTT · p95</div>
            <div className={`mt-1 text-xl font-bold ${(summary.p95RttMs ?? 0) > 400 ? "text-rose-700" : (summary.p95RttMs ?? 0) > 200 ? "text-amber-700" : "text-slate-900"}`}>{summary.p95RttMs ?? "-"} <span className="text-sm font-normal text-slate-500">ms</span></div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Jitter · median</div>
            <div className={`mt-1 text-xl font-bold ${(summary.medianJitterMs ?? 0) > 60 ? "text-amber-700" : "text-slate-900"}`}>{summary.medianJitterMs ?? "-"} <span className="text-sm font-normal text-slate-500">ms</span></div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Quality warnings</div>
            <div className={`mt-1 text-xl font-bold ${summary.callsWithQualityWarnings > 0 ? "text-amber-700" : "text-slate-900"}`}>{summary.callsWithQualityWarnings}</div>
            <div className="text-xs text-slate-500">calls · rtt&gt;300 · jitter&gt;60 · loss&gt;100</div>
          </div>
        </section>

        {/* Bandwidth totals */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Bandwidth · 24h</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Sent (total)</div>
              <div className="text-lg font-mono text-slate-900">{fmtBytes(summary.bytesSentTotal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Received (total)</div>
              <div className="text-lg font-mono text-slate-900">{fmtBytes(summary.bytesReceivedTotal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Packets lost (total)</div>
              <div className={`text-lg font-mono ${summary.totalPacketsLost > 1000 ? "text-rose-700" : "text-slate-900"}`}>{summary.totalPacketsLost.toLocaleString()}</div>
            </div>
          </div>
        </section>

        {/* Business gate */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Business calling gate</h2>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Configs</div>
              <div className="text-lg font-mono text-slate-900">{gate.totalConfigs}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Voice enabled</div>
              <div className="text-lg font-mono text-slate-900">{gate.voiceEnabled}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Video enabled</div>
              <div className="text-lg font-mono text-slate-900">{gate.videoEnabled}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">With consent</div>
              <div className="text-lg font-mono text-slate-900">{gate.withConsent}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Both enabled</div>
              <div className="text-lg font-mono text-slate-900">{gate.bothEnabled}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">With hours</div>
              <div className="text-lg font-mono text-slate-900">{gate.withHours}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Blocked callers</div>
              <div className="text-lg font-mono text-slate-900">{gate.totalBlockedCallers}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Businesses opt in individually. Default is DENY per doctrine. Discovery walkers NEVER populate this table.
          </p>
        </section>

        {/* Recent calls */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent calls · last {recent.length}</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No calls yet. Try the Stage 1 experiment link at the top.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2">When</th>
                    <th className="py-2">Caller → Callee</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Path</th>
                    <th className="py-2">Duration</th>
                    <th className="py-2">RTT</th>
                    <th className="py-2">Resolution</th>
                    <th className="py-2">Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 text-slate-600">{c.started_at.toISOString().slice(11, 19)}</td>
                      <td className="py-2 text-slate-800">{c.caller ?? "?"} <span className="text-slate-400">→</span> {c.callee ?? "?"}</td>
                      <td className="py-2 text-slate-700">{c.media_type === "video" ? "🎥" : "📞"} {c.media_type}</td>
                      <td className="py-2">
                        {c.path ? <span className={`rounded px-2 py-0.5 text-xs font-medium ${pathColor(c.path)}`}>{c.path}</span> : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-2 font-mono text-slate-700">{fmtDuration(c.duration_sec)}</td>
                      <td className="py-2 font-mono text-slate-700">{c.rtt_ms != null ? `${c.rtt_ms}ms` : "-"}</td>
                      <td className="py-2 font-mono text-slate-700">{c.video_resolution ?? "-"}</td>
                      <td className={`py-2 ${reasonColor(c.end_reason)}`}>{c.end_reason ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="pt-4 text-center text-xs text-slate-500">
          NEX Calling · Stage 2 · v2 (resilience layer active) · Philip 2026-08-27
        </footer>
      </div>
    </div>
  );
}
