import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBenefitPeriodStatusMap,
  buildBenefitUsageUpdate,
  getBenefitUsedForCurrentPeriod,
} from "@/lib/benefits/usage-state";

test("buildBenefitUsageUpdate writes the correct current-period row for mark used", () => {
  const at = new Date("2026-12-15T09:30:00.000Z");

  assert.equal(
    buildBenefitUsageUpdate({
      userId: "user-1",
      benefitId: "benefit-monthly",
      cadence: "monthly",
      nextUsed: true,
      at,
    }).periodStatusUpsert?.period_key,
    "2026-12",
  );

  assert.equal(
    buildBenefitUsageUpdate({
      userId: "user-1",
      benefitId: "benefit-quarterly",
      cadence: "quarterly",
      nextUsed: true,
      at,
    }).periodStatusUpsert?.period_key,
    "2026-Q4",
  );

  assert.equal(
    buildBenefitUsageUpdate({
      userId: "user-1",
      benefitId: "benefit-semiannual",
      cadence: "semi_annual",
      nextUsed: true,
      at,
    }).periodStatusUpsert?.period_key,
    "2026-H2",
  );

  assert.equal(
    buildBenefitUsageUpdate({
      userId: "user-1",
      benefitId: "benefit-annual",
      cadence: "annual",
      nextUsed: true,
      at,
    }).periodStatusUpsert?.period_key,
    "2026",
  );
});

test("buildBenefitUsageUpdate clears used_at when unmarking the current period", () => {
  const update = buildBenefitUsageUpdate({
    userId: "user-1",
    benefitId: "benefit-quarterly",
    cadence: "quarterly",
    nextUsed: false,
    at: new Date("2026-03-20T12:00:00.000Z"),
  });

  assert.deepEqual(update.periodStatusUpsert, {
    user_id: "user-1",
    benefit_id: "benefit-quarterly",
    period_key: "2026-Q1",
    is_used: false,
    used_at: null,
  });
  assert.equal(update.compatibilityUsed, false);
});

test("getBenefitUsedForCurrentPeriod reads only the current period row for period-aware cadences", () => {
  const statusMap = buildBenefitPeriodStatusMap([
    { benefit_id: "benefit-quarterly", period_key: "2026-Q2", is_used: true },
    { benefit_id: "benefit-quarterly", period_key: "2026-Q1", is_used: false },
  ]);

  assert.equal(
    getBenefitUsedForCurrentPeriod({
      benefitId: "benefit-quarterly",
      cadence: "quarterly",
      periodStatusMap: statusMap,
      at: new Date("2026-06-10T00:00:00.000Z"),
      fallbackUsed: false,
    }),
    true,
  );

  assert.equal(
    getBenefitUsedForCurrentPeriod({
      benefitId: "benefit-quarterly",
      cadence: "quarterly",
      periodStatusMap: statusMap,
      at: new Date("2026-03-10T00:00:00.000Z"),
      fallbackUsed: true,
    }),
    false,
  );
});
