import UIKit
import Capacitor

// UIKit on iOS 26+ traps at launch if the app has not adopted the scene
// lifecycle, so this class exists to be named by UIApplicationSceneManifest in
// Info.plist. The window and the CAPBridgeViewController root are still built
// from Main.storyboard, which the scene configuration points at.
//
// Capacitor's SceneDelegateProxy is `public`, not `open`, so it cannot be
// subclassed from here. Forward to the shared instance instead — the same shape
// AppDelegate already uses for ApplicationDelegateProxy. Every method below is
// a URL/activity entry point Capacitor needs to see; dropping one silently
// breaks deep links rather than failing the build.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
