// /nex-app/nex-brain/collector/[category]/dashboard · Worker research dashboard.
// Moved into NEX HQ 2026-08-13 per Philip's "one NEX Headquarters" directive.
//
// 7 status sections + counts (Philip 2026-08-13 spec §12):
//   1. Newly discovered   (directory_state = listed · recent)
//   2. Needs verification (listed · missing email OR missing evidence)
//   3. Ready to contact   (listed · has email + evidence + qualification A+/A/B)
//   4. Claim invited      (lifecycle_status ∈ {contacted, interested, claim_requested})
//   5. Claimed            (directory_state = claimed)
//   6. Membership opportunity (claimed · not yet paid_member)
//   7. Paid members       (directory_state = paid_member)
//   Plus: Exchange eligible (paid_member + qualification ∈ {A+, A})
//
// Reads the same file-based seed directory the public feed reads, so counts
// stay honest and match what workers just collected.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { getTradeCategory, listEnabledCategories } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";
import { deriveEmailStatus, type DirectorySeed } from "@/lib/nex/centre-publishing/directorySeedLoader";
import { listDirectorySeedsByCategory } from "@/lib/nex/centre-publishing/directorySeedsDb";

export const dynamic = "force-dynamic";

async function loadCategorySeeds(categoryDisplayName: string): Promise<DirectorySeed[]> {
  return await listDirectorySeedsByCategory(categoryDisplayName);
}

function bucket(seed: DirectorySeed): string[] {
  const b: string[] = [];
  const ds = seed.directory_state ?? "listed";
  const lc = seed.lifecycle_status ?? "unclaimed";
  const q  = seed.refacing_qualification;
  const hasEmail    = Boolean(seed.email && seed.email.trim().length > 0);
  const hasEvidence = Boolean(seed.refacing_evidence && seed.refacing_evidence.length > 0);
  const hasQual     = Boolean(q && q !== "excluded");

  if (ds === "listed") b.push("newly_discovered");
  if (ds === "listed" && (!hasEmail || !hasEvidence)) b.push("needs_verification");
  if (ds === "listed" && hasEmail && hasEvidence && hasQual) b.push("ready_to_contact");
  if (["contacted", "interested", "claim_requested", "claim_pending"].includes(lc)) b.push("claim_invited");
  if (ds === "claimed") b.push("claimed");
  if (ds === "claimed") b.push("membership_opportunity");
  if (ds === "paid_member") b.push("paid_members");
  // Business rule (Philip 2026-08-13 update): paid_member alone = exchange eligible.
  // Qualification stays as evidence/ranking · never gates lead access.
  if (ds === "paid_member") b.push("exchange_eligible");
  // Track A+/A separately for future ranking display · doesn't gate anything.
  void q;
  return b;
}

const SECTION_META: Array<{ key: string; label: string; hint: string; color: string }> = [
  { key: "newly_discovered",      label: "Newly discovered",      hint: "directory_state = listed",                                 color: "bg-blue-50 border-blue-200 text-blue-900" },
  { key: "needs_verification",    label: "Needs verification",    hint: "listed · missing email or evidence",                      color: "bg-amber-50 border-amber-200 text-amber-900" },
  { key: "ready_to_contact",      label: "Ready to contact",      hint: "listed · has email + evidence + qualification",           color: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  { key: "claim_invited",         label: "Claim invited",         hint: "contacted / interested / claim_requested / claim_pending", color: "bg-purple-50 border-purple-200 text-purple-900" },
  { key: "claimed",               label: "Claimed",               hint: "directory_state = claimed",                                color: "bg-indigo-50 border-indigo-200 text-indigo-900" },
  { key: "membership_opportunity",label: "Membership opportunity",hint: "claimed · not yet paid_member",                            color: "bg-pink-50 border-pink-200 text-pink-900" },
  { key: "paid_members",          label: "Paid members",          hint: "directory_state = paid_member",                            color: "bg-orange-50 border-orange-200 text-orange-900" },
  { key: "exchange_eligible",     label: "Exchange eligible",     hint: "directory_state = paid_member · qualification affects ranking only",         color: "bg-orange-500 border-orange-500 text-white" },
];

export default async function CollectorDashboardPage({ params }: { params: Promise<{ category: string }> }) {
  if (!(await isAdminAuthed())) {
    const { category } = await params;
    redirect(`/admin/login?next=${encodeURIComponent(`/nex-app/nex-brain/collector/${category}/dashboard`)}`);
  }
  const { category } = await params;
  const config = getTradeCategory(category);
  if (!config || !config.enabled) notFound();

  const seeds = await loadCategorySeeds(config.displayName);

  const buckets: Record<string, DirectorySeed[]> = {};
  for (const meta of SECTION_META) buckets[meta.key] = [];
  for (const seed of seeds) {
    for (const key of bucket(seed)) buckets[key].push(seed);
  }

  // Tri-state email counts (Philip 2026-08-13)
  const emailCounts = { verified: 0, needs_manual_verification: 0, not_found: 0 };
  for (const s of seeds) {
    emailCounts[deriveEmailStatus(s)]++;
  }
  const qCounts = { "A+": 0, "A": 0, "B": 0, "C": 0, "excluded": 0, unassigned: 0 };
  for (const s of seeds) {
    const q = s.refacing_qualification;
    if (q) qCounts[q]++;
    else qCounts.unassigned++;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
            NEX Collector · Dashboard
          </div>
          <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight">
            {config.displayName}
          </h1>
          <p className="mt-1 text-sm text-black/60">
            {seeds.length} record{seeds.length === 1 ? "" : "s"} in this category · public listing at{" "}
            <Link href={config.publicDirectoryUrl} className="font-semibold text-orange-600 underline">
              {config.publicDirectoryUrl}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/nex-app/nex-brain/collector/${config.id}`}
            className="rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-orange-600"
          >
            + Add company
          </Link>
        </div>
      </div>

      {/* Category switcher */}
      <div className="mb-6 flex flex-wrap gap-2">
        {listEnabledCategories().map((cat) => (
          <Link
            key={cat.id}
            href={`/nex-app/nex-brain/collector/${cat.id}/dashboard`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              cat.id === config.id
                ? "bg-black text-white"
                : "border border-black/10 bg-white text-black/80 hover:bg-black/5"
            }`}
          >
            {cat.displayName}
          </Link>
        ))}
      </div>

      {/* Top-line metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Total records" value={seeds.length} />
        <Metric label="A+ / A qualification" value={qCounts["A+"] + qCounts["A"]} />
        <Metric label="Exchange eligible" value={buckets.exchange_eligible.length} tone={buckets.exchange_eligible.length > 0 ? "good" : undefined} />
      </div>

      {/* Email priority queue · tri-state (Philip 2026-08-13) */}
      <section className="mb-6 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-black/80">Email priority queue</h2>
        <div className="grid grid-cols-3 gap-3">
          <EmailPill icon="🟢" label="Verified"                     value={emailCounts.verified}                    color="bg-emerald-50 border-emerald-200 text-emerald-900" />
          <EmailPill icon="🟡" label="Needs manual verification"    value={emailCounts.needs_manual_verification}   color="bg-amber-50 border-amber-200 text-amber-900" />
          <EmailPill icon="🔴" label="Not found"                    value={emailCounts.not_found}                   color="bg-red-50 border-red-200 text-red-900" />
        </div>
      </section>

      {/* Section grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECTION_META.map((meta) => (
          <section key={meta.key} className={`rounded-2xl border p-4 shadow-sm ${meta.color}`}>
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider">{meta.label}</h2>
                <p className="text-[10.5px] opacity-70">{meta.hint}</p>
              </div>
              <div className="text-2xl font-black leading-none">{buckets[meta.key].length}</div>
            </div>
            {buckets[meta.key].length === 0 ? (
              <div className="text-[11px] opacity-60">— none yet</div>
            ) : (
              <ul className="mt-2 space-y-1 text-[11.5px]">
                {buckets[meta.key].slice(0, 6).map((s) => (
                  <li key={s.id} className="truncate">
                    <span className="font-semibold">{s.business_name}</span>
                    {s.town ? ` · ${s.town}` : ""}
                    {s.refacing_qualification ? ` · ${s.refacing_qualification}` : ""}
                    {!s.email ? " · no email" : ""}
                  </li>
                ))}
                {buckets[meta.key].length > 6 && (
                  <li className="opacity-60">+ {buckets[meta.key].length - 6} more</li>
                )}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* Qualification breakdown */}
      <section className="mt-6 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-black/80">Qualification distribution</h2>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {(["A+", "A", "B", "C", "excluded", "unassigned"] as const).map((q) => (
            <div key={q} className="rounded-lg border border-black/5 bg-white p-2 text-center">
              <div className="text-[10px] font-semibold uppercase text-black/60">{q}</div>
              <div className="text-lg font-black">{qCounts[q]}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmailPill({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-2xl border p-3 ${color}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 text-3xl font-black leading-none">{value}</div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warn" | "good" }) {
  const toneClass =
    tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-900" :
    tone === "good" ? "border-emerald-300 bg-emerald-50 text-emerald-900" :
    "border-black/10 bg-white text-black";
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-3xl font-black leading-none">{value}</div>
    </div>
  );
}
