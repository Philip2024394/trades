// /tc/identity — the trade user's Verified Trade Identity dashboard.
//
// This is where a plasterer / builder / electrician manages the 8 layers
// of their Trade Center identity. Each layer routes to a partner or
// public register to be verified (Trade Center is the pipe).
//
// From here they:
//   - See which layers are verified / pending / expired
//   - Renew expiring layers (partner links)
//   - See what merchants + customers see when they submit their identity
//   - One-click "Open Trade Account" application launch to any merchant

import Link from "next/link";
import { ArrowRight, PlusCircle, RefreshCcw, Share2, PoundSterling } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { VerifiedTradeIdentityPanel } from "@/apps/identity/components/VerifiedTradeIdentityPanel";
import { VerifiedTradeIdentityBadge } from "@/apps/identity/components/VerifiedTradeIdentityBadge";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";
import { MERCHANT_FIXTURES } from "@/apps/tradecenter/data/merchants";

export const dynamic = "force-dynamic";

export default function TradeIdentityDashboardPage() {
  const trade = currentViewerTrade();
  const expiredCount = Object.values(trade.layers).filter((l) => l.status === "expired").length;
  const pendingCount = Object.values(trade.layers).filter((l) => l.status === "pending").length;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-2 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Trade Center · R07
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              Your Verified Trade Identity
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
              One credential. Every merchant. Every customer. Verify once, use everywhere.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <VerifiedTradeIdentityBadge trade={trade}/>
            <Link
              href={`/tc/trade/${trade.slug}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <Share2 size={13}/>
              View public profile
            </Link>
          </div>
        </header>

        {/* Alerts */}
        {(expiredCount > 0 || pendingCount > 0) && (
          <section className="mb-5 grid gap-3 md:grid-cols-2">
            {expiredCount > 0 && (
              <AlertCard
                tone="warn"
                title={`${expiredCount} credential${expiredCount === 1 ? "" : "s"} expired`}
                body="Renew now to keep your Verified Trade status current."
                ctaLabel="Renew"
              />
            )}
            {pendingCount > 0 && (
              <AlertCard
                tone="info"
                title={`${pendingCount} credential${pendingCount === 1 ? "" : "s"} pending`}
                body="Complete verification with the linked partner."
                ctaLabel="Complete"
              />
            )}
          </section>
        )}

        {/* Two columns: identity panel on left, actions on right */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <VerifiedTradeIdentityPanel trade={trade}/>

          <div className="flex flex-col gap-4">
            {/* Open Trade Account launcher */}
            <section
              className="rounded-xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Open Trade Account
              </div>
              <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                Apply to any merchant on Trade Center with one click. Your Verified Trade
                Identity autofills the whole form — no re-keying trade references, insurance
                certs, or Companies House details.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {MERCHANT_FIXTURES.slice(0, 4).map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={`/tc/apply/${m.slug}`}
                      className="flex min-h-[44px] items-center justify-between gap-2 rounded-md border px-3 text-[12px] font-bold text-neutral-800 transition hover:bg-neutral-50"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    >
                      <span className="min-w-0 truncate">{m.displayName}</span>
                      <ArrowRight size={13} className="flex-shrink-0 text-neutral-500"/>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Add credential */}
            <section
              className="rounded-xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Add a Credential
              </div>
              <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                Link a new qualification, insurance policy or trade body. Verification runs
                with the issuer — Trade Center never certifies it.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: "#166534" }}
              >
                <PlusCircle size={14}/>
                Add Credential
              </button>
            </section>

            {/* Rate card CTA */}
            <section
              className="rounded-xl border p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFDF8" }}
            >
              <div className="flex items-center gap-1.5">
                <PoundSterling size={12} className="text-amber-700"/>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
                  Rate Card
                </div>
              </div>
              <div className="mt-1 text-[12px] font-black leading-tight text-neutral-900">
                Publish your labour rates
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                Customers self-qualify before calling. See where your rates sit vs peers in your
                region — anonymised, aggregated, no advice.
              </p>
              <Link
                href="/tc/rates"
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: "#166534" }}
              >
                <PoundSterling size={13}/>
                Manage your rate card
              </Link>
            </section>

            {/* Renewal reminder */}
            <section
              className="rounded-xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Auto-Renewal Reminders
              </div>
              <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                Trade Center will remind you 60 / 30 / 7 days before any credential expires so
                you never quote uninsured.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border bg-white px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <RefreshCcw size={13}/>
                Manage Reminders
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function AlertCard({
  tone,
  title,
  body,
  ctaLabel
}: {
  tone: "warn" | "info";
  title: string;
  body: string;
  ctaLabel: string;
}) {
  const bg = tone === "warn" ? "#FEF3C7" : "#DBEAFE";
  const border = tone === "warn" ? "#F59E0B" : "#2563EB";
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border-l-4 p-3"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="min-w-0">
        <div className="text-[12px] font-black text-neutral-900">{title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-neutral-700">{body}</div>
      </div>
      <button
        type="button"
        className="flex-shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
