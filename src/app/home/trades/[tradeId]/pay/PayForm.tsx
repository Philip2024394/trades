"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Loader2,
  Sparkles,
  CheckCircle2,
  Upload,
  Info
} from "lucide-react";

type Extraction = {
  amount_pence: number | null;
  paid_at_iso: string | null;
  method: string | null;
  supplier: string | null;
  materials_amount_pence: number | null;
  labour_amount_pence: number | null;
  vat_amount_pence: number | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

function toPounds(pence: number | null | undefined): string {
  if (pence == null) return "";
  return (pence / 100).toFixed(2);
}

export function PayForm({
  tradeId,
  aiEnabled
}: {
  tradeId: string;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<Extraction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill fields (source of truth in form state so AI can update them).
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<
    "bank_transfer" | "cash" | "card" | "cheque" | "other"
  >("bank_transfer");
  const [paymentType, setPaymentType] = useState<
    "deposit" | "interim" | "final" | "materials" | "labour" | "other"
  >("deposit");
  const [materialsAmount, setMaterialsAmount] = useState("");
  const [labourAmount, setLabourAmount] = useState("");
  const [notes, setNotes] = useState("");

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setError(null);

    if (!aiEnabled) return;
    // Best-effort AI prefill via a preview endpoint (uses same helper).
    setParsing(true);
    setParsed(null);
    try {
      const fd = new FormData();
      fd.append("receipt", picked);
      const res = await fetch("/api/os/receipts/parse", {
        method: "POST",
        body: fd
      });
      const data = (await res.json()) as {
        ok: boolean;
        ai_configured: boolean;
        extraction?: Extraction;
        error?: string;
      };
      if (res.ok && data.ok && data.extraction) {
        setParsed(data.extraction);
        const e = data.extraction;
        if (e.amount_pence != null) setAmount(toPounds(e.amount_pence));
        if (e.paid_at_iso) setPaidAt(e.paid_at_iso);
        if (e.method) {
          const canonical =
            e.method === "bank_transfer" ||
            e.method === "cash" ||
            e.method === "card" ||
            e.method === "cheque"
              ? e.method
              : "other";
          setMethod(canonical);
        }
        if (e.materials_amount_pence != null)
          setMaterialsAmount(toPounds(e.materials_amount_pence));
        if (e.labour_amount_pence != null)
          setLabourAmount(toPounds(e.labour_amount_pence));
      }
    } catch {
      /* silent */
    } finally {
      setParsing(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const fd = new FormData();
    fd.append("amount", amount);
    fd.append("paid_at", paidAt);
    fd.append("method", method);
    fd.append("payment_type", paymentType);
    if (materialsAmount) fd.append("materials_amount", materialsAmount);
    if (labourAmount) fd.append("labour_amount", labourAmount);
    if (notes) fd.append("notes", notes);
    if (file) fd.append("receipt", file);

    try {
      const res = await fetch(`/api/home/trades/${tradeId}/pay`, {
        method: "POST",
        body: fd
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "invalid_amount"
            ? "Enter a valid amount."
            : data.error === "file_too_large"
              ? "Receipt is too large — 10 MB max."
              : "Could not save the payment."
        );
        setSubmitting(false);
        return;
      }
      router.push(`/home/trades/${tradeId}?payment=saved`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Screenshot / receipt uploader */}
      <section>
        <label className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
          Receipt or bank-transfer screenshot
        </label>
        <div className="mt-3">
          {previewUrl ? (
            <div className="relative rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="max-h-72 w-full rounded-xl object-contain"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-[#1B1A17]/15 bg-[#1B1A17]/4 px-3 py-2 text-[12px] font-semibold text-[#1B1A17]/80 hover:bg-[#1B1A17]/5"
                >
                  <Upload className="h-3 w-3" aria-hidden />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setParsed(null);
                  }}
                  className="text-[12px] font-semibold text-[#1B1A17]/55 hover:text-[#1B1A17]/80"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#1B1A17]/18 bg-[#1B1A17]/4 p-8 text-center hover:border-amber-400/40 hover:bg-[#1B1A17]/5"
            >
              <Camera className="h-6 w-6 text-amber-300" aria-hidden />
              <div className="text-[14px] font-semibold text-[#1B1A17]">
                Snap or upload
              </div>
              <div className="text-[12px] text-[#1B1A17]/55">
                JPG, PNG, HEIC, PDF · max 10&nbsp;MB
              </div>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={handleFilePick}
            className="hidden"
          />
        </div>

        {parsing ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-[12px] font-semibold text-amber-200">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Reading receipt with AI…
          </div>
        ) : null}

        {parsed ? (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[13px] text-emerald-100">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
              <div>
                <b>AI prefilled the fields below</b> ({parsed.confidence}{" "}
                confidence). Please check before saving.
              </div>
            </div>
          </div>
        ) : null}

        {!aiEnabled ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[12px] text-amber-100/80">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              AI receipt reading is not enabled on this environment yet — enter
              details manually.
            </span>
          </div>
        ) : null}
      </section>

      {/* Amount + type */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="amount"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Total paid (£)
          </label>
          <input
            id="amount"
            required
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="2400.00"
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[16px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="paid_at"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Date paid
          </label>
          <input
            id="paid_at"
            required
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
      </section>

      {/* Payment type */}
      <section>
        <label className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
          Payment type
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { v: "deposit", l: "Deposit" },
            { v: "interim", l: "Interim" },
            { v: "final", l: "Final" },
            { v: "materials", l: "Materials" },
            { v: "labour", l: "Labour" },
            { v: "other", l: "Other" }
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setPaymentType(opt.v as typeof paymentType)}
              className={`inline-flex min-h-[42px] items-center justify-center rounded-xl border text-[13px] font-semibold ${
                paymentType === opt.v
                  ? "border-amber-400 bg-amber-400 text-neutral-900"
                  : "border-[#1B1A17]/12 bg-[#1B1A17]/4 text-[#1B1A17]/70 hover:bg-[#1B1A17]/5"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </section>

      {/* Method */}
      <section>
        <label
          htmlFor="method"
          className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
        >
          Method
        </label>
        <select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="mt-2 w-full appearance-none rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        >
          <option value="bank_transfer" className="text-black">
            Bank transfer
          </option>
          <option value="cash" className="text-black">
            Cash
          </option>
          <option value="card" className="text-black">
            Card
          </option>
          <option value="cheque" className="text-black">
            Cheque
          </option>
          <option value="other" className="text-black">
            Other
          </option>
        </select>
      </section>

      {/* Materials / labour split (optional) */}
      <section>
        <label className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
          Materials vs labour split (optional)
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={materialsAmount}
              onChange={(e) => setMaterialsAmount(e.target.value)}
              placeholder="Materials (£)"
              className="w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>
          <div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={labourAmount}
              onChange={(e) => setLabourAmount(e.target.value)}
              placeholder="Labour (£)"
              className="w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section>
        <label
          htmlFor="notes"
          className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What this payment was for."
          className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[14px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      </section>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 hover:bg-amber-300 disabled:opacity-60 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Save payment to Notebook
            </>
          )}
        </button>
        {error ? (
          <p className="mt-3 text-[13px] text-red-300">{error}</p>
        ) : null}
      </div>
    </form>
  );
}
