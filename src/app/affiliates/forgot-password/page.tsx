// Affiliate forgot-password page.
//
// POSTs to /api/affiliates/forgot-password. Either path returns a
// generic success message — we never reveal whether the WhatsApp number
// is on file (timing-side-channel avoidance). The email path
// auto-delivers a Resend link; the no-email path routes through the
// admin queue (admin clicks "Send via WhatsApp" → pre-filled wa.me).
import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { AffiliateForgotPasswordForm } from "./AffiliateForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forgot password | The Network",
  robots: { index: false, follow: false }
};

export default function AffiliateForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Affiliate Programme
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          Reset your password
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-brand-muted">
          Enter the WhatsApp number you registered with. If your account
          has an email on file we&apos;ll email a reset link; otherwise our
          admin team will WhatsApp it to you within 24 hours.
        </p>
        <div className="mt-6">
          <AffiliateForgotPasswordForm />
        </div>
        <p className="mt-6 text-[13px] text-brand-muted">
          <Link
            href="/affiliates/login"
            className="font-semibold text-brand-accent hover:underline"
          >
            Back to log in
          </Link>
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}
