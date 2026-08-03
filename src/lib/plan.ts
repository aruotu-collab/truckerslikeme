/** Free plan gets this many load analyses per calendar month. */
export const FREE_ANALYSES_PER_MONTH = 2;

export type PlanTier = "free" | "pro";

export function defaultOperatingAssumptions() {
  return {
    mpg: 6.5,
    /** Non-fuel CPM: payment, insurance, maintenance, tires */
    costPerMile: 0.65,
    dieselPrice: 3.85,
  };
}

export function isProPlan(plan: string | null | undefined) {
  return plan === "pro";
}
