package com.secureauth.quickstart;

// @snippet:step2:start
// @description Spring Boot entry point — same shape as the login-auth-code sample; imports Spring Security's OAuth2 client + authorized-client APIs used below for refresh.
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.OAuth2AuthorizationContext;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.RefreshTokenOAuth2AuthorizedClientProvider;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.stereotype.Controller;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@SpringBootApplication
public class Application {
    public static void main(String[] args) { SpringApplication.run(Application.class, args); }
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
            OidcClientInitiatedLogoutSuccessHandler handler = new OidcClientInitiatedLogoutSuccessHandler(registrations);
            handler.setPostLogoutRedirectUri("{baseUrl}/");
            return handler;
        }
        // @snippet:step3:end

        // @snippet:step4:start
        // @description OAuth2AuthorizedClientManager enables Spring's background auto-refresh on any authorized-client use. A separate RefreshTokenOAuth2AuthorizedClientProvider bean is injected into RefreshController for on-demand refresh from POST /refresh.
        @Bean
        OAuth2AuthorizedClientManager authorizedClientManager(
                ClientRegistrationRepository registrations,
                OAuth2AuthorizedClientRepository authorized) {
            DefaultOAuth2AuthorizedClientManager manager =
                    new DefaultOAuth2AuthorizedClientManager(registrations, authorized);
            manager.setAuthorizedClientProvider(
                    OAuth2AuthorizedClientProviderBuilder.builder()
                            .authorizationCode()
                            .refreshToken()
                            .build());
            return manager;
        }

        @Bean
        RefreshTokenOAuth2AuthorizedClientProvider refreshTokenProvider() {
            RefreshTokenOAuth2AuthorizedClientProvider provider = new RefreshTokenOAuth2AuthorizedClientProvider();
            // Default 60s clock skew skips refresh when the access token isn't near expiry.
            // For the manual "Refresh now" button we want every click to hit the token endpoint,
            // so force the provider to treat every token as expired.
            provider.setClockSkew(Duration.ofDays(36500));
            return provider;
        }
    }
    // @snippet:step4:end

    // @snippet:step5:start
    // @description Home renders the signed-in page, reading the access-token expiry from the stored OAuth2AuthorizedClient and surfacing a POST /refresh button.
    @Controller
    static class HomeController {

        private static final DateTimeFormatter TIME_FMT =
                DateTimeFormatter.ofPattern("h:mm:ss a").withZone(ZoneId.systemDefault());

        private final OAuth2AuthorizedClientManager authorizedClientManager;

        HomeController(OAuth2AuthorizedClientManager authorizedClientManager) {
            this.authorizedClientManager = authorizedClientManager;
        }

        @GetMapping("/")
        @ResponseBody
        String home(
                @AuthenticationPrincipal OidcUser user,
                Authentication auth,
                HttpServletRequest req,
                HttpServletResponse res) {
            if (user == null) {
                return """
                    <!doctype html>
                    <html><head><title>SecureAuth Java Token Refresh Demo</title></head>
                    <body>
                      <h1>SecureAuth Java Token Refresh Demo</h1>
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

            // Route through the OAuth2AuthorizedClientManager so Spring's refresh-token provider
            // auto-refreshes once the access token is within clock-skew of expiry.
            OAuth2AuthorizeRequest authorizeRequest = OAuth2AuthorizeRequest
                    .withClientRegistrationId("secureauth")
                    .principal(auth)
                    .attributes(attrs -> {
                        attrs.put(HttpServletRequest.class.getName(), req);
                        attrs.put(HttpServletResponse.class.getName(), res);
                    })
                    .build();
            OAuth2AuthorizedClient client = authorizedClientManager.authorize(authorizeRequest);
            String expiresAtDisplay = "unknown";
            if (client != null && client.getAccessToken().getExpiresAt() != null) {
                Instant expires = client.getAccessToken().getExpiresAt();
                expiresAtDisplay = TIME_FMT.format(expires);
            }

            // POST /refresh needs Spring Security's CSRF token; render it as a hidden field.
            CsrfToken csrf = (CsrfToken) req.getAttribute(CsrfToken.class.getName());

            return """
                <!doctype html>
                <html><head><title>SecureAuth Java Token Refresh Demo</title></head>
                <body>
                  <h1>SecureAuth Java Token Refresh Demo</h1>
                  <p>Welcome, %s%s</p>
                  <p>Access token expires at: %s</p>
                  <form method="POST" action="/refresh">
                    <input type="hidden" name="%s" value="%s"/>
                    <button type="submit">Refresh token now</button>
                  </form>
                  <p><a href="/logout">Sign out</a></p>
                </body></html>
                """.formatted(name, emailSuffix, esc(expiresAtDisplay),
                              esc(csrf.getParameterName()), esc(csrf.getToken()));
        }

        private static String esc(String s) {
            if (s == null) return "";
            return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    .replace("\"", "&quot;").replace("'", "&#39;");
        }
    }
    // @snippet:step5:end

    // @snippet:step6:start
    // @description POST /refresh loads the current OAuth2AuthorizedClient, builds an OAuth2AuthorizationContext, and invokes RefreshTokenOAuth2AuthorizedClientProvider.authorize(...) directly — forcing the refresh grant regardless of token expiry. On failure, renders an inline error page with the IdP's error code.
    @Controller
    static class RefreshController {

        private final OAuth2AuthorizedClientRepository authorizedClientRepo;
        private final RefreshTokenOAuth2AuthorizedClientProvider refreshProvider;

        RefreshController(
                OAuth2AuthorizedClientRepository authorizedClientRepo,
                RefreshTokenOAuth2AuthorizedClientProvider refreshProvider) {
            this.authorizedClientRepo = authorizedClientRepo;
            this.refreshProvider = refreshProvider;
        }

        @PostMapping("/refresh")
        ResponseEntity<String> refresh(Authentication auth, HttpServletRequest req, HttpServletResponse res) {
            OAuth2AuthorizedClient current = authorizedClientRepo.loadAuthorizedClient("secureauth", auth, req);
            if (current == null) {
                return redirectToHome();
            }
            try {
                OAuth2AuthorizationContext ctx = OAuth2AuthorizationContext
                        .withAuthorizedClient(current)
                        .principal(auth)
                        .build();
                OAuth2AuthorizedClient refreshed = refreshProvider.authorize(ctx);
                if (refreshed != null) {
                    authorizedClientRepo.saveAuthorizedClient(refreshed, auth, req, res);
                }
                return redirectToHome();
            } catch (OAuth2AuthenticationException e) {
                String errorCode = e.getError() != null ? e.getError().getErrorCode() : null;
                return renderError(errorCode != null ? errorCode : (e.getMessage() != null ? e.getMessage() : "refresh failed"));
            } catch (Exception e) {
                return renderError(e.getMessage() == null ? "refresh failed" : e.getMessage());
            }
        }

        private static ResponseEntity<String> redirectToHome() {
            return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, "/").build();
        }

        private static ResponseEntity<String> renderError(String message) {
            String esc = message == null ? "" : message.replace("&", "&amp;").replace("<", "&lt;")
                    .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
            String body = """
                <!doctype html>
                <html><head><title>SecureAuth Java Token Refresh Demo</title></head>
                <body>
                  <h1>SecureAuth Java Token Refresh Demo</h1>
                  <div style="color: red">
                    <p>Error: %s</p>
                    <p><a href="/">Back</a></p>
                  </div>
                </body></html>
                """.formatted(esc);
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(body);
        }
    }
}
// @snippet:step6:end
