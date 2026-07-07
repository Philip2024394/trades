// /home/sign-in — homeowner enters email to receive a magic link.

import { redirect } from "next/navigation";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sign in to My Home — Xrated Trades",
  robots: { index: false, follow: false }
};

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const party = await loadHomeownerSession();
  if (party) redirect("/home");
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Xrated Trades
          </div>
          <h1 className="mt-2 text-3xl font-bold">My Home</h1>
          <p className="mt-2 text-[14px] text-neutral-600">
            Sign in to see your property, projects, warranties and timeline.
          </p>
        </div>
        <SignInForm errorParam={sp.error} nextParam={sp.next} />
      </div>
    </div>
  );
}
