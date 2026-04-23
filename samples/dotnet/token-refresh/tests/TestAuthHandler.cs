using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace TokenRefresh.Tests;

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[]
        {
            new Claim("given_name", "Test"),
            new Claim("family_name", "User"),
            new Claim("email", "test@example.com"),
            new Claim(ClaimTypes.NameIdentifier, "user-1"),
        };
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);

        var props = new AuthenticationProperties();
        props.StoreTokens(new[]
        {
            new AuthenticationToken { Name = "access_token", Value = "mock-access" },
            new AuthenticationToken { Name = "refresh_token", Value = "mock-refresh" },
            new AuthenticationToken { Name = "id_token", Value = "mock-id-token" },
            new AuthenticationToken
            {
                Name = "expires_at",
                Value = DateTimeOffset.UtcNow.AddHours(1).ToString("o"),
            },
        });

        var ticket = new AuthenticationTicket(principal, props, "Test");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
