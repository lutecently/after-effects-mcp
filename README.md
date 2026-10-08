# 🎬 After Effects MCP Server

![Node.js](https://img.shields.io/badge/node-%3E=14.x-brightgreen.svg)
![Build](https://img.shields.io/badge/build-passing-success)
![License](https://img.shields.io/github/license/Dakkshin/after-effects-mcp)
![Platform](https://img.shields.io/badge/platform-after%20effects-blue)

✨ A Model Context Protocol (MCP) server for Adobe After Effects that enables AI assistants and other applications to control After Effects through a standardized protocol.

<a href="https://glama.ai/mcp/servers/@Dakkshin/after-effects-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@Dakkshin/after-effects-mcp/badge" alt="mcp-after-effects MCP server" />
</a>

## Table of Contents
- [Features](#features)
  - [Core Composition Features](#core-composition-features)
  - [Layer Management](#layer-management)
  - [Animation Capabilities](#animation-capabilities)
- [Setup Instructions](#setup-instructions)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Update MCP Config](#Update-MCP-Config)
  - [Running the Server](#running-the-server)
- [Usage Guide](#usage-guide)
  - [Creating Compositions](#creating-compositions)
  - [Working with Layers](#working-with-layers)
  - [Animation](#animation)
- [Available MCP Tools](#available-mcp-tools)
- [For Developers](#for-developers)
  - [Project Structure](#project-structure)
  - [Building the Project](#building-the-project)
  - [Contributing](#contributing)
- [License](#license)

## 📦 Features

### 🎥 Core Composition Features
- **Create compositions** with custom settings (size, frame rate, duration, background color)
- **List all compositions** in a project
- **Get project information** such as frame rate, dimensions, and duration

### 🧱 Layer Management
- **Create text layers** with customizable properties (font, size, color, position)
- **Create shape layers** (rectangle, ellipse, polygon, star) with colors and strokes
- **Create solid/adjustment layers** for backgrounds and effects
- **Create camera layers** with configurable zoom and position
- **Create null objects** for animation control
- **Modify layer properties** like position, scale, rotation, opacity, timing
- **Toggle 2D/3D mode** for layers
- **Set blend modes** (normal, multiply, screen, etc.)
- **Track matte** support (alpha, luma, inverted)
- **Duplicate layers** with optional rename
- **Delete layers** from composition
- **Create/modify masks** with feather, expansion, and opacity

### 🌀 Animation Capabilities
- **Set keyframes** for layer properties (Position, Scale, Rotation, Opacity, etc.)
- **Apply expressions** to layer properties for dynamic animations
- **Batch set properties** across multiple layers at once

## ⚙️ Setup Instructions

### 🛠 Prerequisites
- Adobe After Effects (2022 or later)
- Node.js (v18 or later)
- npm or yarn package manager

### 📥 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Dakkshin/after-effects-mcp.git
   cd after-effects-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Build the project**
   ```bash
   npm run build
   # or
   yarn build
   ```

4. **Install the After Effects panel**
   ```bash
   npm run install-bridge
   # or
   yarn install-bridge
   ```
   This will copy the necessary scripts to your After Effects installation.

### Guided browser setup

After building the project, launch the local setup dashboard:

```bash
npm run setup
```

The command opens a page in Chrome (or the default browser when Chrome is unavailable) that can:

- Detect installed versions of After Effects
- Track first-run progress across panel installation, MCP client configuration, panel connection, and connection testing
- Install or update the bridge panel, backing up an existing panel first
- Generate configuration for Codex, Claude, and Cursor
- Configure and validate supported MCP clients with an automatic backup
- Open the shared bridge folder
- Run a read-only connection test against the open After Effects panel
- Monitor the panel heartbeat, command queue, recent results, and logs
- Choose read-only, standard-editing, or full-access safety modes
- Automatically preserve the last saved project state before high-impact commands, blocking the command if the backup fails
- Keep everyday controls simple while placing polling, expiry, timeout, batching, and retention controls under Advanced settings
- Explore all bridge commands and test strictly read-only tools
- Restore or safely uninstall the panel, archive bridge data, check for updates, and export sanitized diagnostics

The dashboard binds only to `127.0.0.1`, uses a random token for the setup session, and stops when you close it from the page or stop the terminal command. It is not required during normal MCP use.

The MCP server can inspect the same state without screen-reading. It exposes the `aftereffects://dashboard/status` resource and the read-only `get-dashboard-status` tool, including the panel heartbeat, active safety mode, queue depth, and retained-result count.

When this project is installed as an npm package, the equivalent command is:

```bash
npx after-effects-mcp setup
```

### 🔧 Update MCP Config

The setup dashboard above generates a configuration using the exact Node.js and server paths on the current machine. This is the recommended option for most users.

#### Option 1: Using .mcp.json (Recommended for Claude Code)
The repository includes a `.mcp.json` file for easy configuration. Copy or reference it in your MCP settings:

```json
{
  "mcpServers": {
    "AfterEffectsMCP": {
      "command": "node",
      "args": ["PATH/TO/after-effects-mcp/build/index.js"]
    }
  }
}
```

#### Option 2: Manual Configuration
Go to your client (e.g., Claude or Cursor) and update your config file:

```json
{
  "mcpServers": {
    "AfterEffectsMCP": {
      "command": "node",
      "args": ["C:\\Users\\Dakkshin\\after-effects-mcp\\build\\index.js"]
    }
  }
}
```

### ▶️ Running the Server

1. **Start the MCP server**
   ```bash
   npm start
   # or
   yarn start
   ```

2. **Open After Effects**

3. **Open the MCP Bridge Auto panel**
   - In After Effects, go to Window > mcp-bridge-auto.jsx
   - The panel will automatically check for commands every few seconds
   - Make sure the "Auto-run commands" checkbox is enabled

## 🚀 Usage Guide

Once you have the server running and the MCP Bridge panel open in After Effects, you can control After Effects through the MCP protocol. This allows AI assistants or custom applications to send commands to After Effects.

### 📘 Creating Compositions

You can create new compositions with custom settings:
- Name
- Width and height (in pixels)
- Frame rate
- Duration
- Background color

Example MCP tool usage (for developers):
```javascript
mcp_aftereffects_create_composition({
  name: "My Composition", 
  width: 1920, 
  height: 1080, 
  frameRate: 30,
  duration: 10
});
```

### ✍️ Working with Layers

You can create and modify different types of layers:

**Text layers:**
- Set text content, font, size, and color
- Position text anywhere in the composition
- Adjust timing and opacity

**Shape layers:**
- Create rectangles, ellipses, polygons, and stars
- Set fill and stroke colors
- Customize size and position

**Solid layers:**
- Create background colors
- Make adjustment layers for effects

### 🕹 Animation

You can animate layers with:

**Keyframes:**
- Set property values at specific times
- Create motion, scaling, rotation, and opacity changes
- Control the timing of animations

**Expressions:**
- Apply JavaScript expressions to properties
- Create dynamic, procedural animations
- Connect property values to each other

## 🛠 Available MCP Tools

| Command                     | Description                            |
|-----------------------------|----------------------------------------|
| `create-composition`        | Create a new composition               |
| `run-script`                | Run a JS script inside AE              |
| `get-results`               | Get script results                     |
| `get-help`                  | Help for available commands            |
| `setLayerKeyframe`          | Add keyframe to layer property         |
| `setLayerExpression`        | Add/remove expressions from properties|
| `setLayerProperties`        | Set layer properties (position, scale, rotation, opacity, blendMode, threeDLayer, trackMatteType, enabled, etc.) |
| `batchSetLayerProperties`  | Apply properties to multiple layers   |
| `getLayerInfo`              | Get layer info by comp/layer name or index (parent, transform values, expressions, keyframe counts, effects, null/3D flags) |
| `createCamera`              | Create camera layer                   |
| `createNullObject`          | Create null object for animation      |
| `createNullLayer`           | Create a null layer (defaults to comp centre) |
| `duplicateLayer`            | Duplicate a layer                     |
| `deleteLayer`               | Delete a layer                        |
| `setLayerMask`              | Create/modify layer masks             |
| `renameEffect`              | Rename an effect on a layer           |
| `removeEffect`              | Remove an effect from a layer         |
| `getKeyframes`              | List keyframes (time, value, interpolation, ease) on a property |
| `removeKeyframes`           | Remove keyframes by index, time, or all |
| `getProjectStatus`          | Project name/path, item count, active comp |
| `saveProject`               | Save, or Save As a path (won't overwrite without `overwrite`) |
| `openProject` / `newProject`| Replace the open project (`saveCurrent` must be stated) |
| `undo`                      | Undo the last N bridge commands       |
| `addExpressionControl`      | Add a slider, checkbox, colour, dropdown, angle, point or layer control and get the expression that reads it |
| `getPropertyReference` / `linkProperty` | The expression that reads a property / link one property to another (like the pick whip) |
| `setCameraProperties`       | Edit a camera: zoom, depth of field, focus, aperture, one or two node, position |
| `createLight` / `setLightProperties` | Create and edit point, spot, parallel and ambient lights |
| `backupProject`             | Copy the project file to a timestamped backup |
| `getCapabilities`           | Bridge version and the list of commands the panel supports |
| `setKeyframeEase`           | Easy ease, hold, linear or custom bezier on keyframes |
| `offsetKeyframes` / `copyKeyframes` | Move keyframes, or copy them to another property or layer |
| `getSelection` / `setSelection` | What is selected (layers, properties, keys, project items) / change the layer selection |
| `setCurrentTime` / `setWorkArea` | Move the playhead / set the work area |
| `listEffects` / `listFonts` / `listRenderTemplates` | Find effect match names, font names and render templates |
| `setLayerTiming`            | Trim, start time, stretch, time remap |
| `splitLayer`                | Cut a layer in two at a time          |
| `setAnchorPoint`            | Set the anchor point (optionally without moving the layer) |
| `setLayerFlags`             | Lock, shy, solo, guide, motion blur, label |
| `renameLayer`               | Rename a layer                        |
| `addMarker` / `getMarkers` / `removeMarkers` | Layer and comp markers |
| `listLayerProperties`       | Browse a layer's property tree        |
| `setProperty`               | Set any property by path (shapes, masks, text animators) |
| `addShapeContent`           | Add fills, strokes, trim paths, repeaters and shapes to a shape layer |
| `setTextDocument`           | Edit text, font, size, colour, tracking, leading |
| `getProjectTree`            | The Project panel as a tree           |
| `createFolder` / `moveProjectItems` | Organise the Project panel     |
| `setProjectItemProperties`  | Rename, label or comment a project item |
| `openComp`                  | Open a comp in the Composition panel  |
| `replaceLayerSource`        | Swap a layer's source item            |
| `exportFrame`               | Save one frame of a comp as a PNG (optional time and scale), so the result can be looked at |
| `getRenderStatus`           | Render queue status and output paths  |
| `startRender`               | Render the queue (blocks After Effects until done) |

## 👨‍💻 For Developers

### 🧩 Project Structure

- `src/index.ts`: MCP server implementation
- `src/scripts/mcp-bridge-auto.jsx`: Main After Effects panel script
- `install-bridge.js`: Script to install the panel in After Effects

### 🧪 Testing

`npm run test:bridge -- --run-in-open-project` runs an end-to-end test against a live After Effects. It drives the panel through the queue, so the MCP server does not need to be running. It builds scratch `MCPTEST_*` comps and solids and checks parenting, expressions, keyframes, effects, the safety guards, undo and the queue. It also decodes an exported frame to confirm the rotation really happened, then removes everything it created (add `--keep` to leave the items in place). Run it in a scratch project, with the MCP Bridge Auto panel open. It deliberately does not call `startRender`, so it never renders your queue.

### 🔌 Bridge protocol

The server and the **MCP Bridge Auto** panel talk through `~/Documents/ae-mcp-bridge/`:

- `queue/<timestamp>-<id>.json`: one file per command, `{id, command, args}`. The panel runs them oldest-first and deletes each file when done. Commands waiting more than 10 minutes expire with an error result.
- `results/<id>.json`: the result for that command (the newest 100 are kept). Results carry `_commandId`, `_commandExecuted` and `_project`.
- `ae_mcp_result.json`: still written with the latest result, for older clients.
- Every result carries `_bridgeVersion`, a fingerprint of the panel script. The server computes the fingerprint of the script it ships, and `get-results` adds a `_warning` when they differ (an out-of-date installed panel). The panel's command table is the one list of commands: the server forwards any valid name and the panel rejects unknown ones with the list of what it has.
- `ae_command.json`: the old single-file command path still works, but clients that use it can overwrite each other.

Each server instance only reads results for its own command ids, so several clients (for example two Claude sessions) can share one After Effects safely. `id` may only contain letters, digits, `_` and `-`.

### 📦 Building the Project

```bash
npm run build
# or
yarn build
```

**Note:** This project uses esbuild for fast builds, replacing the previous TypeScript compiler approach that could run out of memory on larger codebases.

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Dakkshin/after-effects-mcp&type=date&legend=top-left)](https://www.star-history.com/#Dakkshin/after-effects-mcp&type=date&legend=top-left)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
