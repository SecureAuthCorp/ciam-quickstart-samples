import XCTest
@testable import Quickstart

final class AuthConfigTests: XCTestCase {

    func test_buildIssuerURL_saasFormatHostAndPath() {
        let url = AuthConfig.buildIssuerURL(host: "your-tenant.us.connect.secureauth.com",
                                            path: "your-workspace")
        XCTAssertEqual(url?.absoluteString, "https://your-tenant.us.connect.secureauth.com/your-workspace")
    }

    func test_buildIssuerURL_localDevHostWithPortNoPath_noTrailingSlash() {
        let url = AuthConfig.buildIssuerURL(host: "default.acp.localhost:8443", path: "")
        XCTAssertEqual(url?.absoluteString, "https://default.acp.localhost:8443")
    }

    func test_buildIssuerURL_pathWithLeadingOrTrailingSlash_normalized() {
        // Users may paste "/your-workspace" or "your-workspace/" — handle gracefully so
        // the well-known discovery URL doesn't end up with double slashes.
        let url = AuthConfig.buildIssuerURL(host: "host.example", path: "/your-workspace/")
        XCTAssertEqual(url?.absoluteString, "https://host.example/your-workspace")
    }

    func test_buildIssuerURL_pathOnlySlash_treatedAsEmpty() {
        let url = AuthConfig.buildIssuerURL(host: "host.example", path: "/")
        XCTAssertEqual(url?.absoluteString, "https://host.example")
    }

    func test_buildIssuerURL_emptyHost_returnsNil() {
        XCTAssertNil(AuthConfig.buildIssuerURL(host: "", path: ""))
        XCTAssertNil(AuthConfig.buildIssuerURL(host: "", path: "your-workspace"))
    }
}
