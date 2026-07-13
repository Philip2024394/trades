// /property/[id]/materials — Materials Passport public read.
//
// The user-facing surface for the shift-3 mechanic: every trade action
// tagged to this property renders as a time-sorted audit trail.
// Surveyors, insurers, mortgage brokers, buyers can verify the story
// without needing to trust anyone individually — the receipts are the
// story.
//
// v1: public read (property_id is a UUID, effectively unlisted). v2
// will add a signed QR-token gate so a physical sticker on the
// property is the primary access path.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Hammer,
  MapPin,
  ShieldCheck,
  Radio,
  Package,
  CheckCircle2
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PassportShareBar } from "./ShareBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Materials Passport · The Construction Notebook",
  description:
    "Every trade action tagged to this property, in one honest chain — from materials bought to work fulfilled."
};

type Actor = {
  slug: string;
  display_name: string;
  trading_name: string | null;
  primary_trade: string;
  city: string | null;
};

type TrailRow =
  | {
      kind: "post";
      id: string;
      postKind: string;
      title: string;
      body: string;
      imageUrls: string[];
      pricePence: number | null;
      currency: string | null;
      condition: string | null;
      createdAt: string;
      actor: Actor | null;
    }
  | {
      kind: "response";
      id: string;
      message: string;
      availability: string | null;
      pricePence: number | null;
      isAccepted: boolean;
      createdAt: string;
      actor: Actor | null;
    };

async function loadPassport(propertyId: string) {
  const { data: property } = await supabaseAdmin
    .from("os_properties")
    .select("id, postcode_prefix, created_at")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) return null;

  const [postsRes, respsRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select(
        "id, listing_id, kind, title, body, image_urls, product_price_pence, price_currency, condition, created_at"
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("hammerex_yard_beacon_responses")
      .select(
        "id, beacon_post_id, responder_listing_id, message, availability_text, price_pence, is_accepted, created_at"
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);
  const postRows = postsRes.data ?? [];
  const respRows = respsRes.data ?? [];

  const actorIds = Array.from(
    new Set(
      [
        ...postRows.map((r) => r.listing_id),
        ...respRows.map((r) => r.responder_listing_id)
      ].filter(Boolean)
    )
  );
  const actors: Record<string, Actor> = {};
  if (actorIds.length > 0) {
    const { data: aRows } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, trading_name, primary_trade, city")
      .in("id", actorIds);
    for (const a of aRows ?? []) {
      actors[a.id] = {
        slug: a.slug,
        display_name: a.display_name,
        trading_name: a.trading_name,
        primary_trade: a.primary_trade,
        city: a.city
      };
    }
  }

  const trail: TrailRow[] = [];
  for (const p of postRows) {
    trail.push({
      kind: "post",
      id: p.id,
      postKind: p.kind,
      title: p.title,
      body: p.body,
      imageUrls: (p.image_urls ?? []) as string[],
      pricePence: p.product_price_pence,
      currency: p.price_currency ?? null,
      condition: p.condition ?? null,
      createdAt: p.created_at,
      actor: actors[p.listing_id] ?? null
    });
  }
  for (const r of respRows) {
    trail.push({
      kind: "response",
      id: r.id,
      message: r.message,
      availability: r.availability_text ?? null,
      pricePence: r.price_pence ?? null,
      isAccepted: r.is_accepted,
      createdAt: r.created_at,
      actor: actors[r.responder_listing_id] ?? null
    });
  }
  trail.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const totalPence = trail.reduce(
    (acc, row) =>
      "pricePence" in row && row.pricePence !== null
        ? acc + row.pricePence
        : acc,
    0
  );
  const distinctTrades = new Set(
    trail.map((r) => r.actor?.slug).filter(Boolean)
  ).size;

  return { property, trail, totalPence, distinctTrades };
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function fmtPrice(pence: number, currency: string | null): string {
  const sym =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  const amt = pence / 100;
  return `${sym}${amt.toLocaleString("en-GB", {
    minimumFractionDigits: amt % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

const KIND_LABEL: Record<string, string> = {
  beacon: "Beacon",
  product: "Materials",
  "tools-sell": "Tools purchase",
  "materials-surplus": "Surplus reused",
  "tools-rent": "Equipment hire",
  "job-offer": "Trade hired",
  "job-seek": "Trade offered",
  chat: "Note"
};

export default async function MaterialsPassportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadPassport(id);
  if (!data) notFound();

  const { property, trail, totalPence, distinctTrades } = data;

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:px-8 md:pt-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            ← Notebook
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Materials Passport
          </span>
        </div>

        <h1 className="text-[30px] font-black leading-tight tracking-tight md:text-[40px]">
          Every trade action on this property.
        </h1>
        <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.55] text-[#1B1A17]/70 md:text-[16px]">
          One honest chain: what was bought, who fulfilled it, when. Every row
          links back to the trade that recorded it — nothing here is edited
          after the fact. Surveyors, insurers, buyers can verify without
          trusting anyone individually.
        </p>

        <PassportShareBar postcodePrefix={property.postcode_prefix} />

        {/* Summary card */}
        <section
          className="mt-6 rounded-2xl border-2 p-5 shadow-sm"
          style={{
            borderColor: "#FFB300",
            background: "linear-gradient(90deg, #FFF7E0 0%, #FFFFFF 60%)"
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <SummaryCell
              label="Total trail rows"
              value={String(trail.length)}
              icon={<Package className="h-4 w-4" aria-hidden />}
            />
            <SummaryCell
              label="Distinct trades"
              value={String(distinctTrades)}
              icon={<Hammer className="h-4 w-4" aria-hidden />}
            />
            <SummaryCell
              label="Total recorded"
              value={totalPence > 0 ? fmtPrice(totalPence, "GBP") : "—"}
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-amber-200 pt-3 text-[11px] font-bold text-amber-800">
            <MapPin className="h-3 w-3" aria-hidden />
            {property.postcode_prefix ?? "Unknown postcode"}
            <span aria-hidden>·</span>
            Property recorded {fmtDate(property.created_at)}
          </div>
        </section>

        {/* Trail */}
        <section className="mt-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            The chain
          </p>
          <h2 className="mt-1 text-[20px] font-black text-[#1B1A17] md:text-[24px]">
            Newest first.
          </h2>

          {trail.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#1B1A17]/15 bg-white p-5 text-center">
              <p className="text-[13.5px] font-black text-[#1B1A17]">
                No trades have logged activity against this property yet.
              </p>
              <p className="mt-1 text-[12px] text-[#1B1A17]/60">
                When a homeowner or trade tags a Yard purchase to this
                property, it appears here permanently.
              </p>
            </div>
          ) : (
            <ol className="mt-4 space-y-3">
              {trail.map((row) => (
                <li
                  key={`${row.kind}-${row.id}`}
                  className="relative rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm"
                >
                  {row.kind === "post" ? (
                    <TrailPostRow row={row} />
                  ) : (
                    <TrailResponseRow row={row} />
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Verification footer */}
        <section
          className="mt-8 rounded-2xl border p-5"
          style={{
            borderColor: "rgba(27,26,23,0.10)",
            background: "white"
          }}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
              aria-hidden
            />
            <div>
              <p className="text-[13px] font-black text-[#1B1A17]">
                How verification works
              </p>
              <p className="mt-1 text-[12px] leading-[1.5] text-[#1B1A17]/70">
                Every row on this page was written directly by the trade
                who acted. Rows cannot be edited after the fact — corrections
                are appended as new entries. The property record is anchored
                to a postcode + address hash; the actual address is never
                exposed publicly.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCell({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-[18px] font-black tabular-nums text-[#1B1A17] md:text-[22px]">
        {value}
      </p>
    </div>
  );
}

function TrailPostRow({
  row
}: {
  row: Extract<TrailRow, { kind: "post" }>;
}) {
  const hero = row.imageUrls?.[0] ?? null;
  return (
    <div className="flex gap-3">
      {hero ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={hero}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg border border-[#1B1A17]/10 object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "#FFB300", color: "#0A0A0A" }}
        >
          {row.postKind === "beacon" ? (
            <Radio className="h-6 w-6" aria-hidden />
          ) : (
            <Package className="h-6 w-6" aria-hidden />
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]"
            style={{ background: "#1B1A17", color: "#FFB300" }}
          >
            {KIND_LABEL[row.postKind] ?? row.postKind}
          </span>
          {row.pricePence !== null && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums"
              style={{ background: "#FFB300", color: "#0A0A0A" }}
            >
              {fmtPrice(row.pricePence, row.currency)}
            </span>
          )}
          <span className="text-[10px] font-bold text-[#1B1A17]/55">
            {fmtDate(row.createdAt)}
          </span>
        </div>
        <p className="mt-1 text-[13.5px] font-black leading-tight text-[#1B1A17]">
          {row.title}
        </p>
        {row.body && (
          <p className="mt-1 line-clamp-3 text-[12px] leading-[1.45] text-[#1B1A17]/70">
            {row.body}
          </p>
        )}
        {row.actor && (
          <Link
            href={`/${row.actor.slug}`}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline"
          >
            Logged by {row.actor.trading_name ?? row.actor.display_name}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

function TrailResponseRow({
  row
}: {
  row: Extract<TrailRow, { kind: "response" }>;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: row.isAccepted ? "#0F7A3F" : "#1B1A17",
          color: "#ffffff"
        }}
      >
        {row.isAccepted ? (
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        ) : (
          <Radio className="h-6 w-6" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white"
            style={{ background: row.isAccepted ? "#0F7A3F" : "#1B1A17" }}
          >
            {row.isAccepted ? "Beacon fulfilled" : "Beacon response"}
          </span>
          {row.pricePence !== null && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums"
              style={{ background: "#FFB300", color: "#0A0A0A" }}
            >
              {fmtPrice(row.pricePence, "GBP")}
            </span>
          )}
          <span className="text-[10px] font-bold text-[#1B1A17]/55">
            {fmtDate(row.createdAt)}
          </span>
        </div>
        {row.availability && (
          <p className="mt-1 text-[12px] font-semibold text-[#1B1A17]/80">
            {row.availability}
          </p>
        )}
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.45] text-[#1B1A17]/80">
          {row.message}
        </p>
        {row.actor && (
          <Link
            href={`/${row.actor.slug}`}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline"
          >
            Fulfilled by {row.actor.trading_name ?? row.actor.display_name}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
