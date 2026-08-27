"use client";

import { useEffect } from "react";

/**
 * Locks the visual viewport so iOS/Android can't rubber-band the page sideways.
 * Vertical scroll stays normal. Does not intercept touches inside Shiply live view.
 */
export function LockHorizontalPan() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflowX;
    root.style.overflowX = "clip";
    document.body.style.overflowX = "clip";
    // Prefer CSS; avoid forcing pan-y on body (breaks iframe taps on iOS)
    if (!document.body.style.touchAction) {
      document.body.style.touchAction = "pan-y";
    }

    let startX = 0;
    let startY = 0;

    function isShiplyTouch(target: EventTarget | null) {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          ".shiply-live-shell, .shiply-live-frame, [data-shiply-live], iframe.shiply-live-frame",
        ),
      );
    }

    const onTouchStart = (e: TouchEvent) => {
      if (isShiplyTouch(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isShiplyTouch(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      if (dx <= dy) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest(".h-scroll, [data-h-scroll]")) return;

      // Block horizontal document pan outside intentional sliders
      if (e.cancelable) e.preventDefault();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      root.style.overflowX = prev;
      document.body.style.overflowX = "";
      document.body.style.touchAction = "";
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return null;
}
