# Memento Import Spec: Amex Benefits CSV → Normalized Schema

## Goal
Transform the flat CSV into:
- one `cards` row per unique card
- zero or more `benefits` rows per card
- one `benefit_history` row per benefit (created snapshot)

## Modes

### Dry Run (default)
- Parses CSV
- Validates data
- Generates preview outputs
- Produces summary
- Makes no DB writes

### Commit Mode
- Runs full validation
- Writes to DB in a transaction
- Rolls back on failure

## Input
CSV: `amex_cards_and_benefits.csv`

Columns:
- card_name
- benefit_name
- benefit_value
- cadence
- reset_timing
- enrollment_required
- requires_setup
- track_in_memento
- source_url
- notes
- card_status

## Row Types

### Active (real benefit)
- Creates card if needed
- Creates benefit
- Creates benefit_history row

### Placeholder (no benefits)
- Creates card only
- No benefit rows created

## Validation Rules

### Required Fields
- card_name
- source_url
- card_status

### Enums
- card_status: active, no_trackable_benefits
- cadence: monthly, quarterly, semiannual, annual, multi_year, one_time, per_booking
- track_in_memento: yes, later, no

### Booleans
- yes → true
- no → false

### Fail Conditions
- missing headers
- invalid enums
- duplicate card_code
- duplicate benefit_code
- conflicting card_status
- missing required fields

## Code Generation

### card_code
Format:
```
{issuer}_{slug(card_name)}
```

Rules:
- lowercase
- remove ™ ® ℠
- replace & with 'and'
- replace non-alphanumeric with underscores
- collapse underscores

### benefit_code
Format:
```
{card_code}_{slug(benefit_name)}
```

## Hash

Input:
```
benefit_code|benefit_value|cadence|reset_timing|enrollment_required|requires_setup|track_in_memento
```

- SHA-256
- excludes benefit_name, notes, source_url

## Mapping

### Cards
| CSV | DB |
|-----|----|
| card_name | cards.card_name |
| source_url | cards.source_url |
| card_status | cards.card_status |

### Benefits
| CSV | DB |
|-----|----|
| benefit_name | benefits.benefit_name |
| benefit_value | benefits.benefit_value |
| cadence | benefits.cadence |
| reset_timing | benefits.reset_timing |
| enrollment_required | benefits.enrollment_required |
| requires_setup | benefits.requires_setup |
| track_in_memento | benefits.track_in_memento |
| source_url | benefits.source_url |
| notes | benefits.notes |

## Timestamps
- last_verified_at = import time

## Outputs (Dry Run)
- cards.preview.json
- benefits.preview.json
- benefit_history.preview.json
- import_summary.json

## Summary Includes
- card count
- benefit count
- validation errors
- collisions
- enum issues

## Execution Flow
1. Parse
2. Validate
3. Transform
4. Output (dry run) or write (commit)

## Non-Goals
- user-level tracking
- reminders
- anniversary logic
- ingestion automation

