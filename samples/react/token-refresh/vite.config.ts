import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const exposedEnvVars = ["ISSUER_URL", "CLIENT_ID", "REDIRECT_URI", "SCOPES"];

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "serve") {
    const missing = exposedEnvVars.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required env vars: ${missing.join(", ")}. Copy .env.example to .env and fill in the values.`,
      );
    }
  }
  return {
    plugins: [react()],
    define: Object.fromEntries(
      exposedEnvVars.map((key) => [
        `import.meta.env.${key}`,
        JSON.stringify(env[key] ?? ""),
      ]),
    ),
    server: {
      port: 3000,
    },
  };
});
