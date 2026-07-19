// /[slug] — root-level catch-all for homeowner SiteBook URLs.
//
// Every homeowner's SiteBook lives at thenetworkers.app/{slug} —
// short and personal. Merchants live at /trade/{slug} (different
// namespace, no collision).
//
// Next.js resolves static routes FIRST (/find, /about, /admin etc.),
// then falls to this catch-all only if the slug isn't a reserved
// top-level route. Reserved-slug blacklist in src/lib/homeowners/slug.ts
// prevents homeowners from picking a shadowing name at signup.
//
// If the slug doesn't match any homeowner → notFound().
// If the visitor IS the owner (session cookie matches) → redirect to /sitebook.

import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import type { Homeowner } from "@/lib/homeowners/types";
import { BookOpen, Lock, Smartphone, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("house_nickname")
    .ilike("slug", slug)
    .maybeSingle();
  const nickname = (res.data as { house_nickname: string } | null)?.house_nickname;
  return {
    title:   nickname ? `SiteBook · ${nickname}` : "SiteBook · Private",
    robots:  { index: false, follow: false }
  };
}

export default async function HomeownerSlugPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const res = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, house_nickname, slug, first_name, city, created_at")
    .ilike("slug", slug)
    .maybeSingle();

  const owner = res.data as Pick<Homeowner, "id" | "house_nickname" | "slug" | "first_name" | "city" | "created_at"> | null;
  if (!owner) notFound();

  const currentUser = await getHomeownerFromCookie();
  if (currentUser?.id === owner.id) redirect("/sitebook");

  const yearsActive = (() => {
    const created = new Date(owner.created_at).getTime();
    const yrs = (Date.now() - created) / (365.25 * 24 * 60 * 60 * 1000);
    if (yrs < (1 / 52)) return "New this week";
    if (yrs < 1)        return `SiteBook since ${new Date(owner.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long" })}`;
    return `${Math.floor(yrs)} year${Math.floor(yrs) === 1 ? "" : "s"} on SiteBook`;
  })();

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="rounded-3xl border-2 bg-white p-8 shadow-lg sm:p-10" style={{ borderColor: BRAND_YELLOW }}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
              <BookOpen size={22} strokeWidth={2.4} className="text-neutral-900"/>
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">SiteBook</p>
              <p className="text-[11.5px] font-bold text-neutral-500">thenetworkers.app/{owner.slug}</p>
            </div>
          </div>

          <h1 className="mt-6 text-4xl font-black leading-tight text-neutral-900 sm:text-5xl">
            {owner.house_nickname}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2 text-[10.5px] font-black uppercase tracking-wider">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
              <Lock size={11}/> Private
            </span>
            {owner.city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                {owner.city}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
              {yearsActive}
            </span>
          </div>

          <p className="mt-6 text-[14px] leading-relaxed text-neutral-700">
            This is a private SiteBook. Projects, photos, quotes, warranties and messages are only visible to <span className="font-black text-neutral-900">{owner.first_name || "the owner"}</span> and any trades they&rsquo;ve invited.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/homeowners/login?next=${encodeURIComponent(`/${owner.slug}`)}`}
              className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              Log in as owner
              <ArrowRight size={14}/>
            </Link>
            <Link
              href="/homeowners"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 text-[12px] font-bold uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
            >
              Start my own SiteBook
            </Link>
          </div>

          {/* Install-PWA prompt */}
          <div className="mt-8 rounded-2xl border-2 p-5" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
            <div className="flex items-center gap-2">
              <Smartphone size={16} strokeWidth={2.4} style={{ color: BRAND_YELLOW }}/>
              <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Install the SiteBook app</p>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
              Add SiteBook to your phone&rsquo;s home screen — one tap to your projects, push notifications for messages + warranty reminders. Works offline.
            </p>
            <p className="mt-2 text-[11px] text-neutral-500">
              <span className="font-black">iPhone:</span> Tap Share → Add to Home Screen.
              <span className="ml-2 font-black">Android:</span> Tap ⋮ → Add to Home Screen.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-md text-center text-[11px] leading-snug text-neutral-500">
          Every homeowner on Thenetworkers has a private SiteBook at thenetworkers.app/{"{yourname}"}. Free forever. Your data belongs to you.
        </p>
      </section>

      <XratedFooter/>
    </main>
  );
}
