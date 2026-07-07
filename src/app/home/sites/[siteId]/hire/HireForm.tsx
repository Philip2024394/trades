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
import { TRADE_OPTIONS } from "@/app/join/draftStore";

type Extraction = {
  hired_display_name: string | null;
  hired_trade: string | null;
  service_description: string | null;
  agreed_price_pence: number | null;
  deposit_pence: number | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

function toPounds(pence: number | null | undefined): string {
  if (pence == null) return "";
  return (pence / 100).toFixed(2);
}

export function HireForm({
  siteId,
  aiEnabled
}: {
  siteId: string;
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

  const [hiredName, setHiredName] = useState("");
  const [hiredTrade, setHiredTrade] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [agreedStart, setAgreedStart] = useState("");
  const [agreedEnd, setAgreedEnd] = useState("");
  const [notes, setNotes] = useState("");

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setError(null);

    if (!aiEnabled) return;
    setParsing(true);
    setParsed(null);
    try {
      const fd = new FormData();
      fd.append("agreement_image", picked);
      const res = await fetch("/api/os/agreements/parse", {
        method: "POST",
        body: fd
      });
      const data = (await res.json()) as {
        ok: boolean;
        extraction?: Extraction;
      };
      if (res.ok && data.ok && data.extraction) {
        setParsed(data.extraction);
        const e = data.extraction;
        if (e.hired_display_name) setHiredName(e.hired_display_name);
        if (e.hired_trade) setHiredTrade(e.hired_trade);
        if (e.service_description) setServiceDescription(e.service_description);
        if (e.agreed_price_pence != null)
          setAgreedPrice(toPounds(e.agreed_price_pence));
        if (e.deposit_pence != null) setDeposit(toPounds(e.deposit_pence));
        if (e.agreed_start_date) setAgreedStart(e.agreed_start_date);
        if (e.agreed_end_date) setAgreedEnd(e.agreed_end_date);
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
    fd.append("hired_display_name", hiredName);
    fd.append("hired_trade", hiredTrade);
    if (serviceDescription) fd.append("service_description", serviceDescription);
    if (agreedPrice) fd.append("agreed_price", agreedPrice);
    if (deposit) fd.append("deposit", deposit);
    if (agreedStart) fd.append("agreed_start_date", agreedStart);
    if (agreedEnd) fd.append("agreed_end_date", agreedEnd);
    if (notes) fd.append("notes", notes);
    if (file) fd.append("agreement_image", file);

    try {
      const res = await fetch(`/api/home/sites/${siteId}/hire`, {
        method: "POST",
        body: fd
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "missing_hired_details"
            ? "Enter the sub-trade name and trade."
            : data.error === "insufficient_role"
              ? "You need foreman role or above."
              : data.error === "file_too_large"
                ? "Agreement image is too large — 10 MB max."
                : "Could not save the engagement."
        );
        setSubmitting(false);
        return;
      }
      router.push(`/home/sites/${siteId}?engagement=saved`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Agreement photo uploader */}
      <section>
        <label className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
          Handwritten agreement / WhatsApp screenshot
        </label>
        <div className="mt-3">
          {previewUrl ? (
            <div className="relative rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3">
              <img
                src={previewUrl}
                alt="Agreement preview"
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
                JPG, PNG, HEIC · max 10&nbsp;MB
              </div>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFilePick}
            className="hidden"
          />
        </div>

        {parsing ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-[12px] font-semibold text-amber-200">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Reading agreement with AI…
          </div>
        ) : null}

        {parsed ? (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[13px] text-emerald-100">
            <div className="flex items-start gap-2">
              <Sparkles
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300"
                aria-hidden
              />
              <div>
                <b>AI prefilled the fields</b> ({parsed.confidence} confidence).
                Confirm before saving.
              </div>
            </div>
          </div>
        ) : null}

        {!aiEnabled ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[12px] text-amber-100/80">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              AI photo-parse not enabled on this environment yet — fill in the
              fields manually.
            </span>
          </div>
        ) : null}
      </section>

      {/* Who + trade */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="hired_display_name"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Trade / person
          </label>
          <input
            id="hired_display_name"
            required
            value={hiredName}
            onChange={(e) => setHiredName(e.target.value)}
            placeholder="Dave the Carpenter"
            maxLength={120}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="hired_trade"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Trade
          </label>
          <select
            id="hired_trade"
            required
            value={hiredTrade}
            onChange={(e) => setHiredTrade(e.target.value)}
            className="mt-2 w-full appearance-none rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          >
            <option value="" disabled className="text-black">
              Select…
            </option>
            {TRADE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value} className="text-black">
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Service description */}
      <section>
        <label
          htmlFor="service_description"
          className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
        >
          Service description
        </label>
        <input
          id="service_description"
          value={serviceDescription}
          onChange={(e) => setServiceDescription(e.target.value)}
          placeholder="Kitchen carcass install + worktop cut"
          maxLength={400}
          className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      </section>

      {/* Money */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="agreed_price"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Agreed total (£)
          </label>
          <input
            id="agreed_price"
            type="number"
            step="0.01"
            min="0"
            value={agreedPrice}
            onChange={(e) => setAgreedPrice(e.target.value)}
            placeholder="2400.00"
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[16px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="deposit"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Deposit (£)
          </label>
          <input
            id="deposit"
            type="number"
            step="0.01"
            min="0"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            placeholder="800.00"
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[16px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
      </section>

      {/* Dates */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="agreed_start_date"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Start date
          </label>
          <input
            id="agreed_start_date"
            type="date"
            value={agreedStart}
            onChange={(e) => setAgreedStart(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="agreed_end_date"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            End date
          </label>
          <input
            id="agreed_end_date"
            type="date"
            value={agreedEnd}
            onChange={(e) => setAgreedEnd(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
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
          placeholder="Anything specific about materials, access, scope."
          maxLength={2000}
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
              Save engagement to site
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
