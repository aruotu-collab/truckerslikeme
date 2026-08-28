/** Shared bordered button styles so secondary actions read as clickable. */
export function outlineBtnClass(
  tone: "amber" | "muted" = "amber",
  size: "sm" | "md" = "md",
) {
  const base =
    "inline-flex items-center justify-center rounded-sm border-2 border-asphalt/40 bg-white font-semibold tracking-wide uppercase shadow-sm";
  const pad =
    size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[10px]";
  const toneClass =
    tone === "amber"
      ? "text-amber hover:border-amber hover:bg-amber/10"
      : "text-asphalt hover:border-asphalt hover:bg-concrete/40";
  return `${base} ${pad} ${toneClass}`;
}

/** Destructive outline (Remove, etc.). */
export function outlineBtnAlertClass(size: "sm" | "md" = "md") {
  const base =
    "inline-flex items-center justify-center rounded-sm border-2 border-alert/35 bg-white font-semibold tracking-wide text-alert uppercase shadow-sm hover:border-alert hover:bg-red-50";
  const pad =
    size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[10px]";
  return `${base} ${pad}`;
}
