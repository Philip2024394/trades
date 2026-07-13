// Read-only share page for a Material Calculator estimate.
//
// The customer who runs the calculator generates a unique URL. They
// share that URL with their contractor / spouse / themselves-for-later.
// This page renders the saved inputs + output read-only with a CTA back
// to the originating merchant so the recipient can buy or enquire.

import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { formatGbp } from "@/lib/xratedCart";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Material estimate — Thenetworkers",
  robots: { index: false, follow: false }
};

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export default async function SharedEstimatePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return <NotFound />;
  }

  const row = await supabaseAdmin
    .from("hammerex_xrated_calc_estimates")
    .select(
      "id, listing_id, product_id, calculator_type, inputs, output, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!row.data) return <NotFound />;

  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, whatsapp, city")
    .eq("id", row.data.listing_id)
    .maybeSingle();
  const listing = listingRes.data;
  if (!listing) return <NotFound />;

  let productSlug: string | null = null;
  let productName: string | null = null;
  if (row.data.product_id) {
    const pRes = await supabaseAdmin
      .from("hammerex_xrated_products")
      .select("slug, name")
      .eq("id", row.data.product_id)
      .maybeSingle();
    if (pRes.data) {
      productSlug = pRes.data.slug;
      productName = pRes.data.name;
    }
  }

  const output = row.data.output as {
    lines: Array<{ label: string; value: string; detail?: string; tone?: string }>;
    warnings?: string[];
    materials_total_pence: number;
    labour?: {
      trade_label: string;
      rate_pence: number;
      rate_unit: string;
      quantity: number;
      total_pence: number;
    };
  };
  const grandTotal =
    output.materials_total_pence + (output.labour?.total_pence ?? 0);

  const productHref = productSlug
    ? `/${listing.slug}/shop/${productSlug}`
    : `/${listing.slug}/shop`;
  const waDigits = (listing.whatsapp ?? "").replace(/\D/g, "");

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Shared estimate · {row.data.calculator_type}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          {productName ?? "Material estimate"}
        </h1>
        <p className="mt-2 text-[13px] text-neutral-500">
          From <span className="font-bold text-neutral-900">{listing.display_name}</span>
          {listing.city && <> · {listing.city}</>}
        </p>

        <div className="mt-6 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
          <ul className="divide-y divide-neutral-200">
            {output.lines.map((line, i) => {
              const tone = line.tone ?? "muted";
              const valueClass =
                tone === "primary"
                  ? "text-[18px] font-extrabold text-neutral-900"
                  : "text-[14px] font-bold text-neutral-700";
              return (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-neutral-900">{line.label}</p>
                    {line.detail && (
                      <p className="text-[11px] text-neutral-500">{line.detail}</p>
                    )}
                  </div>
                  <span className={`${valueClass} shrink-0`}>{line.value}</span>
                </li>
              );
            })}
          </ul>

          {output.warnings && output.warnings.length > 0 && (
            <ul className="space-y-1.5">
              {output.warnings.map((w, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-800"
                >
                  ⚠️ {w}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-bold text-neutral-700">
                Materials total
              </span>
              <span className="text-[15px] font-extrabold text-neutral-900">
                {formatGbp(output.materials_total_pence)}
              </span>
            </div>
            {output.labour && (
              <>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-bold text-neutral-700">
                    Installation ({output.labour.trade_label})
                  </span>
                  <span className="text-[15px] font-extrabold text-neutral-900">
                    {formatGbp(output.labour.total_pence)}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2">
                  <span className="text-[13px] font-extrabold text-neutral-900">
                    Total
                  </span>
                  <span className="text-[18px] font-extrabold text-neutral-900">
                    {formatGbp(grandTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={productHref}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-[#FFB300] px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900"
          >
            View on {listing.display_name}
          </Link>
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                `Hi ${listing.display_name} — I'd like to enquire about this estimate: ${typeof process !== "undefined" ? "" : ""}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-[#0F7A3F] px-5 text-[13px] font-extrabold uppercase tracking-wider text-white"
            >
              Enquire on WhatsApp
            </a>
          )}
        </div>

        <p className="mt-6 text-[11px] text-neutral-400">
          Estimate generated {new Date(row.data.created_at).toLocaleString("en-GB")}.
          Quantities include the merchant's recommended waste buffer. Final pricing
          confirmed by the merchant at order.
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}

function NotFound() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Estimate not found</h1>
        <p className="mt-3 text-[13px] text-neutral-500">
          This estimate link is invalid or has been removed. Run the
          calculator on the merchant&apos;s product page to generate a new one.
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}
