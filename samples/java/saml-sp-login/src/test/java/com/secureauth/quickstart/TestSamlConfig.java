package com.secureauth.quickstart;

import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.saml2.core.Saml2X509Credential;
import org.springframework.security.saml2.provider.service.registration.InMemoryRelyingPartyRegistrationRepository;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistration;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistrationRepository;
import org.springframework.security.saml2.provider.service.registration.Saml2MessageBinding;

@TestConfiguration
public class TestSamlConfig {

    /**
     * Base64-encoded self-signed cert used only to satisfy Spring Security SAML2's
     * requirement that the relying-party registration has at least one verification
     * credential. Tests never send a real SAML response through the validator;
     * saml2Login() RequestPostProcessor stubs the authenticated principal directly.
     *
     * Generated with:
     *   keytool -genkeypair -alias t -keyalg RSA -keysize 2048 -validity 3650 \
     *       -keystore /tmp/stub.p12 -storetype PKCS12 -storepass changeit -dname CN=stub
     *   keytool -exportcert -alias t -keystore /tmp/stub.p12 -storepass changeit -rfc | \
     *       sed '1d;$d' | tr -d '\n'
     */
    private static final String STUB_CERT_BASE64 =
        "MIICwTCCAamgAwIBAgIILLkd1zvdF4IwDQYJKoZIhvcNAQEMBQAwDzENMAsGA1UEAxMEc3R1YjAe" +
        "Fw0yNjA0MjcxMTQ2MzZaFw0zNjA0MjQxMTQ2MzZaMA8xDTALBgNVBAMTBHN0dWIwggEiMA0GCSqG" +
        "SIb3DQEBAQUAA4IBDwAwggEKAoIBAQCN6CidZGPdXF0yC4qwcgNDQKrw888vZlPDCZZg+ZbWCf0T" +
        "TyDGD2ZxukB8k118MvuR9MArLVwMsqCoquyblxaavy1Afxru+hjWY/gDfMdGMPMI/nsYM0korS6h" +
        "1Pien0FbK7bDbdMfh0z65MsM0rgjRPqGqT7AvBoCpud7iO0m4jpjdL/6ug6NKfBfmK9KGacBns+" +
        "0u1Qe+pxVpbmhsa0ZTPv+2txy25AlUKJBQKmW8fPW4TwHJYsLObHcOLnLz4g5YfwfqcP+rcNjd4" +
        "bZhHfE8OL4Up9mC663n3BRC57VTYL/3dItINkIANaFzbKdjHi5YewUDQPY6c/cVzRMjpFBAgMBAAGj" +
        "ITAfMB0GA1UdDgQWBBSvdKyTYCFpoUKJage7xNOqRABL5TANBgkqhkiG9w0BAQwFAAOCAQEAewQy" +
        "Cen2a9+bY6zXS/O9oXnuepKy0xpM9y7wS5TbuLoFO9mwLazvtCfeawmBIhOyvD8yUTuquLoPlm0W" +
        "CCAEEuuKpd9LZ2xDI8Ba6cB0OqFgPgyvJ5XAEGJzEfLn/EL+p6j4exINgWwsAGfIP/25mX67hfKq" +
        "ZWj5892Q8MgUeNt06YlXFMr09A7hSxLMJlah05Op1jlwwsTaRn1tyz/0HA990qpiGL5JOKmyA0wO" +
        "C2CefjU2tlsUsxbzkW+IJGtbKHbs5XFbdIlp/n6qCnOzyPPYAokNjBmVrSrbRV8HzhmW9lTVC2vk" +
        "1MKWR2lThN9KYY6PmVj5QIsa6yu7eT4nYw==";

    @Bean
    @Primary
    public RelyingPartyRegistrationRepository relyingPartyRegistrationRepository() throws Exception {
        X509Certificate stubCert = parseCert(STUB_CERT_BASE64);
        RelyingPartyRegistration registration = RelyingPartyRegistration
                .withRegistrationId("secureauth")
                .entityId("http://localhost/test/saml/metadata")
                .assertionConsumerServiceLocation("{baseUrl}/login/saml2/sso/{registrationId}")
                .assertingPartyMetadata(party -> party
                        .entityId("https://idp.example/test")
                        .singleSignOnServiceLocation("https://idp.example/test/sso")
                        .singleSignOnServiceBinding(Saml2MessageBinding.POST)
                        .verificationX509Credentials(c -> c.add(Saml2X509Credential.verification(stubCert))))
                .build();
        return new InMemoryRelyingPartyRegistrationRepository(registration);
    }

    private static X509Certificate parseCert(String base64) throws Exception {
        byte[] der = Base64.getDecoder().decode(base64.replaceAll("\\s+", ""));
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        return (X509Certificate) cf.generateCertificate(new java.io.ByteArrayInputStream(der));
    }
}
