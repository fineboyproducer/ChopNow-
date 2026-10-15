import { describe, expect, it } from "vitest";
import { applyAlertChange, getAlertState, type AlertRow } from "./alert-meta";

const alert = (over: Partial<AlertRow> = {}): AlertRow => ({
  id: "a1", type: "restaurant_delay", severity: "amber", message: "m", order_id: "o1",
  restaurant_id: null, rider_id: null, created_at: "2026-10-15T08:00:00Z",
  resolved_at: null, resolved_by: null, incident_key: "stage:preparing:1", ...over,
});

describe("getAlertState", () => {
  it("distinguishes active, auto-resolved and staff-resolved", () => {
    expect(getAlertState(alert())).toBe("active");
    expect(getAlertState(alert({ resolved_at: "2026-10-15T09:00:00Z" }))).toBe("auto_resolved");
    expect(getAlertState(alert({ resolved_at: "2026-10-15T09:00:00Z", resolved_by: "u1" }))).toBe("resolved_by_staff");
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
