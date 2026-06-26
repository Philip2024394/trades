"use client";

// Tiny client island used on every Pricing card. Click stashes the
// service (name / price / unit) in sessionStorage under the ENQUIRY_KEY
// the ContactFormPanel already watches for, then navigates to the
// dedicated /trade/<slug>/contact page. The form prefills the message
// textarea and shows an "Enquiring about: …" pill so the tradie knows
// exactly which line item the customer tapped.

const ENQUIRY_KEY = "xrated_enquiry_service";

export function EnquireButton({
  slug,
  name,
  price,
  unit
}: {
  slug: string;
  name: string;
  price: number;
  unit: string;
}) {
  function onClick() {
    try {
      sessionStorage.setItem(
        ENQUIRY_KEY,
        JSON.stringify({ name, price, unit })
      );
    } catch {
      // sessionStorage unavailable (private mode etc.) — navigation
      // still works, prefill just won't apply.
    }
    window.location.href = `/trade/${slug}/contact#contact-panel`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
      style={{ background: "#FFB300" }}
      aria-label={`Enquire about ${name}`}
    >
      Enquire
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
