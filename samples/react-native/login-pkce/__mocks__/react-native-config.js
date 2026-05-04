const config = {
  ISSUER_URL: "https://issuer.example/wsp",
  CLIENT_ID: "test-client",
  REDIRECT_URI: "com.secureauth.quickstart.rn.login://oauthredirect",
  SCOPES: "openid profile",
};

module.exports = {
  __esModule: true,
  default: config,
  ...config,
};
