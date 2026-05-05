import XCTest
@testable import Quickstart

final class AuthExpiryTests: XCTestCase {

    func test_evaluate_pastExpiry_returnsExpired() {
        let past = Date().addingTimeInterval(-60)
        switch AuthExpiry.evaluate(expiresAt: past) {
        case .expired: break
        case .valid:
            XCTFail("Past expiry should be .expired, got .valid")
        }
    }

    func test_evaluate_futureExpiry_returnsValidWithRemainingMs() {
        let future = Date().addingTimeInterval(30)
        switch AuthExpiry.evaluate(expiresAt: future) {
        case .valid(let remainingMs):
            XCTAssertNotNil(remainingMs)
            XCTAssertEqual(remainingMs ?? 0, 30_000, accuracy: 100)
        case .expired:
            XCTFail("Future expiry should be .valid")
        }
    }

    func test_evaluate_nilExpiry_returnsValidWithNoRemainingMs() {
        switch AuthExpiry.evaluate(expiresAt: nil) {
        case .valid(let remainingMs):
            XCTAssertNil(remainingMs)
        case .expired:
            XCTFail("Nil expiry should be .valid (treat as non-expiring)")
        }
    }
}
