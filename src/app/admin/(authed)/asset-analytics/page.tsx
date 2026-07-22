// /admin/asset-analytics — platform-wide view of the print-asset
// system. Shows every scan + every download opt-in in one table.
//
// Powers:
//   1. Real-time visibility of "how many trades printed posters
//      last month" for ops.
//   2. Signup-magnet funnel — WhatsApp numbers that downloaded a
//      poster but never became merchants. Feed into a WA drip.
//   3. Fraud check — repeat downloads from same IP hash on the
//      same asset (probable scraper).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Asset Analytics — Admin"
};

type AssetSummary = {
  id:             string;
  merchant_slug:  string;
  kind:           string;
  template_slug:  string;
  refresh_number: number;
  created_at:     string;
  scan_count:     number;
  download_count: number;
  footer_removed: boolean;
};

type ScanRow = {
  id:            string;
  asset_id:      string;
  merchant_slug: string;
  scanned_at:    string;
  country_code:  string | null;
  city:          string | null;
  user_agent:    string | null;
};

type DownloadRow = {
  id:                  string;
  asset_id:            string;
  merchant_slug:       string;
  downloaded_at:       string;
  downloaded_by_wa:    string | null;
  downloaded_by_email: string | null;
  format:              string;
  became_merchant_at:  string | null;
};

async function loadData(): Promise<{
  assets:     AssetSummary[];
  scans:      ScanRow[];
  downloads:  DownloadRow[];
  totals:     { assets: number; scans7d: number; downloads7d: number; conversions: number };
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [assetsRes, scansRes, dlRes, conversionsRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_merchant_assets")
      .select("id, merchant_slug, kind, template_slug, refresh_number, created_at, scan_count, download_count, footer_removed_paid_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("hammerex_merchant_asset_scans")
      .select("id, asset_id, merchant_slug, scanned_at, country_code, city, user_agent")
      .gte("scanned_at", sevenDaysAgo)
      .order("scanned_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("hammerex_merchant_asset_downloads")
      .select("id, asset_id, merchant_slug, downloaded_at, downloaded_by_wa, downloaded_by_email, format, became_merchant_at")
      .order("downloaded_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("hammerex_merchant_asset_downloads")
      .select("id", { count: "exact", head: true })
      .not("became_merchant_at", "is", null)
  ]);

  const assets: AssetSummary[] = (assetsRes.data ?? []).map((r) => ({
    id:             r.id as string,
    merchant_slug:  r.merchant_slug as string,
    kind:           r.kind as string,
    template_slug:  r.template_slug as string,
    refresh_number: r.refresh_number as number,
    created_at:     r.created_at as string,
    scan_count:     (r.scan_count as number | null) ?? 0,
    download_count: (r.download_count as number | null) ?? 0,
    footer_removed: !!r.footer_removed_paid_at
  }));

  const scans     = (scansRes.data ?? []) as ScanRow[];
  const downloads = (dlRes.data ?? []) as DownloadRow[];

  const totals = {
    assets:      assets.length,
    scans7d:     scans.length,
    downloads7d: downloads.filter((d) => new Date(d.downloaded_at).getTime() > Date.now() - 7 * 86400000).length,
    conversions: conversionsRes.count ?? 0
  };

  return { assets, scans, downloads, totals };
}

export default async function AssetAnalyticsPage() {
  const { assets, scans, downloads, totals } = await loadData();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-black">Asset Analytics</h1>
        <p className="text-[13px] text-neutral-600">Print collateral scans, downloads, and signup-magnet conversions.</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total assets" value={totals.assets} sub="all time"/>
        <Kpi label="Scans (7d)"    value={totals.scans7d} sub="QR taps"/>
        <Kpi label="Downloads (7d)" value={totals.downloads7d} sub="PDF fetches"/>
        <Kpi label="Signup conversions" value={totals.conversions} sub="WA → merchant"/>
      </div>

      {/* Assets table */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Recent assets · latest 100
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b bg-neutral-50">
              <tr>
                <Th>Merchant</Th>
                <Th>Kind</Th>
                <Th>Template</Th>
                <Th align="right">V</Th>
                <Th align="right">Scans</Th>
                <Th align="right">DLs</Th>
                <Th>Footer</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b hover:bg-neutral-50">
                  <Td><Link href={`/${a.merchant_slug}`} className="font-black text-neutral-900 underline">{a.merchant_slug}</Link></Td>
                  <Td>{a.kind}</Td>
                  <Td>{a.template_slug}</Td>
                  <Td align="right" mono>{a.refresh_number}</Td>
                  <Td align="right" mono>{a.scan_count}</Td>
                  <Td align="right" mono>{a.download_count}</Td>
                  <Td>{a.footer_removed ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-800">Paid</span> : <span className="text-neutral-400">shown</span>}</Td>
                  <Td>{new Date(a.created_at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                </tr>
              ))}
              {assets.length === 0 && <tr><Td>—</Td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Downloads table with signup conversion */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Download opt-ins · latest 200 (signup magnet funnel)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b bg-neutral-50">
              <tr>
                <Th>When</Th>
                <Th>Merchant</Th>
                <Th>WA number</Th>
                <Th>Email</Th>
                <Th>Format</Th>
                <Th>Became merchant?</Th>
              </tr>
            </thead>
            <tbody>
              {downloads.map((d) => (
                <tr key={d.id} className="border-b hover:bg-neutral-50">
                  <Td>{new Date(d.downloaded_at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td><Link href={`/${d.merchant_slug}`} className="font-black text-neutral-900 underline">{d.merchant_slug}</Link></Td>
                  <Td mono>{d.downloaded_by_wa || <span className="text-neutral-400">—</span>}</Td>
                  <Td>{d.downloaded_by_email || <span className="text-neutral-400">—</span>}</Td>
                  <Td mono>{d.format}</Td>
                  <Td>
                    {d.became_merchant_at
                      ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-800">✓ Converted</span>
                      : <span className="text-neutral-400">pending</span>}
                  </Td>
                </tr>
              ))}
              {downloads.length === 0 && <tr><Td>—</Td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scans table (last 7d) */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Scans · last 7 days · latest 200
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b bg-neutral-50">
              <tr>
                <Th>When</Th>
                <Th>Merchant</Th>
                <Th>Country</Th>
                <Th>City</Th>
                <Th>Device</Th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id} className="border-b hover:bg-neutral-50">
                  <Td>{new Date(s.scanned_at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td><Link href={`/${s.merchant_slug}`} className="font-black text-neutral-900 underline">{s.merchant_slug}</Link></Td>
                  <Td mono>{s.country_code || "—"}</Td>
                  <Td>{s.city || "—"}</Td>
                  <Td className="truncate">{s.user_agent ? s.user_agent.slice(0, 60) : "—"}</Td>
                </tr>
              ))}
              {scans.length === 0 && <tr><Td>—</Td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-3xl font-black tabular-nums text-neutral-900">{value}</p>
      <p className="text-[10.5px] text-neutral-500">{sub}</p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={"px-2 py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-600 " + (align === "right" ? "text-right" : "text-left")}>{children}</th>;
}
function Td({ children, align, mono, className }: { children: React.ReactNode; align?: "left" | "right"; mono?: boolean; className?: string }) {
  return <td className={"px-2 py-1.5 " + (align === "right" ? "text-right " : "") + (mono ? "font-mono " : "") + (className ?? "")}>{children}</td>;
}
