// src/app/nex-native/settings/theme/page.tsx
//
// Chat Theme picker · Wave B Slice 7a.
// -------------------------------------
// Server Component · reads the caller's current chat_theme preference and
// renders 5 theme swatches. Selecting one posts to updateChatThemeAction
// which persists on nex_account and redirects back here with a banner.
//
// Doctrine references:
//   · doctrine_nex_identity_and_capability_constitution_2026_09_24
//     Lock 2 · Capability 5 "Chat Theme" · persisted as account preference ·
//     survives reload/sign-out/sign-in · NEVER URL parameter state
//   · No-fake-buttons · only real themes ship

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { updateChatThemeAction } from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

interface ThemeOption {
  id: "default" | "titanium" | "pink" | "gold" | "night";
  label: string;
  hint: string;
  swatch: string;   // hex or gradient stub · visible in the swatch chip
}

const THEMES: ThemeOption[] = [
  { id: "default",  label: "Default",  hint: "The base NEX look",          swatch: "#ffffff" },
  { id: "titanium", label: "Titanium", hint: "Dark neutral",               swatch: "#1f2937" },
  { id: "pink",     label: "Pink",     hint: "Warm blush",                 swatch: "#f9a8d4" },
  { id: "gold",     label: "Gold",     hint: "Warm gold",                  swatch: "#d4a017" },
  { id: "night",    label: "Night",    hint: "Deep blue",                  swatch: "#1e3a8a" },
];

const SUCCESS_CODES = new Set(["theme_updated"]);

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;
  const current = session.account.chat_theme ?? "default";

  return (
    <NexNativeShell themeId={current}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Chat theme</h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/conversations" className="underline">← inbox</Link>
              {" · "}
              Preference stored on your account · survives sign-out.
            </p>
          </div>
        </header>

        {banner && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              isSuccess
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {isSuccess
              ? <>Theme saved · <span className="font-medium">{banner.message}</span></>
              : banner.message}
          </div>
        )}

        <p className="mb-4 text-sm text-neutral-700">
          Current theme · <span className="font-medium">{current}</span>
        </p>

        <ul className="grid gap-3 sm:grid-cols-2">
          {THEMES.map((t) => {
            const active = t.id === current;
            return (
              <li key={t.id}>
                <form action={updateChatThemeAction}>
                  <input type="hidden" name="chat_theme" value={t.id} />
                  <button
                    type="submit"
                    disabled={active}
                    className={`flex w-full items-center gap-3 rounded border px-3 py-3 text-left text-sm transition ${
                      active
                        ? "border-neutral-900 bg-neutral-50 cursor-default"
                        : "border-neutral-300 bg-white hover:border-neutral-500 hover:bg-neutral-50"
                    }`}
                    aria-pressed={active}
                    aria-label={`${t.label} theme${active ? " · currently active" : ""}`}
                  >
                    <span
                      aria-hidden
                      className="h-8 w-8 flex-shrink-0 rounded border border-neutral-300"
                      style={{ backgroundColor: t.swatch }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-neutral-900">{t.label}</span>
                      <span className="block text-xs text-neutral-500">{t.hint}</span>
                    </span>
                    {active && (
                      <span className="ml-auto text-xs font-medium text-neutral-700">
                        active
                      </span>
                    )}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs text-neutral-500">
          Themes currently apply as a data-attribute hook (data-theme) on the app shell.
          Full visual styling for each theme lands in a follow-up slice.
        </p>
      </main>
    </NexNativeShell>
  );
}
