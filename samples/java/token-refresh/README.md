# Java — Server Token Refresh (Spring Boot + Spring Security)

Extends the `login-auth-code` sample with refresh-token handling via Spring Security's `OAuth2AuthorizedClientManager`. Automatic refresh on authorized-client use is handled by Spring; a manual `POST /refresh` form directly invokes `RefreshTokenOAuth2AuthorizedClientProvider` for a visible demo.

## Prerequisites

- Java 21 SDK
- Maven 3.9+
- A SecureAuth application configured as a **confidential server app** with:
  - Authorization Code + Refresh Token grant types enabled
  - `offline_access` scope allowed on the client
  - Redirect URI: `https://localhost:4260/login/oauth2/code/secureauth`

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values
2. `mvn spring-boot:run`
3. Open https://localhost:4260 (accept the dev cert)

A self-signed dev keystore is generated into `target/classes/dev-keystore.p12` on first build by `keytool-maven-plugin` (bound to `generate-resources`). It isn't committed; `mvn clean` recreates it. Your browser will flag the cert as untrusted — accept it once for localhost.

## What this demonstrates

- OIDC Authorization Code + PKCE with `offline_access` scope
- Refresh-token grant via `RefreshTokenOAuth2AuthorizedClientProvider`
- Automatic background refresh managed by `OAuth2AuthorizedClientManager`
- Manual `POST /refresh` that forces refresh + updates the stored client
- Access-token expiry display reading from `OAuth2AuthorizedClient`
- `.env` loading via `me.paulschwarz:spring-dotenv` so YAML `${CLIENT_ID}` etc. resolves from the `.env` file (see `.env.example` — `SCOPES` is comma-separated for Spring's binder)
- RP-initiated logout

## Tests

```
mvn test
```

Five tests: `/` unauth, `/` authenticated with expiry + refresh form, `POST /refresh` happy, `POST /refresh` error, `/logout`.

## Production notes

- Replace the generated dev keystore with a real TLS certificate (via a reverse proxy or a managed keystore) and remove the `keytool-maven-plugin` binding from `pom.xml`.
- Spring's default session store is in-memory. Use Redis or a DB-backed store for multi-instance deployments.
- `OAuth2AuthorizedClientManager` already handles automatic refresh under the hood — only add a manual `/refresh` route if you have a specific UX requirement (e.g. demo, explicit "refresh now" button).
- Concurrent refreshes: the `DefaultOAuth2AuthorizedClientManager` does not serialize refresh calls per session. With rotation-enforcing IdPs, two concurrent requests may race. Consider a per-session lock in production.
