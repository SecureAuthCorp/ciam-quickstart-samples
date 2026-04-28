# Node.js — SAML SP Login

Minimal Express app demonstrating SAML SSO with SecureAuth as the SAML IdP, using [`@node-saml/passport-saml`](https://github.com/node-saml/passport-saml). Supports both **SP-initiated** and **IdP-initiated** flows through the same ACS endpoint.

## Prerequisites

- A SecureAuth workspace with a SAML Service Provider application registered. In CIAM's admin UI:
  1. Create a new SAML SP application.
  2. Open the application's **SAML tab** and switch the metadata mode to **Manual** (the default is URL/XML upload).
  3. Set **Entity ID** to `https://localhost:4262/saml/metadata` (matches `.env`'s `SAML_SP_ENTITY_ID`).
  4. Set **ACS URL** to `https://localhost:4262/saml/acs` (matches `.env`'s `SAML_SP_ACS_URL`).
  5. Leave **SP Signing Certificate** empty — this sample uses unsigned AuthnRequests.

## Setup

1. Copy `.env.example` to `.env` and fill in the IdP values from CIAM's admin UI → **SAML IdP → General** tab:
   - `SAML_IDP_ENTITY_ID` — copy "SAML IdP Entity ID"
   - `SAML_IDP_SSO_URL` — copy "SAML IdP Single Sign-On URL"
2. Download the IdP signing certificate (admin UI → SAML IdP → General → "SAML IdP Signing Certificate" → Download). The browser saves it as `saml-certificate.pem` — drop the file into this sample's directory as-is (no rename needed).
3. `yarn install`
4. `yarn start`
5. Open https://localhost:4262 (accept the self-signed certificate warning).

## Try it

**SP-initiated SSO:**

1. Visit https://localhost:4262
2. Click **Sign in** — you'll be redirected to SecureAuth, authenticate, then return to the app authenticated.

**IdP-initiated SSO:**

1. In CIAM's admin UI, copy the "SAML IdP-Initiated SSO URL" (looks like `…/saml/initiate?service_provider_id=…`).
2. Visit that URL in a new browser session — SecureAuth will POST a SAML response directly to the app's ACS endpoint and you'll land authenticated.

## Next: release additional user attributes

By default the SAML response only carries the user's `nameID`. To get attributes like `given_name`, `family_name`, or `email` in the assertion (accessible via `req.user.attributes` in this sample), configure them in CIAM:

1. **Workspace claims** — make sure `saml_assertion`-typed claims exist for the attributes you want. In the workspace, open **OAuth Server → Claims** and create them if missing (one per attribute, e.g. `given_name`, `family_name`, `email`).
2. **App attribute release** — on the SAML SP application, open the **SAML Attributes** tab and select the claims you want this app to receive. Save.

The next SAML response will include an `<AttributeStatement>` with those attributes; passport-saml exposes them on `profile.attributes` and the sample stores them on the session as `req.user.attributes`. Update `renderSignedInPage` in `src/app.ts` to read from there if you want to display them.

## What this demonstrates

- Configuring `passport-saml` with SecureAuth's SAML IdP (entity ID, SSO URL, signing cert)
- An ACS endpoint that validates IdP-signed SAML responses and accepts both SP- and IdP-initiated flows (`validateInResponseTo: "ifPresent"`)
- Server-managed session via `express-session` carrying the SAML `nameID` and attributes
- Local logout (clears the session — CIAM does not implement SAML SLO)

## Production notes

- Set `SESSION_SECRET` via env var so sessions survive restarts.
- The default in-memory session store is dev-only — swap in Redis or similar for production.
- The sample uses a self-signed TLS cert generated at boot. Use real certificates for production.
- Consider enabling SP request signing (`privateKey` + an SP cert in CIAM) for production. SecureAuth accepts unsigned requests by default; this sample skips signing for simplicity.
