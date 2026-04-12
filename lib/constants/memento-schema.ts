export const REMINDER_STYLES = ["balanced", "earlier", "minimal"] as const;
export type ReminderStyle = (typeof REMINDER_STYLES)[number];

export const USER_CARD_STATUSES = ["active", "removed"] as const;
export type UserCardStatus = (typeof USER_CARD_STATUSES)[number];

export const BENEFIT_REMINDER_STATUSES = [
  "scheduled",
  "delivered",
  "dismissed",
  "cancelled",
] as const;
export type BenefitReminderStatus = (typeof BENEFIT_REMINDER_STATUSES)[number];

export const CANONICAL_CARD_STATUSES = [
  "active",
  "no_trackable_benefits",
  "retired",
] as const;
export type CanonicalCardStatus = (typeof CANONICAL_CARD_STATUSES)[number];

export const TRACK_IN_MEMENTO_VALUES = ["yes", "later", "no"] as const;
export type TrackInMemento = (typeof TRACK_IN_MEMENTO_VALUES)[number];
