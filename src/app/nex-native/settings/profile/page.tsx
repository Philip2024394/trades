// src/app/nex-native/settings/profile/page.tsx
//
// Bridge 2 · canonical NEX identity / discovery profile editor.
// -------------------------------------------------------------------------
// Owner-only. Reads/edits the caller's nex_account_profile row
// (migration 042). Uses the existing NEX-native shell + tokens so this
// feels like a natural extension of /nex-native/settings/theme.
//
// Doctrine:
//   · Every value shown here comes from the authoritative NEX Supabase
//     (ijvqdvsvwtwxzcqmoqit) via account-profile-service. No mock row.
//   · Save posts to updateProfileAction which validates lengths/enums
//     before touching the DB.
//   · Directory discovery UI is deliberately NOT wired here — this route
//     is only the owner-facing profile management surface for Bridge 2.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import { updateProfileAction, signOutAction } from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";
import { NexAvatarUploader } from "./_avatar-uploader";
import {
  NEX_ACCOUNT_KINDS,
  NEX_ACCOUNT_KIND_LABEL,
  NEX_PROFILE_BIO_MAX,
  NEX_PROFILE_HEADLINE_MAX,
  NEX_PROFILE_LOCATION_LABEL_MAX,
  NEX_PROFILE_PROFESSION_MAX,
} from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS_CODES = new Set(["profile_saved"]);

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  const profile = await accountProfileService.getProfileByAccountId(session.account.id);

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Your NEX profile</h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/conversations" className="underline">← inbox</Link>
              {" · "}
              Persisted on your NEX account · powers future NEX Directory discovery.
            </p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-neutral-500 underline">
              sign out
            </button>
          </form>
        </header>

        {banner && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              isSuccess
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
            data-nex-profile-banner={banner.code}
          >
            {banner.message}
          </div>
        )}

        <NexAvatarUploader
          currentAvatarUrl={profile?.avatar_url ?? null}
          displayName={session.account.display_name}
          handle={session.account.nex_handle}
        />

        <form
          action={updateProfileAction}
          className="rounded border border-neutral-300 bg-white p-4"
          data-nex-profile-form
        >
          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              What best describes what you do?
            </legend>
            <div className="grid gap-1.5">
              <label className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="kind"
                  value="unset"
                  defaultChecked={!profile?.kind}
                />
                <span className="text-neutral-600">Not yet set</span>
              </label>
              {NEX_ACCOUNT_KINDS.map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-2 text-sm"
                  data-nex-profile-kind-option={k}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    defaultChecked={profile?.kind === k}
                  />
                  <span>{NEX_ACCOUNT_KIND_LABEL[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mb-3 block text-xs text-neutral-600">
            Profession (single term · e.g. "footwear designer")
            <input
              type="text"
              name="profession"
              defaultValue={profile?.profession ?? ""}
              maxLength={NEX_PROFILE_PROFESSION_MAX}
              placeholder="e.g. footwear designer"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              data-nex-profile-input="profession"
            />
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Headline (short · one line)
            <input
              type="text"
              name="headline"
              defaultValue={profile?.headline ?? ""}
              maxLength={NEX_PROFILE_HEADLINE_MAX}
              placeholder="e.g. 12 years of footwear · Bandung"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              data-nex-profile-input="headline"
            />
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            About you (up to {NEX_PROFILE_BIO_MAX} chars)
            <textarea
              name="bio"
              defaultValue={profile?.bio ?? ""}
              maxLength={NEX_PROFILE_BIO_MAX}
              rows={4}
              placeholder="A short paragraph in your own words · what you make, who you work with, what you're best at."
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              data-nex-profile-input="bio"
            />
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Skills (comma-separated · max 20 · e.g. sample-making, CAD, sourcing)
            <input
              type="text"
              name="skills"
              defaultValue={(profile?.skills ?? []).join(", ")}
              placeholder="sample-making, CAD, sourcing"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              data-nex-profile-input="skills"
            />
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Location label (freeform · country, city, or region)
            <input
              type="text"
              name="location_label"
              defaultValue={profile?.location_label ?? ""}
              maxLength={NEX_PROFILE_LOCATION_LABEL_MAX}
              placeholder="e.g. Bandung, Indonesia"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              data-nex-profile-input="location_label"
            />
          </label>

          <label className="mb-4 block text-xs text-neutral-600">
            Looking for (comma-separated · max 10 · e.g. work, clients, collaborators)
            <input
              type="text"
              name="looking_for"
              defaultValue={(profile?.looking_for ?? []).join(", ")}
              placeholder="work, clients, collaborators"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              data-nex-profile-input="looking_for"
            />
          </label>

          <label className="mb-4 flex items-center gap-2 text-xs text-neutral-700">
            <input
              type="checkbox"
              name="is_public"
              defaultChecked={profile?.is_public ?? true}
              data-nex-profile-input="is_public"
            />
            <span>
              Make my profile discoverable in the NEX Directory (uncheck to keep it private for
              now · you can flip this back on later).
            </span>
          </label>

          <SubmitButton label="Save profile" pendingLabel="Saving…" fullWidth />
        </form>

        <p className="mt-3 text-[11px] text-neutral-500">
          Discovery UI does not read this yet — the NEX Directory People section arrives in a
          later bounded bridge. Your profile is persisted honestly today; nothing is fabricated.
        </p>
      </main>
    </NexNativeShell>
  );
}
