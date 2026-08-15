// NEX Auth · /nex/login (Philip 2026-08-14).
// Owner login. Requires email + which business the owner is signing into.

import { OwnerLoginForm } from "@/components/nex-business/OwnerLoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner sign in · NEX Workspace", robots: { index: false } };

export default function OwnerLoginPage({
  searchParams
}: { searchParams: Promise<{ business?: string }> }) {
  return <OwnerLoginFormWrapper searchParams={searchParams} />;
}

async function OwnerLoginFormWrapper({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const sp = await searchParams;
  return <OwnerLoginForm defaultBusinessSlug={sp.business ?? ""} />;
}
