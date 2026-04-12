export type DigestEligibilityCandidate = {
  userId: string;
  benefitId: string;
  periodKey: string;
};

const toCompositeUsedKey = (userId: string, benefitId: string, periodKey: string) => `${userId}:${benefitId}:${periodKey}`;

export function filterDigestEligibleBenefits<T extends DigestEligibilityCandidate>(
  candidates: T[],
  usedStatusKeys: Set<string>,
): T[] {
  return candidates.filter((candidate) => !usedStatusKeys.has(toCompositeUsedKey(candidate.userId, candidate.benefitId, candidate.periodKey)));
}
