# React Native — Token Refresh

Minimal React Native app demonstrating OIDC token refresh using [`react-native-app-auth`](https://github.com/FormidableLabs/react-native-app-auth) with the `offline_access` scope. Refresh tokens are persisted in platform secure storage via [`react-native-keychain`](https://github.com/oblador/react-native-keychain) (iOS Keychain / Android EncryptedSharedPreferences).

## Prerequisites

- `offline_access` scope enabled on the client
- `refresh_token` grant type enabled in workspace OAuth settings and in the application's Grant Types
- Same toolchain as `login-pkce`: Node 22.11+, Yarn 4, Xcode 15+ / CocoaPods, Android Studio + JDK 17

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values. Note `SCOPES` includes `offline_access`.
2. In CIAM admin UI, register the redirect URI exactly: `com.secureauth.quickstart.rn.refresh://oauthredirect`
3. `yarn install`
4. `cd ios && pod install && cd ..`
5. (Android only, first run) Generate a debug keystore: `cd android/app && keytool -genkeypair -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" && cd ../..`
6. `yarn ios` or `yarn android`

## What this demonstrates

- OIDC configuration with the `offline_access` scope to issue refresh tokens
- Persisting the refresh token in platform secure storage (Keychain / EncryptedSharedPreferences) keyed by service name
- Manual refresh on a button press; automatic silent refresh on app launch if a stored token exists
- Robust failure handling: a revoked / expired refresh token clears local state and surfaces a re-login prompt

## Notes

- This sample uses `react-native-keychain` rather than Expo's `SecureStore` because the bare-RN runtime here doesn't include the Expo modules. `react-native-keychain` ships with compiled native code and is the convention used by `react-native-app-auth`'s own sample apps.
- The Keychain service identifier is `com.secureauth.quickstart.refreshtoken` — change it if you fork this sample to avoid clashing with other apps that use the same identifier.
- `react-native-config` reads `.env` at build time. Changes to `.env` require a rebuild (re-run `yarn ios` / `yarn android`).
