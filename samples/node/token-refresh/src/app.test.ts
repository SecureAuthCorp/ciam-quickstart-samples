import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const mockRefreshTokens = vi.fn();

vi.mock("./auth.js", () => ({
  buildAuthUrl: vi.fn(async (_verifier: string, state: string) => {
    const url = new URL("https://idp.example/authorize");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", "mock-challenge");
    return url;
  }),
  exchangeCode: vi.fn(async () => ({
    claims: {
      sub: "user-1",
      given_name: "Test",
      family_name: "User",
      email: "test@example.com",
    },
    idToken: "mock-id-token",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token-1",
    accessTokenExpiresAt: 1700000000,
  })),
  refreshTokens: mockRefreshTokens,
  buildLogoutUrl: vi.fn(() => new URL("https://idp.example/end_session")),
  client: {
    randomPKCECodeVerifier: () => "test-verifier",
    randomState: () => "test-state",
    calculatePKCECodeChallenge: async () => "mock-challenge",
  },
}));

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret";
  process.env.REDIRECT_URI = "https://localhost:4261/callback";
});

const { createApp } = await import("./app.js");

describe("Node.js server_token_refresh", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
    mockRefreshTokens.mockReset();
    mockRefreshTokens.mockResolvedValue({
      claims: {
        sub: "user-1",
        given_name: "Test",
        family_name: "User",
        email: "test@example.com",
      },
      idToken: "mock-id-token-2",
      accessToken: "mock-access-token-2",
      refreshToken: "mock-refresh-token-2",
      accessTokenExpiresAt: 1700003600,
    });
  });

  it("renders sign-in link when unauthenticated", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Sign in");
  });

  it("redirects /login to authorization URL with state and code_challenge", async () => {
    const res = await request(app).get("/login");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("state=test-state");
    expect(res.headers.location).toContain("code_challenge=mock-challenge");
  });

  it("renders error page when /callback receives ?error=...", async () => {
    const res = await request(app).get(
      "/callback?error=access_denied&error_description=User%20denied%20access",
    );
    expect(res.status).toBe(200);
    expect(res.text).toContain("User denied access");
  });

  it("/callback with valid code+state populates session and redirects to /", async () => {
    const agent = request.agent(app);
    await agent.get("/login").expect(302);
    const cb = await agent.get("/callback?code=abc&state=test-state");
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe("/");
  });

  it("renders welcome + expiry + refresh form after authenticated session", async () => {
    const agent = request.agent(app);
    await agent.get("/login").expect(302);
    await agent.get("/callback?code=abc&state=test-state").expect(302);
    const res = await agent.get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Welcome, Test User (test@example.com)");
    expect(res.text).toContain("Access token expires at:");
    expect(res.text).toContain("Refresh token now");
  });

  it("POST /refresh on authenticated session calls refreshTokens and redirects to /", async () => {
    const agent = request.agent(app);
    await agent.get("/login").expect(302);
    await agent.get("/callback?code=abc&state=test-state").expect(302);
    const res = await agent.post("/refresh");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(mockRefreshTokens).toHaveBeenCalledOnce();
    expect(mockRefreshTokens).toHaveBeenCalledWith("mock-refresh-token-1");
  });

  it("POST /refresh renders error page when refreshTokens rejects", async () => {
    mockRefreshTokens.mockRejectedValueOnce(new Error("Refresh token invalid"));
    const agent = request.agent(app);
    await agent.get("/login").expect(302);
    await agent.get("/callback?code=abc&state=test-state").expect(302);
    const res = await agent.post("/refresh");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Refresh token invalid");
  });

  it("/logout destroys session and redirects to end_session endpoint", async () => {
    const agent = request.agent(app);
    await agent.get("/login").expect(302);
    await agent.get("/callback?code=abc&state=test-state").expect(302);
    const res = await agent.get("/logout");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("end_session");
  });
});
