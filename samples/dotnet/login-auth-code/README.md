# .NET — Server Login with Auth Code + PKCE

Minimal ASP.NET Core 8 Minimal-APIs app demonstrating server-side OIDC login using `Microsoft.AspNetCore.Authentication.OpenIdConnect`. The server holds the client secret and manages the session via an encrypted auth cookie.

## Prerequisites

- .NET 10 SDK installed (`dotnet --version` → 10.x)
- `dotnet dev-certs https --trust` — run once per machine to trust the local dev HTTPS cert
- A SecureAuth application configured as a **confidential server app** (client type `server_web`, with a client secret)

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values (including `CLIENT_SECRET`)
2. `dotnet restore`
3. `dotnet run --project src`
4. Open https://localhost:4260

## What this demonstrates

- OIDC discovery via `AddOpenIdConnect(options => { options.Authority = ... })`
- Authorization Code + PKCE flow (middleware handles code exchange, state validation, PKCE verifier)
- Auth cookie with ID token stored server-side (never reaches the browser as a token)
- RP-initiated logout via `Results.SignOut(...)` on Cookie + OIDC schemes

## Tests

```
dotnet test
```

Covers the four non-library code paths: `/` unauthenticated, `/` authenticated (via fake auth scheme), `/login` challenge, `/logout` sign-out.

## Production notes

- Replace the dev cert with a real TLS certificate (via a reverse proxy or configured Kestrel endpoint).
- ASP.NET Core's data-protection keys default to in-memory in dev. In production, configure a persistent key ring (filesystem / blob / Redis) so auth cookies survive restarts and work across instances.
- Consider scoping auth middleware to protected routes only via `[Authorize]` attributes or `RequireAuthorization()`.
