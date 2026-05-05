import UIKit

// @snippet:step1:start
// @description Import AppAuth and Foundation
import AppAuth
import Foundation
// @snippet:step1:end

// @snippet:step2:start
// @description Configure the OIDC client with your SecureAuth app settings
private func plist(_ key: String) -> String {
    Bundle.main.object(forInfoDictionaryKey: key) as? String ?? ""
}

struct AuthConfig {
    static let issuer = AuthConfig.buildIssuerURL(host: plist("CIAM_ISSUER_HOST"),
                                                  path: plist("CIAM_ISSUER_PATH"))!
    static let clientId    = plist("CIAM_CLIENT_ID")
    static let redirectURI = URL(string: "\(plist("CIAM_REDIRECT_SCHEME"))://oauthredirect")!
    static let scopes      = plist("CIAM_SCOPES").split(separator: " ").map(String.init)

    /// Combines an issuer host (which may include a port) with an optional workspace path.
    /// Path is optional — local dev IdPs (e.g. `default.acp.localhost:8443`) have no
    /// workspace component, while SaaS issuers do. Avoid a trailing slash so that
    /// `<issuer>/.well-known/openid-configuration` doesn't become `//.well-known/...`.
    static func buildIssuerURL(host: String, path: String) -> URL? {
        let trimmedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let urlString = trimmedPath.isEmpty ? "https://\(host)" : "https://\(host)/\(trimmedPath)"
        return URL(string: urlString)
    }
}
// @snippet:step2:end

@MainActor
final class AuthClient: ObservableObject {
    @Published private(set) var state: OIDAuthState?
    @Published private(set) var error: String?
    @Published private(set) var expired: Bool = false

    private var expiryTask: Task<Void, Never>?
    private var pendingSession: OIDExternalUserAgentSession?

    // @snippet:step3:start
    // @description Open ASWebAuthenticationSession, run Auth Code + PKCE, and receive tokens
    func signIn(presenting: UIViewController) async {
        error = nil
        expired = false
        do {
            let config = try await discoverConfiguration(forIssuer: AuthConfig.issuer)
            let request = OIDAuthorizationRequest(
                configuration: config,
                clientId: AuthConfig.clientId,
                scopes: AuthConfig.scopes,
                redirectURL: AuthConfig.redirectURI,
                responseType: OIDResponseTypeCode,
                additionalParameters: nil
            )
            let authState = try await authStateByPresenting(request: request, presenting: presenting)
            state = authState
            scheduleExpiryTimer()
        } catch {
            self.error = error.localizedDescription
        }
    }
    // @snippet:step3:end

    // @snippet:step4:start
    // @description Revoke the access token at the IdP and clear local auth state
    func signOut() async {
        if let token = state?.lastTokenResponse?.accessToken {
            try? await revokeToken(token)  // best-effort — proceed with local logout regardless
        }
        state = nil
        expired = false
        expiryTask?.cancel()
    }
    // @snippet:step4:end

    // MARK: - Expiry timer (matches RN's useEffect that flips to "Session expired")

    private func scheduleExpiryTimer() {
        expiryTask?.cancel()
        guard let expiresAt = state?.lastTokenResponse?.accessTokenExpirationDate else { return }
        switch AuthExpiry.evaluate(expiresAt: expiresAt) {
        case .expired:
            state = nil
            expired = true
        case .valid(let remainingMs):
            guard let remainingMs else { return }
            expiryTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(remainingMs) * 1_000_000)
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    self?.state = nil
                    self?.expired = true
                }
            }
        }
    }

    // MARK: - async wrappers around AppAuth's callback APIs (kept outside snippet tags
    // so dashboard readers see only the OIDC essentials in step3/step4)

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

    private func revokeToken(_ token: String) async throws {
        let config = try await discoverConfiguration(forIssuer: AuthConfig.issuer)
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

    func errorOverride(_ message: String) {
        self.error = message
    }
}

enum AuthError: Error {
    case unknown
}
