package com.secureauth.quickstart;

import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

// Spring Security's OAuth2 client binder expects `scope` as a comma-separated string,
// but the other samples in this repo (Node, .NET, React, …) use space-separated SCOPES
// in .env. Normalize whitespace or mixed separators to commas before property binding
// so a single .env works for every sample.
//
// Ordered last so we run after spring-dotenv has added its .env PropertySource.
public class ScopesEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String scopes = environment.getProperty("SCOPES");
        if (scopes == null || scopes.isBlank()) {
            return;
        }
        String normalized = scopes.trim().replaceAll("[\\s,]+", ",");
        if (normalized.equals(scopes)) {
            return;
        }
        environment.getPropertySources().addFirst(
                new MapPropertySource("normalized-scopes", Map.of("SCOPES", normalized)));
    }
}
