# Java — SAML SP Login (Spring Boot + Spring Security)

Minimal Spring Boot 3.4 app demonstrating SAML SSO with SecureAuth as the SAML IdP, using [`spring-security-saml2-service-provider`](https://docs.spring.io/spring-security/reference/servlet/saml2/login/index.html). Supports both **SP-initiated** and **IdP-initiated** flows through the same ACS endpoint.

## Prerequisites

- Java 21 SDK (`java -version` → 21.x)
- Maven 3.9+
- A SecureAuth workspace with a SAML Service Provider application registered. In CIAM's admin UI:
  1. Create a new SAML SP application.
  2. Open the application's **SAML tab** and switch the metadata mode to **Manual** (the default is URL/XML upload).
  3. Set **Entity ID** to `https://localhost:4262/saml/metadata` (matches `.env`'s `SAML_SP_ENTITY_ID`).
  4. Set **ACS URL** to `https://localhost:4262/login/saml2/sso/secureauth` (matches `.env`'s `SAML_SP_ACS_URL`).
  5. Leave **SP Signing Certificate** empty. Spring Security 6.4 SAML2 always signs AuthnRequests, so this sample reuses the dev TLS keystore as the signing credential — but CIAM ignores the signature when no SP cert is registered, so functionally the requests are accepted as if unsigned.

## Setup

1. Copy `.env.example` to `.env` and fill in the IdP values from CIAM's admin UI → **SAML IdP → General** tab:
   - `SAML_IDP_ENTITY_ID` — copy "SAML IdP Entity ID"
   - `SAML_IDP_SSO_URL` — copy "SAML IdP Single Sign-On URL"
2. Download the IdP signing certificate (admin UI → SAML IdP → General → "SAML IdP Signing Certificate" → Download). The browser saves it as `saml-certificate.pem` — drop the file into this sample's directory as-is (no rename needed).
3. `mvn spring-boot:run`
4. Open https://localhost:4262 (accept the self-signed certificate warning).

A self-signed dev keystore is generated into `target/classes/dev-keystore.p12` on first build by `keytool-maven-plugin`. It isn't committed; `mvn clean` recreates it.

## Try it

**SP-initiated SSO:**

1. Visit https://localhost:4262
2. Click **Sign in** — you'll be redirected to SecureAuth, authenticate, then return to the app authenticated.

**IdP-initiated SSO:**

1. In CIAM's admin UI, copy the "SAML IdP-Initiated SSO URL" (looks like `…/saml/initiate?service_provider_id=…`).
2. Visit that URL in a new browser session — SecureAuth will POST a SAML response directly to the app's ACS endpoint and you'll land authenticated.

## Next: release additional user attributes

By default the SAML response only carries the user's `nameID`. To get attributes like `given_name`, `family_name`, or `email` in the assertion (accessible via `Saml2AuthenticatedPrincipal#getAttribute(name)` in this sample), configure them in CIAM:

1. **Workspace claims** — make sure `saml_assertion`-typed claims exist for the attributes you want. In the workspace, open **OAuth Server → Claims** and create them if missing (one per attribute, e.g. `given_name`, `family_name`, `email`).
2. **App attribute release** — on the SAML SP application, open the **SAML Attributes** tab and select the claims you want this app to receive. Save.

The next SAML response will include an `<AttributeStatement>` with those attributes; Spring Security exposes them on the `Saml2AuthenticatedPrincipal`. Update the `home` method in `Application.java` to read from `user.getAttribute("given_name")` etc. if you want to display them.

## What this demonstrates

- Configuring `spring-security-saml2-service-provider` with SecureAuth's SAML IdP (entity ID, SSO URL, signing cert) and an SP signing credential (Spring Security 6.4 requires one even when the IdP doesn't validate it)
- Cross-site cookie config (`SameSite=None; Secure`) so the JSESSIONID survives the POST from CIAM back to the ACS endpoint
- A targeted bearer-confirmation validator that works around CIAM-specific quirks: a malformed `Address` attribute (host:port form instead of IP-only) and the unreliability of session-stored `InResponseTo` state across cross-site POSTs. The response-level signature (verified against the IdP signing cert) still runs and provides the core security guarantee.
- An ACS endpoint at `/login/saml2/sso/secureauth` that validates IdP-signed SAML responses and accepts both SP- and IdP-initiated flows
- Customizing `OpenSaml4AuthenticationProvider`'s response validator to accept unsolicited (IdP-initiated) responses
- Server-managed session via the default servlet `HttpSession` / `JSESSIONID` carrying the SAML `Saml2AuthenticatedPrincipal`
- Local logout (clears the session — CIAM does not implement SAML SLO)

## Tests

```
mvn test
```

Three tests cover `/` unauthenticated, `/` authenticated (stubbed via Spring Security test post-processors), and `/logout` redirect.

## Production notes

- Replace the generated dev keystore with a real TLS certificate (via a reverse proxy or a managed keystore) and remove the `keytool-maven-plugin` binding from `pom.xml`.
- Spring Security's default session store is in-memory. In production, use a persistent store (Redis, database) so sessions survive restarts and work across instances.
- For production, generate a dedicated SAML SP signing key (separate from the TLS dev keystore reused here for convenience) and register its public cert in CIAM's SAML SP form so signatures are actually validated. The current setup makes Spring Security happy but provides no real signature security since CIAM doesn't verify it.
- The `INVALID_IN_RESPONSE_TO` filter accepts ALL unsolicited responses — fine for IdP-initiated flows, but consider adding additional checks (e.g., RelayState validation) if you support both flows from untrusted contexts.
