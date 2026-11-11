import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

export default app;

if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}
