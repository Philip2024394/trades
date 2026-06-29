// Admin — chronological audit log of every affiliate-system action.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

export default async function AdminAffiliateAuditLogPage() {
  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_audit_log")
    .select("id, actor_type, actor_id, action, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[13px] text-brand-muted">
          <Link href="/admin/affiliates" className="hover:underline">
            ← Affiliates
          </Link>
        </p>
        <h1 className="text-2xl font-extrabold">Audit log</h1>
        <p className="text-[13px] text-brand-muted">
          Most recent 500 actions.
        </p>
      </header>
      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-brand-line">
                <td className="px-3 py-2 text-brand-muted">
                  {fmt(row.created_at)}
                </td>
                <td className="px-3 py-2">
                  <span className="font-bold">{row.actor_type}</span>
                  {row.actor_id && (
                    <span className="text-brand-muted"> · {row.actor_id}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-brand-accent">
                  {row.action}
                </td>
                <td className="px-3 py-2 font-mono text-[13px] text-brand-muted">
                  {row.target_id ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-brand-muted">
                  {row.details && Object.keys(row.details).length > 0
                    ? JSON.stringify(row.details)
                    : "—"}
                </td>
              </tr>
            ))}
            {!data?.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-brand-muted">
                  Empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
