// usePlasteringCalc — shared state hook for the big plastering calc.
//
// Manages: scenario · elevations[] · rooms[] · rates · project details.
// All mutations use immutable updates so React memoisation stays honest.

"use client";

import { useCallback, useMemo, useState } from "react";
import {
  computePlastering,
  DEFAULT_RATES,
  DEFAULT_ELEVATIONS,
  DEFAULT_ROOMS,
  DEFAULT_PROJECT,
  FALLBACK_PLASTERING_PRODUCT,
  newElevation,
  newOpening,
  newRoom,
  plasteringComplementarySubcategories,
  SCENARIO_LABEL
} from "./logic";
import type {
  CalculatorProductRef,
  Elevation,
  ExternalFinish,
  InternalFinish,
  MyRates,
  Opening,
  OpeningType,
  PlasteringInputs,
  PlasteringScenario,
  ProjectDetails,
  Room,
  SubstrateType
} from "./logic";

export type UsePlasteringCalcOptions = {
  product?: CalculatorProductRef;
  initialScenario?: PlasteringScenario;
};

export function usePlasteringCalc(options?: UsePlasteringCalcOptions) {
  const [scenario, setScenario] = useState<PlasteringScenario>(
    options?.initialScenario ?? "full_house"
  );
  const [elevations, setElevations] = useState<Elevation[]>(DEFAULT_ELEVATIONS);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [rates, setRates] = useState<MyRates>(DEFAULT_RATES);
  const [project, setProject] = useState<ProjectDetails>(DEFAULT_PROJECT);
  const [activeElevationId, setActiveElevationId] = useState<string | null>(
    DEFAULT_ELEVATIONS[0]?.id ?? null
  );
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    DEFAULT_ROOMS[0]?.id ?? null
  );

  const product = options?.product ?? FALLBACK_PLASTERING_PRODUCT;

  const inputs = useMemo<PlasteringInputs>(
    () => ({ scenario, elevations, rooms, rates, project }),
    [scenario, elevations, rooms, rates, project]
  );

  const result = useMemo(
    () => computePlastering(inputs, product),
    [inputs, product]
  );
  const crossSellSubcategories = useMemo(
    () => plasteringComplementarySubcategories(),
    []
  );

  // Elevation mutations
  const patchElevation = useCallback(
    (id: string, patch: Partial<Elevation>) => {
      setElevations((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
    },
    []
  );
  const addElevation = useCallback((name: string, finish?: ExternalFinish) => {
    const created = newElevation(name, finish);
    setElevations((prev) => [...prev, created]);
    setActiveElevationId(created.id);
  }, []);
  const removeElevation = useCallback((id: string) => {
    setElevations((prev) => prev.filter((e) => e.id !== id));
    setActiveElevationId((prev) => (prev === id ? null : prev));
  }, []);

  const addElevationOpening = useCallback(
    (elevationId: string, type: OpeningType = "window") => {
      const opening = newOpening(type);
      setElevations((prev) =>
        prev.map((e) =>
          e.id === elevationId
            ? { ...e, openings: [...e.openings, opening] }
            : e
        )
      );
    },
    []
  );
  const patchElevationOpening = useCallback(
    (elevationId: string, openingId: string, patch: Partial<Opening>) => {
      setElevations((prev) =>
        prev.map((e) =>
          e.id === elevationId
            ? {
                ...e,
                openings: e.openings.map((o) =>
                  o.id === openingId ? { ...o, ...patch } : o
                )
              }
            : e
        )
      );
    },
    []
  );
  const removeElevationOpening = useCallback(
    (elevationId: string, openingId: string) => {
      setElevations((prev) =>
        prev.map((e) =>
          e.id === elevationId
            ? { ...e, openings: e.openings.filter((o) => o.id !== openingId) }
            : e
        )
      );
    },
    []
  );

  // Room mutations
  const patchRoom = useCallback((id: string, patch: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const addRoom = useCallback(
    (name: string, substrate?: SubstrateType, finish?: InternalFinish) => {
      const created = newRoom(name, substrate, finish);
      setRooms((prev) => [...prev, created]);
      setActiveRoomId(created.id);
    },
    []
  );
  const removeRoom = useCallback((id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    setActiveRoomId((prev) => (prev === id ? null : prev));
  }, []);

  const addRoomOpening = useCallback(
    (roomId: string, type: OpeningType = "window") => {
      const opening = newOpening(type);
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId ? { ...r, openings: [...r.openings, opening] } : r
        )
      );
    },
    []
  );
  const patchRoomOpening = useCallback(
    (roomId: string, openingId: string, patch: Partial<Opening>) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                openings: r.openings.map((o) =>
                  o.id === openingId ? { ...o, ...patch } : o
                )
              }
            : r
        )
      );
    },
    []
  );
  const removeRoomOpening = useCallback(
    (roomId: string, openingId: string) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? { ...r, openings: r.openings.filter((o) => o.id !== openingId) }
            : r
        )
      );
    },
    []
  );

  const patchRates = useCallback((patch: Partial<MyRates>) => {
    setRates((prev) => ({ ...prev, ...patch }));
  }, []);
  const patchBeading = useCallback(
    (
      key: keyof MyRates["beading"],
      patch: Partial<MyRates["beading"][keyof MyRates["beading"]]>
    ) => {
      setRates((prev) => ({
        ...prev,
        beading: {
          ...prev.beading,
          [key]: { ...prev.beading[key], ...patch }
        }
      }));
    },
    []
  );

  const patchProject = useCallback((patch: Partial<ProjectDetails>) => {
    setProject((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    scenario,
    scenarioLabel: SCENARIO_LABEL[scenario],
    scenarioLabels: SCENARIO_LABEL,
    changeScenario: setScenario,

    elevations,
    activeElevationId,
    setActiveElevationId,
    patchElevation,
    addElevation,
    removeElevation,
    addElevationOpening,
    patchElevationOpening,
    removeElevationOpening,

    rooms,
    activeRoomId,
    setActiveRoomId,
    patchRoom,
    addRoom,
    removeRoom,
    addRoomOpening,
    patchRoomOpening,
    removeRoomOpening,

    rates,
    patchRates,
    patchBeading,

    project,
    patchProject,

    inputs,
    result,
    crossSellSubcategories,
    product
  };
}

export type UsePlasteringCalcReturn = ReturnType<typeof usePlasteringCalc>;
