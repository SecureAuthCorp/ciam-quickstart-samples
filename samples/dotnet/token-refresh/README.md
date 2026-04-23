# .NET — Server Token Refresh

Minimal ASP.NET Core 10 Minimal-APIs app demonstrating server-side token refresh using [`Duende.IdentityModel`](https://github.com/DuendeSoftware/foss/tree/main/identity-model) on top of the built-in `Microsoft.AspNetCore.Authentication.OpenIdConnect` middleware. After login, the refresh token is stored in the encrypted auth cookie; a "Refresh token now" form posts to `/refresh` for manual refresh, and an `OnValidatePrincipal` event auto-refreshes the cookie on every authenticated request when the access token is within 60s of expiring.

The refresh token never reaches the browser as a raw value — it lives inside the encrypted auth cookie, which ASP.NET Core data protection signs and encrypts.

## Prerequisites

- .NET 10 SDK installed (`dotnet --version` → 10.x)
- `dotnet dev-certs https --trust` — run once per machine to trust the local dev HTTPS cert
- A SecureAuth application configured as a **confidential server app** (with a client secret), with:
  - Authorization Code grant type enabled
  - Refresh Token grant type enabled
  - `offline_access` scope allowed on the client

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values (including `CLIENT_SECRET`)
2. `dotnet restore`
3. `dotnet run --project src`
4. Open https://localhost:4260

## What this demonstrates

- OIDC Authorization Code + PKCE flow with a confidential server client
- Refresh tokens persisted inside the encrypted auth cookie (`SaveTokens = true`)
- Manual refresh via a POST form that calls `Duende.IdentityModel`'s `RequestRefreshTokenAsync`
- Automatic refresh via the cookie auth `OnValidatePrincipal` event when the access token nears expiry
- Access-token expiry display (read via `HttpContext.GetTokenAsync("expires_at")`)
- RP-initiated logout via `Results.SignOut(...)` on Cookie + OIDC schemes

## Tests

```
dotnet test
```

Six tests covering `/` unauth, `/` authenticated, `/login` challenge, `/refresh` happy path, `/refresh` error path, `/logout`. The auto-refresh middleware is not covered by a unit test — it calls the same refresh helper as `/refresh`, and is verified by manual smoke.

## Production notes

- Replace the dev cert with a real TLS certificate (via a reverse proxy or configured Kestrel endpoint).
- ASP.NET Core's data-protection keys default to in-memory in dev. In production, configure a persistent key ring (filesystem / blob / Redis) so auth cookies survive restarts and work across instances.
- **CSRF protection:** `POST /refresh` is not CSRF-protected. For production, enable ASP.NET Core antiforgery middleware, switch cookies to `SameSite=Strict`, or use a double-submit cookie pattern.
- **Concurrent refreshes:** two requests may race on the refresh token with rotation-enforcing IdPs. Production apps should serialize refresh per session (e.g. via `SemaphoreSlim` keyed by session id).
- **Auto-refresh scope:** `OnValidatePrincipal` fires for every authenticated request including static assets and health checks. In production, consider wrapping the refresh logic so it only runs for routes that actually use the access token.
