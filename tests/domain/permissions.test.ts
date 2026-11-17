import { describe, expect, it } from "vitest";
import { decideExpense, decideTimesheet } from "@/lib/domain/approvals";
import {
  canAccessProject,
  canCreateInvoice,
  canEditTimesheet,
  canSubmitTimesheet,
  getAccessibleProjectIds,
} from "@/lib/permissions";
import { createSeedState } from "@/lib/seed";

describe("role permission simulation", () => {
  it("engineer cannot approve timesheets", () => {
    const state = createSeedState();
    const result = decideTimesheet(
      state,
      "ts-riley-w3",
      "emp-eng-riley",
      "approved",
      null
    );
    expect(result.ok).toBe(false);
  });

  it("engineer cannot create invoices", () => {
    expect(canCreateInvoice("engineer")).toBe(false);
    expect(canCreateInvoice("accounting")).toBe(true);
  });

  it("engineer can only edit own draft timesheets", () => {
    expect(
      canEditTimesheet("engineer", "emp-eng-riley", "emp-eng-riley", "draft")
    ).toBe(true);
    expect(
      canEditTimesheet("engineer", "emp-eng-riley", "emp-eng-morgan", "draft")
    ).toBe(false);
    expect(
      canEditTimesheet("engineer", "emp-eng-riley", "emp-eng-riley", "approved")
    ).toBe(false);
  });

  it("engineer cannot submit another employee's timesheet", () => {
    expect(
      canSubmitTimesheet("engineer", "emp-eng-riley", "emp-eng-morgan")
    ).toBe(false);
  });

  it("PM can approve assigned project submissions", () => {
    const state = createSeedState();
    const result = decideTimesheet(
      state,
      "ts-riley-w3",
      "emp-pm",
      "approved",
      null
    );
    expect(result.ok).toBe(true);
  });

  it("PM cannot approve expense without comment on reject", () => {
    const state = createSeedState();
    const result = decideExpense(
      state,
      "exp-morgan-1",
      "emp-pm",
      "rejected",
      ""
    );
    expect(result.ok).toBe(false);
  });

  it("engineer project access is assignment-scoped", () => {
    const state = createSeedState();
    const ids = getAccessibleProjectIds("engineer", "emp-eng-riley", state);
    expect(ids).toContain("proj-bess");
    expect(ids).toContain("proj-spv");
    expect(canAccessProject("engineer", "emp-eng-riley", "proj-bess", state)).toBe(
      true
    );
  });
});
