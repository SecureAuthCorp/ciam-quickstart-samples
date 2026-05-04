import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { authorize } from "react-native-app-auth";
import * as Keychain from "react-native-keychain";
import App from "../App";

const ID_TOKEN =
  "eyJhbGciOiJSUzI1NiJ9." +
  "eyJnaXZlbl9uYW1lIjoiSmFuZSIsImZhbWlseV9uYW1lIjoiRG9lIiwic3ViIjoidTEifQ." +
  "sig";

const AUTHORIZE_RESULT = {
  accessToken: "at_abc",
  accessTokenExpirationDate: new Date(Date.now() + 3600_000).toISOString(),
  authorizeAdditionalParameters: {},
  tokenAdditionalParameters: {},
  idToken: ID_TOKEN,
  refreshToken: "rt_abc",
  tokenType: "Bearer",
  scopes: ["openid", "profile", "offline_access"],
  authorizationCode: "code_abc",
};

describe("token-refresh App", () => {
  beforeEach(() => {
    (authorize as jest.Mock).mockReset();
    (Keychain.getGenericPassword as jest.Mock).mockReset();
    (Keychain.setGenericPassword as jest.Mock).mockReset();
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);
  });

  it("signs in, persists refresh token, and renders welcome + refresh button", async () => {
    (authorize as jest.Mock).mockResolvedValue(AUTHORIZE_RESULT);

    render(<App />);
    fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => expect(authorize).toHaveBeenCalledTimes(1));
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: "https://issuer.example/wsp",
        clientId: "test-client",
        redirectUrl: "com.secureauth.quickstart.rn.refresh://oauthredirect",
        scopes: ["openid", "profile"],
      }),
    );

    await waitFor(() =>
      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        "refreshToken",
        "rt_abc",
        {
          service: "com.secureauth.quickstart.refreshtoken",
          accessible: "AccessibleWhenUnlocked",
        },
      ),
    );

    expect(await screen.findByText("Welcome, Jane Doe!")).toBeTruthy();
    expect(screen.getByText("Refresh token now")).toBeTruthy();
  });
});
