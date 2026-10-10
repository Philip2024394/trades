// src/components/nex-native/directory/OwnerClaimForm.tsx
//
// NEX Directory · Owner Claim · category-adaptive form.
//
// What this component is
//   · The single React surface the Directory UI mounts when an owner
//     taps "Own this business? Claim it" on a non-OWNER_CLAIMED
//     listing. Walks the owner through an intro → category-adaptive
//     details form → contact channel → code-issue step → a honest
//     outcome screen.
//   · Category-adaptive: branches on `listing.entityType` and renders
//     a dedicated form slice per Directory presentation bucket.
//
// What this component is NOT
//   · Not a server-side router — it stays on the current URL and
//     closes itself via `onClose` when the owner cancels. If the
//     parent wants to redirect post-claim, that is the parent's job
//     (today there is no post-claim because the cross-DB write path
//     is blocked — see actions.ts).
//   · Not a message logger. Doctrine #7 does NOT apply to
//     owner-authored business content (public once they claim) but
//     the component still never logs or echoes the input anywhere
//     beyond sessionStorage + the server action.
//   · Not a Vault surface. Vault keys / plaintext / cipher never
//     appear here.
//
// Persistence model
//   · Pre-claim drafts are CLIENT-SIDE sessionStorage only, keyed
//     by canonical_business_id. See `draft-storage.ts`.
//   · The server action refuses to issue a verification code until
//     the cross-DB owner-link ADR is signed off. See `actions.ts`.
//   · This component NEVER fabricates a code, NEVER pretends to
//     send one. The `code` view explains the architectural gate
//     honestly and offers to save the owner's contact for follow-up.
//
// Accessibility
//   · The form is semantic HTML (fieldset, legend, label).
//   · Field errors are reported in-line with aria-describedby on the
//     relevant input (via wrapping Field helper).

"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DirectoryListingVM,
  EntityType,
} from "@/lib/nex-native/directory";
import {
  ACCOMMODATION_FACILITIES,
  CLAIM_CONTACT_CHANNELS,
  CUISINE_PRESETS,
  DIETARY_FLAGS,
  SERVICE_PRICE_METHODS,
  TRANSPORT_PRICE_METHODS,
  TRANSPORT_SERVICE_PRESETS,
  VEHICLE_TYPES,
  emptyDraft,
  emptyMenuSection,
  emptyOpeningHours,
  emptyRentalTerms,
  emptyRoomType,
  emptyVehicle,
  type AccommodationFacility,
  type ClaimContactChannel,
  type DietaryFlag,
  type FieldError,
  type MenuSectionInput,
  type OpeningHoursInput,
  type OwnerClaimDraft,
  type OwnerClaimDraftKind,
  type RoomTypeInput,
  type ServicePriceMethod,
  type TransportPriceMethod,
  type VehicleInput,
  type VehicleType,
} from "@/lib/nex-native/directory/owner-claim/types";
import { validateClaimDraft } from "@/lib/nex-native/directory/owner-claim/schema";
import {
  clearDraft,
  loadDraft as loadLocalDraft,
  saveDraft as saveLocalDraft,
} from "@/lib/nex-native/directory/owner-claim/draft-storage";
import {
  loadDraftAction,
  saveDraftAction,
  updateContactAction,
  requestClaimCodeAction as newRequestClaimCodeAction,
  verifyClaimCodeAction,
} from "@/lib/nex-native/directory/owner-claim/actions";

// ═════════════════════════════════════════════════════════════════════
// §1 · Palette · aligned with the Directory card/panel palette
// ═════════════════════════════════════════════════════════════════════

const PALETTE = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.08)",
  errorRed: "#FF5B6E",
  warnOrange: "#FFB266",
  successGreen: "#4ADE80",
} as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · Entity → draft-kind mapping
// ═════════════════════════════════════════════════════════════════════

/**
 * Maps the sealed 9-value EntityType to the 6 adaptive form kinds.
 *
 * Sealed EntityType values (migration 167 ck_bc_entity_type):
 *   food · accommodation · service · professional · vehicle_rental
 *   marketplace_seller · transport_driver · transport_operator · place
 *
 * Returns `null` for entity_types that do NOT branch into this form:
 *   · professional          — currently Directory-only; no owner-claim
 *                             surface defined for the professional vertical
 *   · place                 — read-only Directory listing; no claim
 *   · transport_driver /    — collapse into a single `transport` draft
 *     transport_operator      kind (both share the same adaptive form)
 */
function kindForEntityType(entityType: EntityType): OwnerClaimDraftKind | null {
  switch (entityType) {
    case "accommodation":        return "accommodation";
    case "food":                 return "food";
    case "vehicle_rental":       return "vehicle_rental";
    case "service":              return "service";
    case "transport_driver":     return "transport";
    case "transport_operator":   return "transport";
    case "marketplace_seller":   return "marketplace_seller";
    case "professional":
    case "place":
      return null;
    default:
      return null;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Small UI helpers
// ═════════════════════════════════════════════════════════════════════

interface FieldProps {
  readonly label: string;
  readonly htmlFor?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: React.ReactNode;
}

function Field(props: FieldProps): React.ReactElement {
  const errorId = props.error ? `${props.htmlFor ?? "field"}-err` : undefined;
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        htmlFor={props.htmlFor}
        style={{
          display: "block",
          color: PALETTE.textDim,
          fontSize: 13,
          marginBottom: 4,
        }}
      >
        {props.label}
      </label>
      {React.isValidElement(props.children) && errorId
        ? React.cloneElement(
            props.children as React.ReactElement<{ "aria-describedby"?: string }>,
            { "aria-describedby": errorId },
          )
        : props.children}
      {props.hint ? (
        <div style={{ color: PALETTE.textSoft, fontSize: 12, marginTop: 2 }}>
          {props.hint}
        </div>
      ) : null}
      {props.error ? (
        <div
          id={errorId}
          role="alert"
          style={{ color: PALETTE.errorRed, fontSize: 12, marginTop: 2 }}
        >
          {props.error}
        </div>
      ) : null}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    background: PALETTE.surface,
    color: PALETTE.text,
    border: `1px solid ${PALETTE.borderSoft}`,
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
  };
}

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 999,
    border: `1px solid ${selected ? PALETTE.cyan : PALETTE.borderSoft}`,
    background: selected ? PALETTE.cyanFaint : PALETTE.surface,
    color: selected ? PALETTE.cyan : PALETTE.textDim,
    fontSize: 13,
    cursor: "pointer",
    userSelect: "none",
  };
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "#4A2A0A" : PALETTE.orange,
    color: disabled ? PALETTE.textSoft : "#1A1300",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function ghostButtonStyle(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 10,
    border: `1px solid ${PALETTE.borderSoft}`,
    background: "transparent",
    color: PALETTE.textDim,
    fontSize: 14,
    cursor: "pointer",
  };
}

// Error lookup helper — turns the validator's path+message list into
// a quick O(1) lookup by path for inline rendering.
function errorIndex(errors: readonly FieldError[]): Record<string, string> {
  const idx: Record<string, string> = {};
  for (const e of errors) {
    if (idx[e.path] === undefined) idx[e.path] = e.message;
  }
  return idx;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Props + view state
// ═════════════════════════════════════════════════════════════════════

export interface OwnerClaimFormProps {
  readonly listing: DirectoryListingVM;
  readonly canonicalId: string;
  /** Optional parent-driven close affordance (e.g. slide-up panel's
   *  dismiss). The component also triggers this when the owner
   *  confirms "Cancel". */
  readonly onClose?: () => void;
}

type View =
  | "intro"
  | "details"
  | "contact"
  | "code"       // in-flight "preparing your code" screen
  | "verify"    // owner types the 6-digit code they received
  | "done"
  | "blocked";

// ═════════════════════════════════════════════════════════════════════
// §5 · The main component
// ═════════════════════════════════════════════════════════════════════

export function OwnerClaimForm(
  props: OwnerClaimFormProps,
): React.ReactElement {
  const { listing, canonicalId, onClose } = props;
  const kind = useMemo(() => kindForEntityType(listing.entityType), [listing.entityType]);

  const [view, setView] = useState<View>("intro");
  const [draft, setDraft] = useState<OwnerClaimDraft | null>(() => {
    if (!kind) return null;
    return emptyDraft(kind);
  });
  const [errors, setErrors] = useState<readonly FieldError[]>([]);
  const [channel, setChannel] = useState<ClaimContactChannel>("email");
  const [destination, setDestination] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serverReason, setServerReason] = useState<string | null>(null);
  const [blockedChannel, setBlockedChannel] = useState<ClaimContactChannel | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState<string>("");
  const [deliveryHint, setDeliveryHint] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Hydrate draft from the SERVER-SIDE store first (migration 190
  // backs this; preferred source of truth). Fall back to sessionStorage
  // only when the server has nothing (anonymous viewer, fresh browser,
  // or dev-offline mode).
  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await loadDraftAction({ canonicalId });
        if (cancelled) return;
        if (res.ok && res.draft && res.draft.kind === kind) {
          setDraft(res.draft);
          if (res.contact_channel) {
            setChannel(res.contact_channel as ClaimContactChannel);
          }
          if (res.contact_destination) {
            setDestination(res.contact_destination);
          }
          return;
        }
      } catch {
        /* fall through to sessionStorage fallback */
      }
      // Fallback: sessionStorage draft for anonymous viewers.
      const local = loadLocalDraft(canonicalId);
      if (!cancelled && local && local.kind === kind) {
        setDraft(local);
      }
    })();
    return () => { cancelled = true; };
  }, [canonicalId, kind]);

  // Blur-save: every time `draft` changes we persist it to
  // sessionStorage as a cheap in-tab cache. Server-side persistence
  // happens on explicit "Save and continue" via saveDraftAction so
  // the user controls the write and the server never gets spam.
  useEffect(() => {
    if (!draft) return;
    const handle = setTimeout(() => {
      saveLocalDraft(canonicalId, draft);
    }, 300);
    return () => clearTimeout(handle);
  }, [canonicalId, draft]);

  const errIdx = useMemo(() => errorIndex(errors), [errors]);

  // Handlers ────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    const confirmed = typeof window !== "undefined"
      ? window.confirm("Discard your draft and close the form?")
      : true;
    if (!confirmed) return;
    clearDraft(canonicalId);
    if (onClose) onClose();
  }, [canonicalId, onClose]);

  const handleSaveForLater = useCallback(() => {
    if (draft) saveLocalDraft(canonicalId, draft);
    // Fire-and-forget server-side save too; errors are tolerated.
    if (draft) {
      void saveDraftAction({ canonicalId, draft }).catch(() => {});
    }
    if (onClose) onClose();
  }, [canonicalId, draft, onClose]);

  const handleDetailsContinue = useCallback(() => {
    if (!draft) return;
    const result = validateClaimDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    // Server-side persist BEFORE advancing. If the write fails with
    // an honest reason, we surface it on the blocked view.
    void (async () => {
      setSubmitting(true);
      try {
        const res = await saveDraftAction({ canonicalId, draft });
        if (!res.ok) {
          if (res.reason === "invalid_draft") {
            setErrors(
              (res.validation_errors ?? []).map((e) => ({
                path: e.path,
                message: e.message,
              })),
            );
            return;
          }
          setServerReason(res.reason);
          setSavedAt(null);
          setView("blocked");
          return;
        }
        setSavedAt(res.draft_saved_at);
        setView("contact");
      } catch {
        setServerReason("db_unavailable");
        setView("blocked");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [canonicalId, draft]);

  const handleContactContinue = useCallback(() => {
    if (!CLAIM_CONTACT_CHANNELS.includes(channel)) return;
    if (!destination.trim()) {
      setErrors([{ path: "destination", message: "Enter where to send the code." }]);
      return;
    }
    setErrors([]);
    setView("code");
    void (async () => {
      setSubmitting(true);
      try {
        const updated = await updateContactAction({
          canonicalId,
          channel,
          destination: destination.trim(),
        });
        if (!updated.ok) {
          setServerReason(updated.reason);
          setBlockedChannel(channel);
          setView("blocked");
          return;
        }
        const code = await newRequestClaimCodeAction({ canonicalId });
        if (!code.ok) {
          if (code.reason === "channel_adapter_not_implemented") {
            setServerReason(code.reason);
            setBlockedChannel((code.channel ?? channel) as ClaimContactChannel);
            setView("blocked");
            return;
          }
          setServerReason(code.reason);
          setBlockedChannel(channel);
          setView("blocked");
          return;
        }
        setDeliveryHint(code.delivery_hint);
        setView("verify");
      } catch {
        setServerReason("db_unavailable");
        setView("blocked");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [canonicalId, channel, destination]);

  const handleVerifySubmit = useCallback(() => {
    const trimmed = codeInput.trim();
    if (trimmed.length !== 6) {
      setVerifyError("Enter the 6-digit code we sent you.");
      return;
    }
    setVerifyError(null);
    void (async () => {
      setSubmitting(true);
      try {
        const res = await verifyClaimCodeAction({
          canonicalId,
          code: trimmed,
        });
        if (res.ok) {
          clearDraft(canonicalId);
          setView("done");
          return;
        }
        if (res.reason === "code_mismatch") {
          setVerifyError("That code didn't match. Try again, or request a new one.");
          return;
        }
        if (res.reason === "attempts_exhausted") {
          setServerReason(res.reason);
          setView("blocked");
          return;
        }
        setServerReason(res.reason);
        setView("blocked");
      } catch {
        setServerReason("db_unavailable");
        setView("blocked");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [canonicalId, codeInput]);

  // ─── Render ──────────────────────────────────────────────────────

  if (!kind || !draft) {
    return (
      <div style={{ padding: 20, color: PALETTE.textDim }}>
        <p>
          This listing is not eligible for the business claim form.
          Persons and public places use a different claim path.
        </p>
        {onClose ? (
          <button type="button" onClick={onClose} style={ghostButtonStyle()}>
            Close
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        background: PALETTE.bg,
        color: PALETTE.text,
        borderRadius: 12,
        padding: 20,
        maxWidth: 640,
      }}
    >
      {view === "intro" ? (
        <IntroView
          listing={listing}
          onStart={() => setView("details")}
          onClose={onClose}
        />
      ) : null}

      {view === "details" ? (
        <DetailsView
          kind={kind}
          draft={draft}
          setDraft={setDraft}
          errIdx={errIdx}
          onCancel={handleCancel}
          onSaveForLater={handleSaveForLater}
          onContinue={handleDetailsContinue}
        />
      ) : null}

      {view === "contact" ? (
        <ContactView
          channel={channel}
          setChannel={setChannel}
          destination={destination}
          setDestination={setDestination}
          errIdx={errIdx}
          onBack={() => setView("details")}
          onContinue={handleContactContinue}
        />
      ) : null}

      {view === "code" ? (
        <CodeView submitting={submitting} />
      ) : null}

      {view === "verify" ? (
        <VerifyView
          deliveryHint={deliveryHint}
          codeInput={codeInput}
          setCodeInput={setCodeInput}
          error={verifyError}
          submitting={submitting}
          onBack={() => setView("contact")}
          onSubmit={handleVerifySubmit}
        />
      ) : null}

      {view === "done" ? (
        <DoneView onClose={onClose} />
      ) : null}

      {view === "blocked" ? (
        <BlockedView
          reason={serverReason}
          savedAt={savedAt}
          destination={destination}
          channel={blockedChannel ?? channel}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §6 · IntroView
// ═════════════════════════════════════════════════════════════════════

function IntroView(props: {
  readonly listing: DirectoryListingVM;
  readonly onStart: () => void;
  readonly onClose?: () => void;
}): React.ReactElement {
  const subtitleParts: string[] = [];
  if (props.listing.city) subtitleParts.push(props.listing.city);
  if (props.listing.country) subtitleParts.push(props.listing.country);
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: 0, marginBottom: 4 }}>
        Own this business? Claim it in 60 seconds.
      </h2>
      <p style={{ color: PALETTE.textDim, marginTop: 0 }}>
        {props.listing.name}
        {subtitleParts.length > 0 ? ` · ${subtitleParts.join(", ")}` : ""}
      </p>
      <p style={{ color: PALETTE.textMuted, fontSize: 13 }}>
        We'll ask a short set of questions tailored to your type of business.
        Your answers stay on this device until you confirm.
      </p>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button type="button" onClick={props.onStart} style={primaryButtonStyle(false)}>
          Start
        </button>
        {props.onClose ? (
          <button type="button" onClick={props.onClose} style={ghostButtonStyle()}>
            Not now
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §7 · DetailsView · dispatch per kind
// ═════════════════════════════════════════════════════════════════════

interface DetailsViewProps {
  readonly kind: OwnerClaimDraftKind;
  readonly draft: OwnerClaimDraft;
  readonly setDraft: React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>;
  readonly errIdx: Record<string, string>;
  readonly onCancel: () => void;
  readonly onSaveForLater: () => void;
  readonly onContinue: () => void;
}

function DetailsView(props: DetailsViewProps): React.ReactElement {
  const { kind, draft } = props;
  return (
    <div>
      <h2 style={{ fontSize: 18, margin: 0, marginBottom: 12 }}>
        Tell us about your {humanKind(kind)}
      </h2>

      {draft.kind === "accommodation" ? (
        <AccommodationForm
          draft={draft}
          setDraft={props.setDraft as React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>}
          errIdx={props.errIdx}
        />
      ) : null}
      {draft.kind === "food" ? (
        <FoodForm draft={draft} setDraft={props.setDraft} errIdx={props.errIdx} />
      ) : null}
      {draft.kind === "vehicle_rental" ? (
        <VehicleRentalForm draft={draft} setDraft={props.setDraft} errIdx={props.errIdx} />
      ) : null}
      {draft.kind === "service" ? (
        <ServiceForm draft={draft} setDraft={props.setDraft} errIdx={props.errIdx} />
      ) : null}
      {draft.kind === "transport" ? (
        <TransportForm draft={draft} setDraft={props.setDraft} errIdx={props.errIdx} />
      ) : null}
      {draft.kind === "marketplace_seller" ? (
        <MarketplaceSellerForm draft={draft} setDraft={props.setDraft} errIdx={props.errIdx} />
      ) : null}

      <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={props.onContinue} style={primaryButtonStyle(false)}>
          Save and continue
        </button>
        <button type="button" onClick={props.onSaveForLater} style={ghostButtonStyle()}>
          Save for later
        </button>
        <button type="button" onClick={props.onCancel} style={ghostButtonStyle()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function humanKind(kind: OwnerClaimDraftKind): string {
  switch (kind) {
    case "accommodation":        return "accommodation";
    case "food":                 return "restaurant";
    case "vehicle_rental":       return "rental fleet";
    case "service":              return "service";
    case "transport":            return "transport service";
    case "marketplace_seller":   return "shop";
  }
}

// ═════════════════════════════════════════════════════════════════════
// §8 · Accommodation form
// ═════════════════════════════════════════════════════════════════════

function AccommodationForm(props: {
  readonly draft: Extract<OwnerClaimDraft, { kind: "accommodation" }>;
  readonly setDraft: React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>;
  readonly errIdx: Record<string, string>;
}): React.ReactElement {
  const { draft, setDraft, errIdx } = props;

  const addRoomType = () => {
    setDraft({ ...draft, roomTypes: [...draft.roomTypes, emptyRoomType()] });
  };
  const updateRoomType = (idx: number, patch: Partial<RoomTypeInput>) => {
    const next = draft.roomTypes.slice();
    next[idx] = { ...(next[idx] ?? emptyRoomType()), ...patch };
    setDraft({ ...draft, roomTypes: next });
  };
  const removeRoomType = (idx: number) => {
    setDraft({ ...draft, roomTypes: draft.roomTypes.filter((_, i) => i !== idx) });
  };

  const toggleFacility = (f: AccommodationFacility) => {
    const has = draft.facilities.includes(f);
    const next = has ? draft.facilities.filter((x) => x !== f) : [...draft.facilities, f];
    setDraft({ ...draft, facilities: next });
  };

  return (
    <div>
      <Field label="Room types" error={errIdx["roomTypes"]}>
        <div>
          {draft.roomTypes.map((r, idx) => (
            <div
              key={idx}
              style={{
                padding: 10,
                background: PALETTE.surface,
                borderRadius: 8,
                marginBottom: 8,
                display: "grid",
                gap: 6,
              }}
            >
              <input
                type="text"
                placeholder="e.g. Deluxe Twin"
                value={r.label ?? ""}
                onChange={(e) => updateRoomType(idx, { label: e.target.value })}
                style={inputStyle()}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number"
                  placeholder="Count"
                  value={r.count ?? ""}
                  onChange={(e) =>
                    updateRoomType(idx, { count: Number(e.target.value) || 0 })
                  }
                  style={inputStyle()}
                />
                <input
                  type="number"
                  placeholder="Nightly rate (IDR)"
                  value={r.nightlyRate ?? ""}
                  onChange={(e) =>
                    updateRoomType(idx, {
                      nightlyRate: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  style={inputStyle()}
                />
                <input
                  type="number"
                  placeholder="Max guests"
                  value={r.maxOccupancy ?? ""}
                  onChange={(e) =>
                    updateRoomType(idx, {
                      maxOccupancy: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  style={inputStyle()}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRoomType(idx)}
                style={ghostButtonStyle()}
              >
                Remove room type
              </button>
              {errIdx[`roomTypes[${idx}].label`] ? (
                <div style={{ color: PALETTE.errorRed, fontSize: 12 }}>
                  {errIdx[`roomTypes[${idx}].label`]}
                </div>
              ) : null}
              {errIdx[`roomTypes[${idx}].nightlyRate`] ? (
                <div style={{ color: PALETTE.errorRed, fontSize: 12 }}>
                  {errIdx[`roomTypes[${idx}].nightlyRate`]}
                </div>
              ) : null}
            </div>
          ))}
          <button type="button" onClick={addRoomType} style={ghostButtonStyle()}>
            + Add room type
          </button>
        </div>
      </Field>

      <Field label="Facilities" hint="Tick everything your guests can use.">
        <div>
          {ACCOMMODATION_FACILITIES.map((f) => (
            <span
              key={f}
              onClick={() => toggleFacility(f)}
              role="checkbox"
              aria-checked={draft.facilities.includes(f)}
              tabIndex={0}
              style={chipStyle(draft.facilities.includes(f))}
            >
              {f.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </Field>

      <Field label="Short description (optional)" error={errIdx["description"]}>
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>

      <Field label="Distance from nearest airport (optional)">
        <input
          type="text"
          value={draft.airportDistance ?? ""}
          onChange={(e) => setDraft({ ...draft, airportDistance: e.target.value })}
          placeholder="e.g. 25 km"
          style={inputStyle()}
        />
      </Field>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §9 · Food form
// ═════════════════════════════════════════════════════════════════════

function FoodForm(props: {
  readonly draft: Extract<OwnerClaimDraft, { kind: "food" }>;
  readonly setDraft: React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>;
  readonly errIdx: Record<string, string>;
}): React.ReactElement {
  const { draft, setDraft, errIdx } = props;

  const toggleCuisine = (c: string) => {
    const has = draft.cuisines.includes(c);
    const next = has ? draft.cuisines.filter((x) => x !== c) : [...draft.cuisines, c];
    setDraft({ ...draft, cuisines: next });
  };
  const toggleDietary = (d: DietaryFlag) => {
    const has = draft.dietary.includes(d);
    const next = has ? draft.dietary.filter((x) => x !== d) : [...draft.dietary, d];
    setDraft({ ...draft, dietary: next });
  };
  const updateHoursRow = (idx: number, patch: Partial<OpeningHoursInput>) => {
    const next = draft.openingHours.slice();
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, openingHours: next });
  };
  const addMenuSection = () => {
    setDraft({ ...draft, menuSections: [...draft.menuSections, emptyMenuSection()] });
  };
  const updateMenuSection = (idx: number, patch: Partial<MenuSectionInput>) => {
    const next = draft.menuSections.slice();
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, menuSections: next });
  };
  const removeMenuSection = (idx: number) => {
    setDraft({ ...draft, menuSections: draft.menuSections.filter((_, i) => i !== idx) });
  };

  return (
    <div>
      {errIdx["food"] ? (
        <div style={{ color: PALETTE.errorRed, fontSize: 13, marginBottom: 8 }}>
          {errIdx["food"]}
        </div>
      ) : null}
      <Field label="Cuisines" hint="Pick everything that applies.">
        <div>
          {CUISINE_PRESETS.map((c) => (
            <span
              key={c}
              onClick={() => toggleCuisine(c)}
              role="checkbox"
              aria-checked={draft.cuisines.includes(c)}
              tabIndex={0}
              style={chipStyle(draft.cuisines.includes(c))}
            >
              {c}
            </span>
          ))}
        </div>
      </Field>

      <Field label="Dietary options">
        <div>
          {DIETARY_FLAGS.map((d) => (
            <span
              key={d}
              onClick={() => toggleDietary(d)}
              role="checkbox"
              aria-checked={draft.dietary.includes(d)}
              tabIndex={0}
              style={chipStyle(draft.dietary.includes(d))}
            >
              {d.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </Field>

      <Field label="Menu sections (optional but helpful)">
        <div>
          {draft.menuSections.map((section, sIdx) => (
            <div
              key={sIdx}
              style={{
                padding: 10,
                background: PALETTE.surface,
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <input
                type="text"
                placeholder="Section (e.g. Mains)"
                value={section.label}
                onChange={(e) => updateMenuSection(sIdx, { label: e.target.value })}
                style={inputStyle()}
              />
              {errIdx[`menuSections[${sIdx}].label`] ? (
                <div style={{ color: PALETTE.errorRed, fontSize: 12, marginTop: 4 }}>
                  {errIdx[`menuSections[${sIdx}].label`]}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => removeMenuSection(sIdx)}
                style={{ ...ghostButtonStyle(), marginTop: 8 }}
              >
                Remove section
              </button>
            </div>
          ))}
          <button type="button" onClick={addMenuSection} style={ghostButtonStyle()}>
            + Add menu section
          </button>
        </div>
      </Field>

      <Field label="Opening hours">
        <div style={{ display: "grid", gap: 6 }}>
          {draft.openingHours.map((hr, idx) => (
            <div
              key={hr.day}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 90px 1fr 1fr",
                gap: 6,
                alignItems: "center",
              }}
            >
              <span style={{ color: PALETTE.textMuted, fontSize: 13 }}>
                {dayName(hr.day)}
              </span>
              <label style={{ color: PALETTE.textSoft, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={hr.closed}
                  onChange={(e) =>
                    updateHoursRow(idx, {
                      closed: e.target.checked,
                      open: e.target.checked ? "" : hr.open,
                      close: e.target.checked ? "" : hr.close,
                    })
                  }
                />{" "}
                Closed
              </label>
              <input
                type="time"
                value={hr.open}
                disabled={hr.closed}
                onChange={(e) => updateHoursRow(idx, { open: e.target.value })}
                style={inputStyle()}
              />
              <input
                type="time"
                value={hr.close}
                disabled={hr.closed}
                onChange={(e) => updateHoursRow(idx, { close: e.target.value })}
                style={inputStyle()}
              />
            </div>
          ))}
        </div>
      </Field>

      <Field label="Short description (optional)" error={errIdx["description"]}>
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>
    </div>
  );
}

function dayName(d: 1 | 2 | 3 | 4 | 5 | 6 | 7): string {
  return ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d];
}

// ═════════════════════════════════════════════════════════════════════
// §10 · Vehicle rental form
// ═════════════════════════════════════════════════════════════════════

function VehicleRentalForm(props: {
  readonly draft: Extract<OwnerClaimDraft, { kind: "vehicle_rental" }>;
  readonly setDraft: React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>;
  readonly errIdx: Record<string, string>;
}): React.ReactElement {
  const { draft, setDraft, errIdx } = props;

  const addVehicle = () => {
    setDraft({ ...draft, vehicles: [...draft.vehicles, emptyVehicle()] });
  };
  const updateVehicle = (idx: number, patch: Partial<VehicleInput>) => {
    const next = draft.vehicles.slice();
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, vehicles: next });
  };
  const removeVehicle = (idx: number) => {
    setDraft({ ...draft, vehicles: draft.vehicles.filter((_, i) => i !== idx) });
  };

  const terms = draft.terms ?? emptyRentalTerms();

  return (
    <div>
      <Field label="Vehicles you rent" error={errIdx["vehicles"]}>
        <div>
          {draft.vehicles.map((v, idx) => (
            <div
              key={idx}
              style={{
                padding: 10,
                background: PALETTE.surface,
                borderRadius: 8,
                marginBottom: 8,
                display: "grid",
                gap: 6,
              }}
            >
              <select
                value={v.vehicleType}
                onChange={(e) =>
                  updateVehicle(idx, {
                    vehicleType: (e.target.value || "") as VehicleType | "",
                  })
                }
                style={inputStyle()}
              >
                <option value="">— Choose vehicle type —</option>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Model (e.g. Honda Scoopy 110)"
                value={v.model}
                onChange={(e) => updateVehicle(idx, { model: e.target.value })}
                style={inputStyle()}
              />
              <input
                type="number"
                placeholder="Daily rate (IDR)"
                value={v.dailyRate ?? ""}
                onChange={(e) =>
                  updateVehicle(idx, {
                    dailyRate: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                style={inputStyle()}
              />
              <input
                type="number"
                placeholder="Deposit (optional)"
                value={v.depositRequired ?? ""}
                onChange={(e) =>
                  updateVehicle(idx, {
                    depositRequired: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                style={inputStyle()}
              />
              <button
                type="button"
                onClick={() => removeVehicle(idx)}
                style={ghostButtonStyle()}
              >
                Remove vehicle
              </button>
              {errIdx[`vehicles[${idx}].vehicleType`] ? (
                <div style={{ color: PALETTE.errorRed, fontSize: 12 }}>
                  {errIdx[`vehicles[${idx}].vehicleType`]}
                </div>
              ) : null}
              {errIdx[`vehicles[${idx}].dailyRate`] ? (
                <div style={{ color: PALETTE.errorRed, fontSize: 12 }}>
                  {errIdx[`vehicles[${idx}].dailyRate`]}
                </div>
              ) : null}
            </div>
          ))}
          <button type="button" onClick={addVehicle} style={ghostButtonStyle()}>
            + Add vehicle
          </button>
        </div>
      </Field>

      <Field label="Rental terms (optional)">
        <div style={{ display: "grid", gap: 6 }}>
          <input
            type="number"
            placeholder="Minimum rental days"
            value={terms.minRentalDays ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                terms: {
                  ...terms,
                  minRentalDays: e.target.value === "" ? null : Number(e.target.value),
                },
              })
            }
            style={inputStyle()}
          />
          <input
            type="number"
            placeholder="Maximum rental days"
            value={terms.maxRentalDays ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                terms: {
                  ...terms,
                  maxRentalDays: e.target.value === "" ? null : Number(e.target.value),
                },
              })
            }
            style={inputStyle()}
          />
          <label style={{ color: PALETTE.textDim, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={terms.licenseRequired}
              onChange={(e) =>
                setDraft({ ...draft, terms: { ...terms, licenseRequired: e.target.checked } })
              }
            />{" "}
            Driving licence required
          </label>
          <label style={{ color: PALETTE.textDim, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={terms.deliveryAvailable}
              onChange={(e) =>
                setDraft({ ...draft, terms: { ...terms, deliveryAvailable: e.target.checked } })
              }
            />{" "}
            Delivery available
          </label>
          {errIdx["terms.maxRentalDays"] ? (
            <div style={{ color: PALETTE.errorRed, fontSize: 12 }}>
              {errIdx["terms.maxRentalDays"]}
            </div>
          ) : null}
        </div>
      </Field>

      <Field label="Short description (optional)">
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §11 · Service form
// ═════════════════════════════════════════════════════════════════════

function ServiceForm(props: {
  readonly draft: Extract<OwnerClaimDraft, { kind: "service" }>;
  readonly setDraft: React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>;
  readonly errIdx: Record<string, string>;
}): React.ReactElement {
  const { draft, setDraft, errIdx } = props;
  return (
    <div>
      <Field
        label="What do you offer? (10-2000 chars)"
        error={errIdx["description"]}
      >
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={4}
          placeholder="Describe your service, what you specialise in, how customers typically engage you."
          style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>
      <Field label="Service area (optional)">
        <input
          type="text"
          value={draft.serviceArea ?? ""}
          onChange={(e) => setDraft({ ...draft, serviceArea: e.target.value })}
          placeholder="e.g. Yogyakarta city"
          style={inputStyle()}
        />
      </Field>
      <Field label="Price method (optional)" error={errIdx["priceMethod"]}>
        <select
          value={draft.priceMethod ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              priceMethod:
                e.target.value === ""
                  ? undefined
                  : (e.target.value as ServicePriceMethod),
            })
          }
          style={inputStyle()}
        >
          <option value="">— Not sure yet —</option>
          {SERVICE_PRICE_METHODS.map((pm) => (
            <option key={pm} value={pm}>{pm.replace("_", " ")}</option>
          ))}
        </select>
      </Field>
      {/* Operating hours intentionally re-use the same shape as food.
          A trimmed renderer is sufficient here. */}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §12 · Transport form
// ═════════════════════════════════════════════════════════════════════

function TransportForm(props: {
  readonly draft: Extract<OwnerClaimDraft, { kind: "transport" }>;
  readonly setDraft: React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>;
  readonly errIdx: Record<string, string>;
}): React.ReactElement {
  const { draft, setDraft, errIdx } = props;
  const toggle = (s: string) => {
    const has = draft.serviceTypes.includes(s);
    const next = has ? draft.serviceTypes.filter((x) => x !== s) : [...draft.serviceTypes, s];
    setDraft({ ...draft, serviceTypes: next });
  };
  return (
    <div>
      <Field label="Services you offer" error={errIdx["serviceTypes"]}>
        <div>
          {TRANSPORT_SERVICE_PRESETS.map((s) => (
            <span
              key={s}
              onClick={() => toggle(s)}
              role="checkbox"
              aria-checked={draft.serviceTypes.includes(s)}
              tabIndex={0}
              style={chipStyle(draft.serviceTypes.includes(s))}
            >
              {s}
            </span>
          ))}
        </div>
      </Field>
      <Field label="Coverage area (optional)">
        <input
          type="text"
          value={draft.coverage ?? ""}
          onChange={(e) => setDraft({ ...draft, coverage: e.target.value })}
          placeholder="e.g. Yogyakarta + Kulon Progo"
          style={inputStyle()}
        />
      </Field>
      <Field label="Price method (optional)">
        <select
          value={draft.priceMethod ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              priceMethod:
                e.target.value === ""
                  ? undefined
                  : (e.target.value as TransportPriceMethod),
            })
          }
          style={inputStyle()}
        >
          <option value="">— Not sure yet —</option>
          {TRANSPORT_PRICE_METHODS.map((pm) => (
            <option key={pm} value={pm}>{pm}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §13 · Marketplace-seller form
// ═════════════════════════════════════════════════════════════════════

function MarketplaceSellerForm(props: {
  readonly draft: Extract<OwnerClaimDraft, { kind: "marketplace_seller" }>;
  readonly setDraft: React.Dispatch<React.SetStateAction<OwnerClaimDraft | null>>;
  readonly errIdx: Record<string, string>;
}): React.ReactElement {
  const { draft, setDraft, errIdx } = props;
  const [newCategory, setNewCategory] = useState<string>("");
  const addCategory = () => {
    if (!newCategory.trim()) return;
    setDraft({
      ...draft,
      productCategories: [...draft.productCategories, newCategory.trim()],
    });
    setNewCategory("");
  };
  const removeCategory = (idx: number) => {
    setDraft({
      ...draft,
      productCategories: draft.productCategories.filter((_, i) => i !== idx),
    });
  };
  return (
    <div>
      <Field label="Product categories" error={errIdx["productCategories"]}>
        <div>
          {draft.productCategories.map((c, idx) => (
            <span
              key={idx}
              onClick={() => removeCategory(idx)}
              style={chipStyle(true)}
            >
              {c} ×
            </span>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Batik"
              style={inputStyle()}
            />
            <button type="button" onClick={addCategory} style={ghostButtonStyle()}>
              Add
            </button>
          </div>
        </div>
      </Field>
      <Field label="Shipping scope (optional)">
        <input
          type="text"
          value={draft.shippingScope ?? ""}
          onChange={(e) => setDraft({ ...draft, shippingScope: e.target.value })}
          placeholder="e.g. Indonesia-wide"
          style={inputStyle()}
        />
      </Field>
      <Field label="Short description (optional)">
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §14 · ContactView
// ═════════════════════════════════════════════════════════════════════

function ContactView(props: {
  readonly channel: ClaimContactChannel;
  readonly setChannel: (c: ClaimContactChannel) => void;
  readonly destination: string;
  readonly setDestination: (d: string) => void;
  readonly errIdx: Record<string, string>;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}): React.ReactElement {
  return (
    <div>
      <h2 style={{ fontSize: 18, margin: 0, marginBottom: 10 }}>
        How should we send your verification code?
      </h2>
      <Field label="Channel">
        <div>
          {CLAIM_CONTACT_CHANNELS.map((c) => (
            <span
              key={c}
              onClick={() => props.setChannel(c)}
              role="radio"
              aria-checked={props.channel === c}
              tabIndex={0}
              style={chipStyle(props.channel === c)}
            >
              {c}
            </span>
          ))}
        </div>
      </Field>
      <Field
        label={
          props.channel === "email"
            ? "Email address"
            : "Phone number (international format)"
        }
        error={props.errIdx["destination"]}
      >
        <input
          type="text"
          value={props.destination}
          onChange={(e) => props.setDestination(e.target.value)}
          placeholder={
            props.channel === "email"
              ? "owner@example.com"
              : "+62 812 3456 7890"
          }
          style={inputStyle()}
        />
      </Field>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button type="button" onClick={props.onContinue} style={primaryButtonStyle(false)}>
          Send code
        </button>
        <button type="button" onClick={props.onBack} style={ghostButtonStyle()}>
          Back
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §15 · CodeView · brief waiting / in-flight state
// ═════════════════════════════════════════════════════════════════════

function CodeView(props: { readonly submitting: boolean }): React.ReactElement {
  return (
    <div>
      <h2 style={{ fontSize: 18, margin: 0, marginBottom: 10 }}>
        Preparing your verification code…
      </h2>
      <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
        {props.submitting
          ? "Checking the directory and your draft."
          : "Awaiting server response."}
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §16 · DoneView · reserved for the post-ADR success branch
// ═════════════════════════════════════════════════════════════════════

function DoneView(props: {
  readonly onClose?: () => void;
}): React.ReactElement {
  return (
    <div>
      <h2 style={{ fontSize: 18, margin: 0, marginBottom: 10, color: PALETTE.successGreen }}>
        Your draft is saved and your code is on its way.
      </h2>
      <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
        Open your chosen channel and enter the 6-digit code to finish claiming
        your listing.
      </p>
      {props.onClose ? (
        <button type="button" onClick={props.onClose} style={primaryButtonStyle(false)}>
          Close
        </button>
      ) : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §17 · BlockedView · HONEST architectural message
// ═════════════════════════════════════════════════════════════════════

function BlockedView(props: {
  readonly reason: string | null;
  readonly savedAt: string | null;
  readonly destination: string;
  readonly channel: ClaimContactChannel;
  readonly onClose?: () => void;
}): React.ReactElement {
  const isChannelAdapterMissing =
    props.reason === "channel_adapter_not_implemented";
  const isCrossDbBlocker =
    props.reason === "cross_db_write_path_not_implemented";
  const isCanonicalClaimed =
    props.reason === "canonical_already_claimed";
  const isOwnerEmailUnresolved =
    props.reason === "owner_email_unresolved";
  const isAttemptsExhausted =
    props.reason === "attempts_exhausted";
  return (
    <div>
      <h2
        style={{
          fontSize: 18,
          margin: 0,
          marginBottom: 10,
          color: PALETTE.warnOrange,
        }}
      >
        {isAttemptsExhausted
          ? "Too many attempts."
          : "Your draft is saved."}
      </h2>
      {isChannelAdapterMissing ? (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          We can only send verification codes by email right now.
          Please come back and pick the email option, or ask us to
          notify you when {props.channel} delivery is live.
        </p>
      ) : isCrossDbBlocker ? (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          We&apos;re not yet able to issue a verification code — our owner-identity
          link is in final review. We&apos;ll notify you ({props.destination || "your chosen channel"} via {props.channel}) when it&apos;s ready.
        </p>
      ) : isCanonicalClaimed ? (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          This listing is already owner-claimed. If you believe this is
          a mistake, email support and we&apos;ll review the existing claim.
        </p>
      ) : isOwnerEmailUnresolved ? (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          We couldn&apos;t confirm an email address for this listing yet.
          Go back and enter the business owner email you want the code
          sent to.
        </p>
      ) : isAttemptsExhausted ? (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          You&apos;ve used all five verification attempts for this code.
          For your safety, this code is now expired. Return to the
          previous step to request a new one.
        </p>
      ) : (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          We couldn&apos;t complete your claim right now (reason:{" "}
          <code style={{ color: PALETTE.textMuted }}>{props.reason ?? "unknown"}</code>).
          Your draft is still safe.
        </p>
      )}
      {props.savedAt ? (
        <p style={{ color: PALETTE.textSoft, fontSize: 12 }}>
          Saved at {new Date(props.savedAt).toLocaleString()}.
        </p>
      ) : null}
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        {props.onClose ? (
          <button type="button" onClick={props.onClose} style={primaryButtonStyle(false)}>
            Save my contact details
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §18 · VerifyView · owner types the 6-digit code they received
// ═════════════════════════════════════════════════════════════════════

function VerifyView(props: {
  readonly deliveryHint: string | null;
  readonly codeInput: string;
  readonly setCodeInput: (s: string) => void;
  readonly error: string | null;
  readonly submitting: boolean;
  readonly onBack: () => void;
  readonly onSubmit: () => void;
}): React.ReactElement {
  return (
    <div>
      <h2 style={{ fontSize: 18, margin: 0, marginBottom: 10 }}>
        Enter your 6-digit code
      </h2>
      {props.deliveryHint ? (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          {props.deliveryHint}
        </p>
      ) : (
        <p style={{ color: PALETTE.textDim, fontSize: 13 }}>
          Check the inbox you provided. The code expires in 10 minutes.
        </p>
      )}
      <Field label="Verification code" error={props.error ?? undefined}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={props.codeInput}
          onChange={(e) =>
            props.setCodeInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
          }
          placeholder="123456"
          style={{
            ...inputStyle(),
            fontSize: 22,
            letterSpacing: "0.3em",
            textAlign: "center",
          }}
        />
      </Field>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={props.onSubmit}
          style={primaryButtonStyle(props.submitting || props.codeInput.length !== 6)}
          disabled={props.submitting || props.codeInput.length !== 6}
        >
          {props.submitting ? "Verifying…" : "Verify and claim"}
        </button>
        <button type="button" onClick={props.onBack} style={ghostButtonStyle()}>
          Back
        </button>
      </div>
    </div>
  );
}

export default OwnerClaimForm;
