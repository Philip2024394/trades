"use client";

// The "+ New project" CTA in guest mode.
//
// Guest visitor lands in /sitebook via the name-claim widget on the
// landing (no signup yet). When they hit this button we DON'T route
// them to the project form — we open the GuestActivationModal instead
// which collects the account details needed to store their data.
//
// After successful activation, the button routes to /sitebook/new
// (the guest cookie is cleared server-side and replaced with a real
// session cookie in the activate endpoint).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GuestActivationModal } from "@/components/homeowners/GuestActivationModal";

const BRAND_YELLOW = "#FFB300";

export function GuestNewProjectButton({ nickname }: { nickname: string }) {
  const router          = useRouter();
  const [open, setOpen] = useState(false);

  async function onActivated() {
    setOpen(false);
    // Server-side: activate endpoint set the real session cookie and
    // cleared the guest cookie. Router.refresh() re-renders /sitebook
    // in the authed state, then we navigate to the project form.
    router.refresh();
    router.push("/sitebook/new");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        + New project
      </button>
      {open && (
        <GuestActivationModal
          nickname={nickname}
          onClose={() => setOpen(false)}
          onActivated={onActivated}
        />
      )}
    </>
  );
}
