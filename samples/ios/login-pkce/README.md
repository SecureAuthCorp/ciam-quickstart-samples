# iOS — Login with PKCE

Minimal iOS app demonstrating OIDC login using Authorization Code + PKCE via [AppAuth-iOS](https://github.com/openid/AppAuth-iOS). The system browser (`ASWebAuthenticationSession`) handles the auth UI — never an embedded `WKWebView`.

## Prerequisites

- Xcode 15.3 or later
- iOS 16+ deployment target (already configured)
- An iPhone simulator runtime (Xcode → Settings → Platforms)
- Optional, only if you change the project structure: [xcodegen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

## Setup

1. Copy `Config.example.xcconfig` to `Config.xcconfig` and fill in your SecureAuth values:
   - `CLIENT_ID` — the OAuth client ID
   - `ISSUER_HOST` — host (and port if needed) of your issuer (e.g. `your-tenant.us.connect.secureauth.com`)
   - `ISSUER_PATH` — workspace path of your issuer (e.g. `your-workspace`).
   - `REDIRECT_SCHEME` — leave as `com.secureauth.quickstart.ios.login` (must match the scheme in `Quickstart/Info.plist` and your CIAM-side redirect URI)
   - `SCOPES` — space-separated list (e.g. `openid profile email`)
2. In CIAM admin UI, register the redirect URI exactly: `com.secureauth.quickstart.ios.login://oauthredirect`
3. Open `Quickstart.xcodeproj` in Xcode
4. Select an iPhone simulator (e.g. iPhone 16) and press ⌘R

## What this demonstrates

- OIDC configuration with PKCE on a public mobile client (no client secret)
- System browser–driven login (`ASWebAuthenticationSession` — no embedded WebView)
- Auth Code + PKCE token exchange
- Local logout via `revoke()` + clearing app state
- Access-token expiry detection that flips the UI to "Session expired" without re-prompting silently

## Notes

- The issuer is split into `ISSUER_HOST` + `ISSUER_PATH` because xcconfig treats `//` as a comment marker. Swift rebuilds `https://HOST/PATH` at startup.
- The redirect URI is a custom URL scheme registered in `Quickstart/Info.plist` (`CFBundleURLTypes`). The CIAM-side registration must match exactly.
- Editing `Config.xcconfig` requires a clean build (Cmd-Shift-K then Cmd-R). `Info.plist` is preprocessed at build time, so xcconfig changes only take effect on rebuild.
- The committed `Quickstart.xcodeproj` is generated from `project.yml` via [xcodegen](https://github.com/yonaskolb/XcodeGen). You don't need xcodegen to build this sample — just open the project. You only need it if you add a source file or change build settings, in which case run `xcodegen generate` to refresh the project.
