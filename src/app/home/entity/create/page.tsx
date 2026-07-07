// /home/entity/create
//
// Owner-side form to spin up a business/contractor/enterprise/public
// sector entity. Once created, the new entity becomes active and the
// caller is its owner.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Building2 } from "lucide-react";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { CreateEntityForm } from "./CreateEntityForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New entity · My Notebook" };

export default async function CreateEntityPage() {
  const party = await loadHomeownerSession();
  if (!party) redirect("/home/sign-in?next=/home/entity/create");

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.14) 0%, transparent 60%)"
        }}
      />
      <div className="relative mx-auto max-w-2xl px-5 py-8 md:px-10 md:py-12">
        <Link
          href="/home/entity"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <Building2 className="h-3 w-3" aria-hidden />
            New entity
          </p>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight md:text-[36px]">
            Set up your business context.
          </h1>
          <p className="mt-3 text-[15px] leading-[1.55] text-[#1B1A17]/70">
            Choose the tier that best describes your organisation. You can
            invite members and configure roles once it&apos;s created.
          </p>
        </div>

        <div className="mt-10">
          <CreateEntityForm />
        </div>
      </div>
    </main>
  );
}
