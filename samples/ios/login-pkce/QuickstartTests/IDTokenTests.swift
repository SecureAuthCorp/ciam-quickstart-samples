import XCTest
@testable import Quickstart

final class IDTokenTests: XCTestCase {

    // Helper: assemble a JWT-shaped string with the given JSON payload.
    // Header and signature don't matter for the decode — IDToken only reads the middle segment.
    private func makeJWT(payloadJSON: String) -> String {
        let payload = Data(payloadJSON.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "header.\(payload).signature"
    }

    func test_decode_givenAndFamilyName_populatesBoth() {
        let jwt = makeJWT(payloadJSON: #"{"given_name":"Jane","family_name":"Doe"}"#)
        let claims = IDToken.decode(jwt)
        XCTAssertEqual(claims.givenName, "Jane")
        XCTAssertEqual(claims.familyName, "Doe")
        XCTAssertNil(claims.email)
    }

    func test_decode_emailOnly_populatesEmailLeavesNamesNil() {
        let jwt = makeJWT(payloadJSON: #"{"email":"jane@example.com"}"#)
        let claims = IDToken.decode(jwt)
        XCTAssertEqual(claims.email, "jane@example.com")
        XCTAssertNil(claims.givenName)
        XCTAssertNil(claims.familyName)
        XCTAssertNil(claims.name)
    }

    func test_decode_malformedReturnsAllNilClaims() {
        let claims = IDToken.decode("not-a-jwt")
        XCTAssertNil(claims.givenName)
        XCTAssertNil(claims.familyName)
        XCTAssertNil(claims.name)
        XCTAssertNil(claims.email)
        XCTAssertNil(claims.sub)
    }

    func test_decode_base64urlWithDashUnderscoreAndMissingPadding_decodesCorrectly() {
        // Crafts a payload whose base64 encoding contains `+` and `/` chars
        // (which become `-` and `_` in base64url) and is not a multiple of 4 in length.
        // Payload: {"sub":"uÿû"} — non-ASCII bytes ensure `+`/`/` appear in raw base64.
        let raw = #"{"sub":"u\#u{00ff}\#u{00fb}"}"#
        let payload = Data(raw.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        XCTAssertTrue(payload.contains("-") || payload.contains("_"),
                      "Test fixture must include URL-safe chars")
        let jwt = "header.\(payload).signature"
        let claims = IDToken.decode(jwt)
        XCTAssertEqual(claims.sub, "u\u{00ff}\u{00fb}")
    }

    func test_welcomeName_precedence() {
        let bothNames = IDTokenClaims(givenName: "Jane", familyName: "Doe", name: nil, email: nil, sub: nil)
        XCTAssertEqual(IDToken.welcomeName(bothNames), "Jane Doe")

        let nameOnly = IDTokenClaims(givenName: nil, familyName: nil, name: "Jane Doe", email: nil, sub: nil)
        XCTAssertEqual(IDToken.welcomeName(nameOnly), "Jane Doe")

        let emailOnly = IDTokenClaims(givenName: nil, familyName: nil, name: nil, email: "j@x.com", sub: nil)
        XCTAssertEqual(IDToken.welcomeName(emailOnly), "j@x.com")

        let subOnly = IDTokenClaims(givenName: nil, familyName: nil, name: nil, email: nil, sub: "u1")
        XCTAssertEqual(IDToken.welcomeName(subOnly), "u1")

        let nothing = IDTokenClaims(givenName: nil, familyName: nil, name: nil, email: nil, sub: nil)
        XCTAssertEqual(IDToken.welcomeName(nothing), "there")
    }
}
