import Foundation

struct IDTokenClaims {
    var givenName: String?
    var familyName: String?
    var name: String?
    var email: String?
    var sub: String?
}

enum IDToken {
    /// Decodes the middle segment of a JWT and returns the claims we care about for display.
    /// Returns an all-nil struct on any failure (malformed token, missing payload, invalid JSON).
    /// We do not verify the signature here — that's the IdP's job. This is for UX, not auth.
    static func decode(_ token: String) -> IDTokenClaims {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return IDTokenClaims() }
        let payload = String(parts[1])
        guard let data = base64urlDecode(payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return IDTokenClaims() }
        return IDTokenClaims(
            givenName: json["given_name"] as? String,
            familyName: json["family_name"] as? String,
            name: json["name"] as? String,
            email: json["email"] as? String,
            sub: json["sub"] as? String
        )
    }

    /// Picks a friendly display name from the claims. Same precedence as the React Native sample.
    static func welcomeName(_ claims: IDTokenClaims) -> String {
        let combined = [claims.givenName, claims.familyName].compactMap { $0 }.joined(separator: " ")
        if !combined.isEmpty { return combined }
        return claims.name ?? claims.email ?? claims.sub ?? "there"
    }

    private static func base64urlDecode(_ s: String) -> Data? {
        var b64 = s.replacingOccurrences(of: "-", with: "+")
                   .replacingOccurrences(of: "_", with: "/")
        let padCount = (4 - (b64.count % 4)) % 4
        b64 += String(repeating: "=", count: padCount)
        return Data(base64Encoded: b64)
    }
}
