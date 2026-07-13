"use client";

import { useMemo, useState } from "react";

type Initial = {
  trading_status?: string | null;
  legal_name?: string | null;
  country_iso2?: string | null;
  payment_method?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_sort_code?: string | null;
  iban?: string | null;
  swift_bic?: string | null;
  paypal_email?: string | null;
  wise_email?: string | null;
} | null;

// The three agreement texts are stored here verbatim. They render
// inside <details> blocks so the user expands and reads in full before
// ticking the box. NEVER paraphrase — these are real commitments.
const TAX_AGREEMENT = `You are not employed by thenetworkers.app. You operate as an independent affiliate. thenetworkers.app reserves the right to request additional information for tax or regulatory reporting as required by your country of residence. Before joining, please research your obligations regarding online income, self-employment, and any laws in your country that apply. thenetworkers.app is not liable for tax, government fees, or penalties arising from your participation in this programme.`;

const CONTENT_AGREEMENT = `Posting your affiliate links on any platform or in any content involving children, minors, or sexual material is strictly prohibited. Violations result in immediate ban from the affiliate programme. All pending and approved funds will be frozen. No exceptions.`;

const TIMING_AGREEMENT = `Approved commissions are paid 30 days after reaching Approved status, subject to the £50 minimum payout. Standard banking transaction fees (sender, receiver, intermediary) are deducted from the payout. thenetworkers.app is not responsible for fees charged by your bank, PayPal, Wise, or any intermediary.`;

export function PaymentDetailsForm({
  countries,
  initial,
  agreements,
  completedAt
}: {
  countries: string[];
  initial: Initial;
  agreements: { tax: boolean; content: boolean; timing: boolean };
  completedAt: string | null;
}) {
  const [tradingStatus, setTradingStatus] = useState<string>(
    initial?.trading_status ?? ""
  );
  const [legalName, setLegalName] = useState<string>(initial?.legal_name ?? "");
  const [country, setCountry] = useState<string>(
    initial?.country_iso2 ?? "United Kingdom"
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initial?.payment_method ?? "bank"
  );
  const [bankInternational, setBankInternational] = useState<boolean>(
    Boolean(initial?.iban)
  );
  const [bankName, setBankName] = useState<string>(
    initial?.bank_account_name ?? ""
  );
  const [bankNumber, setBankNumber] = useState<string>(
    initial?.bank_account_number ?? ""
  );
  const [bankSort, setBankSort] = useState<string>(initial?.bank_sort_code ?? "");
  const [iban, setIban] = useState<string>(initial?.iban ?? "");
  const [swift, setSwift] = useState<string>(initial?.swift_bic ?? "");
  const [paypal, setPaypal] = useState<string>(initial?.paypal_email ?? "");
  const [wise, setWise] = useState<string>(initial?.wise_email ?? "");

  const [tax, setTax] = useState(agreements.tax);
  const [content, setContent] = useState(agreements.content);
  const [timing, setTiming] = useState(agreements.timing);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(completedAt);

  const canSubmit = useMemo(() => {
    if (!tradingStatus || !legalName.trim() || !country || !paymentMethod) {
      return false;
    }
    if (paymentMethod === "bank") {
      if (!bankName.trim()) return false;
      if (bankInternational) {
        if (!iban.trim() || !swift.trim()) return false;
      } else {
        if (!bankNumber.trim() || !bankSort.trim()) return false;
      }
    } else if (paymentMethod === "paypal") {
      if (!paypal.trim()) return false;
    } else if (paymentMethod === "wise") {
      if (!wise.trim()) return false;
    }
    if (!tax || !content || !timing) return false;
    return true;
  }, [
    tradingStatus,
    legalName,
    country,
    paymentMethod,
    bankInternational,
    bankName,
    bankNumber,
    bankSort,
    iban,
    swift,
    paypal,
    wise,
    tax,
    content,
    timing
  ]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates/payment-details", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trading_status: tradingStatus,
          legal_name: legalName.trim(),
          country_iso2: country,
          payment_method: paymentMethod,
          bank_account_name: bankName.trim() || null,
          bank_account_number: bankInternational ? null : bankNumber.trim() || null,
          bank_sort_code: bankInternational ? null : bankSort.trim() || null,
          iban: bankInternational ? iban.trim() || null : null,
          swift_bic: bankInternational ? swift.trim() || null : null,
          paypal_email: paypal.trim() || null,
          wise_email: wise.trim() || null,
          tax_agreement: tax,
          content_agreement: content,
          timing_agreement: timing
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        completed_at?: string;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Could not save payment details.");
        return;
      }
      setSaved(body.completed_at ?? new Date().toISOString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {saved && (
        <div className="rounded-xl border border-green-700 bg-green-900/30 p-4 text-[13px] text-green-300">
          Payment details saved on {new Date(saved).toLocaleDateString("en-GB")}.
          You can update any field below at any time.
        </div>
      )}

      {/* Section A — Trading status */}
      <fieldset className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <legend className="px-2 text-[13px] font-extrabold uppercase tracking-wider text-brand-accent">
          A · Trading status
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { value: "sole_trader", label: "Sole trader" },
            { value: "limited_company", label: "Limited company" },
            { value: "partnership", label: "Partnership" }
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${
                tradingStatus === opt.value
                  ? "border-brand-accent bg-brand-accent/10"
                  : "border-brand-line bg-brand-bg"
              }`}
            >
              <input
                type="radio"
                name="trading_status"
                value={opt.value}
                checked={tradingStatus === opt.value}
                onChange={() => setTradingStatus(opt.value)}
                className="accent-brand-accent"
              />
              <span className="text-[13px] font-bold text-brand-text">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Section B — Legal name */}
      <fieldset className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <legend className="px-2 text-[13px] font-extrabold uppercase tracking-wider text-brand-accent">
          B · Legal name
        </legend>
        <label className="mt-2 block">
          <span className="text-[13px] font-bold text-brand-text">
            Name as it appears on your payment account
          </span>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
          />
        </label>
      </fieldset>

      {/* Section C — Country */}
      <fieldset className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <legend className="px-2 text-[13px] font-extrabold uppercase tracking-wider text-brand-accent">
          C · Country
        </legend>
        <label className="mt-2 block">
          <span className="text-[13px] font-bold text-brand-text">
            Country of residence
          </span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
          >
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {/* Section D — Payment method */}
      <fieldset className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <legend className="px-2 text-[13px] font-extrabold uppercase tracking-wider text-brand-accent">
          D · Payment method
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { value: "bank", label: "Bank transfer" },
            { value: "paypal", label: "PayPal" },
            { value: "wise", label: "Wise (TransferWise)" }
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${
                paymentMethod === opt.value
                  ? "border-brand-accent bg-brand-accent/10"
                  : "border-brand-line bg-brand-bg"
              }`}
            >
              <input
                type="radio"
                name="payment_method"
                value={opt.value}
                checked={paymentMethod === opt.value}
                onChange={() => setPaymentMethod(opt.value)}
                className="accent-brand-accent"
              />
              <span className="text-[13px] font-bold text-brand-text">
                {opt.label}
              </span>
            </label>
          ))}
        </div>

        {paymentMethod === "bank" && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[13px] font-bold text-brand-text">
                Account holder name
              </span>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBankInternational(false)}
                className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
                  !bankInternational
                    ? "bg-brand-accent text-black"
                    : "border border-brand-line bg-brand-bg text-brand-text"
                }`}
              >
                UK (sort code + account)
              </button>
              <button
                type="button"
                onClick={() => setBankInternational(true)}
                className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
                  bankInternational
                    ? "bg-brand-accent text-black"
                    : "border border-brand-line bg-brand-bg text-brand-text"
                }`}
              >
                International (IBAN + SWIFT)
              </button>
            </div>
            {!bankInternational ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-bold text-brand-text">
                    Sort code
                  </span>
                  <input
                    type="text"
                    value={bankSort}
                    onChange={(e) => setBankSort(e.target.value)}
                    placeholder="00-00-00"
                    className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-brand-text">
                    Account number
                  </span>
                  <input
                    type="text"
                    value={bankNumber}
                    onChange={(e) => setBankNumber(e.target.value)}
                    placeholder="12345678"
                    className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-bold text-brand-text">
                    IBAN
                  </span>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-brand-text">
                    SWIFT / BIC
                  </span>
                  <input
                    type="text"
                    value={swift}
                    onChange={(e) => setSwift(e.target.value)}
                    className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
                  />
                </label>
              </div>
            )}
          </div>
        )}
        {paymentMethod === "paypal" && (
          <label className="mt-4 block">
            <span className="text-[13px] font-bold text-brand-text">
              PayPal email
            </span>
            <input
              type="email"
              value={paypal}
              onChange={(e) => setPaypal(e.target.value)}
              className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            />
          </label>
        )}
        {paymentMethod === "wise" && (
          <label className="mt-4 block">
            <span className="text-[13px] font-bold text-brand-text">
              Wise email
            </span>
            <input
              type="email"
              value={wise}
              onChange={(e) => setWise(e.target.value)}
              className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            />
          </label>
        )}
      </fieldset>

      {/* Section E — Agreements (verbatim copy required) */}
      <fieldset className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <legend className="px-2 text-[13px] font-extrabold uppercase tracking-wider text-brand-accent">
          E · Agreements (all three required)
        </legend>
        <div className="mt-2 space-y-4">
          <AgreementRow
            checked={tax}
            onChange={setTax}
            label="I have read and accept the Tax & Independence terms"
            body={TAX_AGREEMENT}
          />
          <AgreementRow
            checked={content}
            onChange={setContent}
            label="I accept the Content Compliance rules"
            body={CONTENT_AGREEMENT}
          />
          <AgreementRow
            checked={timing}
            onChange={setTiming}
            label="I accept the Payment Timing & Fees"
            body={TIMING_AGREEMENT}
          />
        </div>
      </fieldset>

      {err && <p className="text-[13px] font-semibold text-red-500">{err}</p>}
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-accent px-6 text-[13px] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save payment details"}
      </button>
      {!canSubmit && (
        <p className="text-[13px] text-brand-muted">
          The Save button stays disabled until every required field above
          is filled and all three agreements are ticked.
        </p>
      )}
    </form>
  );
}

function AgreementRow({
  checked,
  onChange,
  label,
  body
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 accent-brand-accent"
        />
        <span className="text-[13px] font-bold text-brand-text">{label}</span>
      </label>
      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] font-semibold text-brand-accent hover:underline">
          Read the full text
        </summary>
        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-brand-muted">
          {body}
        </p>
      </details>
    </div>
  );
}
