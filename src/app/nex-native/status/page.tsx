// src/app/nex-native/status/page.tsx
//
// Public NEX Engine status page.
// ------------------------------
// Server Component. Anyone (signed-in or not) can hit this URL and see
// a plain green / amber / red signal that NEX Engine is running. The
// admin health surface at /api/nex-native/engine/health remains
// admin-gated · this page deliberately does NOT expose internal
// counters (queue depth · leased · oldest queued · memory · telemetry).
//
// The signal represents ACTUAL service ability, not process existence:
//
//   GREEN  = commercial-safe model registered
//             AND queue not overloaded
//             AND either (queue empty) OR (jobs completed recently)
//   AMBER  = capacity warm/hot
//             OR queue non-empty AND recent-completions rate positive
//             but slower than desired
//             OR queue non-empty AND recent completions in last hour
//             above the "workers appear alive" threshold
//   RED    = no commercial-safe model registered
//             OR capacity overloaded
//             OR queue non-empty AND zero completions in the last hour
//             (workers appear dead)
//
// Reads the same in-process service functions the admin surface uses,
// so there is no client fetch and no admin key on the wire.

import Link from "next/link";
import { getEngineHealthAggregate } from "@/lib/nex-native/engine-health-service";
import { NexNativeShell } from "../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicStatus = "green" | "amber" | "red";

interface PublicView {
  status: PublicStatus;
  label: string;
}

const DOT_CLASS: Record<PublicStatus, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const RING_CLASS: Record<PublicStatus, string> = {
  green: "ring-green-200",
  amber: "ring-amber-200",
  red: "ring-red-200",
};

export default async function Page() {
  const health = await getEngineHealthAggregate();

  // Licence gate · if the loaded model is not cleared for commercial
  // use, we do NOT expose its identity publicly and we set the status
  // to red.
  const commercialCleared = health.engine.active.commercialUsePermitted === true;
  if (!commercialCleared) {
    console.error(
      "[nex-native/status] engine model is not cleared for commercial use · hiding details on public page",
      {
        role: health.engine.active.role,
        modelId: health.engine.active.modelId,
        licenceSpdx: health.engine.active.licenceSpdx,
      },
    );
  }

  // Honest service-ability signal · combines model + capacity + recent
  // completion evidence. Never reports GREEN merely because the queue
  // is empty · we also require that the fleet is either idle-and-active
  // or actively completing jobs.
  const view: PublicView = deriveStatus(commercialCleared, health);

  const detailLine = commercialCleared && health.engine.active.modelId
    ? [health.engine.active.modelId, health.engine.active.licenceSpdx, health.engine.active.runtime]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(" · ")
    : "Unavailable";

  return (
    <NexNativeShell>
    <main className="mx-auto max-w-md px-4 py-10">
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-neutral-900">NEX Engine status</h1>
        <p className="text-xs text-neutral-500">
          A public signal of whether NEX is currently able to serve requests.
        </p>
      </header>

      <section
        className="rounded border border-neutral-200 bg-white p-6 shadow-sm"
        aria-live="polite"
      >
        <div className="flex items-center gap-4">
          <span
            className={`inline-block h-5 w-5 rounded-full ring-4 ${DOT_CLASS[view.status]} ${RING_CLASS[view.status]}`}
            aria-hidden
          />
          <div>
            <p className="text-base font-semibold text-neutral-900">{view.label}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{detailLine}</p>
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs text-neutral-500">
        <Link href="/nex-native/conversations" className="underline hover:text-neutral-800">
          Back to conversations
        </Link>
      </p>

      <footer className="mt-10 border-t border-neutral-200 pt-4 text-[11px] leading-relaxed text-neutral-400">
        NEX Engine is a NEX-owned generation engine powered by a replaceable local open-weight
        model backend.
      </footer>
    </main>
    </NexNativeShell>
  );
}

// ─── status derivation · service-ability, not process-existence ─────

function deriveStatus(
  commercialCleared: boolean,
  health: Awaited<ReturnType<typeof getEngineHealthAggregate>>,
): PublicView {
  // Hard red · no commercial-safe model → cannot serve
  if (!commercialCleared || !health.engine.active.modelId) {
    return { status: "red", label: "Unavailable" };
  }
  // Hard red · capacity signal says overloaded → cannot accept new work honestly
  if (health.capacity.status === "overloaded") {
    return { status: "red", label: "At capacity" };
  }
  // Hard red · queue has non-empty backlog but ZERO completions in the
  // last hour → workers appear dead · would-be requests would sit
  // indefinitely · report the honest signal so callers can retry later.
  const queueBacklog = health.capacity.queuedGlobal + health.capacity.leasedGlobal;
  const recentActivity = health.fleet_recent.completed + health.fleet_recent.failed;
  if (queueBacklog > 0 && recentActivity === 0) {
    return { status: "red", label: "Workers unresponsive" };
  }
  // Amber · warm or hot capacity signal · workers keeping up but backlog present
  if (health.capacity.status === "hot") {
    return { status: "amber", label: "Under heavy load" };
  }
  if (health.capacity.status === "warm") {
    return { status: "amber", label: "Under load" };
  }
  // Amber · queue has backlog but recent completions exist · workers are
  // still processing · signal that new work may take longer than usual.
  if (queueBacklog > 0 && recentActivity < 5) {
    return { status: "amber", label: "Draining backlog" };
  }
  // Green · healthy capacity, evidence of recent activity (or empty queue)
  return { status: "green", label: "All systems operating" };
}
