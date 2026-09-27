import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const admin = readFileSync(path.join(repoRoot, "components/AdminPanel.tsx"), "utf8");
const css = readFileSync(path.join(repoRoot, "src/index.css"), "utf8");

const media1200 = css.slice(css.indexOf("@media (max-width: 1200px)"));
const nextMedia = media1200.indexOf("@media", 10);
const query = nextMedia === -1 ? media1200 : media1200.slice(0, nextMedia);

describe("admin send notification entry", () => {
  it("puts Send a notification on the admin header and in quick actions", () => {
    expect(admin.match(/Send a notification/g)?.length).toBeGreaterThanOrEqual(2);
    expect(admin.match(/setActiveSection\("notifications"\)/g)?.length).toBeGreaterThanOrEqual(2);
    const notifications = admin.indexOf('id: "notifications"');
    const operations = admin.indexOf('id: "operations"');
    expect(notifications).toBeGreaterThan(-1);
    expect(notifications).toBeLessThan(operations);
  });

  it("shows the section tabs in the same range that hides the sidebar", () => {
    expect(query).toMatch(/\.admin-console-left\s*\{[^}]*display:\s*none/);
    expect(query).toMatch(/\.admin-section-tabs\s*\{[^}]*display:\s*block/);
    expect(admin).toContain('className="admin-section-tabs"');
    expect(admin).not.toContain("lg:hidden");
    expect(admin).not.toContain("hidden lg:block");
  });
});
