// Step 2 — Contact + business type + Companies House.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useDraft, BUSINESS_TYPES } from "../draftStore";
import { WizardShell, fieldClass, labelClass } from "../WizardShell";

export default function StepContact() {
  const router = useRouter();
  const { draft, patch, hydrated } = useDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    const f = new FormData(e.currentTarget);
    const merged = patch({
      email: String(f.get("email") ?? "").trim().toLowerCase(),
      whatsapp: String(f.get("whatsapp") ?? "").trim(),
      businessType: String(
        f.get("businessType") ?? ""
      ) as ReturnType<typeof useDraft>["draft"]["businessType"],
      companiesHouseNumber: String(
        f.get("companiesHouseNumber") ?? ""
      ).trim()
    });

    let inviteToken: string | null = null;
    try {
      inviteToken = window.sessionStorage.getItem("xratedtrade:join-invite-token");
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch("/api/join/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...merged, inviteToken })
      });
      const data = (await res.json()) as {
        ok: boolean;
        slug?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "email_in_use"
            ? "This email is already on the Notebook. Try signing in instead."
            : data.error === "slug_conflict"
              ? "That business name already exists — try adding your city or number to make it unique."
              : "Could not create your Notebook. Please try again."
        );
        setBusy(false);
        return;
      }
      router.push(`/join/done?slug=${encodeURIComponent(data.slug ?? "")}`);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <WizardShell
      step="contact"
      backHref="/join/start"
      title="How can customers reach you?"
      subtitle="Email is required so we can send your Notebook access link. Everything else is optional."
    >
      <form onSubmit={submit} className="space-y-6">
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={hydrated ? draft.email : ""}
            placeholder="you@example.com"
            className={`${fieldClass} mt-2`}
            autoComplete="email"
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="whatsapp" className={labelClass}>
            WhatsApp / phone (optional)
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            defaultValue={hydrated ? draft.whatsapp : ""}
            placeholder="+44 7…"
            className={`${fieldClass} mt-2`}
            autoComplete="tel"
            maxLength={30}
          />
          <p className="mt-1 text-[13px] text-[#1B1A17]/45">
            Customers can WhatsApp you directly from your Notebook.
          </p>
        </div>

        <div>
          <span className={labelClass}>How is your business set up?</span>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {BUSINESS_TYPES.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-3 py-2.5 hover:border-[#1B1A17]/18"
              >
                <input
                  type="radio"
                  name="businessType"
                  value={t.value ?? ""}
                  required
                  defaultChecked={
                    hydrated ? draft.businessType === t.value : false
                  }
                  className="h-4 w-4 accent-amber-400"
                />
                <span className="text-[14px] text-[#1B1A17]">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="companiesHouseNumber" className={labelClass}>
            Companies House number (optional)
          </label>
          <input
            id="companiesHouseNumber"
            name="companiesHouseNumber"
            defaultValue={hydrated ? draft.companiesHouseNumber : ""}
            placeholder="e.g. 12345678"
            className={`${fieldClass} mt-2 tracking-[0.15em]`}
            maxLength={12}
          />
          <p className="mt-1 text-[13px] text-[#1B1A17]/45">
            If you provide it we&apos;ll verify + display the Verified badge on
            your Notebook.
          </p>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
            Create my Notebook
          </button>
          {error ? (
            <p className="mt-3 text-[13px] text-red-300">{error}</p>
          ) : null}
          <p className="mt-3 text-[13px] text-[#1B1A17]/45">
            By continuing you agree that this is a real UK trade business
            representation. Free forever.
          </p>
        </div>
      </form>
    </WizardShell>
  );
}
