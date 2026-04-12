import type {
  BenefitReminderStatus,
  CanonicalCardStatus,
  ReminderStyle,
  TrackInMemento,
  UserCardStatus,
} from "@/lib/constants/memento-schema";

export interface CanonicalCard {
  id: string;
  card_code: string | null;
  display_name: string | null;
  issuer: string | null;
  card_status: CanonicalCardStatus | null;
  created_at: string;
  updated_at: string;
}

export interface CanonicalBenefit {
  id: string;
  card_id: string;
  benefit_code: string | null;
  benefit_name: string | null;
  benefit_value: string | null;
  cadence: string | null;
  track_in_memento: TrackInMemento | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  global_reminder_style: ReminderStyle;
  notifications_enabled: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface UserCard {
  id: string;
  user_id: string;
  card_id: string;
  added_at: string;
  card_anniversary_date: string | null;
  status: UserCardStatus;
  created_at: string;
  updated_at: string;
}

export interface UserBenefit {
  id: string;
  user_card_id: string;
  benefit_id: string;
  is_active: boolean;
  is_used_this_period: boolean;
  last_used_at: string | null;
  reminder_override: ReminderStyle | null;
  conditional_value: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface BenefitReminder {
  id: string;
  user_benefit_id: string;
  scheduled_for: string;
  delivered_at: string | null;
  dismissed_at: string | null;
  status: BenefitReminderStatus;
  created_at: string;
  updated_at: string;
}

export interface UserBenefitWithCardAndCanonicalBenefit extends UserBenefit {
  user_card: UserCard;
  benefit: CanonicalBenefit;
}
