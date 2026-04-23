using System.Net;
using System.Text;
using System.Web;

namespace TokenRefresh.Tests;

// Intercepts outbound HTTP traffic from Duende.IdentityModel helpers:
// - GET {issuer}/.well-known/openid-configuration → canned discovery doc
// - POST {issuer}/token with grant_type=refresh_token → canned token response (or error)
public class FakeTokenEndpointHandler : HttpMessageHandler
{
    public bool RefreshShouldError { get; set; }
    public int RefreshCallCount { get; private set; }
    public string? LastRefreshTokenSent { get; private set; }

    public void Reset()
    {
        RefreshShouldError = false;
        RefreshCallCount = 0;
        LastRefreshTokenSent = null;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var path = request.RequestUri!.AbsolutePath;

        if (path.EndsWith("/.well-known/openid-configuration")
            && request.Method == HttpMethod.Get)
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """
                    {
                      "issuer": "https://idp.example",
                      "token_endpoint": "https://idp.example/token",
                      "authorization_endpoint": "https://idp.example/authorize",
                      "end_session_endpoint": "https://idp.example/end_session",
                      "jwks_uri": "https://idp.example/jwks"
                    }
                    """,
                    Encoding.UTF8,
                    "application/json"),
            };
        }

        if (path.EndsWith("/jwks") && request.Method == HttpMethod.Get)
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"keys":[]}""",
                    Encoding.UTF8,
                    "application/json"),
            };
        }

        if (path.EndsWith("/token") && request.Method == HttpMethod.Post)
        {
            RefreshCallCount++;
            var body = await request.Content!.ReadAsStringAsync(cancellationToken);
            var form = HttpUtility.ParseQueryString(body);
            LastRefreshTokenSent = form["refresh_token"];

            if (RefreshShouldError)
            {
                return new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = new StringContent(
                        """{"error":"invalid_grant","error_description":"mock refresh failure"}""",
                        Encoding.UTF8,
                        "application/json"),
                };
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    $$"""
                    {
                      "access_token": "new-access-{{RefreshCallCount}}",
                      "refresh_token": "new-refresh-{{RefreshCallCount}}",
                      "id_token": "new-id-{{RefreshCallCount}}",
                      "expires_in": 3600,
                      "token_type": "Bearer"
                    }
                    """,
                    Encoding.UTF8,
                    "application/json"),
            };
        }

        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }
}

public class TestHttpClientFactory : IHttpClientFactory
{
    private readonly HttpMessageHandler _handler;

    public TestHttpClientFactory(HttpMessageHandler handler) => _handler = handler;

    public HttpClient CreateClient(string name) =>
        new(_handler, disposeHandler: false);
}
