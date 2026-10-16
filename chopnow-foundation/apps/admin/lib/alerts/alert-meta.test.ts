import { describe, expect, it } from "vitest";
import { ALERT_STATE_LABELS, SUPERSEDED_EXPLANATION, applyAlertChange, getAlertState, getAlertTitle, type AlertRow } from "./alert-meta";

const alert = (over: Partial<AlertRow> = {}): AlertRow => ({
  id: "a1", type: "restaurant_delay", severity: "amber", message: "m", order_id: "o1",
  restaurant_id: null, rider_id: null, created_at: "2026-10-15T08:00:00Z",
  resolved_at: null, resolved_by: null, incident_key: "stage:preparing:1", title: "Preparation taking longer", resolution_reason: null, ...over,
});

describe("getAlertState", () => {
  it("distinguishes active, auto-resolved and staff-resolved", () => {
    expect(getAlertState(alert())).toBe("active");
    expect(getAlertState(alert({ resolved_at: "2026-10-15T09:00:00Z" }))).toBe("auto_resolved");
    expect(getAlertState(alert({ resolved_at: "2026-10-15T09:00:00Z", resolved_by: "u1" }))).toBe("resolved_by_staff");
    expect(getAlertState(alert({ resolved_at: "2026-10-15T09:00:00Z", resolution_reason: "superseded" }))).toBe("superseded");
    // a human resolution always wins over the reason
    expect(getAlertState(alert({ resolved_at: "2026-10-15T09:00:00Z", resolved_by: "u1", resolution_reason: "superseded" }))).toBe("resolved_by_staff");
  });

  it("labels a superseded alert distinctly and never as resolved", () => {
    expect(ALERT_STATE_LABELS.superseded).toBe("Superseded by Customer waiting too long");
    expect(ALERT_STATE_LABELS.superseded).not.toMatch(/resolved/i);
    expect(SUPERSEDED_EXPLANATION).toMatch(/still delayed/);
  });
});

describe("getAlertTitle", () => {
  it("prefers the generator's headline and falls back to the category label", () => {
    expect(getAlertTitle(alert())).toBe("Preparation taking longer");
    expect(getAlertTitle(alert({ title: null, type: "paid_order_stuck" }))).toBe("Payment");
    expect(getAlertTitle(alert({ title: null, type: "high_demand" }))).toBe("High demand");
  });
});

describe("applyAlertChange", () => {
  it("adds a new alert once even if delivered twice", () => {
    const once = applyAlertChange({ active: [], resolved: [] }, alert());
    const twice = applyAlertChange(once, alert());
    expect(twice.active).toHaveLength(1);
  });

  it("moves an alert to resolved when it is resolved", () => {
    const start = { active: [alert()], resolved: [] };
    const next = applyAlertChange(start, alert({ resolved_at: "2026-10-15T09:00:00Z" }));
    expect(next.active).toHaveLength(0);
    expect(next.resolved).toHaveLength(1);
  });

  it("moves a reopened alert from resolved back to active", () => {
    const start = { active: [], resolved: [alert({ resolved_at: "2026-10-15T09:00:00Z" })] };
    const next = applyAlertChange(start, alert());
    expect(next.active.map((a) => a.id)).toEqual(["a1"]);
    expect(next.resolved).toHaveLength(0);
  });

  it("keeps newest alerts first and caps the resolved list", () => {
    let lists = { active: [] as AlertRow[], resolved: [] as AlertRow[] };
    for (let i = 0; i < 25; i++) {
      lists = applyAlertChange(lists, alert({ id: `r${i}`, resolved_at: `2026-10-15T09:${String(i).padStart(2, "0")}:00Z` }));
    }
    expect(lists.resolved).toHaveLength(20);
    expect(lists.resolved[0]!.id).toBe("r24");
  });
});
