// SmartVisitorHook — thin server component that classifies the
// visitor from Referer + UTM + ?q= and renders a face-appropriate
// hook strip at the very top of the landing page.
//
// Renders NULL for `default` face (no signal) so first-time visitors
// with clean URLs see nothing extra — the existing hero handles them.
// Only surfaces when we have confidence: a homeowner searched for a
// trade, a designer arrived from Pinterest, a merchant came via a
// referral link, etc.
//
// Because it's a server component, the correct hook is in the SSR'd
// HTML — Google sees the default face (no signal), real visitors see
// whichever face their signal maps to. No client-side flash.

import { headers, cookies } from "next/headers";
import Link from "next/link";
import { classifyVisitor, FACE_HOOKS, type VisitorFace } from "@/lib/visitorIntent";
import { MREF_COOKIE } from "@/lib/merchantReferrals";

export async function SmartVisitorHook({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const h       = await headers();
  const jar     = await cookies();
  const referer = h.get("referer");

  // Merge the mref cookie into searchParams as `ref` so classifyVisitor
  // treats a returning referred visitor as the `merchant` face even
  // when they don't have ?mref= in the current URL. Explicit URL params
  // still win (they overwrite the cookie value).
  const mergedParams: Record<string, string | string[] | undefined> = { ...(searchParams ?? {}) };
  const mrefCookie = jar.get(MREF_COOKIE)?.value;
  if (mrefCookie && !mergedParams["ref"] && !mergedParams["mref"]) {
    mergedParams["ref"] = mrefCookie;
  }

  const ctx = classifyVisitor({
    referer,
    searchParams: mergedParams
  });

  // Silent for no-signal + returning-default users. First-time visitors
  // with a clean URL get the existing hero.
  if (ctx.face === "default") return null;

  const hook = FACE_HOOKS[ctx.face];
  const tone = FACE_TONES[ctx.face];

  return (
    <div
      className="w-full border-b"
      style={{ backgroundColor: tone.bg, borderColor: tone.border }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: tone.eyebrow }}>
            {hook.eyebrow}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-bold" style={{ color: tone.title }}>
            {hook.title}
          </p>
        </div>
        <Link
          href={hook.ctaHref}
          className="inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[11px] font-black uppercase tracking-wider transition"
          style={{ backgroundColor: tone.cta, color: tone.ctaText }}
        >
          {hook.ctaLabel} →
        </Link>
      </div>
    </div>
  );
}

/** Per-face tonal styling. Homeowners get the calm brand off-white;
 *  trades get an amber "join" tint; B2B gets a store-store dark strip;
 *  merchant referrals get a green "welcome" tint. Contrast-checked
 *  against WCAG AA — same tokens brand tokens the rest of the app uses. */
const FACE_TONES: Record<Exclude<VisitorFace, "default">, {
  bg:       string;
  border:   string;
  eyebrow:  string;
  title:    string;
  cta:      string;
  ctaText:  string;
}> = {
  homeowner: {
    bg:      "#FBF6EC",
    border:  "rgba(0,0,0,0.08)",
    eyebrow: "#B8860B",
    title:   "#0A0A0A",
    cta:     "#166534",
    ctaText: "#FFFFFF"
  },
  trade: {
    bg:      "#FFF7DB",
    border:  "rgba(184,134,11,0.20)",
    eyebrow: "#7A5B00",
    title:   "#0A0A0A",
    cta:     "#FFB300",
    ctaText: "#0A0A0A"
  },
  "b2b-image": {
    bg:      "#0A0A0A",
    border:  "rgba(255,179,0,0.30)",
    eyebrow: "#FFB300",
    title:   "#FFFFFF",
    cta:     "#FFB300",
    ctaText: "#0A0A0A"
  },
  merchant: {
    bg:      "#ECFDF5",
    border:  "rgba(22,101,52,0.20)",
    eyebrow: "#166534",
    title:   "#0A0A0A",
    cta:     "#166534",
    ctaText: "#FFFFFF"
  }
};
