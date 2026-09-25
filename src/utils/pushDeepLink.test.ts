import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRecapDeepLink, sanitizePushDeepLink } from "./pushDeepLink";

describe("sanitizePushDeepLink", () => {
  it("keeps an https recap URL on the public host", () => {
    expect(
      sanitizePushDeepLink(
        "https://traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2"
      )
    ).toBe("https://traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2");
  });

  it("rejects other hosts, schemes, and paths", () => {
    expect(sanitizePushDeepLink("https://evil.example/recap/week-2")).toBeNull();
    expect(sanitizePushDeepLink("http://traitorsfantasydraft.online/recap/week-2")).toBeNull();
    expect(sanitizePushDeepLink("https://traitorsfantasydraft.online/admin")).toBeNull();
    expect(sanitizePushDeepLink("")).toBeNull();
    expect(sanitizePushDeepLink(undefined)).toBeNull();
  });
});

describe("parseRecapDeepLink", () => {
  it("reads season and week from the canonical path", () => {
    expect(
      parseRecapDeepLink(
        "https://www.traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2?utm=chat"
      )
    ).toEqual({
      seasonId: "traitors-new-blood-s1",
      weekId: "week-2",
      url: "https://www.traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2?utm=chat",
    });
  });

  it("treats a single segment as the week id", () => {
    expect(
      parseRecapDeepLink("https://traitorsfantasydraft.online/recap/week-2")
    ).toEqual({
      seasonId: null,
      weekId: "week-2",
      url: "https://traitorsfantasydraft.online/recap/week-2",
    });
  });
});

describe("send-lock-reminder deep link", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../../supabase/functions/send-lock-reminder/index.ts"),
    "utf8"
  );

  it("accepts an optional url and only forwards a recap link on the public host", () => {
    expect(source).toContain("url?: string");
    expect(source).toContain("traitorsfantasydraft.online");
    expect(source).toContain("/recap/");
    expect(source).toContain("sanitizeDeepLink");
  });
});