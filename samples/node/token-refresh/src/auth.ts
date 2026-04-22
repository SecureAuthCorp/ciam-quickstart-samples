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

export type Tokens = {
  claims: UserClaims;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
};

function toTokens(
  response: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
): Tokens {
  const idToken = response.id_token;
  if (!idToken) {
    throw new Error(
      "Token response did not include an ID token. Ensure the configured scopes include 'openid'.",
    );
  }
  const refreshToken = response.refresh_token;
  if (!refreshToken) {
    throw new Error(
      "Token response did not include a refresh token. Ensure the configured scopes include 'offline_access'.",
    );
  }
  return {
    claims: response.claims() as UserClaims,
    idToken,
    accessToken: response.access_token,
    refreshToken,
    accessTokenExpiresAt:
      Math.floor(Date.now() / 1000) + (response.expires_in ?? 0),
  };
}

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
// @description Exchange the authorization code for tokens (access + refresh + id token + expiry)
export async function exchangeCode(params: {
  currentUrl: URL;
  codeVerifier: string;
  expectedState: string;
}): Promise<Tokens> {
  const response = await client.authorizationCodeGrant(
    config,
    params.currentUrl,
    {
      pkceCodeVerifier: params.codeVerifier,
      expectedState: params.expectedState,
    },
  );
  return toTokens(response);
}
// @snippet:step3:end

// @snippet:step4:start
// @description Swap a refresh token for a fresh access token (and possibly a rotated refresh token)
export async function refreshTokens(refreshToken: string): Promise<Tokens> {
  const response = await client.refreshTokenGrant(config, refreshToken);
  return toTokens(response);
}
// @snippet:step4:end

export function buildLogoutUrl(idToken: string): URL {
  return client.buildEndSessionUrl(config, {
    post_logout_redirect_uri: requireEnv("POST_LOGOUT_URI"),
    id_token_hint: idToken,
  });
}

export { client };
