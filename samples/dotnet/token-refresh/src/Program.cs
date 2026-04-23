// @snippet:step1:start
// @description Import the ASP.NET Core OIDC/cookie middleware plus Duende.IdentityModel (used later for the refresh-token grant) and DotNetEnv for `.env` loading
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Duende.IdentityModel.Client;
using DotNetEnv;

// Searches parent dirs so `dotnet run --project src` finds the .env at the sample root. Existing env vars win.
Env.TraversePath().NoClobber().Load();
// @snippet:step1:end

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient();

// @snippet:step2:start
// @description Configure cookie auth + OpenID Connect; wire OnValidatePrincipal so every authenticated request can auto-refresh the access token
builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
    })
    .AddCookie(options =>
    {
        options.Events.OnValidatePrincipal = ValidatePrincipalWithRefresh;
    })
    .AddOpenIdConnect(options =>
    {
        options.Authority = RequireEnv("ISSUER_URL");
        options.ClientId = RequireEnv("CLIENT_ID");
        options.ClientSecret = RequireEnv("CLIENT_SECRET");
        options.ResponseType = "code";
        options.UsePkce = true;
        options.SaveTokens = true;
        options.GetClaimsFromUserInfoEndpoint = true;
        // Keep OIDC claim names (given_name, family_name, email) as-is — the default
        // middleware remaps them to long xmlsoap URIs, which makes FindFirst("given_name")
        // return null in user code.
        options.MapInboundClaims = false;
        options.CallbackPath = "/callback";
        options.Scope.Clear();
        foreach (var scope in RequireEnv("SCOPES").Split(' ', StringSplitOptions.RemoveEmptyEntries))
            options.Scope.Add(scope);
    });

builder.Services.AddAuthorization();
// @snippet:step2:end

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

// @snippet:step3:start
// @description Swap a refresh token for a fresh access token via the OIDC token endpoint
static async Task<TokenResponse> RefreshTokensAsync(
    IHttpClientFactory httpFactory,
    string refreshToken)
{
    var http = httpFactory.CreateClient();
    var disco = await http.GetDiscoveryDocumentAsync(RequireEnv("ISSUER_URL"));
    if (disco.IsError)
        throw new InvalidOperationException($"Discovery failed: {disco.Error}");

    return await http.RequestRefreshTokenAsync(new RefreshTokenRequest
    {
        Address = disco.TokenEndpoint,
        ClientId = RequireEnv("CLIENT_ID"),
        ClientSecret = RequireEnv("CLIENT_SECRET"),
        RefreshToken = refreshToken,
        ClientCredentialStyle = ClientCredentialStyle.PostBody,
    });
}
// @snippet:step3:end

// @snippet:step4:start
// @description Routes: user display, sign-in, manual refresh (POST /refresh), sign-out
app.MapGet("/", async (HttpContext ctx) =>
{
    if (ctx.User.Identity?.IsAuthenticated != true)
        return Results.Content(Views.RenderSignedOutPage(), "text/html");

    var expiresAtRaw = await ctx.GetTokenAsync("expires_at");
    var expiresAtDisplay = DateTimeOffset.TryParse(expiresAtRaw, out var dt)
        ? dt.ToLocalTime().ToString("h:mm:ss tt")
        : "unknown";
    return Results.Content(Views.RenderSignedInPage(ctx.User, expiresAtDisplay), "text/html");
});

app.MapGet("/login", () => Results.Challenge(
    new AuthenticationProperties { RedirectUri = "/" },
    [OpenIdConnectDefaults.AuthenticationScheme]));

app.MapPost("/refresh", async (HttpContext ctx, IHttpClientFactory httpFactory) =>
{
    var authResult = await ctx.AuthenticateAsync();
    if (!authResult.Succeeded || authResult.Properties is null)
        return Results.Redirect("/");

    var refreshToken = authResult.Properties.GetTokenValue("refresh_token");
    if (refreshToken is null) return Results.Redirect("/");

    try
    {
        var tokens = await RefreshTokensAsync(httpFactory, refreshToken);
        if (tokens.IsError)
            return Results.Content(
                Views.RenderErrorPage(tokens.Error ?? "refresh failed"),
                "text/html");

        UpdateAuthProperties(authResult.Properties, tokens);
        await ctx.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            authResult.Principal!,
            authResult.Properties);
        return Results.Redirect("/");
    }
    catch (Exception ex)
    {
        return Results.Content(Views.RenderErrorPage(ex.Message), "text/html");
    }
});

app.MapGet("/logout", () => Results.SignOut(
    new AuthenticationProperties { RedirectUri = "/" },
    [CookieAuthenticationDefaults.AuthenticationScheme, OpenIdConnectDefaults.AuthenticationScheme]));

static void UpdateAuthProperties(AuthenticationProperties props, TokenResponse tokens)
{
    if (tokens.AccessToken is not null)
        props.UpdateTokenValue("access_token", tokens.AccessToken);
    if (tokens.RefreshToken is not null)
        props.UpdateTokenValue("refresh_token", tokens.RefreshToken);
    if (tokens.IdentityToken is not null)
        props.UpdateTokenValue("id_token", tokens.IdentityToken);
    if (tokens.ExpiresIn > 0)
        props.UpdateTokenValue(
            "expires_at",
            DateTimeOffset.UtcNow.AddSeconds(tokens.ExpiresIn).ToString("o"));
}
// @snippet:step4:end

// @snippet:step5:start
// @description Auto-refresh via the cookie auth OnValidatePrincipal event — runs on every authenticated request
static async Task ValidatePrincipalWithRefresh(CookieValidatePrincipalContext ctx)
{
    var expiresAt = ctx.Properties.GetTokenValue("expires_at");
    if (expiresAt is null || !DateTimeOffset.TryParse(expiresAt, out var expiry)) return;
    if (expiry - DateTimeOffset.UtcNow > TimeSpan.FromSeconds(60)) return;

    var refreshToken = ctx.Properties.GetTokenValue("refresh_token");
    if (refreshToken is null)
    {
        ctx.RejectPrincipal();
        return;
    }

    var httpFactory = ctx.HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>();
    try
    {
        var tokens = await RefreshTokensAsync(httpFactory, refreshToken);
        if (tokens.IsError)
        {
            ctx.RejectPrincipal();
            return;
        }

        UpdateAuthProperties(ctx.Properties, tokens);
        ctx.ShouldRenew = true;
    }
    catch
    {
        ctx.RejectPrincipal();
    }
}
// @snippet:step5:end

app.Run("https://localhost:4260");

static string RequireEnv(string name) =>
    Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"Missing required env var: {name}");

public partial class Program { }

static class Views
{
    public static string RenderSignedOutPage() => """
        <!doctype html>
        <html><head><title>SecureAuth .NET Token Refresh Demo</title></head>
        <body>
          <h1>SecureAuth .NET Token Refresh Demo</h1>
          <p><a href="/login">Sign in</a></p>
        </body></html>
        """;

    public static string RenderSignedInPage(ClaimsPrincipal user, string expiresAtDisplay)
    {
        var given = Escape(user.FindFirst("given_name")?.Value ?? "");
        var family = Escape(user.FindFirst("family_name")?.Value ?? "");
        var email = Escape(user.FindFirst("email")?.Value ?? "");
        var fullName = $"{given} {family}".Trim();
        var name = string.IsNullOrWhiteSpace(fullName) ? "there" : fullName;
        var emailSuffix = email.Length > 0 ? $" ({email})" : "";
        return $"""
            <!doctype html>
            <html><head><title>SecureAuth .NET Token Refresh Demo</title></head>
            <body>
              <h1>SecureAuth .NET Token Refresh Demo</h1>
              <p>Welcome, {name}{emailSuffix}</p>
              <p>Access token expires at: {Escape(expiresAtDisplay)}</p>
              <form method="POST" action="/refresh">
                <button type="submit">Refresh token now</button>
              </form>
              <p><a href="/logout">Sign out</a></p>
            </body></html>
            """;
    }

    public static string RenderErrorPage(string message) => $"""
        <!doctype html>
        <html><head><title>SecureAuth .NET Token Refresh Demo</title></head>
        <body>
          <h1>SecureAuth .NET Token Refresh Demo</h1>
          <div style="color: red">
            <p>Error: {Escape(message)}</p>
            <p><a href="/login">Try again</a></p>
          </div>
        </body></html>
        """;

    static string Escape(string s) => s
        .Replace("&", "&amp;")
        .Replace("<", "&lt;")
        .Replace(">", "&gt;")
        .Replace("\"", "&quot;")
        .Replace("'", "&#39;");
}
