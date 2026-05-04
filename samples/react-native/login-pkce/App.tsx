// @snippet:step1:start
// @description Import the AppAuth wrapper and the env loader
import Config from "react-native-config";
import {
  authorize,
  revoke,
  type AuthConfiguration,
} from "react-native-app-auth";
// @snippet:step1:end

// @snippet:step2:start
// @description Configure the OIDC client with your SecureAuth app settings
const authConfig: AuthConfiguration = {
  issuer: Config.ISSUER_URL!,
  clientId: Config.CLIENT_ID!,
  redirectUrl: Config.REDIRECT_URI!,
  scopes: Config.SCOPES!.split(" "),
};
// @snippet:step2:end

import React, { useEffect, useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { AuthorizeResult } from "react-native-app-auth";

// Hermes provides atob/btoa globally; declare for TypeScript since the RN
// typescript-config preset doesn't include the DOM lib.
declare const atob: (data: string) => string;

type IdTokenClaims = {
  given_name?: string;
  family_name?: string;
  name?: string;
  email?: string;
  sub?: string;
};

function decodeIdToken(idToken: string): IdTokenClaims {
  try {
    const [, payload] = idToken.split(".");
    if (!payload) return {};
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as IdTokenClaims;
  } catch {
    // Malformed / opaque token — fall through to the default welcome message
    return {};
  }
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function welcomeMessage(authState: AuthorizeResult): string {
  const claims = decodeIdToken(authState.idToken);
  const name =
    [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
    claims.name ||
    claims.email ||
    claims.sub ||
    "there";
  return `Welcome, ${name}!`;
}

export default function App() {
  const [authState, setAuthState] = useState<AuthorizeResult | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // @snippet:step3:start
  // @description Open the system browser, run Auth Code + PKCE, and receive the tokens
  async function signIn() {
    setError(null);
    setExpired(false);
    try {
      const result = await authorize(authConfig);
      setAuthState(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  // @snippet:step3:end

  // @snippet:step4:start
  // @description Revoke the access token at the IdP and clear local auth state
  async function signOut() {
    if (!authState) return;
    try {
      await revoke(authConfig, {
        tokenToRevoke: authState.accessToken,
        sendClientId: true,
      });
    } catch (e) {
      // Revocation is best-effort — proceed with local logout regardless.
      Alert.alert(
        "Sign-out warning",
        e instanceof Error ? e.message : String(e),
      );
    }
    setAuthState(null);
    setExpired(false);
  }
  // @snippet:step4:end

  // Without offline_access there's no refresh token — once the access token
  // expires the only path forward is a fresh sign-in. Schedule a timer that
  // surfaces this to the user the moment the token elapses.
  useEffect(() => {
    if (!authState) return;
    const ms =
      new Date(authState.accessTokenExpirationDate).getTime() - Date.now();
    if (ms <= 0) {
      setAuthState(null);
      setExpired(true);
      return;
    }
    const timer = setTimeout(() => {
      setAuthState(null);
      setExpired(true);
    }, ms);
    return () => clearTimeout(timer);
  }, [authState]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Text style={styles.heading}>SecureAuth React Native PKCE Demo</Text>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <Button title="Try again" onPress={signIn} />
          </View>
        )}
        {authState ? (
          <View>
            <Text style={styles.welcome}>{welcomeMessage(authState)}</Text>
            <Text>
              Access token expires:{" "}
              {formatLocal(authState.accessTokenExpirationDate)}
            </Text>
            <View style={{ height: 24 }} />
            <Button title="Sign out" onPress={signOut} />
          </View>
        ) : (
          !error && (
            <View>
              {expired && (
                <Text style={styles.expired}>
                  Session expired. Please sign in again.
                </Text>
              )}
              <Button title="Sign in" onPress={signIn} />
            </View>
          )
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  heading: { fontSize: 20, fontWeight: "600", marginBottom: 24 },
  welcome: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  expired: { color: "#900", marginBottom: 12 },
  errorBox: { padding: 12, backgroundColor: "#fee", marginBottom: 16 },
  errorText: { color: "#900" },
});
