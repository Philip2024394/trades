// PlasteringCalcLandscape — 4:3 desktop embed. Left rail = surface
// lists + scenario, main = active editor + tabs, right = result +
// project details + handoff.

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

export type PlasteringCalcLandscapeProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onShare?: () => void;
};

export function PlasteringCalcLandscape({
  product,
  whatsappNumber,
  onShare
}: PlasteringCalcLandscapeProps) {
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
        <Overline icon={PaintBucket}>Plastering calculator</Overline>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          Full plastering quote — external render + internal skim
        </h3>
        <p className="text-[12px] text-neutral-600">
          10 finishes · gable triangles · quoins · openings · features ·
          insulation · 4-bead pricing
        </p>
      </div>

      <div className="mb-3">
        <ScenarioPicker
          scenario={calc.scenario}
          labels={calc.scenarioLabels}
          onChange={calc.changeScenario}
          mode="grid"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,320px)]">
        {/* Left rail — surface lists */}
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
          {showInternal ? (
            <RoomList
              rooms={calc.rooms}
              activeId={calc.activeRoomId}
              onSelect={calc.setActiveRoomId}
              onAdd={() => calc.addRoom(`Room ${calc.rooms.length + 1}`)}
              onRemove={calc.removeRoom}
            />
          ) : null}
        </div>

        {/* Main editor */}
        <div>
          <div className="mb-2 flex gap-1 rounded-lg bg-neutral-100 p-1">
            <TabButton
              active={tab === "surface"}
              onClick={() => setTab("surface")}
              label="Surface"
            />
            <TabButton
              active={tab === "rates"}
              onClick={() => setTab("rates")}
              label="My rates"
            />
            <TabButton
              active={tab === "project"}
              onClick={() => setTab("project")}
              label="Project"
            />
          </div>
          <div className="max-h-[520px] overflow-y-auto pr-1">
            {tab === "surface" ? (
              <div className="flex flex-col gap-4">
                {showExternal && activeElevation ? (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      External · {activeElevation.name}
                    </div>
                    <ElevationEditor
                      elevation={activeElevation}
                      onPatch={(patch) =>
                        calc.patchElevation(activeElevation.id, patch)
                      }
                      onAddOpening={(type) =>
                        calc.addElevationOpening(activeElevation.id, type)
                      }
                      onPatchOpening={(oid, patch) =>
                        calc.patchElevationOpening(
                          activeElevation.id,
                          oid,
                          patch
                        )
                      }
                      onRemoveOpening={(oid) =>
                        calc.removeElevationOpening(activeElevation.id, oid)
                      }
                    />
                  </div>
                ) : null}
                {showInternal && activeRoom ? (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Internal · {activeRoom.name}
                    </div>
                    <RoomEditor
                      room={activeRoom}
                      onPatch={(patch) => calc.patchRoom(activeRoom.id, patch)}
                      onAddOpening={(type) =>
                        calc.addRoomOpening(activeRoom.id, type)
                      }
                      onPatchOpening={(oid, patch) =>
                        calc.patchRoomOpening(activeRoom.id, oid, patch)
                      }
                      onRemoveOpening={(oid) =>
                        calc.removeRoomOpening(activeRoom.id, oid)
                      }
                    />
                  </div>
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
          </div>
        </div>

        {/* Right rail — result + handoff */}
        <div className="flex flex-col gap-3">
          <ResultPanel result={calc.result} density="full" />
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
