// NEX Business Context · /b/[slug]/workspace · OWNER NEX workspace (Philip 2026-08-14).

import { notFound } from "next/navigation";
import { NexOwnerWorkspaceShell } from "@/components/nex-business/NexOwnerWorkspaceShell";
import { ensureSeeded, getBusiness, toOwnerIdentity } from "@/lib/nex/business-context";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  return { title: biz ? `${biz.blueprint.identity.displayName} · NEX Workspace` : "NEX Workspace", robots: { index: false } };
}

export default async function OwnerWorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) notFound();
  const identity = toOwnerIdentity(biz);
  return <NexOwnerWorkspaceShell business={identity} />;
}
