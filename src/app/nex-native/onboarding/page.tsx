// src/app/nex-native/onboarding/page.tsx
//
// Merchant self-service onboarding · one business + one initial product.
// ----------------------------------------------------------------------
// Server Component. Reads the caller's session · reads any existing
// business owned by this account · renders either:
//   · "You already have a business" card (pilot bound to one per user)
//   · A form that posts to createBusinessAction (Server Action)
//
// Every value on this page comes from the authoritative NEX Supabase
// (ijvqdvsvwtwxzcqmoqit) via src/lib/nex-native/*. No mock row · no
// fabricated slug · no silent price rounding beyond the penny.
//
// The action lives in ../_actions.ts and validates every field again
// on the server before touching the DB. The client-side pattern
// attribute on the slug input mirrors the DB CHECK constraint so most
// invalid slugs are rejected before submit.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { createBusinessAction, signOutAction } from "../_actions";
import { SubmitButton } from "../_submit-button";
import { NexNativeShell } from "../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in");
  }

  const params = await searchParams;
  const authError = params.e && params.m
    ? { code: params.e, message: params.m }
    : null;

  const existing = await businessService.listBusinessesByOwner(session.account.id);
  const owned = existing[0] ?? null;

  return (
    <NexNativeShell>
    <main className="mx-auto max-w-md px-4 py-8">
      <header className="mb-4 flex items-center justify-between border-b border-neutral-300 pb-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">NEX onboarding</h1>
          <p className="text-xs text-neutral-500">
            Signed in as{" "}
            <span className="font-medium text-neutral-800">{session.account.display_name}</span>
            {" · "}
            {session.account.nex_handle ? (
              <Link href={`/nex-native/u/${session.account.nex_handle}`} className="font-mono underline">
                {session.account.nex_handle}
              </Link>
            ) : (
              <code className="font-mono">{session.account.id.slice(0, 8)}…</code>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <Link href="/nex-native/conversations" className="underline">
            inbox
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="underline">
              sign out
            </button>
          </form>
        </div>
      </header>

      {authError && (
        <div
          className={`mb-4 rounded border p-3 text-xs ${
            authError.code === "email_confirmation_required" ||
            authError.code === "product_create_failed"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
          role="status"
        >
          {authError.message}
        </div>
      )}

      {owned ? (
        <section className="rounded border border-neutral-300 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-neutral-900">
            You already have a business
          </h2>
          <p className="mb-3 text-xs text-neutral-600">
            The pilot binds each account to a single business. Manage it below.
          </p>
          <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
            <dt className="text-neutral-500">Name</dt>
            <dd className="col-span-2 text-neutral-900">{owned.display_name}</dd>
            <dt className="text-neutral-500">Slug</dt>
            <dd className="col-span-2 font-mono text-neutral-900">{owned.slug}</dd>
            <dt className="text-neutral-500">Business ID</dt>
            <dd className="col-span-2 font-mono text-neutral-700">
              {owned.id.slice(0, 8)}…
            </dd>
          </dl>
          <div className="flex flex-col gap-2">
            <Link
              href={`/nex-native/${owned.slug}`}
              className="block rounded bg-neutral-900 py-1.5 text-center text-sm font-medium text-white hover:bg-neutral-700"
            >
              Open your NEX
            </Link>
            <Link
              href="/nex-native/conversations"
              className="block rounded border border-neutral-300 py-1.5 text-center text-sm text-neutral-800 hover:border-neutral-500"
            >
              Go to inbox
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="mb-4 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
            <h2 className="mb-1 text-sm font-semibold text-neutral-900">
              Create your NEX business
            </h2>
            <p className="mb-1">
              This is the pilot self-service flow. One account · one business.
            </p>
            <p className="mb-1">
              <span className="font-medium">Slug</span> is the address stem for
              your NEX · your public address becomes <code className="font-mono">&lt;slug&gt;.nex</code>
              {" · "}lowercase letters, digits, or hyphens · 1-64 chars.
            </p>
            <p>
              <span className="font-medium">Product</span> is the first thing customers
              can ask about · you can add more later.
            </p>
          </section>

          <form
            action={createBusinessAction}
            className="rounded border border-neutral-300 bg-white p-4"
          >
            <label className="mb-3 block text-xs text-neutral-600">
              Business name
              <input
                required
                type="text"
                name="display_name"
                maxLength={200}
                placeholder="e.g. Ofarrell Joinery"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>

            <label className="mb-3 block text-xs text-neutral-600">
              Slug
              <input
                required
                type="text"
                name="slug"
                minLength={1}
                maxLength={64}
                pattern="^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$"
                placeholder="e.g. ofarrell-joinery"
                title="Lowercase letters, digits, hyphens · 1-64 chars · no leading or trailing hyphen"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-sm"
              />
              <span className="mt-1 block text-xs text-neutral-500">
                becomes <code className="font-mono">/nex-native/&lt;slug&gt;</code> · this URL is permanent · choose carefully
              </span>
            </label>

            <label className="mb-3 block text-xs text-neutral-600">
              First product name
              <input
                required
                type="text"
                name="product_name"
                maxLength={200}
                placeholder="e.g. Bespoke oak staircase"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>

            <label className="mb-4 block text-xs text-neutral-600">
              Price (GBP)
              <input
                required
                type="number"
                name="product_price_gbp"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 24.50"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-neutral-500">
                stored as integer pence · GBP only for the pilot
              </span>
            </label>

            <SubmitButton
              label="Create business"
              pendingLabel="Creating business…"
              fullWidth
            />
          </form>
        </>
      )}
    </main>
    </NexNativeShell>
  );
}
