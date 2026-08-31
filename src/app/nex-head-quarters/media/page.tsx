// NEX HQ · Media Foundation · /nex-head-quarters/media
// Philip 2026-08-27 · read-only observability for the NEX Media Foundation.

import Link from "next/link";
import { loadMediaSummary, loadRecentMedia } from "@/lib/nex-hq/media-observability";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "NEX HQ · Media", robots: { index: false } };

function fmtBytes(n: number): string {
  if (n === 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function stateColor(s: string): string {
  if (s === "ready") return "bg-emerald-600 text-white";
  if (s === "uploading") return "bg-blue-600 text-white";
  if (s === "processing") return "bg-indigo-600 text-white";
  if (s === "failed") return "bg-rose-600 text-white";
  if (s === "deleted") return "bg-slate-500 text-white";
  return "bg-slate-400 text-white";
}
function typeIcon(t: string): string {
  if (t === "video") return "🎥";
  if (t === "image") return "🖼️";
  if (t === "audio") return "🎧";
  return "📄";
}

export default async function Page() {
  const [summary, recent] = await Promise.all([loadMediaSummary(), loadRecentMedia(50)]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">🖼️ NEX HQ · Media Foundation</h1>
              <p className="mt-1 text-sm text-slate-600">
                Read-only observability · image · video · audio · document · ADR-0118 ownership + 7-day grace.
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <Link href="/nex-head-quarters" className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">HQ home</Link>
              <Link href="/nex-head-quarters/calling" className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">Calling</Link>
              <Link href="/nex-video" className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">📺 Open Video Feed</Link>
            </div>
          </div>
        </header>

        {/* Backend + volume */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">Storage backend</h2>
            <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{summary.activeStorageBackend}</code>
            {summary.activeStorageBackend === "r2" && <span className="text-xs text-emerald-700">✓ Bandwidth Alliance · $0 egress</span>}
            {summary.activeStorageBackend !== "r2" && <span className="text-xs text-amber-700">dev backend · switch to r2 in prod</span>}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Total media objects</div><div className="text-2xl font-bold text-slate-900">{summary.total}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Uploads · 24h</div><div className="text-2xl font-bold text-emerald-700">{summary.uploadsLast24h}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Total bytes</div><div className="text-2xl font-bold text-slate-900">{fmtBytes(summary.totalBytes)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Bytes · 24h</div><div className="text-2xl font-bold text-slate-900">{fmtBytes(summary.bytesLast24h)}</div></div>
          </div>
        </section>

        {/* Distribution grids */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">By object type</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>🖼️ image</span><span className="font-mono">{summary.byType.image}</span></li>
              <li className="flex justify-between"><span>🎥 video</span><span className="font-mono">{summary.byType.video}</span></li>
              <li className="flex justify-between"><span>🎧 audio</span><span className="font-mono">{summary.byType.audio}</span></li>
              <li className="flex justify-between"><span>📄 document</span><span className="font-mono">{summary.byType.document}</span></li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">By state</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>uploading</span><span className={`rounded px-2 text-xs ${summary.byState.uploading > 0 ? "bg-blue-100 text-blue-800" : "text-slate-500"}`}>{summary.byState.uploading}</span></li>
              <li className="flex justify-between"><span>processing</span><span className={`rounded px-2 text-xs ${summary.byState.processing > 0 ? "bg-indigo-100 text-indigo-800" : "text-slate-500"}`}>{summary.byState.processing}</span></li>
              <li className="flex justify-between"><span>ready</span><span className="rounded bg-emerald-100 px-2 text-xs text-emerald-800">{summary.byState.ready}</span></li>
              <li className="flex justify-between"><span>failed</span><span className={`rounded px-2 text-xs ${summary.byState.failed > 0 ? "bg-rose-100 text-rose-800" : "text-slate-500"}`}>{summary.byState.failed}</span></li>
              <li className="flex justify-between"><span>deleted</span><span className="text-slate-500 text-xs">{summary.byState.deleted}</span></li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">By visibility (ready only)</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>private</span><span className="font-mono">{summary.byVisibility.private}</span></li>
              <li className="flex justify-between"><span>unlisted</span><span className="font-mono">{summary.byVisibility.unlisted}</span></li>
              <li className="flex justify-between"><span>public</span><span className="font-mono">{summary.byVisibility.public}</span></li>
            </ul>
          </div>
        </section>

        {/* Health alerts */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Health</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Orphan uploading &gt; 1h</div>
              <div className={`text-xl font-bold ${summary.orphanUploading > 0 ? "text-amber-700" : "text-slate-900"}`}>{summary.orphanUploading}</div>
              <div className="text-xs text-slate-500">clients that never called /register</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Soft-deleted in grace</div>
              <div className="text-xl font-bold text-slate-900">{summary.deletedPending}</div>
              <div className="text-xs text-slate-500">rows within 7-day grace window</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Ready for hard delete</div>
              <div className={`text-xl font-bold ${summary.deletedReadyForHardDelete > 0 ? "text-amber-700" : "text-slate-900"}`}>{summary.deletedReadyForHardDelete}</div>
              <div className="text-xs text-slate-500">janitor deferred to Stage 2</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Manifest rows (ADR-0024)</div>
              <div className="text-xl font-bold text-slate-900">{summary.totalManifestRows}</div>
              <div className="text-xs text-slate-500">auto-written by ObjectStorage decorator</div>
            </div>
          </div>
        </section>

        {/* Stage 2 · Video Feed V1 · ramp-gate metrics */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">📺 Video Feed V1 · ramp gate</h2>
              <p className="text-xs text-slate-500">
                Answers: "will people actually watch NEX videos?" · meaningful views + non-trivial watched_ms + return viewers → Stage 3 (social) becomes worth building.
              </p>
            </div>
            <Link href="/nex-video" className="text-sm rounded bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700">Open feed →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Public videos</div>
              <div className="text-2xl font-bold text-slate-900">{summary.feedPublicVideos}</div>
              <div className="text-xs text-slate-500">object_type=video · state=ready · visibility=public</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Views · 24h</div>
              <div className="text-2xl font-bold text-emerald-700">{summary.feedViews24h}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Unique viewers · 24h</div>
              <div className="text-2xl font-bold text-slate-900">{summary.feedUniqueViewers24h}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Median watched</div>
              <div className="text-2xl font-bold text-slate-900">{(summary.feedMedianWatchedMs24h / 1000).toFixed(1)} <span className="text-sm font-normal text-slate-500">s</span></div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Unmute rate</div>
              <div className="text-2xl font-bold text-slate-900">{Math.round(summary.feedUnmuteRate24h * 100)}%</div>
              <div className="text-xs text-slate-500">strong intent signal</div>
            </div>
          </div>
        </section>

        {/* Recent media */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent · last {recent.length}</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No media objects yet. POST to <code className="rounded bg-slate-100 px-1.5 py-0.5">/api/nex-media/upload-url</code> to create the first one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2">When</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Owner</th>
                    <th className="py-2">State</th>
                    <th className="py-2">Vis</th>
                    <th className="py-2">Size</th>
                    <th className="py-2">Mime</th>
                    <th className="py-2">Context</th>
                    <th className="py-2">Media ID</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((m) => (
                    <tr key={m.media_id} className="border-b border-slate-100">
                      <td className="py-2 text-slate-600">{m.uploaded_at.toISOString().slice(5, 19).replace("T", " ")}</td>
                      <td className="py-2">{typeIcon(m.object_type)} <span className="text-slate-700">{m.object_type}</span></td>
                      <td className="py-2 text-slate-700"><code className="text-xs">{m.owner_id.slice(0, 16)}</code></td>
                      <td className="py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${stateColor(m.state)}`}>{m.state}</span></td>
                      <td className="py-2 text-slate-700">{m.visibility}</td>
                      <td className="py-2 font-mono text-slate-700">{fmtBytes(m.size_bytes)}</td>
                      <td className="py-2 text-slate-600"><code className="text-xs">{m.mime_type}</code></td>
                      <td className="py-2 text-slate-600">{m.context_type ? `${m.context_type}${m.context_ref ? `:${m.context_ref}` : ""}` : "-"}</td>
                      <td className="py-2"><code className="text-xs text-slate-500">{m.media_id.slice(0, 8)}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="pt-4 text-center text-xs text-slate-500">
          NEX Media Foundation · Stage 1 · ADR-0118 · Philip 2026-08-27
        </footer>
      </div>
    </div>
  );
}
