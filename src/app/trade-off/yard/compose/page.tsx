// /trade-off/yard/compose?kind=X&slug=Y&token=Z
//
// Server shell. Reads the magic-link (slug + edit_token) from query
// params, resolves the listing, and hands it to the client composer.
// Missing / bad auth renders a helpful error with a link to the edit
// dashboard where trades can grab a fresh URL.

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";
import { ComposeForm } from "./ComposeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post to The Yard · XRatedTrade",
  robots: { index: false, follow: false }
};

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export default async function YardComposePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const compose =
    Array.isArray(sp.compose) ? sp.compose[0] : sp.compose ?? "";
  const initialKind =
    Array.isArray(sp.kind) ? sp.kind[0] : sp.kind ?? compose ?? "";
  const slug = Array.isArray(sp.slug) ? sp.slug[0] : sp.slug ?? "";
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token ?? "";
  const initialTitle =
    Array.isArray(sp.title) ? sp.title[0] : sp.title ?? "";
  const initialBody =
    Array.isArray(sp.body) ? sp.body[0] : sp.body ?? "";
  const initialRegion =
    Array.isArray(sp.region) ? sp.region[0] : sp.region ?? "";

  // Two auth paths — magic-link URL params (canonical, used by
  // notification emails and deep-link buttons), OR the persistent
  // signed session cookie (dashboard sessions). Either path lands
  // the same ComposeForm; the API endpoints re-verify slug + token
  // constant-time so passing edit_token through the client is safe.
  let listing:
    | {
        id: string;
        slug: string;
        display_name: string;
        edit_token: string;
        primary_trade: string;
        city: string | null;
        country: string | null;
        status: string;
        tier: string | null;
      }
    | null = null;
  let effectiveSlug = slug;
  let effectiveToken = token;

  if (slug && token) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, edit_token, primary_trade, city, country, status, tier"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (data && constantTimeEq(data.edit_token, token)) listing = data;
  }

  // Fallback — signed session cookie (same cookie the /trade-off/edit
  // dashboard uses). Signed HMAC, so trust the payload and just look up
  // the listing to fetch its edit_token for downstream API calls.
  if (!listing) {
    const jar = await cookies();
    const sessionRaw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
    const session = verifyTradeSession(sessionRaw);
    if (session) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select(
          "id, slug, display_name, edit_token, primary_trade, city, country, status, tier"
        )
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data) {
        listing = data;
        effectiveSlug = data.slug;
        effectiveToken = data.edit_token;
      }
    }
  }

  const authed = Boolean(listing && listing.status === "live");

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 md:px-8 md:pt-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/trade-off/yard"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            ← The Yard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#FFB300" }}
            />
            Post to The Yard
          </span>
        </div>

        {!authed ? (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-6 shadow-sm">
            <h1 className="text-[22px] font-black leading-tight text-[#1B1A17]">
              Sign-in required
            </h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#1B1A17]/75">
              Posting to The Yard uses your listing&apos;s secure magic
              link. Grab a fresh compose URL from your dashboard —
              we&apos;ll ping the composer straight open.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={
                  effectiveSlug
                    ? `/trade-off/edit/${effectiveSlug}?next=yard-compose`
                    : "/trade-off/signup?next=yard-compose"
                }
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-5 text-[13px] font-extrabold text-neutral-900 shadow-md"
                style={{ background: "#FFB300" }}
              >
                Open my dashboard →
              </a>
              <Link
                href="/trade-off/yard"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#1B1A17]/15 bg-white px-5 text-[13px] font-semibold text-[#1B1A17] hover:bg-white/70"
              >
                Back to The Yard
              </Link>
            </div>
          </div>
        ) : (
          <ComposeForm
            slug={listing!.slug}
            editToken={effectiveToken}
            displayName={listing!.display_name}
            primaryTrade={listing!.primary_trade}
            initialCity={initialRegion || listing!.city || ""}
            initialCountry={listing!.country ?? "UK"}
            initialKind={initialKind}
            tier={listing!.tier ?? "standard"}
            initialTitle={initialTitle}
            initialBody={initialBody}
          />
        )}
      </div>
    </main>
  );
}
