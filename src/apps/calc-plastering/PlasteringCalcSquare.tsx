// PlasteringCalcSquare — 1:1 tile. Focused single-surface editor with
// stepper across scenarios; result condensed.

"use client";

import { PaintBucket } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { CalculatorProductRef } from "./logic";
import { ElevationEditor } from "./shared/ElevationEditor";
import { Handoff } from "./shared/Handoff";
import { ResultPanel } from "./shared/ResultPanel";
import { RoomEditor } from "./shared/RoomEditor";
import { ScenarioPicker } from "./shared/ScenarioPicker";
import { usePlasteringCalc } from "./usePlasteringCalc";

export type PlasteringCalcSquareProps = {
  product?: CalculatorProductRef;
  whatsappNumber?: string;
};

export function PlasteringCalcSquare({
  product,
  whatsappNumber
}: PlasteringCalcSquareProps) {
  const calc = usePlasteringCalc({ product });
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
    <SurfaceCard
      variant="primary"
      padding="md"
      className="flex aspect-square w-full flex-col"
    >
      <div className="mb-2">
        <Overline icon={PaintBucket}>Plastering calc</Overline>
        <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">
          {calc.scenarioLabel}
        </div>
      </div>
      <ScenarioPicker
        scenario={calc.scenario}
        labels={calc.scenarioLabels}
        onChange={calc.changeScenario}
        mode="scroll"
      />
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
        {showExternal && activeElevation ? (
          <div className="mb-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {activeElevation.name}
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
                calc.patchElevationOpening(activeElevation.id, oid, patch)
              }
              onRemoveOpening={(oid) =>
                calc.removeElevationOpening(activeElevation.id, oid)
              }
              density="compact"
            />
          </div>
        ) : null}
        {showInternal && activeRoom ? (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {activeRoom.name}
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
              density="compact"
            />
          </div>
        ) : null}
        <div className="mt-3">
          <ResultPanel result={calc.result} density="condensed" />
        </div>
      </div>
      <div className="mt-3">
        <Handoff
          result={calc.result}
          scenario={calc.scenario}
          scenarioLabel={calc.scenarioLabel}
          project={calc.project}
          whatsappNumber={whatsappNumber}
          showShare={false}
          stack
        />
      </div>
    </SurfaceCard>
  );
}
