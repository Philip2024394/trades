// /trade-off/edit/[slug]/washers — Merchant washer-bag management.
//
// Server-side loads the bag + recent transactions from Supabase then
// hands them to the client shell so the merchant sees real state on
// first paint. Falls back to a sensible zeroed state if the migration
// hasn't been applied yet — this lets the page still render (with a
// visible "backend not connected" note) so we can eyeball the UI in
// dev without blocking on migrations.

import type { Metadata } from "next";
import { WashersShell } from "./WashersShell";
import { loadWasherBag, loadRecentTransactions } from "@/lib/washers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your washer bag | Thenetworkers",
  robots: { index: false, follow: false }
};

export default async function WashersPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Server-load real balance + transactions. When the washer tables
  // haven't been applied yet, both calls swallow the error and return
  // null / []. The shell renders a "backend pending" note so it's
  // visible we're on stub state rather than pretending 47 exists.
  let bag: Awaited<ReturnType<typeof loadWasherBag>> = null;
  let transactions: Awaited<ReturnType<typeof loadRecentTransactions>> = [];
  let backendReady = true;
  try {
    bag = await loadWasherBag(slug);
    transactions = await loadRecentTransactions(slug, 20);
  } catch {
    backendReady = false;
  }
  if (!bag) backendReady = false;

  return (
    <WashersShell
      slug={slug}
      initialBalance={bag?.balance ?? 0}
      initialAutoTopup={bag?.autoTopup ?? true}
      transactions={transactions.map((t) => ({
        id: t.id,
        kind:
          t.kind === "deduct"   ? "deduct"
          : t.kind === "purchase" ? "purchase"
          : t.kind === "refund"   ? "refund"
          : "grant",
        delta: t.delta,
        label: labelForTx(t),
        source: t.source,
        createdAt: t.createdAt
      }))}
      backendReady={backendReady}
    />
  );
}

function labelForTx(t: Awaited<ReturnType<typeof loadRecentTransactions>>[number]): string {
  const detail = t.detail ?? {};
  if (t.kind === "deduct") {
    const guest = typeof detail.guestName === "string" ? detail.guestName : "a customer";
    return `Lead from ${guest}`;
  }
  if (t.kind === "purchase") {
    const pack = typeof detail.packId === "string" ? detail.packId : "pack";
    const washers = typeof detail.packWashers === "number" ? detail.packWashers : t.delta;
    const price = typeof detail.packPriceGbp === "number" ? detail.packPriceGbp : null;
    return price != null
      ? `${pack} bag (${washers} washers · £${price.toFixed(2)})`
      : `${pack} bag (${washers} washers)`;
  }
  if (t.kind === "refund") return "Refund: spam-flagged lead";
  if (t.kind === "grant") return "Signup grant";
  return "Activity";
}
