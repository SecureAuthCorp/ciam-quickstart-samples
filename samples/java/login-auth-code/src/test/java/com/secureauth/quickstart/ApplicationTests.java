package com.secureauth.quickstart;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestOAuth2Config.class)
class ApplicationTests {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ClientRegistrationRepository clientRegistrationRepository;

    @Test
    void root_unauthenticated_redirectsToAuthorizationEndpoint() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("http://localhost/oauth2/authorization/secureauth"));
    }

    @Test
    void logout_redirectsToEndSessionEndpoint() throws Exception {
        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/logout")
                        .with(SecurityMockMvcRequestPostProcessors.oidcLogin()
                                .clientRegistration(
                                        clientRegistrationRepository.findByRegistrationId("secureauth"))
                                .idToken(t -> t
                                        .tokenValue("test-id-token")
                                        .subject("user-1")))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().is3xxRedirection())
                .andExpect(result ->
                        org.junit.jupiter.api.Assertions.assertTrue(
                                result.getResponse().getRedirectedUrl()
                                        .startsWith("https://idp.example/end_session"),
                                "expected end_session endpoint, got " + result.getResponse().getRedirectedUrl()));
    }

    @Test
    void root_authenticated_rendersWelcome() throws Exception {
        mockMvc.perform(get("/").with(
                SecurityMockMvcRequestPostProcessors.oidcLogin()
                        .idToken(t -> t
                                .tokenValue("test-id-token")
                                .subject("user-1")
                                .claim("given_name", "Test")
                                .claim("family_name", "User")
                                .claim("email", "test@example.com"))))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Welcome, Test User")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("test@example.com")));
    }
}
