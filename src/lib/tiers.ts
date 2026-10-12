/**
 * Reading tiers: how much attention each picked post deserves. Every issue's
 * posts are ranked into these, best first; whatever else caught the eye goes to
 * the near-miss list. Caps are ceilings, not quotas.
 */
export const TIERS = ['dontSkip', 'worthYourTime', 'ifYouHaveAMinute'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  dontSkip: "Don't skip",
  worthYourTime: 'Worth your time',
  ifYouHaveAMinute: 'If you have a minute',
};

export const TIER_CAPS: Record<Tier, number> = {
  dontSkip: 3,
  worthYourTime: 4,
  ifYouHaveAMinute: 5,
};

export const NEAR_MISS_CAP = 8;

/** One message per tier over its cap; empty when the counts are fine. */
export function tierCapErrors(tiers: readonly Tier[]): string[] {
  return TIERS.flatMap((tier) => {
    const count = tiers.filter((t) => t === tier).length;
    return count > TIER_CAPS[tier]
      ? [`${TIER_LABELS[tier]} holds ${count} posts; the cap is ${TIER_CAPS[tier]}.`]
      : [];
  });
}

/** True when the tiers appear in rank order: every dontSkip before every worthYourTime, and so on. */
export function isTierOrdered(tiers: readonly Tier[]): boolean {
  return tiers.every((tier, i) => i === 0 || TIERS.indexOf(tiers[i - 1]) <= TIERS.indexOf(tier));
}
