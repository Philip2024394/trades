// TradeCircleHeader — homeowner-facing replacement for the trade-side
// "Canteens · new / Trade corners of The Yard" header. Rendered only
// when the viewer arrived via InviteModeWrapper (proven homeowner
// session). Uses plain, non-industry-jargon copy so first-time
// homeowners understand what the directory is + what to do next.
//
// The page's original trade-facing chrome (Founding 100 strip, "Your
// canteen" pill, category badge row, "Start a Canteen" CTA) is hidden
// in invite mode via the same signal so both audiences get the right
// experience on one route.

const BRAND_YELLOW = "#FFB300";

export function TradeCircleHeader() {
  return (
    <>
      {/* Page title strip — replaces the trade-facing "Canteens" strip */}
      <section style={{ borderBottom: "1px solid rgba(139,69,19,0.15)" }}>
        <div className="mx-auto flex w-full max-w-6xl items-start gap-3 px-3 py-6 md:px-6 md:py-8">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700 shadow-sm">
              <span
                className="block h-2 w-2 rounded-full"
                style={{ backgroundColor: BRAND_YELLOW }}
                aria-hidden="true"
              />
              Every trade + supplier on The Network
            </div>
            <h1 className="text-[24px] font-black leading-tight text-neutral-900 md:text-[32px]">
              Trade Circle.
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-snug text-neutral-600 md:text-[14px]">
              Browse the trades and suppliers on The Network. Tap any card to see their profile — work photos, reviews and the projects they&rsquo;ve done — then invite them to one or more of your projects.
            </p>
          </div>
        </div>
      </section>

      {/* Helper strip removed per Philip 2026-07-19. */}
    </>
  );
}
