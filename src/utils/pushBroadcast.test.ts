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

  it("attaches a recap link and drops a blank one", () => {
    expect(
      buildPushRequest(
        {
          ...draft,
          url: " https://traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2 ",
        },
        true
      )
    ).toEqual({
      title: "Week 1 recap",
      body: "Madeline was banished.",
      dryRun: true,
      url: "https://traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2",
    });
    expect(buildPushRequest({ ...draft, url: "   " }, true).url).toBeUndefined();
  });

  it("refuses a link that is not a public recap URL", () => {
    expect(() =>
      buildPushRequest({ ...draft, url: "https://evil.example/recap/week-2" }, false)
    ).toThrow(/recap link/);
  });
});

describe("pushDraftKey", () => {
  it("changes when the text or audience changes", () => {
    expect(pushDraftKey(draft)).not.toBe(pushDraftKey({ ...draft, audience: "all" }));
    expect(pushDraftKey(draft)).not.toBe(
      pushDraftKey({
        ...draft,
        url: "https://traitorsfantasydraft.online/recap/week-2",
      })
    );
    expect(pushDraftKey(draft)).toBe(pushDraftKey({ ...draft, title: "Week 1 recap" }));
  });
});
