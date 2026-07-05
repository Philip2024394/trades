// PlasteringCalcPortrait — 3:4 tall. Vertical stack with full result +
// project details + handoff at the bottom.

"use client";

import { PaintBucket } from "lucide-react";
import { useState } from "react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { ElevationEditor } from "./shared/ElevationEditor";
import { Handoff } from "./shared/Handoff";
import { ProjectDetailsForm } from "./shared/ProjectDetails";
import { RatesForm } from "./shared/RatesForm";
import { ResultPanel } from "./shared/ResultPanel";
import { RoomEditor } from "./shared/RoomEditor";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { ElevationList, RoomList } from "./shared/SurfaceLists";
import { usePlasteringCalc } from "./usePlasteringCalc";

type Tab = "surface" | "rates" | "project";

export type PlasteringCalcPortraitProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onShare?: () => void;
};

export function PlasteringCalcPortrait({
  product,
  whatsappNumber,
  onShare
}: PlasteringCalcPortraitProps) {
  const calc = usePlasteringCalc({ product });
  const [tab, setTab] = useState<Tab>("surface");
  const activeElevation = calc.elevations.find(
    (e) => e.id === calc.activeElevationId
  );
  const activeRoom = calc.rooms.find((r) => r.id === calc.activeRoomId);

  const showExternal =
    calc.scenario === "full_house" ||
    calc.scenario === "external_only" ||
    calc.scenario === "single_elevation";
  const showInternal =
    calc.scenario === "full_house" ||
    calc.scenario === "internal_only" ||
    calc.scenario === "single_room";

  return (
    <SurfaceCard variant="primary" padding="md" className="w-full">
      <div className="mb-3">
        <Overline icon={PaintBucket}>Plastering calc</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          Full quote — external + internal
        </h3>
        <p className="text-[12px] text-neutral-600">
          10 finishes · gables · quoins · features · 4-bead pricing
        </p>
      </div>

      <ScenarioPicker
        scenario={calc.scenario}
        labels={calc.scenarioLabels}
        onChange={calc.changeScenario}
        mode="scroll"
      />

      <div className="mt-3 mb-2 flex gap-1 rounded-lg bg-neutral-100 p-1">
        <TabButton
          active={tab === "surface"}
          onClick={() => setTab("surface")}
          label="Surface"
        />
        <TabButton
          active={tab === "rates"}
          onClick={() => setTab("rates")}
          label="Rates"
        />
        <TabButton
          active={tab === "project"}
          onClick={() => setTab("project")}
          label="Project"
        />
      </div>

      {tab === "surface" ? (
        <div className="flex flex-col gap-3">
          {showExternal ? (
            <ElevationList
              elevations={calc.elevations}
              activeId={calc.activeElevationId}
              onSelect={calc.setActiveElevationId}
              onAdd={() =>
                calc.addElevation(`Elevation ${calc.elevations.length + 1}`)
              }
              onRemove={calc.removeElevation}
            />
          ) : null}
          {showExternal && activeElevation ? (
            <ElevationEditor
              elevation={activeElevation}
              onPatch={(patch) =>
                calc.patchElevation(activeElevation.id, patch)
              }
              onAddOpening={(type) =>
                calc.addElevationOpening(activeElevation.id, type)
              }
              onPatchOpening={(oid, patch) =>
                calc.patchElevationOpening(activeElevation.id, oid, patch)
              }
              onRemoveOpening={(oid) =>
                calc.removeElevationOpening(activeElevation.id, oid)
              }
              density="compact"
            />
          ) : null}
          {showInternal ? (
            <RoomList
              rooms={calc.rooms}
              activeId={calc.activeRoomId}
              onSelect={calc.setActiveRoomId}
              onAdd={() => calc.addRoom(`Room ${calc.rooms.length + 1}`)}
              onRemove={calc.removeRoom}
            />
          ) : null}
          {showInternal && activeRoom ? (
            <RoomEditor
              room={activeRoom}
              onPatch={(patch) => calc.patchRoom(activeRoom.id, patch)}
              onAddOpening={(type) => calc.addRoomOpening(activeRoom.id, type)}
              onPatchOpening={(oid, patch) =>
                calc.patchRoomOpening(activeRoom.id, oid, patch)
              }
              onRemoveOpening={(oid) =>
                calc.removeRoomOpening(activeRoom.id, oid)
              }
              density="compact"
            />
          ) : null}
        </div>
      ) : null}

      {tab === "rates" ? (
        <RatesForm
          rates={calc.rates}
          onPatchRates={calc.patchRates}
          onPatchBeading={calc.patchBeading}
        />
      ) : null}

      {tab === "project" ? (
        <ProjectDetailsForm
          project={calc.project}
          onPatch={calc.patchProject}
        />
      ) : null}

      <div className="mt-4">
        <ResultPanel result={calc.result} density="full" />
      </div>
      <div className="mt-3">
        <Handoff
          result={calc.result}
          scenario={calc.scenario}
          scenarioLabel={calc.scenarioLabel}
          project={calc.project}
          whatsappNumber={whatsappNumber}
          onShare={onShare}
          stack
        />
      </div>
    </SurfaceCard>
  );
}

function TabButton({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
        active
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-600 hover:text-neutral-900"
      }`}
    >
      {label}
    </button>
  );
}
