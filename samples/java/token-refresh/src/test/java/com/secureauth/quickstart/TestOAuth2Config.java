package com.secureauth.quickstart;

import java.util.Map;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

@TestConfiguration
public class TestOAuth2Config {

    @Bean
    @Primary
    public ClientRegistrationRepository clientRegistrationRepository() {
        ClientRegistration registration = ClientRegistration.withRegistrationId("secureauth")
                .clientId("test-client")
                .clientSecret("test-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .scope("openid", "profile", "email", "offline_access")
                .authorizationUri("https://idp.example/authorize")
                .tokenUri("https://idp.example/token")
                .userInfoUri("https://idp.example/userinfo")
                .userNameAttributeName("sub")
                .jwkSetUri("https://idp.example/jwks")
                .providerConfigurationMetadata(Map.of(
                        "end_session_endpoint", "https://idp.example/end_session"))
                .build();
        return new InMemoryClientRegistrationRepository(registration);
    }
}
