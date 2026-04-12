import type { HomeHeaderInput } from "@/lib/types/server-data";

export function buildHomeHeader({
  trackedCards,
  trackedBenefits,
  useSoonCount,
  comingUpCount,
}: HomeHeaderInput) {
  if (trackedCards === 0 || trackedBenefits === 0) {
    return "Add a card to start tracking your benefits.";
  }

  if (useSoonCount > 0) {
    return useSoonCount === 1 ? "You have 1 benefit to use soon." : `You have ${useSoonCount} benefits to use soon.`;
  }

  if (comingUpCount > 0) {
    return comingUpCount === 1 ? "1 benefit is coming up next." : `${comingUpCount} benefits are coming up next.`;
  }

  return "You're caught up on the benefits that need attention right now.";
}
