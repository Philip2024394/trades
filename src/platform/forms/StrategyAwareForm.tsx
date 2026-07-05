// StrategyAwareForm — renders a FormManifest, respecting facets.
//
// This is the runtime bridge: takes a form template + a ResolvedStrategy,
// filters fields by visibleWhen conditions, resolves dynamic options
// from strategy/profile, adapts the submit label + success behaviour,
// and wires react-hook-form + Zod.

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { buildFormSchema } from "./schema";
import type {
  FieldVisibilityRule,
  FormFieldDefinition,
  FormManifest,
  FormRendererProps
} from "./types";

type StrategyContext = NonNullable<FormRendererProps["strategy"]>;

/** Evaluate a visibility rule against strategy + form state. */
function isVisible(
  field: FormFieldDefinition,
  strategy: StrategyContext | undefined,
  values: Record<string, unknown>
): boolean {
  const rule = field.visibleWhen;
  if (!rule) return true;
  switch (rule.kind) {
    case "field":
      return values[rule.field] === rule.equals;
    case "facet": {
      if (!strategy) return true; // no strategy → show everything
      const val = strategy.get(rule.domain, rule.field);
      if (rule.exists !== undefined) {
        return rule.exists ? val !== undefined : val === undefined;
      }
      if (rule.equals !== undefined) return val === rule.equals;
      return val !== undefined;
    }
    case "profileFlag": {
      // Simplified — inputs surface profile flags at runtime via
      // consumer-supplied strategy.inputs.profile. Placeholder true.
      return true;
    }
  }
}

/** Resolve dynamic options for a select/multi-select field from
 *  strategy or profile. */
function resolveOptions(
  field: FormFieldDefinition,
  strategy: StrategyContext | undefined
): readonly { value: string; label: string }[] {
  if (field.optionsFrom && strategy) {
    let source: readonly string[] = [];
    switch (field.optionsFrom.source) {
      case "strategy-push-services":
        source = strategy.inputs.strategy.pushServices ?? [];
        break;
      case "profile-primary-services":
        source = strategy.inputs.profile.primaryServices ?? [];
        break;
      case "profile-secondary-services":
        source = strategy.inputs.profile.secondaryServices ?? [];
        break;
    }
    return source.map((s) => ({
      value: s,
      label: s
        .split(/[-_]/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ")
    }));
  }
  return field.options ?? [];
}

/** Map an intent slug like "call-now" or "free-survey" to a user-facing
 *  label. Content generation happens elsewhere; this is a small default
 *  vocabulary. */
function labelForIntent(intent: unknown, fallback: string): string {
  if (typeof intent !== "string") return fallback;
  const map: Record<string, string> = {
    "call-now": "Call Now",
    "book-consultation": "Book Consultation",
    "book-survey": "Book Free Survey",
    "free-survey": "Book Free Survey",
    "request-quote": "Request a Quote",
    whatsapp: "WhatsApp Us",
    "open-trade-account": "Open a Trade Account",
    "submit-enquiry": "Send Enquiry",
    "submit-quote": "Get My Quote"
  };
  return map[intent] ?? fallback;
}

export function StrategyAwareForm({
  manifest,
  strategy,
  className
}: FormRendererProps & { manifest: FormManifest }) {
  // Resolve submit label from strategy — form.submitLabel wins over
  // cta.primary; otherwise fall back to a manifest default or "Send".
  const submitIntent =
    strategy?.get("form", "submitLabel") ??
    strategy?.get("cta", "primary");
  const submitLabel = React.useMemo(
    () =>
      labelForIntent(
        typeof submitIntent === "object" && submitIntent
          ? (submitIntent as Record<string, unknown>).intent
          : submitIntent,
        "Send"
      ),
    [submitIntent]
  );

  // Compute currently-visible fields.
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const visibleFields = React.useMemo(
    () => manifest.fields.filter((f) => isVisible(f, strategy, values)),
    [manifest.fields, strategy, values]
  );

  // Read the hide-fields facet — strategy can suppress fields.
  const hideFieldsFacet = strategy?.get("form", "hideFields") as
    | { keys?: string[] }
    | undefined;
  const hiddenKeys = new Set(hideFieldsFacet?.keys ?? []);
  const finalFields = visibleFields.filter((f) => !hiddenKeys.has(f.key));

  const schema = React.useMemo(
    () => buildFormSchema(finalFields),
    [finalFields]
  );

  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      finalFields.map((f) => [f.key, defaultValueFor(f)])
    ) as FormValues,
    mode: "onBlur"
  });

  // Watch values to re-evaluate visibleWhen on sibling-field conditions.
  React.useEffect(() => {
    const sub = form.watch((v) => setValues(v as Record<string, unknown>));
    return () => sub.unsubscribe();
  }, [form]);

  const [status, setStatus] = React.useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function onValid(v: FormValues) {
    setStatus("submitting");
    try {
      await dispatch(manifest, v as Record<string, unknown>);
      setStatus("success");
      if (manifest.successBehaviour.kind === "redirect") {
        window.location.href = manifest.successBehaviour.href;
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Submission failed");
    }
  }

  if (status === "success" && manifest.successBehaviour.kind !== "redirect") {
    return (
      <div className={className}>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 p-4 text-sm text-emerald-900">
          Thanks — we&apos;ll be in touch shortly.
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onValid)}
        className={"flex flex-col gap-3 " + (className ?? "")}
        noValidate
      >
        {finalFields.map((field) => (
          <FormField
            key={field.key}
            control={form.control}
            name={field.key as never}
            render={({ field: rhf }) => (
              <FormItem>
                <FormLabel className="text-caption font-extrabold uppercase text-muted-foreground">
                  {field.label}
                  {field.required ? "" : " (optional)"}
                </FormLabel>
                <FormControl>
                  {renderFieldControl(field, rhf, strategy)}
                </FormControl>
                {field.description && (
                  <p className="text-[11px] text-muted-foreground">
                    {field.description}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        {manifest.consentLine && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {manifest.consentLine}
          </p>
        )}
        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Sending…" : submitLabel}
        </Button>
        {status === "error" && errorMsg && (
          <p className="mt-1 text-center text-caption text-destructive">
            {errorMsg}
          </p>
        )}
      </form>
    </Form>
  );
}

function defaultValueFor(field: FormFieldDefinition): unknown {
  switch (field.kind) {
    case "checkbox":
    case "switch":
      return false;
    case "multi-select":
      return [];
    case "number":
      return "";
    default:
      return "";
  }
}

function renderFieldControl(
  field: FormFieldDefinition,
  rhf: { value: unknown; onChange: (v: unknown) => void; onBlur: () => void; name: string },
  strategy: StrategyContext | undefined
) {
  const options = resolveOptions(field, strategy);

  switch (field.kind) {
    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder}
          value={String(rhf.value ?? "")}
          onChange={(e) => rhf.onChange(e.target.value)}
          onBlur={rhf.onBlur}
          rows={4}
        />
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!rhf.value}
            onCheckedChange={(v) => rhf.onChange(!!v)}
          />
          <Label>{field.label}</Label>
        </div>
      );
    case "switch":
      return (
        <Switch
          checked={!!rhf.value}
          onCheckedChange={(v) => rhf.onChange(!!v)}
        />
      );
    case "select":
      return (
        <Select
          value={String(rhf.value ?? "")}
          onValueChange={(v) => rhf.onChange(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "radio-group":
      return (
        <RadioGroup
          value={String(rhf.value ?? "")}
          onValueChange={(v) => rhf.onChange(v)}
        >
          {options.map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem value={o.value} id={`${field.key}-${o.value}`} />
              <Label htmlFor={`${field.key}-${o.value}`}>{o.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    case "hidden":
      return (
        <input type="hidden" value={String(rhf.value ?? "")} />
      );
    default:
      return (
        <Input
          type={mapInputType(field.kind)}
          placeholder={field.placeholder}
          value={String(rhf.value ?? "")}
          onChange={(e) => rhf.onChange(e.target.value)}
          onBlur={rhf.onBlur}
        />
      );
  }
}

function mapInputType(kind: FormFieldDefinition["kind"]): string {
  switch (kind) {
    case "email":
      return "email";
    case "tel":
      return "tel";
    case "url":
      return "url";
    case "number":
      return "number";
    case "date":
      return "date";
    case "time":
      return "time";
    case "datetime":
      return "datetime-local";
    default:
      return "text";
  }
}

async function dispatch(
  manifest: FormManifest,
  values: Record<string, unknown>
): Promise<void> {
  const s = manifest.submit;
  const body = { form: manifest.slug, values, purpose: manifest.purpose };
  switch (s.kind) {
    case "post-endpoint":
    case "formspree": {
      const res = await fetch(s.kind === "formspree" ? s.endpoint : s.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      break;
    }
    case "supabase-table": {
      const res = await fetch("/api/forms/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ table: s.table, ...body })
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      break;
    }
    case "custom": {
      const res = await fetch("/api/forms/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adapterId: s.adapterId, ...body })
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      break;
    }
  }
}
