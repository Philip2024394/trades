// /authors — landing page.
//
// Server-checks the session cookie. If Author is signed in, redirect
// to /authors/dashboard. Otherwise show a "you need an invite token"
// message and a small login form. Never a self-signup path.

import { redirect } from "next/navigation";
import { getAuthorFromCookie, nexAuthorStudioEnabled } from "@/lib/nex/brains/_studio";
import { AuthorLoginForm } from "@/apps/author-studio/components/AuthorLoginForm";

export default async function AuthorsLandingPage() {
  if (!nexAuthorStudioEnabled()) {
    return (
      <div className="rounded border border-[#0A0A0A]/10 bg-white p-6">
        <h1 className="text-lg font-semibold">Author Studio is not enabled in this environment.</h1>
        <p className="mt-2 text-sm text-[#0A0A0A]/70">
          Set NEX_AUTHOR_STUDIO_ENABLED once the first Author has a signed contract
          and NEX_AUTHOR_ALLOWLIST is populated.
        </p>
      </div>
    );
  }

  const authorId = await getAuthorFromCookie();
  if (authorId) redirect("/authors/dashboard");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Author sign-in</h1>
      <p className="mt-1 text-sm text-[#0A0A0A]/70">
        Paste the invite token from your onboarding email.
      </p>
      <div className="mt-6 rounded border border-[#0A0A0A]/10 bg-white p-6">
        <AuthorLoginForm />
      </div>
    </div>
  );
}
