// /store — Site Interest landing page.
//
// Marketing-quality hero + category grid + featured collection +
// pricing table + FAQ. Optimised as a domain-pointable landing.

import Link from "next/link";
import { storeAllImages, storeTradeCounts } from "@/lib/storeLibrary.server";

export const dynamic = "force-dynamic";

export default async function StoreLandingPage() {
  const [all, trades] = await Promise.all([storeAllImages(), storeTradeCounts()]);
  // Featured — pick 12 with varied trades so the wall reads diverse
  const featured = (() => {
    const seen = new Set<string>();
    const picks: typeof all = [];
    for (const e of all) {
      // Diversity key = first trade tag so the featured wall shows
      // one image per trade before repeating.
      const key = e.trade_slugs[0] ?? e.id;
      if (!seen.has(key) && picks.length < 12) {
        seen.add(key);
        picks.push(e);
      }
    }
    return picks;
  })();

  // Slug → nice display name
  const nice = (s: string) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-b"
        style={{ borderColor: "rgba(0,0,0,0.08)" }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#22C55E" }}/>
              {all.length} images · UK trades
            </div>
            <h1 className="text-[36px] font-black leading-[1.05] tracking-tight text-neutral-900 md:text-[52px]">
              Real UK trade imagery.<br/>
              <span style={{ color: "#B8860B" }}>Rights-clean.</span> Instant.
            </h1>
            <p className="mt-4 max-w-md text-[14px] leading-snug text-neutral-600 md:text-[15px]">
              Hand-curated AI imagery covering construction, plumbing, landscaping and
              finish-trade scenes. Hand-picked by trade, tagged for text overlay,
              licensed for commercial use. Skip the stock-photo hunt.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/store/browse"
                className="inline-flex h-11 items-center rounded-md bg-neutral-900 px-5 text-[12px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
              >
                Browse the library →
              </Link>
              <Link
                href="#pricing"
                className="inline-flex h-11 items-center rounded-md border px-5 text-[12px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
                style={{ borderColor: "rgba(0,0,0,0.12)" }}
              >
                See pricing
              </Link>
            </div>
            {/* Trust strip */}
            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-neutral-500">
              <span>✓ Commercial licence included</span>
              <span>✓ Rights-clean · hand-curated AI</span>
              <span>✓ Instant download</span>
            </div>
          </div>
          {/* Right hero — image mosaic */}
          <div className="relative hidden md:block">
            <div className="grid grid-cols-3 gap-2">
              {featured.slice(0, 6).map((img, i) => (
                <div
                  key={img.id}
                  className={`overflow-hidden rounded-lg border ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                  style={{
                    borderColor:  "rgba(0,0,0,0.08)",
                    aspectRatio:  i === 0 ? "1 / 1" : "1 / 1"
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt} loading="lazy" className="h-full w-full object-cover"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Category strip ──────────────────────────────── */}
      <section className="border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-black text-neutral-900">Browse by trade</h2>
            <Link href="/store/browse" className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
              See all →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {trades.map(({ trade, count }) => (
              <Link
                key={trade}
                href={`/store/browse?trade=${encodeURIComponent(trade)}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black text-neutral-700 transition hover:bg-neutral-50"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                {nice(trade)}
                <span className="text-neutral-400">·</span>
                <span className="tabular-nums text-neutral-500">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured grid ───────────────────────────────── */}
      <section className="border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex items-baseline justify-between gap-2">
            <h2 className="text-[20px] font-black text-neutral-900">Featured this week</h2>
            <Link href="/store/browse" className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {featured.map((img) => (
              <Link
                key={img.id}
                href={`/store/i/${encodeURIComponent(img.id)}`}
                className="group relative overflow-hidden rounded-lg border bg-neutral-100 transition hover:shadow-md"
                style={{ borderColor: "rgba(0,0,0,0.08)", aspectRatio: "9 / 12" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-16 opacity-0 transition group-hover:opacity-100"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
                />
                <div className="absolute bottom-2 left-2 right-2 opacity-0 transition group-hover:opacity-100">
                  <div className="text-[11px] font-black text-white line-clamp-2 drop-shadow-md">
                    {img.alt}
                  </div>
                </div>
                {/* Watermark diagonal */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span
                    className="rotate-[-25deg] text-[11px] font-black uppercase tracking-[0.3em] text-white/40"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                  >
                    Site Interest
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section id="pricing" className="border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Pricing
          </div>
          <h2 className="text-center text-[28px] font-black text-neutral-900 md:text-[36px]">
            Simple licensing.<br className="md:hidden"/> No royalty maze.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[13px] text-neutral-600">
            Buy a single image, save with a pack, or go unlimited. Every purchase
            includes a commercial-use licence. Resale to stock libraries never
            permitted.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {/* Single */}
            <PricingCard
              tier="Single"
              price="£10"
              per="per image"
              cta="Browse to buy"
              href="/store/browse"
              perks={["Full commercial licence", "Instant download", "Watermark-free full-res", "Perpetual licence"]}
            />
            {/* Pack (highlighted) */}
            <PricingCard
              tier="Packs"
              price="From £39"
              per="5 → 50 images"
              cta="Choose a pack"
              href="/store/browse"
              highlighted
              perks={[
                "5 images — £39 (£7.80 each)",
                "10 images — £69 (£6.90 each)",
                "25 images — £149 (£5.96 each)",
                "50 images — £249 (£4.98 each)"
              ]}
            />
            {/* Membership */}
            <PricingCard
              tier="Unlimited"
              price="£29/mo"
              per="or £249/yr"
              cta="Go unlimited"
              href="/store/membership"
              perks={["Unlimited downloads — every image", "All future additions to the library", "All 4 crops — Instagram, Website, Mobile, Full", "Cancel any time"]}
            />
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────── */}
      <section id="faq" className="border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-center text-[24px] font-black text-neutral-900 md:text-[30px]">
            Frequently asked
          </h2>
          <div className="mt-6 space-y-3">
            <FaqItem q="What can I use these images for?">
              Commercial use in marketing, ads, brochures, social media, websites, print
              — anywhere your business needs imagery. Full details in the{" "}
              <Link href="/legal/image-licence" className="underline">licence terms</Link>.
            </FaqItem>
            <FaqItem q="What I CAN'T do?">
              You may not redistribute, resell, or upload our images to any other
              stock library, image marketplace, or wallpaper platform. You may not
              claim ownership of the source image. You may not use them for
              defamatory or misleading purposes.
            </FaqItem>
            <FaqItem q="Are these real photos?">
              No — every image is <span className="font-black">hand-curated AI imagery</span>,
              generated and reviewed in-house by our team, and owned outright by
              Thenetworkers Ltd. That means clean rights, no model releases needed,
              and no third-party photographer credit required. Every image is
              hand-picked for trade-authentic scenes and text-overlay readiness
              before it goes into the library.
            </FaqItem>
            <FaqItem q="What resolution do I get?">
              Portrait 9:16 native (approx 1080 × 1920). Ideal for social,
              mobile hero backgrounds, feed tiles, and vertical print. Wider
              crops available on request.
            </FaqItem>
            <FaqItem q="How does the download work?">
              After payment you receive an email with a secure download link
              (valid 30 days). You keep the licence permanently — download the
              file whenever you need it.
            </FaqItem>
            <FaqItem q="Bulk / agency licences?">
              Yes. Contact us for volume packs, agency licences, or the full-library
              redistributor licence (SaaS platforms embedding the library in their
              own product).
            </FaqItem>
          </div>
        </div>
      </section>

      {/* ── CTA strip ───────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-[24px] font-black text-neutral-900 md:text-[32px]">
            Find your image now
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-neutral-600">
            {all.length} UK-trade scenes across {trades.length} categories. No
            subscription required.
          </p>
          <Link
            href="/store/browse"
            className="mt-6 inline-flex h-12 items-center rounded-md bg-neutral-900 px-6 text-[13px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
          >
            Browse the library →
          </Link>
        </div>
      </section>
    </>
  );
}

function PricingCard({
  tier, price, per, cta, href, perks, highlighted, disabled
}: {
  tier: string;
  price: string;
  per: string;
  cta: string;
  href: string;
  perks: string[];
  highlighted?: boolean;
  disabled?: boolean;
}) {
  const cls = highlighted
    ? "border-2 shadow-lg"
    : "border";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 ${cls} ${highlighted ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"}`}
      style={{ borderColor: highlighted ? "#0A0A0A" : "rgba(0,0,0,0.10)" }}
    >
      {highlighted && (
        <div className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}>
          Best value
        </div>
      )}
      <div className={`text-[10px] font-black uppercase tracking-wider ${highlighted ? "text-neutral-400" : "text-neutral-500"}`}>
        {tier}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className="text-[32px] font-black leading-none">{price}</div>
        <div className={`text-[11px] font-bold ${highlighted ? "text-neutral-400" : "text-neutral-500"}`}>{per}</div>
      </div>
      <ul className="mt-4 space-y-1.5 text-[12px]">
        {perks.map((p) => (
          <li key={p} className={`flex items-start gap-1.5 ${highlighted ? "text-neutral-200" : "text-neutral-700"}`}>
            <span className={highlighted ? "text-yellow-400" : "text-green-600"}>✓</span> {p}
          </li>
        ))}
      </ul>
      <Link
        href={disabled ? "#" : href}
        aria-disabled={disabled}
        className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded-md text-[11px] font-black uppercase tracking-wider transition ${
          disabled
            ? "cursor-not-allowed bg-neutral-800 text-neutral-500"
            : highlighted
              ? "bg-yellow-400 text-neutral-900 hover:opacity-90"
              : "bg-neutral-900 text-white hover:opacity-90"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details
      className="group rounded-lg border p-4 transition"
      style={{ borderColor: "rgba(0,0,0,0.10)" }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-black text-neutral-900">
        {q}
        <span className="text-[16px] text-neutral-400 transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-2 text-[12px] leading-snug text-neutral-600">{children}</div>
    </details>
  );
}
