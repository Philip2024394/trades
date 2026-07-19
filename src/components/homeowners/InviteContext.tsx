"use client";

// InviteContext — small React context passed via a client provider so
// the canteens directory shell + individual canteen cards can share
// invite-mode state without prop drilling.
//
// The provider is mounted by an invite-mode wrapper on the canteens
// index page (only when ?inviteFor=<homeownerToken>&projects=... is
// present). Cards use useInviteContext() to know whether to render
// the extra "Invite to project" CTA.

import { createContext, useContext, useState, type ReactNode } from "react";
import { InvitationModal, type InviteProject } from "./InvitationModal";

type InviteCtx = {
  active:            boolean;
  projects:          InviteProject[];
  openFor: (t: { listingId: string; tradeName: string; slug?: string | null }) => void;
};

const Ctx = createContext<InviteCtx>({
  active: false,
  projects: [],
  openFor: () => {}
});

export function useInviteContext(): InviteCtx {
  return useContext(Ctx);
}

export function InviteProvider({
  projects,
  active = true,
  children
}: {
  projects: InviteProject[];
  active?:  boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<null | {
    listingId: string; tradeName: string; slug?: string | null;
  }>(null);

  const ctx: InviteCtx = {
    active,
    projects,
    openFor: (t) => setOpen(t)
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {open && (
        <InvitationModal
          tradeListingId={open.listingId}
          tradeName={open.tradeName}
          tradeSlug={open.slug ?? null}
          projects={projects}
          onClose={() => setOpen(null)}
        />
      )}
    </Ctx.Provider>
  );
}
