#!/usr/bin/env node
/**
 * Helper: trigger a Railway redeploy of the `web` service in the `production`
 * environment without waiting for the GitHub auto-deploy hook.
 *
 * Usage:  npm run railway:redeploy
 *
 * Requires the Railway CLI (`railway`) to be installed and logged in
 * (see https://docs.railway.com/guides/cli). The linked project is sains-crm.
 */
import { spawnSync } from "node:child_process";

const SERVICE = "web";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`[railway:redeploy] Triggering redeploy of service=${SERVICE} ...`);
run("railway", ["redeploy", "--service", SERVICE, "--yes"]);
console.log(`[railway:redeploy] Done. Tail logs with:  railway logs --service ${SERVICE} --build`);
