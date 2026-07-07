// /xrated-trades-images/success — post-checkout landing.
//
// Payment ground-truth lives in the Stripe webhook. This page is UX
// only — a happy confirmation, the licence id, and links to the
// image + the "my licences" dashboard.

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

type PageProps = {
  searchParams: Promise<{ license?: string; session_id?: string }>;
};

export default async function SuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <h1 className="mt-3 text-2xl font-bold text-neutral-900">
        Payment received
      </h1>
      <p className="mt-1 text-[13px] text-neutral-700">
        Your licence is being provisioned. If you paid as a merchant, your
        site&apos;s hero already shows the clean version. If you paid as
        an external buyer, your download link is on its way to your email.
      </p>
      {sp.license ? (
        <p className="mt-3 text-[11px] text-neutral-500">
          Licence id: <code>{sp.license}</code>
        </p>
      ) : null}
      <div className="mt-6 flex flex-col items-center gap-2">
        <Link
          href="/xrated-trades-images"
          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition hover:bg-neutral-50"
        >
          Back to image library
        </Link>
      </div>
    </main>
  );
}
