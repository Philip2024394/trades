"use client";

// Services grid for the public trade profile.
//
// 4 (or fewer) service cards in a 2×2 grid on mobile, 4-column on
// desktop. Each card has an image, name, a 2-line description, and a
// View button. Clicking View opens a modal with a yellow rim, the full
// image, description, and two actions: Close (dark red) + Enquire
// (opens WhatsApp).

import { useEffect, useState } from "react";
import Image from "next/image";

type ServiceItem = {
  title: string;
  description: string;
  imageUrl: string;
};

// Curated service artwork by primary_trade — falls back to a neutral
// construction shot when the trade has no bespoke image.
const FALLBACK_IMAGE =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-app-banner-drywaller.png";

// Very small descriptor mapper so the "2 lines each" copy has actual
// substance without the tradesperson having to write it themselves.
// Keys are the raw string from services_offered — lower-cased. If a
// key isn't in the map we surface a generic on-brand fallback.
const DESCRIPTIONS: Record<string, string> = {
  "kitchen fit-out":
    "Full strip, plumbing prep, carcass build and worktop fit. Warranty on labour + fixtures.",
  "staircase build":
    "Cut-string, closed-string or open riser. Bespoke handrails and spindles to the room.",
  "fitted joinery":
    "Wardrobes, alcove units, boot rooms. Made in the workshop, fitted on site.",
  "wardrobe carcass":
    "Solid-back carcass build with soft-close hinges. Painted or veneer options.",
  "worktop cut & scribe":
    "Solid oak, laminate, quartz and stone worktop cut, scribe, template and fit.",
  "door hanging":
    "Firedoors, panel, ledged and braced. Machined for hinges and locks in-workshop."
};

function pickImage(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // ImageKit hosts a small set of construction stock we already use
  // elsewhere. If a bespoke asset exists per slug we could swap in
  // later; for now we vary the falling-back image on a hash of the
  // service name so the grid isn't all identical.
  const bank = [
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsaaassdd.png",
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsaaass.png",
    "https://ik.imagekit.io/9mrgsv2rp/sasdasdwqw.png",
    "https://ik.imagekit.io/9mrgsv2rp/Untitleddfsdfzzdsfsdffsddsddsfddfffdf.png"
  ];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return bank[Math.abs(hash) % bank.length] || FALLBACK_IMAGE;
}

function describe(title: string): string {
  return (
    DESCRIPTIONS[title.toLowerCase()] ??
    "Fixed-price quote after a site visit. Materials + labour on the record."
  );
}

export function ServicesGrid({
  services,
  waUrl
}: {
  services: string[] | null | undefined;
  waUrl: string;
}) {
  const items: ServiceItem[] = (services ?? []).slice(0, 4).map((s) => ({
    title: s,
    description: describe(s),
    imageUrl: pickImage(s)
  }));

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const open = openIdx != null ? items[openIdx] ?? null : null;

  // Lock body scroll when modal is open.
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIdx(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Our Services
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {items.map((item, i) => (
          <article
            key={item.title + i}
            className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_10px_30px_-16px_rgba(0,0,0,0.20)]"
          >
            <div className="relative aspect-square w-full bg-neutral-100">
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                sizes="(min-width: 768px) 22vw, 45vw"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex flex-1 flex-col p-3">
              <h3 className="text-[14px] font-extrabold leading-tight text-neutral-900 sm:text-[15px]">
                {item.title}
              </h3>
              <p
                className="mt-1 text-[12px] leading-[1.4] text-neutral-600"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}
              >
                {item.description}
              </p>
              <button
                type="button"
                onClick={() => setOpenIdx(i)}
                className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-1 rounded-lg text-[12px] font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98]"
                style={{ background: "#FFB300" }}
              >
                View
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Modal — yellow rim, image with a top-right X close button. */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.72)" }}
          onClick={() => setOpenIdx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white"
            style={{
              border: "3px solid #FFB300",
              boxShadow:
                "0 30px 60px -20px rgba(0,0,0,0.5), 0 0 0 6px rgba(255,179,0,0.18)"
            }}
          >
            <div className="relative aspect-[16/10] w-full bg-neutral-100">
              <Image
                src={open.imageUrl}
                alt={open.title}
                fill
                sizes="(min-width: 768px) 500px, 100vw"
                className="object-cover"
                unoptimized
              />
              {/* Top-right X close button — sits on top of the image */}
              <button
                type="button"
                onClick={() => setOpenIdx(null)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition active:scale-[0.95] hover:scale-105"
                style={{
                  background: "#8B0F0F",
                  border: "2px solid rgba(255,255,255,0.85)"
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <h3 className="text-[20px] font-black leading-tight text-neutral-900 sm:text-[24px]">
                {open.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.55] text-neutral-700 sm:text-[15px]">
                {open.description}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
