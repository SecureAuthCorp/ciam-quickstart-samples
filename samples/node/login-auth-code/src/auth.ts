// @snippet:step1:start
// @description Discover the OIDC provider and configure the client
import * as client from "openid-client";
import { requireEnv } from "./env.js";

const config = await client.discovery(
  new URL(requireEnv("ISSUER_URL")),
  requireEnv("CLIENT_ID"),
  requireEnv("CLIENT_SECRET"),
);
// @snippet:step1:end

export type UserClaims = {
  sub: string;
  given_name?: string;
  family_name?: string;
  email?: string;
};

// @snippet:step2:start
// @description Build the authorization URL with PKCE and a CSRF state
export async function buildAuthUrl(
  codeVerifier: string,
  state: string,
): Promise<URL> {
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  return client.buildAuthorizationUrl(config, {
    redirect_uri: requireEnv("REDIRECT_URI"),
    scope: requireEnv("SCOPES"),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
}
// @snippet:step2:end

// @snippet:step3:start
// @description Exchange the authorization code for tokens (PKCE + client_secret)
export async function exchangeCode(params: {
  currentUrl: URL;
  codeVerifier: string;
  expectedState: string;
}): Promise<{ claims: UserClaims; idToken: string }> {
  const tokens = await client.authorizationCodeGrant(
    config,
    params.currentUrl,
    {
      pkceCodeVerifier: params.codeVerifier,
      expectedState: params.expectedState,
    },
  );
  const claims = tokens.claims() as UserClaims;
  return { claims, idToken: tokens.id_token! };
}
// @snippet:step3:end

export function buildLogoutUrl(idToken: string): URL {
  return client.buildEndSessionUrl(config, {
    post_logout_redirect_uri: requireEnv("POST_LOGOUT_URI"),
    id_token_hint: idToken,
  });
}

export { client };
