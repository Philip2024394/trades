// Affiliate dashboard — My profile.
//
// Captures: avatar, identity (first/last/company), contact (whatsapp
// read-only + email), full postal address with worldwide country
// dropdown, 280-char bio, and six social handles. Required fields
// (whatsapp + password) remain managed from signup / forgot-password.
//
// Importing the country list from @/lib/worldCountries (not from
// ContactForm.tsx) — ContactForm is `"use client"` and Turbopack
// crashes when a server component imports a non-component value from
// a client file.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { WORLD_COUNTRIES } from "@/lib/worldCountries";
import { ProfileForm } from "./ProfileForm";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

export default async function AffiliateProfilePage() {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const { data: aff } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "first_name, last_name, company_name, country, email, whatsapp, avatar_url, address_line_1, address_line_2, city, postal_code, state_region, bio, website, facebook, instagram, tiktok, youtube, twitter, linkedin"
    )
    .eq("affiliate_id", session.affiliate_id)
    .maybeSingle();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">My profile</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          A complete profile boosts trust on your leaderboard entry and
          white-label landing pages. Only WhatsApp (your login) is fixed —
          everything else is optional.
        </p>
      </header>

      <PageExplainer
        title="How you appear on the leaderboard and your custom landing pages"
        description="A photo, a short bio and your country make you trustworthy. The leaderboard shows the top 10 affiliates this month — fill these in to look real. Your address is private — only we see it for tax records."
        steps={[
          "Add a clear photo of your face — square is best",
          "Pick your country from the worldwide list",
          "Write a 280-character bio about who you are",
          "Add your social handles if you have them"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Public fields (photo, country, bio, socials) appear on the
        leaderboard and your landing pages. Address is private and only
        used for tax records.
      </p>

      <ProfileForm
        countries={WORLD_COUNTRIES.map((c) => ({
          name: c.name,
          flag: c.flag
        }))}
        initial={aff ?? null}
      />
    </div>
  );
}
