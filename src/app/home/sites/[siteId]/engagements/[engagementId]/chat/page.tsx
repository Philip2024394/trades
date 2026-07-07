// /home/sites/[siteId]/engagements/[engagementId]/chat
//
// Owner-side conversation view.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, MessageSquareText } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { ConversationView } from "@/components/chat/ConversationView";

export const dynamic = "force-dynamic";

type Params = { siteId: string; engagementId: string };

export default async function OwnerChatPage({
  params
}: {
  params: Promise<Params>;
}) {
  const party = await loadHomeownerSession();
  const { siteId, engagementId } = await params;
  if (!party) {
    redirect(
      `/home/sign-in?next=/home/sites/${siteId}/engagements/${engagementId}/chat`
    );
  }
  const active = await loadActiveMembership();
  if (!active) redirect("/home/entity");

  const { data: engagement } = await supabaseAdmin
    .from("os_site_engagements")
    .select("id, hired_display_name, owner_entity_id, site_id")
    .eq("id", engagementId)
    .eq("site_id", siteId)
    .maybeSingle();

  if (!engagement || engagement.owner_entity_id !== active.entity_id) notFound();

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.10) 0%, transparent 60%)"
        }}
      />
      <div className="relative mx-auto max-w-2xl px-5 py-8 md:px-10 md:py-12">
        <Link
          href={`/home/sites/${siteId}/engagements/${engagementId}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Engagement
        </Link>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <MessageSquareText className="h-3 w-3" aria-hidden />
            Direct message
          </p>
          <h1 className="mt-3 text-[24px] font-bold leading-tight md:text-[30px]">
            You &amp; {engagement.hired_display_name}
          </h1>
          <p className="mt-2 text-[13px] text-[#1B1A17]/60">
            Every message on the record. Green tick means they&apos;ve seen it.
          </p>
        </div>

        <div className="mt-8">
          <ConversationView
            engagementId={engagementId}
            otherLabel={engagement.hired_display_name}
          />
        </div>
      </div>
    </main>
  );
}
