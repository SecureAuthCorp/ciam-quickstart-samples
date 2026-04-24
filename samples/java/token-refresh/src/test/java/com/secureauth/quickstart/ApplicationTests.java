package com.secureauth.quickstart;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.RefreshTokenOAuth2AuthorizedClientProvider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestOAuth2Config.class)
class ApplicationTests {

    @Autowired MockMvc mockMvc;
    @Autowired ClientRegistrationRepository clientRegistrationRepository;
    @MockitoBean RefreshTokenOAuth2AuthorizedClientProvider refreshProvider;
    @MockitoBean OAuth2AuthorizedClientRepository authorizedClientRepository;

    @Test
    void root_unauthenticated_redirects() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("http://localhost/oauth2/authorization/secureauth"));
    }

    @Test
    void root_authenticated_rendersWelcomeAndExpiry() throws Exception {
        mockMvc.perform(get("/").with(
                SecurityMockMvcRequestPostProcessors.oidcLogin()
                        .clientRegistration(clientRegistrationRepository.findByRegistrationId("secureauth"))
                        .idToken(b -> b
                                .subject("user-1")
                                .claim("given_name", "Test")
                                .claim("family_name", "User")
                                .claim("email", "test@example.com"))))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.containsString("Welcome, Test User")))
                .andExpect(content().string(Matchers.containsString("Access token expires at:")))
                .andExpect(content().string(Matchers.containsString("Refresh token now")));
    }

    @Test
    void refresh_redirectsToRoot() throws Exception {
        mockMvc.perform(
                MockMvcRequestBuilders.post("/refresh")
                        .with(SecurityMockMvcRequestPostProcessors.oidcLogin()
                                .clientRegistration(clientRegistrationRepository.findByRegistrationId("secureauth"))
                                .idToken(b -> b.subject("user-1")))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/"));
    }

    @Test
    void refresh_rendersErrorWhenProviderThrows() throws Exception {
        ClientRegistration registration = clientRegistrationRepository.findByRegistrationId("secureauth");
        OAuth2AccessToken accessToken = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER, "stub-token",
                java.time.Instant.now(), java.time.Instant.now().plusSeconds(3600));
        OAuth2AuthorizedClient stubClient = new OAuth2AuthorizedClient(registration, "user-1", accessToken);
        Mockito.when(authorizedClientRepository.loadAuthorizedClient(
                ArgumentMatchers.eq("secureauth"), ArgumentMatchers.any(), ArgumentMatchers.any()))
                .thenReturn(stubClient);
        Mockito.when(refreshProvider.authorize(ArgumentMatchers.any()))
                .thenThrow(new OAuth2AuthenticationException(
                        new OAuth2Error("invalid_grant", "mock refresh failure", null)));

        mockMvc.perform(
                MockMvcRequestBuilders.post("/refresh")
                        .with(SecurityMockMvcRequestPostProcessors.oidcLogin()
                                .clientRegistration(clientRegistrationRepository.findByRegistrationId("secureauth"))
                                .idToken(b -> b.subject("user-1")))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.containsString("invalid_grant")));
    }
}
