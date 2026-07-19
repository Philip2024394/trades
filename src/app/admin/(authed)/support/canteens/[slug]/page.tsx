// Admin Customer Support → Canteens → [slug] restore page.
//
// Shows the full snapshot history for one canteen with a restore form
// gated by the three safety layers (passcode, slug confirmation, reason
// note). The actual restore is a client-side POST to
// /api/admin/canteens/[slug]/restore.

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CanteenRestoreForm } from "./CanteenRestoreForm";
import { AdminCanteenActions } from "./AdminCanteenActions";

export const dynamic = "force-dynamic";

type SnapshotRow = {
  id: string;
  kind: string;
  note: string | null;
  created_by: string;
  created_at: string;
};

type CanteenRow = {
  id: string;
  slug: string;
  name: string;
  host_slug: string | null;
  trade_slug: string | null;
  header_bg_url: string | null;
};

type RestoreLogRow = {
  id: string;
  restored_from_snapshot_id: string;
  pre_restore_snapshot_id: string;
  actor: string;
  reason: string;
  created_at: string;
};

async function loadCanteen(slug: string): Promise<CanteenRow | null> {
  const res = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, slug, name, host_slug, trade_slug, header_bg_url")
    .eq("slug", slug)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return {
    id: String(res.data.id),
    slug: String(res.data.slug),
    name: String(res.data.name),
    host_slug: (res.data.host_slug as string | null) ?? null,
    trade_slug: (res.data.trade_slug as string | null) ?? null,
    header_bg_url: (res.data.header_bg_url as string | null) ?? null
  };
}

async function loadSnapshots(canteenId: string): Promise<SnapshotRow[]> {
  const res = await supabaseAdmin
    .from("hammerex_canteen_snapshots")
    .select("id, kind, note, created_by, created_at")
    .eq("canteen_id", canteenId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (res.error || !res.data) return [];
  return res.data.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    note: (r.note as string | null) ?? null,
    created_by: String(r.created_by),
    created_at: String(r.created_at)
  }));
}

async function loadRestoreLog(canteenId: string): Promise<RestoreLogRow[]> {
  const res = await supabaseAdmin
    .from("hammerex_canteen_restore_log")
    .select("id, restored_from_snapshot_id, pre_restore_snapshot_id, actor, reason, created_at")
    .eq("canteen_id", canteenId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (res.error || !res.data) return [];
  return res.data.map((r) => ({
    id: String(r.id),
    restored_from_snapshot_id: String(r.restored_from_snapshot_id),
    pre_restore_snapshot_id: String(r.pre_restore_snapshot_id),
    actor: String(r.actor),
    reason: String(r.reason),
    created_at: String(r.created_at)
  }));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function kindLabel(kind: string): string {
  if (kind === "auto") return "Auto (save)";
  if (kind === "named") return "Named (manual)";
  if (kind === "pre_restore") return "Pre-restore";
  return kind;
}

export default async function AdminSupportCanteenRestorePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = await loadCanteen(slug);
  if (!canteen) notFound();

  const [snapshots, restoreLog] = await Promise.all([
    loadSnapshots(canteen.id),
    loadRestoreLog(canteen.id)
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-2 text-xs text-brand-muted">
        <Link href="/admin/support" className="hover:text-brand-text">Customer Support</Link>
        <span>›</span>
        <Link href="/admin/support/canteens" className="hover:text-brand-text">Canteens</Link>
        <span>›</span>
        <span className="font-mono">{canteen.slug}</span>
      </div>

      <h1 className="mt-2 text-xl font-semibold text-brand-text">
        Restore &ldquo;{canteen.name}&rdquo;
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Host: <span className="font-mono">{canteen.host_slug ?? "—"}</span> &middot; Trade: {canteen.trade_slug ?? "—"}
      </p>

      {/* Admin quick-edit — theme picker link + hero banner uploader.
          Added 2026-07-17 (Philip): support should be able to nudge a
          merchant's theme + banner without cross-tab context switching. */}
      <AdminCanteenActions
        canteenSlug={canteen.slug}
        initialHeaderBgUrl={canteen.header_bg_url}
      />

      {/* Restore form — client component with the safety gates. */}
      <div className="mt-6">
        <CanteenRestoreForm
          canteenSlug={canteen.slug}
          snapshots={snapshots.map((s) => ({
            id: s.id,
            label: `${formatDate(s.created_at)} · ${kindLabel(s.kind)}${s.note ? ` · ${s.note}` : ""} · by ${s.created_by}`
          }))}
        />
      </div>

      {/* Snapshot history */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-brand-text">
          Snapshot history ({snapshots.length})
        </h2>
        {snapshots.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-brand-line p-4 text-xs text-brand-muted">
            No snapshots yet. Snapshots are created automatically on merchant saves + daily cron.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-brand-line">
            <table className="w-full text-xs">
              <thead className="bg-brand-surface uppercase tracking-wide text-brand-muted">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Note</th>
                  <th className="px-3 py-2 text-left">Created by</th>
                  <th className="px-3 py-2 text-left font-mono">ID</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} className="border-t border-brand-line">
                    <td className="px-3 py-2 text-brand-text">{formatDate(s.created_at)}</td>
                    <td className="px-3 py-2 text-brand-muted">{kindLabel(s.kind)}</td>
                    <td className="px-3 py-2 text-brand-muted">{s.note ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-brand-muted">{s.created_by}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-brand-muted">{s.id.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Restore audit log — every previous restore for this canteen */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-brand-text">
          Restore audit ({restoreLog.length})
        </h2>
        {restoreLog.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-brand-line p-4 text-xs text-brand-muted">
            No restores have been performed on this canteen.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-brand-line">
            <table className="w-full text-xs">
              <thead className="bg-brand-surface uppercase tracking-wide text-brand-muted">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left font-mono">Restored from</th>
                  <th className="px-3 py-2 text-left font-mono">Pre-restore (undo)</th>
                </tr>
              </thead>
              <tbody>
                {restoreLog.map((r) => (
                  <tr key={r.id} className="border-t border-brand-line">
                    <td className="px-3 py-2 text-brand-text">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-2 text-brand-muted">{r.actor}</td>
                    <td className="px-3 py-2 text-brand-muted">{r.reason}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-brand-muted">{r.restored_from_snapshot_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-brand-muted">{r.pre_restore_snapshot_id.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
