// /support/ticket — public support ticket form.
//
// Every category except DMCA (that has its own dedicated form at
// /legal/takedown so the sworn-statement flow is explicit).

import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/seo";
import { SupportTicketForm } from "./SupportTicketForm";

export const metadata: Metadata = {
  title: `Support — ${BRAND.name}`,
  description: "Open a support ticket. We respond within 48 hours (24 hours for urgent issues).",
  robots: { index: true, follow: true }
};

export default function SupportTicketPage() {
  return (
    <main
      className="mx-auto min-h-screen max-w-2xl px-4 pb-16 pt-10 md:px-6 md:pt-14"
      style={{ backgroundColor: "#FBF6EC", color: "#1B1A17" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Support</div>
      <h1
        className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]"
        style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
      >
        Open a support ticket
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700">
        Every ticket gets a human read within 48 hours. Urgent issues (safeguarding, IP, defamation) get 4-hour first response.
      </p>
      <p className="mt-2 text-[12px] text-neutral-600">
        Copyright takedown? Use the dedicated form at <Link href="/legal/takedown" className="underline">/legal/takedown</Link>.
      </p>

      <SupportTicketForm/>

      <div className="mt-8 border-t pt-4 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
        Alternate paths: email <a className="underline" href="mailto:support@thenetworkers.app">support@thenetworkers.app</a> · read our{" "}
        <Link href="/legal/terms" className="underline">Terms of Use</Link>.
      </div>
    </main>
  );
}
