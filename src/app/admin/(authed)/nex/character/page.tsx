// /admin/nex/character — Character Library viewer.
// Read-only for pass 1. Volume files are edited in git under
// src/lib/nex/character/library/. DB overrides land in pass 2.

import Link from "next/link";
import { libraryStats, listByCategory } from "@/lib/nex/character/library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nex Character · Admin", robots: { index: false } };

export default async function Page() {
  const stats = libraryStats();
  const byCat = listByCategory();
  const categories = Object.keys(byCat).sort();

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Character Library</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              {stats.total_entries} canonical intents · {stats.total_alternatives} alternative replies · {stats.volumes_loaded} volume{stats.volumes_loaded === 1 ? "" : "s"} loaded
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/review"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Review</Link>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(stats.by_category).sort(([, a], [, b]) => b - a).map(([cat, n]) => (
            <div key={cat} className="rounded-2xl border border-neutral-200 bg-white p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{cat}</p>
              <p className="mt-1 text-[18px] font-black">{n}</p>
            </div>
          ))}
        </div>

        {categories.map((cat) => (
          <div key={cat} className="mb-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">{cat} ({byCat[cat].length})</p>
            <div className="space-y-2">
              {byCat[cat].map((e) => (
                <div key={e.intent} className="rounded-2xl border border-neutral-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-white">{e.intent}</span>
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-black text-neutral-700">{e.tone}</span>
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] text-neutral-500">v{e.version}</span>
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] text-neutral-500">p{e.priority}</span>
                    <span className="ml-auto text-[10px] text-neutral-500">{e.alternatives.length} alt{e.alternatives.length === 1 ? "" : "s"}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] text-neutral-800">{e.alternatives[0]}</p>
                  {e.alternatives.length > 1 && (
                    <details className="mt-2 text-[11px]">
                      <summary className="cursor-pointer font-black text-neutral-700">Show all alternatives</summary>
                      <ol className="mt-1 list-decimal space-y-1 pl-4 text-neutral-700">
                        {e.alternatives.slice(1).map((alt, i) => <li key={i} className="whitespace-pre-wrap">{alt}</li>)}
                      </ol>
                    </details>
                  )}
                  <p className="mt-2 text-[10px] text-neutral-500">
                    Patterns: {e.patterns.map((p) => p.source).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-[11px] text-neutral-500">
          Edit responses in <code className="rounded bg-neutral-100 px-1 py-0.5">src/lib/nex/character/library/volume_XX_*.json</code>. Adding a new volume = new file + one line in <code className="rounded bg-neutral-100 px-1 py-0.5">library.ts</code>.
        </p>
      </div>
    </div>
  );
}
