"use client";

import type { AnchorHTMLAttributes } from "react";
import { track, type OutboundKind } from "@/lib/track";

/**
 * Link naar de website of het telefoonnummer van een plek. Een tik telt als doorklik (de hoofdmaat uit de PRD), alleen
 * met toestemming en zonder externe partij. Een route telt apart (`NavigateButton`).
 */
export function ContactLink({ soort, slug, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { soort: OutboundKind; slug: string }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        track("outbound", { soort, slug });
        onClick?.(e);
      }}
    />
  );
}
