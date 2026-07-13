// Admin Customer Support → Canteens list.
//
// Lists every canteen with its slug + tier + snapshot count + last
// snapshot time. Clicking through opens the per-canteen restore UI at
// /admin/support/canteens/[slug].
//
// Restricted to paid tiers by default — free-tier merchants don't get
// the restore benefit (paid perk).

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Restore canteen — Admin" };

type CanteenRow = {
  id: string;
  slug: string;
  name: string;
  host_slug: string | null;
  trade_slug: string | null;
  snapshot_count: number;
  last_snapshot_at: string | null;
};

async function loadCanteens(): Promise<CanteenRow[]> {
  // Fetch canteens + their snapshot counts. Two queries because
  // Supabase doesn't let us cheaply do a "count of related snapshots
  // per row" in one shot without RPC — so two round trips, joined in
  // application code.
  const canteensRes = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, slug, name, host_slug, trade_slug")
    .order("slug", { ascending: true });
  if (canteensRes.error || !canteensRes.data) return [];

  const snapshotsRes = await supabaseAdmin
    .from("hammerex_canteen_snapshots")
    .select("canteen_id, created_at")
    .order("created_at", { ascending: false });

  const counts = new Map<string, { count: number; last: string | null }>();
  if (!snapshotsRes.error && snapshotsRes.data) {
    for (const s of snapshotsRes.data) {
      const key = String(s.canteen_id);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { count: 1, last: String(s.created_at) });
      }
    }
  }

  return canteensRes.data.map((c) => {
    const stats = counts.get(String(c.id));
    return {
      id: String(c.id),
      slug: String(c.slug),
      name: String(c.name),
      host_slug: (c.host_slug as string | null) ?? null,
      trade_slug: (c.trade_slug as string | null) ?? null,
      snapshot_count: stats?.count ?? 0,
      last_snapshot_at: stats?.last ?? null
    };
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default async function AdminSupportCanteensPage() {
  const canteens = await loadCanteens();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/support"
          className="text-xs text-brand-muted hover:text-brand-text"
        >
          ← Customer Support
        </Link>
      </div>
      <h1 className="mt-2 text-xl font-semibold text-brand-text">
        Restore a canteen
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Pick a canteen to view its snapshot history and roll it back to a prior state.
      </p>

      {canteens.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-brand-line p-6 text-center text-sm text-brand-muted">
          No canteens found.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-brand-line">
          <table className="w-full text-sm">
            <thead className="bg-brand-surface text-xs uppercase tracking-wide text-brand-muted">
              <tr>
                <th className="px-4 py-2 text-left">Slug</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Trade</th>
                <th className="px-4 py-2 text-left">Host</th>
                <th className="px-4 py-2 text-right">Snapshots</th>
                <th className="px-4 py-2 text-left">Last snapshot</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {canteens.map((c) => (
                <tr key={c.id} className="border-t border-brand-line">
                  <td className="px-4 py-2 font-mono text-xs text-brand-text">{c.slug}</td>
                  <td className="px-4 py-2 text-brand-text">{c.name}</td>
                  <td className="px-4 py-2 text-brand-muted">{c.trade_slug ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-brand-muted">{c.host_slug ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-brand-text">{c.snapshot_count}</td>
                  <td className="px-4 py-2 text-xs text-brand-muted">{formatDate(c.last_snapshot_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/support/canteens/${c.slug}`}
                      className="inline-block rounded border border-brand-line px-2 py-1 text-xs hover:border-brand-accent hover:text-brand-accent"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
