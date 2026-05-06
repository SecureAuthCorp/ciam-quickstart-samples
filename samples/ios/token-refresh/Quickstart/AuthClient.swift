import UIKit

// @snippet:step1:start
// @description Import AppAuth, Foundation, and Security (the Keychain backend)
import AppAuth
import Foundation
import Security
// @snippet:step1:end

// @snippet:step2:start
// @description Configure the OIDC client — `offline_access` (set in Config.xcconfig) enables refresh tokens
private func plist(_ key: String) -> String {
    Bundle.main.object(forInfoDictionaryKey: key) as? String ?? ""
}

struct AuthConfig {
    static let issuer = AuthConfig.buildIssuerURL(host: plist("CIAM_ISSUER_HOST"),
                                                  path: plist("CIAM_ISSUER_PATH"))
    static let clientId    = plist("CIAM_CLIENT_ID")
    static let redirectURI: URL? = {
        let scheme = plist("CIAM_REDIRECT_SCHEME")
        guard !scheme.isEmpty else { return nil }
        return URL(string: "\(scheme)://oauthredirect")
    }()
    static let scopes      = plist("CIAM_SCOPES").split(separator: " ").map(String.init)

    static func buildIssuerURL(host: String, path: String) -> URL? {
        guard !host.isEmpty else { return nil }
        let trimmedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let urlString = trimmedPath.isEmpty ? "https://\(host)" : "https://\(host)/\(trimmedPath)"
        return URL(string: urlString)
    }
}
// @snippet:step2:end

struct Tokens {
    let accessToken: String
    let accessTokenExpirationDate: Date?
    let refreshToken: String?
    let idToken: String?
}

@MainActor
final class AuthClient: ObservableObject {
    @Published private(set) var tokens: Tokens?
    @Published private(set) var error: String?

    private let store = RefreshTokenStore()
    private var pendingSession: OIDExternalUserAgentSession?
    private var refreshTimer: Task<Void, Never>?

    // @snippet:step3:start
    // @description Trigger login with offline_access and capture the refresh token
    func signIn(presenting: UIViewController) async {
        error = nil
        do {
            guard let issuer = AuthConfig.issuer else {
                throw AuthError.misconfigured("CIAM_ISSUER_HOST is missing — fill in Config.xcconfig")
            }
            guard !AuthConfig.clientId.isEmpty else {
                throw AuthError.misconfigured("CIAM_CLIENT_ID is missing — fill in Config.xcconfig")
            }
            guard let redirectURI = AuthConfig.redirectURI else {
                throw AuthError.misconfigured("CIAM_REDIRECT_SCHEME is missing — fill in Config.xcconfig")
            }
            let config = try await discoverConfiguration(forIssuer: issuer)
            let request = OIDAuthorizationRequest(
                configuration: config,
                clientId: AuthConfig.clientId,
                scopes: AuthConfig.scopes,
                redirectURL: redirectURI,
                responseType: OIDResponseTypeCode,
                additionalParameters: nil
            )
            let authState = try await authStateByPresenting(request: request, presenting: presenting)
            let next = AuthClient.makeTokens(from: authState.lastTokenResponse, fallback: nil)
            tokens = next
            if let refresh = next?.refreshToken {
                try? store.save(refresh)
            }
            scheduleRefreshTimer()
        } catch {
            self.error = error.localizedDescription
        }
    }
    // @snippet:step3:end

    // @snippet:step5:start
    // @description Exchange the refresh token for a new access token; on failure clear local state and require re-login
    func refreshTokens() async {
        error = nil
        guard let issuer = AuthConfig.issuer else {
            error = "CIAM_ISSUER_HOST is missing — fill in Config.xcconfig"
            return
        }
        let storedRefresh: String?
        if let inMemory = tokens?.refreshToken, !inMemory.isEmpty {
            storedRefresh = inMemory
        } else {
            storedRefresh = (try? store.load()).flatMap { $0.isEmpty ? nil : $0 }
        }
        guard let stored = storedRefresh else {
            error = "No refresh token available. Sign in first."
            return
        }
        do {
            let config = try await discoverConfiguration(forIssuer: issuer)
            let request = OIDTokenRequest(
                configuration: config,
                grantType: OIDGrantTypeRefreshToken,
                authorizationCode: nil,
                redirectURL: nil,
                clientID: AuthConfig.clientId,
                clientSecret: nil,
                scope: nil,
                refreshToken: stored,
                codeVerifier: nil,
                additionalParameters: nil
            )
            let response = try await performTokenRequest(request)
            let next = AuthClient.makeTokens(from: response, fallback: tokens)
            tokens = next
            if let newRefresh = next?.refreshToken, newRefresh != stored {
                try? store.save(newRefresh)
            }
            scheduleRefreshTimer()
        } catch {
            // Refresh tokens can be revoked or expire — clear local state and force re-login.
            try? store.clear()
            tokens = nil
            refreshTimer?.cancel()
            self.error = "Refresh failed (\(error.localizedDescription)). Sign in again."
        }
    }
    // @snippet:step5:end

    func signOut() async {
        if let access = tokens?.accessToken {
            try? await revokeToken(access)
        }
        try? store.clear()
        refreshTimer?.cancel()
        tokens = nil
        error = nil
    }

    /// Best-effort silent re-login on launch. If a refresh token is in Keychain,
    /// exchange it for a new access token without going through the system browser.
    /// On failure, clear Keychain and stay signed-out (no error displayed).
    func bootstrapFromStoredToken() async {
        guard tokens == nil else { return }
        guard let stored = (try? store.load()).flatMap({ $0.isEmpty ? nil : $0 }) else { return }
        guard let issuer = AuthConfig.issuer else { return }
        do {
            let config = try await discoverConfiguration(forIssuer: issuer)
            let request = OIDTokenRequest(
                configuration: config,
                grantType: OIDGrantTypeRefreshToken,
                authorizationCode: nil,
                redirectURL: nil,
                clientID: AuthConfig.clientId,
                clientSecret: nil,
                scope: nil,
                refreshToken: stored,
                codeVerifier: nil,
                additionalParameters: nil
            )
            let response = try await performTokenRequest(request)
            // Re-check after the network round-trip — the user may have tapped Sign In meanwhile.
            guard tokens == nil else { return }
            let next = AuthClient.makeTokens(from: response, fallback: nil)
            tokens = next
            if let newRefresh = next?.refreshToken, newRefresh != stored {
                try? store.save(newRefresh)
            }
            scheduleRefreshTimer()
        } catch {
            // Stored token is no longer valid — let the user sign in.
            try? store.clear()
        }
    }

    func errorOverride(_ message: String) {
        self.error = message
    }

    // MARK: - Auto-refresh timer

    private func scheduleRefreshTimer() {
        refreshTimer?.cancel()
        guard let expiresAt = tokens?.accessTokenExpirationDate else { return }
        switch AuthExpiry.evaluate(expiresAt: expiresAt) {
        case .expired:
            // Already past expiry — refresh immediately.
            refreshTimer = Task { [weak self] in
                await self?.refreshTokens()
            }
        case .valid(let remainingMs):
            guard let remainingMs else { return }
            refreshTimer = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(remainingMs) * 1_000_000)
                guard !Task.isCancelled else { return }
                await self?.refreshTokens()
            }
        }
    }

    // MARK: - Token projection

    private static func makeTokens(from response: OIDTokenResponse?, fallback: Tokens?) -> Tokens? {
        guard let response, let access = response.accessToken else { return fallback }
        return Tokens(
            accessToken: access,
            accessTokenExpirationDate: response.accessTokenExpirationDate,
            // Refresh responses sometimes omit a fresh refresh token (rotation disabled) or id token —
            // fall back to the previously-known values so display state stays populated.
            refreshToken: response.refreshToken ?? fallback?.refreshToken,
            idToken: response.idToken ?? fallback?.idToken
        )
    }

    // MARK: - async wrappers around AppAuth's callback APIs (kept outside snippet tags
    // so dashboard readers see only the OIDC essentials in step3/step5)

    private func discoverConfiguration(forIssuer issuer: URL) async throws -> OIDServiceConfiguration {
        try await withCheckedThrowingContinuation { cont in
            OIDAuthorizationService.discoverConfiguration(forIssuer: issuer) { config, error in
                if let config { cont.resume(returning: config) }
                else { cont.resume(throwing: error ?? AuthError.unknown) }
            }
        }
    }

    private func authStateByPresenting(request: OIDAuthorizationRequest,
                                       presenting: UIViewController) async throws -> OIDAuthState {
        try await withCheckedThrowingContinuation { cont in
            // AppAuth's external-user-agent session must be retained for the duration
            // of the flow, so we store it on the AuthClient instance — releasing it
            // in the completion would let it be deallocated mid-redirect.
            self.pendingSession = OIDAuthState.authState(byPresenting: request, presenting: presenting) { [weak self] authState, error in
                self?.pendingSession = nil
                if let authState { cont.resume(returning: authState) }
                else { cont.resume(throwing: error ?? AuthError.unknown) }
            }
        }
    }

    private func performTokenRequest(_ request: OIDTokenRequest) async throws -> OIDTokenResponse {
        try await withCheckedThrowingContinuation { cont in
            OIDAuthorizationService.perform(request) { response, error in
                if let response { cont.resume(returning: response) }
                else { cont.resume(throwing: error ?? AuthError.unknown) }
            }
        }
    }

    private func revokeToken(_ token: String) async throws {
        guard let issuer = AuthConfig.issuer else { return }
        let config = try await discoverConfiguration(forIssuer: issuer)
        guard let revokeURLString = config.discoveryDocument?.discoveryDictionary["revocation_endpoint"] as? String,
              let revokeURL = URL(string: revokeURLString) else { return }
        var req = URLRequest(url: revokeURL)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let bodyParts = [
            "token=\(urlEncode(token))",
            "client_id=\(urlEncode(AuthConfig.clientId))"
        ]
        req.httpBody = bodyParts.joined(separator: "&").data(using: .utf8)
        _ = try await URLSession.shared.data(for: req)
    }

    private func urlEncode(_ s: String) -> String {
        // application/x-www-form-urlencoded body — must escape +, &, =, /, etc.
        // .urlQueryAllowed is too permissive (lets `+` through, which decodes to space
        // on the server, silently breaking revocation for base64-derived tokens).
        s.addingPercentEncoding(withAllowedCharacters: AuthClient.formURLEncodedAllowed) ?? s
    }

    private static let formURLEncodedAllowed: CharacterSet = {
        var set = CharacterSet.alphanumerics
        set.insert(charactersIn: "*-._")
        return set
    }()
}

enum AuthError: LocalizedError {
    case unknown
    case misconfigured(String)

    var errorDescription: String? {
        switch self {
        case .unknown: return "Unknown error"
        case .misconfigured(let msg): return msg
        }
    }
}
