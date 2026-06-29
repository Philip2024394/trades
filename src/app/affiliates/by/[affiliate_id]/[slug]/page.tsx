// Public white-label affiliate landing page.
//
// Route: /affiliates/by/<affiliate_id>/<slug>
//
// Loads the landing-page row, renders title + tagline + hero image +
// markdown body, and a CTA pointing at /trade-off/signup?ref=<id>.
// The xrated_affiliate_ref cookie is dropped server-side on first
// hit (and refreshed every hit) so attribution persists even when
// the visitor opens the CTA in a new tab. Markdown is rendered with
// a minimal safe-subset converter — no third-party dep.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const AFFILIATE_REF_COOKIE = "xrated_affiliate_ref";
const AFFILIATE_REF_MAX_AGE = 60 * 60 * 24 * 30;

type Params = Promise<{ affiliate_id: string; slug: string }>;

type LandingRow = {
  id: string;
  affiliate_id: number;
  slug: string;
  title: string;
  tagline: string | null;
  cta_text: string;
  hero_image_url: string | null;
  body_markdown: string | null;
};

async function loadPage(
  affiliateId: number,
  slug: string
): Promise<LandingRow | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_landing_pages")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .eq("slug", slug)
    .maybeSingle();
  return (data as LandingRow | null) ?? null;
}

async function loadAffiliateProfile(
  affiliateId: number
): Promise<{ avatar_url: string | null; bio: string | null }> {
  const { data } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("avatar_url, bio")
    .eq("affiliate_id", affiliateId)
    .maybeSingle();
  return {
    avatar_url: data?.avatar_url ?? null,
    bio: data?.bio ?? null
  };
}

export async function generateMetadata({
  params
}: {
  params: Params;
}): Promise<Metadata> {
  const { affiliate_id, slug } = await params;
  const aid = Number(affiliate_id);
  if (!Number.isFinite(aid)) {
    return { title: "Affiliate page | xratedtrade.com" };
  }
  const page = await loadPage(aid, slug);
  if (!page) {
    return { title: "Affiliate page | xratedtrade.com" };
  }
  const profile = await loadAffiliateProfile(aid);
  return {
    title: `${page.title} | xratedtrade.com`,
    description: page.tagline ?? profile.bio ?? undefined,
    robots: { index: false, follow: true }
  };
}

// Tiny markdown-ish renderer — supports paragraphs, bold, italic,
// links, and bulleted lists. HTML in body_markdown is escaped first.
function renderMarkdown(input: string): string {
  const esc = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const inline = (s: string): string =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)/g,
        '<a href="$2" class="text-brand-accent hover:underline">$1</a>'
      );
  const blocks: string[] = [];
  let buf: string[] = [];
  let list: string[] = [];
  for (const raw of esc.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      if (buf.length) {
        blocks.push(`<p class="text-[13px] leading-relaxed">${inline(buf.join(" "))}</p>`);
        buf = [];
      }
      list.push(`<li class="text-[13px] leading-relaxed">${inline(line.slice(2))}</li>`);
      continue;
    }
    if (list.length) {
      blocks.push(`<ul class="list-disc space-y-1 pl-5">${list.join("")}</ul>`);
      list = [];
    }
    if (!line) {
      if (buf.length) {
        blocks.push(`<p class="text-[13px] leading-relaxed">${inline(buf.join(" "))}</p>`);
        buf = [];
      }
      continue;
    }
    buf.push(line);
  }
  if (buf.length) {
    blocks.push(`<p class="text-[13px] leading-relaxed">${inline(buf.join(" "))}</p>`);
  }
  if (list.length) {
    blocks.push(`<ul class="list-disc space-y-1 pl-5">${list.join("")}</ul>`);
  }
  return blocks.join("");
}

export default async function AffiliateWhiteLabelPage({
  params
}: {
  params: Params;
}) {
  const { affiliate_id, slug } = await params;
  const aid = Number(affiliate_id);
  if (!Number.isFinite(aid) || aid <= 0) notFound();

  const page = await loadPage(aid, slug);
  if (!page) notFound();

  // Pull the affiliate's avatar + bio. Bio falls back into the hero
  // tagline when the landing page hasn't set its own, so a fresh
  // affiliate gets a personal hero block without editing markdown.
  const profile = await loadAffiliateProfile(aid);
  const heroLine = page.tagline ?? profile.bio ?? null;

  // Drop / refresh the affiliate_ref cookie on every visit. Server
  // component cookie write is allowed in Next 15+ via cookies().set.
  try {
    const jar = await cookies();
    jar.set(AFFILIATE_REF_COOKIE, String(aid), {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AFFILIATE_REF_MAX_AGE
    });
  } catch {
    // cookies().set is unavailable during static prerender — safe to
    // skip; the middleware refreshes the cookie on the next nav.
  }

  const ctaHref = `/trade-off/signup?ref=${aid}`;
  const bodyHtml = page.body_markdown ? renderMarkdown(page.body_markdown) : "";

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-12">
        {page.hero_image_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={page.hero_image_url}
            alt={page.title}
            className="mb-6 w-full rounded-xl border border-brand-line object-cover"
          />
        )}
        <div className="flex items-start gap-4">
          {profile.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full border border-brand-line object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              {page.title}
            </h1>
            {heroLine && (
              <p className="mt-3 text-[13px] leading-relaxed text-brand-muted sm:text-base">
                {heroLine}
              </p>
            )}
          </div>
        </div>
        {bodyHtml && (
          <div
            className="prose prose-invert mt-6 max-w-none space-y-4 text-brand-text"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}
        <div className="mt-8">
          <Link
            href={ctaHref}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-accent px-6 text-[13px] font-bold text-black transition hover:opacity-90"
          >
            {page.cta_text}
          </Link>
        </div>
        <p className="mt-10 border-t border-brand-line pt-4 text-[13px] text-brand-muted">
          Promoted by Affiliate #{aid} via the Xrated Trades Affiliate
          Programme.
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}
