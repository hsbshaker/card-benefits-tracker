import assert from "node:assert/strict";
import test from "node:test";
import { filterDigestEligibleBenefits } from "@/lib/reminders/digest-eligibility";

test("filterDigestEligibleBenefits excludes benefits already used for the current period", () => {
  const candidates = [
    {
      userId: "user-1",
      benefitId: "benefit-monthly",
      periodKey: "2026-12",
    },
    {
      userId: "user-1",
      benefitId: "benefit-quarterly",
      periodKey: "2026-Q4",
    },
  ];

  const eligible = filterDigestEligibleBenefits(
    candidates,
    new Set(["user-1:benefit-quarterly:2026-Q4"]),
  );

  assert.deepEqual(
    eligible.map((benefit) => benefit.benefitId),
    ["benefit-monthly"],
  );
});
