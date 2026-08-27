"use client";

import { useMarket } from "@/lib/market-context";

type JobBidFieldProps = {
  value: number | null;
  miles?: number | null;
  onChange: (value: number | null) => void;
  compact?: boolean;
};

export function JobBidField({
  value,
  miles,
  onChange,
  compact = false,
}: JobBidFieldProps) {
  const { money } = useMarket();

  return (
    <label
      className={`flex flex-wrap items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
        Your quote £
      </span>
      <input
        type="number"
        min={0}
        step={1}
        inputMode="decimal"
        placeholder="Quote"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
        className={`border border-asphalt/15 bg-white tabular-nums outline-none focus:border-amber ${
          compact ? "w-24 px-2 py-1 text-xs" : "w-28 px-2 py-1.5 text-sm"
        }`}
      />
      {value != null && value > 0 && miles != null && miles > 0 && (
        <>
          <span className="text-xs text-muted">
            {money(value / miles)}/loaded mi
          </span>
          {!compact && (
            <span className="w-full text-[10px] text-muted">
              Quote ÷ loaded miles only — not trip profit.
            </span>
          )}
        </>
      )}
    </label>
  );
}
