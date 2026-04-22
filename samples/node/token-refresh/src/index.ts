import "dotenv/config";
import https from "node:https";
import selfsigned from "selfsigned";
import { createApp } from "./app.js";

const app = createApp();
const pems = await selfsigned.generate([
  { name: "commonName", value: "localhost" },
]);
const port = Number(process.env.PORT ?? 4261);
https
  .createServer({ key: pems.private, cert: pems.cert }, app)
  .listen(port, () => {
    console.log(
      `SecureAuth Node.js Token Refresh Demo: https://localhost:${port}`,
    );
  });
