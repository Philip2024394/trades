// Trade Account Application form — the "Open Account" flow.
//
// Constitution Rule #6 in action: Trade Center hosts the form and
// autofills from the applicant's Verified Trade Identity. The MERCHANT
// (not Trade Center) reviews the application and grants the credit
// limit. Trade Center is Typeform + LinkedIn's "Easy Apply", not a
// bureau.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send, ShieldCheck, Info } from "lucide-react";
import type { MarketplaceMerchant } from "@/apps/marketplace/data/merchants";
import type { VerifiedTradeIdentity } from "../data/tradeIdentities";

type Props = {
  merchant: MarketplaceMerchant;
  trade: VerifiedTradeIdentity;
};

type FormState = {
  requestedLimit: string;
  paymentTerms: "30" | "60" | "cash";
  monthlyEstimatedSpend: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  tradeReferenceOneName: string;
  tradeReferenceOneEmail: string;
  tradeReferenceTwoName: string;
  tradeReferenceTwoEmail: string;
  personalGuaranteeConsent: boolean;
  identitySharingConsent: boolean;
};

export function TradeAccountApplicationForm({ merchant, trade }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    requestedLimit: "1000",
    paymentTerms: "30",
    monthlyEstimatedSpend: "2000",
    primaryContactName: trade.displayName,
    primaryContactEmail: `${trade.slug}@example.co.uk`,
    primaryContactPhone: "",
    tradeReferenceOneName: "",
    tradeReferenceOneEmail: "",
    tradeReferenceTwoName: "",
    tradeReferenceTwoEmail: "",
    personalGuaranteeConsent: false,
    identitySharingConsent: false
  });

  const canSubmit = useMemo(
    () =>
      form.personalGuaranteeConsent &&
      form.identitySharingConsent &&
      form.primaryContactName.trim() !== "" &&
      form.primaryContactEmail.trim() !== "" &&
      form.tradeReferenceOneEmail.trim() !== "",
    [form]
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  if (submitted) {
    return (
      <div
        className="rounded-xl border bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#166534" }}>
          <CheckCircle2 size={28} strokeWidth={2.5} className="text-white"/>
        </div>
        <h2 className="mt-4 text-[18px] font-black text-neutral-900">
          Application submitted to {merchant.displayName}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-neutral-600">
          Your Verified Trade Identity + application details have been sent. The merchant
          typically reviews trade account applications within 2 working days and will
          contact you at <span className="font-bold text-neutral-800">{form.primaryContactEmail}</span>.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/tc/identity"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Back to Identity
          </Link>
          <Link
            href="/tc/trade-center/plastering"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="rounded-xl border bg-white p-4 shadow-sm md:p-6"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) setSubmitted(true);
      }}
    >
      {/* Verified Trade Identity autofill notice */}
      <div
        className="mb-5 flex items-start gap-2 rounded-md p-3"
        style={{ backgroundColor: "#F0FDF4" }}
      >
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-[#166534]"/>
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-[#166534]">
            Autofilled from Verified Trade Identity
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-700">
            {trade.legalName} · {trade.companiesHouseNumber ? `Co. No. ${trade.companiesHouseNumber} · ` : ""}{trade.vatNumber ? `VAT ${trade.vatNumber} · ` : ""}
            {trade.yearsTrading} yrs trading. {merchant.displayName} sees your full identity panel
            when they review your application — no re-keying.
          </p>
        </div>
      </div>

      {/* Credit request */}
      <fieldset className="mb-5">
        <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Credit Request
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Requested Credit Limit (£)">
            <input
              type="number"
              min={0}
              step={100}
              value={form.requestedLimit}
              onChange={(e) => set("requestedLimit", e.target.value)}
              className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            />
          </Field>
          <Field label="Preferred Payment Terms">
            <select
              value={form.paymentTerms}
              onChange={(e) => set("paymentTerms", e.target.value as FormState["paymentTerms"])}
              className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <option value="30">30-day account</option>
              <option value="60">60-day account</option>
              <option value="cash">Cash on collection</option>
            </select>
          </Field>
          <Field label="Estimated Monthly Spend (£)" hint="Helps the merchant size your limit.">
            <input
              type="number"
              min={0}
              step={100}
              value={form.monthlyEstimatedSpend}
              onChange={(e) => set("monthlyEstimatedSpend", e.target.value)}
              className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            />
          </Field>
        </div>
      </fieldset>

      {/* Primary contact */}
      <fieldset className="mb-5">
        <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Primary Contact
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full Name">
            <input
              type="text"
              value={form.primaryContactName}
              onChange={(e) => set("primaryContactName", e.target.value)}
              className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.primaryContactEmail}
              onChange={(e) => set("primaryContactEmail", e.target.value)}
              className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={form.primaryContactPhone}
              onChange={(e) => set("primaryContactPhone", e.target.value)}
              className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              placeholder="07..."
            />
          </Field>
        </div>
      </fieldset>

      {/* Trade references */}
      <fieldset className="mb-5">
        <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Trade References (nominate 2 previous merchants)
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          <ReferenceRow index={1} nameKey="tradeReferenceOneName" emailKey="tradeReferenceOneEmail" form={form} set={set}/>
          <ReferenceRow index={2} nameKey="tradeReferenceTwoName" emailKey="tradeReferenceTwoEmail" form={form} set={set}/>
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-neutral-500">
          The nominated merchants receive a Trade Center request for a Y/N reply — Trade Center
          never publishes their reply anywhere. Only {merchant.displayName} sees it as part
          of your application.
        </p>
      </fieldset>

      {/* Consents */}
      <fieldset className="mb-5">
        <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Consents Required
        </legend>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-md border bg-neutral-50 p-3" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <input
              type="checkbox"
              checked={form.identitySharingConsent}
              onChange={(e) => set("identitySharingConsent", e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0"
            />
            <span className="text-[11.5px] leading-snug text-neutral-700">
              I authorise Trade Center to share my Verified Trade Identity ({trade.compositeCompleteness}/100
              completeness) with <span className="font-bold">{merchant.displayName}</span> for the
              sole purpose of reviewing this trade account application. UK GDPR Art 6(1)(a).
            </span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-md border bg-neutral-50 p-3" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <input
              type="checkbox"
              checked={form.personalGuaranteeConsent}
              onChange={(e) => set("personalGuaranteeConsent", e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0"
            />
            <span className="text-[11.5px] leading-snug text-neutral-700">
              I understand this application is subject to {merchant.displayName}'s standard
              credit terms and I may be asked to sign a personal guarantee before the account
              is opened. Trade Center is not the lender.
            </span>
          </label>
        </div>
      </fieldset>

      {/* Legal footer */}
      <div className="mb-4 flex items-start gap-2 rounded-md bg-neutral-50 p-3">
        <Info size={14} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
        <p className="text-[10.5px] leading-snug text-neutral-500">
          Trade Center is not a credit reference agency, lender, or credit broker. This form
          is submitted directly to {merchant.displayName} who reviews and decides whether to
          open your account under their standard credit terms.
        </p>
      </div>

      {/* Submit */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={`/tc/trade-center/merchant/${merchant.slug}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
          style={{ backgroundColor: "#166534" }}
        >
          <Send size={13}/>
          Submit Application
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10px] leading-snug text-neutral-500">{hint}</span>}
    </label>
  );
}

function ReferenceRow({
  index,
  nameKey,
  emailKey,
  form,
  set
}: {
  index: number;
  nameKey: "tradeReferenceOneName" | "tradeReferenceTwoName";
  emailKey: "tradeReferenceOneEmail" | "tradeReferenceTwoEmail";
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-neutral-50 p-3" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
        Reference #{index}
      </div>
      <input
        type="text"
        placeholder="Merchant name"
        value={form[nameKey]}
        onChange={(e) => set(nameKey, e.target.value)}
        className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      />
      <input
        type="email"
        placeholder="Merchant contact email"
        value={form[emailKey]}
        onChange={(e) => set(emailKey, e.target.value)}
        className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      />
    </div>
  );
}
