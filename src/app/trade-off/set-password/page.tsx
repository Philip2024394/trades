// First-login / claim-account page. Two entry paths:
//
//   1. Legacy tradespeople (those who signed up before password auth
//      shipped) — they prove ownership with their original edit_token.
//
//   2. Forgot-password reset — they land here from the admin's
//      WhatsApp message with ?wa=<digits>&recovery_code=<8char>. The
//      recovery_code is pre-filled (hidden) and the edit_token input
//      is hidden too — the recovery_code IS the auth primitive on
//      this path.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set your password | xratedtrade.com",
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

export default async function SetPasswordPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const wa = first(sp.wa);
  const recoveryCode = first(sp.recovery_code).trim();
  const isRecovery = recoveryCode.length > 0;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          xratedtrade.com
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          {isRecovery ? "Reset your password" : "Set your password"}
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-brand-muted">
          {isRecovery
            ? "Your recovery code is pre-filled. Enter the WhatsApp number on your listing and pick a new password."
            : "One-time setup. Use your WhatsApp number and the token from the original signup email — then pick a password you'll remember."}
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
