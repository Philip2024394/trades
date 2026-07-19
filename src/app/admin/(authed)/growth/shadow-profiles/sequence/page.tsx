// /admin/growth/shadow-profiles/sequence — drip sequence status by step.
//
// Shows: how many merchants are at each step of the drip. Which step
// is converting best. Which step is losing the most to unsubscribes.

import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TEMPLATES } from "@/lib/shadowMerchants/templates";

export const dynamic = "force-dynamic";

type StepMetrics = {
  stepIndex:      number;
  slug:           string;
  atThisStep:     number;                     // merchants currently sitting here
  sentEver:       number;
  opened:         number;
  clicked:        number;
  bounced:        number;
  unsubscribed:   number;
  claimedAfter:   number;                     // merchants claimed after this step's send
};

async function loadSequenceMetrics(): Promise<StepMetrics[]> {
  const results: StepMetrics[] = [];

  for (const t of TEMPLATES) {
    const [atStepRes, eventsRes] = await Promise.all([
      supabaseAdmin
        .from("hammerex_shadow_merchants")
        .select("id", { count: "exact", head: true })
        .eq("next_step_index", t.stepIndex)
        .in("status", ["queued", "sending"]),
      supabaseAdmin
        .from("hammerex_shadow_email_events")
        .select("event_type")
        .eq("step_index", t.stepIndex)
    ]);

    const events = (eventsRes.data as Array<{ event_type: string }> | null) ?? [];
    const count = (type: string) => events.filter((e) => e.event_type === type).length;

    results.push({
      stepIndex:      t.stepIndex,
      slug:           t.slug,
      atThisStep:     atStepRes.count ?? 0,
      sentEver:       count("sent"),
      opened:         count("open"),
      clicked:        count("click"),
      bounced:        count("bounce"),
      unsubscribed:   count("unsubscribe"),
      claimedAfter:   0                       // computed below
    });
  }

  // Claimed-after-step — approximate: claim event count assigned to
  // the step index that was current at claim time (from email events log)
  const claimsBySteps = await supabaseAdmin
    .from("hammerex_shadow_merchants")
    .select("next_step_index", { count: "exact", head: false })
    .eq("status", "claimed");

  for (const row of (claimsBySteps.data as Array<{ next_step_index: number }> | null) ?? []) {
    // next_step_index at claim = the step AFTER the last sent one
    const lastSentStep = Math.max(0, (row.next_step_index ?? 0) - 1);
    const target = results.find((r) => r.stepIndex === lastSentStep);
    if (target) target.claimedAfter++;
  }

  return results;
}

export default async function ShadowProfilesSequencePage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login?next=/admin/growth/shadow-profiles/sequence");
  }
  const metrics = await loadSequenceMetrics();

  return (
    <main className="min-h-screen bg-neutral-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Admin · Growth · Shadow scraper</p>
            <h1 className="mt-1 text-2xl font-black text-neutral-900">Drip sequence</h1>
          </div>
          <Link href="/admin/growth/shadow-profiles" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider hover:bg-neutral-100">← Overview</Link>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[800px] border-collapse text-[11.5px]">
            <thead className="bg-neutral-100">
              <tr>
                <Th>Step</Th>
                <Th>Template</Th>
                <Th className="text-right">At step</Th>
                <Th className="text-right">Sent ever</Th>
                <Th className="text-right">Open rate</Th>
                <Th className="text-right">Click rate</Th>
                <Th className="text-right">Bounces</Th>
                <Th className="text-right">Unsubs</Th>
                <Th className="text-right">Claimed after</Th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const openRate  = m.sentEver > 0 ? ((m.opened  / m.sentEver) * 100).toFixed(1) + "%" : "—";
                const clickRate = m.sentEver > 0 ? ((m.clicked / m.sentEver) * 100).toFixed(1) + "%" : "—";
                return (
                  <tr key={m.stepIndex} className="border-t border-neutral-100">
                    <Td className="font-black">{m.stepIndex}</Td>
                    <Td><code className="rounded bg-neutral-100 px-1">{m.slug}</code></Td>
                    <Td className="text-right">{m.atThisStep.toLocaleString("en-GB")}</Td>
                    <Td className="text-right">{m.sentEver.toLocaleString("en-GB")}</Td>
                    <Td className="text-right">{openRate}</Td>
                    <Td className="text-right font-black">{clickRate}</Td>
                    <Td className="text-right text-red-700">{m.bounced || 0}</Td>
                    <Td className="text-right text-red-700">{m.unsubscribed || 0}</Td>
                    <Td className="text-right text-green-700 font-black">{m.claimedAfter}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-neutral-500">
          <span className="font-black">Read the &ldquo;Claimed after&rdquo; column:</span> if step 0 claims ≫ step 4 claims, tighten the sequence. If step 4 is where most claim, the urgency framing works — consider bringing it earlier.
        </p>
      </div>
    </main>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-neutral-600 ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top text-[11.5px] text-neutral-800 ${className}`}>{children}</td>;
}
