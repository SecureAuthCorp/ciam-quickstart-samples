# React Native — Login with PKCE

Minimal React Native app demonstrating OIDC login using Authorization Code + PKCE via [`react-native-app-auth`](https://github.com/FormidableLabs/react-native-app-auth). The system browser (ASWebAuthenticationSession on iOS, Custom Tabs on Android) handles the auth UI — never an embedded WebView.

## Prerequisites

- Node 22.11+
- Yarn 4 (via Corepack: `corepack enable`)
- For iOS: Xcode 15+, CocoaPods (`sudo gem install cocoapods` or `brew install cocoapods`)
- For Android: JDK 17, Android Studio with SDK 34, an emulator or device

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values:
   - `ISSUER_URL` — your workspace URL
   - `CLIENT_ID` — the OAuth client ID
   - `REDIRECT_URI` — leave as `com.secureauth.quickstart://oauthredirect` (must match the scheme registered in `ios/Quickstart/Info.plist` and `android/app/build.gradle`)
   - `SCOPES` — space-separated list (e.g. `openid profile email`)
2. In CIAM admin UI, register the redirect URI exactly: `com.secureauth.quickstart://oauthredirect`
3. Install JS deps: `yarn install`
4. Install iOS native deps: `cd ios && pod install && cd ..`
5. (Android only, first run) Generate a debug keystore: `cd android/app && keytool -genkeypair -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" && cd ../..`
6. Run on iOS: `yarn ios`
7. Or run on Android: `yarn android`

## What this demonstrates

- OIDC configuration with PKCE on a public mobile client (no client secret)
- System browser–driven login (AppAuth pattern — no embedded WebView)
- Auth Code + PKCE token exchange
- Local logout via `revoke()` + clearing app state

## Notes

- The redirect URI is a custom URL scheme, registered identically in both iOS (`Info.plist` → `CFBundleURLTypes`) and Android (`build.gradle` → `manifestPlaceholders["appAuthRedirectScheme"]`). The CIAM-side registration uses exactly that string.
- `react-native-config` reads `.env` at build time. Changes to `.env` require a rebuild (re-run `yarn ios` / `yarn android`), not just a Metro reload.
