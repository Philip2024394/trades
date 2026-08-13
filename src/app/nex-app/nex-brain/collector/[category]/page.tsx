// /nex-app/nex-brain/collector/[category] · Worker Collector inside NEX HQ (2026-08-13).
//
// Philip 2026-08-13: "we have only 1 nex head quaters - and every action should be
// there - no place else". This is the single home for the Collector, alongside
// Operations Centre · Knowledge Control · Comms HQ · Storage · Journal · Audit.
//
// Auth: still gated by isAdminAuthed (ADMIN_PASSWORD cookie) at both page level
// and save API level so writes are protected. Not authed → bounces to /admin/login
// with `next` pointing back at THIS URL so the round-trip lands here after login.
// When NEX-native auth ships, swap the guard — the routes don't change.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { getTradeCategory, listEnabledCategories } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";
import { CollectorForm } from "./CollectorForm";

export const dynamic = "force-dynamic";

export default async function CollectorPage({ params }: { params: Promise<{ category: string }> }) {
  if (!(await isAdminAuthed())) {
    const { category } = await params;
    redirect(`/admin/login?next=${encodeURIComponent(`/nex-app/nex-brain/collector/${category}`)}`);
  }
  const { category } = await params;
  const config = getTradeCategory(category);
  if (!config || !config.enabled) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header + category switcher */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
            NEX HQ · Collector
          </div>
          <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight">
            {config.displayName} — Add company
          </h1>
          <p className="mt-1 text-sm text-black/60">
            Research a UK trade, verify the public contact details, and file the record. The company auto-appears at{" "}
            <Link href={config.publicDirectoryUrl} className="font-semibold text-orange-600 underline">
              {config.publicDirectoryUrl}
            </Link>{" "}
            as <span className="font-mono">directory_state = &quot;listed&quot;</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/nex-app/nex-brain/collector/queue"
            className="rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 shadow-sm hover:bg-orange-100"
          >
            URL Queue →
          </Link>
          <Link
            href={`/nex-app/nex-brain/collector/${config.id}/dashboard`}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/80 shadow-sm hover:bg-black/5"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Category switcher */}
      <div className="mb-6 flex flex-wrap gap-2">
        {listEnabledCategories().map((cat) => (
          <Link
            key={cat.id}
            href={`/nex-app/nex-brain/collector/${cat.id}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              cat.id === config.id
                ? "bg-orange-500 text-white shadow"
                : "border border-black/10 bg-white text-black/80 hover:bg-black/5"
            }`}
          >
            {cat.displayName}
          </Link>
        ))}
      </div>

      {/* Governance banner */}
      <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-[11.5px] leading-relaxed text-black/75">
        <div className="mb-1 font-black uppercase tracking-wider text-orange-700">
          NEX Constitution · Rule A/B/C
        </div>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Never invent an email, phone, rating, address or capability. Leave blank if not verified.</li>
          <li>Trust over completeness — missing is OK, false is not.</li>
          <li>Reality over speculation — a staircase manufacturer is not a refacing trade without evidence.</li>
          <li>Public business email is a priority field — this record enters the claim/member acquisition funnel.</li>
        </ul>
      </div>

      <CollectorForm config={config} />
    </div>
  );
}
