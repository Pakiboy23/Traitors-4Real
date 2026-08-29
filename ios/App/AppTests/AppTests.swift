import XCTest

final class AppTests: XCTestCase {

    // Guards the regression documented in CLAUDE.md: `ios/App/App/public` is a
    // folder reference in Copy Bundle Resources, and Xcode drops a missing
    // folder from the build silently rather than failing it. That shipped once
    // — a TestFlight build with no web assets that installed, showed the
    // launch screen, and exited immediately. verify-web-assets.sh catches this
    // at archive time; this catches it at test time too.
    func testWebAssetsArePresentInBundle() throws {
        let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public")
        XCTAssertNotNil(indexURL, "public/index.html is missing from the app bundle — the archive would ship with no web app")
    }

    // A committed capacitor.config.json with `server.url` set re-adds a
    // live-site fetch, which is exactly what App Store Review Guideline 4.2
    // rejects (see `npm run ios:sync:bundled` in CLAUDE.md).
    func testCapacitorConfigHasNoServerURL() throws {
        guard let configURL = Bundle.main.url(forResource: "capacitor.config", withExtension: "json") else {
            XCTFail("capacitor.config.json is missing from the app bundle")
            return
        }
        let data = try Data(contentsOf: configURL)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let server = json?["server"] as? [String: Any]
        XCTAssertNil(server?["url"], "capacitor.config.json has server.url set — this ships a shell that loads the live site instead of the bundled web app")
    }
}
