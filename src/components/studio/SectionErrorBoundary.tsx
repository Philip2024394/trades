"use client";

// Per-section error boundary.
//
// A single misconfigured section (missing required config, incompatible
// data shape, thrown during render) must never take down the whole
// storefront. This boundary catches the throw, logs it to the console
// for the merchant/support to see, and renders an empty fragment so
// the rest of the page keeps working.

import { Component, type ReactNode } from "react";

export class SectionErrorBoundary extends Component<
  { sectionKey: string; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { sectionKey: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error(
      `[SectionErrorBoundary] "${this.props.sectionKey}" threw during render`,
      error,
      info
    );
  }
  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
