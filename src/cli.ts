import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { startSetupServer } from "./setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0];

if (command === "setup") {
  await startSetupServer({ openBrowser: !args.includes("--no-open") });
} else if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write(`After Effects MCP\n\nUsage:\n  after-effects-mcp          Start the MCP server over stdio\n  after-effects-mcp setup    Open the local setup dashboard\n`);
} else if (command && command !== "server") {
  process.stderr.write(`Unknown command: ${command}\nRun after-effects-mcp --help for usage.\n`);
  process.exitCode = 1;
} else {
  const child = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    process.stderr.write(`Failed to start the MCP server: ${error.message}\n`);
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}
