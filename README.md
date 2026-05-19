# CIAM Quickstart Samples

Minimal, framework-specific sample apps demonstrating OIDC and SAML flows against [SecureAuth CIAM](https://www.secureauth.com/). Each sample is a complete, runnable app you can clone, point at your own CIAM workspace, and use as a reference when wiring authentication into your own project.

Code snippets from these samples are extracted automatically and embedded in the SecureAuth admin dashboard's Quickstart tab.

## Available samples

| Framework                                           | Login (Auth Code + PKCE) | Token refresh | SAML SP |
| --------------------------------------------------- | :----------------------: | :-----------: | :-----: |
| React SPA                                           |            ✓             |       ✓       |    —    |
| Angular SPA                                         |            ✓             |       ✓       |    —    |
| Vue SPA                                             |            ✓             |       ✓       |    —    |
| Node.js server                                      |            ✓             |       ✓       |    ✓    |
| Java / Spring Boot                                  |            ✓             |       ✓       |    ✓    |
| .NET / ASP.NET Core                                 |            ✓             |       ✓       |    ✓    |
| Native Android (Kotlin + Compose + AppAuth-Android) |            ✓             |       ✓       |    —    |
| Native iOS (Swift + SwiftUI + AppAuth-iOS)          |            ✓             |       ✓       |    —    |
| React Native                                        |            ✓             |       ✓       |    —    |

## Quick start

1. Pick a sample matching your stack — e.g. `samples/react/login-pkce/`.
2. Copy `.env.example` (or the framework's equivalent like `local.example.properties` for Android, `Config.example.xcconfig` for iOS) to the real filename and fill in your CIAM workspace's client ID, issuer URL, redirect URI, and scopes.
3. Follow the sample's own `README.md` for run instructions and any framework-specific setup (Node version, JDK, Xcode, Android SDK, etc.).

## Before you ship

These samples are intentionally minimal — small enough to read end-to-end — and skip concerns that real deployments need to address, including:

- Hardening against the full OAuth/OIDC and SAML threat models (replay protection, token binding, audience/issuer validation beyond the library defaults, key rotation, etc.)
- Comprehensive input validation and error handling
- Production-grade secret management (no `.env`-style files; use a secrets manager)
- Logging, observability, tracing, and audit trails
- Session and token storage strategies appropriate to your environment (the choices here are pedagogical, not necessarily what you want in production)
- Rate limiting, CSRF protection on the relevant routes, secure cookie attributes appropriate to your deployment, CSP and other HTTP security headers
- Localization, accessibility, theming, and broader UX
- Build, packaging, signing, and release pipelines

Treat the code as a starting point. Review the relevant SecureAuth product documentation and run your own security review before shipping. Provided **AS IS** under the [LICENSE](LICENSE).

## Repository layout

```
samples/                # One folder per framework, one subfolder per scenario
  react/                # React SPA samples
  vue/                  # Vue SPA samples
  angular/              # Angular SPA samples
  node/                 # Node.js server samples (OIDC + SAML)
  java/                 # Java/Spring Boot server samples (OIDC + SAML)
  dotnet/               # .NET server samples (OIDC + SAML)
  android/              # Native Android samples (Kotlin + Compose + AppAuth-Android)
  ios/                  # Native iOS samples (Swift + SwiftUI + AppAuth-iOS)
  react-native/         # React Native mobile samples
scripts/                # Snippet extraction + manifest validation tools
```

Each sample is self-contained — its own build file, no shared library code — so copying a sample into your own project is a single directory move.

## Reporting issues

- Bugs and feature requests: [open an issue](../../issues/new).
- Security issues: please email security disclosures privately rather than opening a public issue.

## License

Apache 2.0 — see [LICENSE](LICENSE).
