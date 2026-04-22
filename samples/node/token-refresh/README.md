# Node.js — Server Token Refresh

Minimal Express app demonstrating server-side token refresh using [`openid-client`](https://github.com/panva/openid-client). After login, the session stores the refresh token; a "Refresh token now" button posts to `/refresh`, which calls `refreshTokenGrant` and updates the session with a fresh access token + expiry.

The refresh token never reaches the browser — the session cookie identifies the user; the refresh token sits server-side.

## Prerequisites

- A SecureAuth application configured as a **confidential server app** (with a client secret)
- Authorization Code grant type enabled, `refresh_token` grant type enabled
- `offline_access` scope enabled on the client

## Setup

1. Copy `.env.example` to `.env` and fill in your SecureAuth values (including `CLIENT_SECRET`)
2. `yarn install`
3. `yarn start`
4. Open https://localhost:4261 (accept the self-signed certificate warning)

## What this demonstrates

- OIDC discovery against your SecureAuth workspace
- Authorization Code + PKCE flow with a confidential server client
- Server-managed session storing access + refresh tokens and expiry
- Manual refresh via `refreshTokenGrant` triggered by a POST form
- RP-initiated logout using `end_session_endpoint`

## Production notes

- The sample auto-generates a random `SESSION_SECRET` on startup when the env var is unset (for zero-setup dev). Set `SESSION_SECRET` via env var in production so sessions survive restarts and are stable across instances.
- The in-memory session store is for development only. Swap in Redis (or similar) for production so sessions survive restarts and work across multiple instances.
- The self-signed TLS cert is generated at boot via `selfsigned`. Use real certificates in production.
- **Automatic refresh:** this sample only refreshes on button click. For production, consider middleware that checks `session.accessTokenExpiresAt` on each protected request and refreshes if it's below a threshold. Example:

  ```ts
  app.use(async (req, _res, next) => {
    const now = Math.floor(Date.now() / 1000);
    if (
      req.session.refreshToken &&
      (req.session.accessTokenExpiresAt ?? 0) - now < 60
    ) {
      try {
        const tokens = await refreshTokens(req.session.refreshToken);
        Object.assign(req.session, tokens);
      } catch (err) {
        /* handle */
      }
    }
    next();
  });
  ```

- **CSRF protection:** `POST /refresh` is not CSRF-protected in this sample. For production, add CSRF tokens (e.g. `csurf`), switch session cookies to `sameSite: "strict"`, or use the double-submit cookie pattern.
