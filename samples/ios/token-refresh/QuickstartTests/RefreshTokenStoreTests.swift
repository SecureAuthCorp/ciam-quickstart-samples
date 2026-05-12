import XCTest
@testable import Quickstart

final class RefreshTokenStoreTests: XCTestCase {
    var store: RefreshTokenStore!

    override func setUpWithError() throws {
        // Per-suite service id so we don't collide with the app's real Keychain entry
        // when running the test bundle on the same simulator.
        store = RefreshTokenStore(service: "com.secureauth.quickstart.ios.refresh.tests")
        try store.clear()
    }

    override func tearDownWithError() throws {
        try store.clear()
    }

    func test_load_returnsNil_whenNothingStored() throws {
        XCTAssertNil(try store.load())
    }

    func test_save_thenLoad_roundTrips() throws {
        try store.save("rt_abc123")
        XCTAssertEqual(try store.load(), "rt_abc123")
    }

    func test_save_overwritesExisting() throws {
        try store.save("rt_abc123")
        try store.save("rt_xyz789")
        XCTAssertEqual(try store.load(), "rt_xyz789")
    }

    func test_clear_removesEntry() throws {
        try store.save("rt_abc123")
        try store.clear()
        XCTAssertNil(try store.load())
    }
}
