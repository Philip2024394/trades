// contact.split_1 · form client component.
//
// Extracted from the section renderer so it can own RHF + Zod state
// without polluting the section's server-safe surface. Validates on
// blur, submits via the native form POST to preserve the merchant's
// Formspree / Formsubmit / custom endpoint action URL.
//
// Milestone 2 · Batch 7 — this is the reference RHF+Zod integration.
// Every future form primitive follows the same shape: Zod schema at
// the top, useForm with zodResolver, FormField wiring, native submit
// on validation success.

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";

// Trade-plain UK-friendly validation. Messages are short + human;
// merchants can override via config in a later milestone.
const buildSchema = (opts: { includePhone: boolean }) =>
  z.object({
    name: z
      .string()
      .min(2, "Please enter your name.")
      .max(80, "Name is too long."),
    email: z
      .string()
      .email("Enter a valid email address.")
      .max(160, "Email is too long."),
    phone: opts.includePhone
      ? z
          .string()
          .max(30, "Phone number is too long.")
          .optional()
          .or(z.literal(""))
      : z.string().optional(),
    message: z
      .string()
      .min(6, "A brief message helps us respond faster.")
      .max(2000, "Message is too long — 2000 chars max.")
  });

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

type Props = {
  formActionUrl: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  messagePlaceholder: string;
  showPhoneField: boolean;
  submitLabel: string;
  consentLine: string;
  accent: string;
  disabled?: boolean; // studio edit mode disables input focus
};

export function ContactForm({
  formActionUrl,
  namePlaceholder,
  emailPlaceholder,
  phonePlaceholder,
  messagePlaceholder,
  showPhoneField,
  submitLabel,
  consentLine,
  accent,
  disabled
}: Props) {
  const schema = React.useMemo(
    () => buildSchema({ includePhone: showPhoneField }),
    [showPhoneField]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
    mode: "onBlur"
  });

  const formRef = React.useRef<HTMLFormElement>(null);

  // On valid submit: fire native POST. The merchant's endpoint
  // (Formspree, Formsubmit, custom) handles delivery + redirect.
  // If no action URL is set, we no-op — the studio surface handles
  // the case where the merchant hasn't wired their endpoint yet.
  function onValid(_values: FormValues) {
    if (!formActionUrl) return;
    formRef.current?.submit();
  }

  return (
    <Form {...form}>
      <form
        ref={formRef}
        action={formActionUrl || undefined}
        method="POST"
        onSubmit={form.handleSubmit(onValid)}
        className="flex flex-col gap-3"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-caption font-extrabold uppercase text-muted-foreground">
                Name
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder={namePlaceholder}
                  disabled={disabled}
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-caption font-extrabold uppercase text-muted-foreground">
                Email
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={emailPlaceholder}
                  disabled={disabled}
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showPhoneField && (
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-caption font-extrabold uppercase text-muted-foreground">
                  Phone (optional)
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder={phonePlaceholder}
                    disabled={disabled}
                    autoComplete="tel"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-caption font-extrabold uppercase text-muted-foreground">
                Message
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder={messagePlaceholder}
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="xl"
          className="group mt-2 w-full"
          disabled={disabled}
          style={{
            background: accent,
            color: "#0A0A0A",
            boxShadow: `0 8px 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.5)`
          }}
        >
          <span>{submitLabel}</span>
          <Send
            strokeWidth={2.5}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Button>
        {consentLine && (
          <p className="mt-1 text-center text-caption text-muted-foreground">
            {consentLine}
          </p>
        )}
      </form>
    </Form>
  );
}
