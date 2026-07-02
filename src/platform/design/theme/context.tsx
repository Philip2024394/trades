"use client";

// Xrated Design System — theme React context.
//
// Components read the active theme via useDesignTheme(). Studio's
// preview shell + storefront render both wrap their trees in
// <DesignThemeProvider theme={...}>. The default provider falls back to
// DEFAULT_DESIGN_THEME so any component used outside a provider still
// renders — useful for standalone stories, tests, and jest snapshots.

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_DESIGN_THEME, type DesignTheme } from "./types";

const DesignThemeContext = createContext<DesignTheme>(DEFAULT_DESIGN_THEME);

export function DesignThemeProvider({
  theme,
  children
}: {
  theme: DesignTheme;
  children: ReactNode;
}) {
  return (
    <DesignThemeContext.Provider value={theme}>
      {children}
    </DesignThemeContext.Provider>
  );
}

/** Read the active theme. Returns DEFAULT_DESIGN_THEME when no
 *  provider is mounted — components stay renderable in isolation. */
export function useDesignTheme(): DesignTheme {
  return useContext(DesignThemeContext);
}
