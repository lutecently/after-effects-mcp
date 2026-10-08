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
    console.log("\nScene setup");
    let r = await run("createComposition", { name: MAIN, width: 1080, height: 1920, duration: 5, frameRate: 30 });
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
        const removed = await run("deleteProjectItems", { namePrefix: PREFIX });
        check(`deleteProjectItems removed the test items (${(removed.items || []).length})`, isOk(removed) && removed.items.length >= 4, JSON.stringify(removed.items));
        const left = await run("deleteProjectItems", { namePrefix: PREFIX, dryRun: true });
        check("nothing named MCPTEST_* is left", isOk(left) && left.items.length === 0, JSON.stringify(left.items));
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
