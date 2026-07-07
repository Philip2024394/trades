// Section 7 — Real Project.
//
// Editorial project showcase. Feels like reading a case study.
// Two-column layout: hero image left (placeholder = brand-tinted
// visual until real photo commissioned), narrative + attribution
// right.

import { MapPin, Calendar, Users, Package, ShieldCheck } from "lucide-react";
import type { ProjectContent } from "./types";

export function RealProject({
  overline,
  headline,
  subheadline,
  project
}: {
  overline: string;
  headline: string;
  subheadline: string;
  project: ProjectContent;
}) {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-neutral-700">
            {overline}
          </div>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight text-neutral-900 md:text-[52px]">
            {headline}
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-neutral-600 md:text-[18px]">
            {subheadline}
          </p>
        </header>

        <div className="mt-14 grid gap-8 md:grid-cols-2 md:gap-12">
          {/* LEFT — image placeholder */}
          <div>
            <div
              className="aspect-[4/5] w-full overflow-hidden rounded-3xl"
              style={{
                background:
                  "linear-gradient(160deg, #FFB300 0%, #E88A00 45%, #0f0f0f 100%)"
              }}
            >
              <div className="flex h-full w-full items-end p-8">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wider text-white/70">
                    Signed off · {project.completedAt}
                  </div>
                  <div className="mt-1 text-[22px] font-black text-white md:text-[28px]">
                    {project.title}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — project story */}
          <div className="md:pt-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {project.city} · {project.propertyType}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                {project.weeks} weeks
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-700">
                {project.totalCost}
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              <ProjectRow
                icon={<Users className="h-4 w-4" aria-hidden />}
                title="Trades on the job"
                items={project.trades}
              />
              <ProjectRow
                icon={<Package className="h-4 w-4" aria-hidden />}
                title="Products fitted"
                items={project.products}
              />
              <ProjectRow
                icon={<Package className="h-4 w-4" aria-hidden />}
                title="Merchant"
                items={[project.merchant]}
              />
              <ProjectRow
                icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
                title="Warranty"
                items={[project.warranty]}
                tone="emerald"
              />
            </div>

            <div className="mt-8 rounded-2xl bg-neutral-50 p-4 text-[13px] text-neutral-600">
              This project is a permanent page in the homeowner's
              Construction Notebook — verified, transferable at sale,
              and a lasting piece of the trade's reputation.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectRow({
  icon,
  title,
  items,
  tone = "neutral"
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone?: "neutral" | "emerald";
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
        {icon}
        {title}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold ${
              tone === "emerald"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-neutral-100 text-neutral-800"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
