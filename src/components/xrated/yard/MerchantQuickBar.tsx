// MerchantQuickBar — a quiet single-line "Signed in as {Mike}" strip
// at the top of the Yard for signed-in merchants only. The four
// workflow cards (Products / Canteen / Trade Center / Messages) were
// removed on request — merchants navigate to their surfaces via the
// header burger + drawer instead. This strip stays as a confirmation
// signal ("yes, we know it's you") without adding chrome to the feed.
//
// Not rendered for signed-out visitors (Yard stays public + clean).

// slug/editToken are accepted but unused after the card removal so the
// existing consumers (CanteenPageShell, /trade-off/yard/page.tsx) keep
// compiling without touching them. Kept as optional-shaped props via
// the same destructure signature.

export function MerchantQuickBar({
  displayName
}: {
  slug: string;
  editToken: string;
  displayName?: string;
}) {
  const firstName = displayName?.split(/\s+/)[0] ?? "there";

  return (
    <section
      aria-label="Signed in confirmation"
      className="border-b border-[#E5D9BD] bg-white/60"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-3 py-2 md:px-6">
        {/* Live-session dot — soft green with a slow pulsing halo so
            the merchant sees at a glance that their session is active.
            Halo animates via ::after ring expanding + fading. */}
        <span
          aria-hidden
          className="relative inline-flex h-2 w-2 items-center justify-center"
        >
          <span
            className="absolute inline-block h-full w-full rounded-full"
            style={{
              backgroundColor: "#166534",
              boxShadow: "0 0 0 0 rgba(22,101,52,0.55)",
              animation: "mqb-signed-pulse 2.2s ease-out infinite"
            }}
          />
        </span>
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1B1A17]/60">
          Signed in as
        </span>
        <span className="text-[12.5px] font-black text-[#1B1A17]">
          {firstName}
        </span>
      </div>
      <style>{`
        @keyframes mqb-signed-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(22,101,52,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(22,101,52,0); }
          100% { box-shadow: 0 0 0 0 rgba(22,101,52,0); }
        }
      `}</style>
    </section>
  );
}
