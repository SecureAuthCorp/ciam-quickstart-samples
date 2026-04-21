# Vue SPA — Login with PKCE

Minimal Vue 3 app demonstrating OIDC login using Authorization Code + PKCE via `oidc-client-ts` wrapped in a `useAuth` composable.

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values
2. `yarn install`
3. `yarn start`
4. Open https://localhost:4250 (accept the self-signed certificate warning)

## What this demonstrates

- OIDC configuration with PKCE (no client secret)
- Login redirect to SecureAuth
- Displaying the authenticated user's name
- Logout with redirect
