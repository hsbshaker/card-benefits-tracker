-- Remove legacy pending-wallet artifacts if they exist.
-- This migration is intentionally defensive so it is safe across environments.

drop table if exists public.pending_wallet cascade;
drop table if exists public.pending_wallet_cards cascade;
drop table if exists public.pending_user_cards cascade;
drop table if exists public.pending_cards cascade;

alter table if exists public.user_cards
  drop column if exists is_pending,
  drop column if exists pending_at,
  drop column if exists status;

drop index if exists public.pending_wallet_user_id_idx;
drop index if exists public.pending_wallet_card_id_idx;
drop index if exists public.pending_user_cards_user_id_idx;
drop index if exists public.pending_user_cards_card_id_idx;
drop index if exists public.user_cards_pending_idx;
