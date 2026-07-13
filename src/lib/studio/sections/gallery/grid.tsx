// gallery.grid_1 — Phase 3 rebuild on shadcn foundation.
//
// Photo gallery grid for portfolio trades. Mobile: 2-col grid;
// Tablet: 3-col; Desktop: 4-col. Framer Motion staggered reveal.
// Click-through goes to a lightbox route (or plain link).
// Supports fixed photo1..8 slots OR items[] array.

"use client";

import Link from "next/link";
import { ImageOff } from "lucide-react";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type ItemShape = { url?: string; alt?: string; href?: string };

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  photo1Url: string; photo1Alt: string; photo1Href: string;
  photo2Url: string; photo2Alt: string; photo2Href: string;
  photo3Url: string; photo3Alt: string; photo3Href: string;
  photo4Url: string; photo4Alt: string; photo4Href: string;
  photo5Url: string; photo5Alt: string; photo5Href: string;
  photo6Url: string; photo6Alt: string; photo6Href: string;
  photo7Url: string; photo7Alt: string; photo7Href: string;
  photo8Url: string; photo8Alt: string; photo8Href: string;
  items?: ItemShape[];
  surface: "light" | "dark";
};

export function GalleryGrid({
  instanceId,
  config,
  tokens
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";

  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = typeof config.heading === "string" ? config.heading : "";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";

  let photos: Array<{ i: number; url: string; alt: string; href: string }> = [];
  if (Array.isArray(config.items) && config.items.length > 0) {
    photos = config.items
      .map((it, idx) => ({
        i: idx + 1,
        url: typeof it.url === "string" ? it.url : "",
        alt: typeof it.alt === "string" ? it.alt : "",
        href: typeof it.href === "string" ? it.href : ""
      }))
      .filter((p) => p.url.length > 0);
  } else {
    photos = [
      { i: 1, url: config.photo1Url, alt: config.photo1Alt, href: config.photo1Href },
      { i: 2, url: config.photo2Url, alt: config.photo2Alt, href: config.photo2Href },
      { i: 3, url: config.photo3Url, alt: config.photo3Alt, href: config.photo3Href },
      { i: 4, url: config.photo4Url, alt: config.photo4Alt, href: config.photo4Href },
      { i: 5, url: config.photo5Url, alt: config.photo5Alt, href: config.photo5Href },
      { i: 6, url: config.photo6Url, alt: config.photo6Alt, href: config.photo6Href },
      { i: 7, url: config.photo7Url, alt: config.photo7Alt, href: config.photo7Href },
      { i: 8, url: config.photo8Url, alt: config.photo8Alt, href: config.photo8Href }
    ]
      .map((p) => ({
        i: p.i,
        url: typeof p.url === "string" ? p.url : "",
        alt: typeof p.alt === "string" ? p.alt : "",
        href: typeof p.href === "string" ? p.href : ""
      }))
      .filter((p) => p.url.length > 0);
  }

  if (photos.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(instanceId, "gallery.grid_1", "Gallery grid")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        {(eyebrow || heading || subheading) && (
          <div className="mb-10 text-center sm:mb-12">
            {eyebrow && (
              <Reveal>
                <p
                  className="text-eyebrow font-extrabold uppercase"
                  style={{ color: accent }}
                  {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
                >
                  {eyebrow}
                </p>
              </Reveal>
            )}
            {heading && (
              <Reveal delay={0.05}>
                <h2
                  className="mt-3 text-display-sm font-extrabold sm:text-display-md lg:text-display-lg"
                  {...treeAttrs(instanceId, "heading", "Heading", "text")}
                >
                  {heading}
                </h2>
              </Reveal>
            )}
            {subheading && (
              <Reveal delay={0.1}>
                <p
                  className="mx-auto mt-4 max-w-2xl text-body-md text-muted-foreground sm:text-body-lg"
                  {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
                >
                  {subheading}
                </p>
              </Reveal>
            )}
          </div>
        )}

        <ul className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => {
            const inner = p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.url}
                alt={p.alt}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                {...treeAttrs(instanceId, `photo${p.i}Url`, `Photo ${p.i}`, "image")}
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-muted text-muted-foreground">
                <ImageOff size={20} strokeWidth={2} />
              </div>
            );
            return (
              <li key={p.i}>
                <Reveal delay={0.1 + i * 0.04}>
                  {p.href ? (
                    <Link
                      href={p.href}
                      className="group block aspect-square overflow-hidden rounded-xl border border-border/40 transition-shadow hover:shadow-lg"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="group aspect-square overflow-hidden rounded-xl border border-border/40">
                      {inner}
                    </div>
                  )}
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

