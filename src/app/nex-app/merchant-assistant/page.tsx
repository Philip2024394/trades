// NEX Merchant Assistant — page shell.
//
// Session-gated: shows the chat UI when a merchant is signed in,
// otherwise shows a sign-in prompt. The tool executors do their own
// ownership re-checks — this page-level gate is just for UX so we
// don't render a chat surface to nobody.
//
// Phase 7 · Increment 2. Full merchant-shell layout (nav, sidebar,
// analytics strip) arrives with Increment 7 polish.

import Link from "next/link";
import { loadMerchantContextFromSession } from "@/lib/nex/merchant-assistant/contextLoader";
import { MerchantAssistantChat } from "@/components/nex-app/merchant-assistant/MerchantAssistantChat";

export const dynamic = "force-dynamic";

export default async function NexMerchantAssistantPage() {
  const ctx = await loadMerchantContextFromSession();

  if (!ctx) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-black">
          NEX Merchant Assistant
        </h1>
        <p className="mt-2 text-sm text-black/60">
          Sign in as a merchant to talk to NEX about your products.
        </p>
        <Link
          href="/tc/sign-in"
          className="mt-6 rounded-full bg-black px-5 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return <MerchantAssistantChat />;
}
