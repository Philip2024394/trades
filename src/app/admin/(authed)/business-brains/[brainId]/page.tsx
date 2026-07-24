// Admin dashboard — Business Brain detail view.
//
// Drill-down for a single brain. Shows business + brain metadata plus
// four content tabs (Pages · Products · Services · FAQs) and a Sync
// Jobs history strip so the admin can see what changed on the last
// crawl and how the job resolved.

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type PageRow = { id: string; url: string; title: string | null; category: string; word_count: number | null; last_crawled_at: string | null };
type ProductRow = { id: string; name: string; category: string | null; price_display: string | null; confidence_pct: number | null; last_seen_at: string | null };
type ServiceRow = { id: string; name: string; confidence_pct: number | null; last_seen_at: string | null };
type FaqRow = { id: string; question: string; answer: string; confidence_pct: number | null };
type JobRow = { id: string; status: string; triggered_by: string; started_at: string; finished_at: string | null;
                pages_crawled: number | null; pages_added: number | null; pages_changed: number | null;
                products_found: number | null; services_found: number | null; faqs_found: number | null;
                duration_ms: number | null; errors: Array<{ url: string; error: string }> | null };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function statusPill(status: string): string {
  switch (status) {
    case "completed": return "bg-green-100 text-green-800";
    case "partial":   return "bg-amber-100 text-amber-800";
    case "failed":    return "bg-red-100 text-red-800";
    case "running":   return "bg-blue-100 text-blue-800";
    default:          return "bg-slate-100 text-slate-600";
  }
}

export default async function BusinessBrainDetailPage({
  params
}: {
  params: Promise<{ brainId: string }>;
}) {
  const { brainId } = await params;

  const { data: brain } = await supabaseAdmin
    .from("business_brains")
    .select("*, business:business_brain_businesses!business_id(id, name, primary_domain)")
    .eq("id", brainId)
    .maybeSingle();

  if (!brain) notFound();
  const b = brain as {
    id: string; business_id: string; status: string; sync_frequency: string;
    last_synced_at: string | null; next_sync_due_at: string | null; pages_indexed: number | null;
    crawl_root_url: string | null;
    business: { id: string; name: string; primary_domain: string };
  };

  const [pagesRes, productsRes, servicesRes, faqsRes, jobsRes] = await Promise.all([
    supabaseAdmin.from("brain_pages")
      .select("id, url, title, category, word_count, last_crawled_at")
      .eq("brain_id", brainId).order("last_crawled_at", { ascending: false }).limit(50),
    supabaseAdmin.from("brain_products")
      .select("id, name, category, price_display, confidence_pct, last_seen_at")
      .eq("brain_id", brainId).order("last_seen_at", { ascending: false }).limit(50),
    supabaseAdmin.from("brain_services")
      .select("id, name, confidence_pct, last_seen_at")
      .eq("brain_id", brainId).order("last_seen_at", { ascending: false }).limit(50),
    supabaseAdmin.from("brain_faqs")
      .select("id, question, answer, confidence_pct")
      .eq("brain_id", brainId).order("last_seen_at", { ascending: false }).limit(50),
    supabaseAdmin.from("brain_sync_jobs")
      .select("id, status, triggered_by, started_at, finished_at, pages_crawled, pages_added, pages_changed, products_found, services_found, faqs_found, duration_ms, errors")
      .eq("brain_id", brainId).order("started_at", { ascending: false }).limit(10)
  ]);

  const pages    = (pagesRes.data    ?? []) as PageRow[];
  const products = (productsRes.data ?? []) as ProductRow[];
  const services = (servicesRes.data ?? []) as ServiceRow[];
  const faqs     = (faqsRes.data     ?? []) as FaqRow[];
  const jobs     = (jobsRes.data     ?? []) as JobRow[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 text-xs text-slate-500">
        <Link href="/admin/business-brains" className="hover:underline">← All Business Brains</Link>
      </div>

      <div className="mb-6 rounded border border-slate-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{b.business.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <a href={`https://${b.business.primary_domain}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                {b.business.primary_domain}
              </a>
              {b.crawl_root_url && b.crawl_root_url !== `https://${b.business.primary_domain}/` && (
                <span className="ml-2 text-slate-400">· crawl root {b.crawl_root_url}</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{b.status}</span>
            <span className="text-slate-500">Sync: {b.sync_frequency}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs md:grid-cols-4">
          <Stat label="Pages indexed" value={b.pages_indexed ?? 0} />
          <Stat label="Last sync" value={fmtDate(b.last_synced_at)} />
          <Stat label="Next sync due" value={fmtDate(b.next_sync_due_at)} />
          <Stat label="Brain ID" value={<code className="text-[10px]">{b.id.slice(0, 8)}…</code>} />
        </div>
      </div>

      <Section title="Sync jobs (last 10)" count={jobs.length}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Trigger</th>
              <th className="px-3 py-2 text-right">Pages</th>
              <th className="px-3 py-2 text-right">Added</th>
              <th className="px-3 py-2 text-right">Changed</th>
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2 text-right">Services</th>
              <th className="px-3 py-2 text-right">FAQs</th>
              <th className="px-3 py-2 text-right">Duration</th>
              <th className="px-3 py-2 text-right">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(j.started_at)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${statusPill(j.status)}`}>{j.status}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{j.triggered_by}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{j.pages_crawled ?? 0}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{j.pages_added ?? 0}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{j.pages_changed ?? 0}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{j.products_found ?? 0}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{j.services_found ?? 0}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{j.faqs_found ?? 0}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{j.errors?.length ?? 0}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-500">No sync jobs yet.</td></tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Products" count={products.length}>
        <ul className="divide-y divide-slate-100">
          {products.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{p.name}</span>
                {p.category && <span className="ml-2 text-xs text-slate-500">· {p.category}</span>}
              </div>
              <div className="text-xs text-slate-500">
                {p.price_display ?? "—"} · confidence {p.confidence_pct ?? 0}% · seen {fmtDate(p.last_seen_at)}
              </div>
            </li>
          ))}
          {products.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">None yet.</li>}
        </ul>
      </Section>

      <Section title="Services" count={services.length}>
        <ul className="divide-y divide-slate-100">
          {services.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between px-3 py-2 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-slate-500">confidence {s.confidence_pct ?? 0}% · seen {fmtDate(s.last_seen_at)}</span>
            </li>
          ))}
          {services.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">None yet.</li>}
        </ul>
      </Section>

      <Section title="FAQs" count={faqs.length}>
        <ul className="divide-y divide-slate-100">
          {faqs.map((f) => (
            <li key={f.id} className="px-3 py-3 text-sm">
              <div className="font-medium">{f.question}</div>
              <div className="mt-1 text-xs text-slate-600">{f.answer}</div>
              <div className="mt-1 text-[10px] text-slate-400">confidence {f.confidence_pct ?? 0}%</div>
            </li>
          ))}
          {faqs.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">None yet.</li>}
        </ul>
      </Section>

      <Section title="Pages (last 50)" count={pages.length}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Words</th>
              <th className="px-3 py-2">Crawled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pages.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 text-sm">{p.title ?? "(no title)"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{p.url}</a>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{p.category}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{p.word_count ?? 0}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(p.last_crawled_at)}</td>
              </tr>
            ))}
            {pages.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No pages crawled yet.</td></tr>}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6 overflow-hidden rounded border border-slate-200 bg-white">
      <header className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-[11px] text-slate-500">{count} record{count === 1 ? "" : "s"}</span>
      </header>
      {children}
    </section>
  );
}
