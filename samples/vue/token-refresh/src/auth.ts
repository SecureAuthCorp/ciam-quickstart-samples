// @snippet:step1:start
// @description Import the OIDC client library
import { UserManager, type User } from "oidc-client-ts";
// @snippet:step1:end

import { computed, ref } from "vue";

// @snippet:step2:start
// @description Configure the OIDC client — the offline_access scope (set in .env) enables refresh tokens
const userManager = new UserManager({
  authority: import.meta.env.ISSUER_URL,
  client_id: import.meta.env.CLIENT_ID,
  redirect_uri: import.meta.env.REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.POST_LOGOUT_URI,
  scope: import.meta.env.SCOPES,
});
// @snippet:step2:end

// @snippet:step3:start
// @description Keep reactive state in sync with automatic silent renewal
const isLoading = ref(true);
const isAuthenticated = ref(false);
const user = ref<User | null>(null);
const error = ref<Error | null>(null);

const expiresAt = computed(() =>
  user.value?.expires_at
    ? new Date(user.value.expires_at * 1000).toLocaleTimeString()
    : "unknown",
);

// addUserLoaded fires after sign-in AND after each automatic silent renew,
// so the UI's expiresAt stays current without any polling.
userManager.events.addUserLoaded((u) => {
  user.value = u;
  isAuthenticated.value = true;
  error.value = null;
});
userManager.events.addUserUnloaded(() => {
  user.value = null;
  isAuthenticated.value = false;
});
userManager.events.addSilentRenewError((err) => {
  error.value = err instanceof Error ? err : new Error(String(err));
});

let initialized = false;

async function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") && params.has("state")) {
      await userManager.signinRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.has("error")) {
      error.value = new Error(
        params.get("error_description") ??
          params.get("error") ??
          "Authentication failed",
      );
    } else {
      const existing = await userManager.getUser();
      if (existing && !existing.expired) {
        user.value = existing;
        isAuthenticated.value = true;
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err));
  } finally {
    isLoading.value = false;
  }
}

async function refresh() {
  try {
    await userManager.signinSilent();
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err));
  }
}

export function useAuth() {
  initialize();
  return {
    isLoading,
    isAuthenticated,
    user,
    error,
    expiresAt,
    refresh,
    signinRedirect: () => userManager.signinRedirect(),
    signoutRedirect: () => userManager.signoutRedirect(),
  };
}
// @snippet:step3:end
