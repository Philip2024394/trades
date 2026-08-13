// /nex-app/nex-brain/collector/queue · Path C URL queue admin page (2026-08-13).
//
// Philip 2026-08-13: "workers, not Claude, must perform the ongoing collection".
// Admin pastes candidate public URLs here · the NEX worker fetches, verifies,
// dedupes and saves via insertDirectorySeed() → they appear at
// /nex-app/refacing/companies and the Trade Center automatically.
//
// Auth gate is the standard admin session (same as the Collector form pages).

import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import {
  listQueueSafe,
  queueStats,
  queueFunnel,
  queueClassificationStats,
  queueFailureCategories,
} from "@/lib/nex/collection/urlQueueDb";
import {
  FAILURE_CATEGORY_DISPLAY_ORDER,
  FAILURE_CATEGORY_LABEL,
  FAILURE_CATEGORY_ACTION,
} from "@/lib/nex/collection/failureCategorisation";
import { getTradeCategory, listEnabledCategories } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";
import { QueueClient } from "./QueueClient";

export const dynamic = "force-dynamic";

export default async function CollectorQueuePage({
  searchParams,
}: {
  // Next 16 · params are async
  searchParams?: Promise<{ collection_type?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect(`/admin/login?next=${encodeURIComponent("/nex-app/nex-brain/collector/queue")}`);
  }
  const sp = (await searchParams) ?? {};
  const requested = sp.collection_type ?? "staircase_refacing";
  const category = getTradeCategory(requested) ?? getTradeCategory("staircase_refacing");
  const collectionType = category?.id ?? "staircase_refacing";
  const enabledCategories = listEnabledCategories();
  const [listResult, initialStats, funnel, classStats, failureCats] = await Promise.all([
    listQueueSafe({ collectionType, limit: 200 }),
    queueStats(collectionType),
    queueFunnel(collectionType),
    queueClassificationStats(collectionType),
    queueFailureCategories(collectionType),
  ]);
  const initialItems = listResult.ok ? listResult.items : [];
  const setupError = !listResult.ok ? listResult : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
            NEX HQ · Collector · URL Queue · {category?.displayName ?? collectionType}
          </div>
          <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight">
            Path C — Semi-autonomous URL queue
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-black/60">
            Paste candidate public UK {category?.displayName.toLowerCase() ?? ""} URLs below (one per line). The NEX
            worker fetches each URL, extracts public contact + evidence, checks for duplicates,
            and saves qualified companies to the directory.
          </p>
          {enabledCategories.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-black/50">Campaign:</span>
              {enabledCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/nex-app/nex-brain/collector/queue?collection_type=${c.id}`}
                  className={`rounded-full px-3 py-1 font-semibold ${c.id === collectionType ? "bg-orange-500 text-white" : "bg-white text-black/70 ring-1 ring-black/10 hover:bg-black/5"}`}
                >
                  {c.displayName}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/nex-app/nex-brain/collector/staircase_refacing"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/80 shadow-sm hover:bg-black/5"
          >
            ← Manual Collector
          </Link>
          <Link
            href="/nex-app/refacing/companies"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/80 shadow-sm hover:bg-black/5"
          >
            Public directory →
          </Link>
        </div>
      </div>

      {/* Governance banner */}
      <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-[11.5px] leading-relaxed text-black/75">
        <div className="mb-1 font-black uppercase tracking-wider text-orange-700">
          Worker rules
        </div>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Native server-side <code>fetch</code> only · no paid search API · no Claude WebFetch.</li>
          <li>Worker continues through the entire queue — one failed URL never stops the next.</li>
          <li>Multi-service classification: one company, many services. The worker MERGES newly-detected capabilities into an existing seed instead of creating a duplicate.</li>
          <li>Refacing evidence isn&apos;t limited to the literal word &quot;refacing&quot; · tread/riser replacement, restoration, refresh, revamp all count.</li>
          <li>Never fabricates missing data · empty stays empty · <code>email_status</code> reflects reality.</li>
          <li>New saves land at <code>directory_state = &quot;listed&quot;</code> · never auto-promoted.</li>
        </ul>
      </div>

      {/* Discovery sources · bookmarks for the human operator to browse when
          finding candidate URLs. These are NOT scraped by NEX · the worker only
          fetches URLs the operator has pasted below. Discovery = human · fetch
          + classify + save = worker. Read per-campaign from the registry. */}
      {(category?.discoverySources?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-2xl border border-black/10 bg-white p-4 text-[11.5px] leading-relaxed text-black/75">
          <div className="mb-1 font-black uppercase tracking-wider text-black/70">
            Discovery sources · {category?.displayName}
          </div>
          <p className="mb-2 text-black/60">
            Browse these UK directories to find candidate companies · paste the individual company URLs (their own website) into the queue below. Do not paste the directory search page itself.
          </p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(category?.discoverySources ?? []).map((src) => (
              <li key={src.href}>
                <a
                  href={src.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-700 underline hover:text-orange-900"
                >
                  {src.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pipeline funnel + classification totals · matches the Philip-mandated
          reporting format (memory: project_nex_brain_confidence_rule_2026_08_13.md
          · Reporting format). Every count is derived from queue rows · nothing
          is inferred. Discovery bookmarks are counted separately below and
          never enter the funnel. */}
      {!setupError && funnel.submitted + funnel.discovery_bookmarks > 0 && (
        <div className="mb-6 rounded-2xl border border-black/10 bg-white p-4">
          <div className="mb-2 font-black uppercase tracking-wider text-black/70 text-[11px]">
            Pipeline funnel
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5 md:grid-cols-9">
            <FunnelPill label="Submitted"     value={funnel.submitted}          hint="candidate rows" />
            <FunnelPill label="Fetched"       value={funnel.fetched}            hint="extraction ran" />
            <FunnelPill label="Passed ≥80"    value={funnel.passed}             hint="auto-directory" tone="emerald" />
            <FunnelPill label="Review <80"    value={funnel.review}             hint="human queue" tone="amber" />
            <FunnelPill label="Failed"        value={funnel.failed}             hint="blocked/timeout" tone="rose" />
            <FunnelPill label="Duplicates"    value={funnel.duplicates}         hint="matched existing" />
            <FunnelPill label="Merged"        value={funnel.merged}             hint="capabilities unioned" />
            <FunnelPill label="New companies" value={funnel.new_companies}      hint="fresh seed" tone="emerald" />
            <FunnelPill label="Bookmarks"     value={funnel.discovery_bookmarks} hint="discovery only" />
          </div>
          {(funnel.queued_pending > 0 || funnel.processing > 0) && (
            <div className="mt-2 text-[11px] text-black/60">
              In flight: <b>{funnel.queued_pending}</b> queued · <b>{funnel.processing}</b> processing.
            </div>
          )}

          <div className="mt-4 mb-2 font-black uppercase tracking-wider text-black/70 text-[11px]">
            Classification totals
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 md:grid-cols-8">
            <FunnelPill label="BOTH"          value={classStats.BOTH} />
            <FunnelPill label="REFACING"      value={classStats.REFACING} />
            <FunnelPill label="MANUFACTURE"   value={classStats.MANUFACTURE} />
            <FunnelPill label="INSTALLER"     value={classStats.INSTALLER} />
            <FunnelPill label="SUPPLIER"      value={classStats.SUPPLIER} />
            <FunnelPill label="NEEDS_REVIEW"  value={classStats.NEEDS_REVIEW} />
            <FunnelPill label="NOT_RELEVANT"  value={classStats.NOT_RELEVANT} />
            <FunnelPill label="Unclassified"  value={classStats.unclassified} hint="pre-extraction" />
          </div>
          <p className="mt-3 text-[10.5px] leading-snug text-black/50">
            Score ≥80 = directory admission. Paid membership = Trade Exchange/enquiry eligibility. Being listed does NOT mean the company receives homeowner enquiries.
          </p>

          {failureCats.total > 0 && (
            <>
              <div className="mt-4 mb-2 font-black uppercase tracking-wider text-black/70 text-[11px]">
                Failed · by category
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 md:grid-cols-6">
                {FAILURE_CATEGORY_DISPLAY_ORDER
                  .filter((k) => (failureCats.by_category[k] ?? 0) > 0)
                  .map((k) => {
                    const n = failureCats.by_category[k] ?? 0;
                    const tone: "rose" | "amber" | undefined =
                      k === "dns" || k === "http_404" || k === "not_html" ? "rose"
                      : k === "http_403" || k === "http_5xx" || k === "timeout" || k === "ssl" || k === "connection" || k === "http_other" || k === "transient_or_blocked" ? "amber"
                      : undefined;
                    return (
                      <FunnelPill key={k} label={FAILURE_CATEGORY_LABEL[k]} value={n} hint={FAILURE_CATEGORY_ACTION[k]} tone={tone} />
                    );
                  })}
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-black/50">
                Dead domains (DNS) never existed — NEX correctly refused to invent them. Bot-blocked
                (403) rows are usually real staircase companies · manual review candidates. Timeouts /
                5xx are retriable. Every failed row is preserved for audit per URL Provenance rule.
              </p>
            </>
          )}
        </div>
      )}

      {setupError && (
        <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-[12.5px] leading-relaxed text-red-900">
          <div className="mb-1 font-black uppercase tracking-wider text-red-800">
            Setup required · migrations not applied
          </div>
          {setupError.error === "table_missing" ? (
            <>
              <p>
                The <code>nex_collection_url_queue</code> table doesn&apos;t exist in Supabase yet. The URL-queue worker can&apos;t start until you apply the two migrations.
              </p>
              <ol className="mt-2 list-inside list-decimal space-y-0.5">
                <li><code>supabase/migrations/20260813180000_nex_collection_url_queue.sql</code> — queue + fetch_errors tables</li>
                <li><code>supabase/migrations/20260813190000_nex_collection_url_kind.sql</code> — kind + classification columns</li>
              </ol>
              <p className="mt-2">Apply them via Supabase Studio SQL editor / <code>supabase db push</code> / your usual runner, then reload this page.</p>
            </>
          ) : setupError.error === "column_missing" ? (
            <>
              <p>
                A queue column referenced by the worker is missing — you probably applied the first migration but not the second.
              </p>
              <p className="mt-2">Apply <code>supabase/migrations/20260813190000_nex_collection_url_kind.sql</code> (adds <code>kind</code> + <code>classification</code>) and reload.</p>
            </>
          ) : (
            <p>Supabase said: <code className="break-all">{setupError.detail}</code></p>
          )}
        </div>
      )}

      <QueueClient
        initialItems={initialItems}
        initialStats={initialStats}
        collectionType={collectionType}
        campaignDisplayName={category?.displayName ?? collectionType}
      />
    </div>
  );
}

function FunnelPill({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "emerald" | "amber" | "rose" }) {
  const bg =
    tone === "emerald" ? "bg-emerald-50 ring-emerald-200 text-emerald-900" :
    tone === "amber"   ? "bg-amber-50 ring-amber-200 text-amber-900" :
    tone === "rose"    ? "bg-rose-50 ring-rose-200 text-rose-900" :
                         "bg-black/[0.03] ring-black/10 text-black/85";
  return (
    <div className={`rounded-lg px-2.5 py-1.5 ring-1 ${bg}`}>
      <div className="text-[9.5px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 text-base font-black leading-none">{value}</div>
      {hint && <div className="mt-0.5 text-[9.5px] opacity-60">{hint}</div>}
    </div>
  );
}
