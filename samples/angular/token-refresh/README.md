# Angular SPA — Token Refresh

Minimal Angular app demonstrating token refresh using `angular-auth-oidc-client` with the `offline_access` scope. Tokens are refreshed automatically and can also be refreshed manually via a button.

## Prerequisites

- `offline_access` scope enabled on the client
- `refresh_token` grant type enabled in workspace OAuth settings and in the application's Grant Types

## Setup

1. Copy `src/environments/environment.example.ts` to `src/environments/environment.ts` and fill in your SecureAuth values
2. `yarn install`
3. `yarn start`
4. Open https://localhost:4250 (accept the self-signed certificate warning)

## What this demonstrates

- OIDC configuration with `offline_access` scope for refresh tokens
- Automatic token refresh via refresh tokens
- Manual token refresh via `forceRefreshSession()` button
- Displaying token expiry information
- Error handling with OAuth error hints
