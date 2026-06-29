// Xrated Trades — Tips guide: photographing trade work.
// Long-form Article-schema page targeting "how to photograph my work",
// "phone photography for tradies" and similar. Server component,
// reuses XratedHeader/Footer. No fabricated stats — qualitative phrasing
// throughout.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { TRADE_OFF_HERO_IMAGES } from "@/lib/tradeOffHeroes";

export const revalidate = 3600;

const TITLE = "How to photograph your work like a pro";
const DESCRIPTION =
  "You don't need a DSLR. A guide for tradies on lighting, angles, before/after pairs and the small habits that make phone photos look professional on your profile.";
const SLUG = "/trade-off/tips/photograph-your-work";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/guide-photograph-your-work.png";

export const metadata: Metadata = {
  title: `${TITLE} | xratedtrade.com guides`,
  description: DESCRIPTION,
  alternates: { canonical: SLUG },
  openGraph: {
    type: "article",
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    url: absolute(SLUG),
    images: [{ url: HERO, alt: TITLE }]
  }
};

const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  author: { "@type": "Organization", name: "xratedtrade.com" },
  publisher: {
    "@type": "Organization",
    name: "xratedtrade.com",
    logo: { "@type": "ImageObject", url: BRAND.logo }
  },
  datePublished: "2026-06-28",
  dateModified: "2026-06-28",
  description: DESCRIPTION,
  mainEntityOfPage: { "@type": "WebPage", "@id": absolute(SLUG) },
  image: HERO
};

export default function GuidePhotographYourWork() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_JSONLD) }}
      />

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <a
          href="/trade-off/tips"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to all tips
        </a>

        <TopicBadge>Photography</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          A photo is the first thing a customer judges you on. Most
          tradies post photos that look worse than the actual work. Here
          is how to fix that with the phone already in your pocket.
        </p>
        <Byline minutes={6} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="Finished kitchen — the kind of crisp, well-lit shot this guide explains"
          className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
        />

        <Section heading="1. Your phone is enough">
          <p>
            You do not need a DSLR. You do not need to buy a Sony.
            Every iPhone or recent Android takes a better photo than
            most tradesperson photos online. The reason theirs look
            worse isn’t the camera — it’s the light,
            the angle and the dirty lens. Fix those three things and the
            same phone makes the same work look twice as good.
          </p>
        </Section>

        <Section heading="2. Wipe the lens. Every time.">
          <p>
            Your phone has been in your pocket, on a dusty worktop,
            handled with hands that have just touched mortar, sawdust
            and grease. The lens is filthy. The blur most tradies blame
            on their camera is fingerprint smear.
          </p>
          <p>
            Wipe the lens on a clean bit of T-shirt before every photo.
            Not the sleeve of your hoodie. Not your jeans. A clean spot.
            This single habit lifts the quality of every photo you take
            from now until you sell the phone.
          </p>
        </Section>

        <Section heading="3. Light: open everything, turn everything on">
          <p>
            Interior shots fail because the room is too dark. The phone
            cranks up its sensor sensitivity, which makes the image
            grainy and washes out the colour. Before you take an
            interior shot:
          </p>
          <Bullets>
            <li>Open every curtain and blind.</li>
            <li>Turn on every light, including under-cabinet LEDs.</li>
            <li>
              If it’s a sunny day, position so the light comes from
              behind you, not behind the work.
            </li>
            <li>
              On a phone, tap the brightest area of the image to set the
              exposure point. The dark areas will brighten automatically.
            </li>
          </Bullets>
          <p>
            For exterior shots — new fascias, repointing, a
            re-roof — the golden hour wins. The hour after sunrise
            and the hour before sunset gives you warm, low, side-lit
            light that picks out every detail. Midday sun flattens
            everything.
          </p>
        </Section>

        <Section heading="4. Angles: shoot the work, not yourself standing next to it">
          <p>
            Three angles cover 90% of trade photos:
          </p>
          <Bullets>
            <li>
              <strong>Square-on, eye-level</strong> for detail shots
              — a tiled splashback, a repointed wall, a finished
              architrave. Camera parallel to the surface, nothing on a
              tilt.
            </li>
            <li>
              <strong>Low angle</strong> for staircases, columns and
              anything tall. Crouch down. The wider field of view at the
              bottom makes it look more impressive.
            </li>
            <li>
              <strong>Wide / corner</strong> for whole-room shots —
              kitchens, bathrooms, extensions. Stand in the corner of
              the room facing diagonally. You capture more space and
              the room looks bigger.
            </li>
          </Bullets>
        </Section>

        <Section heading="5. Before/after pairs — same frame, every time">
          <p>
            Before/after pairs are the single most powerful piece of
            content a tradesperson can post. The trick: shoot the
            “before” from the exact same spot you intend to
            shoot the “after”. Same angle, same height, same
            zoom level. Drop a pin in your head: “corner of the
            doorway, phone at chest height”. Take the before. When
            the job’s done, stand in the same spot and shoot the
            after.
          </p>
          <p>
            The matched frame makes the transformation legible at a
            glance. If the before is from a different angle, the eye
            does the maths instead of feeling the result.
          </p>
        </Section>

        <Section heading="6. Use the rule of thirds gridline">
          <p>
            Open your phone’s camera settings and turn on the grid.
            It overlays two horizontal and two vertical lines on the
            viewfinder. The trick: put the important thing on one of
            the four intersections, not dead centre.
          </p>
          <p>
            A bathroom basin on the left third with the tiled wall
            behind it. A staircase newel post on the right third with
            the run leading away. Centre composition is what amateurs
            do. The rule of thirds is what makes the same photo look
            like it came from a magazine.
          </p>
        </Section>

        <Section heading="7. Format consistency — pick a style and stick to it">
          <p>
            Look at the top tradesperson accounts on Instagram. The work
            is varied but the <em>look</em> is consistent — same
            crop, same lightness, same colour temperature. That makes
            their feed feel like a brand, not a camera roll.
          </p>
          <p>
            Pick one style and apply it to every photo. Most tradies
            should pick: 4:5 portrait crop (more space on a phone feed),
            slightly increased contrast, slightly warmer white balance,
            no filter. Apply it via the phone’s built-in edit
            screen in twenty seconds before posting.
          </p>
        </Section>

        <Section heading="8. The five-photo habit">
          <p>
            Before you pack the van, take five photos. Wide of the
            finished room. Tight on the bit you’re most proud of.
            One detail (a tiled corner, a clean cut, a flush
            countersunk screw). One showing scale (yourself or a tool
            in the frame). One process shot for Stories. Five photos.
            Two minutes. You will never run out of content to post.
          </p>
        </Section>

        <CaseStudyCallout
          slug="demo-emma-whitfield-plasterer-leeds"
          title="See Emma's work photographed properly →"
          subtitle="Plasterer in Leeds — the gallery is mostly clean before-and-afters and a few clear process shots. The kind of frame this guide is telling you to take."
        />

        <ClosingCta />
      </article>

      <XratedFooter />
    </main>
  );
}

function TopicBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
      style={{ background: XRATED_BRAND.accent }}
    >
      {children}
    </span>
  );
}

function Byline({ minutes }: { minutes: number }) {
  return (
    <p className="mt-4 text-[13px] text-neutral-500">
      {minutes} min read · The xratedtrade.com team
    </p>
  );
}

function Section({
  heading,
  children
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold leading-snug text-neutral-900 sm:text-2xl">
        {heading}
      </h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
        {children}
      </div>
    </section>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-2 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
      {children}
    </ul>
  );
}

function ClosingCta() {
  return (
    <section
      className="mt-12 overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-10"
      style={{ background: "#0A0A0A" }}
    >
      <p
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: XRATED_BRAND.accent }}
      >
        Try Xrated Trades
      </p>
      <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-3xl">
        Free for 14 days. No card. No commission.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80 sm:text-sm">
        Upload your best photos to your Xrated profile. One link customers
        can share, photos that show your real standard.
      </p>
      <a
        href="/trade-off/signup"
        className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
        style={{
          background: XRATED_BRAND.accent,
          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
        }}
      >
        Join XratedTrade
      </a>
    </section>
  );
}
