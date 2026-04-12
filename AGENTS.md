# AGENTS.md

## Project
Memento is a credit card benefits tracker focused on “use it or lose it” benefits like statement credits, free night awards, airline fee credits, companion certificates, and similar time-bound benefits.

Core principles:
- Free forever
- No bank login / no Plaid
- No card numbers required
- Users self-enter cards and track benefits manually
- Product should feel premium, clean, and simple

## Product Priorities
Current priorities, in order:
1. Reliable canonical benefit data model
2. Clean user onboarding and wallet building
3. Accurate period/reset logic for time-bound benefits
4. Persistent user-level benefit state
5. Reminder and expiration workflows
6. Additional issuers after Amex is stable

## Current Canonical Data Model
Use these canonical tables for product-facing benefit/catalog work:
- `public.cards`
- `public.benefits`

Use this table for backend/history only unless explicitly asked:
- `public.benefit_history`

Important field conventions:
- `cards.card_status`:
  - `active`
  - `no_trackable_benefits`
  - `retired`
- `benefits.track_in_memento`:
  - `yes`
  - `later`
  - `no`

User-facing UI should generally show only:
- cards with `card_status in ('active', 'no_trackable_benefits')`
- benefits with `track_in_memento = 'yes'`

## Current Phase Boundaries
Phase A:
- App reads from canonical `cards` and `benefits`

Phase B:
- Time-period logic for:
  - monthly
  - quarterly
  - semiannual
  - annual

Phase C:
- User-level used/remind state

Explicitly deferred for later:
- anniversary-based resets
- multi_year product logic
- per_booking product logic
- spend-threshold logic
- benefit history UI
- reminder delivery jobs
- issuer expansion beyond Amex

## Engineering Preferences
- Prefer narrow, implementation-focused changes
- Reuse existing Supabase patterns already in the repo
- Do not introduce new abstractions unless clearly necessary
- Preserve current UI styling and UX unless asked otherwise
- Prefer additive migrations over redesigns
- Do not silently invent business logic for missing data
- Keep importer logic and app logic separate

## Data / Import Rules
- The CSV is a transport/research artifact, not the source of truth
- The DB schema is the source of truth
- Importer should remain deterministic
- `benefit_hash` is based on material fields only
- Do not hand-edit imported production data in app code

## UI / UX Rules
- Premium, clean, minimal feel
- Avoid clutter and over-explaining
- Preserve current layouts when adding logic
- Handle cards with no trackable benefits gracefully
- User-facing benefit lists should not expose `later` or `no` benefits unless explicitly requested

## Codex Working Style
When working on non-trivial tasks:
1. Inspect the repo first
2. Identify files likely to change
3. Propose a short implementation plan
4. Make the smallest safe change that accomplishes the task
5. Summarize:
   - files changed
   - key queries/logic added
   - assumptions
   - deferred follow-ups

Avoid:
- broad refactors
- schema changes outside the asked scope
- touching importer logic when working on app UI unless explicitly requested
- changing unrelated files

## Build / Deploy Notes
- Keep Vercel builds clean
- Avoid letting standalone scripts break Next.js app builds
- Prefer explicit typing for backend/import scripts
- Generated preview artifacts should remain ignored

## Git / Repo Hygiene
- Do not commit local CSV research artifacts unless explicitly asked
- Do not commit generated preview JSON artifacts
- Keep changes scoped and reviewable