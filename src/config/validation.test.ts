import { describe, expect, it } from "vitest";
import { sanitizeShowConfig } from "./validation";
import { DEFAULT_SHOW_CONFIG } from "./defaultShowConfig";

describe("sanitizeShowConfig", () => {
  it("keeps a league name that was set", () => {
    // The league name is what players see. It is stored separately from the
    // show name because the two answer to different audiences, and only the
    // show name is public on the App Store.
    expect(sanitizeShowConfig({ leagueName: "UPRV Fantasy League" }).leagueName).toBe(
      "UPRV Fantasy League"
    );
  });

  it("falls back to the default when none is stored", () => {
    // Every config saved before this field existed has no leagueName, and must
    // not come back as an empty string in the header.
    expect(sanitizeShowConfig({}).leagueName).toBe(DEFAULT_SHOW_CONFIG.leagueName);
    expect(sanitizeShowConfig({ leagueName: 42 }).leagueName).toBe(
      DEFAULT_SHOW_CONFIG.leagueName
    );
  });

  it("survives a save round-trip", () => {
    // The admin panel rebuilds the config with a spread of the parsed value, so
    // a field this parser drops is a field the next save deletes.
    const saved = sanitizeShowConfig({ leagueName: "UPRV Fantasy League" });
    expect(sanitizeShowConfig({ ...saved }).leagueName).toBe("UPRV Fantasy League");
  });

  it("no longer defaults to the previous season's branding", () => {
    const config = sanitizeShowConfig({});
    expect(config.showName).toBe("Round Table Draft");
    // The listing name and the binary's display name have to match, and neither
    // may carry the programme's mark.
    expect(JSON.stringify(config)).not.toMatch(/Traitors/i);
  });
});
