// @snippet:step1:start
// @description Configure passport-saml with SecureAuth as the SAML IdP
import fs from "node:fs";
import path from "node:path";
import { ValidateInResponseTo } from "@node-saml/node-saml";
import type { Profile } from "@node-saml/node-saml";
import { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import type { VerifiedCallback } from "@node-saml/passport-saml";
import { requireEnv } from "./env.js";

export type SamlUser = {
  nameID: string;
  nameIDFormat?: string;
  attributes: Record<string, unknown>;
};

function readIdpCert(): string {
  const certPath = requireEnv("SAML_IDP_SIGNING_CERT_PATH");
  const resolved = path.isAbsolute(certPath)
    ? certPath
    : path.resolve(process.cwd(), certPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `IdP signing cert not found at ${resolved}. Download it from the SecureAuth admin UI (SAML IdP → General → Download certificate) and save it at ${certPath}.`,
    );
  }
  return fs.readFileSync(resolved, "utf-8");
}

export const samlStrategy = new SamlStrategy(
  {
    issuer: requireEnv("SAML_SP_ENTITY_ID"),
    callbackUrl: requireEnv("SAML_SP_ACS_URL"),
    entryPoint: requireEnv("SAML_IDP_SSO_URL"),
    idpIssuer: requireEnv("SAML_IDP_ENTITY_ID"),
    idpCert: readIdpCert(),
    // Allow both SP-initiated (with InResponseTo) and IdP-initiated (without).
    validateInResponseTo: ValidateInResponseTo.ifPresent,
    wantAssertionsSigned: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
    // SAML AuthnRequests are unsigned; CIAM accepts unsigned requests by default.
  },
  (profile: Profile | null, done: VerifiedCallback) => {
    if (!profile) {
      return done(new Error("SAML profile missing"));
    }
    const user: SamlUser = {
      nameID: profile.nameID,
      nameIDFormat: profile.nameIDFormat,
      attributes: (profile.attributes as Record<string, unknown>) ?? {},
    };
    done(null, user);
  },
  (_profile: Profile | null, done: VerifiedCallback) => {
    // Logout SAML — not implemented; CIAM does not support SLO. Local logout
    // is handled in app.ts by destroying the session. This callback exists
    // because passport-saml's Strategy constructor requires it.
    done(null);
  },
);
// @snippet:step1:end
