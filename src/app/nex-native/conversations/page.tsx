// src/app/nex-native/conversations/page.tsx
//
// Wave 5 · NEX-native inbox.
// --------------------------
// Server Component.
// Signed out → render inline sign-in / sign-up form (Server Action).
// Signed in  → render the caller's real conversation list.
//
// Every value on this page comes from the authoritative NEX Supabase
// (ijvqdvsvwtwxzcqmoqit) via src/lib/nex-native/*. No mock, no fake row.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as conversationService from "@/lib/nex-native/conversation-service";
import * as businessService from "@/lib/nex-native/business-service";
import { signInAction, signInAsDevAdminAction, signUpAction, signOutAction } from "../_actions";
import { SubmitButton } from "../_submit-button";
import { NexNativeShell } from "../_shell";
import { YourNexCard } from "../_your-nex-card";
import { nexAddressForBusiness } from "@/lib/nex-native/nex-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  // Bridge 55 · Phase 1 launch gate · business-conversation inbox
  // hidden by default (this surface is commerce-only). Admins can
  // reach it with ?commerce=1.
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(params)) {
    redirect("/nex-native/home");
  }
  const session = await resolveNexAppSessionFromContext();
  const authError = params.e && params.m
    ? { code: params.e, message: params.m }
    : null;

  if (!session) {
    // Signed-out visitors go to the canonical sign-in surface · forward
    // any error banner from redirect helpers along in the URL.
    const qs = authError
      ? `?${new URLSearchParams({ e: authError.code, m: authError.message }).toString()}`
      : "";
    redirect(`/nex-native/sign-in${qs}`);
  }
  // Below this line, the inline sign-in / sign-up form is kept as
  // dead code so a session-loss race can't 500 the page. The redirect
  // above is authoritative and normally never falls through.
  if (!session) {
    return (
      <NexNativeShell>
        <main className="mx-auto max-w-md px-4 py-8">
        <header className="mb-6">
          <h1 className="text-lg font-semibold text-neutral-900">NEX conversations</h1>
          <p className="text-xs text-neutral-500">Sign in to your NEX conversations.</p>
        </header>
        <p className="mb-4 text-xs text-neutral-500">
          New to NEX?{" "}
          <Link href="/nex-native/about" className="font-medium underline">
            Read a quick primer
          </Link>
          .
        </p>
        {authError && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              authError.code === "email_confirmation_required"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {authError.message}
          </div>
        )}
        <form action={signInAction} className="mb-4 rounded border border-neutral-300 bg-white p-4">
          <label className="mb-2 block text-xs text-neutral-600">
            Email
            <input
              required
              type="email"
              name="email"
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="mb-3 block text-xs text-neutral-600">
            Password
            <input
              required
              type="password"
              name="password"
              minLength={6}
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <SubmitButton label="Sign in" pendingLabel="Signing in…" fullWidth />
        </form>
        {process.env.NEX_ALLOW_DEV_ADMIN === "1" && (
          <form action={signInAsDevAdminAction} className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="mb-2">
              <strong>Dev mode active.</strong> One-click sign-in as the provisioned dev-admin
              (email <code className="font-mono">dev-admin@nex-native.local</code> · handle{" "}
              <code className="font-mono">nex-10375</code>) · no password needed.
            </p>
            <SubmitButton label="Sign in as Dev Admin" pendingLabel="Signing in…" fullWidth />
            <p className="mt-2 text-[10px] text-amber-700">
              Disabled in production · set <code className="font-mono">NEX_ALLOW_DEV_ADMIN=1</code> in{" "}
              <code className="font-mono">.env.local</code> to expose this button.
            </p>
          </form>
        )}
        <details className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
          <summary className="cursor-pointer font-medium">No account yet? Create one</summary>
          <form action={signUpAction} className="mt-3">
            <label className="mb-2 block text-xs text-neutral-600">
              Email
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <div className="mb-3 grid grid-cols-[max-content_1fr] gap-2">
              <label className="block text-xs text-neutral-600">
                Country code
                <input
                  required
                  type="text"
                  name="phone_country_code"
                  placeholder="+44"
                  pattern="^\+[0-9]{1,4}$"
                  maxLength={5}
                  inputMode="tel"
                  autoComplete="tel-country-code"
                  className="mt-1 block min-h-[44px] w-24 rounded border border-neutral-300 px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-neutral-600">
                Phone number
                <input
                  required
                  type="tel"
                  name="phone_national_number"
                  placeholder="e.g. 7911123456"
                  pattern="^[0-9]{5,15}$"
                  maxLength={15}
                  inputMode="tel"
                  autoComplete="tel-national"
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                />
              </label>
            </div>
            <span className="mb-3 block text-[11px] text-neutral-500">
              Digits only in the phone box · no spaces or dashes · your identity remains
              your NEX handle, phone is a credential attribute only.
            </span>
            <label className="mb-2 block text-xs text-neutral-600">
              Password (min 6 chars)
              <input
                required
                type="password"
                name="password"
                minLength={6}
                autoComplete="new-password"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="mb-3 block text-xs text-neutral-600">
              Confirm password
              <input
                required
                type="password"
                name="password_confirm"
                minLength={6}
                autoComplete="new-password"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <SubmitButton
              label="Create account"
              pendingLabel="Creating account…"
              variant="secondary"
              fullWidth
            />
          </form>
        </details>
        </main>
      </NexNativeShell>
    );
  }

  const summaries = await conversationService.listConversationsForAccount(session.account.id);

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between border-b border-neutral-300 pb-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">NEX conversations</h1>
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
        <form action={signOutAction}>
          <button type="submit" className="text-xs text-neutral-500 underline">
            sign out
          </button>
        </form>
      </header>

      {await (async () => {
        // Wave 4O · Your NEX card in the inbox · owner-side acquisition surface.
        const owned = await businessService.listBusinessesByOwner(session.account.id);
        if (owned.length === 0) return null;
        const addr = nexAddressForBusiness(owned[0]!);
        return addr ? <YourNexCard address={addr} /> : null;
      })()}

      {summaries.length === 0 ? (
        <div className="rounded border border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-600">
          <p className="mb-2 text-center font-medium text-neutral-800">No conversations yet.</p>
          <ul className="mx-auto max-w-sm space-y-1 text-xs text-neutral-600">
            <li>
              · If a business shared their NEX chat URL with you, open it. The URL looks like{" "}
              <code className="font-mono">/nex-native/&lt;business-slug&gt;</code>.
            </li>
            <li>
              · If you run a trade business, set up your NEX business at{" "}
              <Link href="/nex-native/onboarding" className="font-medium underline">
                /nex-native/onboarding
              </Link>
              .
            </li>
          </ul>
        </div>
      ) : (
        <ul className="grid gap-2">
          {summaries.map((s) => (
            <li key={s.conversation.id}>
              <Link
                href={`/nex-native/conversations/${s.conversation.id}`}
                className="block rounded border border-neutral-200 bg-white p-3 hover:border-neutral-400"
              >
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium text-neutral-900">
                    {s.business.display_name}
                    {s.product && (
                      <span className="ml-1 text-xs font-normal text-neutral-500">
                        · about{" "}
                        <span className="text-neutral-700">{s.product.name}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="uppercase tracking-wide">
                      {s.my_side === "business" ? "you host" : "you asked"}
                    </span>
                    {s.unread_count > 0 && (
                      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded bg-neutral-900 px-1 text-[10px] font-semibold text-white">
                        {s.unread_count}
                      </span>
                    )}
                  </div>
                </div>
                {s.last_message ? (
                  <p className="mt-1 truncate text-xs text-neutral-600">
                    <span className="text-neutral-400">
                      {new Date(s.last_message.created_at).toLocaleString()}
                    </span>
                    {" · "}
                    {s.last_message.body}
                  </p>
                ) : (
                  <p className="mt-1 text-xs italic text-neutral-400">no messages yet</p>
                )}
                <p className="mt-1 text-[10px] text-neutral-400">
                  conv <code className="font-mono">{s.conversation.id.slice(0, 8)}…</code>
                  {s.other_display_name && (
                    <>
                      {" · with "}
                      <span className="text-neutral-500">{s.other_display_name}</span>
                    </>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </main>
    </NexNativeShell>
  );
}
