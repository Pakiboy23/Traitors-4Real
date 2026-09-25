import { describe, expect, it } from "vitest";
import { inferActiveWeekId, resolveActiveWeekId } from "../../types";

describe("resolveActiveWeekId", () => {
  it("prefers the snapshot week when the season row still says week-1", () => {
    expect(
      resolveActiveWeekId({
        activeWeekId: "week-2",
        seasonConfig: { activeWeekId: "week-1" },
        weeklyScoreHistory: [{ id: "w1", label: "Week 1", createdAt: "", totals: {} }],
      })
    ).toBe("week-2");
  });

  it("falls back to the season row when the snapshot has no week", () => {
    expect(
      resolveActiveWeekId({
        activeWeekId: "  ",
        seasonConfig: { activeWeekId: "week-3" },
      })
    ).toBe("week-3");
  });

  it("infers the next week from history when both copies are blank", () => {
    expect(
      resolveActiveWeekId({
        weeklyScoreHistory: [
          { id: "w1", label: "Week 1", createdAt: "", totals: {} },
          { id: "w2", label: "Week 2", createdAt: "", totals: {} },
        ],
      })
    ).toBe("week-3");
    expect(inferActiveWeekId(null)).toBe("week-1");
  });
});
