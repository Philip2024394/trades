// /admin-brains — landing + login for the Brain Admin persona.

import { redirect } from "next/navigation";
import { getBrainAdminFromCookie, nexBrainAdminEnabled } from "@/lib/nex/brains/_admin";
import { BrainAdminLoginForm } from "@/apps/author-studio/components/admin/BrainAdminLoginForm";

export default async function BrainAdminLandingPage() {
  if (!nexBrainAdminEnabled()) {
    return (
      <div className="rounded border border-[#0A0A0A]/10 bg-white p-6">
        <h1 className="text-lg font-semibold">Brain Admin is not enabled in this environment.</h1>
        <p className="mt-2 text-sm text-[#0A0A0A]/70">
          Set NEX_BRAIN_ADMIN_ENABLED and populate NEX_BRAIN_ADMIN_ALLOWLIST before signing reviewers in.
        </p>
      </div>
    );
  }

  const adminId = await getBrainAdminFromCookie();
  if (adminId) redirect("/admin-brains/queue?brain_slug=staircase");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Brain Admin sign-in</h1>
      <p className="mt-1 text-sm text-[#0A0A0A]/70">
        Paste the invite token issued to you by Program Lead.
      </p>
      <div className="mt-6 rounded border border-[#0A0A0A]/10 bg-white p-6">
        <BrainAdminLoginForm />
      </div>
    </div>
  );
}
