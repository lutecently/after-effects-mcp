import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import setupPage from "./setup-page.html";

type SetupOptions = { openBrowser?: boolean };
type AeInstall = {
  name: string;
  path: string;
  panelPath: string;
  panelInstalled: boolean;
  panelCurrent: boolean;
  panelVersion: string | null;
  backups: string[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, "index.js");
const sourcePanel = path.join(__dirname, "scripts", "mcp-bridge-auto.jsx");
const bridgeDir = path.join(os.homedir(), "Documents", "ae-mcp-bridge");
const settingsPath = path.join(bridgeDir, "settings.json");
const heartbeatPath = path.join(bridgeDir, "status.json");
const logPath = path.join(bridgeDir, "bridge.log");
const setupStatePath = path.join(bridgeDir, "setup-state.json");
const packagePath = path.join(__dirname, "..", "package.json");

const DEFAULT_SETTINGS = {
  safetyMode: "full",
  autoRun: true,
  autoBackupHighImpact: true,
  pollIntervalMs: 2000,
  commandExpiryMs: 600000,
  resultRetention: 100,
  maxCommandsPerTick: 10,
  responseTimeoutMs: 8000,
  resultPollIntervalMs: 250,
};

const SAFE_TOOL_NAMES = new Set([
  "getProjectInfo", "listCompositions", "getLayerInfo", "getKeyframes", "getProjectStatus",
  "getRenderStatus", "getMarkers", "listLayerProperties", "getProjectTree", "getCapabilities",
  "getPropertyReference", "getSelection", "listEffects", "listFonts", "listRenderTemplates",
]);

function readJsonFile(filePath: string): unknown {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function readSettings() {
  const stored = readJsonFile(settingsPath);
  return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) };
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function saveSettings(input: Record<string, unknown>) {
  const safetyMode = ["read-only", "editing", "full"].includes(String(input.safetyMode)) ? String(input.safetyMode) : "full";
  const settings = {
    safetyMode,
    autoRun: input.autoRun !== false,
    autoBackupHighImpact: input.autoBackupHighImpact !== false,
    pollIntervalMs: boundedNumber(input.pollIntervalMs, 2000, 250, 30000),
    commandExpiryMs: boundedNumber(input.commandExpiryMs, 600000, 10000, 86400000),
    resultRetention: boundedNumber(input.resultRetention, 100, 10, 5000),
    maxCommandsPerTick: boundedNumber(input.maxCommandsPerTick, 10, 1, 100),
    responseTimeoutMs: boundedNumber(input.responseTimeoutMs, 8000, 1000, 120000),
    resultPollIntervalMs: boundedNumber(input.resultPollIntervalMs, 250, 50, 5000),
  };
  fs.mkdirSync(bridgeDir, { recursive: true });
  const temporary = `${settingsPath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, settingsPath);
  return settings;
}

function currentPackageVersion(): string {
  const packageJson = readJsonFile(packagePath);
  return packageJson && typeof packageJson === "object" && "version" in packageJson ? String((packageJson as Record<string, unknown>).version) : "unknown";
}

function bridgeFingerprint(filePath: string): string | null {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 127 || code === 13) continue;
      hash ^= code;
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash.toString(16);
  } catch {
    return null;
  }
}

function panelPathFor(aePath: string): string {
  const scripts = process.platform === "win32"
    ? path.join(aePath, "Support Files", "Scripts", "ScriptUI Panels")
    : path.join(aePath, "Scripts", "ScriptUI Panels");
  return path.join(scripts, "mcp-bridge-auto.jsx");
}

function candidateRoots(): string[] {
  if (process.platform === "darwin") return ["/Applications"];
  if (process.platform === "win32") {
    return [...new Set([
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.ProgramW6432,
    ].filter((value): value is string => Boolean(value)).map((value) => path.join(value, "Adobe")))];
  }
  return [];
}

function detectAfterEffects(): AeInstall[] {
  const sourceVersion = bridgeFingerprint(sourcePanel);
  const installs: AeInstall[] = [];
  for (const root of candidateRoots()) {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^Adobe After Effects(?: Beta)?(?: |$)/i.test(entry.name)) continue;
      const aePath = path.join(root, entry.name);
      const installedPanel = panelPathFor(aePath);
      const panelVersion = bridgeFingerprint(installedPanel);
      let backups: string[] = [];
      try {
        const panelDir = path.dirname(installedPanel);
        const base = path.basename(installedPanel);
        backups = fs.readdirSync(panelDir)
          .filter((name) => name.startsWith(`${base}.backup-`) || name.startsWith(`${base}.removed-`))
          .map((name) => path.join(panelDir, name))
          .sort().reverse();
      } catch {}
      installs.push({
        name: entry.name,
        path: aePath,
        panelPath: installedPanel,
        panelInstalled: panelVersion !== null,
        panelCurrent: panelVersion !== null && panelVersion === sourceVersion,
        panelVersion,
        backups,
      });
    }
  }
  return installs.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
}

function configurationPayload() {
  const mcpConfig = {
    mcpServers: {
      AfterEffectsMCP: { command: process.execPath, args: [serverEntry] },
    },
  };
  const q = (value: string) => JSON.stringify(value);
  return {
    serverEntry,
    codex: `codex mcp add AfterEffectsMCP -- ${q(process.execPath)} ${q(serverEntry)}`,
    claude: JSON.stringify(mcpConfig, null, 2),
    cursor: JSON.stringify(mcpConfig, null, 2),
  };
}

function configuredClients() {
  const targets = [
    { name: "Codex", path: path.join(os.homedir(), ".codex", "config.toml") },
    { name: "Claude", path: path.join(os.homedir(), ".claude.json") },
    { name: "Cursor", path: path.join(os.homedir(), ".cursor", "mcp.json") },
  ];
  return targets.filter((target) => {
    try {
      const text = fs.readFileSync(target.path, "utf8");
      return text.includes("AfterEffectsMCP") && (text.includes(serverEntry) || text.includes("after-effects-mcp"));
    } catch { return false; }
  }).map((target) => target.name);
}

function firstRunStatus(installs: AeInstall[], activity: ReturnType<typeof activityPayload>) {
  const clients = configuredClients();
  const setupState = readJsonFile(setupStatePath) as Record<string, unknown> | null;
  const items = [
    { id: "panel", label: "Bridge panel installed and current", complete: installs.some((item) => item.panelCurrent) },
    { id: "client", label: clients.length ? `MCP client configured (${clients.join(", ")})` : "MCP client configured", complete: clients.length > 0 },
    { id: "connected", label: "After Effects panel connected", complete: activity.connected },
    { id: "tested", label: "Read-only connection test passed", complete: Boolean(setupState?.lastConnectionTestAt), detail: setupState?.lastConnectionTestAt || null },
  ];
  return { items, completed: items.filter((item) => item.complete).length, total: items.length };
}

function listJsonFiles(dir: string) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const filePath = path.join(dir, name);
        const stat = fs.statSync(filePath);
        return { name, path: filePath, modifiedMs: stat.mtimeMs, data: readJsonFile(filePath) };
      })
      .sort((a, b) => b.modifiedMs - a.modifiedMs);
  } catch { return []; }
}

function readLogTail(maxBytes = 32_768) {
  try {
    const stat = fs.statSync(logPath);
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    const descriptor = fs.openSync(logPath, "r");
    fs.readSync(descriptor, buffer, 0, length, Math.max(0, stat.size - length));
    fs.closeSync(descriptor);
    return buffer.toString("utf8").split(/\r?\n/).filter(Boolean).slice(-80);
  } catch { return []; }
}

function activityPayload() {
  const settings = readSettings();
  const heartbeat = readJsonFile(heartbeatPath) as Record<string, unknown> | null;
  const heartbeatTime = heartbeat?.timestamp ? Date.parse(String(heartbeat.timestamp)) : NaN;
  const queue = listJsonFiles(path.join(bridgeDir, "queue"));
  const results = listJsonFiles(path.join(bridgeDir, "results"));
  return {
    connected: Number.isFinite(heartbeatTime) && Date.now() - heartbeatTime < Math.max(10_000, Number(settings.pollIntervalMs) * 4),
    heartbeat,
    queue: queue.slice(0, 30).map((item) => ({
      name: item.name,
      ageMs: Date.now() - item.modifiedMs,
      command: item.data && typeof item.data === "object" ? (item.data as Record<string, unknown>).command : null,
    })),
    results: results.slice(0, 30).map((item) => {
      const data = item.data && typeof item.data === "object" ? item.data as Record<string, unknown> : {};
      return { name: item.name, ageMs: Date.now() - item.modifiedMs, command: data._commandExecuted, status: data.status || (data.error ? "error" : "complete") };
    }),
    logs: readLogTail(),
  };
}

function toolCategory(name: string) {
  if (/^(get|list)/.test(name)) return "Inspect";
  if (/Project|Folder|ProjectItems|import|backup/i.test(name)) return "Project";
  if (/Render|exportFrame/i.test(name)) return "Render & export";
  if (/Keyframe|Expression|Marker|Property|Effect|Control/i.test(name)) return "Animation & effects";
  if (/Composition|Comp/i.test(name)) return "Compositions";
  return "Layers & scene";
}

function toolInventory() {
  try {
    const source = fs.readFileSync(sourcePanel, "utf8");
    const table = source.match(/var commandTable = \{([\s\S]*?)\n\};/)?.[1] || "";
    const names = [...table.matchAll(/"([A-Za-z][A-Za-z0-9_-]+)"\s*:\s*function/g)].map((match) => match[1]);
    return names.sort().map((name) => ({ name, category: toolCategory(name), readOnly: SAFE_TOOL_NAMES.has(name) }));
  } catch { return []; }
}

function statusPayload() {
  const installs = detectAfterEffects();
  const sourceVersion = bridgeFingerprint(sourcePanel);
  const activity = activityPayload();
  return {
    platform: process.platform,
    supportedPlatform: process.platform === "darwin" || process.platform === "win32",
    nodeVersion: process.version,
    bridgeDir,
    bridgeDirExists: fs.existsSync(bridgeDir),
    sourcePanel,
    sourcePanelExists: fs.existsSync(sourcePanel),
    sourceVersion,
    serverEntry,
    serverEntryExists: fs.existsSync(serverEntry),
    packageVersion: currentPackageVersion(),
    installs,
    settings: readSettings(),
    activity,
    firstRun: firstRunStatus(installs, activity),
    tools: toolInventory(),
    config: configurationPayload(),
  };
}

function sendJson(response: http.ServerResponse, status: number, value: unknown) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > 32_768) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateAePath(aePathInput: unknown) {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    throw new Error("After Effects setup is supported on macOS and Windows only.");
  }
  if (typeof aePathInput !== "string" || !aePathInput.trim()) throw new Error("Choose an After Effects installation first.");
  const aePath = fs.realpathSync(aePathInput.trim());
  if (!fs.statSync(aePath).isDirectory() || !/Adobe After Effects/i.test(path.basename(aePath))) {
    throw new Error("The selected folder does not look like an Adobe After Effects installation.");
  }
  return aePath;
}

function permissionDenied(error: unknown) {
  return error instanceof Error && ("code" in error ? ["EACCES", "EPERM"].includes(String((error as NodeJS.ErrnoException).code)) : /permission denied|operation not permitted/i.test(error.message));
}

async function installPanelWithMacAuthorization(source: string, destination: string, backup: string | null) {
  // macOS privacy controls can prevent an administrator shell from reading a source file inside Documents,
  // even though this Node process can read it. Stage a private copy in the system temp directory first.
  const stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "after-effects-mcp-install-"));
  const stagedSource = path.join(stagingDirectory, path.basename(source));
  fs.copyFileSync(source, stagedSource);
  fs.chmodSync(stagedSource, 0o644);
  const script = `on run argv
set sourcePath to item 1 of argv
set destinationPath to item 2 of argv
set destinationDirectory to item 3 of argv
set backupPath to item 4 of argv
set shellCommand to "/bin/mkdir -p " & quoted form of destinationDirectory
if backupPath is not "" then
  set shellCommand to shellCommand & " && /bin/cp -p " & quoted form of destinationPath & " " & quoted form of backupPath
end if
set shellCommand to shellCommand & " && /bin/cp -f " & quoted form of sourcePath & " " & quoted form of destinationPath
do shell script shellCommand with administrator privileges
end run`;
  try {
    await runProcess("/usr/bin/osascript", ["-e", script, "--", stagedSource, destination, path.dirname(destination), backup || ""], 120_000);
  } catch (error) {
    if (error instanceof Error && /user canceled/i.test(error.message)) {
      throw new Error("Installation was cancelled. Administrator authorization is required to update a panel inside the After Effects application folder.");
    }
    throw error;
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
}

async function installPanel(aePathInput: unknown) {
  if (!fs.existsSync(sourcePanel)) throw new Error(`The bundled bridge panel is missing: ${sourcePanel}`);
  const aePath = validateAePath(aePathInput);

  const destination = panelPathFor(aePath);
  let backup: string | null = null;
  if (fs.existsSync(destination)) {
    backup = `${destination}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  }
  let authorized = false;
  try {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (backup) fs.copyFileSync(destination, backup);
    fs.copyFileSync(sourcePanel, destination);
  } catch (error) {
    if (process.platform !== "darwin" || !permissionDenied(error)) throw error;
    await installPanelWithMacAuthorization(sourcePanel, destination, backup);
    authorized = true;
  }
  const version = bridgeFingerprint(destination);
  if (!version || version !== bridgeFingerprint(sourcePanel)) throw new Error("The panel copy completed, but its contents could not be verified.");
  return { destination, backup, version, authorized };
}

function uninstallPanel(aePathInput: unknown) {
  const destination = panelPathFor(validateAePath(aePathInput));
  if (!fs.existsSync(destination)) throw new Error("The bridge panel is not installed in the selected After Effects version.");
  const removed = `${destination}.removed-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.renameSync(destination, removed);
  return { removed, recoverable: true };
}

function restorePanel(aePathInput: unknown) {
  const destination = panelPathFor(validateAePath(aePathInput));
  const directory = path.dirname(destination);
  const base = path.basename(destination);
  const backups = fs.readdirSync(directory)
    .filter((name) => name.startsWith(`${base}.backup-`) || name.startsWith(`${base}.removed-`))
    .map((name) => path.join(directory, name))
    .sort().reverse();
  if (!backups.length) throw new Error("No bridge-panel backup was found for this After Effects installation.");
  let currentBackup: string | null = null;
  if (fs.existsSync(destination)) {
    currentBackup = `${destination}.backup-before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(destination, currentBackup);
  }
  fs.copyFileSync(backups[0], destination);
  return { restoredFrom: backups[0], destination, currentBackup, version: bridgeFingerprint(destination) };
}

function backupFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  const backup = `${filePath}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(filePath, backup);
  return backup;
}

function runProcess(command: string, args: string[], timeoutMs = 20_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} timed out.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}.`));
    });
  });
}

async function verifyMcpServer() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
  const client = new Client({ name: "after-effects-mcp-setup", version: currentPackageVersion() });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => { await client.connect(transport); return client.listTools(); })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("MCP verification timed out.")), 10_000); }),
    ]).then((result) => {
      if (!("tools" in result) || !result.tools.some((tool) => tool.name === "get-dashboard-status")) {
        throw new Error("The server started, but the expected dashboard-status tool was not discovered.");
      }
    });
    const tools = await client.listTools();
    return { toolCount: tools.tools.length, dashboardVisibleToMcp: tools.tools.some((tool) => tool.name === "get-dashboard-status") };
  } finally {
    if (timer) clearTimeout(timer);
    try { await client.close(); } catch {}
    try { await transport.close(); } catch {}
  }
}

async function configureClient(client: unknown) {
  const name = String(client || "");
  const config = configurationPayload();
  if (name === "codex") {
    const configFile = path.join(os.homedir(), ".codex", "config.toml");
    const backup = backupFile(configFile);
    try { await runProcess("codex", ["mcp", "remove", "AfterEffectsMCP"]); } catch {}
    await runProcess("codex", ["mcp", "add", "AfterEffectsMCP", "--", process.execPath, serverEntry]);
    const verification = await runProcess("codex", ["mcp", "get", "AfterEffectsMCP"]);
    return { client: name, backup, verification: verification.stdout, server: await verifyMcpServer() };
  }
  if (name === "claude") {
    const configFile = path.join(os.homedir(), ".claude.json");
    const backup = backupFile(configFile);
    try { await runProcess("claude", ["mcp", "remove", "--scope", "user", "AfterEffectsMCP"]); } catch {}
    await runProcess("claude", ["mcp", "add", "--scope", "user", "AfterEffectsMCP", "--", process.execPath, serverEntry]);
    const verification = await runProcess("claude", ["mcp", "get", "AfterEffectsMCP"]);
    return { client: name, backup, verification: verification.stdout, server: await verifyMcpServer() };
  }
  if (name === "cursor") {
    const configFile = path.join(os.homedir(), ".cursor", "mcp.json");
    const backup = backupFile(configFile);
    const existing = readJsonFile(configFile);
    const document = existing && typeof existing === "object" ? existing as Record<string, unknown> : {};
    const servers = document.mcpServers && typeof document.mcpServers === "object" ? document.mcpServers as Record<string, unknown> : {};
    servers.AfterEffectsMCP = { command: process.execPath, args: [serverEntry] };
    document.mcpServers = servers;
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
    return { client: name, backup, verification: `Validated ${configFile}`, config: config.cursor, server: await verifyMcpServer() };
  }
  throw new Error("Unsupported MCP client.");
}

async function checkForUpdates() {
  const current = currentPackageVersion();
  const localCheckout = fs.existsSync(path.join(__dirname, "..", ".git"));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("https://registry.npmjs.org/after-effects-mcp/latest", { signal: controller.signal });
    if (!response.ok) throw new Error(`npm registry returned ${response.status}.`);
    const data = await response.json() as Record<string, unknown>;
    const latest = String(data.version || "unknown");
    return { current, latest, localCheckout, updateAvailable: current !== "unknown" && latest !== "unknown" && current !== latest };
  } finally { clearTimeout(timer); }
}

function clearStaleQueue() {
  const expiry = Number(readSettings().commandExpiryMs);
  const queue = listJsonFiles(path.join(bridgeDir, "queue"));
  const removed: string[] = [];
  for (const item of queue) {
    if (Date.now() - item.modifiedMs <= expiry) continue;
    fs.unlinkSync(item.path);
    removed.push(item.name);
  }
  return { removed, count: removed.length };
}

function archiveBridgeData() {
  fs.mkdirSync(bridgeDir, { recursive: true });
  const archive = path.join(bridgeDir, "archive", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(archive, { recursive: true });
  const moved: string[] = [];
  for (const name of ["queue", "results", "bridge.log", "status.json", "ae_command.json", "ae_mcp_result.json"]) {
    const source = path.join(bridgeDir, name);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(archive, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(source, destination);
    moved.push(name);
  }
  return { archive, moved };
}

function diagnosticsPayload() {
  const status = statusPayload();
  return {
    generatedAt: new Date().toISOString(),
    packageVersion: currentPackageVersion(),
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    serverEntryExists: fs.existsSync(serverEntry),
    sourcePanelExists: fs.existsSync(sourcePanel),
    sourcePanelVersion: bridgeFingerprint(sourcePanel),
    installs: (status.installs as AeInstall[]).map((item) => ({
      name: item.name,
      panelInstalled: item.panelInstalled,
      panelCurrent: item.panelCurrent,
      panelVersion: item.panelVersion,
      backupCount: item.backups.length,
    })),
    settings: readSettings(),
    activity: activityPayload(),
    note: "Project paths and command arguments are intentionally omitted from this diagnostics report.",
  };
}

async function runBridgeCommand(command: string, args: Record<string, unknown>, timeoutMs = 15_000) {
  const queueDir = path.join(bridgeDir, "queue");
  const resultsDir = path.join(bridgeDir, "results");
  fs.mkdirSync(queueDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });
  const id = `setup-${process.pid}-${Date.now().toString(36)}`;
  const queueFile = path.join(queueDir, `${String(Date.now()).padStart(13, "0")}-${id}.json`);
  const resultFile = path.join(resultsDir, `${id}.json`);
  const temporary = `${queueFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ id, command, args, timestamp: new Date().toISOString() }, null, 2));
  fs.renameSync(temporary, queueFile);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(resultFile)) return { ok: true, id, result: JSON.parse(fs.readFileSync(resultFile, "utf8")) };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { ok: false, id, message: `No response after ${Math.round(timeoutMs / 1000)} seconds. Open the After Effects bridge panel and enable Auto-run commands.` };
}

async function testBridge() {
  const result = await runBridgeCommand("getCapabilities", {}, 15_000);
  if (result.ok) {
    fs.mkdirSync(bridgeDir, { recursive: true });
    fs.writeFileSync(setupStatePath, `${JSON.stringify({ lastConnectionTestAt: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  }
  return result;
}

function openUrl(url: string) {
  let command: string;
  let args: string[];
  if (process.platform === "darwin") {
    const chrome = "/Applications/Google Chrome.app";
    command = "open";
    args = fs.existsSync(chrome) ? ["-a", "Google Chrome", url] : [url];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

export async function startSetupServer(options: SetupOptions = {}) {
  const token = randomBytes(24).toString("hex");
  let baseUrl = "";

  const server = http.createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
    const url = new URL(request.url || "/", baseUrl || "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/" && url.searchParams.get("token") === token) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(setupPage);
      return;
    }

    if (!url.pathname.startsWith("/api/") || request.headers["x-setup-token"] !== token) {
      sendJson(response, 403, { error: "Invalid setup session." });
      return;
    }
    if (request.headers.origin && request.headers.origin !== baseUrl) {
      sendJson(response, 403, { error: "Invalid request origin." });
      return;
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, statusPayload());
      } else if (request.method === "GET" && url.pathname === "/api/activity") {
        sendJson(response, 200, activityPayload());
      } else if (request.method === "GET" && url.pathname === "/api/diagnostics") {
        const body = JSON.stringify(diagnosticsPayload(), null, 2);
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="after-effects-mcp-diagnostics-${Date.now()}.json"`,
          "Content-Length": Buffer.byteLength(body),
          "Cache-Control": "no-store",
        });
        response.end(body);
      } else if (request.method === "POST" && url.pathname === "/api/install") {
        const body = await readJson(request);
        sendJson(response, 200, { ok: true, ...(await installPanel(body.aePath)) });
      } else if (request.method === "POST" && url.pathname === "/api/uninstall") {
        const body = await readJson(request);
        sendJson(response, 200, { ok: true, ...uninstallPanel(body.aePath) });
      } else if (request.method === "POST" && url.pathname === "/api/restore") {
        const body = await readJson(request);
        sendJson(response, 200, { ok: true, ...restorePanel(body.aePath) });
      } else if (request.method === "POST" && url.pathname === "/api/settings") {
        const body = await readJson(request);
        sendJson(response, 200, { ok: true, settings: saveSettings(body) });
      } else if (request.method === "POST" && url.pathname === "/api/configure-client") {
        const body = await readJson(request);
        sendJson(response, 200, { ok: true, ...(await configureClient(body.client)) });
      } else if (request.method === "POST" && url.pathname === "/api/update-check") {
        sendJson(response, 200, { ok: true, ...(await checkForUpdates()) });
      } else if (request.method === "POST" && url.pathname === "/api/clear-stale") {
        sendJson(response, 200, { ok: true, ...clearStaleQueue() });
      } else if (request.method === "POST" && url.pathname === "/api/archive-data") {
        sendJson(response, 200, { ok: true, ...archiveBridgeData() });
      } else if (request.method === "POST" && url.pathname === "/api/run-tool") {
        const body = await readJson(request);
        const command = String(body.command || "");
        if (!SAFE_TOOL_NAMES.has(command)) throw new Error("The dashboard test console only runs strictly read-only commands.");
        const args = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args as Record<string, unknown> : {};
        sendJson(response, 200, await runBridgeCommand(command, args, 15_000));
      } else if (request.method === "POST" && url.pathname === "/api/test") {
        sendJson(response, 200, await testBridge());
      } else if (request.method === "POST" && url.pathname === "/api/reveal") {
        fs.mkdirSync(bridgeDir, { recursive: true });
        if (process.platform === "darwin") spawn("open", [bridgeDir], { detached: true, stdio: "ignore" }).unref();
        else if (process.platform === "win32") spawn("explorer.exe", [bridgeDir], { detached: true, stdio: "ignore" }).unref();
        sendJson(response, 200, { ok: true, bridgeDir });
      } else if (request.method === "POST" && url.pathname === "/api/shutdown") {
        sendJson(response, 200, { ok: true });
        setTimeout(() => server.close(() => process.exit(0)), 100);
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 400, { error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine the setup server address.");
  baseUrl = `http://127.0.0.1:${address.port}`;
  const url = `${baseUrl}/?token=${token}`;
  process.stdout.write(`After Effects MCP setup is available at:\n${url}\n\nPress Ctrl+C to stop the setup server.\n`);
  if (options.openBrowser !== false) openUrl(url);
  return { server, url };
}
