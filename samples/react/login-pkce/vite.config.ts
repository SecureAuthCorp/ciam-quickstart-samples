import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const exposedEnvVars = [
  "ISSUER_URL",
  "CLIENT_ID",
  "REDIRECT_URI",
  "POST_LOGOUT_URI",
  "SCOPES",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    define: Object.fromEntries(
      exposedEnvVars.map((key) => [
        `import.meta.env.${key}`,
        JSON.stringify(env[key]),
      ]),
    ),
    server: {
      port: 3000,
    },
  };
});
