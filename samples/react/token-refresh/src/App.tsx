// @snippet:step1:start
// @description Import the OIDC library
import { AuthProvider, useAuth } from "react-oidc-context";
// @snippet:step1:end

// @snippet:step2:start
// @description Request offline_access scope to receive a refresh token
const oidcConfig = {
  authority: import.meta.env.ISSUER_URL,
  client_id: import.meta.env.CLIENT_ID,
  redirect_uri: import.meta.env.REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.POST_LOGOUT_URI,
  scope: import.meta.env.SCOPES,
};
// @snippet:step2:end

// @snippet:step3:start
// @description Display token status and trigger manual refresh
function TokenStatus() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <p>Loading...</p>;
  }

  if (auth.error) {
    const hint = new URLSearchParams(window.location.search).get("error_hint");
    return (
      <div style={{ color: "red" }}>
        <p>Error: {auth.error.message}</p>
        {hint && <p>{hint}</p>}
        <button onClick={() => auth.signinRedirect()}>Try again</button>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <button onClick={() => auth.signinRedirect()}>Sign in</button>;
  }

  const expiresAt = auth.user?.expires_at
    ? new Date(auth.user.expires_at * 1000).toLocaleTimeString()
    : "unknown";

  const handleRefresh = async () => {
    try {
      await auth.signinSilent();
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
  };

  return (
    <div>
      <p>Welcome, {auth.user?.profile.given_name}</p>
      <p>Token expires at: {expiresAt}</p>
      <button onClick={handleRefresh}>Refresh token now</button>
      <br />
      <br />
      <button onClick={() => auth.signoutRedirect()}>Sign out</button>
    </div>
  );
}
// @snippet:step3:end

// @snippet:step4:start
// @description Wrap your app with AuthProvider
export default function App() {
  return (
    <AuthProvider {...oidcConfig}>
      <h1>SecureAuth Token Refresh Demo</h1>
      <TokenStatus />
    </AuthProvider>
  );
}
// @snippet:step4:end
