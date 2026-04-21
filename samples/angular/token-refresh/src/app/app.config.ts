// @snippet:step1:start
// @description Install and configure the OIDC module
import { ApplicationConfig } from "@angular/core";
import { provideAuth } from "angular-auth-oidc-client";
import { environment } from "../environments/environment";
// @snippet:step1:end

// @snippet:step2:start
// @description Request offline_access scope to receive a refresh token
export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth({
      config: {
        authority: environment.issuerUrl,
        clientId: environment.clientId,
        redirectUrl: environment.redirectUri,
        postLogoutRedirectUri: environment.postLogoutUri,
        scope: environment.scopes,
        responseType: "code",
        useRefreshToken: true,
        silentRenew: true,
      },
    }),
  ],
};
// @snippet:step2:end
