// @snippet:step1:start
// @description Import AppAuth, env loader, and the secure-storage backend
import Config from "react-native-config";
import {
  authorize,
  refresh,
  revoke,
  type AuthConfiguration,
} from "react-native-app-auth";
import * as Keychain from "react-native-keychain";
// @snippet:step1:end

// @snippet:step2:start
// @description Configure the OIDC client — the offline_access scope (set in .env) enables refresh tokens
const authConfig: AuthConfiguration = {
  issuer: Config.ISSUER_URL!,
  clientId: Config.CLIENT_ID!,
  redirectUrl: Config.REDIRECT_URI!,
  scopes: Config.SCOPES!.split(" "),
};
// @snippet:step2:end

import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { AuthorizeResult, RefreshResult } from "react-native-app-auth";

const KEYCHAIN_SERVICE = "com.secureauth.quickstart.refreshtoken";

// Hermes provides atob/btoa globally; declare for TypeScript since the RN
// typescript-config preset doesn't include the DOM lib.
declare const atob: (data: string) => string;

function formatLocal(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

type IdTokenClaims = {
  given_name?: string;
  family_name?: string;
  name?: string;
  email?: string;
  sub?: string;
};

function decodeIdToken(idToken: string): IdTokenClaims {
  const [, payload] = idToken.split(".");
  if (!payload) return {};
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded)) as IdTokenClaims;
}

function welcomeMessage(...tokens: (string | null | undefined)[]): string {
  for (const token of tokens) {
    if (!token) continue;
    const claims = decodeIdToken(token);
    const name =
      [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
      claims.name ||
      claims.email ||
      claims.sub;
    if (name) return `Welcome, ${name}!`;
  }
  return "Welcome, there!";
}

type Tokens = {
  accessToken: string;
  accessTokenExpirationDate: string;
  refreshToken: string | null;
  idToken: string | null;
};

export default function App() {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [error, setError] = useState<string | null>(null);

  // @snippet:step3:start
  // @description Trigger login with the offline_access scope and capture the refresh token
  const signIn = useCallback(async () => {
    setError(null);
    try {
      const result: AuthorizeResult = await authorize(authConfig);
      const next: Tokens = {
        accessToken: result.accessToken,
        accessTokenExpirationDate: result.accessTokenExpirationDate,
        refreshToken: result.refreshToken ?? null,
        idToken: result.idToken ?? null,
      };
      setTokens(next);
      if (next.refreshToken) {
        await persistRefreshToken(next.refreshToken);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  // @snippet:step3:end

  // @snippet:step4:start
  // @description Persist the refresh token in platform secure storage (Keychain on iOS, EncryptedSharedPreferences on Android)
  async function persistRefreshToken(refreshToken: string): Promise<void> {
    await Keychain.setGenericPassword("refreshToken", refreshToken, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  }

  async function loadRefreshToken(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });
    return credentials ? credentials.password : null;
  }

  async function clearRefreshToken(): Promise<void> {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  }
  // @snippet:step4:end

  // @snippet:step5:start
  // @description Exchange the refresh token for a new access token; on failure clear local state and require re-login
  const refreshTokens = useCallback(async () => {
    setError(null);
    try {
      const stored = tokens?.refreshToken ?? (await loadRefreshToken());
      if (!stored) {
        setError("No refresh token available. Sign in first.");
        return;
      }
      const result: RefreshResult = await refresh(authConfig, {
        refreshToken: stored,
      });
      const next: Tokens = {
        accessToken: result.accessToken,
        accessTokenExpirationDate: result.accessTokenExpirationDate,
        refreshToken: result.refreshToken ?? stored,
        // Refresh responses don't always include a new id_token — keep the
        // previous one so the welcome message stays populated.
        idToken: result.idToken ?? tokens?.idToken ?? null,
      };
      setTokens(next);
      if (next.refreshToken && next.refreshToken !== stored) {
        await persistRefreshToken(next.refreshToken);
      }
    } catch (e) {
      // Refresh tokens can be revoked or expire — clear local state and surface the error.
      await clearRefreshToken();
      setTokens(null);
      setError(
        e instanceof Error
          ? `Refresh failed (${e.message}). Sign in again.`
          : `Refresh failed. Sign in again.`,
      );
    }
  }, [tokens]);
  // @snippet:step5:end

  async function signOut() {
    if (!tokens) return;
    try {
      await revoke(authConfig, {
        tokenToRevoke: tokens.accessToken,
        sendClientId: true,
      });
    } catch (e) {
      Alert.alert(
        "Sign-out warning",
        e instanceof Error ? e.message : String(e),
      );
    }
    await clearRefreshToken();
    setTokens(null);
  }

  // On mount, try to silently refresh from a stored token (returning users skip the browser).
  useEffect(() => {
    (async () => {
      const stored = await loadRefreshToken();
      if (!stored) return;
      try {
        const result: RefreshResult = await refresh(authConfig, {
          refreshToken: stored,
        });
        setTokens({
          accessToken: result.accessToken,
          accessTokenExpirationDate: result.accessTokenExpirationDate,
          refreshToken: result.refreshToken ?? stored,
          idToken: result.idToken ?? null,
        });
      } catch {
        // Stored token is no longer valid — let the user sign in.
        await clearRefreshToken();
      }
    })();
  }, []);

  // Auto-refresh the access token the moment it expires.
  useEffect(() => {
    if (!tokens) return;
    const ms =
      new Date(tokens.accessTokenExpirationDate).getTime() - Date.now();
    if (ms <= 0) {
      refreshTokens();
      return;
    }
    const timer = setTimeout(() => refreshTokens(), ms);
    return () => clearTimeout(timer);
  }, [tokens, refreshTokens]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Text style={styles.heading}>SecureAuth Token Refresh Demo</Text>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {tokens ? (
          <View>
            <Text style={styles.welcome}>
              {welcomeMessage(tokens.idToken, tokens.accessToken)}
            </Text>
            <Text>
              Access token expires:{" "}
              {formatLocal(tokens.accessTokenExpirationDate)}
            </Text>
            <Text>
              Refresh token stored: {tokens.refreshToken ? "yes" : "no"}
            </Text>
            <View style={{ height: 12 }} />
            <Button title="Refresh token now" onPress={refreshTokens} />
            <View style={{ height: 24 }} />
            <Button title="Sign out" onPress={signOut} />
          </View>
        ) : (
          <Button title="Sign in" onPress={signIn} />
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
  errorBox: { padding: 12, backgroundColor: "#fee", marginBottom: 16 },
  errorText: { color: "#900" },
});
