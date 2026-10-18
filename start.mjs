#!/usr/bin/env node
// Start VrijStaan lokaal met één commando: `node start.mjs`
// Controleert Node, installeert pakketten als dat nodig is, start de ontwikkelserver en opent de browser.
// Supabase hoeft niet ingesteld te worden: de standaardwaarden staan in web/src/lib/env.ts.
// Werkt op Windows, macOS en Linux, zonder extra pakketten.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const web = join(root, "web");
const port = process.env.PORT || "3000";
const url = `http://localhost:${port}`;
const isWindows = process.platform === "win32";

const say = (msg) => console.log(`\x1b[32m[vrijstaan]\x1b[0m ${msg}`);
const fail = (msg) => {
  console.error(`\x1b[31m[vrijstaan]\x1b[0m ${msg}`);
  process.exit(1);
};

// 1. Node-versie (zelfde eis als web/package.json)
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  fail(`Node ${process.versions.node} is te oud. Installeer Node 20.9 of nieuwer via https://nodejs.org`);
}

// 2. Pakketten installeren als ze ontbreken of package-lock.json nieuwer is
const lock = join(web, "package-lock.json");
const installed = join(web, "node_modules", ".package-lock.json");
if (!existsSync(installed) || statSync(lock).mtimeMs > statSync(installed).mtimeMs) {
  say("Pakketten installeren (eenmalig, duurt even)...");
  const result = spawnSync("npm", ["ci"], { cwd: web, stdio: "inherit", shell: isWindows });
  if (result.status !== 0) fail("Installeren mislukt, zie de melding hierboven.");
}

// 3. Ontwikkelserver starten en de browser openen zodra hij antwoordt
say(`Ontwikkelserver starten op ${url} (stoppen met Ctrl+C)...`);
const dev = spawn("npm", ["run", "dev", "--", "-p", port], { cwd: web, stdio: "inherit", shell: isWindows });
dev.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => dev.kill("SIGINT"));

for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    await fetch(url);
    say(`Klaar: ${url}`);
    const [cmd, args] = isWindows
      ? ["cmd", ["/c", "start", "", url]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
    break;
  } catch {
    // server nog niet klaar
  }
}
