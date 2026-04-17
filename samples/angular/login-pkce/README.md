# Angular SPA — User Login (PKCE)

Minimal Angular app demonstrating OIDC login with PKCE using `angular-auth-oidc-client`.

## Setup

1. Copy `src/environments/environment.example.ts` to `src/environments/environment.ts` and fill in your SecureAuth values
2. `yarn install`
3. `yarn start`
4. Open https://localhost:4250 (accept the self-signed certificate warning)

## What this demonstrates

- OIDC configuration with Authorization Code + PKCE flow
- Login and logout redirects via SecureAuth
- Displaying authenticated user information
- Error handling with OAuth error hints
