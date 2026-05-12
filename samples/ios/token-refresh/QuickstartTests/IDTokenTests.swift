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
        // Hardcoded JWT whose payload segment exercises ALL base64url quirks at once:
        // - contains `_` (the base64url replacement for `/`)
        // - contains `-` (the base64url replacement for `+`)
        // - is not a multiple of 4 chars long (decoder must restore padding)
        //
        // The payload `eyJzdWIiOiI_Pz8-In0` decodes to {"sub":"???>"}.
        let jwt = "header.eyJzdWIiOiI_Pz8-In0.signature"
        XCTAssertTrue(jwt.contains("_") && jwt.contains("-"),
                      "Hardcoded fixture must keep its URL-safe chars; don't 'tidy' it")
        let claims = IDToken.decode(jwt)
        XCTAssertEqual(claims.sub, "???>")
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
