// Admin — affiliate review queue.
//
// Surfaces every affiliate flagged by the daily fraud-check cron.
// Each row shows the flags, when they were detected, and admin
// actions: Mark as reviewed (clear flags + requires_review) or
// Suspend account.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ReviewRowActions } from "./ReviewRowActions";

export const dynamic = "force-dynamic";

type FraudFlag = {
  flag: string;
  detected_at: string;
  reason: string;
};

type Row = {
  affiliate_id: number;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  whatsapp: string;
  status: string;
  fraud_flags: FraudFlag[];
};

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

export default async function ReviewQueuePage() {
  const { data } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "affiliate_id, first_name, last_name, company_name, whatsapp, status, fraud_flags"
    )
    .eq("requires_review", true)
    .order("affiliate_id", { ascending: true });
  const rows = (data ?? []) as Row[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[13px] text-brand-muted">
          <Link href="/admin/affiliates" className="hover:underline">
            &larr; Affiliates
          </Link>
        </p>
        <h1 className="text-2xl font-extrabold">Review queue</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          {rows.length} affiliate{rows.length === 1 ? "" : "s"} flagged by the
          fraud-check cron. Review the flags, then either clear them or
          suspend the account.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Flags</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const name =
                [a.first_name, a.last_name].filter(Boolean).join(" ") ||
                a.company_name ||
                "—";
              return (
                <tr
                  key={a.affiliate_id}
                  className="border-t border-brand-line align-top"
                >
                  <td className="px-3 py-2 font-mono font-bold">
                    <Link
                      href={`/admin/affiliates/${a.affiliate_id}`}
                      className="text-brand-accent hover:underline"
                    >
                      #{a.affiliate_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2">
                    <ul className="space-y-1">
                      {(a.fraud_flags ?? []).map((f, i) => (
                        <li key={i}>
                          <span className="rounded bg-red-900/40 px-2 py-0.5 text-[13px] font-bold text-red-300">
                            {f.flag}
                          </span>
                          <p className="mt-1 text-[13px] text-brand-muted">
                            {f.reason} <span className="text-brand-muted">· {fmt(f.detected_at)}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[13px] font-bold ${
                        a.status === "active"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ReviewRowActions affiliateId={a.affiliate_id} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  Nothing in the queue. Fraud check next runs at 04:00 UTC.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
