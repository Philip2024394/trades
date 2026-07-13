// Customer-printable postal order form. Merchant's address + key
// details + customer contact + notes — designed to print to a single
// A4 sheet the customer includes with the posted key.
//
// Print CSS: hide navigation/hero, add page breaks, sensible margins.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { effectiveTier } from "@/lib/xratedTrades";
import { isKeyCuttingOn } from "@/lib/xratedAddons";
import { normaliseKeyCuttingConfig } from "@/lib/keyCutting";
import { PrintPageButton } from "@/components/xrated/profile/PrintPageButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Postal order form",
  robots: { index: false }
};

export default async function PostalFormPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!res.data) notFound();
  const listing = res.data;
  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  if (!isPaid || !isKeyCuttingOn(listing)) redirect(`/${slug}`);
  const cfg = normaliseKeyCuttingConfig(listing.key_cutting);
  const merchantName = listing.display_name ?? slug;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl p-6 print:p-4">
        <div className="no-print mb-4 flex items-center justify-between">
          <PrintPageButton />
          <a
            href={`/${slug}/key-cutting`}
            className="text-[12px] font-bold text-neutral-500 underline"
          >
            ← Back to key cutting
          </a>
        </div>

        {/* HEADER */}
        <header className="border-b-4 border-black pb-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Key cutting — postal order
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">{merchantName}</h1>
          {cfg.postal_address && (
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-tight text-neutral-800">
              {cfg.postal_address}
            </pre>
          )}
        </header>

        {/* CUSTOMER DETAILS */}
        <section className="mt-6">
          <h2 className="border-b border-neutral-300 pb-1 text-[16px] font-extrabold uppercase tracking-widest">
            Your details
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <Field label="Name" />
            <Field label="Mobile" />
            <Field label="Email" />
            <Field label="Return address (write in full)" span2 />
          </div>
        </section>

        {/* KEY DETAILS */}
        <section className="mt-6">
          <h2 className="border-b border-neutral-300 pb-1 text-[16px] font-extrabold uppercase tracking-widest">
            Key details
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <Field label="Key type (Yale / Chubb / Padlock / Car / other)" span2 />
            <Field label="Number of copies" />
            <Field label="Key number stamped on original (if visible)" />
            <Field label="Notes (any known cutting problem, worn key, etc)" span2 height="h-16" />
          </div>
        </section>

        {/* RESTRICTED KEY */}
        {cfg.restricted_brands.length > 0 && (
          <section className="mt-6 rounded-md border-2 border-black p-3">
            <p className="text-[12px] font-extrabold uppercase tracking-widest">
              Restricted / high-security keys
            </p>
            <p className="mt-1 text-[12px]">
              Authorisation card or signed dealer letter <strong>MUST</strong> be included for:{" "}
              {cfg.restricted_brands.join(", ")}. Without it, restricted keys cannot be cut.
            </p>
          </section>
        )}

        {/* CHECKLIST */}
        <section className="mt-6">
          <h2 className="border-b border-neutral-300 pb-1 text-[16px] font-extrabold uppercase tracking-widest">
            Include with this form
          </h2>
          <ul className="mt-3 space-y-2 text-[13px]">
            {[
              "The original key(s) to be copied",
              "This completed order form",
              "A prepaid return envelope (Royal Mail Signed-For 1st Class recommended)",
              "Copy of photo ID (for restricted keys only)",
              "Payment: WhatsApp us for a payment link once we confirm we can cut your key"
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 inline-block h-4 w-4 shrink-0 border-2 border-neutral-900" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* TURNAROUND */}
        <section className="mt-6 flex items-center justify-between border-t-2 border-black pt-4 text-[12px]">
          <p className="font-extrabold">
            Turnaround: {cfg.postal_turnaround_hours ?? 48} hours from receipt
          </p>
          <p className="text-neutral-500">
            Signed by: __________________ Date: __________________
          </p>
        </section>

        {/* FOOTER */}
        <footer className="mt-6 text-center text-[10px] text-neutral-500">
          Form generated at {new Date().toISOString().slice(0, 10)} — Powered by thenetworkers.app
        </footer>
      </div>
    </main>
  );
}

function Field({
  label,
  span2,
  height = "h-10"
}: {
  label: string;
  span2?: boolean;
  height?: string;
}) {
  return (
    <div className={span2 ? "col-span-2" : undefined}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <div className={`mt-1 w-full border-b-2 border-neutral-900 ${height}`} />
    </div>
  );
}
