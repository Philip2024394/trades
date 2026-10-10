// src/app/nex-native/about/page.tsx
//
// NEX-native · public primer page.
// -----------------------------------------------------------------
// Server Component · public (no session required) · works signed-in
// or signed-out. Answers three questions in plain language:
//   · what is NEX
//   · what happens when you send a message
//   · how do you get started (customer vs tradesperson)
//
// The caller's session is only used to swap the wording of the
// bottom CTA. No mock, no marketing-speak, no fabrication. The
// generation engine backend is a NEX implementation detail and is
// deliberately not named or branded on this page.

import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexNativeShell } from "../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();
  const signedIn = Boolean(session);

  return (
    <NexNativeShell>
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 border-b border-neutral-300 pb-4">
        <h1 className="text-lg font-semibold text-neutral-900">
          What is NEX?
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          A quick primer · takes under a minute to read.
        </p>
      </header>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">
          The short version
        </h2>
        <p className="text-sm text-neutral-700">
          NEX is a UK trades platform where you can message a business
          directly. NEX Assistant helps answer questions immediately whilst
          the business owner replies personally when they can.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">
          What happens when you send a message
        </h2>
        <p className="text-sm text-neutral-700">
          Your message goes to the business. NEX Assistant takes a few
          seconds to draft a first reply based on what the business has
          published. The real business owner sees your message too and can
          reply personally.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">
          For customers
        </h2>
        <p className="text-sm text-neutral-700">
          You need a URL to a business (usually shared by the business or
          via QR code). You will be asked to sign in the first time so we
          can save the conversation for later.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">
          For tradespeople
        </h2>
        <p className="text-sm text-neutral-700">
          Set up your NEX business at{" "}
          <Link
            href="/nex-native/onboarding"
            className="font-medium underline"
          >
            /nex-native/onboarding
          </Link>
          {" "}
          · you will get a shareable URL like{" "}
          <code className="font-mono text-xs">/nex-native/your-slug</code>
          {" "}to hand to customers.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">
          What we do not do
        </h2>
        <p className="text-sm text-neutral-700">
          NEX does not send your conversation to a third-party AI service.
          The assistant runs locally on NEX&apos;s own infrastructure. You
          will not see prices we have not been given, and NEX will admit
          when it does not know.
        </p>
      </section>

      <div className="mb-8 rounded border border-neutral-300 bg-neutral-50 p-4">
        <Link
          href="/nex-native/conversations"
          className="inline-flex min-h-[44px] items-center justify-center rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          {signedIn ? "Continue to your conversations" : "Sign in or sign up"}
        </Link>
      </div>

      <footer className="border-t border-neutral-200 pt-3">
        <p className="text-[11px] text-neutral-500">
          NEX-native pilot · early access · not a finished product.
        </p>
      </footer>
    </main>
    </NexNativeShell>
  );
}
