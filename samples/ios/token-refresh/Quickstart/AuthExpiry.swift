import Foundation

enum AuthExpiry {
    /// `.valid(remainingMs:)` — token is not expired. `remainingMs` is the number
    /// of milliseconds until expiry, or `nil` if no expiry was provided (treat as
    /// non-expiring; matches the RN sample's "no timer when no date" behavior).
    /// `.expired` — the provided expiry has already elapsed.
    enum Result: Equatable {
        case valid(remainingMs: Int?)
        case expired
    }

    static func evaluate(expiresAt: Date?) -> Result {
        guard let expiresAt else { return .valid(remainingMs: nil) }
        let remaining = expiresAt.timeIntervalSinceNow
        if remaining <= 0 { return .expired }
        return .valid(remainingMs: Int(remaining * 1000))
    }
}
