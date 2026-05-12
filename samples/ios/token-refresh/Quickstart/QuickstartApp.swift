import SwiftUI

@main
struct QuickstartApp: App {
    @StateObject private var auth = AuthClient()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .task {
                    // Best-effort silent re-login if a refresh token is in Keychain.
                    await auth.bootstrapFromStoredToken()
                }
        }
    }
}
