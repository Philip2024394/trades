"use client";

// Trial-tail "day-25" loss-aversion banner. Shown on the trade-off edit
// dashboard for `tier === 'app_trial'` listings with 1-5 days left.
// Lists the premium features that will pause when the trial expires, plus
// two CTAs: preview the Standard-tier profile, OR lock in the annual plan.

import Link from "next/link";

type Props = {
  slug: string;
  daysRemaining: number;
  trialExpiresAt: string | null;
  upgradeAnnualHref: string;
  previewHref: string;
};

const LOST_FEATURES: { icon: string; label: string }[] = [
  { icon: "✨", label: "Animated hero text (shimmer / dance / underline)" },
  { icon: "🟡", label: "Custom CTA effects (glow / pulse / shake)" },
  { icon: "📸", label: "Verified work gallery (Before / During / After projects)" },
  { icon: "🟠", label: "Avatar frame (ring / pulse / dance)" },
  { icon: "🏅", label: "Hammerex Standard tier display (Master / Master Plus badge)" },
  { icon: "🟢", label: "Trades On Standby visibility" },
  { icon: "🔧", label: "5% off Hammerex tools (if you upgrade to annual)" }
];

function formatExpiry(iso: string | null): string {
  if (!iso) return "your trial end date";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "your trial end date";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

export function LossAversionPreview({
  slug,
  daysRemaining,
  trialExpiresAt,
  upgradeAnnualHref,
  previewHref
}: Props) {
  void slug; // included in props for downstream tracking if we add it later
  const expiry = formatExpiry(trialExpiresAt);

  return (
    <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-50 p-5 text-amber-900 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
        Trial ending soon
      </p>
      <h2 className="mt-2 text-lg font-extrabold leading-tight sm:text-xl">
        <span aria-hidden="true">⚠</span> Only {daysRemaining} day
        {daysRemaining === 1 ? "" : "s"} left on your Xrated App trial.
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed">
        On <span className="font-bold">{expiry}</span>, you lose:
      </p>
      <ul className="mt-3 space-y-1.5 text-[13px] leading-snug">
        {LOST_FEATURES.map((f) => (
          <li key={f.label} className="flex items-start gap-2">
            <span aria-hidden="true" className="shrink-0 leading-snug">{f.icon}</span>
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-12 flex-1 place-items-center rounded-xl border border-amber-400 bg-white px-4 text-[13px] font-bold text-amber-900 transition hover:bg-amber-50"
        >
          Preview my free-tier profile →
        </a>
        <Link
          href={upgradeAnnualHref}
          className="grid h-12 flex-1 place-items-center rounded-xl bg-brand-accent px-4 text-[13px] font-extrabold text-black transition hover:opacity-90"
        >
          Lock in premium — annual £80/yr →
        </Link>
      </div>
    </div>
  );
}

export default LossAversionPreview;
