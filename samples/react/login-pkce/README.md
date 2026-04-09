# React SPA — Login with PKCE

Minimal React app demonstrating OIDC login using Authorization Code + PKCE via `react-oidc-context`.

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000

## What this demonstrates

- OIDC configuration with PKCE (no client secret)
- Login redirect to SecureAuth
- Displaying the authenticated user's name
- Logout with redirect
