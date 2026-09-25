import { describe, expect, it } from "vitest";
import { buildPushRequest, pushDraftKey } from "./pushBroadcast";

const draft = {
  title: "  Week 1 recap  ",
  body: " Madeline was banished. ",
  audience: "season" as const,
};

describe("buildPushRequest", () => {
  it("trims copy and omits audience when sending to the live season", () => {
    expect(buildPushRequest(draft, true)).toEqual({
      title: "Week 1 recap",
      body: "Madeline was banished.",
      dryRun: true,
    });
  });

  it("marks a live send to every registered phone", () => {
    expect(buildPushRequest({ ...draft, audience: "all" }, false)).toEqual({
      title: "Week 1 recap",
      body: "Madeline was banished.",
      audience: "all",
    });
  });

  it("refuses a blank title or message", () => {
    expect(() => buildPushRequest({ ...draft, title: "   " }, false)).toThrow(
      /title and a message/
    );
  });
});

describe("pushDraftKey", () => {
  it("changes when the text or audience changes", () => {
    expect(pushDraftKey(draft)).not.toBe(pushDraftKey({ ...draft, audience: "all" }));
    expect(pushDraftKey(draft)).toBe(pushDraftKey({ ...draft, title: "Week 1 recap" }));
  });
});
