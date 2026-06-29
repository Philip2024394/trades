// Affiliate signup page — WhatsApp + password only.
// All other profile details (name, country, socials) are captured later
// in the dashboard. Keep the friction at sign-up to one form field row.
import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { AffiliateSignupForm } from "./AffiliateSignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join the Affiliate Programme | xratedtrade.com",
  robots: { index: false, follow: false }
};

export default function AffiliateSignupPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Affiliate Programme
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          Create your account
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-brand-muted">
          Two fields — that&apos;s all. You can fill in the rest from your
          dashboard once you&apos;re in.
        </p>
        <div className="mt-8">
          <AffiliateSignupForm />
        </div>
        <p className="mt-6 text-[13px] text-brand-muted">
          Already have an account?{" "}
          <Link
            href="/affiliates/login"
            className="font-semibold text-brand-accent hover:underline"
          >
            Log in
          </Link>
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}
