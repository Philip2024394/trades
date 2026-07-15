// /tc/routes — Route Optimiser (R02).
//
// For a specific job, decide pickup vs delivery per merchant + order the
// pickups so the trade drives the least miles. Van share panel below
// (post-MVP feature stub, marked "coming soon").
//
// Trade Center never suggests a specific merchant to increase margin —
// the ordering is distance-driven with verified-quality tie-breaking.
// Merchants that don't stock the item simply aren't options.

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Briefcase,
  MapPin,
  ArrowLeft,
  Route as RouteIcon,
  Truck,
  Users,
  Info,
  Calendar
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { RouteSummary } from "@/apps/routes/components/RouteSummary";
import { RouteStopCard } from "@/apps/routes/components/RouteStopCard";
import { findRoute, ROUTE_FIXTURES } from "@/apps/routes/data/routes";
import { JOB_FIXTURES } from "@/apps/jobs/data/jobs";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export default function RoutesPage() {
  const viewer = currentViewerTrade();
  const jobs = JOB_FIXTURES.filter((j) => j.ownerTradeSlug === viewer.slug);
  const [activeJobSlug, setActiveJobSlug] = useState<string>(
    ROUTE_FIXTURES[0]?.jobSlug ?? jobs[0]?.slug ?? ""
  );
  const route = useMemo(() => findRoute(activeJobSlug), [activeJobSlug]);
  const job = jobs.find((j) => j.slug === activeJobSlug);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <Link
          href="/tc/jobs"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Jobs
        </Link>

        <header className="mt-3 mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Route Optimiser
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            <RouteIcon size={24}/>
            Get every material on site with the least driving
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Trade Center decides pickup vs delivery per merchant and orders the pickups
            so you drive the least miles. Ranked by distance, never by merchant margin.
          </p>
        </header>

        {/* Job picker + destination */}
        <section
          className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "#F5F0E4" }}
              aria-hidden
            >
              <Briefcase size={17} className="text-neutral-500"/>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                For job
              </div>
              <div className="mt-0.5 text-[13.5px] font-black text-neutral-900">
                {job?.title ?? route?.jobTitle ?? "Choose a job"}
              </div>
              {job && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-600">
                  <MapPin size={10}/> {job.addressShort}
                  <span className="mx-1">·</span>
                  <Calendar size={10}/> Started {new Date(job.startedAtIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              )}
            </div>
          </div>

          {/* Job selector */}
          {jobs.length > 1 && (
            <select
              value={activeJobSlug}
              onChange={(e) => setActiveJobSlug(e.target.value)}
              className="min-h-[44px] rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              {jobs.map((j) => (
                <option key={j.slug} value={j.slug}>{j.title}</option>
              ))}
            </select>
          )}
        </section>

        {route ? (
          <>
            <RouteSummary route={route}/>

            {/* Pickup route — ordered */}
            <section className="mt-5">
              <div className="mb-3 flex items-center gap-2">
                <RouteIcon size={14} className="text-neutral-700"/>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                  Ordered pickups from {route.startCity}
                </div>
              </div>
              {route.stops.length === 0 ? (
                <div
                  className="rounded-xl border-2 border-dashed p-6 text-center"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  <div className="text-[12px] font-black text-neutral-900">
                    No pickups needed — everything's being delivered.
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {route.stops.map((s, i) => (
                    <li key={s.id}>
                      <RouteStopCard stop={s} index={i}/>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Delivery stops */}
            {route.deliveryStops.length > 0 && (
              <section className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <Truck size={14} className="text-neutral-700"/>
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                    Deliveries scheduled — no driving needed
                  </div>
                </div>
                <ul className="flex flex-col gap-3">
                  {route.deliveryStops.map((s) => (
                    <li key={s.id}>
                      <RouteStopCard stop={s}/>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Van share stub */}
            <section
              className="mt-6 rounded-2xl border p-5 shadow-sm"
              style={{
                borderColor: "rgba(139,69,19,0.15)",
                backgroundColor: "#FFFDF8"
              }}
            >
              <div className="flex items-center gap-2">
                <Users size={14} className="text-amber-700"/>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
                  Van Share · Coming next
                </div>
              </div>
              <div className="mt-2 text-[13.5px] font-black text-neutral-900">
                Split the drive with trades doing the same route
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
                When another Verified Trade is driving Manchester → Leeds on the same day,
                share the diesel. Post a load, book a spot. Coming after we validate demand on
                the pickup optimiser first.
              </p>
            </section>

            {/* Provenance note */}
            <div className="mt-5 flex items-start gap-2 rounded-md bg-neutral-50 p-3">
              <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
              <p className="text-[10.5px] leading-snug text-neutral-500">
                Pickup vs delivery is decided by distance from your saved location. Ordering
                uses nearest-neighbour on merchant home city. Merchant margin is never a
                signal — Trade Center never routes to a merchant to increase our take.
              </p>
            </div>
          </>
        ) : (
          <div
            className="rounded-xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div className="text-[13px] font-black text-neutral-900">
              No route yet for this job
            </div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              Add a Notebook item or a Job Cost line to seed the route with materials.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
