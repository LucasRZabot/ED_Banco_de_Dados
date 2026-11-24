import { spawnSync } from "node:child_process";

if (process.env.RUN_DB_MIGRATE !== "1") {
  console.log("prisma migrate deploy: skipped (set RUN_DB_MIGRATE=1 on App Hosting)");
  process.exit(0);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("prisma migrate deploy: DATABASE_URL ausente");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
