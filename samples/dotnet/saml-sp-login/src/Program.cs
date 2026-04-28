using System.Security.Claims;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Sustainsys.Saml2;
using Sustainsys.Saml2.AspNetCore2;
using Sustainsys.Saml2.Configuration;
using Sustainsys.Saml2.Metadata;
using Sustainsys.Saml2.WebSso;
using DotNetEnv;

// @snippet:step1:start
// @description Load environment variables from .env (searches parent dirs so `dotnet run --project src` finds the .env at the sample root). Existing env vars win.
Env.TraversePath().NoClobber().Load();
// @snippet:step1:end

var builder = WebApplication.CreateBuilder(args);

// @snippet:step2:start
// @description Configure cookie auth + SAML2 SP against your SecureAuth workspace.
// AllowUnsolicitedAuthnResponse enables IdP-initiated SSO alongside SP-initiated.
// The IdP signing certificate is loaded from disk via the path in SAML_IDP_SIGNING_CERT_PATH.
builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = Saml2Defaults.Scheme;
    })
    .AddCookie()
    .AddSaml2(options =>
    {
        options.SPOptions.EntityId = new EntityId(RequireEnv("SAML_SP_ENTITY_ID"));
        options.SPOptions.ReturnUrl = new Uri("https://localhost:4262/");

        var idp = new IdentityProvider(new EntityId(RequireEnv("SAML_IDP_ENTITY_ID")), options.SPOptions)
        {
            SingleSignOnServiceUrl = new Uri(RequireEnv("SAML_IDP_SSO_URL")),
            Binding = Saml2BindingType.HttpRedirect,
            AllowUnsolicitedAuthnResponse = true,
        };
        // Signing key must be added BEFORE LoadMetadata = false — the setter triggers
        // IdentityProvider.Validate() which requires SigningKeys to be non-empty.
        idp.SigningKeys.AddConfiguredKey(LoadIdpCert(RequireEnv("SAML_IDP_SIGNING_CERT_PATH")));
        idp.LoadMetadata = false;
        options.IdentityProviders.Add(idp);
    });

builder.Services.AddAuthorization();

static string RequireEnv(string name) =>
    Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"Missing required env var: {name}");

static X509Certificate2 LoadIdpCert(string path)
{
    var resolved = ResolveCertPath(path);
    if (resolved is null)
    {
        throw new FileNotFoundException(
            $"IdP signing cert not found searching for '{path}' from cwd up to filesystem root. " +
            $"Download it from the SecureAuth admin UI (SAML IdP → General → Download certificate) " +
            $"and save it at the sample root as {path}.");
    }
    return X509Certificate2.CreateFromPem(File.ReadAllText(resolved));
}

// Walk up from the current directory looking for the cert file (mirrors DotNetEnv's
// TraversePath behavior for .env). When `dotnet run --project src` runs the app, the
// working directory is `src/` but the cert lives at the sample root one level up.
static string? ResolveCertPath(string path)
{
    if (Path.IsPathRooted(path) && File.Exists(path)) return path;
    var fileName = Path.GetFileName(path);
    var dir = new DirectoryInfo(Environment.CurrentDirectory);
    while (dir is not null)
    {
        var candidate = Path.Combine(dir.FullName, fileName);
        if (File.Exists(candidate)) return candidate;
        dir = dir.Parent;
    }
    return null;
}
// @snippet:step2:end

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

// @snippet:step3:start
// @description Wire routes for sign-in challenge, signed-in display, and local sign-out.
// Sustainsys.Saml2 mounts the SP endpoints (ACS, metadata, SLO) under /Saml2 automatically,
// so /login just issues a Saml2 challenge and the library handles the rest.
app.MapGet("/", (HttpContext ctx) =>
    ctx.User.Identity?.IsAuthenticated == true
        ? Results.Content(Views.RenderSignedInPage(ctx.User), "text/html")
        : Results.Content(Views.RenderSignedOutPage(), "text/html"));

app.MapGet("/login", () => Results.Challenge(
    new AuthenticationProperties { RedirectUri = "/" },
    [Saml2Defaults.Scheme]));

// CIAM does not implement SAML SLO. Logout clears the local cookie and redirects home.
app.MapGet("/logout", () => Results.SignOut(
    new AuthenticationProperties { RedirectUri = "/" },
    [CookieAuthenticationDefaults.AuthenticationScheme]));
// @snippet:step3:end

app.Run("https://localhost:4262");

public partial class Program { }

static class Views
{
    public static string RenderSignedOutPage() => """
        <!doctype html>
        <html><head><title>SecureAuth .NET SAML Demo</title></head>
        <body>
          <h1>SecureAuth .NET SAML Demo</h1>
          <p><a href="/login">Sign in</a></p>
        </body></html>
        """;

    public static string RenderSignedInPage(ClaimsPrincipal user)
    {
        var nameId = Escape(user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.Identity?.Name ?? "there");
        return $"""
            <!doctype html>
            <html><head><title>SecureAuth .NET SAML Demo</title></head>
            <body>
              <h1>SecureAuth .NET SAML Demo</h1>
              <p>Welcome, {nameId}</p>
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
