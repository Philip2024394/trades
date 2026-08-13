"use client";

// YourProjectView — Refacing Case resume surface. V6 remediation.
//
// Reads token from localStorage · fetches Case · renders honest summary:
//   · Header: NEX Refacing chip + Case ID short-form
//   · What NEX sees (existing_staircase.visible_components/visible_geometry
//     with per-field confidence markers per PR-16)
//   · What isn't confirmed yet (unknown_items[] · PR-16 truthfulness)
//   · What direction you're heading (customer_intent.feelings)
//   · Next action (context-dependent · adds photo · confirms observation ·
//     requests professional assessment)
//
// No prices anywhere (PR-13).
// No composed design shown unless selected_design is populated (PR-18).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, Loader2, Upload, MessageSquareQuote } from "lucide-react";
import type { RefacingCase } from "@/lib/nex/refacing/case-schema";
import type { SeeDirection } from "@/lib/nex/refacing/retrieval";
import { getTokenForCase, readCase, uploadBasePhoto } from "@/lib/nex/refacing/use-case";
import { ShowPanel } from "./ShowPanel";
import { FeelPanel } from "./FeelPanel";
import { SeeGrid } from "./SeeGrid";
import { SeeComparison } from "./SeeComparison";
import { LockConfirmation } from "./LockConfirmation";

type Props = { refacingCaseId: string };
type LoadState = "loading" | "no_token" | "not_found" | "ready" | "error";

export function YourProjectView({ refacingCaseId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [refacingCase, setRefacingCase] = useState<RefacingCase | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = getTokenForCase(refacingCaseId);
    if (!token) {
      setState("no_token");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const c = await readCase(refacingCaseId, token);
        if (!alive) return;
        setRefacingCase(c);
        setState("ready");
      } catch (err) {
        if (!alive) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [refacingCaseId]);

  if (state === "loading") {
    return (
      <div
        className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3"
        style={{ background: "var(--nex-cream, #F7F2E8)" }}
      >
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--nex-neutral-500, #6b6b6b)" }} />
        <div className="text-[13px]" style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
          Loading your project…
        </div>
      </div>
    );
  }

  if (state === "no_token" || state === "not_found") {
    return (
      <FallbackShell
        title="We can't open this project from this device"
        body="This Refacing project is stored to the device it was created on. Open it from that device — or start a new project here."
        cta="Start a new project"
        onCta={() => router.push("/nex-app/refacing")}
      />
    );
  }

  if (state === "error") {
    return (
      <FallbackShell
        title="Something went wrong loading your project"
        body={errorMsg ?? "Please try again in a moment."}
        cta="Try again"
        onCta={() => router.refresh()}
      />
    );
  }

  if (!refacingCase) return null;

  return (
    <JourneyRouter
      refacingCase={refacingCase}
      token={getTokenForCase(refacingCase.refacing_case_id) ?? ""}
      onUpdated={(updated) => setRefacingCase(updated)}
      onRefresh={() => router.refresh()}
    />
  );
}

/**
 * Progressive-disclosure switch on case.status. Each stage renders inside the
 * shared shell (header + status line + section container). Once one stage
 * completes, its `onXxx` handler updates the local Case + re-renders the next.
 *
 * Status → Panel:
 *   BASE_UPLOADED             → ShowPanel                (SEE UI · SHOW stage)
 *   BASE_CONFIRMED            → FeelPanel                (SEE UI · FEEL stage)
 *   INTENT_DEFINED            → SeeGrid                  (SEE UI · SEE stage · fetches directions)
 *   CONCEPT_READY             → SeeGrid or SeeComparison depending on local UI state
 *   DESIGN_SELECTED           → LockConfirmation         (SEE UI · LOCK screen)
 *   READY_FOR_ASSESSMENT+     → existing summary (Stage 8)
 *   Everything else           → existing summary (Stage 8)
 */
function JourneyRouter({
  refacingCase,
  token,
  onUpdated,
  onRefresh,
}: {
  refacingCase: RefacingCase;
  token: string;
  onUpdated: (updated: RefacingCase) => void;
  onRefresh: () => void;
}) {
  const [comparing, setComparing] = useState<SeeDirection | null>(null);

  // SEE UI stages
  if (refacingCase.status === "BASE_UPLOADED") {
    return (
      <JourneyShell refacingCase={refacingCase}>
        <ShowPanel
          refacingCase={refacingCase}
          token={token}
          onConfirmed={onUpdated}
        />
      </JourneyShell>
    );
  }
  if (refacingCase.status === "BASE_CONFIRMED") {
    return (
      <JourneyShell refacingCase={refacingCase}>
        <FeelPanel
          refacingCase={refacingCase}
          token={token}
          onIntentSubmitted={onUpdated}
        />
      </JourneyShell>
    );
  }
  if (refacingCase.status === "INTENT_DEFINED" || refacingCase.status === "CONCEPT_READY") {
    if (comparing) {
      return (
        <JourneyShell refacingCase={refacingCase}>
          <SeeComparison
            refacingCase={refacingCase}
            token={token}
            direction={comparing}
            onBack={() => setComparing(null)}
            onChosen={(updated) => {
              setComparing(null);
              onUpdated(updated);
            }}
          />
        </JourneyShell>
      );
    }
    return (
      <JourneyShell refacingCase={refacingCase}>
        <SeeGrid
          refacingCase={refacingCase}
          token={token}
          onOpenComparison={(d) => setComparing(d)}
        />
      </JourneyShell>
    );
  }
  if (refacingCase.status === "DESIGN_SELECTED") {
    return (
      <JourneyShell refacingCase={refacingCase}>
        <LockConfirmation
          refacingCase={refacingCase}
          onRequestAssessment={() => {
            // MVP · surface the existing attach-contact flow via a simple prompt.
            // A full contact-modal is out of scope for SEE UI · Stage 8's attach-contact
            // endpoint remains the mechanism · client-side modal wiring is a future task.
            alert(
              "The professional-assessment step opens the contact form (Stage 8 · attach-contact). Wire-in to a modal is a future task outside SEE UI scope."
            );
          }}
          onChangeDirection={() => {
            // Reset to CONCEPT_READY so the customer can pick again.
            // Uses the existing PATCH endpoint · fire-and-forget for MVP.
            fetch(
              `/api/nex/refacing/cases/${encodeURIComponent(refacingCase.refacing_case_id)}?token=${encodeURIComponent(token)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  next_status: "CONCEPT_READY",
                  patch: { selected_design: undefined, composition_provenance: [] },
                }),
              }
            ).then(() => onRefresh());
          }}
        />
      </JourneyShell>
    );
  }

  // READY_FOR_ASSESSMENT and later stages fall back to the existing summary.
  return <ProjectSummary refacingCase={refacingCase} onRefresh={onRefresh} />;
}

/**
 * Shared shell for the SEE UI stages · header + status line + column layout.
 * Uses the same responsive wrapper as ProjectSummary so all stages share
 * visual language.
 */
function JourneyShell({
  refacingCase,
  children,
}: {
  refacingCase: RefacingCase;
  children: React.ReactNode;
}) {
  const startedOn = formatStartedDate(refacingCase.created_at);
  const homeownerStatus = homeownerStatusLabel(refacingCase.status);
  return (
    <div
      className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden"
      style={{ background: "var(--nex-cream, #F7F2E8)" }}
    >
      <header className="px-5 pt-8 pb-3">
        <div
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--nex-accent-500, #8B7355)" }}
        >
          NEX Refacing · your project
        </div>
        <h1
          className="mt-1 text-[22px] font-semibold leading-tight"
          style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
        >
          Your staircase project
        </h1>
        <div
          className="mt-1 text-[11px]"
          style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
        >
          Started {startedOn} · {homeownerStatus}
        </div>
      </header>
      {children}
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────

function ProjectSummary({
  refacingCase,
  onRefresh,
}: {
  refacingCase: RefacingCase;
  onRefresh: () => void;
}) {
  const photoCount = refacingCase.existing_staircase.photos.length;
  const feelings = refacingCase.customer_intent.feelings;
  const hasDesign = Boolean(refacingCase.selected_design);
  const hasContact = Boolean(refacingCase.contact);
  const startedOn = formatStartedDate(refacingCase.created_at);
  const homeownerStatus = homeownerStatusLabel(refacingCase.status);

  return (
    <div
      className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden"
      style={{ background: "var(--nex-cream, #F7F2E8)" }}
    >
      <header className="px-5 pt-8 pb-3">
        <div
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--nex-accent-500, #8B7355)" }}
        >
          NEX Refacing · your project
        </div>
        <h1
          className="mt-1 text-[22px] font-semibold leading-tight"
          style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
        >
          Your staircase project
        </h1>
        <div
          className="mt-1 text-[11px]"
          style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
        >
          Started {startedOn} · {homeownerStatus}
        </div>
      </header>

      {/* ── Existing staircase (BASE photos) ── */}
      <section className="px-5 pb-3">
        <SectionCard title="Your existing staircase">
          {photoCount === 0 ? (
            <EmptyPhotoState refacingCaseId={refacingCase.refacing_case_id} onUpdated={onRefresh} />
          ) : (
            <div
              className="text-[13px]"
              style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}
            >
              {photoCount === 1
                ? "1 photo of your staircase attached."
                : `${photoCount} photos of your staircase attached.`}
            </div>
          )}
        </SectionCard>
      </section>

      {/* ── What NEX can see + what isn't confirmed (PR-16 truthfulness) ── */}
      <section className="px-5 pb-3">
        <SectionCard title="What NEX has noted">
          {refacingCase.existing_staircase.visible_components?.length ? (
            <ul className="mt-1 space-y-1">
              {refacingCase.existing_staircase.visible_components.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[13px]"
                  style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}
                >
                  <CheckCircle2
                    size={14}
                    className="mt-0.5 flex-shrink-0"
                    style={{ color: "var(--nex-accent-500, #8B7355)" }}
                  />
                  <span>
                    {friendlyRole(c.component_role)}
                    {c.count ? ` · ${c.count} visible` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div
              className="text-[13px]"
              style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
            >
              Analysis pending. Once your photo is processed, NEX will list what
              it can see here.
            </div>
          )}

          {refacingCase.unknown_items.length > 0 && (
            <div
              className="mt-3 rounded-lg p-3 text-[12px]"
              style={{
                background: "var(--nex-cream, #F7F2E8)",
                border: "1px dashed var(--nex-neutral-200, #E7E1D2)",
                color: "var(--nex-neutral-700, #3d3d3d)",
              }}
            >
              <div className="mb-1 flex items-center gap-1 font-semibold">
                <Info size={12} style={{ color: "var(--nex-neutral-500, #6b6b6b)" }} />
                What isn&apos;t confirmed from a photo
              </div>
              <ul className="ml-4 list-disc space-y-1">
                {refacingCase.unknown_items.map((u, i) => (
                  <li key={i}>{u.reason}</li>
                ))}
              </ul>
              <div
                className="mt-2 text-[11px] italic"
                style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
              >
                A local staircase professional will confirm these during survey.
              </div>
            </div>
          )}
        </SectionCard>
      </section>

      {/* ── Direction (from FEEL) ── */}
      {feelings.length > 0 && (
        <section className="px-5 pb-3">
          <SectionCard title="Direction you&apos;re heading">
            <div className="mt-1 flex flex-wrap gap-2">
              {feelings.map((f) => (
                <span
                  key={f}
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{
                    background: "var(--nex-accent-50, #F1EBDD)",
                    color: "var(--nex-accent-500, #8B7355)",
                    border: "1px solid var(--nex-accent-500, #8B7355)",
                  }}
                >
                  {friendlyFeeling(f)}
                </span>
              ))}
            </div>
          </SectionCard>
        </section>
      )}

      {/* ── Selected design (PR-18 provenance summary) ── */}
      {hasDesign && refacingCase.selected_design && (
        <section className="px-5 pb-3">
          <SectionCard title="Design you chose">
            <div
              className="text-[15px] font-semibold"
              style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
            >
              {refacingCase.selected_design.name}
            </div>
            <div
              className="mt-1 text-[12px]"
              style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
            >
              {refacingCase.selected_design.reason_for_existing}
            </div>
            <div
              className="mt-1 text-[12px]"
              style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}
            >
              {refacingCase.selected_design.key_materials_description}
            </div>
            <div
              className="mt-2 text-[10px] italic"
              style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
            >
              Every element comes from a real staircase design in the NEX library.
            </div>
          </SectionCard>
        </section>
      )}

      {/* ── Next action ── */}
      <section className="px-5 pb-8 pt-2">
        <NextActionBlock
          hasPhoto={photoCount > 0}
          hasDesign={hasDesign}
          hasContact={hasContact}
        />
      </section>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--nex-cream-elev, #FFFFFF)",
        border: "1px solid var(--nex-neutral-200, #E7E1D2)",
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
      >
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyPhotoState({
  refacingCaseId,
  onUpdated,
}: {
  refacingCaseId: string;
  onUpdated: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <div
        className="text-[13px]"
        style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}
      >
        No photo attached yet. Once NEX has your existing staircase we can
        show you what it could become.
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-95"
        style={{
          background: "var(--nex-neutral-900, #1a1a1a)",
          color: "var(--nex-cream, #F7F2E8)",
        }}
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        Add a photo now
      </button>
      {err && (
        <div className="mt-2 text-[11px]" style={{ color: "#7A1F1F" }}>
          {err}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const token = getTokenForCase(refacingCaseId);
          if (!token) {
            setErr("Can't attach — no access token in this browser.");
            return;
          }
          setUploading(true);
          setErr(null);
          try {
            await uploadBasePhoto(refacingCaseId, token, file);
            onUpdated();
          } catch (uploadErr) {
            setErr(uploadErr instanceof Error ? uploadErr.message : String(uploadErr));
          } finally {
            setUploading(false);
          }
        }}
      />
    </div>
  );
}

function NextActionBlock({
  hasPhoto,
  hasDesign,
  hasContact,
}: {
  hasPhoto: boolean;
  hasDesign: boolean;
  hasContact: boolean;
}) {
  if (!hasPhoto) {
    return (
      <SectionCard title="Next">
        <div className="text-[13px]" style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
          Add a photo of your staircase to continue.
        </div>
      </SectionCard>
    );
  }
  if (!hasDesign) {
    return (
      <SectionCard title="Next">
        <div className="text-[13px]" style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
          Tell NEX how you want your staircase to feel. We&apos;ll suggest a
          few complete design directions.
        </div>
      </SectionCard>
    );
  }
  if (!hasContact) {
    return (
      <SectionCard title="Ready to take the next step?">
        <div className="text-[13px]" style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
          Your staircase design is ready to send to a suitable local staircase
          professional.
        </div>
        <button
          type="button"
          className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition active:scale-95"
          style={{
            background: "var(--nex-neutral-900, #1a1a1a)",
            color: "var(--nex-cream, #F7F2E8)",
          }}
        >
          <MessageSquareQuote size={16} />
          Request a professional assessment
        </button>
        <div
          className="mt-2 text-[11px] italic"
          style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
        >
          No obligation. A suitable local staircase professional will review
          your project.
        </div>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Connected">
      <div className="text-[13px]" style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
        Your project has been sent to a local staircase professional for review.
        You&apos;ll hear back with a professional assessment within 24 hours.
      </div>
    </SectionCard>
  );
}

function FallbackShell({
  title,
  body,
  cta,
  onCta,
}: {
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
      style={{ background: "var(--nex-cream, #F7F2E8)" }}
    >
      <div
        className="text-[18px] font-semibold"
        style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
      >
        {title}
      </div>
      <div
        className="text-[13px] leading-snug"
        style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
      >
        {body}
      </div>
      <button
        type="button"
        onClick={onCta}
        className="mt-3 rounded-xl px-4 py-2 text-[13px] font-semibold transition active:scale-95"
        style={{
          background: "var(--nex-neutral-900, #1a1a1a)",
          color: "var(--nex-cream, #F7F2E8)",
        }}
      >
        {cta}
      </button>
    </div>
  );
}

/**
 * homeowner-facing status labels · rewritten from the internal CaseStatus enum.
 * Never expose the raw enum. If a new CaseStatus lands upstream and isn't
 * mapped here, the fallback renders a neutral generic phrase rather than
 * leaking the enum value.
 */
function homeownerStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "Getting started",
    AWAITING_BASE_STAIRCASE: "Waiting for your photo",
    BASE_UPLOADED: "Photo received",
    BASE_CONFIRMED: "Photo confirmed",
    INTENT_DEFINED: "Direction captured",
    CONCEPT_READY: "Design ideas ready",
    DESIGN_SELECTED: "Design chosen",
    READY_FOR_ASSESSMENT: "Ready for a professional",
    CONNECTED: "With a local professional",
    SURVEYING: "Being surveyed",
    QUOTED: "Quote received",
    CONTRACTED: "Work agreed",
    COMPLETED: "Complete",
    CANCELLED: "Cancelled",
  };
  return map[s] ?? "In progress";
}

/**
 * Format `created_at` as "12 Aug" · homeowner-friendly · locale-aware.
 * Falls back to an empty string if the timestamp is unparseable so the
 * header never renders "Invalid Date".
 */
function formatStartedDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function friendlyRole(role: string): string {
  const map: Record<string, string> = {
    baluster: "Balusters visible",
    newel: "Newel post visible",
    handrail: "Handrail visible",
    tread: "Treads visible",
    riser: "Risers visible",
    stringer: "Stringer visible",
    whole_staircase: "Full staircase",
  };
  return map[role] ?? role;
}

function friendlyFeeling(f: string): string {
  return f.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}
