# React SPA — Token Refresh

Minimal React app demonstrating token refresh using `react-oidc-context` with the `offline_access` scope. Tokens are refreshed automatically before they expire, and can also be refreshed manually via a button.

## Prerequisites

- `offline_access` scope enabled on the client
- `refresh_token` grant type enabled in workspace OAuth settings and in the application's Grant Types

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values
2. `yarn install`
3. `yarn start`
4. Open https://localhost:4250 (accept the self-signed certificate warning)

## What this demonstrates

- OIDC configuration with `offline_access` scope for refresh tokens
- Automatic token refresh via refresh tokens (no iframe needed)
- Manual token refresh via `signinSilent()` button
- Displaying token expiry information
- Error handling with OAuth error hints
