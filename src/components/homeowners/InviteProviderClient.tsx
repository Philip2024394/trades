"use client";

// InviteProviderClient — thin client wrapper that mounts InviteProvider
// with server-supplied invite context. Split out from InviteModeWrapper
// so the canteens page can decide server-side (via cookie) whether the
// visitor is a homeowner + render the right chrome accordingly, then
// pass the resolved context down without a client fetch flash.

import type { ReactNode } from "react";
import { InviteProvider }     from "./InviteContext";
import { InviteBanner }       from "./InviteBanner";
import type { InviteProject } from "./InvitationModal";

export function InviteProviderClient({
  firstName,
  nickname,
  projects,
  children
}: {
  firstName:  string | null;
  nickname:   string | null;
  projects:   InviteProject[];
  children:   ReactNode;
}) {
  return (
    <InviteProvider projects={projects} active>
      <div className="mx-auto max-w-[1400px] px-3 md:px-6">
        <InviteBanner
          homeownerFirstName={firstName}
          siteBookNickname={nickname}
        />
      </div>
      {children}
    </InviteProvider>
  );
}
