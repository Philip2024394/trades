"use client";

// InviteBanner — amber notice at the top of the canteens directory
// when the owner arrived in invite mode. Reminds them what they're
// doing + gives an "exit invite mode" link back to their SiteBook.

import Link from "next/link";
import { UserPlus, ArrowLeft } from "lucide-react";

export function InviteBanner({ homeownerFirstName, siteBookNickname }: {
  homeownerFirstName?: string | null;
  siteBookNickname?:   string | null;
}) {
  const name = homeownerFirstName || siteBookNickname || "You";
  const site = siteBookNickname   || "your SiteBook";
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-3 shadow-sm md:p-4"
         style={{ borderColor: "#F59E0B", backgroundColor: "#FEF3C7" }}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-900" style={{ backgroundColor: "#FFB300" }}>
          <UserPlus size={16} strokeWidth={2.5}/>
        </span>
        <div>
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-amber-800">
            Invite mode · {name}
          </p>
          <p className="mt-0.5 text-[12.5px] font-bold leading-snug text-neutral-800">
            Pick a trade or supplier to invite to {site}. Each card has an <span className="font-black">Invite to project</span> button.
          </p>
        </div>
      </div>
      <Link
        href="/sitebook"
        className="inline-flex h-9 items-center gap-1 rounded-full border border-amber-400 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-amber-900"
      >
        <ArrowLeft size={11}/> Back to SiteBook
      </Link>
    </div>
  );
}
