// @snippet:step1:start
// @description Import the OIDC authentication library
import { AuthProvider, useAuth } from "react-oidc-context";
// @snippet:step1:end

// @snippet:step2:start
// @description Configure the OIDC client with your SecureAuth app settings
const oidcConfig = {
  authority: import.meta.env.ISSUER_URL,
  client_id: import.meta.env.CLIENT_ID,
  redirect_uri: import.meta.env.REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.POST_LOGOUT_URI,
  scope: import.meta.env.SCOPES,
};
// @snippet:step2:end

// @snippet:step3:start
// @description Add login and logout buttons that redirect to SecureAuth
function AuthButtons() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Error: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <div>
        <p>
          Welcome, {auth.user?.profile.given_name}{" "}
          {auth.user?.profile.family_name} ({auth.user?.profile.email})
        </p>
        <button onClick={() => auth.signoutRedirect()}>Sign out</button>
      </div>
    );
  }

  return <button onClick={() => auth.signinRedirect()}>Sign in</button>;
}
// @snippet:step3:end

// @snippet:step4:start
// @description Wrap your app with the AuthProvider to enable authentication
export default function App() {
  return (
    <AuthProvider {...oidcConfig}>
      <h1>SecureAuth React PKCE Demo</h1>
      <AuthButtons />
    </AuthProvider>
  );
}
// @snippet:step4:end
