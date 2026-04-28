# .NET — SAML SP Login

Minimal ASP.NET Core 10 Minimal-APIs app demonstrating SAML SSO with SecureAuth as the SAML IdP, using [`Sustainsys.Saml2.AspNetCore2`](https://github.com/Sustainsys/Saml2). Supports both **SP-initiated** and **IdP-initiated** flows through the same ACS endpoint (`AllowUnsolicitedAuthnResponse = true`).

## Prerequisites

- .NET 10 SDK installed (`dotnet --version` → 10.x)
- `dotnet dev-certs https --trust` — run once per machine to trust the local dev HTTPS cert
- A SecureAuth workspace with a SAML Service Provider application registered. In CIAM's admin UI:
  1. Create a new SAML SP application.
  2. Open the application's **SAML tab** and switch the metadata mode to **Manual** (the default is URL/XML upload).
  3. Set **Entity ID** to `https://localhost:4262/saml/metadata` (matches `.env`'s `SAML_SP_ENTITY_ID`).
  4. Set **ACS URL** to `https://localhost:4262/Saml2/Acs` (matches `.env`'s `SAML_SP_ACS_URL`).
  5. Leave **SP Signing Certificate** empty — this sample uses unsigned AuthnRequests.

## Setup

1. Copy `.env.example` to `.env` and fill in the IdP values from CIAM's admin UI → **SAML IdP → General** tab:
   - `SAML_IDP_ENTITY_ID` — copy "SAML IdP Entity ID"
   - `SAML_IDP_SSO_URL` — copy "SAML IdP Single Sign-On URL"
2. Download the IdP signing certificate (admin UI → SAML IdP → General → "SAML IdP Signing Certificate" → Download). The browser saves it as `saml-certificate.pem` — drop the file into this sample's directory as-is (no rename needed).
3. `dotnet restore`
4. `dotnet run --project src`
5. Open https://localhost:4262

## Try it

**SP-initiated SSO:**

1. Visit https://localhost:4262
2. Click **Sign in** — you'll be redirected to SecureAuth, authenticate, then return to the app authenticated.

**IdP-initiated SSO:**

1. In CIAM's admin UI, copy the "SAML IdP-Initiated SSO URL" (looks like `…/saml/initiate?service_provider_id=…`).
2. Visit that URL in a new browser session — SecureAuth will POST a SAML response directly to the app's ACS endpoint and you'll land authenticated.

## Next: release additional user attributes

By default the SAML response only carries the user's `nameID`. To get attributes like `given_name`, `family_name`, or `email` in the assertion (accessible via `User.FindFirst("given_name")?.Value` in this sample), configure them in CIAM:

1. **Workspace claims** — make sure `saml_assertion`-typed claims exist for the attributes you want. In the workspace, open **OAuth Server → Claims** and create them if missing (one per attribute, e.g. `given_name`, `family_name`, `email`).
2. **App attribute release** — on the SAML SP application, open the **SAML Attributes** tab and select the claims you want this app to receive. Save.

The next SAML response will include an `<AttributeStatement>` with those attributes; Sustainsys.Saml2 maps them onto the `ClaimsPrincipal` as claims with the attribute names as claim types. Update `Views.RenderSignedInPage` in `src/Program.cs` to read `user.FindFirst("given_name")?.Value` etc. if you want to display them.

## What this demonstrates

- Configuring `Sustainsys.Saml2.AspNetCore2` with SecureAuth's SAML IdP (entity ID, SSO URL, signing cert)
- An ACS endpoint at `/Saml2/Acs` (Sustainsys's default) that validates IdP-signed SAML responses and accepts both SP- and IdP-initiated flows (`AllowUnsolicitedAuthnResponse = true`)
- Session carried by an encrypted auth cookie (protected by ASP.NET Core data protection)
- Local logout (clears the cookie — CIAM does not implement SAML SLO)

## Tests

```
dotnet test
```

Four tests cover `/` unauthenticated, `/` authenticated (via fake auth scheme), `/login` SAML challenge, and `/logout` redirect.

## Production notes

- Replace the dev cert with a real TLS certificate (via a reverse proxy or configured Kestrel endpoint).
- ASP.NET Core's data-protection keys default to in-memory in dev. In production, configure a persistent key ring (filesystem / blob / Redis) so auth cookies survive restarts and work across instances.
- Consider enabling SP request signing for production (configure a `signing` X509 credential on `SPOptions.ServiceCertificates`). SecureAuth accepts unsigned requests by default; this sample skips signing for simplicity.
- The `AllowUnsolicitedAuthnResponse = true` setting accepts ALL unsolicited responses — fine for IdP-initiated flows, but consider adding additional checks (e.g., RelayState validation) if you support both flows from untrusted contexts.
