"use client";

// src/app/nex-native/chat-standard/_surfaces/_composer.tsx
//
// Phase 2A.0 · Standard composer surface.
//
// Pure presentation. Reads engine.composerTreatment for everything
// visual. Caller supplies text state + onSend callback; the composer
// does not know whether `onSend` writes to live DB or local fixture.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

export interface StandardComposerProps {
  engine: ResolvedEngine;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function StandardComposer({
  engine,
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
}: StandardComposerProps): React.JSX.Element {
  const t = engine.composerTreatment();
  const [focused, setFocused] = React.useState(false);
  return (
    <form
      data-nex-se-composer
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      style={{
        ...t.containerStyle,
        animation:
          focused && t.focusAnimation
            ? `${t.focusAnimation} 1600ms ease-in-out infinite`
            : undefined,
      }}
    >
      <input
        type="text"
        data-nex-se-composer-input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder ?? "Say something…"}
        style={t.inputStyle}
      />
      <button
        type="submit"
        aria-label="Send message"
        data-nex-se-composer-send
        disabled={disabled || value.trim().length === 0}
        style={{
          ...t.sendButtonStyle,
          opacity: disabled || value.trim().length === 0 ? 0.5 : 1,
        }}
      >
        {t.sendGlyph}
      </button>
    </form>
  );
}
