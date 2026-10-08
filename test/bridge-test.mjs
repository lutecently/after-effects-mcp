#!/usr/bin/env node
// End-to-end test of the After Effects bridge.
//
// Drives the MCP Bridge Auto panel through the command queue (no MCP server needed), runs a standard sequence in
// scratch comps, checks every result, decodes an exported frame to confirm the rotation really happened, and removes
// everything it created.
//
// Needs After Effects open with the MCP Bridge Auto panel running. It adds and removes items named "MCPTEST_*" in the
// OPEN project, and uses its undo stack, so run it in a scratch project:
//
//   node test/bridge-test.mjs --run-in-open-project          (or: npm run test:bridge -- --run-in-open-project)
//   add --keep to leave the MCPTEST_ items in place for inspection
//
// Deliberately not covered: startRender (it would render whatever is in the user's queue), and actually saving or
// switching projects (only their guards are checked).

import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";

const BRIDGE = path.join(os.homedir(), "Documents", "ae-mcp-bridge");
const QUEUE = path.join(BRIDGE, "queue");
const RESULTS = path.join(BRIDGE, "results");
const PREFIX = "MCPTEST_";
const RUN = Date.now().toString(36);
let seq = 0;

const args = new Set(process.argv.slice(2));
const failures = [];
let checks = 0;
let failedChecks = 0;

function check(name, ok, detail = "") {
  checks++;
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failedChecks++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `  (${detail})` : ""}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- queue client ---
function enqueue(command, commandArgs = {}, idPrefix = "test") {
  fs.mkdirSync(QUEUE, { recursive: true });
  fs.mkdirSync(RESULTS, { recursive: true });
  const id = `${idPrefix}-${RUN}-${++seq}`;
  const file = path.join(QUEUE, `${String(Date.now()).padStart(13, "0")}-${id}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ id, command, args: commandArgs }));
  fs.renameSync(`${file}.tmp`, file);
  return id;
}

async function waitFor(id, timeoutMs = 60000) {
  const out = path.join(RESULTS, `${id}.json`);
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (fs.existsSync(out)) {
      try {
        return JSON.parse(fs.readFileSync(out, "utf8"));
      } catch {
        // half-written; try again
      }
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for the result of ${id}. Is the MCP Bridge Auto panel open in After Effects?`);
}

async function run(command, commandArgs = {}) {
  const id = enqueue(command, commandArgs);
  const result = await waitFor(id);
  if (result._commandId !== id) throw new Error(`Result for ${command} carried id ${result._commandId}, expected ${id}`);
  return result;
}

// Same fingerprint the panel computes for its own file (FNV-1a over ASCII characters, ignoring carriage returns)
function bridgeFingerprint(file) {
  const text = fs.readFileSync(file, "utf8");
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 127 || c === 13) continue;
    h ^= c;
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}
const BUILT_PANEL = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "build", "scripts", "mcp-bridge-auto.jsx");

const isOk = (r) => r && (r.status === "success" || r.success === true);
const isError = (r) => r && (r.status === "error" || r.success === false || typeof r.error === "string");

// --- minimal PNG decoder (8-bit RGB/RGBA, not interlaced), enough to inspect pixels ---
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let off = 8, width = 0, height = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error("unsupported PNG (need 8-bit, not interlaced)");
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!bpp) throw new Error(`unsupported PNG color type ${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v;
      if (filter === 0) v = line[x];
      else if (filter === 1) v = line[x] + a;
      else if (filter === 2) v = line[x] + b;
      else if (filter === 3) v = line[x] + ((a + b) >> 1);
      else {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { width, height, at: (x, y) => [px[y * stride + x * bpp], px[y * stride + x * bpp + 1], px[y * stride + x * bpp + 2]] };
}

const isRed = ([r, g, b]) => r > 200 && g < 110 && b < 110;

// --- helpers for reading layer info ---
const layer = (info, name) => info.layers.find((l) => l.name === name);
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const nearVec = (v, w, tol = 0.5) => v.length >= w.length && w.every((x, i) => near(v[i], x, tol));

async function main() {
  const status = await run("getProjectStatus");
  const label = status.path || status.name || "(unsaved project)";
  console.log(`Open project: ${label}  (${status.numItems} items)`);
  if (!args.has("--run-in-open-project")) {
    console.log(`\nThis test adds and removes ${PREFIX}* comps and solids in the open project and uses its undo stack.`);
    console.log("Run it in a scratch project, then pass --run-in-open-project to continue.");
    process.exit(2);
  }
  const startItems = status.numItems;
  check("bridge answers and stamps results with the command id", isOk(status) && status._project && status._commandExecuted === "getProjectStatus");

  const MAIN = `${PREFIX}main`, PRE = `${PREFIX}pre`;
  try {
    console.log("\nBridge handshake");
    let r = await run("getCapabilities");
    check("getCapabilities lists the commands", isOk(r) && Array.isArray(r.commands) && r.commands.includes("getCapabilities") && r.commands.includes("setKeyframeEase") && r.commands.length > 60, `${(r.commands || []).length} commands`);
    if (fs.existsSync(BUILT_PANEL)) {
      check("the installed panel is the build in build/scripts (reinstall it if not)", r.bridgeVersion === bridgeFingerprint(BUILT_PANEL), `panel ${r.bridgeVersion}, build ${bridgeFingerprint(BUILT_PANEL)}`);
    }
    check("results carry the bridge version", r._bridgeVersion === r.bridgeVersion);
    r = await run("definitelyNotACommand");
    check("an unknown command is rejected with the list of real ones", isError(r) && Array.isArray(r.availableCommands) && r.availableCommands.includes("getCapabilities"), JSON.stringify(r).slice(0, 120));

    console.log("\nScene setup");
    r = await run("createComposition", { name: MAIN, width: 1080, height: 1920, duration: 5, frameRate: 30 });
    check("createComposition", isOk(r), r.message);

    r = await run("createSolidLayer", { compName: MAIN, name: `${PREFIX}red`, color: [1, 0.2, 0.2], size: [400, 400], position: [540, 600], duration: 5 });
    check("createSolidLayer (red)", isOk(r), r.message);
    r = await run("createSolidLayer", { compName: MAIN, name: `${PREFIX}blue`, color: [0.2, 0.4, 1], size: [400, 400], position: [540, 1300], duration: 5 });
    check("createSolidLayer (blue)", isOk(r), r.message);

    r = await run("precomposeLayers", { compName: MAIN, layerNames: [`${PREFIX}red`, `${PREFIX}blue`], newCompName: PRE, moveAllAttributes: true });
    check("precomposeLayers", isOk(r) && r.precomposedCount === 2 && r.composition?.name === PRE, r.message);

    console.log("\nNull, parenting and controller");
    r = await run("createNullLayer", { compName: PRE, name: `${PREFIX}null` });
    check("createNullLayer defaults to the comp centre", isOk(r) && nearVec(r.layer.position, [540, 960]), JSON.stringify(r.layer));
    r = await run("createNullLayer", { compName: PRE, name: `${PREFIX}ctrl` });
    check("createNullLayer (controller)", isOk(r), r.message);

    for (const name of [`${PREFIX}red`, `${PREFIX}blue`]) {
      r = await run("setLayerParent", { compName: PRE, layerName: name, parentLayerName: `${PREFIX}null` });
      check(`setLayerParent ${name}`, isOk(r), r.message);
    }
    let info = await run("getLayerInfo", { compName: PRE });
    const red = layer(info, `${PREFIX}red`), blue = layer(info, `${PREFIX}blue`);
    check("getLayerInfo reports the parent", red?.parent?.name === `${PREFIX}null` && blue?.parent?.name === `${PREFIX}null`);
    check("parenting keeps the squares in place (local = world - parent)", nearVec(red.position, [0, -360]) && nearVec(blue.position, [0, 340]), `red ${red?.position} blue ${blue?.position}`);
    check("getLayerInfo flags nulls", layer(info, `${PREFIX}null`)?.isNull === true && red.isNull === false);

    r = await run("applyEffect", { compName: PRE, layerName: `${PREFIX}ctrl`, effectMatchName: "ADBE Slider Control" });
    check("applyEffect by comp and layer name", isOk(r), r.message);
    r = await run("renameEffect", { compName: PRE, layerName: `${PREFIX}ctrl`, effectName: "Slider Control", newName: `${PREFIX}speed` });
    check("renameEffect", isOk(r) && r.effect?.name === `${PREFIX}speed`, r.message);
    r = await run("setEffectProperty", { compName: PRE, layerName: `${PREFIX}ctrl`, effectName: `${PREFIX}speed`, propertyName: "Slider", value: 360 });
    check("setEffectProperty (slider = 360)", isOk(r) && r.property?.newValue === 360, r.message);
    r = await run("setLayerExpression", {
      compName: PRE, layerName: `${PREFIX}null`, propertyName: "Rotation",
      expressionString: `time * thisComp.layer("${PREFIX}ctrl").effect("${PREFIX}speed")("Slider")`,
    });
    check("setLayerExpression by comp and layer name", isOk(r), r.message);
    r = await run("getKeyframes", { compName: PRE, layerName: `${PREFIX}null`, propertyName: "Rotation" });
    check("getKeyframes shows the expression", isOk(r) && r.property?.expressionEnabled === true && String(r.property.expression).includes(`${PREFIX}speed`), JSON.stringify(r.property));

    console.log("\nKeyframes and effects");
    for (const [t, v] of [[0, 100], [2, 40]]) {
      r = await run("setLayerKeyframe", { compName: PRE, layerName: `${PREFIX}red`, propertyName: "Opacity", timeInSeconds: t, value: v });
      check(`setLayerKeyframe at ${t}s`, isOk(r), r.message);
    }
    r = await run("getKeyframes", { compName: PRE, layerName: `${PREFIX}red`, propertyName: "Opacity" });
    check("getKeyframes lists both keys", isOk(r) && r.keyframes?.length === 2 && r.keyframes[1].value === 40 && r.keyframes[1].time === 2, JSON.stringify(r.keyframes));
    r = await run("removeKeyframes", { compName: PRE, layerName: `${PREFIX}red`, propertyName: "Opacity", time: 1 });
    check("removeKeyframes refuses a time that is not on a key", isError(r), r.message);
    r = await run("removeKeyframes", { compName: PRE, layerName: `${PREFIX}red`, propertyName: "Opacity", all: true });
    check("removeKeyframes all", isOk(r) && r.property?.keyframesAfter === 0, r.message);
    r = await run("setLayerProperties", { compName: PRE, layerName: `${PREFIX}red`, opacity: 100 });
    check("opacity back to 100", isOk(r), r.message);

    r = await run("applyEffect", { compName: PRE, layerName: `${PREFIX}ctrl`, effectMatchName: "ADBE Slider Control" });
    check("applyEffect (temporary second effect)", isOk(r), r.message);
    r = await run("removeEffect", { compName: PRE, layerName: `${PREFIX}ctrl`, effectName: "Slider Control" });
    check("removeEffect", isOk(r), r.message);
    info = await run("getLayerInfo", { compName: PRE, layerName: `${PREFIX}ctrl` });
    check("only the renamed slider is left", info.layers[0].effects.length === 1 && info.layers[0].effects[0].name === `${PREFIX}speed`, JSON.stringify(info.layers[0].effects));

    console.log("\nSafety guards");
    r = await run("setLayerProperties", { compName: `${PREFIX}no_such_comp`, layerName: "x", opacity: 1 });
    check("an unknown compName errors instead of using the active comp", isError(r) && /not found/i.test(r.message || ""), r.message);
    r = await run("getLayerInfo", { compName: `${PREFIX}no_such_comp` });
    check("getLayerInfo with an unknown comp errors", isError(r), JSON.stringify(r).slice(0, 120));
    r = await run("openProject", { path: path.join(os.tmpdir(), "does-not-exist.aep") });
    check("openProject requires saveCurrent", isError(r) && /saveCurrent/.test(r.message || ""), r.message);
    const existing = path.join(os.tmpdir(), `mcptest-${RUN}.aep`);
    fs.writeFileSync(existing, "x");
    r = await run("saveProject", { path: existing });
    check("saveProject refuses to overwrite an existing file", isError(r) && /already exists/.test(r.message || ""), r.message);
    check("...and left the file alone", fs.readFileSync(existing, "utf8") === "x");
    fs.rmSync(existing, { force: true });
    r = await run("exportFrame", { compName: PRE, time: 99 });
    check("exportFrame rejects a time outside the comp", isError(r), r.message);

    console.log("\nUndo");
    r = await run("setLayerProperties", { compName: PRE, layerName: `${PREFIX}blue`, opacity: 60 });
    check("setLayerProperties (opacity 60)", isOk(r) && r.layer?.opacity === 60, r.message);
    r = await run("undo");
    check("undo reports the command it reversed", isOk(r) && r.undone?.[0] === "setLayerProperties", JSON.stringify(r.undone));
    info = await run("getLayerInfo", { compName: PRE, layerName: `${PREFIX}blue` });
    check("undo restored the opacity", info.layers[0].transform.opacity.value === 100, `opacity ${info.layers[0].transform.opacity.value}`);

    console.log("\nFrame export (the spin, seen from outside)");
    const frame = path.join(os.tmpdir(), `mcptest-${RUN}.png`);
    r = await run("exportFrame", { compName: PRE, time: 0.125, scale: 2, outputPath: frame, overwrite: true });
    check("exportFrame succeeds", isOk(r) && r.bytes > 500, r.message);
    check("exportFrame honours scale (540x960)", r.width === 540 && r.height === 960, `${r.width}x${r.height}`);
    if (fs.existsSync(frame)) {
      const png = decodePng(fs.readFileSync(frame));
      check("the PNG really is 540x960", png.width === 540 && png.height === 960, `${png.width}x${png.height}`);
      // 360 deg/s for 0.125s = 45 degrees. The red square starts 360px above the centre (540,960); at 45 degrees clockwise
      // it is at (540 + 360 sin45, 960 - 360 cos45), halved for scale 2.
      const rad = Math.PI / 4;
      const ex = Math.round((540 + 360 * Math.sin(rad)) / 2), ey = Math.round((960 - 360 * Math.cos(rad)) / 2);
      check(`red square is at its 45 degree position (${ex},${ey})`, isRed(png.at(ex, ey)), `pixel ${png.at(ex, ey)}`);
      check("red square has left its starting position (270,300)", !isRed(png.at(270, 300)), `pixel ${png.at(270, 300)}`);
      fs.rmSync(frame, { force: true });
    } else {
      check("the PNG file exists", false, frame);
    }

    console.log("\nLayer tools");
    r = await run("createSolidLayer", { compName: MAIN, name: `${PREFIX}tool`, color: [0.5, 0.5, 0.5], size: [200, 100], position: [300, 300], duration: 5 });
    check("createSolidLayer for the tool tests", isOk(r), r.message);
    r = await run("setLayerTiming", { compName: MAIN, layerName: `${PREFIX}tool`, inPoint: 0.5 });
    check("setLayerTiming with only inPoint trims the start and leaves the out point (AE would slide it)", isOk(r) && near(r.layer.inPoint, 0.5, 0.01) && near(r.layer.outPoint, 5, 0.01), JSON.stringify(r.layer));
    r = await run("setLayerTiming", { compName: MAIN, layerName: `${PREFIX}tool`, outPoint: 3 });
    check("setLayerTiming with only outPoint trims the end", isOk(r) && near(r.layer.inPoint, 0.5, 0.01) && near(r.layer.outPoint, 3, 0.01), JSON.stringify(r.layer));
    r = await run("splitLayer", { compName: MAIN, layerName: `${PREFIX}tool`, time: 2 });
    check("splitLayer cuts at the time", isOk(r) && near(r.first.outPoint, 2, 0.01) && near(r.second.inPoint, 2, 0.01) && near(r.first.inPoint, 0.5, 0.01) && near(r.second.outPoint, 3, 0.01), JSON.stringify(r));
    const toolIndex = r.first.index;
    r = await run("splitLayer", { compName: MAIN, layerIndex: toolIndex, time: 99 });
    check("splitLayer refuses a time outside the layer", isError(r), r.message);

    r = await run("setAnchorPoint", { compName: MAIN, layerIndex: toolIndex, anchorPoint: [0, 0] });
    check("setAnchorPoint keeps the layer in place (position follows the anchor)", isOk(r) && nearVec(r.position, [200, 250]) && nearVec(r.anchorPoint, [0, 0]), JSON.stringify(r));
    r = await run("setLayerProperties", { compName: MAIN, layerIndex: toolIndex, rotation: 90 });
    check("rotate the tool layer", isOk(r), r.message);
    r = await run("setAnchorPoint", { compName: MAIN, layerIndex: toolIndex, anchorPreset: "center" });
    // center anchor is (100,50); from (0,0) that is a (100,50) shift in layer space, rotated 90 degrees clockwise = (-50,100)
    check("setAnchorPoint accounts for rotation", isOk(r) && nearVec(r.anchorPoint, [100, 50]) && nearVec(r.position, [150, 350]), JSON.stringify(r));

    r = await run("setLayerFlags", { compName: MAIN, layerIndex: toolIndex, shy: true, label: 5 });
    check("setLayerFlags", isOk(r) && r.flags.shy === true && r.flags.label === 5, JSON.stringify(r.flags));
    r = await run("renameLayer", { compName: MAIN, layerIndex: toolIndex, newName: `${PREFIX}tool_renamed` });
    check("renameLayer", isOk(r) && r.layer.name === `${PREFIX}tool_renamed`, r.message);
    info = await run("getLayerInfo", { compName: MAIN, layerName: `${PREFIX}tool_renamed` });
    check("the rename and flags are visible in getLayerInfo", info.layers.length === 1 && info.layers[0].shy === true && info.layers[0].label === 5);

    console.log("\nMarkers");
    r = await run("addMarker", { compName: MAIN, time: 1, comment: `${PREFIX}comp marker`, duration: 0.5 });
    check("addMarker on the comp", isOk(r), r.message);
    r = await run("addMarker", { compName: MAIN, layerName: `${PREFIX}tool_renamed`, time: 1, comment: `${PREFIX}layer marker` });
    check("addMarker on a layer", isOk(r), r.message);
    r = await run("getMarkers", { compName: MAIN });
    check("getMarkers (comp) returns the comment and duration", isOk(r) && r.owner === "comp" && r.markers.length === 1 && r.markers[0].comment === `${PREFIX}comp marker` && near(r.markers[0].duration, 0.5, 0.01), JSON.stringify(r.markers));
    r = await run("getMarkers", { compName: MAIN, layerName: `${PREFIX}tool_renamed` });
    check("getMarkers (layer) is separate from the comp's", isOk(r) && r.owner === "layer" && r.markers.length === 1 && r.markers[0].comment === `${PREFIX}layer marker`, JSON.stringify(r.markers));
    r = await run("removeMarkers", { compName: MAIN, time: 2 });
    check("removeMarkers refuses a time that is not on a marker", isError(r), r.message);
    r = await run("removeMarkers", { compName: MAIN, all: true });
    check("removeMarkers all", isOk(r) && r.after === 0, JSON.stringify(r));

    console.log("\nShapes and the property tree");
    r = await run("createShapeLayer", { compName: MAIN, name: `${PREFIX}shape`, shapeType: "rectangle", size: [100, 100], fillColor: [1, 0, 0], position: [800, 300] });
    check("createShapeLayer", isOk(r), r.message);
    r = await run("listLayerProperties", { compName: MAIN, layerName: `${PREFIX}shape`, propertyPath: ["Contents"] });
    check("listLayerProperties shows the shape group", isOk(r) && r.properties.some((p) => p.name === "Group 1"), JSON.stringify(r.properties?.map((p) => p.name)));
    const inner = ["Contents", "Group 1", "Contents"];
    r = await run("listLayerProperties", { compName: MAIN, layerName: `${PREFIX}shape`, propertyPath: inner });
    check("...and the path and fill inside it", isOk(r) && r.properties.some((p) => p.name === "Fill 1") && r.properties.some((p) => /Rectangle/.test(p.name)), JSON.stringify(r.properties?.map((p) => p.name)));
    r = await run("addShapeContent", { compName: MAIN, layerName: `${PREFIX}shape`, type: "trimPaths", groupPath: inner, properties: { End: 50 } });
    check("addShapeContent adds trim paths with a property set", isOk(r) && r.propertiesSet.includes("End"), r.message);
    r = await run("listLayerProperties", { compName: MAIN, layerName: `${PREFIX}shape`, propertyPath: [...inner, r.added?.name || "Trim Paths 1"] });
    check("the trim paths End value was applied", isOk(r) && r.properties.some((p) => p.name === "End" && near(p.value, 50, 0.01)), JSON.stringify(r.properties?.map((p) => [p.name, p.value])));
    r = await run("addShapeContent", { compName: MAIN, layerName: `${PREFIX}shape`, type: "banana", groupPath: inner });
    check("addShapeContent rejects an unknown type", isError(r), r.message);
    r = await run("addShapeContent", { compName: MAIN, layerName: `${PREFIX}shape`, type: "stroke", groupPath: inner, properties: { "No Such Property": 1 } });
    check("addShapeContent rejects an unknown property and leaves nothing behind", isError(r), r.message);
    r = await run("listLayerProperties", { compName: MAIN, layerName: `${PREFIX}shape`, propertyPath: inner });
    check("...no stroke was left behind", isOk(r) && !r.properties.some((p) => /Stroke/.test(p.name)), JSON.stringify(r.properties?.map((p) => p.name)));
    r = await run("setProperty", { compName: MAIN, layerName: `${PREFIX}shape`, propertyPath: [...inner, "Fill 1", "Color"], value: [0, 1, 0] });
    check("setProperty by path (fill colour)", isOk(r) && nearVec(r.property.newValue, [0, 1, 0], 0.01), JSON.stringify(r.property));
    r = await run("setProperty", { compName: MAIN, layerName: `${PREFIX}shape`, propertyName: "Opacity", value: 70 });
    check("setProperty by name", isOk(r) && near(r.property.newValue, 70, 0.01), JSON.stringify(r.property));
    r = await run("setProperty", { compName: MAIN, layerName: `${PREFIX}shape`, propertyPath: ["Contents", "No Such Group"], value: 1 });
    check("setProperty reports a bad path with what is available", isError(r) && /Available here/.test(r.message || ""), r.message);
    r = await run("setProperty", { compName: MAIN, layerName: `${PREFIX}shape`, propertyPath: ["Contents"], value: 1 });
    check("setProperty refuses a group", isError(r), r.message);

    console.log("\nText");
    r = await run("createTextLayer", { compName: MAIN, text: `${PREFIX}hello`, position: [540, 1500], fontSize: 60 });
    check("createTextLayer", isOk(r), r.message);
    const textIndex = r.layer.index;
    r = await run("setTextDocument", { compName: MAIN, layerIndex: textIndex, text: `${PREFIX}changed`, fontSize: 77, tracking: 50, justification: "center", fillColor: [0, 0, 1] });
    check("setTextDocument", isOk(r) && r.text.text === `${PREFIX}changed` && near(r.text.fontSize, 77, 0.01) && near(r.text.tracking, 50, 0.01) && nearVec(r.text.fillColor, [0, 0, 1], 0.01), JSON.stringify(r.text));
    r = await run("setTextDocument", { compName: MAIN, layerName: `${PREFIX}shape`, text: "nope" });
    check("setTextDocument refuses a non-text layer", isError(r), r.message);

    console.log("\nKeyframe easing, offset and copy");
    const TOOL = `${PREFIX}tool_renamed`, SHAPE = `${PREFIX}shape`;
    for (const [t, v] of [[0, 100], [1, 20]]) {
      r = await run("setLayerKeyframe", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", timeInSeconds: t, value: v });
      check(`setLayerKeyframe ${t}s`, isOk(r), r.message);
    }
    r = await run("setKeyframeEase", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", all: true, preset: "easyEase" });
    check("setKeyframeEase easyEase gives speed 0 and influence 33 on both sides", isOk(r) && r.keyframes.length === 2 && r.keyframes.every((k) => k.inInterpolation === "bezier" && k.outInterpolation === "bezier" && near(k.inEase[0].influence, 33.33, 0.1) && near(k.outEase[0].speed, 0, 0.001)), JSON.stringify(r.keyframes));
    r = await run("setKeyframeEase", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", keyIndices: [1], preset: "hold" });
    check("setKeyframeEase hold", isOk(r) && r.keyframes[0].outInterpolation === "hold", JSON.stringify(r.keyframes));
    r = await run("setKeyframeEase", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", keyIndices: [2], preset: "bezier", inSpeed: 0, inInfluence: 80, outSpeed: 0, outInfluence: 10 });
    check("setKeyframeEase bezier takes custom influences", isOk(r) && near(r.keyframes[0].inEase[0].influence, 80, 0.5) && near(r.keyframes[0].outEase[0].influence, 10, 0.5), JSON.stringify(r.keyframes));
    r = await run("setKeyframeEase", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", all: true, preset: "banana" });
    check("setKeyframeEase rejects an unknown preset", isError(r), r.message);
    r = await run("setKeyframeEase", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", preset: "linear" });
    check("setKeyframeEase needs to be told which keyframes", isError(r), r.message);
    r = await run("setKeyframeEase", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", keyIndices: [9], preset: "linear" });
    check("setKeyframeEase rejects a keyframe index that does not exist", isError(r), r.message);

    r = await run("offsetKeyframes", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", by: 0.5, all: true });
    check("offsetKeyframes moves the keys", isOk(r) && near(r.property.keyTimes[0], 0.5, 0.01) && near(r.property.keyTimes[1], 1.5, 0.01), JSON.stringify(r.property));
    r = await run("getKeyframes", { compName: MAIN, layerName: TOOL, propertyName: "Opacity" });
    check("...keeping values, hold and custom ease", r.keyframes.length === 2 && r.keyframes[0].value === 100 && r.keyframes[1].value === 20 && r.keyframes[0].outInterpolation === "hold" && near(r.keyframes[1].inEase[0].influence, 80, 0.5), JSON.stringify(r.keyframes));
    r = await run("offsetKeyframes", { compName: MAIN, layerName: TOOL, propertyName: "Opacity", by: -2, all: true });
    check("offsetKeyframes refuses to go before time 0", isError(r), r.message);

    r = await run("copyKeyframes", { from: { compName: MAIN, layerName: TOOL, propertyName: "Opacity" }, to: { compName: MAIN, layerName: SHAPE, propertyName: "Opacity" }, timeOffset: 1 });
    check("copyKeyframes copies to another layer", isOk(r) && r.to.numKeyframes === 2, JSON.stringify(r));
    r = await run("getKeyframes", { compName: MAIN, layerName: SHAPE, propertyName: "Opacity" });
    check("...shifted by the offset, with value and hold kept", r.keyframes.length === 2 && near(r.keyframes[0].time, 1.5, 0.01) && near(r.keyframes[1].time, 2.5, 0.01) && r.keyframes[0].value === 100 && r.keyframes[0].outInterpolation === "hold", JSON.stringify(r.keyframes));
    r = await run("copyKeyframes", { from: { compName: MAIN, layerName: TOOL, propertyName: "Opacity" }, to: { compName: MAIN, layerName: SHAPE, propertyName: "Position" } });
    check("copyKeyframes refuses different kinds of property", isError(r) && /different kinds/.test(r.message || ""), r.message);
    r = await run("copyKeyframes", { from: { compName: MAIN, layerName: SHAPE, propertyName: "Scale" }, to: { compName: MAIN, layerName: TOOL, propertyName: "Scale" } });
    check("copyKeyframes errors when the source has no keyframes", isError(r), r.message);
    for (const name of [TOOL, SHAPE]) {
      r = await run("removeKeyframes", { compName: MAIN, layerName: name, propertyName: "Opacity", all: true });
      check(`removeKeyframes all (${name})`, isOk(r) && r.property.keyframesAfter === 0, r.message);
    }

    console.log("\nContext and discovery");
    r = await run("openComp", { compName: MAIN });
    check("openComp for the context tests", isOk(r), r.message);
    r = await run("setSelection", { compName: MAIN, layerNames: [TOOL] });
    check("setSelection selects a layer", isOk(r) && r.selectedLayers.length === 1 && r.selectedLayers[0].name === TOOL, JSON.stringify(r.selectedLayers));
    r = await run("setCurrentTime", { compName: MAIN, time: 1.5 });
    check("setCurrentTime moves the playhead", isOk(r) && near(r.time, 1.5, 0.001), JSON.stringify(r));
    r = await run("getSelection");
    check("getSelection reports the comp, playhead and selected layer", isOk(r) && r.activeComp?.name === MAIN && near(r.activeComp.time, 1.5, 0.001) && r.selectedLayers.some((l) => l.name === TOOL), JSON.stringify({ comp: r.activeComp?.name, time: r.activeComp?.time, layers: r.selectedLayers }));
    r = await run("setSelection", { compName: MAIN, clear: true });
    check("setSelection clear deselects everything", isOk(r) && r.selectedLayers.length === 0, JSON.stringify(r.selectedLayers));
    r = await run("setSelection", { compName: MAIN });
    check("setSelection with nothing to select errors", isError(r), r.message);
    r = await run("setCurrentTime", { compName: MAIN, time: 99 });
    check("setCurrentTime refuses a time outside the comp", isError(r), r.message);
    r = await run("setWorkArea", { compName: MAIN, start: 1, duration: 2 });
    check("setWorkArea", isOk(r) && near(r.workAreaStart, 1, 0.01) && near(r.workAreaEnd, 3, 0.01), JSON.stringify(r));
    r = await run("setWorkArea", { compName: MAIN, start: 4, duration: 5 });
    check("setWorkArea refuses to run past the end of the comp", isError(r), r.message);
    r = await run("setWorkArea", { compName: MAIN, start: 0, duration: 5 });
    check("setWorkArea restored to the whole comp", isOk(r) && near(r.workAreaStart, 0, 0.01) && near(r.workAreaDuration, 5, 0.01), JSON.stringify(r));

    r = await run("listEffects", { query: "Gaussian Blur" });
    check("listEffects finds Gaussian Blur and its match name", isOk(r) && r.effects.some((e) => e.matchName === "ADBE Gaussian Blur 2"), JSON.stringify(r.effects?.slice(0, 3)));
    r = await run("listEffects", { query: "zzzz-no-such-effect" });
    check("listEffects with no match returns none", isOk(r) && r.total === 0);
    r = await run("listFonts", { query: "Arial" });
    check("listFonts (or says it needs a newer After Effects)", (isOk(r) && r.total > 0 && !!r.fonts[0].postScriptName) || (isError(r) && /24/.test(r.message || "")), r.message || JSON.stringify(r.fonts?.slice(0, 2)));
    const before = await run("getRenderStatus");
    r = await run("listRenderTemplates");
    check("listRenderTemplates", isOk(r) && r.renderSettingsTemplates.length > 0 && r.outputModuleTemplates.length > 0, JSON.stringify(r).slice(0, 160));
    const after = await run("getRenderStatus");
    check("...and left the render queue as it found it", before.numItems === after.numItems, `${before.numItems} -> ${after.numItems}`);

    console.log("\nProject panel");
    const FOLDER = `${PREFIX}folder`, CHILD = `${PREFIX}child`, ALT = `${PREFIX}alt`;
    r = await run("createFolder", { name: FOLDER });
    check("createFolder", isOk(r) && r.folder.id > 0, r.message);
    r = await run("createFolder", { name: CHILD, parentFolderName: FOLDER });
    check("createFolder inside a folder", isOk(r) && r.parent.name === FOLDER, r.message);
    r = await run("moveProjectItems", { itemNames: [PRE], toFolderName: FOLDER });
    check("moveProjectItems", isOk(r) && r.moved.length === 1 && r.toFolder.name === FOLDER, r.message);
    r = await run("getProjectTree", { folderName: FOLDER });
    check("getProjectTree shows the move", isOk(r) && r.tree.children.some((c) => c.name === PRE && c.type === "composition") && r.tree.children.some((c) => c.name === CHILD && c.type === "folder"), JSON.stringify(r.tree?.children?.map((c) => c.name)));
    check("getProjectTree gives comp sizes", r.tree.children.find((c) => c.name === PRE)?.width === 1080);
    r = await run("moveProjectItems", { itemNames: [FOLDER], toFolderName: CHILD });
    check("moveProjectItems refuses to put a folder inside its own subfolder", isError(r) && /subfolder/.test(r.message || ""), r.message);
    r = await run("moveProjectItems", { itemNames: [`${PREFIX}no_such_item`], toFolderName: FOLDER });
    check("moveProjectItems errors on an unknown item", isError(r), r.message);
    r = await run("setProjectItemProperties", { itemName: PRE, label: 9, comment: `${PREFIX}note` });
    check("setProjectItemProperties", isOk(r) && r.item.label === 9 && r.item.comment === `${PREFIX}note`, JSON.stringify(r.item));
    r = await run("openComp", { compName: MAIN });
    check("openComp", isOk(r), r.message);
    r = await run("createComposition", { name: ALT, width: 640, height: 640, duration: 5, frameRate: 30 });
    check("createComposition for replaceLayerSource", isOk(r), r.message);
    info = await run("getLayerInfo", { compName: MAIN });
    const preLayer = info.layers.find((l) => l.source && l.source.name === PRE);
    check("MAIN has a layer using the precomp", !!preLayer);
    r = await run("replaceLayerSource", { compName: MAIN, layerIndex: preLayer.index, sourceItemName: ALT });
    check("replaceLayerSource", isOk(r) && r.source.name === ALT, JSON.stringify(r.source));

    console.log("\nQueue");
    const ids = [enqueue("getProjectStatus", {}, "clientA"), enqueue("getRenderStatus", {}, "clientB"), enqueue("listCompositions", {}, "clientA")];
    const evilId = "../evil";
    const evilFile = path.join(QUEUE, `${String(Date.now() + 5).padStart(13, "0")}-evil.json`);
    fs.writeFileSync(`${evilFile}.tmp`, JSON.stringify({ id: evilId, command: "getProjectStatus", args: {} }));
    fs.renameSync(`${evilFile}.tmp`, evilFile);
    const got = await Promise.all(ids.map((id) => waitFor(id)));
    check("three simultaneous commands each got their own result", got.every((g, i) => g._commandId === ids[i]), got.map((g) => g._commandId).join(","));
    check("...with the right content", got[0].path !== undefined && Array.isArray(got[1].items) && Array.isArray(got[2].compositions));
    await sleep(3000);
    check("a queue file with an unsafe id is discarded", !fs.existsSync(evilFile) && !fs.existsSync(path.join(BRIDGE, "evil.json")) && !fs.existsSync(path.join(BRIDGE, "..", "evil.json")));
    r = await run("getRenderStatus");
    check("getRenderStatus", isOk(r) && Array.isArray(r.items), JSON.stringify(r).slice(0, 120));
  } catch (error) {
    failures.push(`aborted: ${error.message}`);
    console.log(`\nABORTED: ${error.message}`);
  } finally {
    if (args.has("--keep")) {
      console.log(`\n--keep given: ${PREFIX}* items left in the project`);
    } else {
      console.log("\nCleanup");
      try {
        const removed = await run("deleteProjectItems", { namePrefix: PREFIX, includeFolders: true });
        const gone = removed.items || [], goneFolders = removed.foldersRemoved || [], keptFolders = removed.foldersKept || [];
        check(`deleteProjectItems removed the test items (${gone.length}) and folders (${goneFolders.length})`, isOk(removed) && gone.length >= 4 && Array.isArray(removed.foldersKept) && keptFolders.length === 0, JSON.stringify(removed));
        const left = await run("deleteProjectItems", { namePrefix: PREFIX, dryRun: true, includeFolders: true });
        check("nothing named MCPTEST_* is left", isOk(left) && (left.items || []).length === 0 && (left.foldersRemoved || []).length === 0, JSON.stringify(left));
        const end = await run("getProjectStatus");
        console.log(`  note ${startItems} items before, ${end.numItems} after (a Solids folder may have been created and is left in place)`);
      } catch (cleanupError) {
        failures.push(`cleanup failed: ${cleanupError.message}`);
        console.log(`  cleanup failed: ${cleanupError.message}. Remove the ${PREFIX}* items by hand.`);
      }
    }
  }

  console.log(`\n${checks - failedChecks}/${checks} checks passed`);
  if (failures.length) {
    console.log(`Failed:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
