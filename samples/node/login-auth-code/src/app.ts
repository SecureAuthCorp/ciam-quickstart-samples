import express, { Express } from "express";
import session from "express-session";
import {
  buildAuthUrl,
  buildLogoutUrl,
  exchangeCode,
  client,
  UserClaims,
} from "./auth.js";

declare module "express-session" {
  interface SessionData {
    user?: UserClaims;
    idToken?: string;
    codeVerifier?: string;
    state?: string;
  }
}

// @snippet:step4:start
// @description Wire the OIDC helpers into Express routes with a server-managed session
export function createApp(): Express {
  const app = express();

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
      },
    }),
  );

  app.get("/", (req, res) => {
    if (req.session.user) {
      res.send(renderSignedInPage(req.session.user));
    } else {
      res.send(renderSignedOutPage());
    }
  });

  app.get("/login", async (req, res) => {
    const codeVerifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    req.session.codeVerifier = codeVerifier;
    req.session.state = state;
    const url = await buildAuthUrl(codeVerifier, state);
    res.redirect(url.href);
  });

  app.get("/callback", async (req, res) => {
    const errorParam =
      typeof req.query.error === "string" ? req.query.error : undefined;
    if (errorParam) {
      const description =
        typeof req.query.error_description === "string"
          ? req.query.error_description
          : errorParam;
      const hint =
        typeof req.query.error_hint === "string"
          ? req.query.error_hint
          : undefined;
      res.send(renderErrorPage(description, hint));
      return;
    }

    const codeVerifier = req.session.codeVerifier;
    const expectedState = req.session.state;
    if (!codeVerifier || !expectedState) {
      res.send(renderErrorPage("Session expired. Please try again."));
      return;
    }

    try {
      const { claims, idToken } = await exchangeCode({
        currentUrl: new URL(req.url, `https://${req.headers.host}`),
        codeVerifier,
        expectedState,
      });
      req.session.user = claims;
      req.session.idToken = idToken;
      delete req.session.codeVerifier;
      delete req.session.state;
      res.redirect("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      res.send(renderErrorPage(message));
    }
  });

  app.get("/logout", (req, res) => {
    const idToken = req.session.idToken;
    req.session.destroy(() => {
      if (idToken) {
        res.redirect(buildLogoutUrl(idToken).href);
      } else {
        res.redirect("/");
      }
    });
  });

  return app;
}
// @snippet:step4:end

function renderSignedOutPage(): string {
  return `<!doctype html>
<html><head><title>SecureAuth Node.js Auth Code Demo</title></head>
<body>
  <h1>SecureAuth Node.js Auth Code Demo</h1>
  <p><a href="/login">Sign in</a></p>
</body></html>`;
}

function renderSignedInPage(user: UserClaims): string {
  const name =
    [user.given_name, user.family_name].filter(Boolean).join(" ") || "there";
  const email = user.email ?? "";
  return `<!doctype html>
<html><head><title>SecureAuth Node.js Auth Code Demo</title></head>
<body>
  <h1>SecureAuth Node.js Auth Code Demo</h1>
  <p>Welcome, ${name}${email ? ` (${email})` : ""}</p>
  <p><a href="/logout">Sign out</a></p>
</body></html>`;
}

function renderErrorPage(message: string, hint?: string): string {
  return `<!doctype html>
<html><head><title>SecureAuth Node.js Auth Code Demo</title></head>
<body>
  <h1>SecureAuth Node.js Auth Code Demo</h1>
  <div style="color: red">
    <p>Error: ${message}</p>
    ${hint ? `<p>${hint}</p>` : ""}
    <p><a href="/login">Try again</a></p>
  </div>
</body></html>`;
}
