import EmbeddedPostgres from "embedded-postgres";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dataDir = join(process.cwd(), ".pgdata");
mkdirSync(dataDir, { recursive: true });

const port = 55432;
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "doctor_tracker",
  password: "doctor_tracker",
  port,
  persistent: true,
});

await pg.initialise();
await pg.start();
await pg.createDatabase("doctor_tracker");

const url = `postgresql://doctor_tracker:doctor_tracker@127.0.0.1:${port}/doctor_tracker?schema=public`;
console.log(url);
