// Design Registry · primitives · forms
//
// Catalogue entries for Input, Textarea, Label, Select, Checkbox,
// RadioGroup, Switch, Form. The renderer for each is a minimal
// static preview — the real interactive components live in
// @/components/ui/* and are imported directly by consumers.

"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { designSystemRegistry } from "../../registry";

// Shared metadata reused across every form primitive registration.
const SHARED = {
  category: "forms" as const,
  version: "1.0.0",
  author: "shadcn/ui + Radix",
  supportedDevices: ["mobile", "tablet", "desktop"] as const,
  accessibilityStatus: "wcag-aa" as const,
  performanceCost: "low" as const,
  compatibleThemes: ["*"],
  compatibleContainers: ["*"],
  tags: ["form", "input", "shadcn", "radix"]
};

// ─── Input ─────────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "forms.input",
  name: "Text Input",
  description:
    "Native text input with theme-aware styling + error state. Accepts every HTML input type (text, email, tel, url, number).",
  contentShape: "form",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.background"],
  animations: ["none"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["input", "text", "email", "field"],
  defaultProps: () => ({}),
  defaultContent: () => ({ fields: [], submitLabel: "" }),
  renderer: () => <Input placeholder="Placeholder…" />
});

// ─── Textarea ─────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "forms.textarea",
  name: "Textarea",
  description: "Multi-line text input for messages, descriptions, notes.",
  contentShape: "form",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.background"],
  animations: ["none"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["textarea", "message", "multi-line"],
  defaultProps: () => ({}),
  defaultContent: () => ({ fields: [], submitLabel: "" }),
  renderer: () => <Textarea placeholder="Message…" rows={3} />
});

// ─── Label ────────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "forms.label",
  name: "Field Label",
  description:
    "Radix Label that associates a text label with a form control (htmlFor).",
  contentShape: "typography",
  editableProps: [],
  themeTokensUsed: [],
  animations: ["none"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["label", "field"],
  defaultProps: () => ({}),
  defaultContent: () => ({ text: "Label" }),
  renderer: () => <Label>Label</Label>
});

// ─── Select ───────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "forms.select",
  name: "Select",
  description:
    "Radix Select dropdown. Keyboard-accessible, screen-reader friendly.",
  contentShape: "form",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.background"],
  animations: ["fade-in", "zoom-in"],
  performanceCost: "medium",
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["select", "dropdown", "combo", "picker"],
  defaultProps: () => ({}),
  defaultContent: () => ({ fields: [], submitLabel: "" }),
  renderer: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Option A</SelectItem>
        <SelectItem value="b">Option B</SelectItem>
      </SelectContent>
    </Select>
  )
});

// ─── Checkbox ─────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "forms.checkbox",
  name: "Checkbox",
  description: "Radix Checkbox. Independent toggle for boolean options.",
  contentShape: "form",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.primary"],
  animations: ["fade-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["checkbox", "check", "boolean", "toggle"],
  defaultProps: () => ({}),
  defaultContent: () => ({ fields: [], submitLabel: "" }),
  renderer: () => (
    <div className="flex items-center gap-2">
      <Checkbox defaultChecked />
      <Label>Option</Label>
    </div>
  )
});

// ─── RadioGroup ───────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "forms.radio-group",
  name: "Radio Group",
  description:
    "Radix Radio group — one of N mutually-exclusive options. Keyboard-accessible.",
  contentShape: "form",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.primary"],
  animations: ["fade-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["radio", "option", "exclusive", "choice"],
  defaultProps: () => ({}),
  defaultContent: () => ({ fields: [], submitLabel: "" }),
  renderer: () => (
    <RadioGroup defaultValue="a">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="a" id="a" />
        <Label htmlFor="a">Option A</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="b" id="b" />
        <Label htmlFor="b">Option B</Label>
      </div>
    </RadioGroup>
  )
});

// ─── Switch ───────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "forms.switch",
  name: "Switch",
  description:
    "Radix Switch — toggle on/off. Preferred over Checkbox for boolean settings.",
  contentShape: "form",
  editableProps: [],
  themeTokensUsed: ["color.primary", "color.muted"],
  animations: ["slide"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["switch", "toggle", "on-off", "boolean"],
  defaultProps: () => ({}),
  defaultContent: () => ({ fields: [], submitLabel: "" }),
  renderer: () => <Switch defaultChecked />
});
