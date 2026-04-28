package com.secureauth.quickstart;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Collections;
import java.util.List;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.saml2.provider.service.authentication.DefaultSaml2AuthenticatedPrincipal;
import org.springframework.security.saml2.provider.service.authentication.Saml2Authentication;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestSamlConfig.class)
@TestPropertySource(properties = {
    "SAML_SP_ENTITY_ID=http://localhost/test/saml/metadata",
    "SAML_IDP_ENTITY_ID=https://idp.example/test",
    "SAML_IDP_SSO_URL=https://idp.example/test/sso",
    "SAML_IDP_SIGNING_CERT_PATH=/dev/null"
})
class ApplicationTests {

    @Autowired
    MockMvc mockMvc;

    @Test
    void root_unauthenticated_rendersSignInPage() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.containsString("Sign in")))
                .andExpect(content().string(Matchers.containsString("/saml2/authenticate/secureauth")));
    }

    @Test
    void root_authenticated_rendersWelcome() throws Exception {
        DefaultSaml2AuthenticatedPrincipal principal =
                new DefaultSaml2AuthenticatedPrincipal("alice@example.com", Collections.emptyMap());
        Saml2Authentication auth =
                new Saml2Authentication(principal, "stub-saml-response", List.of());
        auth.setAuthenticated(true);

        mockMvc.perform(get("/")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.containsString("Welcome, alice@example.com")))
                .andExpect(content().string(Matchers.containsString("Sign out")));
    }

    @Test
    void logout_clearsSessionAndRedirectsHome() throws Exception {
        DefaultSaml2AuthenticatedPrincipal principal =
                new DefaultSaml2AuthenticatedPrincipal("alice@example.com", Collections.emptyMap());
        Saml2Authentication auth =
                new Saml2Authentication(principal, "stub-saml-response", List.of());
        auth.setAuthenticated(true);

        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/logout")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(auth))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().is3xxRedirection())
                .andExpect(result ->
                        org.junit.jupiter.api.Assertions.assertEquals(
                                "/",
                                result.getResponse().getRedirectedUrl(),
                                "logout should redirect to /"));
    }
}
