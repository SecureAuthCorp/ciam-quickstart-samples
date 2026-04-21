# Node.js — Server Login with Auth Code + PKCE

Minimal Express app demonstrating server-side OIDC login using Authorization Code + PKCE via [`openid-client`](https://github.com/panva/openid-client). The server holds the client secret and manages the user session — unlike the SPA samples, the client secret never reaches the browser.

## Prerequisites

- A SecureAuth application configured as a **confidential server app** (client type `server_web`, with a client secret)
- Authorization Code grant type enabled. PKCE is used as defense in depth; no refresh-token scope needed.

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values (including `CLIENT_SECRET`)
2. `yarn install`
3. `yarn start`
4. Open https://localhost:4260 (accept the self-signed certificate warning)

## What this demonstrates

- OIDC discovery against your SecureAuth workspace
- Authorization Code + PKCE flow with a confidential server client
- Server-managed session (via `express-session`) holding the user claims + ID token
- RP-initiated logout using `end_session_endpoint` + `id_token_hint`

## Production notes

- `SESSION_SECRET` must be a strong random value; the value in `.env.example` is a placeholder.
- The default in-memory session store is for development only. Swap in Redis (or similar) for production.
- The sample uses a self-signed certificate generated at boot. For production, use real certificates from your TLS termination layer.
