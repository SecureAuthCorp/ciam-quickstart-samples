using System.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Xunit;

namespace LoginAuthCode.Tests;

public class AuthIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AuthIntegrationTests(WebApplicationFactory<Program> factory)
    {
        // Env vars needed by the sample app so the OIDC middleware initializes at app boot time.
        Environment.SetEnvironmentVariable("ISSUER_URL", "https://idp.example");
        Environment.SetEnvironmentVariable("CLIENT_ID", "test-client");
        Environment.SetEnvironmentVariable("CLIENT_SECRET", "test-secret");
        Environment.SetEnvironmentVariable("SCOPES", "openid profile email");

        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                // Pre-populate OIDC Configuration so the middleware doesn't call the
                // discovery endpoint (which would fail — there's no real IdP here).
                services.Configure<OpenIdConnectOptions>(
                    OpenIdConnectDefaults.AuthenticationScheme,
                    options =>
                    {
                        options.Configuration = new OpenIdConnectConfiguration
                        {
                            Issuer = "https://idp.example",
                            AuthorizationEndpoint = "https://idp.example/authorize",
                            TokenEndpoint = "https://idp.example/token",
                            EndSessionEndpoint = "https://idp.example/end_session",
                            JwksUri = "https://idp.example/jwks",
                        };
                    });
            });
        });
    }

    [Fact]
    public async Task Root_Unauthenticated_ShowsSignIn()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("Sign in", body);
    }

    [Fact]
    public async Task Root_Authenticated_ShowsWelcome()
    {
        var factory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddAuthentication("Test")
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });
                services.PostConfigure<AuthenticationOptions>(options =>
                {
                    options.DefaultScheme = "Test";
                    options.DefaultAuthenticateScheme = "Test";
                });
            });
        });
        var client = factory.CreateClient();
        var res = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("Welcome, Test User (test@example.com)", body);
    }

    [Fact]
    public async Task Login_ReturnsChallengeRedirectToAuthorizeEndpoint()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.GetAsync("/login");
        Assert.True(
            res.StatusCode == HttpStatusCode.Redirect || res.StatusCode == HttpStatusCode.Found,
            $"Expected redirect, got {res.StatusCode}");
        var location = res.Headers.Location!.ToString();
        Assert.Contains("idp.example/authorize", location);
        Assert.Contains("client_id=test-client", location);
        Assert.Contains("response_type=code", location);
        Assert.Contains("code_challenge=", location);
    }

    [Fact]
    public async Task Logout_RedirectsToEndSessionEndpoint()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.GetAsync("/logout");
        Assert.True(
            res.StatusCode == HttpStatusCode.Redirect || res.StatusCode == HttpStatusCode.Found,
            $"Expected redirect, got {res.StatusCode}");
        var location = res.Headers.Location!.ToString();
        Assert.Contains("idp.example/end_session", location);
    }
}
