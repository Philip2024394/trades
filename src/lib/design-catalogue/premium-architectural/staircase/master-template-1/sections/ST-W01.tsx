// NEX Master Template 1 · Section W01 · Guided Design (Philip 2026-08-17).
//
// STANDING. Renders the 14-node staircase discovery wizard, consuming
// the frozen research corpus via `@/lib/staircase-knowledge`. Never
// touches the JSON files directly · never asks the customer to hold
// professional vocabulary · never calculates measurements · every
// "I'm not sure" opens a visual comparison overlay so the customer
// chooses visually FIRST and learns terminology AFTER.
//
// Three surface modes:
//   • idle     · compact invitation card ("Start Guided Design")
//   • active   · one question at a time · Back · progress · Reset
//   • complete · summary of choices · Edit · Send to specialist
//
// Writes to StaircaseDesign context as the customer progresses (so
// downstream sections like ST-M01 see the customer's picks in real
// time). The wizard itself does NOT persist state beyond the session
// — refresh returns the customer to `idle` unless StaircaseDesign
// picks up persistence later.
//
// Overlays (visual comparison + specialist handoff) are portalled to
// document.body to escape the Reveal wrapper's transform-based
// containing block · same pattern established by
// ST-M01 > OwnerChatOverlay and ST-P01 > ProductLightbox.
//
// Styled-jsx scoping doctrine (2026-08-17): every sub-component that
// renders unique classes owns its own <style jsx> block · the parent's
// scope hash does not reach sub-component JSX.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { StaircaseDesignState } from "../StaircaseDesign";
import { useStaircaseDesign } from "../StaircaseDesign";
import { MT1_TOKENS as T } from "../tokens";
import {
  getAlternatives,
  getCustomerExplanation,
  getDecisionNode,
  getNextNodeId,
  getRegionalPack,
  getRootNodeId,
  getSpecialistReviewRequirement,
  type CountryCode,
  type DecisionOption,
  type WizardNode,
} from "@/lib/staircase-knowledge";

// ─── Field mapping · which decision-tree node writes which design field ─
// Nodes not listed here don't persist to StaircaseDesign (they capture
// transient preferences like the extras multi-select and landing hint).

const NODE_TO_FIELD: Record<string, keyof StaircaseDesignState> = {
  // Design questions (Q1 – Q13) — physical + aesthetic design decisions.
  Q1_country: "country",
  Q2_use: "use",
  Q3_geometry: "geometry",
  Q4_material_family: "materialFamily",
  Q5_structural: "string",
  Q6_riser: "riser",
  Q6_riser_closed_string: "riser",
  Q6_riser_open_riser: "riser",
  Q6_riser_cut_string_double: "riser",
  Q6a_riser_wood_species: "wood",
  Q6c_riser_wood_species_override: "riserWood",
  Q9a_handrail_wood_species: "handrailWood",
  Q7_tread_material: "tread",
  Q7a_timber_species: "treadWood",
  Q8_balustrade_material: "balustrade",
  Q_handrail_position: "handrailPosition",
  Q9_handrail_material: "handrail",
  Q10_newel: "newel",
  Q12_finish: "finish",
  // Project classification (Philip 2026-08-18 · one-pass expansion).
  // Grouped in the summary snapshot as PROJECT / CUSTOMER / COMMERCIAL.
  Q_property_type: "propertyType",
  Q_build_stage: "buildStage",
  Q_replace_existing: "replaceExisting",
  Q_opening_ready: "openingReady",
  Q_customer_type: "customerType",
  Q_vat_status: "vatStatus",
  Q_install_required: "installRequired",
  Q_supply_market: "supplyMarket",
  Q_export_country: "exportCountry",
  Q_project_stage: "projectStage",
  Q_notes: "notes",
};

/** Sentinel written into `answers[nodeId]` when the customer picks the
 *  injected "I'm not sure" chip on a node with no visual comparison
 *  available. Never written into StaircaseDesign. Consumed by summary
 *  render + Submission builder to flag fields for the specialist. */
const UNKNOWN_VALUE = "__unknown__";

/** Nodes whose options are country selectors. When the wizard renders
 *  one of these nodes, each option button gets a round flag image
 *  before its label (Philip 2026-08-18). Kept as a Set so future
 *  country nodes (e.g. Q_export_country for the export-supply branch)
 *  inherit the treatment by name — no per-node OptionCard branching. */
const COUNTRY_NODE_IDS = new Set<string>(["Q1_country", "Q_export_country"]);

/** Nodes whose option images are plan-view drawings rather than photos.
 *  These render with the image on the LEFT of the card (portrait thumb
 *  + label + description on the right) so the customer reads the plan
 *  alongside the shape name (Philip 2026-08-18 · Q3_geometry). Same
 *  set-based pattern as COUNTRY_NODE_IDS — future plan-image questions
 *  join by adding their nodeId here. */
const SIDE_IMAGE_NODE_IDS = new Set<string>(["Q2_use", "Q3_geometry", "Q4_material_family", "Q6_riser_closed_string", "Q6_riser_open_riser", "Q6_riser_cut_string_double", "Q6a_riser_wood_species", "Q6c_riser_wood_species_override", "Q7a_timber_species", "Q9a_handrail_wood_species"]);
// Nodes whose option thumbnails are photorealistic tiles (fill container
// edge-to-edge · click enlarges). Q3 stays diagram-mode (contain fit ·
// no enlarge) so plan drawings are not cropped (Philip 2026-08-19).
// Q6_riser (generic 3-option fallback) is text-only · no images yet.
// Q6_riser_closed_string was removed from photo mode 2026-08-19 · Philip
// — images have white backgrounds designed to sit fully inside the
// frame; cover-fit was cropping them. Now uses contain fit with padding.
const PHOTO_IMAGE_NODE_IDS = new Set<string>(["Q2_use", "Q4_material_family", "Q6_riser_open_riser", "Q6_riser_cut_string_double"]);
// Nodes whose option thumbnails render on a WHITE background instead
// of the default warm-cream surfaceSoft (Philip 2026-08-20 · Q6a
// species swatches). Wood-grain swatches read cleaner against white
// than against cream. Extend by adding node IDs — Q7a species will
// join here when we add swatch metadata to that node.
const WHITE_THUMB_BG_NODE_IDS = new Set<string>(["Q6a_riser_wood_species", "Q6c_riser_wood_species_override", "Q6_riser_closed_string", "Q5_structural", "Q7a_timber_species", "Q9a_handrail_wood_species"]);
// Nodes whose side-layout thumbs should render at a LARGER size than
// the default 108px width — for questions where source images have
// significant baked-in padding that makes subjects read too small at
// the default size (Philip 2026-08-20 · Q6_riser_closed_string chrome
// bar + clear glass options). Doesn't fix root cause (source images
// need re-cropping) but grows the container so subjects are more
// readable. Applies only to side layout — top-layout thumbs are
// already full card width.
const LARGE_THUMB_NODE_IDS = new Set<string>(["Q6_riser_closed_string"]);
// Wood-species picker nodes · main swatch fills the container
// edge-to-edge (object-fit: cover · padding: 0) so the wood grain
// reads full-size (Philip 2026-08-20). Composes ON TOP of the
// WHITE_THUMB modifier (still gets the white background) — only
// overrides the fit + padding for the species swatches. Q5
// structural and Q6_riser_closed_string keep contain fit because
// their images have significant padding baked in that must stay
// visible (staircase designs / riser style shots).
const WOOD_SPECIES_NODE_IDS = new Set<string>([
  "Q6a_riser_wood_species",
  "Q6c_riser_wood_species_override",
  "Q7a_timber_species",
  "Q9a_handrail_wood_species",
]);
// Nodes where the "I want this staircase — quote me" shortcut pill is
// shown inside the enlarged lightbox (Philip 2026-08-20). Q6 onwards
// because by then enough design state has been captured (material,
// use, geometry, structural, riser) for the Submission to be useful
// to the specialist even without the downstream questions. Earlier
// questions (Q1-Q5) don't show the pill — not enough data captured
// yet for a meaningful photo-reference Submission.
const SHORTCUT_ELIGIBLE_NODE_IDS = new Set<string>([
  "Q6_riser",
  "Q6_riser_closed_string",
  "Q6_riser_open_riser",
  "Q6_riser_cut_string_double",
  "Q6a_riser_wood_species",
  "Q6c_riser_wood_species_override",
  "Q7_tread_material",
  "Q7a_timber_species",
  "Q8_balustrade_material",
  "Q_handrail_position",
  "Q9_handrail_material",
  "Q9a_handrail_wood_species",
  "Q10_newel",
  "Q11_landing",
  "Q12_finish",
  "Q13_extras",
]);
// Human-readable labels for the option.usage tag (Philip 2026-08-19 ·
// Q5_structural). Rendered as a chip on the card. Values mirror the
// three-state schema in DecisionOption.usage.
const USAGE_LABELS = {
  private_residence: "Private residence",
  commercial: "Commercial",
  both: "Private residence or commercial",
} as const;

// Human-readable labels for the option.hardness tag (Philip 2026-08-19 ·
// Q6a / Q7a timber species). Rendered inline in the metadata line
// alongside origin. Enum→label lookup so canonical identity stays in
// the data.
const HARDNESS_LABELS = {
  hardwood: "Hardwood",
  softwood: "Softwood",
} as const;

/** Returns true when `option` should be shown given the customer's
 *  current answers. Uses the option's `compatible_with` gate — for
 *  each prerequisite nodeId in the gate, the customer's answer must
 *  be in the allow-list. Missing gate = always compatible. Missing or
 *  UNKNOWN prerequisite answer = gate skipped (No-Forced-Decisions
 *  upstream must never restrict downstream · Philip 2026-08-19).
 *  Used to filter Q5 structural options by Q4 material (wood-maker
 *  fulfillment constraint). */
function isOptionCompatible(
  option: DecisionOption,
  answers: Record<string, string>,
): boolean {
  if (!option.compatible_with) return true;
  for (const [nodeId, allowedValues] of Object.entries(option.compatible_with)) {
    const answer = answers[nodeId];
    if (!answer || answer === UNKNOWN_VALUE) continue;
    if (!allowedValues.includes(answer)) return false;
  }
  return true;
}

/** Map a Q1_country option value to its flag URL. The corpus uses `UK`
 *  as an internal country code · flagcdn/ISO-3166 uses `gb`, so we map
 *  that one case explicitly and lowercase everything else. The `OTHER`
 *  ("Somewhere else") option has no flag by design · handled by the
 *  caller checking for null. */
function getCountryFlagUrl(value: string): string | null {
  if (!value || value === "OTHER") return null;
  const iso = value === "UK" ? "gb" : value.toLowerCase();
  // flagcdn.com serves public-domain Wikipedia flag PNGs at fixed widths.
  // w80 = 80px wide; scales down cleanly for the 28px round container.
  return `https://flagcdn.com/w80/${iso}.png`;
}

const ORDERED_NODE_IDS = [
  // Design questions · country → material → use → geometry → structural
  // → riser (Philip 2026-08-19). Material is asked FIRST after country
  // because it matches the fulfillment pool (wood-specialist vs
  // metal-fabricator vs bespoke) — every downstream design question
  // then filters to combinations that pool can deliver. Q5 uses
  // compatible_with to hide structural types the customer's material
  // can't fulfil (wood never sees mono/cantilever/bolt_fixed; metal-only
  // never sees cut_string; etc). Spiral / helical geometry paths bypass
  // Q5 via Q3's conditional_next, going straight to Q5b/Q5c and then
  // to Q6.
  "Q1_country", "Q4_material_family", "Q2_use", "Q3_geometry",
  "Q5_structural", "Q5b_central_column", "Q5c_helical_structure",
  "Q6_riser", "Q6_riser_closed_string", "Q6_riser_open_riser", "Q6_riser_cut_string_double", "Q6a_riser_wood_species", "Q6b_wood_customize", "Q6c_riser_wood_species_override", "Q7_tread_material", "Q7a_timber_species", "Q9a_handrail_wood_species",
  "Q8_balustrade_material", "Q_handrail_position", "Q9_handrail_material", "Q10_newel",
  "Q11_landing", "Q12_finish", "Q13_extras",
  // Project classification (Philip 2026-08-18)
  "Q_property_type", "Q_build_stage", "Q_replace_existing", "Q_opening_ready",
  "Q_customer_type", "Q_vat_status",
  "Q_install_required", "Q_supply_market", "Q_export_country", "Q_project_stage",
  "Q_attachments_info", "Q_notes",
  // Final review
  "Q14_summary",
];

type Mode = "idle" | "active" | "complete";

/** Optional props for embedded callers (Philip 2026-08-18 · wizard now
 *  activates only from the "Get A Quote" staircase-quote button surfaced
 *  inside ST-CH01). When both props are omitted the wizard renders its
 *  original standalone section behaviour · IdleCard first, no exit hook
 *  · so existing QA surface is unchanged for anything still testing the
 *  wizard in isolation. */
type STW01Props = {
  /** Skip the IdleCard invitation and jump directly to the first
   *  question. Used when the caller has already collected the "yes,
   *  I want the wizard" signal (e.g. the customer just clicked "Start
   *  guided design" in the chat). */
  autoStart?: boolean;
  /** Optional hook the caller passes when the wizard is embedded inside
   *  another surface (chat overlay, dialog, drawer). Reserved · the
   *  caller currently owns its own close chrome, so this hook is not
   *  invoked by the wizard yet · declared here so future integration
   *  (e.g. "close automatically after Send-to-specialist succeeds")
   *  doesn't need another prop-shape change. */
  onExit?: () => void;
  /** Optional handler the caller wires when the customer picks the
   *  "I already know what I want" tile on the two-tile IdleCard
   *  (Philip 2026-08-20). Fires only in idle mode. Caller is expected
   *  to close the wizard overlay + open the Summit chat (ST-CH01) so
   *  the customer can upload photo/plan and chat with a specialist.
   *  When NOT supplied (e.g. dev preview, standalone embed), the tile
   *  falls back to opening the wizard's own HandoffOverlay — the
   *  summary-card path — so the choice is never a dead-end. */
  onSkipToChat?: () => void;
};

export function STW01({
  autoStart = false,
  onExit: _onExit,
  onSkipToChat,
}: STW01Props = {}) {
  const { design, set: setDesign, reset: resetDesign } = useStaircaseDesign();

  const [mode, setMode] = useState<Mode>(autoStart ? "active" : "idle");
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(
    autoStart ? getRootNodeId() : null,
  );
  const [history, setHistory] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [compareForNodeId, setCompareForNodeId] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const country = (design.country as CountryCode | undefined) ?? undefined;
  const currentNode = useMemo<WizardNode | undefined>(
    () => (currentNodeId ? getDecisionNode(currentNodeId, country) : undefined),
    [currentNodeId, country],
  );

  const progressIndex = currentNodeId
    ? Math.max(0, ORDERED_NODE_IDS.indexOf(currentNodeId))
    : -1;
  const progressTotal = ORDERED_NODE_IDS.length - 1; // exclude Q14_summary

  const specialistFlag = useMemo(() => {
    const base = getSpecialistReviewRequirement({
      ...answers,
      use: answers.Q2_use,
    });
    if (base.required) return base;
    const unknowns = Object.entries(answers).filter(
      ([, v]) => v === UNKNOWN_VALUE,
    );
    if (unknowns.length > 0) {
      return {
        required: true,
        reason: `${unknowns.length} choice${unknowns.length === 1 ? "" : "s"} marked "not sure" — a specialist will help you decide these.`,
      };
    }
    return base;
  }, [answers]);

  const start = useCallback(() => {
    setMode("active");
    setCurrentNodeId(getRootNodeId());
    setHistory([]);
    setAnswers({});
  }, []);

  const reset = useCallback(() => {
    setMode("idle");
    setCurrentNodeId(null);
    setHistory([]);
    setAnswers({});
    resetDesign();
  }, [resetDesign]);

  const back = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      setCurrentNodeId(prev[prev.length - 1]);
      return next;
    });
  }, []);

  const advanceTo = useCallback(
    (fromNodeId: string, nextAnswers: Record<string, string>, pickedValue: string) => {
      const nextId = getNextNodeId(fromNodeId, pickedValue, nextAnswers);
      if (!nextId) {
        setMode("complete");
        setCurrentNodeId("Q14_summary");
        return;
      }
      if (nextId === "handoff_professional") {
        setMode("complete");
        setHandoffOpen(true);
        return;
      }
      // If the next node is the review screen (Q14_summary), transition
      // straight to CompleteCard rather than trying to render the review
      // node itself as an ActiveCard (Philip 2026-08-18). Q_notes (and
      // historically Q13_extras) both point next → Q14_summary — without
      // this branch the wizard would leave the customer stranded on a
      // review-screen node with no options.
      const nextNode = getDecisionNode(nextId, nextAnswers.Q1_country as CountryCode | undefined);
      if (nextNode?.type === "review_screen") {
        setMode("complete");
        setCurrentNodeId(nextId);
        return;
      }
      setHistory((prev) => [...prev, fromNodeId]);
      setCurrentNodeId(nextId);
    },
    [],
  );

  const pickValue = useCallback(
    (nodeId: string, value: string, extras?: Record<string, string>) => {
      // `extras` lets a quick-pick shortcut (e.g. handrail thumbnails
      // inside the Straight card) record a downstream answer in the
      // same click. Purely additive · omitted = old single-field behaviour.
      const nextAnswers = { ...answers, [nodeId]: value, ...(extras ?? {}) };
      setAnswers(nextAnswers);
      const field = NODE_TO_FIELD[nodeId];
      if (field) setDesign(field, value);
      if (extras) {
        for (const [extraNodeId, extraValue] of Object.entries(extras)) {
          const extraField = NODE_TO_FIELD[extraNodeId];
          if (extraField) setDesign(extraField, extraValue);
        }
      }
      advanceTo(nodeId, nextAnswers, value);
    },
    [advanceTo, answers, setDesign],
  );

  /** Principle 2 · consistent "I'm not sure" behaviour.
   *  Fires when the customer clicks the injected chip on any node.
   *  Records the selection as UNKNOWN in the answers map (so the
   *  summary + Submission can flag it) · never writes UNKNOWN into
   *  StaircaseDesign (the design keeps only real selections) ·
   *  advances to the next node via the default `else`/`next` route. */
  const pickUnknown = useCallback(
    (nodeId: string) => {
      const nextAnswers = { ...answers, [nodeId]: UNKNOWN_VALUE };
      setAnswers(nextAnswers);
      const field = NODE_TO_FIELD[nodeId];
      if (field) setDesign(field, undefined);
      advanceTo(nodeId, nextAnswers, UNKNOWN_VALUE);
    },
    [advanceTo, answers, setDesign],
  );

  const openCompare = useCallback((nodeId: string) => {
    setCompareForNodeId(nodeId);
  }, []);

  return (
    <section
      id="guided-design"
      className="mt1-w01"
      aria-label="Guided staircase design"
      data-testid="mt1-w01"
    >
      <div className="mt1-w01-inner">
        {mode === "idle" && (
          <IdleCard
            onStart={start}
            onSkipToChat={
              // Caller-supplied handler wins (e.g. ST-H01 closes wizard
              // overlay + opens ST-CH01 Summit chat). Fallback keeps
              // dev-preview / standalone embeds functional by opening
              // the wizard's own HandoffOverlay summary path.
              onSkipToChat ?? (() => setHandoffOpen(true))
            }
          />
        )}

        {mode === "active" && currentNode && (
          <ActiveCard
            node={currentNode}
            country={country}
            answers={answers}
            canGoBack={history.length > 0}
            progressIndex={progressIndex}
            progressTotal={progressTotal}
            onPick={(v, extras) => pickValue(currentNode.id, v, extras)}
            onNotSure={() => {
              const hasCompare = !!getAlternatives(currentNode.id);
              if (hasCompare) openCompare(currentNode.id);
              else pickUnknown(currentNode.id);
            }}
            onBack={back}
            onReset={reset}
          />
        )}

        {mode === "complete" && (
          <CompleteCard
            answers={answers}
            country={country}
            specialistFlag={specialistFlag}
            onEdit={start}
            onReset={reset}
            onSend={() => setHandoffOpen(true)}
          />
        )}
      </div>

      {compareForNodeId && (
        <CompareOverlay
          nodeId={compareForNodeId}
          onPick={(v) => {
            const nid = compareForNodeId;
            setCompareForNodeId(null);
            if (nid) pickValue(nid, v);
          }}
          onClose={() => setCompareForNodeId(null)}
        />
      )}

      {handoffOpen && (
        <HandoffOverlay
          answers={answers}
          country={country}
          specialistFlag={specialistFlag}
          onClose={() => setHandoffOpen(false)}
        />
      )}

      <style jsx>{`
        .mt1-w01 {
          background: ${T.color.surface};
          padding: ${T.spacing.sectionPaddingBlock} 16px;
          font-family: ${T.font.sans};
          color: ${T.color.ink};
        }
        .mt1-w01-inner {
          max-width: 920px;
          margin: 0 auto;
        }
      `}</style>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Idle · compact invitation
// ═══════════════════════════════════════════════════════════════════

function IdleCard({
  onStart,
  onSkipToChat,
}: {
  onStart: () => void;
  onSkipToChat: () => void;
}) {
  return (
    <div className="idle" data-testid="mt1-w01-idle">
      <div className="eyebrow">Get started</div>
      <h2 className="title">Ready to plan your staircase?</h2>
      <p className="body">
        Two ways to move forward — pick whichever fits where you are today.
      </p>

      <div className="tile-grid">
        {/* Tile A · Philip 2026-08-20 · fast path. Customer has plans,
            photos or a clear brief already — opens NEX Chat directly
            (existing HandoffOverlay) so they can upload straight to a
            staircase specialist. No wizard state captured; specialist
            gathers everything conversationally. */}
        <button
          type="button"
          className="tile tile-fast"
          onClick={onSkipToChat}
          data-testid="mt1-w01-idle-skip-to-chat"
        >
          <div className="tile-icon" aria-hidden>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-4.586-4.586a2 2 0 0 0-2.828 0L3 21" />
            </svg>
          </div>
          <h3 className="tile-title">I already know what I want</h3>
          <p className="tile-body">
            Skip the wizard — go straight to a staircase specialist. Upload
            your photo, drawing or plans in the chat and share the details
            that matter to you.
          </p>
          <div className="tile-cta">
            Send to specialist <span aria-hidden>→</span>
          </div>
        </button>

        {/* Tile B · Philip 2026-08-20 · guided path. Current default
            wizard flow. Fires the existing start() action to advance
            through Q1 country → Q4 material → … */}
        <button
          type="button"
          className="tile tile-guided"
          onClick={onStart}
          data-testid="mt1-w01-idle-start"
        >
          <div className="tile-icon" aria-hidden>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <h3 className="tile-title">Help me design my staircase</h3>
          <p className="tile-body">
            Guided walkthrough — answer a short set of visual questions and
            we&apos;ll turn your ideas into a clear specification. No
            measurements. No prices. Just your choices, made simple.
          </p>
          <div className="tile-cta">
            Start guided design <span aria-hidden>→</span>
          </div>
        </button>
      </div>

      <div className="footnote">
        You can leave the guided walkthrough at any point · your choices
        are saved as you go.
      </div>

      <style jsx>{`
        .idle {
          background: ${T.color.surfaceSoft};
          border-radius: 16px;
          padding: clamp(28px, 4vw, 48px) clamp(20px, 3vw, 36px);
          text-align: center;
        }
        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.color.accent};
          font-weight: 700;
        }
        .title {
          font-family: ${T.font.serif};
          font-size: clamp(22px, 4vw, 32px);
          font-weight: 400;
          margin: 10px 0 10px;
          color: ${T.color.ink};
          line-height: 1.15;
        }
        .body {
          max-width: 520px;
          margin: 0 auto 26px;
          font-size: 14px;
          line-height: 1.55;
          color: ${T.color.inkMuted};
        }
        .tile-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin: 0 auto;
          max-width: 720px;
        }
        @media (min-width: 720px) {
          .tile-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: clamp(20px, 3vw, 28px);
          background: ${T.color.surface};
          border: 1.5px solid ${T.color.hairline};
          border-radius: 14px;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 140ms, transform 140ms, box-shadow 140ms;
        }
        .tile:hover,
        .tile:focus-visible {
          border-color: ${T.color.accent};
          transform: translateY(-2px);
          box-shadow: 0 14px 30px -18px rgba(58, 52, 40, 0.35);
          outline: none;
        }
        .tile-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: ${T.color.seal};
          color: ${T.color.accentDeep};
          margin-bottom: 14px;
        }
        .tile-fast .tile-icon {
          background: ${T.color.accent};
          color: #FFFFFF;
        }
        .tile-title {
          font-family: ${T.font.serif};
          font-size: clamp(17px, 2.4vw, 20px);
          font-weight: 400;
          margin: 0 0 8px;
          color: ${T.color.ink};
          line-height: 1.2;
        }
        .tile-body {
          font-size: 13px;
          line-height: 1.55;
          color: ${T.color.inkMuted};
          margin: 0 0 16px;
        }
        .tile-cta {
          margin-top: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: ${T.color.accentDeep};
        }
        .tile-fast .tile-cta {
          color: ${T.color.accent};
        }
        .footnote {
          margin-top: 22px;
          font-size: 11.5px;
          color: ${T.color.inkFaint};
        }
        @media (prefers-reduced-motion: reduce) {
          .tile:hover,
          .tile:focus-visible { transform: none; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Active · one question at a time
// ═══════════════════════════════════════════════════════════════════

function ActiveCard({
  node,
  country,
  answers,
  canGoBack,
  progressIndex,
  progressTotal,
  onPick,
  onNotSure,
  onBack,
  onReset,
}: {
  node: WizardNode;
  country: CountryCode | undefined;
  answers: Record<string, string>;
  canGoBack: boolean;
  progressIndex: number;
  progressTotal: number;
  onPick: (value: string, extras?: Record<string, string>) => void;
  /** Principle 2 · fires when the customer clicks the injected chip.
   *  Parent decides whether to open the visual comparison overlay
   *  (when getAlternatives returns something) or advance flagged as
   *  unknown. This component never has to reason about it. */
  onNotSure: () => void;
  onBack: () => void;
  onReset: () => void;
}) {
  const currentValue = answers[node.id];
  // Data-level `not_sure` entries in the decision-tree JSON are the
  // legacy carrier of the compare[] alternatives array — the wizard
  // now injects a consistent chip below the options instead, so we
  // filter those out of the regular render.
  //
  // Cross-node compatibility gate (Philip 2026-08-19): options with a
  // `compatible_with` block are hidden when the customer's upstream
  // answers don't allow them (wood-maker fulfillment constraint —
  // e.g. mono-stringer never shown to a customer who picked "timber"
  // at Q4 material, because no wood-specialist company builds mono).
  // Gate is bypassed when the prerequisite answer is missing or
  // UNKNOWN — see isOptionCompatible for detail.
  const regularOptions = node.options.filter(
    (o) => o.value !== "not_sure" && isOptionCompatible(o, answers),
  );

  return (
    <div className="active" data-testid={`mt1-w01-active-${node.id}`}>
      <header className="head">
        <div className="progress">
          Step {progressIndex + 1} of {progressTotal}
          <div className="bar" aria-hidden>
            <div
              className="bar-fill"
              style={{ width: `${((progressIndex + 1) / progressTotal) * 100}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          className="reset"
          onClick={onReset}
          aria-label="Reset guided design"
        >
          Reset
        </button>
      </header>

      <h3 className="question">{node.question}</h3>
      {node.explanation && <p className="explanation">{node.explanation}</p>}

      {country && node.id === "Q1_country" && (
        <div className="note">
          Staircase regulations will apply for each country.
        </div>
      )}

      {/* Body varies by node type (Philip 2026-08-18 · info_card and
          textarea added for the project-classification block). Select
          nodes retain the options grid + always-on "I'm not sure" chip.
          Info-card + textarea nodes render their own custom body and
          own forward CTA, so no options grid and no not-sure chip. */}
      {node.type === "info_card" ? (
        <InfoCardBody
          body={node.body ?? ""}
          ctaLabel={node.ctaLabel ?? "Continue"}
          onContinue={() => onPick("acknowledged")}
        />
      ) : node.type === "textarea" ? (
        <TextareaBody
          initial={currentValue ?? ""}
          placeholder={node.placeholder ?? ""}
          maxLength={node.maxLength ?? 1200}
          ctaLabel="Continue"
          onSubmit={(text) => onPick(text)}
        />
      ) : (
        <>
          <div className="options" role="radiogroup" aria-label={node.question}>
            {regularOptions.map((opt) => (
              <OptionCard
                key={opt.value}
                option={opt}
                checked={currentValue === opt.value}
                onPick={() => onPick(opt.value)}
                onQuickPick={
                  opt.quick_picks
                    ? (subValue: string) =>
                        onPick(opt.value, { [opt.quick_picks!.writes_to]: subValue })
                    : undefined
                }
                flagUrl={
                  COUNTRY_NODE_IDS.has(node.id) ? getCountryFlagUrl(opt.value) : null
                }
                showImageSlot={regularOptions.some((o) => !!o.image_url)}
                imageLayout={SIDE_IMAGE_NODE_IDS.has(node.id) ? "side" : "top"}
                photoMode={PHOTO_IMAGE_NODE_IDS.has(node.id)}
                whiteThumb={WHITE_THUMB_BG_NODE_IDS.has(node.id)}
                largeThumb={LARGE_THUMB_NODE_IDS.has(node.id)}
                woodSpecies={WOOD_SPECIES_NODE_IDS.has(node.id)}
                shortcutEligible={SHORTCUT_ELIGIBLE_NODE_IDS.has(node.id)}
                nodeId={node.id}
              />
            ))}
          </div>

          {/* Principle 2 · always-injected "I'm not sure" chip. Same
              position · same visual · same weight on every SELECT
              question. Info_card + textarea nodes skip this because
              their forward action IS the customer's response. */}
          <button
            type="button"
            className="notsure"
            onClick={onNotSure}
            data-testid={`mt1-w01-notsure-${node.id}`}
          >
            Not Sure Yet — Next Question
          </button>
        </>
      )}

      <footer className="foot">
        {canGoBack ? (
          <button type="button" className="back" onClick={onBack}>
            <span aria-hidden>←</span> Back
          </button>
        ) : (
          <span />
        )}
        <span className="specialist-hint">
          Need help? <a href="#specialist-review">Talk to a specialist</a>
        </span>
      </footer>

      <style jsx>{`
        .active {
          background: ${T.color.surface};
          border: 1px solid ${T.color.hairline};
          border-radius: 16px;
          padding: clamp(24px, 4vw, 40px);
          box-shadow: ${T.shadow.softCard};
        }
        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .progress {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${T.color.inkFaint};
        }
        .bar {
          width: 220px;
          height: 3px;
          background: ${T.color.hairline};
          border-radius: 2px;
          margin-top: 6px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          background: ${T.color.accent};
          transition: width 240ms ease;
        }
        .reset {
          background: transparent;
          border: 0;
          font-family: inherit;
          font-size: 12px;
          color: ${T.color.inkFaint};
          cursor: pointer;
          padding: 4px 8px;
        }
        .reset:hover {
          color: ${T.color.ink};
        }
        .question {
          font-family: ${T.font.serif};
          font-size: clamp(22px, 3.4vw, 30px);
          font-weight: 400;
          line-height: 1.2;
          color: ${T.color.ink};
          margin: 0 0 8px;
        }
        .explanation {
          font-size: 14px;
          line-height: 1.55;
          color: ${T.color.inkMuted};
          margin: 0 0 22px;
        }
        .note {
          font-size: 12.5px;
          color: ${T.color.inkFaint};
          margin: 0 0 18px;
          padding: 8px 12px;
          background: ${T.color.seal};
          border-radius: 8px;
        }
        .options {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (min-width: 640px) {
          .options {
            grid-template-columns: 1fr 1fr;
          }
        }
        .notsure {
          display: block;
          width: 100%;
          padding: 13px 16px;
          background: ${T.color.accent};
          border: 0;
          border-radius: 12px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: #FFFFFF;
          text-align: center;
          cursor: pointer;
          transition: background 140ms, box-shadow 140ms;
          box-shadow: 0 8px 20px -12px rgba(181, 143, 94, 0.55);
        }
        .notsure:hover,
        .notsure:focus-visible {
          background: ${T.color.accentDeep};
          box-shadow: 0 10px 22px -10px rgba(181, 143, 94, 0.7);
          outline: none;
        }
        .foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid ${T.color.hairline};
        }
        .back {
          background: transparent;
          border: 0;
          font-family: inherit;
          font-size: 13px;
          color: ${T.color.inkMuted};
          cursor: pointer;
          padding: 6px 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .back:hover {
          color: ${T.color.ink};
        }
        .specialist-hint {
          font-size: 12px;
          color: ${T.color.inkFaint};
        }
        .specialist-hint a {
          color: ${T.color.accentDeep};
          text-decoration: none;
          font-weight: 600;
        }
        .specialist-hint a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

// ─── One option button ─────────────────────────────────────────────

function OptionCard({
  option,
  checked,
  onPick,
  onQuickPick,
  flagUrl,
  showImageSlot,
  imageLayout = "top",
  photoMode = false,
  whiteThumb = false,
  largeThumb = false,
  woodSpecies = false,
  shortcutEligible = false,
  nodeId,
}: {
  option: DecisionOption;
  checked: boolean;
  onPick: () => void;
  /** Optional handler for quick-pick thumbnails rendered inside this
   *  card (Philip 2026-08-18 · Q3 straight). Provided when the option
   *  declares `quick_picks` in the corpus; each thumbnail click passes
   *  its `value` here and the parent writes both this + the parent
   *  choice in one commit. Undefined = no quick-pick strip renders. */
  onQuickPick?: (subValue: string) => void;
  /** Round flag image rendered before the label (Philip 2026-08-18).
   *  Non-null only for country-picker nodes · null for every other
   *  question so the button falls back to the label-only layout. */
  flagUrl?: string | null;
  /** True when ANY option in the current question carries an image_url.
   *  When true, every option renders the image slot (filled or empty
   *  cream) so the grid stays visually uniform (Philip 2026-08-18 ·
   *  cards must be equal height + width). Options without an image_url
   *  render an empty cream tile — honest placeholder, not fabricated
   *  content · fills in naturally when curated images are added. */
  showImageSlot?: boolean;
  /** Where the image slot sits inside the card. Default "top" matches
   *  the Q5 photo pattern (image on top, text underneath). "side" is
   *  used for plan-drawing questions like Q3_geometry where the plan
   *  reads best as a portrait thumb on the left with the shape name
   *  and description on the right (Philip 2026-08-18). */
  imageLayout?: "top" | "side";
  /** True for questions whose option thumbnails are photorealistic
   *  tiles (Q2_use · Philip 2026-08-19). Two effects: (1) image fills
   *  the container edge-to-edge (object-fit: cover, no padding) so the
   *  card reads as a photo tile not a padded diagram, and (2) clicking
   *  the thumbnail opens a full-screen lightbox with a round brown
   *  close button — clicking the rest of the card still selects the
   *  option. Default false keeps diagram-mode intact for Q3_geometry
   *  plan drawings which must NOT be cropped. */
  photoMode?: boolean;
  /** True for questions whose thumbnails should render on a WHITE
   *  background instead of the default warm-cream surfaceSoft (Philip
   *  2026-08-20 · Q6a species swatches + Q6_riser_closed_string).
   *  Applies to the .opt-image-thumb container background — image
   *  itself is still contain-fit unless photoMode is also set. Helps
   *  wood-grain swatches and product-shot images read cleaner without
   *  the cream tone bleeding into the picture. Default false keeps
   *  the cream background elsewhere. */
  whiteThumb?: boolean;
  /** True for side-layout questions whose thumbs should render at a
   *  larger size (Philip 2026-08-20 · Q6_riser_closed_string). Grows
   *  the thumb container so images with heavy baked-in padding still
   *  read at a usable size. No effect on top layout (already full
   *  card width) or photo mode (already edge-to-edge). */
  largeThumb?: boolean;
  /** True for wood-species picker questions (Philip 2026-08-20 · Q6a
   *  / Q6c / Q7a / Q9a). Overrides the default contain-fit to make
   *  the main swatch FILL the container edge-to-edge (object-fit:
   *  cover, padding: 0). Composes with whiteThumb — species cards
   *  keep the white background AND get the cover fit. Kept separate
   *  from WHITE_THUMB because Q5 structural + Q6_riser_closed_string
   *  need white bg WITHOUT cropping their contain-fit imagery. */
  woodSpecies?: boolean;
  /** True when the "I want this staircase — quote me" shortcut pill
   *  should render inside the enlarged lightbox (Philip 2026-08-20 ·
   *  Q6+ nodes). Gated by SHORTCUT_ELIGIBLE_NODE_IDS. Passed through
   *  to OptionImageLightbox for both single-image (photo mode) and
   *  multi-image (species examples) lightboxes. */
  shortcutEligible?: boolean;
  /** Current wizard node id · passed down to OptionImageLightbox so
   *  the shortcut modal payload can tag the source_node_id for
   *  Submission provenance. */
  nodeId?: string;
}) {
  const explanation = option.concept_id
    ? getCustomerExplanation(option.concept_id)
    : undefined;
  const isFlagged = option.flag === "specialist_review_required";
  const hasHelp = !!option.help_en;
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = `mt1-w01-opt-help-${option.value}`;

  const toggleHelp = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      // Stop the click from bubbling into the option-select button
      // beneath it. The help toggle is its own affordance — opening
      // the explanation must never inadvertently pick the option.
      e.stopPropagation();
      e.preventDefault();
      setHelpOpen((v) => !v);
    },
    [],
  );

  const hasImage = !!option.image_url;
  // When any sibling option in the question has an image, every option
  // renders the same image slot so the grid stays visually uniform
  // (Philip 2026-08-18). Excluded when a flag icon is already
  // occupying the left slot (country picker uses horizontal layout).
  const renderImageSlot = !!showImageSlot && !flagUrl;
  // Installed-examples lightbox (Philip 2026-08-18). Chip only surfaces
  // when curated example URLs exist on the option — invisible otherwise
  // so text-only questions and un-curated options stay clean.
  const installedExamples = option.installed_examples ?? [];
  const hasInstalledExamples = installedExamples.length > 0;
  const [installedOpen, setInstalledOpen] = useState(false);
  const toggleInstalled = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      // Stop the click from selecting the option underneath — the chip
      // is its own affordance, opening the gallery must never pick.
      e.stopPropagation();
      e.preventDefault();
      setInstalledOpen((v) => !v);
    },
    [],
  );

  // Photo-mode enlarge lightbox (Philip 2026-08-19 · Q2_use). Only active
  // when photoMode + hasImage + side layout — combination guarantees the
  // overlay button sits over a real photo tile that benefits from
  // enlargement. Diagram-mode questions (Q3) keep contain-fit and no
  // enlarge, since plans are not photos.
  const photoModeActive = !!photoMode && hasImage && renderImageSlot && imageLayout === "side";
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const openLightbox = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setLightboxOpen(true);
    },
    [],
  );

  // Example staircase thumb lightbox (Philip 2026-08-20 · Q6a / Q6c /
  // Q7a species cards). Tracks INDEX (not URL) so the enlarged view
  // can navigate prev/next across the full example_staircases array
  // for this species. Null = no thumb open.
  const [enlargedExampleIndex, setEnlargedExampleIndex] = useState<number | null>(null);

  return (
    // Wrap the option in a positioned container so the help button + the
    // Select button can be proper sibling <button>s (nesting buttons is
    // invalid HTML + breaks screen readers). The card body itself is a
    // plain <div> — the only pick affordance is the Select button
    // (Philip 2026-08-19). Card display area = inspection · image click
    // enlarges · "?" opens help · Select commits.
    <div
      className={`opt-wrap${checked ? " opt-wrap-checked" : ""}${hasHelp ? " opt-wrap-with-help" : ""}${renderImageSlot && imageLayout === "side" ? " opt-wrap-side" : ""}${photoModeActive ? " opt-wrap-photo" : ""}${whiteThumb && renderImageSlot ? " opt-wrap-white-thumb" : ""}${largeThumb && renderImageSlot && imageLayout === "side" ? " opt-wrap-lg-thumb" : ""}${woodSpecies && renderImageSlot ? " opt-wrap-wood-species" : ""}${option.quick_picks && onQuickPick ? " opt-wrap-with-quickpicks" : ""}`}
    >
      <div
        aria-describedby={helpOpen ? helpId : undefined}
        className={`opt${checked ? " opt-checked" : ""}${isFlagged ? " opt-flagged" : ""}${flagUrl ? " opt-with-flag" : ""}${renderImageSlot ? " opt-with-image" : ""}${renderImageSlot && imageLayout === "side" ? " opt-with-image-side" : ""}${photoModeActive ? " opt-photo" : ""}`}
      >
        {/* Curated illustration slot (Philip 2026-08-18 · Q5
            main-design). Rendered above the label so the customer sees
            the design pattern before reading the terminology. When ANY
            sibling option in the question has an image, EVERY option
            renders the same slot (filled or empty cream) so the grid
            stays visually uniform. Empty slots are honest — they say
            "illustration coming" without fabricating a mock image. */}
        {renderImageSlot && (
          <span
            className={`opt-image-thumb${hasImage ? "" : " opt-image-thumb-empty"}`}
            aria-hidden
          >
            {hasImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={option.image_url} alt="" loading="lazy" />
            )}
          </span>
        )}
        {flagUrl && (
          <span className="opt-flag-img" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flagUrl} alt="" loading="lazy" />
          </span>
        )}
        <span className="opt-text">
          <span className="opt-label">{option.label}</span>
          {/* Species metadata line · Philip 2026-08-19 · Q6a / Q7a.
              Compact "Origin · Hardwood/Softwood" line under the label.
              Either field alone renders (dot separator only when both
              present). Missing both = no line. */}
          {(option.origin || option.hardness) && (
            <span className="opt-meta">
              {[
                option.origin,
                option.hardness ? HARDNESS_LABELS[option.hardness] : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          {/* Example staircases · Philip 2026-08-20 · Q6a / Q6c / Q7a.
              Inline row of up to 3 small thumbs showing what a
              staircase actually looks like in this wood species.
              Each thumb is a real button — click to open the
              full-screen OptionImageLightbox (brown round X close).
              Missing / empty = no row renders (honest empty state,
              no fabricated visuals). */}
          {option.example_staircases && option.example_staircases.length > 0 && (
            <span className="opt-examples-row">
              {option.example_staircases.slice(0, 3).map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  className="opt-example-thumb"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setEnlargedExampleIndex(i);
                  }}
                  aria-label={`Enlarge example staircase ${i + 1} in ${option.label}`}
                  data-testid={`mt1-w01-example-${option.value}-${i}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" />
                </button>
              ))}
            </span>
          )}
          {/* Hide the plain description when an image slot is present —
              the illustration already communicates the design, and
              stacking prose under every card creates redundant reading
              (Philip 2026-08-18). Text-only questions still show the
              plain description because the words are the only cue. */}
          {!renderImageSlot && explanation?.plain && explanation.plain !== option.label && (
            <span className="opt-plain">{explanation.plain}</span>
          )}
          {/* "Specialist recommended" chip removed 2026-08-19 · Philip
              — flag is still set in the corpus (drives Submission
              specialist_must_confirm provenance) but is no longer
              surfaced visually on the card. */}
          {/* Usage-context chip · Philip 2026-08-19 · Q5_structural.
              Shows at-a-glance where this design is typically installed
              (private residence · commercial · both). Independent of
              specialist_review flag — a design can be "both" AND still
              require specialist confirmation. Missing = no chip. */}
          {option.usage && (
            <span
              className="opt-usage-chip"
              data-usage={option.usage}
              aria-label={`Typically installed in ${USAGE_LABELS[option.usage].toLowerCase()} settings`}
            >
              {USAGE_LABELS[option.usage]}
            </span>
          )}
        </span>

        {/* Select button · Philip 2026-08-19 · the ONLY pick affordance.
            Card body around it is inspection-only (click image =
            enlarge, click ? = help). Absolute-positioned inside .opt
            (not .opt-wrap) so it stays anchored to the CARD's
            lower-right — unaffected by help_content or installed_chip
            expanding the wrap below. */}
        <button
          type="button"
          role="radio"
          aria-checked={checked}
          className={`opt-select-btn${checked ? " opt-select-btn-checked" : ""}`}
          onClick={onPick}
          aria-label={checked ? `${option.label} · selected` : `Select ${option.label}`}
          data-testid={`mt1-w01-select-${option.value}`}
        >
          {checked ? (
            <>
              <span aria-hidden className="opt-select-icon">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span>Selected</span>
            </>
          ) : (
            <>
              <span>Select</span>
              <span aria-hidden className="opt-select-icon">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </>
          )}
        </button>
      </div>

      {option.quick_picks && onQuickPick && (
        <div className="opt-quickpicks" role="group" aria-label={option.quick_picks.heading_en ?? `Quick pick for ${option.label}`}>
          {option.quick_picks.heading_en && (() => {
            // Split "Optional · Rest of the heading" so the leading tag
            // renders as a small pill. Keeps the schema simple — any
            // heading with "· " gets its first segment badged.
            const [head, ...rest] = option.quick_picks.heading_en.split(" · ");
            const body = rest.join(" · ");
            return (
              <div className="opt-quickpicks-heading">
                {body ? <span className="opt-quickpicks-tag">{head}</span> : null}
                <span>{body || head}</span>
              </div>
            );
          })()}
          <div className="opt-quickpicks-row">
            {option.quick_picks.options.map((qp) => (
              <button
                key={qp.value}
                type="button"
                className="opt-quickpick"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickPick(qp.value);
                }}
                aria-label={`${option.label} · ${qp.label}`}
                data-testid={`mt1-w01-quickpick-${option.value}-${qp.value}`}
              >
                <span className="opt-quickpick-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qp.image_url} alt="" loading="lazy" />
                </span>
                <span className="opt-quickpick-label">{qp.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasInstalledExamples && (
        <button
          type="button"
          className="opt-installed-chip"
          onClick={toggleInstalled}
          aria-label={`See "${option.label}" installed in real settings`}
          data-testid={`mt1-w01-installed-${option.value}`}
        >
          <span aria-hidden className="opt-installed-icon">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </span>
          <span>Examples</span>
        </button>
      )}

      {installedOpen && (
        <InstalledExamplesOverlay
          title={option.label}
          examples={installedExamples}
          tileAspect={option.image_aspect}
          onClose={() => setInstalledOpen(false)}
        />
      )}

      {hasHelp && (
        <button
          type="button"
          className="opt-help-btn"
          onClick={toggleHelp}
          aria-expanded={helpOpen}
          aria-controls={helpId}
          aria-label={`Learn more about "${option.label}"`}
          title="What does this mean?"
        >
          ?
        </button>
      )}

      {hasHelp && helpOpen && (
        <div
          id={helpId}
          className="opt-help-content"
          role="region"
          aria-label={`About "${option.label}"`}
        >
          {option.help_title_en && (
            <div className="opt-help-title">{option.help_title_en}</div>
          )}
          <div className="opt-help-body">{option.help_en}</div>
        </div>
      )}

      {/* Photo-mode enlarge overlay · Philip 2026-08-19 · Q2_use.
          Transparent button sits atop the left image area (sibling of
          the main option button so we don't nest interactive elements).
          Clicking enlarges via OptionImageLightbox and stops
          propagation so the option is NOT selected. Rest of the card
          click still selects the option normally. */}
      {photoModeActive && (
        <button
          type="button"
          className="opt-image-enlarge-btn"
          onClick={openLightbox}
          aria-label={`Enlarge image · ${option.label}`}
          data-testid={`mt1-w01-enlarge-${option.value}`}
        />
      )}

      {photoModeActive && lightboxOpen && option.image_url && (
        <OptionImageLightbox
          images={[option.image_url]}
          alt={option.label}
          onClose={() => setLightboxOpen(false)}
          showShortcut={shortcutEligible}
          shortcutContext={{ speciesLabel: option.label, nodeId: nodeId ?? "" }}
        />
      )}

      {/* Example-staircase thumb lightbox · Philip 2026-08-20. Fires
          when a customer clicks any of the small example thumbnails
          on species cards (Q6a / Q6c / Q7a). Full-screen, prev/next
          swipe navigation across all example_staircases for this
          species, brown round X close, first-time gloved-hand hint,
          "I want this staircase" shortcut pill. */}
      {enlargedExampleIndex !== null && option.example_staircases && option.example_staircases.length > 0 && (
        <OptionImageLightbox
          images={option.example_staircases}
          startIndex={enlargedExampleIndex}
          alt={`Example staircase in ${option.label}`}
          onClose={() => setEnlargedExampleIndex(null)}
          showShortcut={shortcutEligible}
          shortcutContext={{ speciesLabel: option.label, nodeId: nodeId ?? "" }}
        />
      )}

      <style jsx>{`
        .opt-wrap {
          position: relative;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          /* Fill the grid cell so sibling cards in a row match height
             (Philip 2026-08-19). CSS grid rows are naturally sized to
             the tallest cell — this makes .opt-wrap stretch into that
             cell so every card visually matches its neighbours. */
          height: 100%;
        }
        .opt {
          text-align: left;
          padding: 14px 16px 52px;
          background: ${T.color.surface};
          border: 1.5px solid ${T.color.hairline};
          border-radius: 12px;
          font-family: inherit;
          cursor: default;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: border-color 120ms, background 120ms;
          width: 100%;
          /* position: relative anchors the Select button (absolute)
             to the CARD not the wrap — so it stays at the card's
             lower-right even when help_content or installed_chip
             expand the wrap below (Philip 2026-08-19). */
          position: relative;
          /* Fill the wrap for uniform card heights across the grid
             row (Philip 2026-08-19). */
          flex: 1;
          min-height: 0;
        }
        /* Reserve room on the right so the label never runs under the
           round help button. Only applied when help is present. */
        .opt-wrap-with-help .opt {
          padding-right: 44px;
        }
        /* Country nodes get a horizontal flag+text layout · every other
           node keeps the original column stack. */
        .opt-with-flag {
          flex-direction: row;
          align-items: center;
          gap: 14px;
        }
        .opt:hover {
          border-color: ${T.color.accent};
          background: ${T.color.surfaceSoft};
        }
        .opt-checked {
          border-color: ${T.color.accent};
          background: ${T.color.surfaceSoft};
          box-shadow: 0 0 0 2px ${T.color.seal};
        }
        .opt-flag-img {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: 50%;
          overflow: hidden;
          background: ${T.color.surfaceSoft};
          border: 1px solid ${T.color.hairline};
          box-shadow: 0 2px 6px -3px rgba(58, 52, 40, 0.28);
        }
        .opt-flag-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        /* Curated design thumbnail · sits at the TOP of the option card
           in a natural aspect ratio so the customer sees the design
           before reading the terminology (Philip 2026-08-18 · Q5).
           Full-width inside the card, contained (not cropped) so the
           illustration remains readable. */
        .opt-with-image {
          padding: 0;
          overflow: hidden;
        }
        .opt-with-image .opt-text {
          padding: 12px 16px 52px;
        }
        .opt-with-image.opt-wrap-with-help .opt-text,
        .opt-wrap-with-help .opt-with-image .opt-text {
          padding-right: 44px;
        }
        .opt-image-thumb {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: ${T.color.surfaceSoft};
          border-bottom: 1px solid ${T.color.hairline};
          overflow: hidden;
          padding: 8px;
          box-sizing: border-box;
        }
        .opt-image-thumb img {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
          transition: transform 240ms ease;
        }
        .opt:hover .opt-image-thumb img,
        .opt:focus-visible .opt-image-thumb img {
          transform: scale(1.03);
        }
        @media (prefers-reduced-motion: reduce) {
          .opt-image-thumb img { transition: none !important; }
          .opt:hover .opt-image-thumb img,
          .opt:focus-visible .opt-image-thumb img { transform: none; }
        }
        /* Side-image layout · plan drawings sit on the LEFT of the card
           with label + description on the RIGHT (Philip 2026-08-18 ·
           Q3_geometry). Overrides the vertical stack .opt-with-image
           uses for Q5 photos. Cards stay equal height because the
           image slot stretches with the parent flex box. */
        .opt-with-image-side {
          flex-direction: row;
          align-items: stretch;
          gap: 0;
          min-height: 140px;
        }
        .opt-with-image-side .opt-image-thumb {
          width: 108px;
          aspect-ratio: 1 / 1;
          height: auto;
          align-self: stretch;
          border-bottom: 0;
          border-right: 1px solid ${T.color.hairline};
          flex-shrink: 0;
        }
        .opt-with-image-side .opt-text {
          padding: 14px 16px 52px;
          justify-content: center;
        }
        /* Photo mode · Philip 2026-08-19 · Q2_use. Fills the left image
           slot edge-to-edge with the photo (no padding, object-fit:
           cover) so the card reads as a photo tile not a padded
           diagram. Scoped to .opt-photo so diagram-mode questions like
           Q3_geometry keep their contain-fit plan drawings.
           Reverted 2026-08-20 · Philip: image thumbs stay fixed
           108×108 square so every option's image renders at the same
           visual height regardless of card content variance across
           rows. The card body can grow taller than 108px (uniform-
           height rows) but the thumb doesn't stretch with it. */
        .opt-photo .opt-image-thumb {
          padding: 0;
        }
        .opt-photo .opt-image-thumb img {
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
          object-fit: cover;
        }
        /* Transparent enlarge-overlay button sits above the option button
           on the left image area. cursor: zoom-in signals the affordance
           without adding a visible icon. Slight brown outline on focus
           for keyboard users. */
        .opt-wrap-photo {
          /* opt-wrap is already position: relative — no override needed */
        }
        .opt-image-enlarge-btn {
          position: absolute;
          top: 0;
          left: 0;
          width: 108px;
          /* Matches the fixed thumb size (Philip 2026-08-20 · reverted
             from stretch-to-card-height). Card may be taller but the
             enlarge target is exactly the 108×108 image area. */
          height: 108px;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: zoom-in;
          z-index: 3;
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
        }
        .opt-image-enlarge-btn:focus-visible {
          outline: 2px solid ${T.color.accent};
          outline-offset: -2px;
        }
        /* Keep the "?" help button clickable — it sits inside the image
           area on side layout at top:8px, left:74px. Lift it above the
           enlarge overlay so its click lands on the help toggle, not
           the lightbox opener. */
        .opt-wrap-photo .opt-help-btn {
          z-index: 4;
        }

        /* White thumbnail background · Philip 2026-08-20 · Q6a species
           swatches + Q6_riser_closed_string. Overrides the default
           warm-cream surfaceSoft so wood swatches and product shots
           read cleaner. Also forces img to fill 100%×100% of container
           with contain fit — makes every image visually occupy the
           same bounded box regardless of intrinsic aspect (uniform
           card sizing). */
        .opt-wrap-white-thumb .opt-image-thumb {
          background: #FFFFFF;
        }
        .opt-wrap-white-thumb .opt-image-thumb img {
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
          object-fit: contain;
        }
        /* Larger side-layout thumbs · Philip 2026-08-20 ·
           Q6_riser_closed_string. Bumps the 108×108 default up to
           160×160 so subject reads at a usable size despite baked-in
           padding on the source images. Overlays/help positions
           adjust to match the wider thumb. */
        .opt-wrap-lg-thumb.opt-wrap-side .opt-image-thumb {
          width: 160px;
        }
        .opt-wrap-lg-thumb .opt-image-enlarge-btn {
          width: 160px;
          height: 160px;
        }
        .opt-wrap-lg-thumb.opt-wrap-side .opt-help-btn {
          left: 126px;
        }

        /* Wood species swatches · Philip 2026-08-20 · Q6a / Q6c /
           Q7a / Q9a. Fills the container edge-to-edge so the wood
           grain reads full-size, not letterboxed. Overrides the
           .opt-wrap-white-thumb contain-fit for THESE nodes only.
           Q5 structural and Q6_riser_closed_string keep the
           white-thumb contain fit (their imagery has design padding
           that must stay visible). */
        .opt-wrap-wood-species .opt-image-thumb {
          padding: 0;
        }
        .opt-wrap-wood-species .opt-image-thumb img {
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
          object-fit: cover;
        }

        /* Select button · Philip 2026-08-19 · lower-right of every card.
           Only pick affordance. Absolute positioned inside .opt-wrap so
           it aligns to the card's bottom-right regardless of layout
           (top / side / with-flag). Card bodies reserve 52px of bottom
           padding to prevent text from running under it. */
        .opt-select-btn {
          position: absolute;
          bottom: 10px;
          right: 10px;
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1.5px solid ${T.color.accent};
          border-radius: 999px;
          background: ${T.color.surface};
          color: ${T.color.accentDeep};
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow: 0 4px 10px -6px rgba(58, 52, 40, 0.28);
          transition: background 140ms, color 140ms, border-color 140ms, transform 140ms, box-shadow 140ms;
        }
        .opt-select-btn:hover,
        .opt-select-btn:focus-visible {
          background: ${T.color.accent};
          color: #FFFFFF;
          border-color: ${T.color.accent};
          transform: translateY(-1px);
          box-shadow: 0 6px 14px -6px rgba(58, 52, 40, 0.42);
          outline: none;
        }
        .opt-select-btn-checked {
          background: ${T.color.accentDeep};
          color: #FFFFFF;
          border-color: ${T.color.accentDeep};
          box-shadow: 0 4px 10px -6px rgba(142, 109, 66, 0.55);
        }
        .opt-select-btn-checked:hover,
        .opt-select-btn-checked:focus-visible {
          background: ${T.color.accentDeep};
          color: #FFFFFF;
          border-color: ${T.color.accentDeep};
        }
        .opt-select-icon {
          display: inline-flex;
          align-items: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .opt-select-btn:hover,
          .opt-select-btn:focus-visible { transform: none; }
        }
        /* Trigger the same image zoom-in on enlarge-button hover as we
           get on option-card hover — otherwise hovering the overlay
           swallows the zoom cue. Uses :has() so the effect stays scoped
           to the sibling image inside the same .opt-wrap. */
        .opt-wrap-photo:has(.opt-image-enlarge-btn:hover) .opt-image-thumb img {
          transform: scale(1.03);
        }
        @media (prefers-reduced-motion: reduce) {
          .opt-wrap-photo:has(.opt-image-enlarge-btn:hover) .opt-image-thumb img {
            transform: none;
          }
        }
        /* Side-image cards keep the help icon inside the thumb (top-right)
           so it doesn't steal room from the label · reset the base
           .opt-wrap-with-help right-padding for this variant. */
        .opt-wrap-side.opt-wrap-with-help .opt {
          padding-right: 0;
        }
        .opt-wrap-side.opt-wrap-with-help .opt-with-image-side .opt-text {
          padding-right: 16px;
        }
        .opt-wrap-side .opt-help-btn {
          top: 8px;
          left: 74px;
          right: auto;
          border-radius: 6px;
        }
        .opt-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }
        .opt-label {
          font-size: 14px;
          font-weight: 600;
          color: ${T.color.ink};
          line-height: 1.3;
        }
        .opt-plain {
          font-size: 12.5px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
        }
        /* Species metadata line · Philip 2026-08-19 · Q6a / Q7a.
           Compact "Origin · Hardness" under the label. Muted so the
           label remains the primary read. */
        .opt-meta {
          font-size: 11.5px;
          color: ${T.color.inkFaint};
          letter-spacing: 0.02em;
          line-height: 1.4;
        }
        /* Example staircases row · Philip 2026-08-20 · Q6a / Q6c /
           Q7a. Up to 3 tiny thumbs showing an actual staircase in
           this wood species. Inline, non-interactive, purely visual
           reference. Empty when no examples curated yet. */
        .opt-examples-row {
          display: flex;
          gap: 6px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .opt-example-thumb {
          display: inline-flex;
          width: 40px;
          height: 40px;
          border-radius: 4px;
          overflow: hidden;
          background: ${T.color.surfaceSoft};
          border: 1px solid ${T.color.hairline};
          flex-shrink: 0;
          padding: 0;
          cursor: zoom-in;
          font-family: inherit;
          transition: transform 140ms, border-color 140ms, box-shadow 140ms;
        }
        .opt-example-thumb:hover,
        .opt-example-thumb:focus-visible {
          border-color: ${T.color.accent};
          transform: scale(1.06);
          box-shadow: 0 4px 10px -6px rgba(58, 52, 40, 0.35);
          outline: none;
        }
        .opt-example-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        @media (prefers-reduced-motion: reduce) {
          .opt-example-thumb:hover,
          .opt-example-thumb:focus-visible { transform: none; }
        }
        .opt-flag {
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${T.color.accentDeep};
          margin-top: 4px;
        }
        /* Usage-context pill · Philip 2026-08-19 · Q5_structural.
           Sits below the label + specialist flag, aligned to the left
           edge of the text area. Cream fill + brown text so it reads
           as informational rather than warning. */
        .opt-usage-chip {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          margin-top: 6px;
          padding: 3px 10px;
          border-radius: 999px;
          background: ${T.color.seal};
          border: 1px solid ${T.color.hairline};
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${T.color.accentDeep};
          white-space: nowrap;
        }
        .opt-usage-chip[data-usage="commercial"] {
          background: #EAE4D6;
          color: #5A4E3E;
        }
        .opt-usage-chip[data-usage="both"] {
          background: ${T.color.surfaceSoft};
          color: ${T.color.accentDeep};
        }

        /* ── Help button · round '?' top-right of the option ──
           Sibling of the option button, absolutely positioned so it
           never nests inside a button (invalid HTML + a11y issue).
           z-index sits it above the option so clicks land on the help
           control not the option-pick control underneath. */
        .opt-help-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: ${T.color.accent};
          border: 0;
          color: #FFFFFF;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          box-shadow: 0 4px 10px -6px rgba(181, 143, 94, 0.6);
          transition: background 140ms, box-shadow 140ms, transform 140ms;
        }
        .opt-help-btn:hover,
        .opt-help-btn:focus-visible {
          background: ${T.color.accentDeep};
          box-shadow: 0 6px 14px -6px rgba(181, 143, 94, 0.75);
          outline: none;
          transform: scale(1.05);
        }
        .opt-help-btn[aria-expanded="true"] {
          background: ${T.color.accentDeep};
        }

        /* Inline expansion below the option · avoids popover positioning
           drama on mobile + narrow columns. Full width of the wrapper,
           soft seal background so it's clearly attached to the option
           above without competing with it visually. */
        .opt-help-content {
          margin-top: 8px;
          padding: 12px 14px;
          background: ${T.color.seal};
          border: 1px solid ${T.color.hairline};
          border-radius: 10px;
          font-size: 12.5px;
          line-height: 1.55;
          color: ${T.color.inkMuted};
        }
        .opt-help-title {
          font-size: 13px;
          font-weight: 700;
          color: ${T.color.ink};
          margin-bottom: 6px;
        }
        .opt-help-body {
          white-space: pre-line;
        }
        /* Quick-picks · optional handrail (etc.) shortcut thumbnails
           rendered inside the shape card so a customer who already knows
           the handrail side can pre-fill Q_handrail_position in the same
           click that picks the shape (Philip 2026-08-18). Purely optional
           — clicking the shape card without touching a thumbnail still
           records only the shape and the downstream question fires normally.
           Preserves Principle 1 (no forced decisions). Styled as a
           bottom-attached strip so the card + strip read as ONE unit. */
        .opt-wrap-with-quickpicks .opt {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom-width: 0;
        }
        .opt-quickpicks {
          background: ${T.color.surface};
          border: 1.5px solid ${T.color.hairline};
          border-radius: 0 0 12px 12px;
          padding: 10px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .opt-wrap-checked .opt-quickpicks {
          border-color: ${T.color.accent};
        }
        .opt-quickpicks-heading {
          font-size: 11px;
          letter-spacing: 0.02em;
          color: ${T.color.inkMuted};
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .opt-quickpicks-tag {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${T.color.accentDeep};
          background: ${T.color.seal};
          padding: 2px 7px;
          border-radius: 999px;
          line-height: 1.4;
        }
        .opt-quickpicks-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .opt-quickpick {
          appearance: none;
          background: ${T.color.surfaceSoft};
          border: 1.5px solid ${T.color.hairline};
          border-radius: 8px;
          padding: 6px 4px 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-family: inherit;
          transition: border-color 120ms, background 120ms, transform 120ms;
        }
        .opt-quickpick:hover {
          border-color: ${T.color.accent};
          background: ${T.color.surface};
        }
        .opt-quickpick:focus-visible {
          outline: none;
          border-color: ${T.color.accent};
          box-shadow: 0 0 0 2px ${T.color.seal};
        }
        .opt-quickpick-thumb {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: ${T.color.surface};
          border-radius: 6px;
          overflow: hidden;
        }
        .opt-quickpick-thumb img {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
        }
        .opt-quickpick-label {
          font-size: 10.5px;
          line-height: 1.25;
          color: ${T.color.ink};
          text-align: center;
        }

        /* "See installed" chip · sits below the option card as a sibling
           button (Philip 2026-08-18). Sibling of .opt (not nested)
           because nesting buttons is invalid HTML + a11y-broken. Small
           pill with cream fill + hairline border · reads as a
           secondary affordance, not competing with the option-select
           gesture. Opens InstalledExamplesOverlay lightbox on click. */
        .opt-installed-chip {
          margin-top: 8px;
          padding: 8px 14px;
          display: inline-flex;
          align-items: center;
          align-self: flex-end;
          gap: 8px;
          background: ${T.color.surfaceSoft};
          border: 1px solid ${T.color.hairline};
          border-radius: 999px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          color: ${T.color.accentDeep};
          cursor: pointer;
          transition: color 120ms, border-color 120ms, background 120ms, transform 120ms;
        }
        .opt-installed-chip:hover,
        .opt-installed-chip:focus-visible {
          color: #FFFFFF;
          background: ${T.color.accent};
          border-color: ${T.color.accent};
          outline: none;
          transform: translateY(-1px);
        }
        .opt-installed-icon {
          display: inline-flex;
          align-items: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .opt-installed-chip:hover,
          .opt-installed-chip:focus-visible { transform: none; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Option-image enlarge lightbox · Philip 2026-08-19, extended 2026-08-20.
// Portalled full-screen overlay for one or more option-card images.
// Dark scrim covers the whole viewport (padding: 0 → image at full
// mobile height), image contain-fit, round brown close top-right.
// When multiple images supplied (species example_staircases): prev/next
// arrows on desktop + touch swipe left/right + keyboard arrows + a
// position counter. First-time visit shows a gloved-hand swipe hint
// (same asset + keyframes as StaircaseLibraryShell); dismisses on first
// swipe/arrow and persists via localStorage. Used by:
//   · photo-mode Q2/Q4 cards (single-image mode, no arrows/hint)
//   · Q6a/Q6c/Q7a species example thumbs (multi-image mode)
// ═══════════════════════════════════════════════════════════════════

const OILB_SWIPE_THRESHOLD_PX = 60;
const OILB_HINT_STORAGE_KEY = "nex-mt1-w01-lightbox-swipe-hint-seen";
const OILB_SWIPE_HINT_GLOVE = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2005_31_59%20AM.png?updatedAt=1785612000000";

function OptionImageLightbox({
  images,
  startIndex = 0,
  alt,
  onClose,
  showShortcut = false,
  shortcutContext,
}: {
  images: string[];
  startIndex?: number;
  alt: string;
  onClose: () => void;
  /** True to show the "I want this staircase" shortcut pill (Philip
   *  2026-08-20 · Q6a/Q6c/Q7a/Q9a species example thumbs). Photo-mode
   *  Q2/Q4 lightboxes don't show it (not enough state captured yet
   *  for a useful specialist Submission). */
  showShortcut?: boolean;
  /** Context strings for the shortcut confirm modal — species name +
   *  which node the customer was on when they picked the reference
   *  photo. Only used when showShortcut is true. */
  shortcutContext?: { speciesLabel: string; nodeId: string };
}) {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [hintVisible, setHintVisible] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasMultiple = images.length > 1;

  // First-time gloved-hand swipe hint · only shown when there's more
  // than one image to swipe between, and only until the customer's
  // first prev/next interaction (persisted via localStorage so it
  // never nags again after that). Matches the pattern in
  // StaircaseLibraryShell so customers see a consistent onboarding
  // gesture across MT-1 surfaces.
  useEffect(() => {
    if (!hasMultiple) return;
    try {
      const seen = window.localStorage.getItem(OILB_HINT_STORAGE_KEY);
      if (!seen) setHintVisible(true);
    } catch {
      /* localStorage unavailable — skip hint */
    }
  }, [hasMultiple]);

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    try {
      window.localStorage.setItem(OILB_HINT_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const showPrev = useCallback(() => {
    if (!hasMultiple) return;
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    dismissHint();
  }, [hasMultiple, images.length, dismissHint]);

  const showNext = useCallback(() => {
    if (!hasMultiple) return;
    setCurrentIndex((i) => (i + 1) % images.length);
    dismissHint();
  }, [hasMultiple, images.length, dismissHint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (hasMultiple && e.key === "ArrowLeft") {
        showPrev();
        e.stopPropagation();
      } else if (hasMultiple && e.key === "ArrowRight") {
        showNext();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, hasMultiple, showPrev, showNext]);

  // Touch swipe · Tinder-style horizontal drag. Threshold 60px so
  // taps + vertical scrolls don't accidentally advance. Ignored on
  // single-image mode.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      if (!start || !hasMultiple) return;
      const end = e.changedTouches[0];
      const dx = end.clientX - start.x;
      const dy = end.clientY - start.y;
      touchStartRef.current = null;
      if (Math.abs(dx) < OILB_SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) showPrev();
      else showNext();
    },
    [hasMultiple, showPrev, showNext],
  );

  if (!mounted) return null;

  const currentSrc = images[currentIndex];

  const node = (
    <div
      className="oilb-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-testid="mt1-w01-option-lightbox"
    >
      <button
        type="button"
        className="oilb-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close enlarged image"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            className="oilb-nav oilb-prev"
            onClick={(e) => {
              e.stopPropagation();
              showPrev();
            }}
            aria-label="Previous image"
            data-testid="mt1-w01-option-lightbox-prev"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="oilb-nav oilb-next"
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            aria-label="Next image"
            data-testid="mt1-w01-option-lightbox-next"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      <div className="oilb-frame" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="oilb-img" src={currentSrc} alt={alt} />
      </div>

      {hasMultiple && (
        <div className="oilb-counter" aria-live="polite">
          {currentIndex + 1} of {images.length}
        </div>
      )}

      {/* Photo-reference shortcut pill · Philip 2026-08-20. Customer
          sees a staircase they love → skip the rest of the wizard →
          submit what they've captured so far + this reference photo
          to the specialist. Only rendered on species example-thumb
          lightboxes (showShortcut=true), gated to Q6a+ where enough
          design state is captured for a useful Submission. */}
      {showShortcut && (
        <button
          type="button"
          className="oilb-shortcut"
          onClick={(e) => {
            e.stopPropagation();
            setShortcutOpen(true);
          }}
          data-testid="mt1-w01-lightbox-shortcut"
        >
          <span aria-hidden className="oilb-shortcut-icon">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
          <span>I want this staircase</span>
        </button>
      )}

      {shortcutOpen && showShortcut && (
        <PhotoReferenceShortcutModal
          referenceUrl={currentSrc}
          speciesLabel={shortcutContext?.speciesLabel ?? alt}
          sourceNodeId={shortcutContext?.nodeId ?? ""}
          onClose={() => setShortcutOpen(false)}
          onSubmitted={() => {
            setShortcutOpen(false);
            onClose();
          }}
        />
      )}

      {/* Gloved-hand swipe hint · Philip 2026-08-20. Reuses the exact
          asset + keyframes established in StaircaseLibraryShell so the
          onboarding gesture reads consistently across MT-1 surfaces.
          pointer-events: none so it never intercepts the swipe. */}
      {hintVisible && hasMultiple && (
        <div className="oilb-hint" aria-hidden>
          <div className="oilb-hint-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OILB_SWIPE_HINT_GLOVE}
              alt=""
              width={112}
              height={112}
              className="oilb-hint-glove"
              draggable={false}
            />
          </div>
          <div className="oilb-hint-label">Swipe to explore</div>
        </div>
      )}

      <style jsx>{`
        .oilb-scrim {
          position: fixed;
          inset: 0;
          background: rgba(24, 20, 14, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          /* padding: 0 so image touches viewport edges (full-height
             on mobile portrait). Was clamp(24px, 5vw, 60px) — image
             was letterboxed on all sides. Philip 2026-08-20. */
          padding: 0;
          z-index: 9500;
          animation: oilb-fade 180ms ease;
          overflow: hidden;
          touch-action: pan-y;
        }
        .oilb-frame {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .oilb-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        .oilb-close {
          position: absolute;
          top: clamp(12px, 2vw, 20px);
          right: clamp(12px, 2vw, 20px);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #FFFFFF;
          border: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.5);
          transition: background 140ms, transform 140ms, box-shadow 140ms;
          z-index: 12;
        }
        .oilb-close:hover,
        .oilb-close:focus-visible {
          background: ${T.color.accentDeep};
          transform: scale(1.06);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.6);
          outline: none;
        }
        /* Prev/next arrows · same brown-circle language as the close
           button. Hidden on very narrow screens where swipe is the
           primary gesture (< 480px). */
        .oilb-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #FFFFFF;
          border: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.5);
          transition: background 140ms, transform 140ms, box-shadow 140ms;
          z-index: 11;
        }
        .oilb-prev { left: clamp(8px, 2vw, 20px); }
        .oilb-next { right: clamp(8px, 2vw, 20px); }
        .oilb-nav:hover,
        .oilb-nav:focus-visible {
          background: ${T.color.accentDeep};
          transform: translateY(-50%) scale(1.06);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.6);
          outline: none;
        }
        @media (max-width: 480px) {
          .oilb-nav { display: none; }
        }
        .oilb-counter {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.6);
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          pointer-events: none;
          z-index: 13;
        }
        /* "I want this staircase" shortcut pill · Philip 2026-08-20.
           Sits at the bottom-center of the lightbox (above the position
           counter when both render — offset via bottom padding). Brown
           accent → deep-brown hover, matching the wizard's Select-button
           visual language so it reads as a commit action. */
        .oilb-shortcut {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border: 0;
          border-radius: 999px;
          background: ${T.color.accent};
          color: #FFFFFF;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.55);
          transition: background 140ms, transform 140ms, box-shadow 140ms;
          z-index: 13;
        }
        .oilb-shortcut:hover,
        .oilb-shortcut:focus-visible {
          background: ${T.color.accentDeep};
          transform: translateX(-50%) translateY(-1px);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.65);
          outline: none;
        }
        .oilb-shortcut-icon {
          display: inline-flex;
          align-items: center;
        }
        /* When BOTH the counter and shortcut render, lift the shortcut
           further so they don't collide. */
        .oilb-scrim:has(.oilb-counter) .oilb-shortcut {
          bottom: 68px;
        }
        @media (prefers-reduced-motion: reduce) {
          .oilb-shortcut:hover,
          .oilb-shortcut:focus-visible { transform: translateX(-50%); }
        }
        /* First-time swipe-hint overlay · matches StaircaseLibraryShell
           gloved-hand pattern. pointer-events: none across the whole
           overlay so it never intercepts the swipe gesture the hint
           is teaching. */
        .oilb-hint {
          position: absolute;
          inset: 0;
          z-index: 14;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          pointer-events: none;
        }
        .oilb-hint-panel {
          padding: 8px;
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.55);
          box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }
        .oilb-hint-glove {
          display: block;
          width: 112px;
          height: 112px;
          object-fit: contain;
          border-radius: 12px;
          animation: nex-swipe-hint 2.4s ease-in-out infinite;
        }
        .oilb-hint-label {
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.55);
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          backdrop-filter: blur(4px);
        }
        @keyframes nex-swipe-hint {
          0%   { transform: translateX(0);    opacity: 0; }
          15%  { transform: translateX(0);    opacity: 1; }
          55%  { transform: translateX(-70px); opacity: 1; }
          75%  { transform: translateX(-70px); opacity: 0; }
          100% { transform: translateX(0);    opacity: 0; }
        }
        @keyframes oilb-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .oilb-scrim { animation: none !important; }
          .oilb-close:hover,
          .oilb-close:focus-visible,
          .oilb-nav:hover,
          .oilb-nav:focus-visible { transform: none; }
          .oilb-nav:hover,
          .oilb-nav:focus-visible { transform: translateY(-50%); }
          .oilb-hint-glove { animation: none !important; }
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}

// ═══════════════════════════════════════════════════════════════════
// Photo-reference shortcut modal · Philip 2026-08-20.
// Customer sees a staircase they love in the enlarged lightbox → clicks
// the "I want this staircase" pill → this modal opens. Shows the
// reference photo, summary of design choices captured so far
// (StaircaseDesign context), and a submit CTA that STUBS the Submission
// dispatch. Real Submission wiring lands post engine-extraction — the
// stub proves the flow shape and payload structure.
//
// Payload provenance (Submission Five Categories doctrine):
//   entry_mode: "photo_reference_shortcut"
//   reference_image: { url, species, source_node }
//   captured_design: { ...customer_selected fields }
//   nex_doesnt_know: [...list of skipped downstream fields]
//   specialist_review_required: true (auto-flag — customer skipped
//                                     downstream questions)
// ═══════════════════════════════════════════════════════════════════

function PhotoReferenceShortcutModal({
  referenceUrl,
  speciesLabel,
  sourceNodeId,
  onClose,
  onSubmitted,
}: {
  referenceUrl: string;
  speciesLabel: string;
  sourceNodeId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { design } = useStaircaseDesign();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const captured = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    if (design.country) rows.push({ label: "Country", value: design.country });
    if (design.materialFamily) rows.push({ label: "Material", value: design.materialFamily.replace(/_/g, " ") });
    if (design.use) rows.push({ label: "Location", value: design.use.replace(/_/g, " ") });
    if (design.geometry) rows.push({ label: "Shape", value: design.geometry.replace(/_/g, " ") });
    if (design.string) rows.push({ label: "Design", value: design.string.replace(/_/g, " ") });
    if (design.riser) rows.push({ label: "Riser", value: design.riser.replace(/_/g, " ") });
    if (design.wood) rows.push({ label: "Primary timber", value: design.wood });
    if (design.treadWood && design.treadWood !== design.wood) rows.push({ label: "Step timber", value: design.treadWood });
    if (design.riserWood && design.riserWood !== design.wood) rows.push({ label: "Riser timber", value: design.riserWood });
    if (design.handrailWood && design.handrailWood !== design.wood) rows.push({ label: "Handrail timber", value: design.handrailWood });
    return rows;
  }, [design]);

  const handleSubmit = useCallback(() => {
    const payload = {
      entry_mode: "photo_reference_shortcut",
      submitted_at: new Date().toISOString(),
      reference_image: {
        url: referenceUrl,
        species_context: speciesLabel,
        source_node_id: sourceNodeId,
      },
      captured_design: design,
      note: "STUB SUBMISSION — real Submission dispatch lands post engine-extraction",
    };
    // TODO (post-extraction): dispatch to Submission endpoint via NEX
    // Chat handoff. For now, log and show inline confirmation.
    // eslint-disable-next-line no-console
    console.info("[PhotoReferenceShortcut] Stub submission payload:", payload);
    setSubmitted(true);
  }, [referenceUrl, speciesLabel, sourceNodeId, design]);

  if (!mounted) return null;

  const node = (
    <div
      className="prsm-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Send this design to a specialist"
      onClick={onClose}
      data-testid="mt1-w01-photo-shortcut-modal"
    >
      <div className="prsm-sheet" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="prsm-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {!submitted ? (
          <>
            <div className="prsm-eyebrow">I want this staircase</div>
            <h4 className="prsm-title">Send this design to your specialist</h4>
            <p className="prsm-body">
              You&apos;ll skip the rest of the wizard. Your specialist will
              follow up to confirm the details we haven&apos;t captured yet
              (measurements, timber grade, install date and so on).
            </p>

            <div className="prsm-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={referenceUrl} alt="Reference staircase" />
            </div>

            <div className="prsm-summary">
              <div className="prsm-summary-heading">What you&apos;ve told us so far</div>
              {captured.length > 0 ? (
                <ul className="prsm-summary-list">
                  {captured.map((row) => (
                    <li key={row.label}>
                      <span className="prsm-summary-key">{row.label}</span>
                      <span className="prsm-summary-val">{row.value}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="prsm-summary-empty">
                  No design choices captured yet — your specialist will start
                  the conversation with just your reference photo.
                </p>
              )}
            </div>

            <div className="prsm-actions">
              <button
                type="button"
                className="prsm-primary"
                onClick={handleSubmit}
                data-testid="mt1-w01-photo-shortcut-submit"
              >
                Send to specialist
                <span aria-hidden>→</span>
              </button>
              <button
                type="button"
                className="prsm-secondary"
                onClick={onClose}
              >
                Keep exploring
              </button>
            </div>

            <p className="prsm-note">
              This is a stub — real Submission dispatch lands with the
              engine-extraction work. Payload is logged to the console.
            </p>
          </>
        ) : (
          <>
            <div className="prsm-success-icon" aria-hidden>
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h4 className="prsm-title prsm-title-success">Sent to your specialist</h4>
            <p className="prsm-body">
              Your reference photo and design choices have been logged (stub).
              A specialist will follow up shortly to confirm the details.
            </p>
            <div className="prsm-actions">
              <button
                type="button"
                className="prsm-primary"
                onClick={onSubmitted}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .prsm-scrim {
          position: fixed;
          inset: 0;
          background: rgba(24, 20, 14, 0.78);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(12px, 3vw, 32px);
          z-index: 9700;
          animation: prsm-fade 180ms ease;
          overflow-y: auto;
        }
        .prsm-sheet {
          position: relative;
          background: ${T.color.surface};
          border-radius: 16px;
          width: min(520px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          padding: clamp(24px, 4vw, 36px);
          font-family: ${T.font.sans};
          box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.5);
        }
        .prsm-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 0;
          background: transparent;
          color: ${T.color.inkMuted};
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 120ms, background 120ms;
        }
        .prsm-close:hover,
        .prsm-close:focus-visible {
          color: ${T.color.ink};
          background: ${T.color.surfaceSoft};
          outline: none;
        }
        .prsm-eyebrow {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.color.accent};
          font-weight: 700;
        }
        .prsm-title {
          font-family: ${T.font.serif};
          font-size: clamp(20px, 3vw, 26px);
          font-weight: 400;
          margin: 8px 0 6px;
          color: ${T.color.ink};
          line-height: 1.2;
          padding-right: 40px;
        }
        .prsm-title-success {
          padding-right: 0;
          text-align: center;
        }
        .prsm-body {
          margin: 0 0 18px;
          font-size: 13.5px;
          color: ${T.color.inkMuted};
          line-height: 1.55;
        }
        .prsm-photo {
          margin: 0 0 18px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid ${T.color.hairline};
          background: ${T.color.surfaceSoft};
          aspect-ratio: 4 / 3;
        }
        .prsm-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .prsm-summary {
          margin: 0 0 20px;
          padding: 14px 16px;
          background: ${T.color.surfaceSoft};
          border-radius: 10px;
          border: 1px solid ${T.color.hairline};
        }
        .prsm-summary-heading {
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${T.color.accentDeep};
          font-weight: 700;
          margin-bottom: 8px;
        }
        .prsm-summary-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .prsm-summary-list li {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12.5px;
        }
        .prsm-summary-key {
          color: ${T.color.inkMuted};
          text-transform: capitalize;
        }
        .prsm-summary-val {
          color: ${T.color.ink};
          font-weight: 600;
          text-transform: capitalize;
          text-align: right;
        }
        .prsm-summary-empty {
          margin: 0;
          font-size: 12.5px;
          color: ${T.color.inkMuted};
          font-style: italic;
        }
        .prsm-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .prsm-primary {
          padding: 14px 20px;
          border: 0;
          border-radius: 999px;
          background: ${T.color.accent};
          color: #FFFFFF;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 8px 18px -8px rgba(181, 143, 94, 0.55);
          transition: background 140ms, transform 140ms, box-shadow 140ms;
        }
        .prsm-primary:hover,
        .prsm-primary:focus-visible {
          background: ${T.color.accentDeep};
          transform: translateY(-1px);
          box-shadow: 0 10px 22px -8px rgba(142, 109, 66, 0.65);
          outline: none;
        }
        .prsm-secondary {
          padding: 12px 18px;
          border: 1px solid ${T.color.hairline};
          border-radius: 999px;
          background: transparent;
          color: ${T.color.inkMuted};
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: color 120ms, background 120ms, border-color 120ms;
        }
        .prsm-secondary:hover,
        .prsm-secondary:focus-visible {
          color: ${T.color.ink};
          background: ${T.color.surfaceSoft};
          border-color: ${T.color.accent};
          outline: none;
        }
        .prsm-note {
          margin: 14px 0 0;
          font-size: 11px;
          color: ${T.color.inkFaint};
          text-align: center;
          line-height: 1.5;
        }
        .prsm-success-icon {
          margin: 8px auto 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: ${T.color.seal};
          color: ${T.color.accentDeep};
        }
        @keyframes prsm-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .prsm-scrim { animation: none !important; }
          .prsm-primary:hover,
          .prsm-primary:focus-visible { transform: none; }
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}

// ═══════════════════════════════════════════════════════════════════
// Installed-examples lightbox · Philip 2026-08-18. Portalled overlay
// (escapes any Reveal ancestor transform · same pattern as
// CompareOverlay + ST-M01 OwnerChatOverlay). Renders a grid of curated
// "installed" photos for a single option so the customer can see what
// the finished staircase looks like in real settings. Dismissing the
// overlay (X · ESC · click-outside) returns to the wizard without
// changing selection state — this is a "learn more" affordance, not a
// picker. Adding more example URLs to the option's installed_examples
// array is a pure data change · no code required.
// ═══════════════════════════════════════════════════════════════════

function InstalledExamplesOverlay({
  title,
  examples,
  tileAspect,
  onClose,
}: {
  title: string;
  /** Accepts either bare URL strings (backwards compat) or `{ url,
   *  caption }` objects. Captions render as an overlay pill at the
   *  bottom of the tile + enlarged view (Philip 2026-08-18 · label
   *  configurations like "Left Side Handrail" so the customer knows
   *  what each photo demonstrates). */
  examples: Array<string | { url: string; caption?: string }>;
  /** Optional CSS aspect-ratio string for the grid tiles ("2/3", "3/4",
   *  "16/9" etc.). Defaults to "4/3" (landscape) when omitted. Set on
   *  the source option via `image_aspect` so portrait staircase photos
   *  can display full height without being cropped (Philip 2026-08-18
   *  · Q3 straight photos). */
  tileAspect?: string;
  onClose: () => void;
}) {
  const { design, set: setDesign } = useStaircaseDesign();
  const [mounted, setMounted] = useState(false);
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);
  useEffect(() => setMounted(true), []);

  // Normalise both shapes into a uniform { url, caption } internally
  // so the render doesn't have to keep branching on typeof.
  const normalisedExamples = examples.map((e) =>
    typeof e === "string" ? { url: e } : e,
  );

  // Prev / Next navigation in the enlarged view (Philip 2026-08-18 ·
  // swipe / arrow / keyboard). Wraps around at both ends so the
  // customer can loop through indefinitely without hitting a dead
  // stop. Guards on empty list.
  const showPrev = useCallback(() => {
    setEnlargedIndex((idx) => {
      if (idx === null || normalisedExamples.length === 0) return idx;
      return (idx - 1 + normalisedExamples.length) % normalisedExamples.length;
    });
  }, [normalisedExamples.length]);
  const showNext = useCallback(() => {
    setEnlargedIndex((idx) => {
      if (idx === null || normalisedExamples.length === 0) return idx;
      return (idx + 1) % normalisedExamples.length;
    });
  }, [normalisedExamples.length]);

  // Keyboard: ESC (existing behaviour) + Left/Right arrows (Philip
  // 2026-08-18). ESC priority — closes the enlarged view first, then
  // the whole lightbox. Arrows only navigate when enlarged.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (enlargedIndex !== null) {
          setEnlargedIndex(null);
          e.stopPropagation();
        } else {
          onClose();
        }
        return;
      }
      if (enlargedIndex === null) return;
      if (e.key === "ArrowLeft") {
        showPrev();
        e.stopPropagation();
      } else if (e.key === "ArrowRight") {
        showNext();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, enlargedIndex, showPrev, showNext]);

  // Touch swipe detection for mobile (Philip 2026-08-18). Delta > 50px
  // horizontal triggers prev/next; smaller deltas ignored so accidental
  // scroll/tap doesn't advance. Vertical dominant swipes ignored so
  // scrolling the sheet doesn't fire navigation.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      if (!start) return;
      const end = e.changedTouches[0];
      const dx = end.clientX - start.x;
      const dy = end.clientY - start.y;
      touchStartRef.current = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) showPrev();
      else showNext();
    },
    [showPrev, showNext],
  );

  // "My Staircase Similar" toggle (Philip 2026-08-18) · adds/removes
  // the current enlarged URL from StaircaseDesign.similarImages. Real
  // signal for retrofit customers — "I don't know the type but I want
  // one like this". Toggle is per URL so clicking again unmarks it.
  const similarSet = new Set(design.similarImages ?? []);
  const toggleSimilar = useCallback(
    (url: string) => {
      const current = design.similarImages ?? [];
      const next = current.includes(url)
        ? current.filter((u) => u !== url)
        : [...current, url];
      setDesign("similarImages", next.length > 0 ? next : undefined);
    },
    [design.similarImages, setDesign],
  );

  if (!mounted) return null;

  const enlarged =
    enlargedIndex !== null ? normalisedExamples[enlargedIndex] : null;
  const enlargedIsSimilar = enlarged ? similarSet.has(enlarged.url) : false;
  const hasMultiple = normalisedExamples.length > 1;

  const node = (
    <div
      className="inst-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={`Installed examples · ${title}`}
      onClick={onClose}
      data-testid="mt1-w01-installed-overlay"
    >
      <div className="inst-sheet" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="inst-close"
          onClick={onClose}
          aria-label="Close installed examples"
        >
          ×
        </button>
        <div className="inst-eyebrow">Installed examples</div>
        <h4 className="inst-title">{title}</h4>
        <p className="inst-body">
          A few finished staircases of this type in real homes. Click any
          photo to enlarge · close to return to the question.
        </p>
        <div className="inst-grid">
          {normalisedExamples.map((ex, i) => (
            <button
              type="button"
              key={`${ex.url}-${i}`}
              className="inst-tile"
              onClick={() => setEnlargedIndex(i)}
              aria-label={
                ex.caption
                  ? `Enlarge ${title} · ${ex.caption}`
                  : `Enlarge ${title} installed example ${i + 1}`
              }
              // Per-option aspect override so portrait staircase photos
              // fill the tile fully. Falls back to the tile's default
              // 4/3 when tileAspect is undefined (Philip 2026-08-18).
              style={tileAspect ? { aspectRatio: tileAspect } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ex.url}
                alt={ex.caption ?? `${title} installed example ${i + 1}`}
                loading="lazy"
              />
              {ex.caption && (
                <span className="inst-tile-caption">{ex.caption}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Enlarged view · Philip 2026-08-18 · full-screen dark scrim
          over the grid, image centered + contained, brown circular X
          close button top-right. Click the dark scrim to dismiss the
          enlarged view back to the grid (does NOT close the whole
          lightbox — that's the outer sheet's job). */}
      {enlarged && (
        <div
          className="inst-enlarged-scrim"
          onClick={(e) => {
            e.stopPropagation();
            setEnlargedIndex(null);
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          data-testid="mt1-w01-installed-enlarged"
        >
          <button
            type="button"
            className="inst-enlarged-close"
            onClick={(e) => {
              e.stopPropagation();
              setEnlargedIndex(null);
            }}
            aria-label="Close enlarged view"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>

          {/* Prev / Next arrow buttons · Philip 2026-08-18. Only render
              when there's more than one image. Sit at left/right edge
              of the scrim, brown circles matching close button. Touch
              swipe + keyboard arrows work on the whole scrim too. */}
          {hasMultiple && (
            <>
              <button
                type="button"
                className="inst-enlarged-nav inst-enlarged-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                aria-label="Previous image"
                data-testid="mt1-w01-installed-prev"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="inst-enlarged-nav inst-enlarged-next"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                aria-label="Next image"
                data-testid="mt1-w01-installed-next"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          <div
            className="inst-enlarged-frame"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="inst-enlarged-img"
              src={enlarged.url}
              alt={enlarged.caption ?? `${title} installed example enlarged`}
            />
            {enlarged.caption && (
              <div className="inst-enlarged-caption">{enlarged.caption}</div>
            )}

            {/* "My Staircase Similar" toggle · Philip 2026-08-18.
                Bottom-center of the enlarged frame. Marked state =
                solid brown (matches wizard accent), unmarked = white
                pill with brown text. Click adds/removes the URL from
                design.similarImages · idempotent, safe to toggle.
                Position counter appears alongside for orientation. */}
            <div className="inst-enlarged-actions">
              <button
                type="button"
                className={`inst-similar-btn${enlargedIsSimilar ? " inst-similar-btn-active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSimilar(enlarged.url);
                }}
                aria-pressed={enlargedIsSimilar}
                data-testid="mt1-w01-installed-similar"
              >
                <span aria-hidden className="inst-similar-icon">
                  {enlargedIsSimilar ? (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M20.285 6.708a1 1 0 0 1 0 1.414l-9.9 9.9a1 1 0 0 1-1.414 0l-5.657-5.657a1 1 0 1 1 1.414-1.414l4.95 4.95 9.193-9.193a1 1 0 0 1 1.414 0z" />
                    </svg>
                  ) : (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  )}
                </span>
                <span>
                  {enlargedIsSimilar
                    ? "Marked as similar to mine"
                    : "My Staircase Similar"}
                </span>
              </button>

              {hasMultiple && (
                <span className="inst-enlarged-counter">
                  {(enlargedIndex ?? 0) + 1} of {normalisedExamples.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inst-scrim {
          position: fixed;
          inset: 0;
          background: rgba(58, 52, 40, 0.62);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9000;
          animation: inst-fade 160ms ease;
        }
        .inst-sheet {
          position: relative;
          background: ${T.color.surface};
          border-radius: 16px;
          width: min(920px, 100%);
          max-height: 92vh;
          overflow: auto;
          padding: clamp(24px, 4vw, 40px);
          font-family: ${T.font.sans};
        }
        .inst-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 0;
          background: transparent;
          color: ${T.color.inkMuted};
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          transition: color 120ms, background 120ms;
        }
        .inst-close:hover,
        .inst-close:focus-visible {
          color: ${T.color.ink};
          background: ${T.color.surfaceSoft};
          outline: none;
        }
        .inst-eyebrow {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.color.accent};
        }
        .inst-title {
          font-family: ${T.font.serif};
          font-size: clamp(20px, 3vw, 26px);
          font-weight: 400;
          margin: 8px 0 6px;
          color: ${T.color.ink};
          line-height: 1.2;
          padding-right: 40px;
        }
        .inst-body {
          margin: 0 0 20px;
          font-size: 13px;
          color: ${T.color.inkMuted};
          line-height: 1.55;
        }
        .inst-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .inst-tile {
          position: relative;
          aspect-ratio: 4 / 3;
          background: ${T.color.surfaceSoft};
          border: 1px solid ${T.color.hairline};
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-family: inherit;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }
        /* Caption pill overlaid at bottom-center of the tile · Philip
           2026-08-18. Semi-transparent dark background with white text
           reads legibly over any photo. Bottom-inset so it doesn't
           touch the tile's rounded corners. */
        .inst-tile-caption {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(24, 20, 14, 0.78);
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
          max-width: calc(100% - 16px);
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }
        .inst-tile:hover,
        .inst-tile:focus-visible {
          transform: translateY(-2px);
          border-color: ${T.color.accent};
          box-shadow: 0 12px 26px -14px rgba(58, 52, 40, 0.28);
          outline: none;
        }
        .inst-tile img {
          width: 100%;
          height: 100%;
          /* Cover so every thumbnail fills its container to the same
             visual size (Philip 2026-08-18 · uniform thumbnails). The
             enlarged view uses object-fit contain so the full image is
             always available on click — no information lost, just
             cropped for the tile-scan pass. */
          object-fit: cover;
          display: block;
        }
        @keyframes inst-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .inst-scrim { animation: none !important; }
          .inst-tile:hover,
          .inst-tile:focus-visible { transform: none; }
        }

        /* Enlarged single-image view · Philip 2026-08-18. Sits on top
           of the grid via z-index. Dark scrim (not the sheet's cream),
           image centered + contained, brown circular close button
           top-right. Click scrim or brown X returns to grid. */
        .inst-enlarged-scrim {
          position: absolute;
          inset: 0;
          background: rgba(24, 20, 14, 0.86);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(24px, 5vw, 60px);
          z-index: 10;
          animation: inst-fade 180ms ease;
        }
        /* Frame wraps the enlarged image + caption together so the
           caption pill sits at the bottom of the image (not the
           viewport). stopPropagation on the frame keeps clicks inside
           the image area from closing the enlarged view. */
        .inst-enlarged-frame {
          position: relative;
          max-width: 100%;
          max-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .inst-enlarged-img {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
          border-radius: 8px;
          box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.7);
        }
        .inst-enlarged-caption {
          position: absolute;
          /* Sit above the action row (similar button + counter) so
             they don't collide at the bottom (Philip 2026-08-18). */
          bottom: 76px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(24, 20, 14, 0.82);
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          max-width: calc(100% - 32px);
          text-align: center;
          pointer-events: none;
        }
        .inst-enlarged-close {
          position: absolute;
          top: clamp(12px, 2vw, 20px);
          right: clamp(12px, 2vw, 20px);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #FFFFFF;
          border: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.5);
          transition: background 140ms, transform 140ms, box-shadow 140ms;
          z-index: 11;
        }
        .inst-enlarged-close:hover,
        .inst-enlarged-close:focus-visible {
          background: ${T.color.accentDeep};
          transform: scale(1.06);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.6);
          outline: none;
        }

        /* Prev / Next arrow nav buttons · Philip 2026-08-18. Same
           visual language as the close button (brown circle, white
           icon). Positioned at left / right edge of the scrim, vertically
           centered. Hidden on very narrow viewports where swipe is the
           primary gesture. */
        .inst-enlarged-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #FFFFFF;
          border: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.5);
          transition: background 140ms, transform 140ms, box-shadow 140ms;
          z-index: 11;
        }
        .inst-enlarged-prev { left: clamp(12px, 2vw, 24px); }
        .inst-enlarged-next { right: clamp(12px, 2vw, 24px); }
        .inst-enlarged-nav:hover,
        .inst-enlarged-nav:focus-visible {
          background: ${T.color.accentDeep};
          transform: translateY(-50%) scale(1.08);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.6);
          outline: none;
        }
        @media (max-width: 520px) {
          /* On narrow phones, hide the arrow buttons — swipe is the
             primary gesture, arrows would fight with the image area. */
          .inst-enlarged-nav { display: none; }
        }

        /* Bottom action row · "My Staircase Similar" toggle + position
           counter. Positioned inside the enlarged-frame so it sits
           over the image at the bottom. Row uses flex + gap so items
           wrap gracefully on narrow screens. */
        .inst-enlarged-actions {
          position: absolute;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px;
          background: rgba(24, 20, 14, 0.68);
          backdrop-filter: blur(12px) saturate(160%);
          -webkit-backdrop-filter: blur(12px) saturate(160%);
          border-radius: 999px;
          max-width: calc(100% - 32px);
          pointer-events: auto;
        }
        .inst-similar-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          background: #FFFFFF;
          color: ${T.color.accentDeep};
          border: 0;
          border-radius: 999px;
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: background 140ms, color 140ms, transform 140ms;
        }
        .inst-similar-btn:hover,
        .inst-similar-btn:focus-visible {
          background: ${T.color.surfaceSoft};
          transform: translateY(-1px);
          outline: none;
        }
        .inst-similar-btn-active {
          background: ${T.color.accent};
          color: #FFFFFF;
        }
        .inst-similar-btn-active:hover,
        .inst-similar-btn-active:focus-visible {
          background: ${T.color.accentDeep};
        }
        .inst-similar-icon {
          display: inline-flex;
          align-items: center;
        }
        .inst-enlarged-counter {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          padding: 0 10px;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
        }

        @media (prefers-reduced-motion: reduce) {
          .inst-enlarged-scrim { animation: none !important; }
          .inst-enlarged-close:hover,
          .inst-enlarged-close:focus-visible { transform: none; }
          .inst-enlarged-nav:hover,
          .inst-enlarged-nav:focus-visible { transform: translateY(-50%); }
          .inst-similar-btn:hover,
          .inst-similar-btn:focus-visible { transform: none; }
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}

// ═══════════════════════════════════════════════════════════════════
// Info-card body · Philip 2026-08-18 · single-CTA card used by
// Q_attachments_info (deferred placeholder — customer attaches photos
// / drawings later in the chat with the specialist). The card doesn't
// capture any customer answer; clicking Continue advances the wizard
// with the sentinel value "acknowledged".
// ═══════════════════════════════════════════════════════════════════

function InfoCardBody({
  body,
  ctaLabel,
  onContinue,
}: {
  body: string;
  ctaLabel: string;
  onContinue: () => void;
}) {
  return (
    <div className="info-card" data-testid="mt1-w01-info-card">
      <div className="info-icon" aria-hidden>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.99 8.83l-8.57 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </div>
      <p className="info-body">{body}</p>
      <button
        type="button"
        className="info-cta"
        onClick={onContinue}
        data-testid="mt1-w01-info-continue"
      >
        {ctaLabel} <span aria-hidden>→</span>
      </button>

      <style jsx>{`
        .info-card {
          background: ${T.color.surfaceSoft};
          border: 1px solid ${T.color.hairline};
          border-radius: 14px;
          padding: clamp(24px, 4vw, 36px);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }
        .info-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #FFFFFF;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .info-body {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: ${T.color.inkMuted};
        }
        .info-cta {
          padding: 11px 20px;
          background: ${T.color.accent};
          color: #FFFFFF;
          border: 0;
          border-radius: ${T.radius.button};
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 140ms;
        }
        .info-cta:hover,
        .info-cta:focus-visible {
          background: ${T.color.accentDeep};
          outline: none;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Textarea body · Philip 2026-08-18 · freeform notes captured at the
// end of the classification block (Q_notes). Optional — empty submit
// advances with an empty string. Character counter is soft (maxLength
// on the <textarea> element enforces the hard cap in the browser).
// ═══════════════════════════════════════════════════════════════════

function TextareaBody({
  initial,
  placeholder,
  maxLength,
  ctaLabel,
  onSubmit,
}: {
  initial: string;
  placeholder: string;
  maxLength: number;
  ctaLabel: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const trimmed = text.trim();
  const remaining = maxLength - text.length;

  return (
    <div className="ta-card" data-testid="mt1-w01-textarea">
      <textarea
        className="ta-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={6}
        data-testid="mt1-w01-textarea-input"
      />
      <div className="ta-meta">
        <span className="ta-count">
          {text.length} / {maxLength}
        </span>
        {remaining < 100 && remaining >= 0 && (
          <span className="ta-remaining">{remaining} characters remaining</span>
        )}
      </div>
      <div className="ta-actions">
        <button
          type="button"
          className="ta-skip"
          onClick={() => onSubmit("")}
          data-testid="mt1-w01-textarea-skip"
        >
          Skip
        </button>
        <button
          type="button"
          className="ta-continue"
          onClick={() => onSubmit(trimmed)}
          data-testid="mt1-w01-textarea-continue"
        >
          {trimmed ? ctaLabel : "Continue without notes"} <span aria-hidden>→</span>
        </button>
      </div>

      <style jsx>{`
        .ta-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }
        .ta-input {
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          min-height: 120px;
          padding: 14px 16px;
          background: ${T.color.surface};
          border: 1.5px solid ${T.color.hairline};
          border-radius: 12px;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.55;
          color: ${T.color.ink};
          transition: border-color 120ms;
        }
        .ta-input:focus {
          border-color: ${T.color.accent};
          outline: none;
        }
        .ta-input::placeholder {
          color: ${T.color.inkFaint};
        }
        .ta-meta {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          color: ${T.color.inkFaint};
          padding: 0 4px;
        }
        .ta-count {
          font-variant-numeric: tabular-nums;
        }
        .ta-remaining {
          color: ${T.color.accentDeep};
        }
        .ta-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .ta-skip {
          padding: 10px 16px;
          background: transparent;
          border: 1px solid ${T.color.hairline};
          border-radius: ${T.radius.button};
          font-family: inherit;
          font-size: 13px;
          color: ${T.color.inkMuted};
          cursor: pointer;
          transition: color 120ms, border-color 120ms;
        }
        .ta-skip:hover,
        .ta-skip:focus-visible {
          color: ${T.color.ink};
          border-color: ${T.color.accent};
          outline: none;
        }
        .ta-continue {
          padding: 11px 20px;
          background: ${T.color.accent};
          color: #FFFFFF;
          border: 0;
          border-radius: ${T.radius.button};
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 140ms;
        }
        .ta-continue:hover,
        .ta-continue:focus-visible {
          background: ${T.color.accentDeep};
          outline: none;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Complete · summary + edit + send
// ═══════════════════════════════════════════════════════════════════

function CompleteCard({
  answers,
  country,
  specialistFlag,
  onEdit,
  onReset,
  onSend,
}: {
  answers: Record<string, string>;
  country: CountryCode | undefined;
  specialistFlag: ReturnType<typeof getSpecialistReviewRequirement>;
  onEdit: () => void;
  onReset: () => void;
  onSend: () => void;
}) {
  const { design } = useStaircaseDesign();
  const groups = summariseGrouped(answers, country, design);
  const notesRow = groups
    .find((g) => g.heading === "Notes")
    ?.rows.find((r) => r.label === "Notes");

  return (
    <div className="complete" data-testid="mt1-w01-complete">
      <div className="eyebrow">New staircase project · draft specification</div>
      <h3 className="title">Your project snapshot</h3>

      {/* Grouped snapshot · Philip 2026-08-18 · replaces the earlier
          flat DL. Sections match his taxonomy: PROJECT (physical site
          facts) · CUSTOMER (who's buying) · COMMERCIAL (what they need
          from the specialist) · STAIRCASE (design choices). Empty
          groups drop out — no headings without rows. */}
      {groups
        .filter((g) => g.heading !== "Notes" && g.rows.length > 0)
        .map((group) => (
          <section className="grp" key={group.heading} data-testid={`mt1-w01-summary-${group.heading.toLowerCase()}`}>
            <h4 className="grp-heading">{group.heading}</h4>
            <dl className="grp-rows">
              {group.rows.map((row) => (
                <div className="row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

      {notesRow && (
        <section className="notes-block" data-testid="mt1-w01-summary-notes">
          <h4 className="grp-heading">Customer notes</h4>
          <blockquote className="notes-quote">"{notesRow.value}"</blockquote>
        </section>
      )}

      {specialistFlag.required && (
        <div className="flag">
          <strong>Specialist review recommended.</strong> {specialistFlag.reason}
        </div>
      )}

      <div className="disclaimer">
        NEX doesn't calculate measurements, structural requirements, or final
        price. When you're ready, a specialist will take site measurements,
        confirm regulations for your region, and give you a full quote.
      </div>

      <div className="actions">
        <button type="button" className="edit" onClick={onEdit}>
          Edit choices
        </button>
        <button type="button" className="send" onClick={onSend}>
          Send to specialist <span aria-hidden>→</span>
        </button>
      </div>

      <button type="button" className="reset" onClick={onReset}>
        Start over
      </button>

      <style jsx>{`
        .complete {
          background: ${T.color.surface};
          border: 1px solid ${T.color.hairline};
          border-radius: 16px;
          padding: clamp(28px, 4vw, 44px);
          box-shadow: ${T.shadow.softCard};
        }
        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.color.accent};
        }
        .title {
          font-family: ${T.font.serif};
          font-size: clamp(22px, 3.4vw, 28px);
          font-weight: 400;
          margin: 8px 0 22px;
          color: ${T.color.ink};
          line-height: 1.2;
        }
        /* Grouped snapshot sections · one per category. Each carries a
           small accent-underlined heading + a DL of row pairs. */
        .grp {
          margin: 0 0 20px;
        }
        .grp-heading {
          font-family: ${T.font.sans};
          font-size: 10.5px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 700;
          color: ${T.color.accent};
          margin: 0 0 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid ${T.color.hairline};
        }
        .grp-rows {
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }
        .row {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 16px;
          padding: 8px 0;
          border-bottom: 1px solid ${T.color.seal};
        }
        .row:last-child {
          border-bottom: 0;
        }
        @media (max-width: 640px) {
          .row {
            grid-template-columns: 1fr;
            gap: 2px;
            padding: 10px 0;
          }
        }
        .row dt {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${T.color.inkFaint};
          margin: 0;
        }
        .row dd {
          font-size: 14px;
          color: ${T.color.ink};
          margin: 0;
          line-height: 1.45;
        }
        /* Customer notes get their own block underneath the tables
           because they're free-form prose, not tabular. Rendered as a
           blockquote with cream background + accent left rule. */
        .notes-block {
          margin: 0 0 20px;
        }
        .notes-quote {
          margin: 0;
          padding: 12px 16px;
          background: ${T.color.surfaceSoft};
          border-left: 3px solid ${T.color.accent};
          border-radius: 6px;
          font-family: ${T.font.serif};
          font-style: italic;
          font-size: 14px;
          line-height: 1.55;
          color: ${T.color.ink};
        }
        .flag {
          margin: 8px 0 16px;
          padding: 12px 14px;
          background: ${T.color.seal};
          border-left: 3px solid ${T.color.accent};
          border-radius: 6px;
          font-size: 13px;
          color: ${T.color.ink};
          line-height: 1.55;
        }
        .disclaimer {
          font-size: 12.5px;
          color: ${T.color.inkMuted};
          margin: 0 0 22px;
          line-height: 1.55;
          padding: 12px 14px;
          background: ${T.color.surfaceSoft};
          border-radius: 8px;
        }
        .actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .edit,
        .send,
        .reset {
          font-family: inherit;
          cursor: pointer;
          border-radius: ${T.radius.button};
        }
        .edit {
          padding: 12px 20px;
          background: transparent;
          border: 1.5px solid ${T.color.hairline};
          color: ${T.color.ink};
          font-size: 13px;
          font-weight: 600;
        }
        .edit:hover {
          border-color: ${T.color.accent};
        }
        .send {
          padding: 12px 22px;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 140ms;
        }
        .send:hover,
        .send:focus-visible {
          background: ${T.color.accentDeep};
        }
        .reset {
          margin-top: 18px;
          padding: 6px 10px;
          background: transparent;
          border: 0;
          color: ${T.color.inkFaint};
          font-size: 12px;
        }
        .reset:hover {
          color: ${T.color.ink};
        }
      `}</style>
    </div>
  );
}

// Field-label mapping for the summary. Never invents values — missing
// answers show as "—".
type SummaryRow = { label: string; value: string };
type SummaryGroup = { heading: string; rows: SummaryRow[] };

/** Build the grouped project snapshot rendered by CompleteCard and
 *  serialised into the handoff text (Philip 2026-08-18 · rebuild).
 *  Empty rows drop out silently at the group level; empty groups drop
 *  out at the render level (in CompleteCard) so the customer never
 *  sees a heading with nothing under it. Ordering:
 *    PROJECT   → physical site facts (country, property, opening)
 *    CUSTOMER  → who's buying, VAT status if applicable
 *    COMMERCIAL→ what they need from the specialist
 *    STAIRCASE → design decisions (Q2 – Q12)
 *    NOTES     → freeform Q_notes text (only if non-empty)
 *  Notes render below the tables as a blockquote in CompleteCard —
 *  buildHandoffSummary keeps them at the end of the text serialisation
 *  as their own labelled section. */
function summariseGrouped(
  answers: Record<string, string>,
  country: CountryCode | undefined,
  design?: StaircaseDesignState,
): SummaryGroup[] {
  const pick = (nodeId: string, label: string): SummaryRow | null => {
    const v = labelFromNode(nodeId, answers[nodeId], country);
    return v ? { label, value: v } : null;
  };

  const project: SummaryRow[] = [
    answers.Q1_country
      ? { label: "Location", value: labelForCountry(answers.Q1_country) ?? answers.Q1_country }
      : null,
    pick("Q_property_type", "Property"),
    pick("Q_build_stage", "Build stage"),
    pick("Q_replace_existing", "Existing staircase"),
    pick("Q_opening_ready", "Staircase opening"),
  ].filter((r): r is SummaryRow => r !== null);

  const customer: SummaryRow[] = [
    pick("Q_customer_type", "Type"),
    pick("Q_vat_status", "VAT status"),
  ].filter((r): r is SummaryRow => r !== null);

  const commercial: SummaryRow[] = [
    pick("Q_install_required", "Installation"),
    pick("Q_supply_market", "Market"),
    pick("Q_export_country", "Export destination"),
    pick("Q_project_stage", "Buying-journey stage"),
  ].filter((r): r is SummaryRow => r !== null);

  const staircase: SummaryRow[] = [
    pick("Q2_use", "Location in building"),
    pick("Q4_material_family", "Material family"),
    pick("Q3_geometry", "Shape"),
    pick("Q5_structural", "Support"),
    pick("Q6_riser", "Riser style"),
    pick("Q7_tread_material", "Tread material"),
    pick("Q7a_timber_species", "Timber species"),
    pick("Q8_balustrade_material", "Balustrade"),
    pick("Q_handrail_position", "Handrail position"),
    pick("Q9_handrail_material", "Handrail"),
    pick("Q10_newel", "Newel style"),
    pick("Q12_finish", "Finish"),
    // Reference images the customer flagged via "My Staircase Similar"
    // in any Examples lightbox (Philip 2026-08-18). Count only — the
    // URLs live on design.similarImages and are handed to the specialist
    // in the eventual Submission JSON. Row hidden when nothing flagged.
    (design?.similarImages?.length ?? 0) > 0
      ? {
          label: "Reference images",
          value: `${design!.similarImages!.length} marked as similar to existing staircase`,
        }
      : null,
  ].filter((r): r is SummaryRow => r !== null);

  const notesText = (answers.Q_notes ?? "").trim();
  const notes: SummaryRow[] = notesText
    ? [{ label: "Notes", value: notesText }]
    : [];

  return [
    { heading: "Project",    rows: project },
    { heading: "Customer",   rows: customer },
    { heading: "Commercial", rows: commercial },
    { heading: "Staircase",  rows: staircase },
    { heading: "Notes",      rows: notes },
  ];
}

function labelForCountry(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const pack = getRegionalPack(code as CountryCode);
  return pack ? `${code} · ${pack.language}` : code;
}

function labelFromNode(
  nodeId: string,
  value: string | undefined,
  country: CountryCode | undefined,
): string | undefined {
  if (!value) return undefined;
  if (value === UNKNOWN_VALUE) return "Not decided · specialist will confirm";
  const node = getDecisionNode(nodeId, country);
  const opt = node?.options.find((o) => o.value === value);
  return opt?.label ?? value;
}

// ═══════════════════════════════════════════════════════════════════
// Compare overlay · portalled visual comparison for "I'm not sure"
// ═══════════════════════════════════════════════════════════════════

function CompareOverlay({
  nodeId,
  onPick,
  onClose,
}: {
  nodeId: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const alternatives = getAlternatives(nodeId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || !alternatives) return null;

  const node = (
    <div
      className="cmp-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Compare options"
      onClick={onClose}
      data-testid="mt1-w01-compare-overlay"
    >
      <div className="cmp-sheet" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="cmp-close"
          onClick={onClose}
          aria-label="Close comparison"
        >
          ×
        </button>
        <div className="cmp-eyebrow">Not sure? Compare visually</div>
        <h4 className="cmp-title">{alternatives.question_plain_en}</h4>
        <div className="cmp-grid">
          {alternatives.alternatives.map((alt) => (
            <button
              key={alt.value}
              type="button"
              className="cmp-card"
              onClick={() => onPick(alt.value)}
            >
              {alt.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="cmp-img"
                  src={alt.image_url}
                  alt={alt.label}
                  loading="lazy"
                />
              ) : (
                <div className="cmp-thumb" aria-hidden />
              )}
              <div className="cmp-label">{alt.label}</div>
              {alt.plain_en && <div className="cmp-plain">{alt.plain_en}</div>}
            </button>
          ))}
        </div>
        <div className="cmp-footnote">
          Pick the one that looks closest. A specialist will confirm at
          site visit.
        </div>
      </div>

      <style jsx>{`
        .cmp-scrim {
          position: fixed;
          inset: 0;
          background: rgba(58, 52, 40, 0.62);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9000;
          animation: fade 160ms ease;
        }
        .cmp-sheet {
          position: relative;
          background: ${T.color.surface};
          border-radius: 16px;
          width: min(920px, 100%);
          max-height: 92vh;
          overflow: auto;
          padding: clamp(24px, 4vw, 40px);
          font-family: ${T.font.sans};
        }
        .cmp-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .cmp-close:hover {
          background: ${T.color.accentDeep};
        }
        .cmp-eyebrow {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.color.accent};
        }
        .cmp-title {
          font-family: ${T.font.serif};
          font-size: clamp(20px, 3vw, 26px);
          font-weight: 400;
          margin: 6px 0 22px;
          color: ${T.color.ink};
          line-height: 1.2;
        }
        .cmp-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        @media (min-width: 720px) {
          .cmp-grid {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          }
        }
        .cmp-card {
          text-align: left;
          background: ${T.color.surfaceSoft};
          border: 1.5px solid transparent;
          border-radius: 12px;
          padding: 14px;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 120ms, transform 120ms;
        }
        .cmp-card:hover {
          border-color: ${T.color.accent};
          transform: translateY(-2px);
        }
        .cmp-thumb {
          aspect-ratio: 4 / 3;
          background: linear-gradient(
              135deg,
              ${T.color.seal} 0%,
              ${T.color.surface} 100%
            );
          border-radius: 8px;
        }
        .cmp-img {
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
          border-radius: 8px;
          display: block;
        }
        .cmp-label {
          font-size: 14px;
          font-weight: 600;
          color: ${T.color.ink};
        }
        .cmp-plain {
          font-size: 12.5px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
        }
        .cmp-footnote {
          margin-top: 18px;
          font-size: 12px;
          color: ${T.color.inkFaint};
          text-align: center;
        }
        @keyframes fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}

// ═══════════════════════════════════════════════════════════════════
// Handoff overlay · sends the specification to a specialist via NEX Chat
// ═══════════════════════════════════════════════════════════════════

function HandoffOverlay({
  answers,
  country,
  specialistFlag,
  onClose,
}: {
  answers: Record<string, string>;
  country: CountryCode | undefined;
  specialistFlag: ReturnType<typeof getSpecialistReviewRequirement>;
  onClose: () => void;
}) {
  const { design } = useStaircaseDesign();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const summaryText = buildHandoffSummary(answers, country, specialistFlag, design);

  const node = (
    <div
      className="ho-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Send to specialist via NEX Chat"
      onClick={onClose}
      data-testid="mt1-w01-handoff-overlay"
    >
      <div className="ho-sheet" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ho-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="ho-eyebrow">Continue in NEX Chat</div>
        <h4 className="ho-title">Send your specification to a specialist</h4>
        <p className="ho-body">
          Your choices will open a NEX Chat conversation with a staircase
          specialist. They'll confirm dimensions, regulations for your
          region, and pricing — nothing NEX has calculated for you.
        </p>
        <pre className="ho-summary">{summaryText}</pre>
        <div className="ho-actions">
          <button type="button" className="ho-cancel" onClick={onClose}>
            Not yet
          </button>
          <button type="button" className="ho-send">
            Open NEX Chat <span aria-hidden>→</span>
          </button>
        </div>
        <div className="ho-footnote">
          NEX Chat is the same identity you use across every NEX experience.
          You'll be able to continue this conversation later on any device.
        </div>
      </div>

      <style jsx>{`
        .ho-scrim {
          position: fixed;
          inset: 0;
          background: rgba(58, 52, 40, 0.62);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9100;
          animation: hofade 160ms ease;
        }
        .ho-sheet {
          position: relative;
          background: ${T.color.surface};
          border-radius: 16px;
          width: min(640px, 100%);
          max-height: 92vh;
          overflow: auto;
          padding: clamp(24px, 4vw, 40px);
          font-family: ${T.font.sans};
        }
        .ho-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ho-close:hover {
          background: ${T.color.accentDeep};
        }
        .ho-eyebrow {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.color.accent};
        }
        .ho-title {
          font-family: ${T.font.serif};
          font-size: clamp(20px, 3vw, 26px);
          font-weight: 400;
          margin: 6px 0 12px;
          color: ${T.color.ink};
          line-height: 1.2;
        }
        .ho-body {
          font-size: 13.5px;
          line-height: 1.6;
          color: ${T.color.inkMuted};
          margin: 0 0 16px;
        }
        .ho-summary {
          background: ${T.color.surfaceSoft};
          border-radius: 10px;
          padding: 14px 16px;
          font-family: ui-monospace, "Menlo", "Consolas", monospace;
          font-size: 12px;
          color: ${T.color.ink};
          white-space: pre-wrap;
          margin: 0 0 20px;
          max-height: 240px;
          overflow: auto;
        }
        .ho-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .ho-cancel,
        .ho-send {
          font-family: inherit;
          cursor: pointer;
          border-radius: ${T.radius.button};
        }
        .ho-cancel {
          padding: 10px 18px;
          background: transparent;
          border: 1.5px solid ${T.color.hairline};
          color: ${T.color.ink};
          font-size: 13px;
          font-weight: 600;
        }
        .ho-cancel:hover {
          border-color: ${T.color.accent};
        }
        .ho-send {
          padding: 10px 22px;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 140ms;
        }
        .ho-send:hover,
        .ho-send:focus-visible {
          background: ${T.color.accentDeep};
        }
        .ho-footnote {
          margin-top: 16px;
          font-size: 11.5px;
          color: ${T.color.inkFaint};
          text-align: center;
          line-height: 1.5;
        }
        @keyframes hofade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}

function buildHandoffSummary(
  answers: Record<string, string>,
  country: CountryCode | undefined,
  specialistFlag: ReturnType<typeof getSpecialistReviewRequirement>,
  design?: StaircaseDesignState,
): string {
  const groups = summariseGrouped(answers, country, design);
  const lines: string[] = [
    "NEW STAIRCASE PROJECT",
    "(from NEX Guided Design)",
    "",
  ];
  for (const g of groups) {
    if (g.rows.length === 0) continue;
    lines.push(`─ ${g.heading.toUpperCase()} ───────────────────`);
    for (const row of g.rows) {
      lines.push(`${row.label.padEnd(22)} ${row.value}`);
    }
    lines.push("");
  }
  if (specialistFlag.required) {
    lines.push(`Flag: ${specialistFlag.reason}`, "");
  }
  return lines.join("\n").trimEnd();
}

