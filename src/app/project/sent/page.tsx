// Step 5 — Confirmation. Optional Notebook CTA.
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, BookOpen, ArrowRight } from "lucide-react";
import { clearDraft } from "../draftStore";
import { WizardShell } from "../WizardShell";

export default function StepSent() {
  useEffect(() => {
    // Draft has served its purpose — clear so back-nav starts fresh.
    clearDraft();
  }, []);

  return (
    <WizardShell
      step="sent"
      title="Your brief is on the Notebook."
      subtitle="The trades you picked will receive your project and get in touch within 24 hours."
    >
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400"
            aria-hidden
          />
          <div>
            <p className="text-[15px] font-bold text-[#1B1A17]">
              Brief sent
            </p>
            <p className="mt-1 text-[13px] leading-[1.5] text-[#1B1A17]/70">
              Trades reply through the Notebook so every response stays on
              your property&apos;s record. You&apos;ll get email + WhatsApp
              notifications as replies come in.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-6">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-6 w-6 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#1B1A17]">
              Track it in your Notebook
            </p>
            <p className="mt-1 text-[13px] leading-[1.5] text-[#1B1A17]/70">
              Free forever. Every quote, warranty, photo and job on your
              property — recorded, and yours forever. Follows your home when
              you sell.
            </p>
            <div className="mt-4">
              <Link
                href="/home"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-neutral-900 hover:bg-neutral-100"
              >
                Open my Notebook
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-[#1B1A17]/12 pt-6 text-[13px] text-[#1B1A17]/55">
        <p>
          Not ready?{" "}
          <Link href="/" className="text-amber-300 hover:text-amber-200">
            Back to the Notebook
          </Link>
        </p>
      </div>
    </WizardShell>
  );
}
