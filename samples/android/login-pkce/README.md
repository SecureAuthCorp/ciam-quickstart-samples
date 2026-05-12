# Android — Login with PKCE

Minimal Android app demonstrating OIDC login using Authorization Code + PKCE via [AppAuth-Android](https://github.com/openid/AppAuth-Android). Chrome Custom Tabs (the system browser) handles the auth UI — never an embedded `WebView`.

## Prerequisites

- JDK 21 (`java -version` reports 21)
- Android SDK with platform-android-36 and build-tools-36 installed (Android Studio's SDK Manager, or `sdkmanager`)
- `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) env var pointing at the SDK root
- An emulator runtime or a USB-debugging-enabled physical device

## Setup

1. Copy `local.example.properties` to `local.properties` and fill in your SecureAuth values:
   - `CLIENT_ID` — the OAuth client ID
   - `ISSUER_HOST` — host (and port if needed) of your issuer (e.g. `your-tenant.us.connect.secureauth.com`)
   - `ISSUER_PATH` — workspace path of your issuer (e.g. `your-workspace`). Leave empty if the issuer has no workspace component (typical for local dev).
   - `REDIRECT_SCHEME` — leave as `com.secureauth.quickstart.android.login` (must match the scheme used by AppAuth-Android's intent filter and your CIAM-side redirect URI)
   - `SCOPES` — space-separated list (e.g. `openid profile email`)
2. In CIAM admin UI, register the redirect URI exactly: `com.secureauth.quickstart.android.login://oauthredirect`
3. `./gradlew :app:installDebug` (or open the project in Android Studio and click Run)
4. Launch the app from the device/emulator launcher

## What this demonstrates

- OIDC configuration with PKCE on a public mobile client (no client secret)
- System-browser-driven login (Chrome Custom Tabs — no embedded WebView)
- Auth Code + PKCE token exchange
- Local logout via `revoke()` + clearing app state
- Access-token expiry detection that flips the UI to "Session expired" without re-prompting silently

## Notes

- `local.properties` is read at gradle configure time. Editing it requires a rebuild (`./gradlew :app:installDebug`) — values are baked into `BuildConfig.CIAM_*`.
- The redirect URI's custom URL scheme is set in two places that must match: `manifestPlaceholders["appAuthRedirectScheme"]` in `app/build.gradle.kts` (which expands `${appAuthRedirectScheme}` in `AndroidManifest.xml`), and your CIAM-side redirect URI registration. Both come from the same source — the `REDIRECT_SCHEME` entry in `local.properties` — so editing one place keeps them in sync.
- AppAuth-Android refuses to launch in an embedded `WebView` and explicitly opens Chrome Custom Tabs. Devices and emulator images without Chrome (or another Custom-Tabs-supporting browser) will fail to sign in. Most modern emulator images include Chrome.
