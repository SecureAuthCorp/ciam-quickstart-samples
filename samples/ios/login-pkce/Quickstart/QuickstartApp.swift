import SwiftUI

@main
struct QuickstartApp: App {
    @StateObject private var auth = AuthClient()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
        }
    }
}
