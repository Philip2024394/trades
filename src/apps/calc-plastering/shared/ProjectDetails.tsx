// ProjectDetails — required inputs before sending a quote.
//
// - Project type (new build / existing / renovation)
// - Readiness (ready now / under construction / open for quotation
//   / ready in N weeks)
// - Attachments (drawings / photos)
// - Optional site address + access notes.

"use client";

import type { ChangeEvent } from "react";
import {
  FileUpload,
  RadioGroup,
  TextArea,
  TextInput
} from "@/platform/ui";
import type { ProjectDetails, ProjectType, ReadinessType } from "../logic";

const PROJECT_TYPE_OPTIONS: {
  value: ProjectType;
  label: string;
  description: string;
}[] = [
  {
    value: "new_build",
    label: "New build",
    description: "Brand-new construction — fresh substrate"
  },
  {
    value: "existing_build",
    label: "Existing build",
    description: "Existing property — over sound existing surfaces"
  },
  {
    value: "renovation",
    label: "Renovation",
    description: "Stripping back / refurb — may need prep or repair"
  }
];

const READINESS_OPTIONS: {
  value: ReadinessType;
  label: string;
  description: string;
}[] = [
  {
    value: "ready_now",
    label: "Ready now",
    description: "Substrate is prepared, waiting for the plasterer"
  },
  {
    value: "under_construction",
    label: "Under construction",
    description: "Other trades still on site — timing to be confirmed"
  },
  {
    value: "open_for_quotation",
    label: "Open for quotation",
    description: "No date yet — collecting quotes"
  },
  {
    value: "ready_in_weeks",
    label: "Ready in N weeks",
    description: "Set an expected start window"
  }
];

export type ProjectDetailsProps = {
  project: ProjectDetails;
  onPatch: (patch: Partial<ProjectDetails>) => void;
};

export function ProjectDetailsForm({ project, onPatch }: ProjectDetailsProps) {
  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        id="proj-type"
        name="proj-type"
        label="Project type"
        variant="cards"
        value={project.project_type ?? ""}
        onChange={(v) => onPatch({ project_type: v as ProjectType })}
        options={PROJECT_TYPE_OPTIONS}
      />
      <RadioGroup
        id="proj-ready"
        name="proj-ready"
        label="Project readiness"
        variant="cards"
        value={project.readiness ?? ""}
        onChange={(v) => onPatch({ readiness: v as ReadinessType })}
        options={READINESS_OPTIONS}
      />
      {project.readiness === "ready_in_weeks" ? (
        <TextInput
          id="proj-weeks"
          label="Ready in weeks"
          type="number"
          value={String(project.ready_in_weeks)}
          onChange={(ev: ChangeEvent<HTMLInputElement>) =>
            onPatch({
              ready_in_weeks: Math.max(
                1,
                parseInt(ev.currentTarget.value) || 1
              )
            })
          }
          min={1}
          step={1}
          suffix={
            <span className="text-[11px] font-medium text-neutral-500">
              weeks
            </span>
          }
        />
      ) : null}
      <TextInput
        id="proj-address"
        label="Site address"
        labelBadge="Optional"
        value={project.site_address}
        onChange={(ev: ChangeEvent<HTMLInputElement>) =>
          onPatch({ site_address: ev.currentTarget.value })
        }
      />
      <TextArea
        id="proj-access"
        label="Access notes"
        labelBadge="Optional"
        placeholder="e.g. scaffold needed for gables, tight parking"
        value={project.access_notes}
        onChange={(ev: ChangeEvent<HTMLTextAreaElement>) =>
          onPatch({ access_notes: ev.currentTarget.value })
        }
        rows={2}
      />
      <FileUpload
        id="proj-drawing"
        label="Attach drawing / plans (optional)"
        hint="Any project drawing, elevation photo, or site plan. PDF / JPG / PNG."
        multiple
      />
    </div>
  );
}
