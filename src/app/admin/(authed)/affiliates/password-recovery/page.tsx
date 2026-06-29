// Admin — affiliate password-recovery queue. Mirrors the tradesperson
// queue at /admin/password-recovery: each row is an affiliate who hit
// /api/affiliates/forgot-password AND whose recovery_sent_at is still
// null. Click "Send via WhatsApp" → opens wa.me pre-filled with the
// reset URL and POSTs to /api/admin/affiliates/password-recovery/sent
// so the row leaves the queue and the code becomes redeemable.
import { headers } from "next/headers";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AffiliatePasswordRecoverySendButton } from "./AffiliatePasswordRecoverySendButton";

export const dynamic = "force-dynamic";

type Row = {
  affiliate_id: number;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  whatsapp: string | null;
  email: string | null;
  password_recovery_token: string | null;
  password_recovery_requested_at: string | null;
};

function relativeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

async function siteOriginFromRequest(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "https://xratedtrade.com";
}

function firstName(name: string | null): string {
  if (!name) return "there";
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
}

export default async function AdminAffiliatePasswordRecoveryPage() {
  const { data } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "affiliate_id, first_name, last_name, company_name, whatsapp, email, password_recovery_token, password_recovery_requested_at"
    )
    .not("password_recovery_requested_at", "is", null)
    .is("password_recovery_sent_at", null)
    .order("password_recovery_requested_at", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Row[]).filter(
    (r) =>
      typeof r.password_recovery_token === "string" &&
      r.password_recovery_token.length > 0
  );
  const origin = await siteOriginFromRequest();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-brand-muted">
            <Link href="/admin/affiliates" className="hover:underline">
              &larr; Affiliates
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">
            Affiliate password reset queue
            <span className="ml-2 inline-flex items-center rounded-full bg-brand-accent px-2 py-0.5 text-[13px] font-bold text-black">
              {rows.length}
            </span>
          </h1>
          <p className="mt-1 text-[13px] text-brand-muted">
            Affiliates with no email on file fall into this queue. Click
            <em> Send via WhatsApp</em> to open the composer with the reset
            link pre-filled — this also unlocks the link for redemption.
          </p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">WhatsApp</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Requested</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No pending affiliate password resets.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const waDigits = (row.whatsapp ?? "").replace(/\D/g, "");
                const code = row.password_recovery_token ?? "";
                const recoveryUrl =
                  waDigits && code
                    ? `${origin}/affiliates/set-password?wa=${encodeURIComponent(
                        waDigits
                      )}&recovery_code=${encodeURIComponent(code)}`
                    : "";
                const name = firstName(
                  [row.first_name, row.last_name]
                    .filter(Boolean)
                    .join(" ") || row.company_name
                );
                const messageBody = `Hi ${name}, here's your affiliate password reset link for xratedtrade.com: ${recoveryUrl}\n\nThis link expires in 24 hours.`;
                const waUrl =
                  waDigits && recoveryUrl
                    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(messageBody)}`
                    : "";
                const displayName =
                  [row.first_name, row.last_name].filter(Boolean).join(" ") ||
                  row.company_name ||
                  `Affiliate #${row.affiliate_id}`;
                return (
                  <tr
                    key={row.affiliate_id}
                    className="border-t border-brand-line align-top hover:bg-brand-line/40"
                  >
                    <td className="px-3 py-2 font-mono font-bold text-brand-accent">
                      <Link
                        href={`/admin/affiliates/${row.affiliate_id}`}
                        className="hover:underline"
                      >
                        #{row.affiliate_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{displayName}</td>
                    <td className="px-3 py-2 font-mono text-[13px]">
                      {row.whatsapp || "—"}
                    </td>
                    <td className="px-3 py-2 text-brand-muted">
                      {row.email || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-brand-text">
                        {relativeAgo(row.password_recovery_requested_at)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <AffiliatePasswordRecoverySendButton
                        affiliateId={row.affiliate_id}
                        waUrl={waUrl}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
