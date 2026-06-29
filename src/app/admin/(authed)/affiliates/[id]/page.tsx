// Admin — affiliate detail. Referrals, commissions, audit log, recent
// logins. Action buttons (suspend / reset password) call the admin API.
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AffiliateAdminActions } from "./AffiliateAdminActions";

export const dynamic = "force-dynamic";

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

export default async function AdminAffiliateDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const { data: aff } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "affiliate_id, whatsapp, status, first_name, last_name, company_name, country, email, website, facebook, instagram, tiktok, youtube, twitter, linkedin, payment_details_completed_at, tax_agreement_accepted_at, content_agreement_accepted_at, payment_timing_agreement_accepted_at, created_at, last_login_at"
    )
    .eq("affiliate_id", id)
    .maybeSingle();
  if (!aff) notFound();

  const [
    { data: pm },
    { data: commissions },
    { data: listings },
    { data: logs },
    { data: socialLinks }
  ] = await Promise.all([
    supabaseAdmin
      .from("hammerex_affiliate_payment_methods")
      .select("*")
      .eq("affiliate_id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select(
        "id, amount_pence, status, listing_id, created_at, approved_at, paid_at, cancelled_reason"
      )
      .eq("affiliate_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, tier, created_at")
      .eq("affiliate_referrer_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("hammerex_affiliate_audit_log")
      .select("id, actor_type, actor_id, action, target_id, details, created_at")
      .or(`actor_id.eq.${id},target_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("hammerex_affiliate_social_links")
      .select("id, platform, url, status, last_checked_at, created_at")
      .eq("affiliate_id", id)
      .order("created_at", { ascending: false })
  ]);

  const name =
    [aff.first_name, aff.last_name].filter(Boolean).join(" ") ||
    aff.company_name ||
    "—";

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-brand-muted">
            <Link href="/admin/affiliates" className="hover:underline">
              ← All affiliates
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">
            Affiliate #{aff.affiliate_id} · {name}
          </h1>
          <p className="mt-1 text-[13px] text-brand-muted">
            WhatsApp: {aff.whatsapp} · Joined {fmt(aff.created_at)} · Last
            login {fmt(aff.last_login_at)}
          </p>
        </div>
        <AffiliateAdminActions
          affiliateId={aff.affiliate_id}
          status={aff.status}
        />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Profile">
          <dl className="space-y-1 text-[13px]">
            <Row k="Country" v={aff.country ?? "—"} />
            <Row k="Email" v={aff.email ?? "—"} />
            <Row k="Website" v={aff.website ?? "—"} />
            <Row k="Facebook" v={aff.facebook ?? "—"} />
            <Row k="Instagram" v={aff.instagram ?? "—"} />
            <Row k="TikTok" v={aff.tiktok ?? "—"} />
            <Row k="YouTube" v={aff.youtube ?? "—"} />
            <Row k="LinkedIn" v={aff.linkedin ?? "—"} />
          </dl>
        </Card>
        <Card title="Payment details">
          {pm ? (
            <dl className="space-y-1 text-[13px]">
              <Row k="Trading status" v={pm.trading_status} />
              <Row k="Legal name" v={pm.legal_name} />
              <Row k="Country" v={pm.country_iso2} />
              <Row k="Method" v={pm.payment_method} />
              {pm.bank_account_name && (
                <Row k="Bank holder" v={pm.bank_account_name} />
              )}
              {pm.bank_sort_code && (
                <Row k="Sort code" v={pm.bank_sort_code} />
              )}
              {pm.bank_account_number && (
                <Row k="Account" v={pm.bank_account_number} />
              )}
              {pm.iban && <Row k="IBAN" v={pm.iban} />}
              {pm.swift_bic && <Row k="SWIFT" v={pm.swift_bic} />}
              {pm.paypal_email && <Row k="PayPal" v={pm.paypal_email} />}
              {pm.wise_email && <Row k="Wise" v={pm.wise_email} />}
              <Row
                k="Completed"
                v={fmt(aff.payment_details_completed_at)}
              />
              <Row k="Tax accepted" v={fmt(aff.tax_agreement_accepted_at)} />
              <Row
                k="Content accepted"
                v={fmt(aff.content_agreement_accepted_at)}
              />
              <Row
                k="Timing accepted"
                v={fmt(aff.payment_timing_agreement_accepted_at)}
              />
            </dl>
          ) : (
            <p className="text-[13px] text-brand-muted">
              Payment details not yet completed.
            </p>
          )}
        </Card>
      </section>

      <Card title="Referred listings">
        <table className="min-w-full text-[13px]">
          <thead className="text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-2 py-1">Slug</th>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Tier</th>
              <th className="px-2 py-1">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(listings ?? []).map((l) => (
              <tr key={l.id} className="border-t border-brand-line">
                <td className="px-2 py-1 font-mono text-brand-accent">
                  <a href={`/trade/${l.slug}`} target="_blank" rel="noopener noreferrer">
                    {l.slug}
                  </a>
                </td>
                <td className="px-2 py-1">{l.display_name ?? "—"}</td>
                <td className="px-2 py-1">{l.tier}</td>
                <td className="px-2 py-1 text-brand-muted">{fmt(l.created_at)}</td>
              </tr>
            ))}
            {!listings?.length && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-brand-muted">
                  No referred listings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Commissions">
        <table className="min-w-full text-[13px]">
          <thead className="text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-2 py-1">Amount</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Created</th>
              <th className="px-2 py-1">Approved</th>
              <th className="px-2 py-1">Paid</th>
            </tr>
          </thead>
          <tbody>
            {(commissions ?? []).map((c) => (
              <tr key={c.id} className="border-t border-brand-line">
                <td className="px-2 py-1 font-bold text-brand-accent">
                  {pounds(c.amount_pence)}
                </td>
                <td className="px-2 py-1">{c.status}</td>
                <td className="px-2 py-1 text-brand-muted">{fmt(c.created_at)}</td>
                <td className="px-2 py-1 text-brand-muted">
                  {fmt(c.approved_at)}
                </td>
                <td className="px-2 py-1 text-brand-muted">{fmt(c.paid_at)}</td>
              </tr>
            ))}
            {!commissions?.length && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-brand-muted">
                  No commissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Social links">
        <table className="min-w-full text-[13px]">
          <thead className="text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-2 py-1">Platform</th>
              <th className="px-2 py-1">URL</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Last checked</th>
            </tr>
          </thead>
          <tbody>
            {(socialLinks ?? []).map((s) => {
              const badge =
                s.status === "active"
                  ? "bg-green-900/40 text-green-400"
                  : s.status === "removed"
                    ? "bg-red-900/40 text-red-400"
                    : "bg-yellow-900/40 text-yellow-400";
              return (
                <tr key={s.id} className="border-t border-brand-line">
                  <td className="px-2 py-1 capitalize">{s.platform}</td>
                  <td className="px-2 py-1">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-brand-accent hover:underline break-all"
                    >
                      {s.url}
                    </a>
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={`rounded px-2 py-0.5 text-[13px] font-bold ${badge}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-brand-muted">
                    {fmt(s.last_checked_at)}
                  </td>
                </tr>
              );
            })}
            {!socialLinks?.length && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-brand-muted">
                  No social links logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Audit log">
        <ul className="space-y-2 text-[13px]">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="border-b border-brand-line pb-1">
              <span className="text-brand-muted">{fmt(l.created_at)}</span>{" "}
              <span className="font-bold">{l.actor_type}</span>{" "}
              <span className="text-brand-accent">{l.action}</span>{" "}
              {l.target_id && (
                <span className="text-brand-muted">→ {l.target_id}</span>
              )}
            </li>
          ))}
          {!logs?.length && (
            <li className="text-brand-muted">No audit entries yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function Card({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brand-line bg-brand-surface p-5">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-brand-muted">{k}</dt>
      <dd className="text-right text-brand-text">{v}</dd>
    </div>
  );
}
