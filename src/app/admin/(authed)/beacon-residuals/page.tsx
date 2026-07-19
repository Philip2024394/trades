// /admin/(authed)/beacon-residuals — Tier-3 admin outreach queue.
//
// Every beacon that failed to attract 3 claims after all fanout waves
// lands here. Admin uses these as merchant-acquisition bait: sees the
// enquiry + trade slug + city → copies the bait link + messages
// prospective trades on WhatsApp / email / social. When a prospective
// trade joins via the bait link, their listing is stamped with the
// campaign source and (if fresh <48h) the enquiry routes to them
// automatically.
//
// Cookie-gated by the admin_session middleware higher up.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Residual = {
  id:              string;
  beacon_id:       string;
  escalated_at:    string;
  outreach_status: "pending" | "in_progress" | "converted" | "dropped";
  bait_link_slug:  string | null;
  outreach_notes:  string | null;
  outreach_by:     string | null;
  outreach_at:     string | null;
  beacon?: {
    customer_name:        string;
    customer_city:        string | null;
    trade_slug:           string;
    project_description:  string;
    sent_at:              string;
  } | null;
};

async function loadResiduals(): Promise<Residual[]> {
  const res = await supabaseAdmin
    .from("hammerex_beacon_admin_residuals")
    .select(`
      id, beacon_id, escalated_at, outreach_status, bait_link_slug,
      outreach_notes, outreach_by, outreach_at,
      beacon:hammerex_xrated_project_beacons!inner (
        customer_name, customer_city, trade_slug, project_description, sent_at
      )
    `)
    .order("escalated_at", { ascending: false })
    .limit(200);
  if (res.error) {
    console.error("[admin/beacon-residuals] read failed:", res.error);
    return [];
  }
  return (res.data ?? []) as unknown as Residual[];
}

export default async function BeaconResidualsPage() {
  const residuals = await loadResiduals();
  const canonical = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? "https://thenetworkers.app";

  const counts = {
    pending:     residuals.filter((r) => r.outreach_status === "pending").length,
    inProgress:  residuals.filter((r) => r.outreach_status === "in_progress").length,
    converted:   residuals.filter((r) => r.outreach_status === "converted").length,
    dropped:     residuals.filter((r) => r.outreach_status === "dropped").length
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B8860B]">
            Beacon residuals · Merchant acquisition queue
          </p>
          <h1 className="mt-1 text-[22px] font-black text-neutral-900">
            Bait leads ({residuals.length})
          </h1>
          <p className="mt-1 text-[12px] text-neutral-600">
            Homeowner enquiries with no matching trades. Use these to recruit new merchants —
            copy the bait link, reach prospective trades on WhatsApp / socials. When they join
            through the link, if the enquiry is still fresh (&lt;48h) they get first refusal.
          </p>
        </div>
        <div className="flex gap-2 text-[11px] font-bold">
          <Badge label="Pending"     count={counts.pending}    bg="#FFF7DB" fg="#7A5B00"/>
          <Badge label="In progress" count={counts.inProgress} bg="#FEF3C7" fg="#92400E"/>
          <Badge label="Converted"   count={counts.converted}  bg="#ECFDF5" fg="#166534"/>
          <Badge label="Dropped"     count={counts.dropped}    bg="#FEE2E2" fg="#991B1B"/>
        </div>
      </div>

      {residuals.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-6 text-center text-[13px] text-neutral-500" style={{ borderColor: "rgba(0,0,0,0.15)" }}>
          No residual beacons. Every enquiry so far found matching trades. 🎯
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <table className="w-full text-[12px]">
            <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Enquiry</th>
                <th className="px-3 py-2 text-left">Trade</th>
                <th className="px-3 py-2 text-left">City</th>
                <th className="px-3 py-2 text-left">Age</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Bait link</th>
                <th className="px-3 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {residuals.map((r) => {
                const ageHours = r.beacon ? Math.round((Date.now() - new Date(r.beacon.sent_at).getTime()) / 3600000) : 0;
                const fresh   = ageHours < 48;
                const baitUrl = r.bait_link_slug ? `${canonical}/beacon-join/${r.bait_link_slug}` : null;
                return (
                  <tr key={r.id} className="border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                    <td className="max-w-md px-3 py-3 align-top">
                      <p className="font-black text-neutral-900">{r.beacon?.customer_name ?? "—"}</p>
                      <p className="mt-1 line-clamp-3 text-[11px] text-neutral-600">{r.beacon?.project_description}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-700" style={{ borderColor: "rgba(0,0,0,0.10)" }}>
                        {r.beacon?.trade_slug}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-neutral-700">{r.beacon?.customer_city ?? "—"}</td>
                    <td className="px-3 py-3 align-top">
                      <span className={fresh ? "text-green-700 font-black" : "text-neutral-500"}>
                        {ageHours}h {fresh && "✓ fresh"}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <StatusPill status={r.outreach_status}/>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {baitUrl ? (
                        <a href={baitUrl} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-[10px] text-blue-700 underline">
                          {r.bait_link_slug}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <ResidualActions id={r.id} baitUrl={baitUrl} tradeSlug={r.beacon?.trade_slug ?? ""} city={r.beacon?.customer_city ?? ""}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-[11px] text-neutral-500">
        Sends 1 beacon → 3 nearest trades. Each has 2h. Timeouts back-fill. After 4 fanout waves with no takers, escalates here. Cron: `*/5 * * * *` at `/api/cron/beacon-sla-sweep`.
      </p>
    </main>
  );
}

function Badge({ label, count, bg, fg }: { label: string; count: number; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: bg, color: fg }}>
      {label}: <b>{count}</b>
    </span>
  );
}

function StatusPill({ status }: { status: Residual["outreach_status"] }) {
  const cfg = {
    pending:     { label: "Pending",     bg: "#FFF7DB", fg: "#7A5B00" },
    in_progress: { label: "In progress", bg: "#FEF3C7", fg: "#92400E" },
    converted:   { label: "Converted",   bg: "#ECFDF5", fg: "#166534" },
    dropped:     { label: "Dropped",     bg: "#FEE2E2", fg: "#991B1B" }
  }[status];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  );
}

function ResidualActions({ id, baitUrl, tradeSlug, city }: { id: string; baitUrl: string | null; tradeSlug: string; city: string }) {
  const outreachTemplate = baitUrl
    ? `Real ${tradeSlug} job in ${city || "the UK"} needs someone. Would take 60 seconds to see it: ${baitUrl}`
    : "";
  return (
    <div className="flex flex-col gap-1">
      {outreachTemplate && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(outreachTemplate)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white"
          style={{ backgroundColor: "#166534" }}
        >
          WhatsApp
        </a>
      )}
      <Link
        href={`/api/admin/beacon-residuals/${encodeURIComponent(id)}/mark?status=in_progress`}
        className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
      >
        → In progress
      </Link>
    </div>
  );
}
