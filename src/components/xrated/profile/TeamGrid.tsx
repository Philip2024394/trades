// Xrated Trades — "Meet the team" grid.
//
// Renders only when the listing carries 2+ team members. Solo tradies
// never see this section. Each member card shows photo-or-initials,
// first name, role, years-experience tag, and up to 3 skill chips.
// The right-most "Boss" tag highlights member 0 so the customer can
// pick out who's actually running the business.

import type { HammerexTradeOffListing } from "@/lib/supabase";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function TeamGrid({ listing }: { listing: HammerexTradeOffListing }) {
  const members = (listing.team_members ?? []).slice(0, 8);
  if (members.length < 2) return null;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Meet the team
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        The people who&apos;ll actually be on your site.
      </p>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {members.map((m, i) => {
          const firstName = m.name.split(/\s+/)[0] || m.name;
          return (
            <li
              key={`${m.name}-${i}`}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
                  style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}
                >
                  {m.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-base font-extrabold"
                      style={{ background: "#FFB300", color: "#0A0A0A" }}
                    >
                      {initials(m.name)}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-extrabold text-neutral-900">
                      {firstName}
                    </p>
                    {i === 0 && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                        style={{ background: "#FFB300" }}
                      >
                        Boss
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{m.role}</p>
                  {typeof m.years_experience === "number" &&
                    m.years_experience > 0 && (
                      <p className="mt-1 text-xs font-bold text-[#FFB300]">
                        {m.years_experience}+ yrs experience
                      </p>
                    )}
                </div>
              </div>

              {m.skills && m.skills.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {m.skills.slice(0, 3).map((s) => (
                    <li key={s}>
                      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-900">
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
