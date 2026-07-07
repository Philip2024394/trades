// Step 3 — Welcome / confirmation. Redirects to the merchant edit
// interface via their new slug.
"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight, BookOpen } from "lucide-react";
import { clearDraft } from "../draftStore";
import { WizardShell } from "../WizardShell";

export default function StepDonePage() {
  return (
    <Suspense fallback={<DoneShell slug="" />}>
      <DoneInner />
    </Suspense>
  );
}

function DoneInner() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";

  useEffect(() => {
    clearDraft();
  }, []);

  return <DoneShell slug={slug} />;
}

function DoneShell({ slug }: { slug: string }) {
  return (
    <WizardShell
      step="done"
      title="Your Notebook is open."
      subtitle="Check your inbox — we&apos;ve sent your finish-setup link and your public Notebook URL."
    >
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400"
            aria-hidden
          />
          <div>
            <p className="text-[15px] font-bold text-[#1B1A17]">
              You&apos;re on the Notebook.
            </p>
            <p className="mt-1 text-[13px] leading-[1.5] text-[#1B1A17]/70">
              Welcome email sent. Click the link inside to add photos,
              services, and your Trade Circle.
            </p>
          </div>
        </div>
      </div>

      {slug ? (
        <div className="mt-6 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-6 w-6 text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/55">
                Your public Notebook
              </p>
              <p className="mt-1 truncate font-mono text-[14px] text-amber-300">
                xratedtrade.com/{slug}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/${slug}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-bold text-neutral-900 hover:bg-amber-300"
                >
                  View my Notebook
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href={`/trade-off/edit/${slug}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#1B1A17]/20 bg-[#1B1A17]/4 px-5 text-[14px] font-semibold text-[#1B1A17] hover:bg-[#1B1A17]/5"
                >
                  Finish setup
                </Link>
                <Link
                  href="/trade-hq"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#1B1A17]/20 bg-[#1B1A17]/4 px-5 text-[14px] font-semibold text-[#1B1A17] hover:bg-[#1B1A17]/5"
                >
                  Open Trade HQ
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/55">
          What happens next
        </p>
        <ol className="mt-3 space-y-3 text-[14px] text-[#1B1A17]/80">
          <NextStep
            n="01"
            title="Add photos + services"
            body="From the finish-setup link. Homeowners see your work first."
          />
          <NextStep
            n="02"
            title="Invite your Trade Circle"
            body="Recommend the trades you work with. Get recommended back."
          />
          <NextStep
            n="03"
            title="Receive project briefs"
            body="When a homeowner near you submits a brief, we email it straight to your inbox."
          />
        </ol>
      </div>

      <div className="mt-8 border-t border-[#1B1A17]/12 pt-6 text-[13px] text-[#1B1A17]/45">
        Notebook member since {new Date().toLocaleDateString("en-GB")}.
      </div>
    </WizardShell>
  );
}

function NextStep({
  n,
  title,
  body
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 font-mono text-[13px] font-semibold text-amber-300">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-[#1B1A17]">{title}</div>
        <div className="mt-0.5 text-[13px] leading-[1.5] text-[#1B1A17]/60">
          {body}
        </div>
      </div>
    </li>
  );
}
