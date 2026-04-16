# React SPA — Token Refresh

Minimal React app demonstrating token refresh using `react-oidc-context` with the `offline_access` scope. The library automatically exchanges refresh tokens for new access tokens before they expire.

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values
2. `yarn install`
3. `yarn dev`
4. Open http://localhost:3000

## What this demonstrates

- OIDC configuration with `offline_access` scope for refresh tokens
- Automatic token refresh via refresh tokens (no iframe needed)
- Displaying token expiry and refresh status
