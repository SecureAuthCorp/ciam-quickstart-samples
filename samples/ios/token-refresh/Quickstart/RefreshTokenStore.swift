import Foundation
import Security

// @snippet:step4:start
// @description Persist the refresh token in iOS Keychain (kSecClassGenericPassword, kSecAttrAccessibleWhenUnlocked)
struct RefreshTokenStore {
    let service: String

    init(service: String = "com.secureauth.quickstart.ios.refresh") {
        self.service = service
    }

    private var account: String { "refreshToken" }

    func save(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw RefreshTokenStoreError.unexpectedData
        }
        // Try update first (in case an entry exists), fall back to add. Avoids the
        // "duplicate item" error from SecItemAdd when overwriting.
        let updateStatus = SecItemUpdate(matchQuery() as CFDictionary,
                                         [kSecValueData as String: data] as CFDictionary)
        if updateStatus == errSecSuccess { return }
        if updateStatus != errSecItemNotFound {
            throw RefreshTokenStoreError.osStatus(updateStatus)
        }
        var addQuery = matchQuery()
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        if addStatus != errSecSuccess {
            throw RefreshTokenStoreError.osStatus(addStatus)
        }
    }

    func load() throws -> String? {
        var query = matchQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        if status != errSecSuccess {
            throw RefreshTokenStoreError.osStatus(status)
        }
        guard let data = result as? Data, let token = String(data: data, encoding: .utf8) else {
            throw RefreshTokenStoreError.unexpectedData
        }
        return token
    }

    func clear() throws {
        let status = SecItemDelete(matchQuery() as CFDictionary)
        // errSecItemNotFound is fine — clear is idempotent.
        if status != errSecSuccess && status != errSecItemNotFound {
            throw RefreshTokenStoreError.osStatus(status)
        }
    }

    /// Common query attributes shared across save/load/clear.
    /// `kSecUseDataProtectionKeychain: true` opts into the modern data-protection
    /// keychain (iOS 13+), which doesn't require a Keychain Sharing entitlement and
    /// works correctly in unit-test bundles run with code signing disabled.
    private func matchQuery() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }
}

enum RefreshTokenStoreError: Error {
    case osStatus(OSStatus)
    case unexpectedData
}
// @snippet:step4:end
