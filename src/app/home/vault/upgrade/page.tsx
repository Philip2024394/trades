// /home/vault/upgrade — Property Vault plan picker.
//
// Reads active plans from os_homeowner_plans, groups by type, and
// renders the plan comparison. Each CTA calls /api/os/vault/checkout
// which returns a Stripe hosted checkout URL for redirect.

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Video, KeyRound, Sparkles } from "lucide-react";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadVaultEntitlements } from "@/lib/os/vault/entitlements";
import {
  SurfaceCard,
  PageHeader,
  SectionHeader,
  Grid,
  Badge
} from "@/platform/ui";
import { CheckoutButton } from "./CheckoutButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Upgrade Property Vault — The Network",
  robots: { index: false, follow: false }
};

type PlanRow = {
  plan_key: string;
  plan_type: "base" | "addon" | "lifetime" | "trial";
  headline: string;
  description: string;
  monthly_price_pence: number | null;
  annual_price_pence: number | null;
  one_off_price_pence: number | null;
  currency: string;
  entitlements: Record<string, unknown>;
  display_order: number;
  featured: boolean;
};

function poundsFromPence(pence: number): string {
  const pounds = pence / 100;
  if (pounds % 1 === 0) return `£${pounds.toLocaleString("en-GB")}`;
  return `£${pounds.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024 * 1024) return `${bytes / 1024 ** 4} TB`;
  if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 ** 3)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${bytes} B`;
}

function planIcon(planType: string) {
  if (planType === "lifetime") return KeyRound;
  if (planType === "addon") return Video;
  if (planType === "trial") return Sparkles;
  return ShieldCheck;
}

function bullets(entitlements: Record<string, unknown>): string[] {
  const out: string[] = [];
  const storageBytes = entitlements.storage_bytes as number | undefined;
  const addonBytes = entitlements.addon_storage_bytes as number | undefined;
  const videoEnabled = entitlements.video_enabled as boolean | undefined;
  const bundleEnabled = entitlements.bundle_export_enabled as boolean | undefined;
  const shareMax = entitlements.share_grants_max as number | undefined;
  const passportTransferable = entitlements.passport_transferable as
    | boolean
    | undefined;
  const retentionYears = entitlements.retention_years as number | undefined;
  const trialDays = entitlements.trial_days as number | undefined;

  if (typeof storageBytes === "number")
    out.push(`${formatStorage(storageBytes)} document storage`);
  if (typeof addonBytes === "number")
    out.push(`${formatStorage(addonBytes)} video storage`);
  if (videoEnabled) out.push("Video capture + sharing");
  if (bundleEnabled) out.push("End-of-project ZIP download");
  if (typeof shareMax === "number") out.push(`${shareMax} share grants`);
  if (passportTransferable) out.push("Passes to next owner at sale");
  if (typeof retentionYears === "number")
    out.push(`${retentionYears} year${retentionYears === 1 ? "" : "s"} retention`);
  if (typeof trialDays === "number") out.push(`${trialDays}-day free trial`);
  return out;
}

export default async function UpgradePage() {
  const party = await loadHomeownerSession();
  if (!party) {
    redirect("/home/sign-in?next=/home/vault/upgrade");
  }

  const [{ data: plans }, entitlements] = await Promise.all([
    supabaseAdmin
      .from("os_homeowner_plans")
      .select(
        "plan_key, plan_type, headline, description, monthly_price_pence, annual_price_pence, one_off_price_pence, currency, entitlements, display_order, featured"
      )
      .eq("active", true)
      .order("display_order", { ascending: true }),
    loadVaultEntitlements(party.id)
  ]);
  const rows = (plans ?? []) as PlanRow[];

  const base = rows.filter((p) => p.plan_type === "base");
  const lifetime = rows.filter((p) => p.plan_type === "lifetime");
  const addon = rows.filter((p) => p.plan_type === "addon");
  const trial = rows.filter((p) => p.plan_type === "trial");

  const hasBase = entitlements.activePlanKeys.some((k) =>
    base.some((b) => b.plan_key === k)
  );

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4">
        <Link
          href="/home/vault"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Vault
        </Link>
      </div>

      <PageHeader
        overline="Property Vault"
        title="Choose your plan"
        subtitle="Keep every quote, receipt, warranty and photo safe — and downloadable when a project completes."
      />

      {trial.length > 0 && !entitlements.vaultActive ? (
        <section className="mb-6">
          <SectionHeader title="Try it first" />
          {trial.map((p) => (
            <PlanCard
              key={p.plan_key}
              plan={p}
              interval="monthly"
              disabled={false}
            />
          ))}
        </section>
      ) : null}

      {base.length > 0 ? (
        <section className="mb-6">
          <SectionHeader title="Vault plans" />
          <Grid density="cards">
            {base.map((p) => (
              <PlanCard
                key={p.plan_key}
                plan={p}
                interval="monthly"
                disabled={
                  entitlements.vaultActive &&
                  entitlements.activePlanKeys.includes(p.plan_key)
                }
              />
            ))}
          </Grid>
        </section>
      ) : null}

      {lifetime.length > 0 ? (
        <section className="mb-6">
          <SectionHeader
            title="Own it forever"
            trailing={
              <Badge tone="emerald">Best long-term value</Badge>
            }
          />
          {lifetime.map((p) => (
            <PlanCard
              key={p.plan_key}
              plan={p}
              interval="one_off"
              disabled={entitlements.activePlanKeys.includes(p.plan_key)}
            />
          ))}
        </section>
      ) : null}

      {addon.length > 0 ? (
        <section className="mb-6">
          <SectionHeader
            title="Video storage add-ons"
            subtitle={
              hasBase
                ? undefined
                : "Requires an active Vault plan first."
            }
          />
          <Grid density="cards">
            {addon.map((p) => (
              <PlanCard
                key={p.plan_key}
                plan={p}
                interval="monthly"
                disabled={
                  !hasBase ||
                  entitlements.activePlanKeys.includes(p.plan_key)
                }
              />
            ))}
          </Grid>
        </section>
      ) : null}

      <section>
        <SurfaceCard variant="primary" padding="md">
          <div className="text-[13px] leading-relaxed text-neutral-700">
            <p>
              Every plan can be cancelled at any time. Prices in GBP. When
              you subscribe to an annual plan we save the price at time of
              purchase — future price rises don't affect your renewal.
            </p>
            <p className="mt-2">
              Payments are handled by Stripe. XRatedTrade never sees or
              stores your card details.
            </p>
          </div>
        </SurfaceCard>
      </section>
    </main>
  );
}

function PlanCard({
  plan,
  interval,
  disabled
}: {
  plan: PlanRow;
  interval: "monthly" | "annual" | "one_off";
  disabled: boolean;
}) {
  const Icon = planIcon(plan.plan_type);
  const priceLabel =
    interval === "annual" && plan.annual_price_pence
      ? `${poundsFromPence(plan.annual_price_pence)} / year`
      : interval === "one_off" && plan.one_off_price_pence
        ? `${poundsFromPence(plan.one_off_price_pence)} one-off`
        : plan.monthly_price_pence
          ? plan.monthly_price_pence === 0
            ? "Free"
            : `${poundsFromPence(plan.monthly_price_pence)} / month`
          : "Price TBC";

  return (
    <SurfaceCard variant={plan.featured ? "highlight" : "primary"} padding="md">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100"
          aria-hidden
        >
          <Icon className="h-5 w-5 text-amber-800" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-bold text-neutral-900">
              {plan.headline}
            </h3>
            <div className="text-[14px] font-bold text-neutral-900">
              {priceLabel}
            </div>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-neutral-700">
            {plan.description}
          </p>
          {bullets(plan.entitlements).length > 0 ? (
            <ul className="mt-3 space-y-1 text-[13px] text-neutral-700">
              {bullets(plan.entitlements).map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    aria-hidden
                  />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4">
            <CheckoutButton
              planKey={plan.plan_key}
              interval={interval}
              disabled={disabled}
              label={
                disabled
                  ? "Active on your account"
                  : plan.plan_type === "trial"
                    ? "Start free trial"
                    : plan.plan_type === "lifetime"
                      ? "Buy lifetime"
                      : plan.plan_type === "addon"
                        ? "Add to Vault"
                        : "Choose plan"
              }
            />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
