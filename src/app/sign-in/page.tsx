// /sign-in — canonical sign-in page.
//
// Single page for every user type: customers (homeowners) and merchants
// (tradespeople) both land here. Two tabs at the top so the user picks
// which flow they need — merchant tab shows the WhatsApp + password
// form; customer tab shows the email magic-link form.
//
// Every deprecated login URL 301-redirects here (/trade-off/login,
// /home/sign-in, /tc/sign-in, /affiliates/login). Admin login stays at
// /admin/login — private, security-sensitive, deliberately separate.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { UnifiedSignInShell } from "./UnifiedSignInShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Thenetworkers",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Allow `?next=` to route the merchant back to the page they were
// bounced from (same pattern as the old /trade-off/login). Whitelist
// to internal paths only — no open redirects.
function sanitizeNext(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/")) return null;
  return raw;
}

export default async function SignInPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = sanitizeNext(sp.next);
  const flowParam = typeof sp.flow === "string" ? sp.flow : undefined;
  const roleParam = typeof sp.role === "string" ? sp.role : undefined;

  return (
    <main className="min-h-screen text-neutral-900" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-10">
        <UnifiedSignInShell
          next={next}
          initialRole={roleParam === "customer" ? "customer" : roleParam === "merchant" ? "merchant" : null}
          initialFlow={flowParam === "recovery" ? "recovery" : null}
        />
      </section>
      <XratedFooter />
    </main>
  );
}
