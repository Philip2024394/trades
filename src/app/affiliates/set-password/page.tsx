// /affiliates/set-password — recovery landing page.
//
// Mirrors /trade-off/set-password but only handles the recovery flow:
// affiliates' password_hash is set on signup, so there's no legacy
// edit-token path. The page expects ?wa=<digits>&recovery_code=<8char>.
import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset affiliate password | The Network",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{
  wa?: string | string[];
  recovery_code?: string | string[];
}>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : "";
  return typeof v === "string" ? v : "";
}

export default async function AffiliateSetPasswordPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const wa = first(sp.wa);
  const recoveryCode = first(sp.recovery_code).trim();

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Affiliate Programme
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          Set a new password
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-brand-muted">
          Your recovery code is pre-filled. Enter your WhatsApp number and
          pick a new password.
        </p>
        <div className="mt-8">
          <SetPasswordForm
            initialWhatsapp={wa}
            recoveryCode={recoveryCode}
          />
        </div>
      </section>
      <XratedFooter />
    </main>
  );
}
