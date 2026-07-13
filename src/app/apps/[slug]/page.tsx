// /apps/[slug] — App detail + install CTA.
//
// Public marketing page for a single app. Merchants who click Install
// are routed into Studio (which handles the actual install flow
// against the merchant's brand).

import Link from "next/link";
import { notFound } from "next/navigation";
import { WAREHOUSE_APPS } from "@/lib/apps/warehouse";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_AMBER, BRAND_GREEN } from "@/lib/brand/tokens";

export const dynamic = "force-dynamic";

const BLACK = BRAND_BLACK;
const AMBER = BRAND_AMBER;
const YELLOW = BRAND_YELLOW;
const GREEN = BRAND_GREEN;

export default async function AppDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const app = WAREHOUSE_APPS.find((a) => a.slug === slug);
  if (!app) notFound();

  const isFree = app.tier === "free";

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/apps"
          className="mb-6 inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={14} />
          Back to App Warehouse
        </Link>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {app.category}
                </div>
                {app.featured && (
                  <span
                    className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: AMBER }}
                  >
                    Featured
                  </span>
                )}
              </div>
              <h1 className="text-[28px] font-bold leading-tight text-slate-900">{app.name}</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{app.tagline}</p>
            </div>
            <div className="text-right">
              {isFree ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: GREEN }}
                >
                  <Sparkles size={14} color={YELLOW} />
                  Free
                </span>
              ) : (
                <div>
                  <div
                    className="rounded-md px-3 py-1.5 text-[13px] font-bold text-white"
                    style={{ backgroundColor: AMBER }}
                  >
                    £{app.price?.monthly ?? "—"}/mo
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Pro tier</div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              What it does
            </div>
            <ul className="flex flex-col gap-2">
              {app.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[14px] leading-relaxed text-slate-700">
                  <Check size={14} className="mt-1 flex-shrink-0" color={AMBER} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <DetailBlock label="Where it plugs in">
              <div className="flex flex-wrap gap-1">
                {app.zones.map((z) => (
                  <span
                    key={z}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700"
                  >
                    {z}
                  </span>
                ))}
              </div>
            </DetailBlock>
            <DetailBlock label="Trades it fits">
              <div className="text-[13px] text-slate-700">
                {app.tradeAllowlist.includes("*")
                  ? "Every trade on The Network."
                  : `${app.tradeAllowlist.length} trades — including ${app.tradeAllowlist.slice(0, 3).join(", ")}${app.tradeAllowlist.length > 3 ? "…" : ""}`}
              </div>
            </DetailBlock>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <Link
              href="/apps"
              className="h-11 rounded-md border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-900 hover:bg-slate-50 flex items-center"
            >
              Keep browsing
            </Link>
            <Link
              href={`/studio/(app)/apps/${app.slug}`}
              className="h-11 rounded-md px-4 text-[14px] font-semibold flex items-center"
              style={{ backgroundColor: YELLOW, color: BLACK }}
            >
              {isFree ? "Install free" : `Start Pro — £${app.price?.monthly ?? ""}/mo`}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
