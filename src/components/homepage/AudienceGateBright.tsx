// Bright, warm audience-gate hero — image-dominant layout.
//
// The single full-bleed image (Sarah on the ground + trade on the roof)
// fills the viewport with a cream padding frame at the top and sides.
// Copy + CTAs live in a glassmorphic panel overlaid on the bottom third
// of the image, so the picture is the story.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Hammer } from "lucide-react";

const HERO_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsaaassdd.png";

// Design tokens — local until the bright test is fully rolled out.
const PALETTE = {
  cream: "#FBF6EC",
  ink: "#1B1A17",
  honey: "#B8860B",
  honeyBright: "#FFB300",
  frameShadow: "rgba(27,26,23,0.10)"
};

export function AudienceGateBright() {
  return (
    <section
      aria-label="The Construction Notebook"
      className="relative min-h-[100dvh] w-full"
      style={{ backgroundColor: PALETTE.cream, color: PALETTE.ink }}
    >
      {/* Cream padding frame. Adjust these numbers to tune breathing space. */}
      <div className="mx-auto flex min-h-[100dvh] max-w-[1600px] flex-col px-4 pb-4 pt-4 md:px-10 md:pb-8 md:pt-6">
        {/* Ribbon + sign-in strip */}
        <header className="mb-3 flex items-center justify-between md:mb-5">
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: PALETTE.honey }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: PALETTE.honeyBright }}
            />
            The Construction Notebook
          </div>
          <div className="flex items-center gap-3 text-[13px] font-semibold">
            <Link
              href="/why"
              className="hidden underline-offset-4 hover:underline sm:inline"
              style={{ color: PALETTE.ink }}
            >
              Why Notebook
            </Link>
            <Link
              href="/home/sign-in"
              className="rounded-full border-2 px-4 py-1.5 hover:bg-[rgba(27,26,23,0.05)]"
              style={{ borderColor: PALETTE.ink, color: PALETTE.ink }}
            >
              Sign in
            </Link>
          </div>
        </header>

        {/* Image frame — grows to fill remaining height. */}
        <div
          className="relative flex-1 overflow-hidden rounded-[28px] md:rounded-[36px]"
          style={{
            boxShadow: `0 40px 80px -30px ${PALETTE.frameShadow}, 0 12px 32px -12px ${PALETTE.frameShadow}`
          }}
        >
          <Image
            src={HERO_IMAGE}
            alt="A homeowner at ground level with her tradesperson working on the roof — the construction notebook connects them."
            fill
            priority
            sizes="(min-width: 768px) 100vw, 100vw"
            className="object-cover"
          />

          {/* Bottom dark gradient so overlaid copy is legible without dulling the top of the image. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%]"
            style={{
              background:
                "linear-gradient(to top, rgba(20,17,10,0.78) 0%, rgba(20,17,10,0.55) 42%, rgba(20,17,10,0) 100%)"
            }}
          />

          {/* Copy + CTAs overlaid on the image */}
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-10 lg:p-14">
            <div className="mx-auto max-w-[880px]">
              <h1
                className="font-black leading-[0.98] tracking-tight text-white"
                style={{ fontSize: "clamp(30px, 5.6vw, 68px)" }}
              >
                Every project.<br />
                Every site.<br />
                <span style={{ color: PALETTE.honeyBright }}>On the record.</span>
              </h1>

              <p
                className="mt-5 max-w-[46ch] text-[15px] leading-[1.55] md:text-[17px]"
                style={{ color: "rgba(255,247,229,0.85)" }}
              >
                A construction notebook Britain&apos;s homes and trades share.
                Photos, materials, warranties, and every trade you worked with —
                recorded for the life of the property.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/project/start"
                  className="group inline-flex min-h-[56px] items-center justify-between gap-3 rounded-full pl-6 pr-4 text-[15px] font-bold shadow-lg transition hover:shadow-xl"
                  style={{
                    backgroundColor: PALETTE.honeyBright,
                    color: PALETTE.ink
                  }}
                >
                  <span className="flex flex-col text-left leading-tight">
                    <span
                      className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
                      style={{ color: "rgba(27,26,23,0.65)" }}
                    >
                      For project owners
                    </span>
                    <span>Submit your project</span>
                  </span>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5"
                    style={{ backgroundColor: PALETTE.ink, color: PALETTE.cream }}
                    aria-hidden
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>

                <Link
                  href="/join/start"
                  className="group inline-flex min-h-[56px] items-center justify-between gap-3 rounded-full border-2 pl-6 pr-4 text-[15px] font-bold text-white transition hover:bg-white/10"
                  style={{ borderColor: "rgba(255,247,229,0.55)" }}
                >
                  <span className="flex flex-col text-left leading-tight">
                    <span
                      className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
                      style={{ color: "rgba(255,247,229,0.55)" }}
                    >
                      For trades
                    </span>
                    <span>Join as a trade</span>
                  </span>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5"
                    style={{
                      backgroundColor: PALETTE.honeyBright,
                      color: PALETTE.ink
                    }}
                    aria-hidden
                  >
                    <Hammer className="h-4 w-4" />
                  </span>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-[12px] font-semibold">
                <Link
                  href="/trade/sample-notebook"
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                  style={{ color: PALETTE.honeyBright }}
                >
                  See a sample Notebook
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
                <span
                  aria-hidden
                  style={{ color: "rgba(255,247,229,0.35)" }}
                >
                  ·
                </span>
                <Link
                  href="/foreman"
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                  style={{ color: "rgba(255,247,229,0.85)" }}
                >
                  For foremen &amp; builders
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
                <span
                  aria-hidden
                  style={{ color: "rgba(255,247,229,0.35)" }}
                >
                  ·
                </span>
                <span style={{ color: "rgba(255,247,229,0.55)" }}>
                  No account required · UK · Free forever for trades
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
