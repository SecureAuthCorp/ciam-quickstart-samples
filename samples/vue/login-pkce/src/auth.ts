// @snippet:step1:start
// @description Import the OIDC client library
import { UserManager, type User } from "oidc-client-ts";
// @snippet:step1:end

import { ref } from "vue";

// @snippet:step2:start
// @description Configure the OIDC client with your SecureAuth app settings
const userManager = new UserManager({
  authority: import.meta.env.ISSUER_URL,
  client_id: import.meta.env.CLIENT_ID,
  redirect_uri: import.meta.env.REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.POST_LOGOUT_URI,
  scope: import.meta.env.SCOPES,
});
// @snippet:step2:end

// @snippet:step3:start
// @description Build a useAuth composable with reactive auth state
const isLoading = ref(true);
const isAuthenticated = ref(false);
const user = ref<User | null>(null);
const error = ref<Error | null>(null);

let initialized = false;

async function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") && params.has("state")) {
      const signedIn = await userManager.signinRedirectCallback();
      user.value = signedIn;
      isAuthenticated.value = true;
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

export function useAuth() {
  initialize();
  return {
    isLoading,
    isAuthenticated,
    user,
    error,
    signinRedirect: () => userManager.signinRedirect(),
    signoutRedirect: () => userManager.signoutRedirect(),
  };
}
// @snippet:step3:end
