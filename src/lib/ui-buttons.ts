/** Shared bordered button styles so secondary actions read as clickable. */
export function outlineBtnClass(
  tone: "amber" | "muted" = "amber",
  size: "sm" | "md" = "md",
) {
  const base =
    "inline-flex items-center justify-center rounded-sm border-2 border-asphalt/40 bg-white font-semibold tracking-normal uppercase shadow-sm sm:tracking-wide";
  const pad =
    size === "sm"
      ? "min-h-11 px-3 py-2 text-xs sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-[10px]"
      : "min-h-11 px-3.5 py-2 text-xs sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-[10px]";
  const toneClass =
    tone === "amber"
      ? "text-amber hover:border-amber hover:bg-amber/10"
      : "text-asphalt hover:border-asphalt hover:bg-concrete/40";
  return `${base} ${pad} ${toneClass}`;
}

/** Destructive outline (Remove, etc.). */
export function outlineBtnAlertClass(size: "sm" | "md" = "md") {
  const base =
    "inline-flex items-center justify-center rounded-sm border-2 border-alert/35 bg-white font-semibold tracking-normal text-alert uppercase shadow-sm hover:border-alert hover:bg-red-50 sm:tracking-wide";
  const pad =
    size === "sm"
      ? "min-h-11 px-3 py-2 text-xs sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-[10px]"
      : "min-h-11 px-3.5 py-2 text-xs sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-[10px]";
  return `${base} ${pad}`;
}
