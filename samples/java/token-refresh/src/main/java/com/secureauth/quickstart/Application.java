package com.secureauth.quickstart;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.OAuth2AuthorizationContext;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.RefreshTokenOAuth2AuthorizedClientProvider;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.view.RedirectView;

@SpringBootApplication
public class Application {
    public static void main(String[] args) { SpringApplication.run(Application.class, args); }

    @Configuration
    static class SecurityConfig {

        @Bean
        SecurityFilterChain filterChain(HttpSecurity http, ClientRegistrationRepository registrations) throws Exception {
            return http
                    .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                    .oauth2Login(Customizer.withDefaults())
                    .logout(l -> l.logoutSuccessHandler(logoutSuccessHandler(registrations)))
                    .build();
        }

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
            return new RefreshTokenOAuth2AuthorizedClientProvider();
        }

        private LogoutSuccessHandler logoutSuccessHandler(ClientRegistrationRepository registrations) {
            OidcClientInitiatedLogoutSuccessHandler handler = new OidcClientInitiatedLogoutSuccessHandler(registrations);
            handler.setPostLogoutRedirectUri("{baseUrl}/");
            return handler;
        }
    }

    @Controller
    static class HomeController {

        private static final DateTimeFormatter TIME_FMT =
                DateTimeFormatter.ofPattern("h:mm:ss a").withZone(ZoneId.systemDefault());

        private final OAuth2AuthorizedClientRepository authorizedClientRepo;

        HomeController(OAuth2AuthorizedClientRepository authorizedClientRepo) {
            this.authorizedClientRepo = authorizedClientRepo;
        }

        @GetMapping("/")
        @ResponseBody
        String home(@AuthenticationPrincipal OidcUser user, Authentication auth, HttpServletRequest req) {
            String given = esc(user.getGivenName());
            String family = esc(user.getFamilyName());
            String email = esc(user.getEmail());
            String fullName = (given + " " + family).trim();
            String name = fullName.isBlank() ? "there" : fullName;
            String emailSuffix = email.isEmpty() ? "" : " (" + email + ")";

            OAuth2AuthorizedClient client = authorizedClientRepo.loadAuthorizedClient("secureauth", auth, req);
            String expiresAtDisplay = "unknown";
            if (client != null && client.getAccessToken().getExpiresAt() != null) {
                Instant expires = client.getAccessToken().getExpiresAt();
                expiresAtDisplay = TIME_FMT.format(expires);
            }

            return """
                <!doctype html>
                <html><head><title>SecureAuth Java Token Refresh Demo</title></head>
                <body>
                  <h1>SecureAuth Java Token Refresh Demo</h1>
                  <p>Welcome, %s%s</p>
                  <p>Access token expires at: %s</p>
                  <form method="POST" action="/refresh">
                    <button type="submit">Refresh token now</button>
                  </form>
                  <p><a href="/logout">Sign out</a></p>
                </body></html>
                """.formatted(name, emailSuffix, esc(expiresAtDisplay));
        }

        private static String esc(String s) {
            if (s == null) return "";
            return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    .replace("\"", "&quot;").replace("'", "&#39;");
        }
    }

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
        @ResponseBody
        Object refresh(Authentication auth, HttpServletRequest req, HttpServletResponse res) {
            OAuth2AuthorizedClient current = authorizedClientRepo.loadAuthorizedClient("secureauth", auth, req);
            if (current == null) {
                return new RedirectView("/");
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
                return new RedirectView("/");
            } catch (OAuth2AuthenticationException e) {
                String errorCode = e.getError() != null ? e.getError().getErrorCode() : null;
                return renderError(errorCode != null ? errorCode : (e.getMessage() != null ? e.getMessage() : "refresh failed"));
            } catch (Exception e) {
                return renderError(e.getMessage() == null ? "refresh failed" : e.getMessage());
            }
        }

        private static String renderError(String message) {
            String esc = message == null ? "" : message.replace("&", "&amp;").replace("<", "&lt;")
                    .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
            return """
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
        }
    }
}
