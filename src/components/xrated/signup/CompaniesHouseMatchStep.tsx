"use client";

// Optional signup step — offers to auto-verify the merchant if their
// chosen slug matches an active UK-registered company.
//
// STRICT non-blocking design:
//   - Silent on API failure (no key, no matches, low similarity, 404)
//   - Skip button always visible
//   - No error banners that stop the merchant continuing
//   - If the whole component fails to render, parent form still submits
//   - Cheap — hits the search API only once per slug change, debounced
//
// Drop in between the slug pick and the payment step. Parent passes
// the slug + a callback for when the merchant confirms a match.

import { useEffect, useState } from "react";
import { CircleCheck, ShieldCheck, X } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

type CompanyMatch = {
  companyName: string;
  companyNumber: string;
  status: string;
  address: string | null;
  dateOfCreation: string | null;
  similarity: number;
};

export function CompaniesHouseMatchStep({
  slug,
  onLink,
  onSkip
}: {
  /** The slug the merchant just picked. Empty = component renders nothing. */
  slug: string;
  /** Fired when merchant taps "Yes, that's us". Parent stores the
   *  company number + name for auto-verify at signup completion. */
  onLink: (match: CompanyMatch) => void;
  /** Fired when merchant taps "Skip" or dismisses. Parent proceeds
   *  to the next step without a linked company. */
  onSkip: () => void;
}) {
  const [matches, setMatches] = useState<CompanyMatch[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const clean = slug.trim().toLowerCase();
    if (clean.length < 3) {
      setMatches(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/signup/companies-house-match?slug=${encodeURIComponent(clean)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          // Non-blocking: hide the component and let the merchant proceed.
          setMatches([]);
          return;
        }
        const data = (await res.json()) as { matches?: CompanyMatch[] };
        setMatches(data.matches ?? []);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          // Silent fail — merchant never sees an error, they just don't
          // get offered the auto-verify shortcut. Signup continues.
          setMatches([]);
        }
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug]);

  // Nothing to show — parent shouldn't render this step. Merchant
  // proceeds straight to the next step of signup with no interruption.
  if (matches === null || matches.length === 0) return null;

  // Only show matches with similarity >= 0.50. Below that = spurious.
  const relevant = matches.filter((m) => m.similarity >= 0.5);
  if (relevant.length === 0) return null;

  return (
    <section
      className="rounded-2xl border bg-white p-4 shadow-md sm:p-5"
      style={{ borderColor: "rgba(184,134,11,0.20)" }}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${BRAND_YELLOW}22`, color: BRAND_BLACK }}
        >
          <ShieldCheck size={16} strokeWidth={2.6}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black text-neutral-900 sm:text-[14px]">
            We found your company on Companies House
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-500">
            Confirm the match to auto-verify your listing. Skip if none of these are you — you can still verify later.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip verification"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={14} strokeWidth={2.5}/>
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {relevant.map((m) => (
          <li key={m.companyNumber}>
            <button
              type="button"
              onClick={() => onLink(m)}
              className="flex w-full items-start gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-yellow-400 hover:shadow-md active:scale-[0.99]"
              style={{ borderColor: "rgba(184,134,11,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-black text-neutral-900">
                  {m.companyName}
                </div>
                <div className="mt-0.5 text-[10.5px] font-bold text-neutral-500">
                  Company No. {m.companyNumber}
                  {m.dateOfCreation && (
                    <span> · Est. {m.dateOfCreation.slice(0, 4)}</span>
                  )}
                </div>
                {m.address && (
                  <div className="mt-0.5 truncate text-[10px] text-neutral-500">
                    {m.address}
                  </div>
                )}
              </div>
              <CircleCheck
                size={16}
                strokeWidth={2.6}
                className="mt-0.5 flex-shrink-0"
                style={{ color: BRAND_GREEN_DARK }}
              />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSkip}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
        style={{ borderColor: "rgba(184,134,11,0.20)" }}
      >
        None of these — skip
      </button>

      {loading && (
        <div className="mt-2 text-[10.5px] text-neutral-400">
          Checking Companies House…
        </div>
      )}
    </section>
  );
}
