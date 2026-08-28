"use client";

import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";
import { outlineBtnClass } from "@/lib/ui-buttons";

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
  /** Bordered button (default) or plain text link. */
  variant?: "text" | "outline";
  size?: "sm" | "md";
};

/** Shiply job link that opens in the background when possible. */
export function ShiplyLink({
  href,
  children = "Shiply →",
  className,
  variant = "outline",
  size = "md",
  ...props
}: ShiplyLinkProps) {
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    openInBackgroundTab(href);
  }

  const variantClass =
    variant === "outline" ? outlineBtnClass("amber", size) : "";

  return (
    <button
      type="button"
      {...props}
      onClick={handleClick}
      title="Opens Shiply in another tab — stay here to enter your bid"
      className={[variantClass, className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
