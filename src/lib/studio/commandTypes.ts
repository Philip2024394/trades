// Command palette — public contract.
//
// Each command is a self-contained runnable action with a title,
// optional description, keyword tags for fuzzy search, and an optional
// keyboard shortcut. Commands are defined inline in the consumer
// (StudioLiveMirror for the page editor) so closures over React state
// stay natural — no context prop-drilling.

export type CommandCategory =
  | "action"
  | "navigate"
  | "device"
  | "system";

export type CommandShortcut = {
  key: string; // lowercased key, e.g. "d", "k", "1"
  cmd?: boolean; // Cmd on Mac, Ctrl on Windows/Linux
  shift?: boolean;
  alt?: boolean;
};

export type Command = {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  icon?: string;
  /** Extra fuzzy-match terms. E.g. "publish" → keywords: ["deploy",
   *  "go live", "ship"]. */
  keywords?: string[];
  shortcut?: CommandShortcut;
  /** Command is disabled + shown in dim colour when this returns true. */
  disabled?: boolean;
  run: () => void;
};

/** Match a keyboard event against a command's shortcut definition.
 *  Cross-platform: Cmd on Mac, Ctrl elsewhere — both handled by
 *  metaKey || ctrlKey. */
export function matchShortcut(
  shortcut: CommandShortcut,
  e: KeyboardEvent
): boolean {
  const wantCmd = shortcut.cmd ?? false;
  const wantShift = shortcut.shift ?? false;
  const wantAlt = shortcut.alt ?? false;
  const hasCmd = e.metaKey || e.ctrlKey;
  if (wantCmd !== hasCmd) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;
  return e.key.toLowerCase() === shortcut.key.toLowerCase();
}

/** Human-readable shortcut label. Uses ⌘ glyph so trades merchants
 *  who've only seen Mac keyboards + Windows keyboards recognise it
 *  universally. */
export function shortcutLabel(sc: CommandShortcut): string {
  const parts: string[] = [];
  if (sc.cmd) parts.push("⌘");
  if (sc.shift) parts.push("⇧");
  if (sc.alt) parts.push("⌥");
  parts.push(sc.key.toUpperCase());
  return parts.join(" ");
}
