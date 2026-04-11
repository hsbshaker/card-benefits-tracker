import assert from "node:assert/strict";
import test from "node:test";
import { getDigestSectionsForMonth, resolveBenefitPeriod } from "@/lib/benefits/periods";

test("resolveBenefitPeriod returns stable period keys", () => {
  const march = new Date("2026-03-15T12:00:00.000Z");
  const july = new Date("2026-07-04T12:00:00.000Z");
  const december = new Date("2026-12-09T12:00:00.000Z");

  assert.deepEqual(resolveBenefitPeriod(march, "monthly"), {
    section: "monthly",
    periodKey: "2026-03",
    isEligibleInDigestMonth: true,
  });
  assert.deepEqual(resolveBenefitPeriod(march, "quarterly"), {
    section: "quarterly",
    periodKey: "2026-Q1",
    isEligibleInDigestMonth: true,
  });
  assert.deepEqual(resolveBenefitPeriod(july, "semi_annual"), {
    section: "semiannual",
    periodKey: "2026-H2",
    isEligibleInDigestMonth: false,
  });
  assert.deepEqual(resolveBenefitPeriod(december, "annual"), {
    section: "annual",
    periodKey: "2026",
    isEligibleInDigestMonth: true,
  });
});

test("getDigestSectionsForMonth matches the monthly digest policy", () => {
  assert.deepEqual(getDigestSectionsForMonth(new Date("2026-01-15T00:00:00.000Z")), ["monthly"]);
  assert.deepEqual(getDigestSectionsForMonth(new Date("2026-03-15T00:00:00.000Z")), ["monthly", "quarterly"]);
  assert.deepEqual(getDigestSectionsForMonth(new Date("2026-06-15T00:00:00.000Z")), ["monthly", "quarterly", "semiannual"]);
  assert.deepEqual(getDigestSectionsForMonth(new Date("2026-12-15T00:00:00.000Z")), [
    "monthly",
    "quarterly",
    "semiannual",
    "annual",
  ]);
});
