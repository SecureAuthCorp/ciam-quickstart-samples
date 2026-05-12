# Android — Token Refresh

Minimal Android app demonstrating refresh-token flow with [AppAuth-Android](https://github.com/openid/AppAuth-Android). The refresh token is persisted in [EncryptedSharedPreferences](https://developer.android.com/topic/security/data) (Keystore-backed AES-GCM), so the user is signed in silently on subsequent app launches without going through the system browser.

## Prerequisites

- JDK 21 (`java -version` reports 21)
- Android SDK with platform-android-36 and build-tools-36 installed (Android Studio's SDK Manager, or `sdkmanager`)
- `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) env var pointing at the SDK root
- An emulator runtime or a USB-debugging-enabled physical device

## Setup

1. Copy `local.example.properties` to `local.properties` and fill in your SecureAuth values:
   - `CLIENT_ID` — the OAuth client ID
   - `ISSUER_HOST` — host (and port if needed) of your issuer (e.g. `your-tenant.us.connect.secureauth.com`)
   - `ISSUER_PATH` — workspace path of your issuer (e.g. `your-workspace`). Leave empty if the issuer has no workspace component.
   - `REDIRECT_SCHEME` — leave as `com.secureauth.quickstart.android.refresh` (must match the scheme used by AppAuth-Android's intent filter and your CIAM-side redirect URI)
   - `SCOPES` — must include `offline_access` (required for the IdP to issue a refresh token)
2. In CIAM admin UI:
   - Register the redirect URI exactly: `com.secureauth.quickstart.android.refresh://oauthredirect`
   - Enable the `refresh_token` grant type for the application
3. `./gradlew :app:installDebug` (or open the project in Android Studio and click Run)
4. Launch the app from the device/emulator launcher

## What this demonstrates

- OIDC configuration with PKCE on a public mobile client (no client secret) requesting `offline_access`
- System-browser-driven login (Chrome Custom Tabs — no embedded WebView)
- Refresh-token persistence in EncryptedSharedPreferences (Keystore-backed AES-GCM)
- Silent re-login on app launch — using the stored refresh token via `Application.onCreate` → `AuthViewModel.init`, no browser prompt
- Manual refresh via "Refresh token now" button
- Auto-refresh when the access token elapses
- Sign out: best-effort access-token revocation + storage clear

## Notes

- `local.properties` is read at gradle configure time. Editing it requires a rebuild (`./gradlew :app:installDebug`) — values are baked into `BuildConfig.CIAM_*`.
- The redirect URI's custom URL scheme is set in two places that must match: `manifestPlaceholders["appAuthRedirectScheme"]` in `app/build.gradle.kts` (which expands `${appAuthRedirectScheme}` in `AndroidManifest.xml`), and your CIAM-side redirect URI registration. Both come from the same source — the `REDIRECT_SCHEME` entry in `local.properties` — so editing one place keeps them in sync.
- Refresh tokens can be revoked or expire server-side. On refresh failure the app clears the storage and forces re-login.
- This sample uses `androidx.security:security-crypto` 1.1.0 for `EncryptedSharedPreferences`. Production apps with stricter security requirements may prefer hand-rolled `KeyStore` + AES-GCM with `SharedPreferences` or `DataStore` — but the Jetpack Security API is fine for the quickstart.
- Unit tests for `RefreshTokenStore` use a `TokenStore` interface + `FakeTokenStore` (plain `SharedPreferences`) because Robolectric's host-JVM runtime doesn't include the Android Keystore. The production `RefreshTokenStore` (the snippet step 4 file) uses `EncryptedSharedPreferences` unchanged.
