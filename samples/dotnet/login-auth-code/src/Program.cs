using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using DotNetEnv;

// @snippet:step1:start
// @description Load environment variables from .env (searches parent dirs so `dotnet run --project src` finds the .env at the sample root). Existing env vars win.
Env.TraversePath().NoClobber().Load();
// @snippet:step1:end

var builder = WebApplication.CreateBuilder(args);

// @snippet:step2:start
// @description Configure cookie auth + OpenID Connect against your SecureAuth workspace
builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
    })
    .AddCookie()
    .AddOpenIdConnect(options =>
    {
        options.Authority = RequireEnv("ISSUER_URL");
        options.ClientId = RequireEnv("CLIENT_ID");
        options.ClientSecret = RequireEnv("CLIENT_SECRET");
        options.ResponseType = "code";
        options.UsePkce = true;
        options.SaveTokens = true;
        options.GetClaimsFromUserInfoEndpoint = true;
        // Keep OIDC claim names (given_name, family_name, email) as-is — the
        // default middleware remaps them to long xmlsoap URIs, which makes
        // FindFirst("given_name") return null in user code.
        options.MapInboundClaims = false;
        options.CallbackPath = "/callback";
        options.Scope.Clear();
        foreach (var scope in RequireEnv("SCOPES").Split(' ', StringSplitOptions.RemoveEmptyEntries))
            options.Scope.Add(scope);
    });

static string RequireEnv(string name) =>
    Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"Missing required env var: {name}");

builder.Services.AddAuthorization();
// @snippet:step2:end

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

// @snippet:step3:start
// @description Wire routes for sign-in redirect, user display, and sign-out
app.MapGet("/", (HttpContext ctx) =>
    ctx.User.Identity?.IsAuthenticated == true
        ? Results.Content(Views.RenderSignedInPage(ctx.User), "text/html")
        : Results.Content(Views.RenderSignedOutPage(), "text/html"));

app.MapGet("/login", () => Results.Challenge(
    new AuthenticationProperties { RedirectUri = "/" },
    [OpenIdConnectDefaults.AuthenticationScheme]));

app.MapGet("/logout", () => Results.SignOut(
    new AuthenticationProperties { RedirectUri = "/" },
    [CookieAuthenticationDefaults.AuthenticationScheme, OpenIdConnectDefaults.AuthenticationScheme]));
// @snippet:step3:end

app.Run("https://localhost:4260");

public partial class Program { }

static class Views
{
    public static string RenderSignedOutPage() => """
        <!doctype html>
        <html><head><title>SecureAuth .NET Auth Code Demo</title></head>
        <body>
          <h1>SecureAuth .NET Auth Code Demo</h1>
          <p><a href="/login">Sign in</a></p>
        </body></html>
        """;

    public static string RenderSignedInPage(ClaimsPrincipal user)
    {
        var given = Escape(user.FindFirst("given_name")?.Value ?? "");
        var family = Escape(user.FindFirst("family_name")?.Value ?? "");
        var email = Escape(user.FindFirst("email")?.Value ?? "");
        var fullName = $"{given} {family}".Trim();
        var name = string.IsNullOrWhiteSpace(fullName) ? "there" : fullName;
        var emailSuffix = email.Length > 0 ? $" ({email})" : "";
        return $"""
            <!doctype html>
            <html><head><title>SecureAuth .NET Auth Code Demo</title></head>
            <body>
              <h1>SecureAuth .NET Auth Code Demo</h1>
              <p>Welcome, {name}{emailSuffix}</p>
              <p><a href="/logout">Sign out</a></p>
            </body></html>
            """;
    }

    static string Escape(string s) => s
        .Replace("&", "&amp;")
        .Replace("<", "&lt;")
        .Replace(">", "&gt;")
        .Replace("\"", "&quot;")
        .Replace("'", "&#39;");
}
