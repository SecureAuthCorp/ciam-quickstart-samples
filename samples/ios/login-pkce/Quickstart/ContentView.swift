import SwiftUI
import UIKit
import AppAuth

struct ContentView: View {
    @EnvironmentObject private var auth: AuthClient

    var body: some View {
        VStack(spacing: 16) {
            Text("SecureAuth iOS PKCE Demo")
                .font(.title2.weight(.semibold))
                .padding(.bottom, 8)

            if let message = auth.error {
                ErrorBanner(message: message, retry: signIn)
            } else if let state = auth.state, let response = state.lastTokenResponse {
                signedInView(response: response)
            } else {
                signedOutView
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var signedOutView: some View {
        VStack(spacing: 12) {
            if auth.expired {
                Text("Session expired. Please sign in again.")
                    .foregroundColor(.red)
            }
            Button("Sign in", action: signIn)
                .buttonStyle(.borderedProminent)
        }
    }

    private func signedInView(response: OIDTokenResponseType) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(welcomeText(idToken: response.idToken))
                .font(.headline)
            if let expiresAt = response.accessTokenExpirationDate {
                Text("Access token expires: \(expiresAt.formatted(date: .abbreviated, time: .standard))")
                    .font(.subheadline)
            }
            Spacer().frame(height: 8)
            Button("Sign out", action: signOut)
                .buttonStyle(.bordered)
        }
    }

    private func welcomeText(idToken: String?) -> String {
        guard let idToken else { return "Welcome, there!" }
        return "Welcome, \(IDToken.welcomeName(IDToken.decode(idToken)))!"
    }

    // MARK: - Actions

    private func signIn() {
        Task { @MainActor in
            guard let presenter = topViewController() else {
                auth.errorOverride("No presenter available")
                return
            }
            await auth.signIn(presenting: presenter)
        }
    }

    private func signOut() {
        Task { await auth.signOut() }
    }

    /// Walks the active scene's root view controller chain to find one that can present
    /// the AppAuth ASWebAuthenticationSession. ContentView lives in a SwiftUI hierarchy,
    /// so we reach into UIKit for the presenting controller.
    private func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

private struct ErrorBanner: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Text("Error: \(message)")
                .foregroundColor(.red)
                .multilineTextAlignment(.center)
            Button("Try again", action: retry)
        }
        .padding()
        .background(Color.red.opacity(0.1))
        .cornerRadius(8)
    }
}

// AppAuth's OIDTokenResponse type — typealiased so SwiftUI signatures don't have
// to mention it directly throughout.
typealias OIDTokenResponseType = OIDTokenResponse
