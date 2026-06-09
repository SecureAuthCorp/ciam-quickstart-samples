import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { authorize } from "react-native-app-auth";
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
  refreshToken: null,
  tokenType: "Bearer",
  scopes: ["openid", "profile"],
  authorizationCode: "code_abc",
};

describe("login-pkce App", () => {
  beforeEach(() => {
    (authorize as jest.Mock).mockReset();
  });

  it("signs in, calls authorize with expected config, and renders welcome", async () => {
    (authorize as jest.Mock).mockResolvedValue(AUTHORIZE_RESULT);

    await render(<App />);
    await fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => expect(authorize).toHaveBeenCalledTimes(1));
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: "https://issuer.example/wsp",
        clientId: "test-client",
        redirectUrl: "com.secureauth.quickstart.rn.login://oauthredirect",
        scopes: ["openid", "profile"],
      }),
    );

    expect(await screen.findByText("Welcome, Jane Doe!")).toBeTruthy();
    expect(screen.getByText(/Access token expires:/)).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });
});
