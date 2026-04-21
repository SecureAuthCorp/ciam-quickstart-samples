import "dotenv/config";
import https from "node:https";
import selfsigned from "selfsigned";
import { createApp } from "./app.js";

const app = createApp();
const pems = selfsigned.generate([{ name: "commonName", value: "localhost" }], {
  days: 365,
});
const port = Number(process.env.PORT ?? 4260);
https
  .createServer({ key: pems.private, cert: pems.cert }, app)
  .listen(port, () => {
    console.log(`SecureAuth Node.js Auth Code Demo: https://localhost:${port}`);
  });
