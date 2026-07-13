// Affiliate login page — WhatsApp + password.
import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { AffiliateLoginForm } from "./AffiliateLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Affiliate log in | The Network",
  robots: { index: false, follow: false }
};

export default function AffiliateLoginPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Affiliate Programme
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          Log in
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-brand-muted">
          Use the WhatsApp number you signed up with and your password.
        </p>
        <div className="mt-8">
          <AffiliateLoginForm />
        </div>
        <div className="mt-6 flex flex-col gap-3 text-[13px] text-brand-muted sm:flex-row sm:justify-between">
          <Link
            href="/affiliates/signup"
            className="font-semibold text-brand-accent hover:underline"
          >
            Need an account? Sign up
          </Link>
          <Link
            href="/affiliates/forgot-password"
            className="font-semibold hover:text-brand-text hover:underline"
          >
            Forgot password
          </Link>
        </div>
      </section>
      <XratedFooter />
    </main>
  );
}
