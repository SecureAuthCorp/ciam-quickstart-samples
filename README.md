# CIAM Quickstart Samples

Framework-specific sample apps demonstrating SecureAuth integration. Code is extracted from these samples and displayed in the SecureAuth admin dashboard's Quickstart tab.

## Structure

```
samples/          # One folder per framework
  react/          # React sample apps
    login-pkce/   # Login with Auth Code + PKCE
scripts/          # Extraction and validation tools
```

## Adding a new sample

1. Create `samples/<framework>/<flow>/` with a minimal working app
2. Add `@snippet:stepN:start/end` tags and `@description` comments in source files
3. Add a `manifest.yaml` in `samples/<framework>/`
4. Run `cd scripts && yarn all` to validate
5. Open a PR — CI will test the app and validate extraction

## Contributing

This repo is maintained by the SecureAuth CIAM team. External contributions are welcome via pull request — all PRs require team review.
