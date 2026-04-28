using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace SamlSpLogin.Tests;

public class AuthIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AuthIntegrationTests(WebApplicationFactory<Program> factory)
    {
        // Write a self-signed stub PEM cert to a temp file so the SP startup code
        // (which loads SAML_IDP_SIGNING_CERT_PATH at boot) finds a valid X.509.
        // The cert is never validated against a real assertion; tests stub auth
        // entirely via TestAuthHandler.
        var certPath = WriteStubCertPemFile();

        Environment.SetEnvironmentVariable("SAML_SP_ENTITY_ID", "https://localhost:4262/saml/metadata");
        Environment.SetEnvironmentVariable("SAML_IDP_ENTITY_ID", "https://idp.example/test");
        Environment.SetEnvironmentVariable("SAML_IDP_SSO_URL", "https://idp.example/test/sso");
        Environment.SetEnvironmentVariable("SAML_IDP_SIGNING_CERT_PATH", certPath);

        _factory = factory;
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
        Assert.Contains("Welcome, alice@example.com", body);
    }

    [Fact]
    public async Task Login_RedirectsToIdpSsoUrl()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.GetAsync("/login");
        Assert.True(
            (int)res.StatusCode >= 300 && (int)res.StatusCode < 400,
            $"Expected 3xx redirect, got {(int)res.StatusCode} {res.StatusCode}");
        var location = res.Headers.Location!.ToString();
        Assert.Contains("idp.example/test/sso", location);
        Assert.Contains("SAMLRequest=", location);
    }

    [Fact]
    public async Task Logout_RedirectsHome()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        var res = await client.GetAsync("/logout");
        Assert.True(
            res.StatusCode == HttpStatusCode.Redirect || res.StatusCode == HttpStatusCode.Found,
            $"Expected redirect, got {res.StatusCode}");
        Assert.Equal("/", res.Headers.Location!.ToString());
    }

    private static string WriteStubCertPemFile()
    {
        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest("CN=stub", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = req.CreateSelfSigned(
            DateTimeOffset.UtcNow.AddDays(-1),
            DateTimeOffset.UtcNow.AddYears(10));
        var path = Path.Combine(Path.GetTempPath(), $"saml-test-{Guid.NewGuid()}.pem");
        File.WriteAllText(path, cert.ExportCertificatePem());
        return path;
    }
}
