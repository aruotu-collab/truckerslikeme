"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackClick } from "@/lib/track-click";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  trackEvent: string;
  trackLabel: string;
};

export function TrackedLink({
  trackEvent,
  trackLabel,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackClick(trackEvent, trackLabel);
        onClick?.(e);
      }}
    />
  );
}
