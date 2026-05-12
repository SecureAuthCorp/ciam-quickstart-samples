import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject private var auth: AuthClient

    var body: some View {
        VStack(spacing: 16) {
            Text("SecureAuth iOS Token Refresh Demo")
                .font(.title2.weight(.semibold))
                .padding(.bottom, 8)

            if let message = auth.error {
                ErrorBanner(message: message)
            }

            if let tokens = auth.tokens {
                signedInView(tokens: tokens)
            } else {
                Button("Sign in", action: signIn)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func signedInView(tokens: Tokens) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(welcomeText(from: tokens))
                .font(.headline)
            if let expiresAt = tokens.accessTokenExpirationDate {
                Text("Access token expires: \(expiresAt.formatted(date: .abbreviated, time: .standard))")
                    .font(.subheadline)
            }
            Text("Refresh token stored: \(tokens.refreshToken == nil ? "no" : "yes")")
                .font(.subheadline)
            Spacer().frame(height: 8)
            Button("Refresh token now", action: refreshNow)
                .buttonStyle(.borderedProminent)
            Button("Sign out", action: signOut)
                .buttonStyle(.bordered)
        }
    }

    private func welcomeText(from tokens: Tokens) -> String {
        // Try id_token first, then access_token (some IdPs return only an opaque/JWT
        // access token without an id_token). Mirrors the RN sample's fallback chain.
        for candidate in [tokens.idToken, tokens.accessToken] {
            guard let token = candidate else { continue }
            let claims = IDToken.decode(token)
            let name = IDToken.welcomeName(claims)
            if name != "there" { return "Welcome, \(name)!" }
        }
        return "Welcome, there!"
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

    private func refreshNow() {
        Task { await auth.refreshTokens() }
    }

    private func signOut() {
        Task { await auth.signOut() }
    }

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

    var body: some View {
        Text(message)
            .foregroundColor(.red)
            .multilineTextAlignment(.center)
            .padding()
            .background(Color.red.opacity(0.1))
            .cornerRadius(8)
    }
}
