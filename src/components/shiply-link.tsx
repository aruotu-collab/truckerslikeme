"use client";

import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";

/**
 * Open a URL in a new tab while trying to keep this tab focused
 * (so drivers can keep entering bids on TruckersLikeMe).
 */
export function openInBackgroundTab(url: string) {
  if (typeof window === "undefined" || !url.trim()) return;

  const win = window.open(url, "_blank");
  if (win) {
    try {
      win.opener = null;
      win.blur();
    } catch {
      // Cross-origin / browser policy — ignore
    }
  }

  window.focus();
  requestAnimationFrame(() => window.focus());
  window.setTimeout(() => window.focus(), 0);
}

type ShiplyLinkProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "onClick" | "type"
> & {
  href: string;
  children?: ReactNode;
};

/** Shiply job link that opens in the background when possible. */
export function ShiplyLink({
  href,
  children = "Shiply →",
  className,
  ...props
}: ShiplyLinkProps) {
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    openInBackgroundTab(href);
  }

  return (
    <button
      type="button"
      {...props}
      onClick={handleClick}
      title="Opens Shiply in another tab — stay here to enter your bid"
      className={className}
    >
      {children}
    </button>
  );
}
