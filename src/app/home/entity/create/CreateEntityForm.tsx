"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";

const TIERS = [
  {
    value: "small_business",
    label: "Small business",
    hint: "One site, one business — shop, office, café, single-site owner."
  },
  {
    value: "contractor",
    label: "Contractor / Foreman",
    hint: "You hire foremen and sub-trades. Multi-site operational."
  },
  {
    value: "enterprise",
    label: "Enterprise · Multi-site",
    hint: "Housing, developer, FM. Financial roles + audit trail required."
  },
  {
    value: "public_sector",
    label: "Public sector / Regulated",
    hint: "Council, NHS, MoD, DfE. Golden Thread + procurement rules apply."
  }
];

export function CreateEntityForm() {
  const router = useRouter();
  const [tier, setTier] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!tier) {
      setError("Choose a tier.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/home/entity/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier,
          display_name: String(f.get("display_name") ?? "").trim(),
          legal_name: String(f.get("legal_name") ?? "").trim() || null,
          companies_house_number:
            String(f.get("companies_house_number") ?? "").trim() || null,
          city: String(f.get("city") ?? "").trim() || null,
          postcode:
            String(f.get("postcode") ?? "").trim().toUpperCase() || null
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        entity?: { id: string };
      };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "missing_display_name"
            ? "Enter a display name."
            : data.error === "invalid_tier"
              ? "Pick a valid tier."
              : "Could not create the entity."
        );
        setSubmitting(false);
        return;
      }
      router.push("/home/entity");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section>
        <label className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
          Tier
        </label>
        <div className="mt-3 space-y-2">
          {TIERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTier(opt.value)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                tier === opt.value
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-[#1B1A17]/12 bg-[#1B1A17]/4 hover:border-[#1B1A17]/20"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border-2 ${
                  tier === opt.value
                    ? "border-amber-400 bg-amber-400"
                    : "border-white/30"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#1B1A17]">
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-[13px] text-[#1B1A17]/60">
                  {opt.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <label
          htmlFor="display_name"
          className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
        >
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          required
          placeholder="e.g. Kingsley Construction Ltd"
          maxLength={120}
          className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="legal_name"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Legal name (optional)
          </label>
          <input
            id="legal_name"
            name="legal_name"
            placeholder="If different"
            maxLength={160}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="companies_house_number"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Companies House #
          </label>
          <input
            id="companies_house_number"
            name="companies_house_number"
            placeholder="12345678"
            maxLength={12}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] tracking-widest text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="city"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            City / town
          </label>
          <input
            id="city"
            name="city"
            placeholder="Manchester"
            maxLength={80}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="postcode"
            className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
          >
            Postcode
          </label>
          <input
            id="postcode"
            name="postcode"
            placeholder="M1 2AB"
            maxLength={8}
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] uppercase text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
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
              Creating…
            </>
          ) : (
            <>
              Create entity
              <ArrowRight className="h-4 w-4" aria-hidden />
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
