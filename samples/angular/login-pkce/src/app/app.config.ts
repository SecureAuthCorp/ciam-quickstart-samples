// @snippet:step1:start
// @description Install and configure the OIDC module
import { ApplicationConfig } from "@angular/core";
import { provideAuth } from "angular-auth-oidc-client";
import { environment } from "../environments/environment";
// @snippet:step1:end

// @snippet:step2:start
// @description Configure the OIDC client with your SecureAuth app settings
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
      },
    }),
  ],
};
// @snippet:step2:end
