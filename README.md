# CIAM Quickstart Samples

Framework-specific sample apps demonstrating SecureAuth integration. Code is extracted from these samples and displayed in the SecureAuth admin dashboard's Quickstart tab.

## Structure

```
samples/                # One folder per framework
  react/                # React SPA samples
  vue/                  # Vue SPA samples
  angular/              # Angular SPA samples
  node/                 # Node.js server samples (OIDC + SAML)
  java/                 # Java/Spring Boot server samples (OIDC + SAML)
  dotnet/               # .NET server samples (OIDC + SAML)
  android/              # Native Android samples (Kotlin + Compose + AppAuth-Android)
  ios/                  # Native iOS samples (Swift + SwiftUI + AppAuth-iOS)
  react-native/         # React Native mobile samples (PKCE + token refresh)
scripts/                # Extraction and validation tools
```

## Adding a new sample

1. Create `samples/<framework>/<flow>/` with a minimal working app
2. Add `@snippet:stepN:start/end` tags and `@description` comments in source files
3. Add a `manifest.yaml` in `samples/<framework>/`
4. Run `cd scripts && yarn all` to validate
5. Open a PR — CI will test the app and validate extraction

## CI

Per-framework test workflows live in [.github/workflows/](.github/workflows/) (`test-android.yml`, `test-ios.yml`, `test-dotnet.yml`, `test-java.yml`, `test-js.yml`). Each is path-filtered to its framework's samples, with a stable `<Framework> tests passed` aggregator job suitable for required-status-check gating.
