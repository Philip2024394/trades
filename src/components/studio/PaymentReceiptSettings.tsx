"use client";

// Merchant-facing receipt configuration.
//
// One form. Enable toggle, sender identity, logo, footer note, BCC
// merchant on every send. When enabled every paid webhook fires an
// email to the customer via Resend.

import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";

type ReceiptConfig = {
  enabled: boolean;
  from_email: string | null;
  from_name: string | null;
  logo_url: string | null;
  reply_to: string | null;
  footer_note: string | null;
  bcc_merchant: boolean;
};

const EMPTY: ReceiptConfig = {
  enabled: false,
  from_email: null,
  from_name: null,
  logo_url: null,
  reply_to: null,
  footer_note: null,
  bcc_merchant: true
};

export function PaymentReceiptSettings() {
  const [config, setConfig] = useState<ReceiptConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/studio/payments/receipt");
        const json = (await res.json()) as
          | { ok: true; config: ReceiptConfig }
          | { ok: false; error: string };
        if (!json.ok) throw new Error(json.error);
        setConfig(json.config);
      } catch (err) {
        setError((err as Error).message ?? "network");
        setConfig(EMPTY);
      }
    })();
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    setSaveState("idle");
    try {
      const res = await fetchWithRetry("/api/studio/payments/receipt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "save-failed");
      setSaveState("ok");
      window.setTimeout(() => setSaveState("idle"), 2200);
    } catch (err) {
      setSaveState("err");
      setError((err as Error).message ?? "save-failed");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof ReceiptConfig>(key: K, value: ReceiptConfig[K]) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (config === null) {
    return (
      <p className="p-8 text-center text-[13px] text-neutral-500">Loading…</p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Receipts
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Email a receipt the moment they pay.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        When a webhook confirms a payment we send the customer a
        branded receipt via Resend. Set your sender identity once —
        every provider (Stripe, PayPal, Mollie, Razorpay, Midtrans) uses
        the same template.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-extrabold text-neutral-900">
              Send receipts automatically
            </p>
            <p className="text-[11px] text-neutral-600">
              Requires <code className="rounded bg-neutral-100 px-1">RESEND_API_KEY</code>{" "}
              set on the server.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update("enabled", !config.enabled)}
            aria-pressed={config.enabled}
            className="relative inline-flex h-7 w-12 items-center rounded-full transition"
            style={{ background: config.enabled ? GREEN : "#D4D4D4" }}
          >
            <span
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow"
              style={{
                left: config.enabled ? 22 : 2,
                transition: "left 180ms cubic-bezier(0.4,0,0.2,1)"
              }}
            />
          </button>
        </div>

        <hr className="border-neutral-100" />

        <Field
          label="From address"
          hint="Must be verified in Resend (e.g. orders@yourbrand.com)"
          value={config.from_email ?? ""}
          onChange={(v) => update("from_email", v || null)}
          type="email"
          placeholder="orders@yourbrand.com"
          required
        />
        <Field
          label="From name"
          hint="Display name on the email"
          value={config.from_name ?? ""}
          onChange={(v) => update("from_name", v || null)}
          placeholder="Your Brand"
        />
        <Field
          label="Reply-to (optional)"
          hint="Where replies to the receipt land"
          value={config.reply_to ?? ""}
          onChange={(v) => update("reply_to", v || null)}
          type="email"
          placeholder="support@yourbrand.com"
        />
        <Field
          label="Logo URL (optional)"
          hint="Public image URL — shown at the top of the receipt"
          value={config.logo_url ?? ""}
          onChange={(v) => update("logo_url", v || null)}
          type="url"
          placeholder="https://yourbrand.com/logo.png"
        />
        <Field
          label="Footer note (optional)"
          hint="Small print — refund policy, tax number, etc."
          value={config.footer_note ?? ""}
          onChange={(v) => update("footer_note", v || null)}
          placeholder="VAT: GB123456789 · Refunds within 14 days"
          multiline
        />

        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          <div>
            <p className="text-[12px] font-extrabold text-neutral-900">
              BCC merchant on every send
            </p>
            <p className="text-[11px] text-neutral-600">
              Copy sent to the From address for your records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update("bcc_merchant", !config.bcc_merchant)}
            aria-pressed={config.bcc_merchant}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition"
            style={{ background: config.bcc_merchant ? GREEN : "#D4D4D4" }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
              style={{
                left: config.bcc_merchant ? 20 : 2,
                transition: "left 180ms cubic-bezier(0.4,0,0.2,1)"
              }}
            />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          {saveState === "ok" && (
            <span className="text-[10px] font-bold" style={{ color: GREEN }}>
              Saved ✓
            </span>
          )}
          {saveState === "err" && (
            <span className="text-[10px] font-bold" style={{ color: RED }}>
              Save failed
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || !config.from_email}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: YELLOW }}
          >
            {saving ? "Saving…" : "Save receipt settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  multiline
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
        />
      )}
      <p className="text-[10px] text-neutral-500">{hint}</p>
    </div>
  );
}
