// /home/sign-in — homeowner enters email to receive a magic link.
//
// Cream landing-theme palette: bg #FBF6EC, ink #1B1A17, amber accent
// #FFB300. Two-column at desktop (banner left, form right), stacked on
// mobile with the banner as a top hero. Matches the /trade-off landing
// so the moment a homeowner arrives from the marketing surface nothing
// visually shifts.

import { redirect } from "next/navigation";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sign in — Thenetworkers",
  robots: { index: false, follow: false }
};

const SIGN_IN_BANNER =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2011_58_43%20PM.png";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const party = await loadHomeownerSession();
  if (party) redirect("/home");
  const sp = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC] text-[#1B1A17] lg:flex-row">
      {/* Banner column — full-bleed hero. Taller on mobile so the image
          doesn't crop the subject; wider on desktop for a 55/45 split. */}
      <aside
        className="relative isolate h-72 w-full overflow-hidden sm:h-96 lg:h-auto lg:w-[55%] lg:min-h-screen"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SIGN_IN_BANNER}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 30%" }}
        />
        {/* Rich gradient — darker at top-left for the brand mark, darker
            at bottom for the tagline. Middle stays light so the image
            reads. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,0.1) 35%, rgba(10,10,10,0.15) 65%, rgba(10,10,10,0.75) 100%)"
          }}
        />

        {/* Bottom-left hero copy */}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-12">
          <div className="max-w-lg">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFB300] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#0A0A0A] shadow-md">
              Property Operating System
            </p>
            <h2 className="text-[26px] font-black leading-[1.05] text-white drop-shadow-lg sm:text-[34px] lg:text-[42px]">
              The trades network. On your phone.
            </h2>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/90 drop-shadow-md sm:text-[14px]">
              The construction record that stays with your property.
            </p>
          </div>
        </div>
      </aside>

      {/* Form column — cream bg, refined vertical rhythm */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0A0A0A]/10 bg-white px-3 py-1 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#166534" }}/>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A0A0A]/70">Secure sign in</span>
            </div>
            <h1 className="text-[32px] font-black leading-[1.05] text-[#0A0A0A] sm:text-[42px]">
              Welcome back.
            </h1>
            <p className="mt-3 max-w-[44ch] text-[14px] leading-[1.55] text-[#1B1A17]/70">
              Sign in with your email to open your property, projects, quotes, and documents.
            </p>
          </div>

          <SignInForm errorParam={sp.error} nextParam={sp.next} />

          {/* Trust strip — simple, honest signals */}
          <div className="mt-8 grid grid-cols-3 gap-2 border-t border-[#0A0A0A]/10 pt-6">
            <div className="text-center">
              <div className="text-[11px] font-black uppercase tracking-wider text-[#0A0A0A]/70">Encrypted</div>
              <div className="mt-0.5 text-[10px] text-[#1B1A17]/50">Magic link only</div>
            </div>
            <div className="text-center border-x border-[#0A0A0A]/10">
              <div className="text-[11px] font-black uppercase tracking-wider text-[#0A0A0A]/70">Free</div>
              <div className="mt-0.5 text-[10px] text-[#1B1A17]/50">No card</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-black uppercase tracking-wider text-[#0A0A0A]/70">Portable</div>
              <div className="mt-0.5 text-[10px] text-[#1B1A17]/50">Yours forever</div>
            </div>
          </div>

          <p className="mt-6 text-[11.5px] leading-snug text-[#1B1A17]/50">
            One place your property lives. Everything else updates from here.
          </p>
        </div>
      </section>
    </div>
  );
}
