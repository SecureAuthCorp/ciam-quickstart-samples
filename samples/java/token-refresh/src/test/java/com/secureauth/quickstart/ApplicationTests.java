package com.secureauth.quickstart;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
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

    @Autowired MockMvc mockMvc;
    @Autowired ClientRegistrationRepository clientRegistrationRepository;

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
}
