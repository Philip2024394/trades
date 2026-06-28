// First-run checklist — top-of-dashboard card that turns "what controls
// am I looking at?" into "what should I do next?". Each row leads with
// the OUTCOME (more contacts, fewer abandons) and links to the right
// section so a tradesperson who's never run a dashboard knows where
// the leverage is.
//
// Self-hides once every item is done so a fully-configured profile
// gets its dashboard space back. Pure presentational from the
// listing record — no client interactivity needed.

import type { HammerexTradeOffListing } from "@/lib/supabase";

type Item = {
  /** Stable id, used only for React key + telemetry later if we add it. */
  id: string;
  done: boolean;
  title: string;
  /** One sentence about why this matters for contact / sales volume.
   *  Pattern: "<benefit>. <how to use it>." Never inventing numbers. */
  benefit: string;
  /** Anchor or URL the row jumps to. Same-page anchors use `#section-id`
   *  on the main edit page; cross-page links carry the token. */
  href: string;
};

export function FirstRunChecklist({
  listing,
  editToken
}: {
  listing: HammerexTradeOffListing;
  editToken: string;
}) {
  const tokenQs = `?token=${encodeURIComponent(editToken)}`;
  const studioBase = `/trade-off/edit/${listing.slug}/app-studio${tokenQs}`;
  const profileBase = `/trade-off/edit/${listing.slug}${tokenQs}`;

  // Scoring rules — deliberately permissive. We want a tradesperson to
  // tick boxes early, not feel stuck on a 200-char bio. The dashboard
  // is a momentum game, not a completeness audit.
  const hasBio = (listing.bio ?? "").trim().length >= 50;
  const hasAvatar = !!listing.avatar_url;
  const hasPhotos = (listing.photos?.length ?? 0) >= 3;
  const hasServices = (listing.priced_services?.length ?? 0) >= 1;
  const hasHours = Object.values(listing.operating_hours ?? {}).some(
    (slot) => slot && typeof slot === "object"
  );
  const hasFaq = (listing.faq_items?.length ?? 0) >= 1;
  const hasHeroText = (listing.hero_text_line1 ?? "").trim().length > 0;
  const hasTrust =
    listing.is_insured ||
    (listing.qualifications?.length ?? 0) > 0 ||
    (listing.trade_memberships?.length ?? 0) > 0;

  const items: Item[] = [
    {
      id: "bio",
      done: hasBio,
      title: "Write your About line",
      benefit:
        "Buyers read this before they message. A clear bio drops the 'who are you?' DMs and lifts contact taps.",
      href: `${profileBase}#about`
    },
    {
      id: "avatar",
      done: hasAvatar,
      title: "Upload your profile photo",
      benefit:
        "A real face on the hero builds trust in under a second. Profiles with photos out-convert avatar-less ones every time.",
      href: `${profileBase}#avatar`
    },
    {
      id: "photos",
      done: hasPhotos,
      title: "Add 3 portfolio photos",
      benefit:
        "Past work is the single strongest sales signal. Three is the minimum that reads as established rather than new.",
      href: `${profileBase}#photos`
    },
    {
      id: "services",
      done: hasServices,
      title: "List at least 1 priced service or product",
      benefit:
        "Visible prices anchor the conversation. Buyers who see a number message faster than buyers who have to ask.",
      href: `${profileBase}#priced-services`
    },
    {
      id: "hours",
      done: hasHours,
      title: "Set your opening hours",
      benefit:
        "Knowing when you reply cuts dead-air messages and stops customers bouncing to a competitor that looks more active.",
      href: `${profileBase}#hours`
    },
    {
      id: "faq",
      done: hasFaq,
      title: "Answer 1 frequently asked question",
      benefit:
        "Pre-answering a common question removes a tap-and-type barrier — buyers who self-serve commit to the contact step faster.",
      href: `${profileBase}#faq`
    },
    {
      id: "hero",
      done: hasHeroText,
      title: "Write your hero line in App Studio",
      benefit:
        "The first line a customer reads above the fold. One sharp sentence about what you do beats a generic banner every time.",
      href: studioBase
    },
    {
      id: "trust",
      done: hasTrust,
      title: "Add one trust signal (insured / licensed / member)",
      benefit:
        "Even one badge — insured, licensed, or member of a trade body — measurably reduces buyer hesitation on first contact.",
      href: `${profileBase}#trust`
    }
  ];

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / total) * 100);

  // Fully configured — don't take up real-estate.
  if (done === total) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 sm:px-0">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-100 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                style={{ color: "#FFB300" }}
              >
                Start here
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
                Your profile is {pct}% set up
              </h2>
              <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
                Each step below has been proven to lift either the number of
                contacts you get, or the share of those contacts that turn
                into paid work. Tick them off in any order.
              </p>
            </div>
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-neutral-900"
              style={{ background: "#FFB300" }}
              aria-label={`${done} of ${total} steps complete`}
            >
              {done}/{total}
            </span>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: "#FFB300" }}
              aria-hidden="true"
            />
          </div>
        </header>

        <ul className="divide-y divide-neutral-100">
          {items.map((it) => (
            <li key={it.id}>
              <a
                href={it.href}
                className="flex items-start gap-3 px-5 py-3.5 transition active:bg-neutral-50 sm:px-6"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    it.done
                      ? "border-transparent text-neutral-900"
                      : "border-neutral-300 text-neutral-300"
                  }`}
                  style={it.done ? { background: "#FFB300" } : undefined}
                >
                  {it.done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <span className="text-[13px] font-extrabold">·</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13px] font-extrabold sm:text-sm ${
                      it.done ? "text-neutral-400 line-through" : "text-neutral-900"
                    }`}
                  >
                    {it.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-neutral-500">
                    {it.benefit}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-neutral-300"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
