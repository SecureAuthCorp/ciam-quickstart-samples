using System.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Xunit;

namespace TokenRefresh.Tests;

public class AuthIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _baseFactory;
    private readonly FakeTokenEndpointHandler _handler;

    public AuthIntegrationTests(WebApplicationFactory<Program> factory)
    {
        Environment.SetEnvironmentVariable("ISSUER_URL", "https://idp.example");
        Environment.SetEnvironmentVariable("CLIENT_ID", "test-client");
        Environment.SetEnvironmentVariable("CLIENT_SECRET", "test-secret");
        Environment.SetEnvironmentVariable("SCOPES", "openid profile email offline_access");

        _handler = new FakeTokenEndpointHandler();
        var httpFactory = new TestHttpClientFactory(_handler);

        _baseFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                // Pre-populate OIDC Configuration so AddOpenIdConnect doesn't call discovery
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

                // Replace IHttpClientFactory so Duende discovery + token-endpoint calls
                // go through our fake handler.
                services.AddSingleton<IHttpClientFactory>(httpFactory);
            });
        });
    }

    private WebApplicationFactory<Program> AuthenticatedFactory() =>
        _baseFactory.WithWebHostBuilder(builder =>
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

    [Fact]
    public async Task Root_Unauthenticated_ShowsSignIn()
    {
        var client = _baseFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("Sign in", body);
    }

    [Fact]
    public async Task Root_Authenticated_ShowsWelcomeExpiryAndRefreshForm()
    {
        var client = AuthenticatedFactory().CreateClient();
        var res = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("Welcome, Test User (test@example.com)", body);
        Assert.Contains("Access token expires at:", body);
        Assert.Contains("Refresh token now", body);
    }

    [Fact]
    public async Task Login_ReturnsChallengeRedirectToAuthorizeEndpoint()
    {
        var client = _baseFactory.CreateClient(new WebApplicationFactoryClientOptions
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
    }

    [Fact]
    public async Task Refresh_RedirectsToRootAndCallsTokenEndpointWithStoredRefreshToken()
    {
        _handler.Reset();

        var client = AuthenticatedFactory().CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.PostAsync("/refresh", new StringContent(""));
        Assert.True(
            res.StatusCode == HttpStatusCode.Redirect || res.StatusCode == HttpStatusCode.Found,
            $"Expected redirect, got {res.StatusCode}");
        Assert.Equal("/", res.Headers.Location?.ToString());
        Assert.Equal(1, _handler.RefreshCallCount);
        Assert.Equal("mock-refresh", _handler.LastRefreshTokenSent);
    }

    [Fact]
    public async Task Refresh_RendersErrorWhenTokenEndpointFails()
    {
        _handler.Reset();
        _handler.RefreshShouldError = true;

        var client = AuthenticatedFactory().CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.PostAsync("/refresh", new StringContent(""));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("invalid_grant", body);
    }

    [Fact]
    public async Task Logout_RedirectsToEndSessionEndpoint()
    {
        var client = _baseFactory.CreateClient(new WebApplicationFactoryClientOptions
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
