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

## ⚠️ Not production-ready

These samples illustrate **one** working approach to integrating each framework with CIAM. They are intentionally minimal — small enough to read end-to-end and copy into a new project — and deliberately skip concerns that any real-world deployment must address, including (but not limited to):

- Hardening against the full OAuth/OIDC and SAML threat models (replay protection, token binding, audience/issuer validation beyond the library defaults, key rotation, etc.)
- Comprehensive input validation and error handling
- Production-grade secret management (no `.env`-style files; use a secrets manager)
- Logging, observability, tracing, and audit trails
- Session and token storage strategies appropriate to your environment (the choices here are pedagogical, not necessarily what you want in production)
- Rate limiting, CSRF protection on the relevant routes, secure cookie attributes appropriate to your deployment, CSP and other HTTP security headers
- Localization, accessibility, theming, and broader UX
- Build, packaging, signing, and release pipelines

Treat the code as a starting point for your own implementation. Before deploying anything derived from these samples, review the relevant SecureAuth product documentation and conduct your own security review against the threat model that applies to your application. The samples are provided **AS IS** under the terms of the [LICENSE](LICENSE), without warranty of any kind.

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

## How samples are structured

Source files have `@snippet:stepN:start` and `@snippet:stepN:end` markers around the lines that matter for that step. The extraction script in `scripts/` collects these into `snippets.json` for the dashboard. A per-framework `manifest.yaml` (e.g. `samples/react/manifest.yaml`) declares which scenarios the framework supports and what config rows the dashboard should display.

## Adding a new sample

1. Create `samples/<framework>/<flow>/` with a minimal working app
2. Tag relevant source lines with `@snippet:stepN:start/end` and `@description` comments
3. Add an entry under `scenarios:` in the framework's `manifest.yaml`
4. Run `cd scripts && yarn all` to regenerate `snippets.json` + `snippet-manifest.yaml` and validate the structure
5. Open a PR — per-framework CI workflows build the sample and confirm extraction stays consistent

## CI

Per-framework test workflows live in [.github/workflows/](.github/workflows/). Each workflow is path-aware: a PR only runs the matrix entries for samples whose subtree actually changed. Each workflow ends with a stable `<Framework> tests passed` aggregator job that's suitable for required-status-check gating.

## Reporting issues

- Bugs and feature requests: [open an issue](../../issues/new).
- Security issues: please email security disclosures privately rather than opening a public issue.

## License

Apache 2.0 — see [LICENSE](LICENSE).
