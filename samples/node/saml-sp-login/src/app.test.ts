import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("./saml.js", () => ({
  samlStrategy: {
    name: "saml",
    authenticate: vi.fn(),
  },
}));

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret";
});

const { createApp } = await import("./app.js");

describe("Node.js saml_sp_login", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  it("renders sign-in link when unauthenticated", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Sign in");
  });

  it("redirects /login through passport-saml authenticate", async () => {
    const { samlStrategy } = await import("./saml.js");
    (
      samlStrategy.authenticate as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(function (this: {
      redirect: (url: string) => void;
    }) {
      this.redirect("https://idp.example/saml/sso?SAMLRequest=mock");
    });
    const res = await request(app).get("/login");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("https://idp.example/saml/sso");
  });

  it("POST /saml/acs with a valid response logs in and redirects to /", async () => {
    const { samlStrategy } = await import("./saml.js");
    (
      samlStrategy.authenticate as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(function (this: {
      success: (user: object, info?: object) => void;
    }) {
      this.success(
        {
          nameID: "alice@example.com",
          nameIDFormat:
            "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
          attributes: { email: "alice@example.com" },
        },
        {},
      );
    });
    const res = await request(app).post("/saml/acs").send("SAMLResponse=mock");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("renders welcome message after authenticated session", async () => {
    const { samlStrategy } = await import("./saml.js");
    (
      samlStrategy.authenticate as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(function (this: {
      success: (user: object, info?: object) => void;
    }) {
      this.success(
        {
          nameID: "alice@example.com",
          nameIDFormat:
            "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
          attributes: {},
        },
        {},
      );
    });
    const agent = request.agent(app);
    await agent.post("/saml/acs").send("SAMLResponse=mock").expect(302);
    const res = await agent.get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Welcome, alice@example.com");
  });

  it("POST /saml/acs renders error page when SAML validation fails", async () => {
    const { samlStrategy } = await import("./saml.js");
    (
      samlStrategy.authenticate as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(function (this: {
      fail: (challenge: string, status: number) => void;
    }) {
      this.fail("Invalid signature", 401);
    });
    const res = await request(app).post("/saml/acs").send("SAMLResponse=mock");
    expect(res.status).toBe(200);
    expect(res.text).toContain("SAML authentication failed");
    expect(res.text).toContain("Invalid signature");
  });

  it("/logout destroys session and redirects home", async () => {
    const { samlStrategy } = await import("./saml.js");
    (
      samlStrategy.authenticate as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(function (this: {
      success: (user: object, info?: object) => void;
    }) {
      this.success(
        {
          nameID: "alice@example.com",
          attributes: {},
        },
        {},
      );
    });
    const agent = request.agent(app);
    await agent.post("/saml/acs").send("SAMLResponse=mock").expect(302);
    const res = await agent.get("/logout");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
    // Subsequent / should show signed-out page
    const after = await agent.get("/");
    expect(after.text).toContain("Sign in");
  });
});
