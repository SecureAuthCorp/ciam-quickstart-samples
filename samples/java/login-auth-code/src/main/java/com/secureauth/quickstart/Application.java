package com.secureauth.quickstart;

// @snippet:step2:start
// @description Spring Boot entry point — auto-configures the OAuth2 client, web server, and security filter chain.
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
    // @snippet:step2:end

    // @snippet:step3:start
    // @description SecurityFilterChain enables oauth2Login() for Authorization Code + PKCE and wires RP-initiated logout via OidcClientInitiatedLogoutSuccessHandler.
    @Configuration
    static class SecurityConfig {

        @Bean
        SecurityFilterChain filterChain(HttpSecurity http, ClientRegistrationRepository registrations) throws Exception {
            return http
                    .authorizeHttpRequests(auth -> auth
                            .requestMatchers("/").permitAll()
                            .anyRequest().authenticated())
                    .oauth2Login(login -> login
                            .authorizationEndpoint(endpoint -> endpoint
                                    .authorizationRequestResolver(pkceResolver(registrations)))
                            .defaultSuccessUrl("/", true))
                    .logout(l -> l.logoutSuccessHandler(logoutSuccessHandler(registrations)))
                    .build();
        }

        // Spring Security defaults to no PKCE for confidential clients (ones with a client-secret).
        // SecureAuth requires PKCE even for confidential clients, matching defense-in-depth use cases
        // — so force code_challenge/S256 on every authorization request.
        private OAuth2AuthorizationRequestResolver pkceResolver(ClientRegistrationRepository registrations) {
            DefaultOAuth2AuthorizationRequestResolver resolver =
                    new DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization");
            resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
            return resolver;
        }

        private LogoutSuccessHandler logoutSuccessHandler(ClientRegistrationRepository registrations) {
            OidcClientInitiatedLogoutSuccessHandler handler =
                    new OidcClientInitiatedLogoutSuccessHandler(registrations);
            handler.setPostLogoutRedirectUri("{baseUrl}/");
            return handler;
        }
    }
    // @snippet:step3:end

    // @snippet:step4:start
    // @description Home renders the signed-in page using claims from OidcUser. Spring Security already redirects unauthenticated requests to the authorization endpoint, so there's no signed-out branch here.
    @Controller
    static class HomeController {

        @GetMapping("/")
        @ResponseBody
        String home(@AuthenticationPrincipal OidcUser user) {
            if (user == null) {
                return """
                    <!doctype html>
                    <html><head><title>SecureAuth Java Auth Code Demo</title></head>
                    <body>
                      <h1>SecureAuth Java Auth Code Demo</h1>
                      <p><a href="/oauth2/authorization/secureauth">Sign in</a></p>
                    </body></html>
                    """;
            }
            String given = esc(user.getGivenName());
            String family = esc(user.getFamilyName());
            String email = esc(user.getEmail());
            String fullName = (given + " " + family).trim();
            String name = fullName.isBlank() ? "there" : fullName;
            String emailSuffix = email.isEmpty() ? "" : " (" + email + ")";
            return """
                <!doctype html>
                <html><head><title>SecureAuth Java Auth Code Demo</title></head>
                <body>
                  <h1>SecureAuth Java Auth Code Demo</h1>
                  <p>Welcome, %s%s</p>
                  <p><a href="/logout">Sign out</a></p>
                </body></html>
                """.formatted(name, emailSuffix);
        }

        private static String esc(String s) {
            if (s == null) return "";
            return s
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#39;");
        }
    }
    // @snippet:step4:end
}
