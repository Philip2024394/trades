import Link from "next/link";
import { XCircle, ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const REASON_COPY: Record<string, string> = {
  missing: "The invitation link is missing its token.",
  unknown: "This invitation link isn't recognised.",
  expired: "This invitation has expired. Ask the owner to resend it.",
  accepted: "You already accepted this invitation.",
  declined: "This invitation was declined.",
  revoked: "The owner revoked this invitation."
};

export default async function AcceptInviteError({
  searchParams
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = REASON_COPY[reason ?? ""] ?? "Something went wrong with this invitation.";

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div className="relative mx-auto max-w-xl px-6 py-16">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          My Notebook
        </Link>
        <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-300" aria-hidden />
            <div>
              <h1 className="text-[20px] font-bold text-[#1B1A17]">Invitation problem</h1>
              <p className="mt-2 text-[14px] text-[#1B1A17]/70">{message}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
