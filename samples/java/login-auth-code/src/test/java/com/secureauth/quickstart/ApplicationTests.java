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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestOAuth2Config.class)
class ApplicationTests {

    @Autowired
    MockMvc mockMvc;

    @Test
    void root_unauthenticated_redirectsToAuthorizationEndpoint() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("http://localhost/oauth2/authorization/secureauth"));
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
