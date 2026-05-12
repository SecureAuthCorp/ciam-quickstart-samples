# iOS — Token Refresh

Minimal iOS app demonstrating refresh-token flow with [AppAuth-iOS](https://github.com/openid/AppAuth-iOS). The refresh token is persisted in iOS Keychain (`kSecAttrAccessibleWhenUnlocked`) so the user is signed in silently on subsequent app launches without going through the system browser.

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
   - `REDIRECT_SCHEME` — leave as `com.secureauth.quickstart.ios.refresh` (must match the scheme in `Quickstart/Info.plist` and your CIAM-side redirect URI)
   - `SCOPES` — must include `offline_access` (required for the IdP to issue a refresh token)
2. In CIAM admin UI:
   - Register the redirect URI exactly: `com.secureauth.quickstart.ios.refresh://oauthredirect`
   - Enable the `refresh_token` grant type for the application
3. Open `Quickstart.xcodeproj` in Xcode
4. Select an iPhone simulator (e.g. iPhone 16) and press ⌘R

## What this demonstrates

- OIDC configuration with PKCE on a public mobile client (no client secret) requesting `offline_access`
- System browser–driven login (`ASWebAuthenticationSession` — no embedded WebView)
- Refresh-token persistence in iOS Keychain (`kSecAttrAccessibleWhenUnlocked`)
- Silent re-login on app launch — using the stored refresh token, no browser prompt
- Manual refresh via "Refresh token now" button
- Auto-refresh when the access token elapses
- Sign out: best-effort access-token revocation + Keychain clear

## Notes

- The issuer is split into `ISSUER_HOST` + `ISSUER_PATH` because xcconfig treats `//` as a comment marker. Swift rebuilds `https://HOST/PATH` at startup.
- The redirect URI is a custom URL scheme registered in `Quickstart/Info.plist` (`CFBundleURLTypes`). The CIAM-side registration must match exactly.
- Editing `Config.xcconfig` requires a clean build (Cmd-Shift-K then Cmd-R). `Info.plist` is preprocessed at build time.
- Refresh tokens can be revoked or expire server-side. On refresh failure the app clears Keychain and forces re-login.
- Keychain entries persist across simulator app reinstalls. Use `xcrun simctl uninstall booted com.secureauth.quickstart.ios.refresh` (or `xcrun simctl erase` to wipe the simulator) if you need a clean slate.
- The committed `Quickstart.xcodeproj` is generated from `project.yml` via [xcodegen](https://github.com/yonaskolb/XcodeGen). You don't need xcodegen to build this sample — just open the project. You only need it if you add a source file or change build settings, in which case run `xcodegen generate` to refresh the project.
