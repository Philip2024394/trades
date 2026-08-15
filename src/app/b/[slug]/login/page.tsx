// NEX Auth · /b/[slug]/login (Philip 2026-08-14).
// Customer-facing login form for a specific business.

import { notFound } from "next/navigation";
import { ensureSeeded, getBusiness, toCustomerIdentity } from "@/lib/nex/business-context";
import { CustomerLoginForm } from "@/components/nex-business/CustomerLoginForm";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  return { title: biz ? `Sign in · ${biz.blueprint.identity.displayName}` : "Sign in", robots: { index: false } };
}

export default async function CustomerLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) notFound();
  const identity = toCustomerIdentity(biz);
  return <CustomerLoginForm business={identity} />;
}
