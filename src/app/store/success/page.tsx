// /store/success — post-purchase page.
//
// Shows every image in the order + four download buttons per image
// (Instagram 1:1 / Website 16:9 / Mobile 9:16 / Full original — from
// STORE_VARIANTS). Handles both single and pack orders via items_json
// (falls back to item_url for legacy single orders).

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { STORE_VARIANTS, type VariantSlug } from "@/lib/storeImageVariants";

export const dynamic = "force-dynamic";

type OrderItem = { id: string; url: string; alt: string | null };
type Order = {
  id:                  string;
  buyer_email:         string;
  paid:                boolean;
  download_token:      string;
  download_expires_at: string;
  price_gbp:           number;
  pack_size:           number | null;
  items_json:          OrderItem[] | null;
  item_id:             string | null;
  item_url:            string | null;
  item_alt:            string | null;
};

async function loadOrder(orderId: string, token: string): Promise<Order | null> {
  const res = await supabaseAdmin
    .from("hammerex_store_orders")
    .select("id, buyer_email, paid, download_token, download_expires_at, price_gbp, pack_size, items_json, item_id, item_url, item_alt")
    .eq("id",             orderId)
    .eq("download_token", token)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as Order;
}

function resolveItems(order: Order): OrderItem[] {
  if (order.items_json && order.items_json.length > 0) return order.items_json;
  if (order.item_url && order.item_id) {
    return [{ id: order.item_id, url: order.item_url, alt: order.item_alt }];
  }
  return [];
}

export default async function SuccessPage({
  searchParams
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const p = await searchParams;
  const orderId = p.order;
  const token   = p.token;

  if (!orderId || !token) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-[24px] font-black text-neutral-900">Missing order details</h1>
        <p className="mt-2 text-[13px] text-neutral-600">Check your email for the download link, or contact support.</p>
      </div>
    );
  }

  const order = await loadOrder(orderId, token);
  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-[24px] font-black text-neutral-900">Order not found</h1>
        <p className="mt-2 text-[13px] text-neutral-600">This download link may have expired or been used already.</p>
      </div>
    );
  }
  if (!order.paid) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-[24px] font-black text-neutral-900">Awaiting payment</h1>
        <p className="mt-2 text-[13px] text-neutral-600">Refresh in a moment — Stripe usually confirms within seconds.</p>
      </div>
    );
  }

  const items = resolveItems(order);
  const expires = new Date(order.download_expires_at);
  const expiresFmt = expires.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const isPack = items.length > 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Success banner */}
      <div
        className="rounded-2xl border p-6 md:p-8"
        style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: "#F0FDF4" }}
      >
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
          ✓ Payment received · £{order.price_gbp}
        </div>
        <h1 className="text-[24px] font-black text-neutral-900 md:text-[28px]">
          Thank you — your {isPack ? `pack of ${items.length}` : "image"} is ready
        </h1>
        <p className="mt-1 text-[13px] text-neutral-700">
          Download link{isPack ? "s" : ""} below. Also emailed to{" "}
          <span className="font-black">{order.buyer_email}</span>.
        </p>
      </div>

      {/* Bulk-download hint for packs */}
      {isPack && (
        <div
          className="mt-6 rounded-lg p-3 text-center text-[12px] text-neutral-700"
          style={{ backgroundColor: "#FFFBEB" }}
        >
          <span className="font-black">Tip:</span> each image ships in four ready-to-use crops — Instagram (1:1), Website hero (16:9), Mobile screen (9:16), and the full-res original. Your licence covers all variants.
        </div>
      )}

      {/* Items */}
      <div className="mt-6 space-y-4">
        {items.map((img) => (
          <div
            key={img.id}
            className="grid gap-4 rounded-2xl border p-4 md:grid-cols-[160px_minmax(0,1fr)]"
            style={{ borderColor: "rgba(0,0,0,0.10)" }}
          >
            <div
              className="overflow-hidden rounded-lg border bg-neutral-100"
              style={{ borderColor: "rgba(0,0,0,0.08)", aspectRatio: "9 / 12" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt ?? "Purchased image"} className="h-full w-full object-cover"/>
            </div>
            <div className="flex flex-col justify-between gap-2">
              <div>
                <p className="text-[13px] font-black leading-snug text-neutral-800">
                  {img.alt ?? img.id}
                </p>
                <div className="mt-0.5 font-mono text-[10px] text-neutral-500">{img.id}</div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Download — pick your crop
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {STORE_VARIANTS.map((v) => (
                    <DownloadBtn
                      key={v.slug}
                      token={order.download_token}
                      itemId={img.id}
                      variant={v.slug}
                      label={v.label}
                      sub={v.sub}
                      ratio={v.ratio}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Licence + expiry */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4" style={{ borderColor: "rgba(0,0,0,0.10)" }}>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Licence summary
          </div>
          <ul className="mt-2 space-y-1 text-[11px] leading-snug text-neutral-700">
            <li>✓ Commercial use (ads, print, web, social)</li>
            <li>✓ Perpetual — never expires</li>
            <li>✗ No resale or redistribution</li>
            <li>✗ No upload to stock libraries</li>
          </ul>
          <Link href="/legal/image-licence" className="mt-3 inline-block text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
            Full terms →
          </Link>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "rgba(0,0,0,0.10)" }}>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Download window
          </div>
          <p className="mt-1 text-[11px] leading-snug text-neutral-700">
            Links stay valid until <span className="font-black">{expiresFmt}</span>. Bookmark this page or keep the email — you can re-download any size any time before then.
          </p>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link href="/store/browse" className="text-[12px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          ← Back to browse
        </Link>
      </div>
    </div>
  );
}

function DownloadBtn({
  token, itemId, variant, label, sub, ratio
}: {
  token:   string;
  itemId:  string;
  variant: VariantSlug;
  label:   string;
  sub:     string;
  ratio:   string;
}) {
  const href = `/api/store/download/${encodeURIComponent(token)}?item=${encodeURIComponent(itemId)}&variant=${variant}`;
  return (
    <a
      href={href}
      className="flex flex-col items-start gap-0 rounded-md border bg-white px-3 py-2 transition hover:bg-neutral-50"
      style={{ borderColor: "rgba(0,0,0,0.15)" }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-black text-neutral-900">{label}</span>
        <span className="rounded px-1 py-px text-[8px] font-black uppercase tracking-wider" style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}>
          {ratio}
        </span>
      </div>
      <span className="mt-0.5 text-[9px] font-bold text-neutral-500">{sub}</span>
    </a>
  );
}
