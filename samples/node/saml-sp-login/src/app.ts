import express, { Express } from "express";
import session from "express-session";
import passport from "passport";
import crypto from "node:crypto";
import { samlStrategy, SamlUser } from "./saml.js";

declare module "express-session" {
  interface SessionData {
    user?: SamlUser;
  }
}

declare global {
  namespace Express {
    interface User extends SamlUser {}
  }
}

// Cast required: @node-saml/passport-saml bundles its own @types/express (v4),
// while this project uses @types/express v5. The two Request types are
// structurally incompatible at the TypeScript level even though they are
// identical at runtime. The cast is safe because passport only calls
// strategy.authenticate() with the actual Express Request object.
passport.use(samlStrategy as unknown as passport.Strategy);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: Express.User, done) => done(null, user));

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

  app.use(express.urlencoded({ extended: false }));
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

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/", (req, res) => {
    if (req.user) {
      res.send(renderSignedInPage(req.user as SamlUser));
    } else {
      res.send(renderSignedOutPage());
    }
  });

  // @snippet:step2:start
  // @description Initiate SP-initiated SSO — redirect the user to SecureAuth's SAML SSO endpoint
  app.get(
    "/login",
    passport.authenticate("saml", {
      failureRedirect: "/",
      failureFlash: false,
    }),
  );
  // @snippet:step2:end

  // @snippet:step3:start
  // @description Validate the SAML response at the ACS endpoint and establish the session — the same handler accepts both SP-initiated and IdP-initiated responses (validateInResponseTo: "ifPresent")
  app.post("/saml/acs", (req, res, next) => {
    passport.authenticate(
      "saml",
      (
        err: Error | null,
        user: SamlUser | false,
        info: { message?: string } | string | undefined,
      ) => {
        if (err) {
          return res.send(renderErrorPage(err.message));
        }
        if (!user) {
          const message =
            typeof info === "string"
              ? info
              : (info?.message ?? "SAML authentication failed");
          return res.send(renderErrorPage(message));
        }
        req.logIn(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          res.redirect("/");
        });
      },
    )(req, res, next);
  });
  // @snippet:step3:end

  app.get("/logout", (req, res, next) => {
    req.logOut((logoutErr) => {
      if (logoutErr) return next(logoutErr);
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("session destroy error:", destroyErr);
        }
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });

  return app;
}

function renderSignedOutPage(): string {
  return `<!doctype html>
<html><head><title>SecureAuth Node.js SAML Demo</title></head>
<body>
  <h1>SecureAuth Node.js SAML Demo</h1>
  <p><a href="/login">Sign in</a></p>
</body></html>`;
}

function renderSignedInPage(user: SamlUser): string {
  return `<!doctype html>
<html><head><title>SecureAuth Node.js SAML Demo</title></head>
<body>
  <h1>SecureAuth Node.js SAML Demo</h1>
  <p>Welcome, ${escapeHtml(user.nameID)}</p>
  <p><a href="/logout">Sign out</a></p>
</body></html>`;
}

function renderErrorPage(message: string): string {
  return `<!doctype html>
<html><head><title>SecureAuth Node.js SAML Demo</title></head>
<body>
  <h1>SecureAuth Node.js SAML Demo</h1>
  <div style="color: red">
    <p>SAML authentication failed: ${escapeHtml(message)}</p>
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
