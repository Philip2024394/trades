// Merchant-facing dashboard for the AI Visualiser app.
//
// Three sections:
//   1. Credit gauge + plan card
//   2. Catalogue-scope picker (which leaves this merchant sells)
//   3. Recent leads (contact details + design counts)

"use client";

import { useMemo, useState } from "react";
import {
  Sparkles,
  MessageCircle,
  Mail,
  ChevronRight,
  Check,
  Loader2
} from "lucide-react";
import { AI_VISUALISER_APP_MANIFEST } from "@/apps/ai-visualiser/manifest";

type Credits = {
  tier: string;
  monthly_quota: number;
  renders_used_this_period: number;
  overage_pence: number;
  overage_rate_pence: number;
  period_ends_at: string | null;
  is_active: boolean;
};

type ScopeRow = {
  leaf_slug: string;
  product_count: number;
  is_enabled: boolean;
};

type Leaf = {
  slug: string;
  trade_slug: string;
  display_name: string;
};

type Lead = {
  id: string;
  homeowner_id: string;
  status: string;
  render_count: number;
  created_at: string;
  last_render_at: string | null;
  full_name: string;
  email: string;
  whatsapp_e164: string;
  postcode: string;
};

export function AiVisualiserMerchantPanel({
  merchantId,
  primaryTrade,
  credits,
  scope,
  leaves,
  leads
}: {
  merchantId: string;
  primaryTrade: string | null;
  credits: Credits;
  scope: ScopeRow[];
  leaves: Leaf[];
  leads: Lead[];
}) {
  const enabledSlugs = new Set(
    scope.filter((s) => s.is_enabled).map((s) => s.leaf_slug)
  );
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [localScope, setLocalScope] = useState<Set<string>>(enabledSlugs);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  async function toggleScope(slug: string) {
    setBusySlug(slug);
    const next = new Set(localScope);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setLocalScope(next);
    try {
      await fetch("/api/apps/ai-visualiser/scope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantId,
          leafSlug: slug,
          enabled: next.has(slug)
        })
      });
    } catch {
      // Revert on failure
      setLocalScope(localScope);
    } finally {
      setBusySlug(null);
    }
  }

  async function pickPlan(planKey: string) {
    setBusyPlan(planKey);
    try {
      await fetch("/api/apps/ai-visualiser/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId, planKey })
      });
      window.location.reload();
    } finally {
      setBusyPlan(null);
    }
  }

  const quotaUsedPct = Math.min(
    100,
    Math.round((credits.renders_used_this_period / (credits.monthly_quota || 1)) * 100)
  );
  const overageBadge =
    credits.overage_pence > 0
      ? `£${(credits.overage_pence / 100).toFixed(2)} overage`
      : null;

  // Group leaves by trade for the picker
  const leavesByTrade = useMemo(() => {
    const groups = new Map<string, Leaf[]>();
    for (const l of leaves) {
      if (!groups.has(l.trade_slug)) groups.set(l.trade_slug, []);
      groups.get(l.trade_slug)!.push(l);
    }
    return Array.from(groups.entries());
  }, [leaves]);

  // Sort so the merchant's own trade appears first
  leavesByTrade.sort((a, b) => {
    if (a[0] === primaryTrade) return -1;
    if (b[0] === primaryTrade) return 1;
    return a[0].localeCompare(b[0]);
  });

  return (
    <div className="flex flex-col gap-8">
      {/* CREDITS */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
              Your plan
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold capitalize">
                {credits.tier}
              </span>
              {credits.is_active ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[13px] font-semibold text-emerald-800">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[13px] font-semibold text-neutral-700">
                  Not active
                </span>
              )}
              {overageBadge ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[13px] font-semibold text-amber-800">
                  {overageBadge}
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right text-[13px] text-neutral-600">
            <div>
              {credits.renders_used_this_period} / {credits.monthly_quota}{" "}
              renders used
            </div>
            {credits.period_ends_at ? (
              <div>
                Resets{" "}
                {new Date(credits.period_ends_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short"
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${
              quotaUsedPct < 80 ? "bg-emerald-500" : "bg-amber-500"
            }`}
            style={{ width: `${quotaUsedPct}%` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          {AI_VISUALISER_APP_MANIFEST.plans.map((p) => {
            const active = p.key === credits.tier;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPlan(p.key)}
                disabled={busyPlan === p.key}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-[13px] font-semibold uppercase">
                    {p.label}
                  </span>
                  {active ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : busyPlan === p.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                </div>
                <div className="text-lg font-bold">
                  {p.pricePence === 0
                    ? "Free"
                    : `£${(p.pricePence / 100).toFixed(0)}/mo`}
                </div>
                <div className="text-[13px] opacity-80">
                  {p.monthlyQuota} renders / mo
                </div>
                <div className="text-[13px] opacity-70">
                  {p.overageRatePence > 0
                    ? `£${(p.overageRatePence / 100).toFixed(2)} / extra render`
                    : "no overage"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* SCOPE PICKER */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
              What you sell
            </div>
            <h2 className="mt-1 text-xl font-semibold">
              Only these categories can be visualised on your page.
            </h2>
            <p className="mt-1 text-[13px] text-neutral-600">
              A customer who uploads a photo of something you don't tick
              will be told this app doesn't fit — protecting your
              credits and stopping leads leaking to a competitor.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {leavesByTrade.map(([trade, list]) => (
            <div key={trade}>
              <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                {trade.replace(/-/g, " ")}
                {trade === primaryTrade ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[13px] font-semibold text-amber-800">
                    Your trade
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {list.map((leaf) => {
                  const active = localScope.has(leaf.slug);
                  return (
                    <button
                      key={leaf.slug}
                      type="button"
                      onClick={() => toggleScope(leaf.slug)}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition ${
                        active
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                      }`}
                      disabled={busySlug === leaf.slug}
                    >
                      {busySlug === leaf.slug ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : active ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 opacity-60" aria-hidden />
                      )}
                      {leaf.display_name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LEADS */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
              Inbox
            </div>
            <h2 className="mt-1 text-xl font-semibold">Recent leads</h2>
          </div>
          <span className="text-[13px] text-neutral-500">{leads.length}</span>
        </div>

        {leads.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-[13px] text-neutral-500">
            No leads yet. When homeowners try your Visualiser, their
            contact + designs will appear here.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100">
            {leads.map((lead) => {
              const waDigits = lead.whatsapp_e164.replace(/\D/g, "");
              return (
                <li
                  key={lead.id}
                  className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="text-[15px] font-semibold text-neutral-900">
                      {lead.full_name}{" "}
                      <span className="text-[13px] font-normal text-neutral-500">
                        {lead.postcode}
                      </span>
                    </div>
                    <div className="text-[13px] text-neutral-600">
                      {lead.render_count} render
                      {lead.render_count === 1 ? "" : "s"} ·{" "}
                      {new Date(lead.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`mailto:${lead.email}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden /> Email
                    </a>
                    {waDigits ? (
                      <a
                        href={`https://wa.me/${waDigits}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-500"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
                      </a>
                    ) : null}
                    <a
                      href={`/site-office/apps/ai-visualiser/leads/${lead.homeowner_id}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
                    >
                      Open <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
