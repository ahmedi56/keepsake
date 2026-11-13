export type Plan = "free" | "memory" | "premium";

/** Contribution caps per plan. `null` means unlimited. */
export const PLAN_LIMITS: Record<Plan, { maxContributions: number | null; audioProcessing: boolean }> = {
  free: { maxContributions: 10, audioProcessing: false },
  memory: { maxContributions: null, audioProcessing: true },
  premium: { maxContributions: null, audioProcessing: true },
};
