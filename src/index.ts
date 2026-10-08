import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { z } from "zod";
import { fileURLToPath } from 'url';

// Create an MCP server
const server = new McpServer({
  name: "AfterEffectsServer",
  version: "1.0.0"
});

// ES Modules replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const SCRIPTS_DIR = path.join(__dirname, "scripts");
const TEMP_DIR = path.join(__dirname, "temp");
const DEFAULT_BRIDGE_DIR = path.join(os.homedir(), "Documents", "ae-mcp-bridge");

function readRuntimeSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(DEFAULT_BRIDGE_DIR, "settings.json"), "utf8"));
  } catch {
    return {};
  }
}

function numericSetting(name: string, fallback: number, min: number, max: number): number {
  const value = Number(readRuntimeSettings()[name]);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

// Get the correct directory for AE bridge files
// Use ~/Documents/ae-mcp-bridge for reliable cross-process access
function getAETempDir(): string {
  const bridgeDir = DEFAULT_BRIDGE_DIR;
  // Ensure the directory exists
  if (!fs.existsSync(bridgeDir)) {
    fs.mkdirSync(bridgeDir, { recursive: true });
  }
  return bridgeDir;
}

// Headless CLI execution has been removed. All interactions are routed through the Bridge panel.

// Fingerprint of the panel script this server ships (same FNV-1a over ASCII characters, ignoring carriage returns, as
// the panel computes for its own file). A mismatch means the installed panel is not this build.
let expectedBridgeVersion: string | null | undefined;
function getExpectedBridgeVersion(): string | null {
  if (expectedBridgeVersion !== undefined) return expectedBridgeVersion;
  try {
    const text = fs.readFileSync(path.join(SCRIPTS_DIR, "mcp-bridge-auto.jsx"), "utf8");
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c > 127 || c === 13) continue;
      h ^= c;
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    expectedBridgeVersion = h.toString(16);
  } catch {
    expectedBridgeVersion = null;
  }
  return expectedBridgeVersion;
}

// The bridge stamps every result with the open project (_project) and its own fingerprint (_bridgeVersion). Add a
// _warning when the project's file changes between results (After Effects restarted, or someone opened another project)
// so stale comp/layer assumptions get caught, and when the installed panel is not the build this server ships.
let lastProjectKey: string | null = null;
let lastWarnedPanelVersion: string | null = null;
function annotateProjectChange(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return content;
    const warnings: string[] = [];

    const project = parsed._project;
    if (project) {
      const key = `${project.path ?? "(unsaved)"}`;
      if (lastProjectKey !== null && key !== lastProjectKey) {
        warnings.push(`The open After Effects project changed since the last result (was ${lastProjectKey}, now ${key}). Comps and layers created earlier may not exist; re-check with getProjectStatus / listCompositions.`);
      }
      lastProjectKey = key;
    }

    const expected = getExpectedBridgeVersion();
    if (expected !== null) {
      const panel: string | null = typeof parsed._bridgeVersion === "string" ? parsed._bridgeVersion : null;
      const panelLabel = panel ?? "none (older than the version check)";
      if (panel !== "unknown" && panel !== expected && panelLabel !== lastWarnedPanelVersion) {
        warnings.push(`The After Effects panel is not the build this server ships (panel ${panelLabel}, server ${expected}). Commands may be missing or behave differently. Copy build/scripts/mcp-bridge-auto.jsx over the installed panel script, reopen the panel, and restart this server.`);
        lastWarnedPanelVersion = panelLabel;
      }
      if (panel === expected) lastWarnedPanelVersion = null;
    }

    if (warnings.length === 0) return content;
    parsed._warning = warnings.join(" ");
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

// --- Command queue ---
// Every command is written as its own file in queue/ with a unique id; After Effects runs them oldest-first and writes
// results/<id>.json. Each server instance only reads results for its own commands, so several clients can share one
// bridge folder without overwriting each other's commands or reading each other's results.
function getBridgeSubdir(name: string): string {
  const dir = path.join(getAETempDir(), name);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function readJsonFile(filePath: string): unknown {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function getDashboardStatus(): Record<string, unknown> {
  const queueDir = getBridgeSubdir("queue");
  const resultsDir = getBridgeSubdir("results");
  const listJson = (dir: string) => {
    try { return fs.readdirSync(dir).filter((name) => name.endsWith(".json")); }
    catch { return []; }
  };
  const heartbeat = readJsonFile(path.join(getAETempDir(), "status.json"));
  const timestamp = heartbeat && typeof heartbeat === "object" && "timestamp" in heartbeat
    ? Date.parse(String((heartbeat as Record<string, unknown>).timestamp))
    : NaN;
  return {
    connected: Number.isFinite(timestamp) && Date.now() - timestamp < 10_000,
    heartbeat,
    settings: readRuntimeSettings(),
    queueDepth: listJson(queueDir).length,
    retainedResults: listJson(resultsDir).length,
    bridgeDirectory: getAETempDir(),
  };
}

let lastCommandId: string | null = null;
let lastQueueFile: string | null = null;
let commandCounter = 0;

// Queue a command for After Effects and return its id
function writeCommandFile(command: string, args: Record<string, any> = {}): string {
  const id = `${process.pid}-${Date.now().toString(36)}-${++commandCounter}`;
  const queueFile = path.join(getBridgeSubdir('queue'), `${String(Date.now()).padStart(13, '0')}-${id}.json`);
  const tmpFile = `${queueFile}.tmp`;
  // Write under a temp name, then rename, so the panel never picks up half a file
  fs.writeFileSync(tmpFile, JSON.stringify({ id, command, args, timestamp: new Date().toISOString() }, null, 2));
  fs.renameSync(tmpFile, queueFile);
  lastCommandId = id;
  lastQueueFile = queueFile;
  console.error(`Command "${command}" queued as ${id}`);
  return id;
}

// Wait for the result of one specific command. Returns null on timeout.
async function waitForResult(id: string, timeoutMs: number, pollMs: number = 250): Promise<string | null> {
  const resultPath = path.join(getBridgeSubdir('results'), `${id}.json`);
  const start = Date.now();
  for (;;) {
    if (fs.existsSync(resultPath)) {
      try {
        const content = fs.readFileSync(resultPath, 'utf8');
        if (content) return annotateProjectChange(content);
      } catch {
        // transient read error; try again
      }
    }
    if (Date.now() - start >= timeoutMs) return null;
    await new Promise(r => setTimeout(r, numericSetting("resultPollIntervalMs", pollMs, 50, 5000)));
  }
}

// Result of the last command this server queued
async function readLastResult(timeoutMs: number = numericSetting("responseTimeoutMs", 8000, 1000, 120000)): Promise<string> {
  if (!lastCommandId) {
    return JSON.stringify({ error: "No command has been queued by this server session yet. Run a script first." });
  }
  const found = await waitForResult(lastCommandId, timeoutMs);
  if (found) return found;
  const stillQueued = lastQueueFile !== null && fs.existsSync(lastQueueFile);
  return JSON.stringify({
    status: "waiting",
    commandId: lastCommandId,
    message: stillQueued
      ? "The command is queued or still running. If it stays queued, open the MCP Bridge Auto panel in After Effects. A render blocks After Effects until it finishes."
      : "The command left the queue but no result was found. After Effects may have been closed or the panel reloaded; check its state and resend."
  });
}

// Add a resource to expose project compositions
server.resource(
  "compositions",
  "aftereffects://compositions",
  async (uri) => {
    // Queue the command and wait for its result
    const id = writeCommandFile("listCompositions", {});
    const result = (await waitForResult(id, numericSetting("responseTimeoutMs", 8000, 1000, 120000))) ?? JSON.stringify({ error: "Timed out waiting for the bridge result for listCompositions." });

    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: result
      }]
    };
  }
);

server.resource(
  "dashboard-status",
  "aftereffects://dashboard/status",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(getDashboardStatus(), null, 2),
    }],
  })
);

server.tool(
  "get-dashboard-status",
  "Inspect the same connection health, heartbeat, queue counts, and safety settings shown in the local setup dashboard. This is read-only and does not run an After Effects command.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(getDashboardStatus(), null, 2) }],
  })
);

// Add a tool for running read-only scripts
server.tool(
  "run-script",
  "Run a read-only script in After Effects",
  {
    script: z.string().describe("Name of the predefined script to run"),
    parameters: z.record(z.string(), z.unknown()).optional().describe("Optional parameters for the script")
  },
  async ({ script, parameters = {} }) => {
    // The panel's command table is the one list of commands; it rejects any name it does not have (and says which
    // exist). Here only make sure the name is a plain identifier, since it is written into the queue.
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(script)) {
      return {
        content: [
          {
            type: "text",
            text: `Error: "${script}" is not a valid command name. Use getCapabilities to list the commands the panel supports.`
          }
        ],
        isError: true
      };
    }

    try {
      // Queue the command for After Effects to pick up
      writeCommandFile(script, parameters);
      
      return {
        content: [
          {
            type: "text",
            text: `Command to run "${script}" has been queued.\n` +
                  `Please ensure the "MCP Bridge Auto" panel is open in After Effects.\n` +
                  `Use the "get-results" tool after a few seconds to check for results.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing command: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Add a tool to get the results from the last script execution
server.tool(
  "get-results",
  "Get the result of the last command this server queued in After Effects (waits up to ~8s for it). Results are matched by command id, so other clients sharing the bridge cannot overwrite or be mistaken for yours.",
  {},
  async () => {
    try {
      const result = await readLastResult();
      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting results: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Add prompts for common After Effects tasks
server.prompt(
  "list-compositions",
  "List compositions in the current After Effects project",
  () => {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: "Please list all compositions in the current After Effects project."
        }
      }]
    };
  }
);

server.prompt(
  "analyze-composition",
  {
    compositionName: z.string().describe("Name of the composition to analyze")
  },
  (args) => {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please analyze the composition named "${args.compositionName}" in the current After Effects project. Provide details about its duration, frame rate, resolution, and layers.`
        }
      }]
    };
  }
);

// Add a prompt for creating compositions
server.prompt(
  "create-composition",
  "Create a new composition with specified settings",
  () => {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please create a new composition with custom settings. You can specify parameters like name, width, height, frame rate, etc.`
        }
      }]
    };
  }
);

// Add a tool to provide help and instructions
server.tool(
  "get-help",
  "Get help on using the After Effects MCP integration",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `# After Effects MCP Integration Help

To use this integration with After Effects, follow these steps:

 1. **Install the scripts in After Effects**
   - Run \`node install-bridge.js\` with administrator privileges
   - This copies the necessary scripts to your After Effects installation

2. **Open After Effects**
   - Launch Adobe After Effects 
   - Open a project that you want to work with

3. **Open the MCP Bridge Auto panel**
   - In After Effects, go to Window > mcp-bridge-auto.jsx
   - The panel will automatically check for commands every few seconds

4. **Run scripts through MCP**
   - Use the \`run-script\` tool to queue a command
   - The Auto panel will detect and run the command automatically
   - Results will be saved to a temp file

5. **Get results through MCP**
   - After a command is executed, use the \`get-results\` tool
   - This will retrieve the results from After Effects

Available scripts:
- getProjectInfo: Information about the current project
- listCompositions: List all compositions in the project
- getLayerInfo: {compName|compIndex? (default: active comp), layerIndex|layerName? (default: all layers)}. Returns parent, transform (value, expression, keyframe count), effects, null/3D flags and source for each layer
- createComposition: Create a new composition
- createTextLayer: Create a new text layer
- createShapeLayer: Create a new shape layer
- createSolidLayer: Create a new solid layer
- setLayerProperties: Set properties for a layer
- setLayerKeyframe: Set a keyframe for a layer property
- setLayerExpression: Set an expression for a layer property
- applyEffect: Apply an effect to a layer
- applyEffectTemplate: Apply a predefined effect template to a layer

setLayerKeyframe, setLayerExpression, applyEffect and applyEffectTemplate target by compName|compIndex (or the active comp) and layerIndex|layerName.

Layer/comp management scripts (run via run-script; comps are found by compName, layers by layerIndex or layerName):
- precomposeLayers: {compName, layerIndices[] or layerNames[], newCompName, moveAllAttributes (default true)}
- addCompToComp: {compName (target), sourceCompName, opacity?, position?}
- setGuideLayer: {compName, layerIndex|layerName, guideLayer (default true)}
- createNullLayer: {compName, name?, position? (default comp centre), duration?}
- setLayerParent: {compName, layerIndex|layerName, parentLayerIndex|parentLayerName, keepTransform? (default true: the layer stays where it is on screen; false keeps its raw values so it may jump)} or {..., clearParent: true}
- moveLayer: {compName, layerIndex|layerName} plus ONE of: moveTo ("top"|"bottom"), toIndex, aboveLayerIndex|aboveLayerName, belowLayerIndex|belowLayerName
- importFile: {filePath (absolute), folderName? (created if missing), addToComp? (true adds to compName or the active comp)}
- setEffectProperty: {compName, layerIndex|layerName, effectName|effectIndex, propertyName, value}. Searches inside that effect only.
- removeEffect: {compName?, layerIndex|layerName, effectName|effectIndex}
- getKeyframes: {compName?, layerIndex|layerName, propertyName, effectName?}. Lists keyframes (time, value, interpolation, ease) plus any expression
- removeKeyframes: {compName?, layerIndex|layerName, propertyName, effectName?} plus ONE of: all (true), keyIndices [..], time (seconds, must hit a keyframe)
- getProjectStatus: {}. Project name/path, item count, active comp. Every result also carries _project; get-results adds a _warning if the project changed
- saveProject: {path?, overwrite?}. No path saves in place; a path is Save As (refuses to replace an existing file unless overwrite is true)
- openProject: {path, saveCurrent (required true/false)}. Closes the current project first (saveCurrent false DISCARDS unsaved changes)
- newProject: {saveCurrent (required true/false)}. Closes the current project first
- undo: {steps? (default 1, max 20)}. Undoes the last N bridge commands that changed the project (one undo step per command; returns their names). Does not touch manual edits, and does not cover project/render commands
- setLayerTiming: {compName?, layerIndex|layerName, stretch? (percent, 100 = normal), startTime?, inPoint?, outPoint?, timeRemap? (bool)}
- splitLayer: {compName?, layerIndex|layerName, time}. The original keeps the first part; a copy above it gets the rest
- setAnchorPoint: {compName?, layerIndex|layerName, anchorPoint [x,y] | anchorPreset "center", keepPosition? (default true: the layer does not move on screen)}
- setLayerFlags: {compName?, layerIndex|layerName, locked?, shy?, solo?, guideLayer?, motionBlur?, adjustmentLayer?, collapseTransformation?, preserveTransparency?, label? (0-16)}
- renameLayer: {compName?, layerIndex|layerName, newName}
- addMarker: {compName?, layerIndex|layerName? (omit for a comp marker), time, comment?, duration?, label?, chapter?, url?}
- getMarkers: {compName?, layerIndex|layerName? (omit for comp markers)}
- removeMarkers: {compName?, layerIndex|layerName?} plus ONE of: all (true), indices [..], time (seconds, must hit a marker)
- listLayerProperties: {compName?, layerIndex|layerName, propertyPath? (names from the layer down)}. Lists one level of a layer's property tree (names, matchNames, values, keyframe counts, expressions) so you can find paths for setProperty and addShapeContent
- setProperty: {compName?, layerIndex|layerName, propertyPath [..] | propertyName (+effectName?), value, time? (set a keyframe at that time)}. Sets any property: shape fills and strokes, mask values, text animators, and so on
- addShapeContent: {compName?, layerIndex|layerName, type (group|rectangle|ellipse|star|polygon|fill|stroke|gradientFill|trimPaths|roundCorners|repeater), groupPath? (e.g. ["Contents","Group 1","Contents"]), name?, properties? ({"Color": [1,0,0]})}
- setTextDocument: {compName?, layerIndex|layerName, text?, font? (PostScript name), fontSize?, fillColor? [r,g,b], strokeColor?, strokeWidth?, tracking?, leading?, justification? (left|center|right|justify), fauxBold?, fauxItalic?, allCaps?, smallCaps?}
- getProjectTree: {folderName|folderId? (default: the project root), maxDepth?}. The Project panel as a tree with ids, types, labels and comp sizes
- createFolder: {name, parentFolderName|parentFolderId?}
- moveProjectItems: {itemIds [..] | itemNames [..] | namePrefix (min 4 chars), toFolderName|toFolderId? (default: the project root)}. Items with duplicate names must be given by id
- setProjectItemProperties: {itemId|itemName, newName?, label? (0-16), comment?}
- openComp: {compName}. Opens the comp in the Composition panel
- replaceLayerSource: {compName?, layerIndex|layerName, sourceItemName|sourceItemId, fixExpressions?}
- getCapabilities: {}. The panel's bridge version, After Effects version, and every command it supports. Every result also carries _bridgeVersion, and get-results warns if the installed panel is not the build this server ships
- setKeyframeEase: {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?), all | keyIndices | time, preset (easyEase|easyEaseIn|easyEaseOut|linear|hold|bezier), inSpeed?, inInfluence?, outSpeed?, outInfluence?}. "bezier" takes custom speeds and influences (0.1-100)
- offsetKeyframes: {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?), by (seconds), all | keyIndices | time}. Moves keyframes, keeping their values and ease
- copyKeyframes: {from: {compName?, layerIndex|layerName, propertyName|propertyPath, effectName?}, to: {same}, timeOffset?, clear?}. Copies every keyframe with value, interpolation and ease
- getSelection: {}. The active comp (playhead, work area), selected layers, selected properties (with paths and selected keys) and selected Project panel items
- setSelection: {compName?, layerIndices [..] | layerNames [..], additive?, clear?}
- setCurrentTime: {compName?, time (seconds) | frame}. Moves the playhead
- setWorkArea: {compName?, start?, duration? | end?}
- listEffects: {query?, category?, limit?}. Finds effect display names and match names, so applyEffect does not need guessing
- listFonts: {query?, limit?}. Finds PostScript font names for setTextDocument (After Effects 24 or later)
- listRenderTemplates: {}. Render settings and output module templates, for addToRenderQueue
- addExpressionControl: {compName?, layerIndex|layerName, type (slider|checkbox|color|angle|point|point3d|layer|dropdown), name, value?, options? (dropdown items)}. Adds an Expression Control effect and returns the expression text that reads it
- getPropertyReference: {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?)}. The expression text that reads a property, e.g. thisComp.layer("Controller").effect("Speed")("Slider")
- linkProperty: {from: {compName?, layerIndex|layerName, propertyPath|propertyName, effectName?}, to: {same}, factor?, offset?}. Makes "to" follow "from" with an expression (like the pick whip); factor and offset (single-number properties) give from * factor + offset. Same comp only
- setCameraProperties: {compName?, layerIndex|layerName (a camera), cameraType? (one-node|two-node), zoom?, depthOfField?, focusDistance?, aperture?, blurLevel?, position?, pointOfInterest?}. createCamera makes the camera
- createLight: {compName?, name?, lightType? (point|spot|parallel|ambient), intensity?, color? [r,g,b], coneAngle?, coneFeather?, castsShadows?, shadowDarkness?, shadowDiffusion?, position?, pointOfInterest?}
- setLightProperties: {compName?, layerIndex|layerName (a light)} plus any of the createLight settings
- backupProject: {folder? (default ~/Documents/ae-mcp-bridge/backups), label?, saveFirst?}. Copies the project file to a timestamped file. That is the last saved state; saveFirst saves the open project in place first
- deleteProjectItems: {namePrefix (min 4 chars), dryRun?, includeFolders?}. Removes comps/footage/solids whose names start with the prefix (and every layer using them). Folders are kept unless includeFolders is true (then only emptied ones go). For cleaning up scratch items
- exportFrame: {compName? (default: active comp), time? (seconds, default: comp time), outputPath? (.png; default: ~/Documents/ae-mcp-bridge/frames/), overwrite?, scale? (1 full size, 2 half, 4 quarter)}. Saves one frame as a PNG and returns its path, so you can open the image and check the result
- getRenderStatus: {}. Render queue items, status and output paths
- startRender: {}. Renders everything queued. BLOCKS After Effects until done, so a long render outlasts the server's wait; read the outcome later with getRenderStatus / get-results
- renameEffect: {compName, layerIndex|layerName, effectName|effectIndex, newName}. Expressions referencing the old name must be updated.
- addToRenderQueue: {compName, outputModuleTemplate?, outputPath?}. Queues only; does not start rendering.
- setLayerExpression also accepts an optional effectName to look for the property inside that effect only.

Effect Templates:
- gaussian-blur: Simple Gaussian blur effect
- directional-blur: Motion blur in a specific direction
- color-balance: Adjust hue, lightness, and saturation
- brightness-contrast: Basic brightness and contrast adjustment
- curves: Advanced color adjustment using curves
- glow: Add a glow effect to elements
- drop-shadow: Add a customizable drop shadow
- cinematic-look: Combination of effects for a cinematic appearance
- text-pop: Effects to make text stand out (glow and shadow)

Note: The auto-running panel can be left open in After Effects to continuously listen for commands from external applications.`
        }
      ]
    };
  }
);

// Add a tool specifically for creating compositions
server.tool(
  "create-composition",
  "Create a new composition in After Effects with specified parameters",
  {
    name: z.string().describe("Name of the composition"),
    width: z.number().int().positive().describe("Width of the composition in pixels"),
    height: z.number().int().positive().describe("Height of the composition in pixels"),
    pixelAspect: z.number().positive().optional().describe("Pixel aspect ratio (default: 1.0)"),
    duration: z.number().positive().optional().describe("Duration in seconds (default: 10.0)"),
    frameRate: z.number().positive().optional().describe("Frame rate in frames per second (default: 30.0)"),
    backgroundColor: z.object({
      r: z.number().int().min(0).max(255),
      g: z.number().int().min(0).max(255),
      b: z.number().int().min(0).max(255)
    }).optional().describe("Background color of the composition (RGB values 0-255)")
  },
  async (params) => {
    try {
      // Write command to file for After Effects to pick up
      writeCommandFile("createComposition", params);
      
      return {
        content: [
          {
            type: "text",
            text: `Command to create composition "${params.name}" has been queued.\n` +
                  `Please ensure the "MCP Bridge Auto" panel is open in After Effects.\n` +
                  `Use the "get-results" tool after a few seconds to check for results.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing composition creation: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// --- BEGIN NEW TOOLS --- 

// Zod schema for common layer identification
// Comp: compName (exact match, errors if missing), else compIndex (project item index), else the active comp.
// Layer: layerIndex (1-based) or layerName.
const LayerIdentifierSchema = {
  compName: z.string().optional().describe("Name of the target composition (exact match). Preferred over compIndex."),
  compIndex: z.number().int().positive().optional().describe("Project item index of the target composition. Used if compName is not given; if neither is given the active comp is used."),
  layerIndex: z.number().int().positive().optional().describe("1-based index of the target layer within the composition."),
  layerName: z.string().optional().describe("Name of the target layer. Used if layerIndex is not given.")
};

// Zod schema for keyframe value (more specific types might be needed depending on property)
// Using z.any() for flexibility, but can be refined (e.g., z.array(z.number()) for position/scale)
const KeyframeValueSchema = z.unknown().describe("The value for the keyframe (e.g., [x,y] for Position, [w,h] for Scale, angle for Rotation, percentage for Opacity)");

// Tool for setting a layer keyframe
server.tool(
  "setLayerKeyframe", // Corresponds to the function name in ExtendScript
  "Set a keyframe for a specific layer property at a given time.",
  {
    ...LayerIdentifierSchema, // Reuse common identifiers
    propertyName: z.string().describe("Name of the property to keyframe (e.g., 'Position', 'Scale', 'Rotation', 'Opacity')."),
    timeInSeconds: z.number().describe("The time (in seconds) for the keyframe."),
    value: KeyframeValueSchema
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("setLayerKeyframe", parameters);
      
      return {
        content: [
          {
            type: "text",
            text: `Command to set keyframe for "${parameters.propertyName}" on layer ${parameters.layerName ?? parameters.layerIndex} in comp ${parameters.compName ?? parameters.compIndex ?? "(active)"} has been queued.\n` +
                  `Use the "get-results" tool after a few seconds to check for confirmation.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing setLayerKeyframe command: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool for setting a layer expression
server.tool(
  "setLayerExpression", // Corresponds to the function name in ExtendScript
  "Set or remove an expression for a specific layer property.",
  {
    ...LayerIdentifierSchema, // Reuse common identifiers
    propertyName: z.string().describe("Name of the property to apply the expression to (e.g., 'Position', 'Scale', 'Rotation', 'Opacity')."),
    expressionString: z.string().describe("The JavaScript expression string. Provide an empty string (\"\") to remove the expression."),
    effectName: z.string().optional().describe("Optional. Name of an effect on the layer. If given, the property is looked up inside that effect only (use when an effect and its parameter share a name, e.g. 'Exposure').")
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("setLayerExpression", parameters);
      
      return {
        content: [
          {
            type: "text",
            text: `Command to set expression for "${parameters.propertyName}" on layer ${parameters.layerName ?? parameters.layerIndex} in comp ${parameters.compName ?? parameters.compIndex ?? "(active)"} has been queued.\n` +
                  `Use the "get-results" tool after a few seconds to check for confirmation.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing setLayerExpression command: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// --- END NEW TOOLS --- 

// --- BEGIN NEW TESTING TOOL --- 
// Add a special tool for directly testing the keyframe functionality
server.tool(
  "test-animation",
  "Test animation functionality in After Effects",
  {
    operation: z.enum(["keyframe", "expression"]).describe("The animation operation to test"),
    compIndex: z.number().int().positive().describe("Composition index (usually 1)"),
    layerIndex: z.number().int().positive().describe("Layer index (usually 1)")
  },
  async (params) => {
    try {
      // Generate a unique timestamp
      const timestamp = new Date().getTime();
      const tempFile = path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), `ae_test_${timestamp}.jsx`);
      
      // Create a direct test script that doesn't rely on command files
      let scriptContent = "";
      if (params.operation === "keyframe") {
        scriptContent = `
          // Direct keyframe test script
          try {
            var comp = app.project.items[${params.compIndex}];
            var layer = comp.layers[${params.layerIndex}];
            var prop = layer.property("Transform").property("Opacity");
            var time = 1; // 1 second
            var value = 25; // 25% opacity
            
            // Set a keyframe
            prop.setValueAtTime(time, value);
            
            // Write direct result
            var resultFile = new File("${path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), 'ae_test_result.txt').replace(/\\/g, '\\\\')}");
            resultFile.open("w");
            resultFile.write("SUCCESS: Added keyframe at time " + time + " with value " + value);
            resultFile.close();
            
            // Visual feedback
            alert("Test successful: Added opacity keyframe at " + time + "s with value " + value + "%");
          } catch (e) {
            var errorFile = new File("${path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), 'ae_test_error.txt').replace(/\\/g, '\\\\')}");
            errorFile.open("w");
            errorFile.write("ERROR: " + e.toString());
            errorFile.close();
            
            alert("Test failed: " + e.toString());
          }
        `;
      } else if (params.operation === "expression") {
        scriptContent = `
          // Direct expression test script
          try {
            var comp = app.project.items[${params.compIndex}];
            var layer = comp.layers[${params.layerIndex}];
            var prop = layer.property("Transform").property("Position");
            var expression = "wiggle(3, 30)";
            
            // Set the expression
            prop.expression = expression;
            
            // Write direct result
            var resultFile = new File("${path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), 'ae_test_result.txt').replace(/\\/g, '\\\\')}");
            resultFile.open("w");
            resultFile.write("SUCCESS: Added expression: " + expression);
            resultFile.close();
            
            // Visual feedback
            alert("Test successful: Added position expression: " + expression);
          } catch (e) {
            var errorFile = new File("${path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), 'ae_test_error.txt').replace(/\\/g, '\\\\')}");
            errorFile.open("w");
            errorFile.write("ERROR: " + e.toString());
            errorFile.close();
            
            alert("Test failed: " + e.toString());
          }
        `;
      }
      
      // Write the script to a temp file
      fs.writeFileSync(tempFile, scriptContent);
      console.error(`Written test script to: ${tempFile}`);
      
      // Tell the user what to do
      return {
        content: [
          {
            type: "text",
            text: `I've created a direct test script for the ${params.operation} operation.

Please run this script manually in After Effects:
1. In After Effects, go to File > Scripts > Run Script File...
2. Navigate to: ${tempFile}
3. You should see an alert confirming the result.

This bypasses the MCP Bridge Auto panel and will directly modify the specified layer.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating test script: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);
// --- END NEW TESTING TOOL --- 

// --- BEGIN NEW EFFECTS TOOLS ---

// Add a tool for applying effects to layers
server.tool(
  "apply-effect",
  "Apply an effect to a layer in After Effects",
  {
    ...LayerIdentifierSchema,
    effectName: z.string().optional().describe("Display name of the effect to apply (e.g., 'Gaussian Blur')."),
    effectMatchName: z.string().optional().describe("After Effects internal name for the effect (more reliable, e.g., 'ADBE Gaussian Blur 2')."),
    effectCategory: z.string().optional().describe("Optional category for filtering effects."),
    presetPath: z.string().optional().describe("Optional path to an effect preset file (.ffx)."),
    effectSettings: z.record(z.string(), z.unknown()).optional().describe("Optional parameters for the effect (e.g., { 'Blurriness': 25 }).")
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffect", parameters);
      
      return {
        content: [
          {
            type: "text",
            text: `Command to apply effect to layer ${parameters.layerName ?? parameters.layerIndex} in composition ${parameters.compName ?? parameters.compIndex ?? "(active)"} has been queued.\n` +
                  `Use the "get-results" tool after a few seconds to check for confirmation.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing apply-effect command: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Add a tool for applying effect templates
server.tool(
  "apply-effect-template",
  "Apply a predefined effect template to a layer in After Effects",
  {
    ...LayerIdentifierSchema,
    templateName: z.enum([
      "gaussian-blur", 
      "directional-blur", 
      "color-balance", 
      "brightness-contrast",
      "curves",
      "glow",
      "drop-shadow",
      "cinematic-look",
      "text-pop"
    ]).describe("Name of the effect template to apply."),
    customSettings: z.record(z.string(), z.unknown()).optional().describe("Optional custom settings to override defaults.")
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffectTemplate", parameters);
      
      return {
        content: [
          {
            type: "text",
            text: `Command to apply effect template '${parameters.templateName}' to layer ${parameters.layerName ?? parameters.layerIndex} in composition ${parameters.compName ?? parameters.compIndex ?? "(active)"} has been queued.\n` +
                  `Use the "get-results" tool after a few seconds to check for confirmation.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing apply-effect-template command: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// --- END NEW EFFECTS TOOLS ---

// Add direct MCP function for applying effects
server.tool(
  "mcp_aftereffects_applyEffect",
  "Apply an effect to a layer in After Effects",
  {
    ...LayerIdentifierSchema,
    effectName: z.string().optional().describe("Display name of the effect to apply (e.g., 'Gaussian Blur')."),
    effectMatchName: z.string().optional().describe("After Effects internal name for the effect (more reliable, e.g., 'ADBE Gaussian Blur 2')."),
    effectSettings: z.record(z.string(), z.unknown()).optional().describe("Optional parameters for the effect (e.g., { 'Blurriness': 25 }).")
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffect", parameters);
      
      // Wait a bit for After Effects to process the command
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the results
      const result = await readLastResult();
      
      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error applying effect: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Add direct MCP function for applying effect templates
server.tool(
  "mcp_aftereffects_applyEffectTemplate",
  "Apply a predefined effect template to a layer in After Effects",
  {
    ...LayerIdentifierSchema,
    templateName: z.enum([
      "gaussian-blur", 
      "directional-blur", 
      "color-balance", 
      "brightness-contrast",
      "curves",
      "glow",
      "drop-shadow",
      "cinematic-look",
      "text-pop"
    ]).describe("Name of the effect template to apply."),
    customSettings: z.record(z.string(), z.unknown()).optional().describe("Optional custom settings to override defaults.")
  },
  async (parameters) => {
    try {
      // Queue the command for After Effects
      writeCommandFile("applyEffectTemplate", parameters);
      
      // Wait a bit for After Effects to process the command
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the results
      const result = await readLastResult();
      
      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error applying effect template: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Update help information to include the new effects tools
server.tool(
  "mcp_aftereffects_get_effects_help",
  "Get help on using After Effects effects",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `# After Effects Effects Help

## Common Effect Match Names
These are internal names used by After Effects that can be used with the \`effectMatchName\` parameter:

### Blur & Sharpen
- Gaussian Blur: "ADBE Gaussian Blur 2"
- Camera Lens Blur: "ADBE Camera Lens Blur"
- Directional Blur: "ADBE Directional Blur"
- Radial Blur: "ADBE Radial Blur"
- Smart Blur: "ADBE Smart Blur"
- Unsharp Mask: "ADBE Unsharp Mask"

### Color Correction
- Brightness & Contrast: "ADBE Brightness & Contrast 2"
- Color Balance: "ADBE Color Balance (HLS)"
- Color Balance (RGB): "ADBE Pro Levels2"
- Curves: "ADBE CurvesCustom"
- Exposure: "ADBE Exposure2"
- Hue/Saturation: "ADBE HUE SATURATION"
- Levels: "ADBE Pro Levels2"
- Vibrance: "ADBE Vibrance"

### Stylistic
- Glow: "ADBE Glow"
- Drop Shadow: "ADBE Drop Shadow"
- Bevel Alpha: "ADBE Bevel Alpha"
- Noise: "ADBE Noise"
- Fractal Noise: "ADBE Fractal Noise"
- CC Particle World: "CC Particle World"
- CC Light Sweep: "CC Light Sweep"

## Effect Templates
The following predefined effect templates are available:

- \`gaussian-blur\`: Simple Gaussian blur effect
- \`directional-blur\`: Motion blur in a specific direction
- \`color-balance\`: Adjust hue, lightness, and saturation
- \`brightness-contrast\`: Basic brightness and contrast adjustment
- \`curves\`: Advanced color adjustment using curves
- \`glow\`: Add a glow effect to elements
- \`drop-shadow\`: Add a customizable drop shadow
- \`cinematic-look\`: Combination of effects for a cinematic appearance
- \`text-pop\`: Effects to make text stand out (glow and shadow)

## Example Usage
To apply a Gaussian blur effect:

\`\`\`json
{
  "compIndex": 1,
  "layerIndex": 1,
  "effectMatchName": "ADBE Gaussian Blur 2",
  "effectSettings": {
    "Blurriness": 25
  }
}
\`\`\`

To apply the "cinematic-look" template:

\`\`\`json
{
  "compIndex": 1,
  "layerIndex": 1,
  "templateName": "cinematic-look"
}
\`\`\`
`
        }
      ]
    };
  }
);

// Add a direct tool for our bridge test effects
server.tool(
  "run-bridge-test",
  "Run the bridge test effects script to verify communication and apply test effects",
  {},
  async () => {
    try {
      // Queue the command for After Effects to pick up
      writeCommandFile("bridgeTestEffects", {});
      
      return {
        content: [
          {
            type: "text",
            text: `Bridge test effects command has been queued.\n` +
                  `Please ensure the "MCP Bridge Auto" panel is open in After Effects.\n` +
                  `Use the "get-results" tool after a few seconds to check for the test results.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error queuing bridge test command: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Start the MCP server
async function main() {
  console.error("After Effects MCP Server starting...");
  console.error(`Scripts directory: ${SCRIPTS_DIR}`);
  console.error(`Temp directory: ${TEMP_DIR}`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("After Effects MCP Server running...");
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
