import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertStagingBuildEnvironment } from "./lib/staging-target.mjs";

try {
  const target = JSON.parse(readFileSync(new URL("../netlify/staging-target.json", import.meta.url), "utf8"));
  const database = assertStagingBuildEnvironment(process.env, target);
  console.log(`Verified staging site ${target.siteId}, database ${database.projectRef}.`);
  for (const script of ["verify:market-schema", "build"]) {
    const result = spawnSync("npm", ["run", script], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Staging preflight failed.");
  process.exitCode = 1;
}
