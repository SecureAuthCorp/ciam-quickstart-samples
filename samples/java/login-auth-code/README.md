# Java — Server Login (Spring Boot + Spring Security)

Minimal Spring Boot 3.4 app demonstrating OIDC Authorization Code + PKCE using [`spring-security-oauth2-client`](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/index.html). Declarative client registration in `application.yml`, inline HTML rendering, RP-initiated logout.

## Prerequisites

- Java 21 SDK (`java -version` → 21.x)
- Maven 3.9+
- A SecureAuth application configured as a **confidential server app** with:
  - Authorization Code grant type enabled
  - Redirect URI: `https://localhost:4260/login/oauth2/code/secureauth`

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values
2. `mvn spring-boot:run`
3. Open https://localhost:4260 (accept the dev cert)

A self-signed dev keystore is generated into `target/classes/dev-keystore.p12` on first build by `keytool-maven-plugin` (bound to `generate-resources`). It isn't committed; `mvn clean` recreates it. Your browser will flag the cert as untrusted — accept it once for localhost.

## What this demonstrates

- OIDC Authorization Code + PKCE via Spring Security OAuth2 Client
- Declarative client registration in `application.yml` (`spring.security.oauth2.client.*`)
- `.env` loading via `me.paulschwarz:spring-dotenv` so YAML `${CLIENT_ID}` etc. resolves from the `.env` file
- A small `ScopesEnvironmentPostProcessor` normalizes `SCOPES` to comma-separated before property binding, so a `.env` shared with the Node/.NET/React/Vue/Angular samples (space-separated) works here too
- RP-initiated logout via `OidcClientInitiatedLogoutSuccessHandler`

## Tests

```
mvn test
```

Three tests cover `/` unauth, `/` authenticated (stubbed via `SecurityMockMvcRequestPostProcessors.oidcLogin()`), and `/logout` end-session redirect.

## Production notes

- Replace the generated dev keystore with a real TLS certificate (via a reverse proxy or a managed keystore) and remove the `keytool-maven-plugin` binding from `pom.xml`.
- Spring Security's default session store is in-memory. In production, use a persistent store (Redis, database) so sessions survive restarts and work across instances.
- Consider tightening CSRF protection and session-fixation handling in `SecurityConfig` if you add mutating endpoints beyond OIDC flows.
