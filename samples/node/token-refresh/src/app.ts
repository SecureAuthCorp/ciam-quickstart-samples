import express, { Express } from "express";
import session from "express-session";
import {
  buildAuthUrl,
  buildLogoutUrl,
  client,
  exchangeCode,
  refreshTokens,
  UserClaims,
} from "./auth.js";
import { requireEnv } from "./env.js";

declare module "express-session" {
  interface SessionData {
    user?: UserClaims;
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    codeVerifier?: string;
    state?: string;
  }
}

// @snippet:step5:start
// @description Wire the OIDC helpers into Express routes with a server-managed session and POST /refresh
import crypto from "node:crypto";

function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  console.warn(
    "[warn] SESSION_SECRET not set — generating a random value. Set SESSION_SECRET for production so sessions survive restarts.",
  );
  return crypto.randomBytes(32).toString("hex");
}

export function createApp(): Express {
  const app = express();

  app.use(
    session({
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
      },
    }),
  );

  // Auto-refresh the access token when it's within 60s of expiring.
  // Runs on every request that has a session with a refresh token.
  app.use(async (req, _res, next) => {
    const now = Math.floor(Date.now() / 1000);
    if (
      req.session.refreshToken &&
      (req.session.accessTokenExpiresAt ?? 0) - now < 60
    ) {
      try {
        const tokens = await refreshTokens(req.session.refreshToken);
        req.session.user = tokens.claims;
        req.session.idToken = tokens.idToken;
        req.session.accessToken = tokens.accessToken;
        req.session.refreshToken = tokens.refreshToken;
        req.session.accessTokenExpiresAt = tokens.accessTokenExpiresAt;
      } catch {
        // Refresh failed — clear auth fields; next route will render sign-in.
        delete req.session.user;
        delete req.session.idToken;
        delete req.session.accessToken;
        delete req.session.refreshToken;
        delete req.session.accessTokenExpiresAt;
      }
    }
    next();
  });

  app.get("/", (req, res) => {
    if (req.session.user && req.session.accessTokenExpiresAt) {
      const expiresAt = new Date(
        req.session.accessTokenExpiresAt * 1000,
      ).toLocaleTimeString();
      res.send(renderSignedInPage(req.session.user, expiresAt));
    } else {
      res.send(renderSignedOutPage());
    }
  });

  app.get("/login", async (req, res, next) => {
    try {
      const codeVerifier = client.randomPKCECodeVerifier();
      const state = client.randomState();
      req.session.codeVerifier = codeVerifier;
      req.session.state = state;
      const url = await buildAuthUrl(codeVerifier, state);
      res.redirect(url.href);
    } catch (err) {
      next(err);
    }
  });

  app.get("/callback", async (req, res, next) => {
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
      const tokens = await exchangeCode({
        currentUrl: new URL(req.url, requireEnv("REDIRECT_URI")),
        codeVerifier,
        expectedState,
      });
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });
      req.session.user = tokens.claims;
      req.session.idToken = tokens.idToken;
      req.session.accessToken = tokens.accessToken;
      req.session.refreshToken = tokens.refreshToken;
      req.session.accessTokenExpiresAt = tokens.accessTokenExpiresAt;
      res.redirect("/");
    } catch (err) {
      if (res.headersSent) {
        next(err);
        return;
      }
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      res.send(renderErrorPage(message));
    }
  });

  app.post(
    "/refresh",
    express.urlencoded({ extended: false }),
    async (req, res, next) => {
      const refreshToken = req.session.refreshToken;
      if (!refreshToken) {
        res.send(renderErrorPage("No session — sign in first."));
        return;
      }
      try {
        const tokens = await refreshTokens(refreshToken);
        req.session.idToken = tokens.idToken;
        req.session.accessToken = tokens.accessToken;
        req.session.refreshToken = tokens.refreshToken;
        req.session.accessTokenExpiresAt = tokens.accessTokenExpiresAt;
        res.redirect("/");
      } catch (err) {
        if (res.headersSent) {
          next(err);
          return;
        }
        const message = err instanceof Error ? err.message : "Refresh failed";
        res.send(renderErrorPage(message));
      }
    },
  );

  app.get("/logout", (req, res) => {
    const idToken = req.session.idToken;
    req.session.destroy((err) => {
      if (err) {
        console.error("session destroy error:", err);
      }
      if (idToken) {
        res.redirect(buildLogoutUrl(idToken).href);
      } else {
        res.redirect("/");
      }
    });
  });

  return app;
}
// @snippet:step5:end

function renderSignedOutPage(): string {
  return `<!doctype html>
<html><head><title>SecureAuth Node.js Token Refresh Demo</title></head>
<body>
  <h1>SecureAuth Node.js Token Refresh Demo</h1>
  <p><a href="/login">Sign in</a></p>
</body></html>`;
}

function renderSignedInPage(
  user: UserClaims,
  expiresAtDisplay: string,
): string {
  const name =
    [user.given_name, user.family_name].filter(Boolean).join(" ") || "there";
  const email = user.email ?? "";
  return `<!doctype html>
<html><head><title>SecureAuth Node.js Token Refresh Demo</title></head>
<body>
  <h1>SecureAuth Node.js Token Refresh Demo</h1>
  <p>Welcome, ${escapeHtml(name)}${email ? ` (${escapeHtml(email)})` : ""}</p>
  <p>Access token expires at: ${escapeHtml(expiresAtDisplay)}</p>
  <form method="POST" action="/refresh">
    <button type="submit">Refresh token now</button>
  </form>
  <p><a href="/logout">Sign out</a></p>
</body></html>`;
}

function renderErrorPage(message: string, hint?: string): string {
  return `<!doctype html>
<html><head><title>SecureAuth Node.js Token Refresh Demo</title></head>
<body>
  <h1>SecureAuth Node.js Token Refresh Demo</h1>
  <div style="color: red">
    <p>Error: ${escapeHtml(message)}</p>
    ${hint ? `<p>${escapeHtml(hint)}</p>` : ""}
    <p><a href="/login">Try again</a></p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}
