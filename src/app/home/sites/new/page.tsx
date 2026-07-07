// /home/sites/new
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, ArrowRight, HardHat } from "lucide-react";

const TYPES = [
  { v: "renovation", l: "Renovation" },
  { v: "new_build", l: "New build" },
  { v: "commercial", l: "Commercial" },
  { v: "extension", l: "Extension" },
  { v: "maintenance", l: "Maintenance" }
];

export default function NewSitePage() {
  const router = useRouter();
  const [siteType, setSiteType] = useState("renovation");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/home/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(f.get("name") ?? "").trim(),
          address_line_1: String(f.get("address_line_1") ?? "").trim() || null,
          postcode:
            String(f.get("postcode") ?? "").trim().toUpperCase() || null,
          site_type: siteType,
          started_at: String(f.get("started_at") ?? "") || null,
          estimated_completion_at:
            String(f.get("estimated_completion_at") ?? "") || null
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        siteId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "missing_name"
            ? "Give your site a name."
            : data.error === "insufficient_role"
              ? "You need foreman role or above in this entity."
              : "Could not create the site."
        );
        setSubmitting(false);
        return;
      }
      router.push(`/home/sites/${data.siteId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.14) 0%, transparent 60%)"
        }}
      />
      <div className="relative mx-auto max-w-2xl px-5 py-8 md:px-10 md:py-12">
        <Link
          href="/home/sites"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <HardHat className="h-3 w-3" aria-hidden />
            New site
          </p>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight md:text-[36px]">
            Open a new site record.
          </h1>
          <p className="mt-3 text-[15px] leading-[1.55] text-[#1B1A17]/70">
            Give it a name your team will recognise. Add sub-trades on the next
            screen.
          </p>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-6">
          <div>
            <label
              htmlFor="name"
              className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
            >
              Site name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="e.g. 27 Elm Grove Renovation"
              maxLength={200}
              className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>

          <div>
            <span className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
              Site type
            </span>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TYPES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setSiteType(t.v)}
                  className={`inline-flex min-h-[42px] items-center justify-center rounded-xl border text-[13px] font-semibold ${
                    siteType === t.v
                      ? "border-amber-400 bg-amber-400 text-neutral-900"
                      : "border-[#1B1A17]/12 bg-[#1B1A17]/4 text-[#1B1A17]/70 hover:bg-[#1B1A17]/5"
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="address_line_1"
              className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
            >
              Address (optional)
            </label>
            <input
              id="address_line_1"
              name="address_line_1"
              placeholder="27 Elm Grove"
              maxLength={200}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="started_at"
                className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
              >
                Start date
              </label>
              <input
                id="started_at"
                name="started_at"
                type="date"
                className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </div>
            <div>
              <label
                htmlFor="estimated_completion_at"
                className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60"
              >
                Estimated completion
              </label>
              <input
                id="estimated_completion_at"
                name="estimated_completion_at"
                type="date"
                className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </div>
          </div>

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
                  Create site
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
            {error ? (
              <p className="mt-3 text-[13px] text-red-300">{error}</p>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
