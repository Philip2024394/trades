"use client";

// src/app/nex-native/settings/profile/_daily-activity-section.tsx
//
// Bridge 39 · client component that renders the "What's your day-to-day?"
// radio group + cascading follow-up fields. Client-only because the
// follow-up block needs to react to the selected radio.
//
// Every follow-up field name is prefixed with `da_` so
// updateProfileAction can map them to daily_activity_detail without
// colliding with the top-level personal profile fields.
//
// Non-selected activities' fields still exist in the DOM at all times
// so the form submits a stable set of names · the server layer drops
// empty values through sanitiseDailyActivityDetail.

import { useState } from "react";
import type { NexDailyActivity, NexDailyActivityDetail } from "@/lib/nex-native/types";
import { NEX_DAILY_ACTIVITIES, NEX_DAILY_ACTIVITY_LABEL } from "@/lib/nex-native/types";

const NEX = {
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
};

interface Props {
  initial: NexDailyActivity | null;
  detail: NexDailyActivityDetail;
}

export function DailyActivitySection({ initial, detail }: Props) {
  const [selected, setSelected] = useState<NexDailyActivity | "unset">(
    initial ?? "unset",
  );

  return (
    <fieldset
      style={{
        marginBottom: 16,
        padding: 14,
        border: `1px solid ${NEX.cyanFaint}`,
        borderRadius: 12,
        background: "rgba(0,175,255,0.04)",
      }}
      data-nex-profile-daily-activity
    >
      <legend
        style={{
          padding: "0 6px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: NEX.cyan,
        }}
      >
        What's your day-to-day?
      </legend>

      <p
        style={{
          margin: "4px 0 12px",
          fontSize: 11,
          color: NEX.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Friends see this so they know what you're up to. Required for
        the Verified Personal ✓ tick.
      </p>

      <div style={{ display: "grid", gap: 6 }}>
        <ActivityRadio
          value="unset"
          label="Not yet set"
          muted
          checked={selected === "unset"}
          onChange={setSelected}
        />
        {NEX_DAILY_ACTIVITIES.map((a) => (
          <ActivityRadio
            key={a}
            value={a}
            label={NEX_DAILY_ACTIVITY_LABEL[a]}
            checked={selected === a}
            onChange={setSelected}
          />
        ))}
      </div>

      {/* Follow-up block · one per activity · shown only when the
          matching radio is selected. Fields still submit empty
          strings when hidden (server drops those). */}
      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {selected === "student" && (
          <>
            <MiniField
              name="da_field_of_study"
              label="What are you studying?"
              defaultValue={detail.field_of_study ?? ""}
              placeholder="e.g. Industrial design"
            />
            <MiniField
              name="da_institution"
              label="Institution"
              defaultValue={detail.institution ?? ""}
              placeholder="e.g. ITB Bandung"
            />
            <MiniField
              name="da_year"
              label="Year"
              defaultValue={detail.year ?? ""}
              placeholder="e.g. 3rd year · 2027 grad"
            />
          </>
        )}
        {selected === "self_employed" && (
          <>
            <MiniField
              name="da_business"
              label="What's your business?"
              defaultValue={detail.business ?? ""}
              placeholder="e.g. My footwear label"
            />
            <MiniField
              name="da_industry"
              label="Industry"
              defaultValue={detail.industry ?? ""}
              placeholder="e.g. footwear · cafe · design agency"
            />
          </>
        )}
        {selected === "company_employee" && (
          <>
            <MiniField
              name="da_company"
              label="Company"
              defaultValue={detail.company ?? ""}
              placeholder="e.g. Gojek"
            />
            <MiniField
              name="da_role"
              label="Role"
              defaultValue={detail.role ?? ""}
              placeholder="e.g. Product designer"
            />
          </>
        )}
        {selected === "unemployed" && (
          <>
            <MiniField
              name="da_seeking"
              label="What kind of work are you looking for?"
              defaultValue={detail.seeking ?? ""}
              placeholder="e.g. Junior frontend · remote OK"
            />
            <MiniField
              name="da_since_month"
              label="Looking since (optional)"
              defaultValue={detail.since_month ?? ""}
              placeholder="e.g. September 2026"
            />
          </>
        )}
        {selected === "other" && (
          <MiniField
            name="da_note"
            label="Tell friends what you do"
            defaultValue={detail.note ?? ""}
            placeholder="e.g. Caring for family · travelling · sabbatical"
          />
        )}
      </div>

      {/* Keep the raw form fields for hidden activities so
          updateProfileAction always sees the same set. Empty strings
          are dropped by sanitiseDailyActivityDetail on the server. */}
      <HiddenIfNotSelected
        active={selected}
        keys={[
          ["student", "da_field_of_study", detail.field_of_study],
          ["student", "da_institution", detail.institution],
          ["student", "da_year", detail.year],
          ["self_employed", "da_business", detail.business],
          ["self_employed", "da_industry", detail.industry],
          ["company_employee", "da_company", detail.company],
          ["company_employee", "da_role", detail.role],
          ["unemployed", "da_seeking", detail.seeking],
          ["unemployed", "da_since_month", detail.since_month],
          ["other", "da_note", detail.note],
        ]}
      />

      {/* Bridge 39 · hidden radio value the form actually submits.
          Uses the same "daily_activity" name as the visible radios ·
          the visible group is what drives selection · this hidden
          echo just makes React's controlled radios play nicely
          when everything else uses defaultChecked. Actually React
          already submits the checked radio · we don't need a shadow. */}
    </fieldset>
  );
}

function ActivityRadio(props: {
  value: NexDailyActivity | "unset";
  label: string;
  checked: boolean;
  muted?: boolean;
  onChange: (v: NexDailyActivity | "unset") => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: NEX.fieldBg,
        border: `1px solid ${
          props.checked ? NEX.cyan : NEX.cyanFaint
        }`,
        fontSize: 13,
        color: props.muted ? NEX.textSecondary : NEX.textPrimary,
        cursor: "pointer",
        transition: "border-color 160ms ease",
      }}
      data-nex-daily-activity-option={props.value}
    >
      <input
        type="radio"
        name="daily_activity"
        value={props.value}
        checked={props.checked}
        onChange={() => props.onChange(props.value)}
        style={{ accentColor: NEX.cyan }}
      />
      <span>{props.label}</span>
    </label>
  );
}

function MiniField(props: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: NEX.textSecondary,
      }}
    >
      {props.label}
      <input
        type="text"
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        maxLength={200}
        data-nex-profile-input={props.name}
        style={{
          display: "block",
          marginTop: 4,
          width: "100%",
          minHeight: 40,
          padding: "8px 12px",
          background: NEX.panel,
          color: NEX.textPrimary,
          border: `1px solid ${NEX.cyanFaint}`,
          borderRadius: 8,
          fontSize: 13,
          fontFamily: "inherit",
          letterSpacing: 0,
          textTransform: "none",
          fontWeight: 400,
        }}
      />
    </label>
  );
}

/** Emit hidden inputs for every field that belongs to a NON-selected
 *  activity, so the form still submits the previously-saved value ·
 *  keeps the round-trip lossless when the user switches activities and
 *  saves. Server sanitisation still filters against the current
 *  selection where relevant. */
function HiddenIfNotSelected(props: {
  active: NexDailyActivity | "unset";
  keys: ReadonlyArray<[NexDailyActivity, string, string | undefined]>;
}) {
  return (
    <>
      {props.keys
        .filter(([activity]) => activity !== props.active)
        .map(([, name, value]) =>
          value ? (
            <input key={name} type="hidden" name={name} value={value} />
          ) : null,
        )}
    </>
  );
}
