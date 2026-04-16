/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ISSUER_URL: string;
  readonly CLIENT_ID: string;
  readonly REDIRECT_URI: string;
  readonly SCOPES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
