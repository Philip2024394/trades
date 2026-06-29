// Admin — affiliate campaigns.
//
// Lists every campaign (active first), shows kind / value modifier /
// window / status, with quick actions (end, cancel) and a New button.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CampaignRowActions } from "./CampaignRowActions";

export const dynamic = "force-dynamic";

type Campaign = {
  id: string;
  kind: "competition" | "bonus" | "seasonal";
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  bonus_pence: number;
  multiplier: number;
  prize_pence: number;
  prize_count: number;
  status: "active" | "ended" | "cancelled";
  created_at: string;
};

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB");
  } catch {
    return iso;
  }
}

export default async function AdminCampaignsPage() {
  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_campaigns")
    .select("*")
    .order("status", { ascending: true })
    .order("starts_at", { ascending: false });
  const campaigns = (data ?? []) as Campaign[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-brand-muted">
            <Link href="/admin/affiliates" className="hover:underline">
              &larr; Affiliates
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">Campaigns</h1>
          <p className="mt-1 text-[13px] text-brand-muted">
            Monthly competitions, bonus multipliers and seasonal promotions.
            Active bonus/seasonal campaigns reprice every newly-created
            commission while their window is open.
          </p>
        </div>
        <Link
          href="/admin/affiliates/campaigns/new"
          className="rounded-lg bg-brand-accent px-4 py-2 text-[13px] font-bold text-black hover:opacity-90"
        >
          + New campaign
        </Link>
      </header>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Window</th>
              <th className="px-3 py-2">Value modifier</th>
              <th className="px-3 py-2">Prize</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-brand-line align-top">
                <td className="px-3 py-2 font-mono uppercase text-brand-muted">
                  {c.kind}
                </td>
                <td className="px-3 py-2">
                  <div className="font-bold text-brand-text">{c.title}</div>
                  {c.description && (
                    <div className="text-[13px] text-brand-muted">
                      {c.description}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-brand-muted">
                  {fmt(c.starts_at)} → {fmt(c.ends_at)}
                </td>
                <td className="px-3 py-2">
                  {c.multiplier !== 1 ? `${c.multiplier}×` : ""}
                  {c.multiplier !== 1 && c.bonus_pence ? " + " : ""}
                  {c.bonus_pence ? `+${pounds(c.bonus_pence)}` : ""}
                  {c.multiplier === 1 && !c.bonus_pence ? "—" : ""}
                </td>
                <td className="px-3 py-2">
                  {c.prize_pence
                    ? `${pounds(c.prize_pence)} × ${c.prize_count}`
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[13px] font-bold ${
                      c.status === "active"
                        ? "bg-green-900/40 text-green-400"
                        : "bg-brand-bg text-brand-muted"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <CampaignRowActions id={c.id} status={c.status} />
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No campaigns yet. Create one to add a bonus or run a
                  competition.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
