// mcp-bridge-auto.jsx
// Auto-running MCP Bridge panel for After Effects

// Remove #include directives as we define functions below
/*
#include "createComposition.jsx"
#include "createTextLayer.jsx"
#include "createShapeLayer.jsx"
#include "createSolidLayer.jsx"
#include "setLayerProperties.jsx"
*/

// --- Function Definitions ---

// --- createComposition (from createComposition.jsx) --- 
function createComposition(args) {
    try {
        var name = args.name || "New Composition";
        var width = parseInt(args.width) || 1920;
        var height = parseInt(args.height) || 1080;
        var pixelAspect = parseFloat(args.pixelAspect) || 1.0;
        var duration = parseFloat(args.duration) || 10.0;
        var frameRate = parseFloat(args.frameRate) || 30.0;
        var bgColor = args.backgroundColor ? [args.backgroundColor.r/255, args.backgroundColor.g/255, args.backgroundColor.b/255] : [0, 0, 0];
        var newComp = app.project.items.addComp(name, width, height, pixelAspect, duration, frameRate);
        if (args.backgroundColor) {
            newComp.bgColor = bgColor;
        }
        return JSON.stringify({
            status: "success", message: "Composition created successfully",
            composition: { name: newComp.name, id: newComp.id, width: newComp.width, height: newComp.height, pixelAspect: newComp.pixelAspect, duration: newComp.duration, frameRate: newComp.frameRate, bgColor: newComp.bgColor }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createTextLayer (from createTextLayer.jsx) ---
function createTextLayer(args) {
    try {
        var compName = args.compName || "";
        var text = args.text || "Text Layer";
        var position = args.position || [960, 540]; 
        var fontSize = args.fontSize || 72;
        var color = args.color || [1, 1, 1]; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var fontFamily = args.fontFamily || "Arial";
        var alignment = args.alignment || "center"; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }
        var textLayer = comp.layers.addText(text);
        var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDocument = textProp.value;
        textDocument.fontSize = fontSize;
        textDocument.fillColor = color;
        textDocument.font = fontFamily;
        if (alignment === "left") { textDocument.justification = ParagraphJustification.LEFT_JUSTIFY; } 
        else if (alignment === "center") { textDocument.justification = ParagraphJustification.CENTER_JUSTIFY; } 
        else if (alignment === "right") { textDocument.justification = ParagraphJustification.RIGHT_JUSTIFY; }
        textProp.setValue(textDocument);
        textLayer.property("Position").setValue(position);
        textLayer.startTime = startTime;
        if (duration > 0) { textLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: "Text layer created successfully",
            layer: { name: textLayer.name, index: textLayer.index, type: "text", inPoint: textLayer.inPoint, outPoint: textLayer.outPoint, position: textLayer.property("Position").value }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createShapeLayer (from createShapeLayer.jsx) --- 
function createShapeLayer(args) {
    try {
        var compName = args.compName || "";
        var shapeType = args.shapeType || "rectangle"; 
        var position = args.position || [960, 540]; 
        var size = args.size || [200, 200]; 
        var fillColor = args.fillColor || [1, 0, 0]; 
        var strokeColor = args.strokeColor || [0, 0, 0]; 
        var strokeWidth = args.strokeWidth || 0; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var name = args.name || "Shape Layer";
        var points = args.points || 5; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = name;
        var contents = shapeLayer.property("Contents"); 
        var shapeGroup = contents.addProperty("ADBE Vector Group");
        var groupContents = shapeGroup.property("Contents"); 
        var shapePathProperty;
        if (shapeType === "rectangle") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Rect");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "ellipse") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Ellipse");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "polygon" || shapeType === "star") { 
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Star");
            shapePathProperty.property("Type").setValue(shapeType === "polygon" ? 1 : 2); 
            shapePathProperty.property("Points").setValue(points);
            shapePathProperty.property("Outer Radius").setValue(size[0] / 2);
            if (shapeType === "star") { shapePathProperty.property("Inner Radius").setValue(size[0] / 3); }
        }
        var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(fillColor);
        fill.property("Opacity").setValue(100);
        if (strokeWidth > 0) {
            var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue(strokeColor);
            stroke.property("Stroke Width").setValue(strokeWidth);
            stroke.property("Opacity").setValue(100);
        }
        shapeLayer.property("Position").setValue(position);
        shapeLayer.startTime = startTime;
        if (duration > 0) { shapeLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: "Shape layer created successfully",
            layer: { name: shapeLayer.name, index: shapeLayer.index, type: "shape", shapeType: shapeType, inPoint: shapeLayer.inPoint, outPoint: shapeLayer.outPoint, position: shapeLayer.property("Position").value }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createCamera ---
function createCamera(args) {
    try {
        var compName = args.compName || "";
        var name = args.name || "Camera";
        var zoom = args.zoom || 1777.78; // Default ~50mm equivalent
        var position = args.position; // Optional [x, y, z]
        var pointOfInterest = args.pointOfInterest; // Optional [x, y, z]
        var oneNode = args.oneNode || false; // If true, create a one-node camera (no point of interest)

        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; }
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }

        var centerPoint = [comp.width / 2, comp.height / 2];
        var cameraLayer = comp.layers.addCamera(name, centerPoint);
        cameraLayer.property("Camera Options").property("Zoom").setValue(zoom);

        if (oneNode) {
            cameraLayer.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
        }

        if (position !== undefined && position !== null) {
            cameraLayer.property("Position").setValue(position);
        }

        if (pointOfInterest !== undefined && pointOfInterest !== null && !oneNode) {
            cameraLayer.property("Point of Interest").setValue(pointOfInterest);
        }

        var result = {
            name: cameraLayer.name,
            index: cameraLayer.index,
            zoom: cameraLayer.property("Camera Options").property("Zoom").value,
            position: cameraLayer.property("Position").value,
            oneNode: oneNode
        };
        if (!oneNode) {
            result.pointOfInterest = cameraLayer.property("Point of Interest").value;
        }

        return JSON.stringify({
            status: "success",
            message: "Camera created successfully",
            layer: result
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- duplicateLayer ---
function duplicateLayer(args) {
    try {
        var compName = args.compName || "";
        var layerIndex = args.layerIndex;
        var layerName = args.layerName || "";
        var newName = args.newName; // optional rename

        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; }
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }

        var layer = null;
        if (layerIndex !== undefined && layerIndex !== null) {
            if (layerIndex > 0 && layerIndex <= comp.numLayers) { layer = comp.layer(layerIndex); }
            else { throw new Error("Layer index out of bounds: " + layerIndex); }
        } else if (layerName) {
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === layerName) { layer = comp.layer(j); break; }
            }
        }
        if (!layer) { throw new Error("Layer not found: " + (layerName || "index " + layerIndex)); }

        var newLayer = layer.duplicate();
        if (newName) { newLayer.name = newName; }

        return JSON.stringify({
            status: "success",
            message: "Layer duplicated successfully",
            original: { name: layer.name, index: layer.index },
            duplicate: { name: newLayer.name, index: newLayer.index }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- deleteLayer ---
function deleteLayer(args) {
    try {
        var compName = args.compName || "";
        var layerIndex = args.layerIndex;
        var layerName = args.layerName || "";

        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; }
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }

        var layer = null;
        if (layerIndex !== undefined && layerIndex !== null) {
            if (layerIndex > 0 && layerIndex <= comp.numLayers) { layer = comp.layer(layerIndex); }
            else { throw new Error("Layer index out of bounds: " + layerIndex); }
        } else if (layerName) {
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === layerName) { layer = comp.layer(j); break; }
            }
        }
        if (!layer) { throw new Error("Layer not found: " + (layerName || "index " + layerIndex)); }

        var deletedName = layer.name;
        var deletedIndex = layer.index;
        layer.remove();

        return JSON.stringify({
            status: "success",
            message: "Layer deleted successfully",
            deleted: { name: deletedName, index: deletedIndex }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- setLayerMask: create or modify a mask on a layer ---
function setLayerMask(args) {
    try {
        var compName = args.compName || "";
        var layerIndex = args.layerIndex;
        var layerName = args.layerName || "";
        var maskIndex = args.maskIndex; // optional — if provided, modify existing mask
        var maskPath = args.maskPath; // array of [x, y] points defining the mask shape
        var maskRect = args.maskRect; // shorthand: {top, left, width, height} for rectangular masks
        var maskMode = args.maskMode || "add"; // "add", "subtract", "intersect", "none"
        var maskFeather = args.maskFeather; // optional [x, y] feather
        var maskOpacity = args.maskOpacity; // optional 0-100
        var maskExpansion = args.maskExpansion; // optional pixels
        var maskName = args.maskName; // optional rename

        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; }
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }

        var layer = null;
        if (layerIndex !== undefined && layerIndex !== null) {
            if (layerIndex > 0 && layerIndex <= comp.numLayers) { layer = comp.layer(layerIndex); }
            else { throw new Error("Layer index out of bounds: " + layerIndex); }
        } else if (layerName) {
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === layerName) { layer = comp.layer(j); break; }
            }
        }
        if (!layer) { throw new Error("Layer not found: " + (layerName || "index " + layerIndex)); }

        // Build the mask shape
        var shapePoints = [];
        if (maskRect) {
            // Rectangle shorthand
            var t = maskRect.top || 0;
            var l = maskRect.left || 0;
            var w = maskRect.width || comp.width;
            var h = maskRect.height || comp.height;
            shapePoints = [[l, t], [l + w, t], [l + w, t + h], [l, t + h]];
        } else if (maskPath && maskPath.length >= 3) {
            shapePoints = maskPath;
        } else {
            throw new Error("Must provide either maskRect or maskPath with at least 3 points");
        }

        // Create the shape object
        var myShape = new Shape();
        var vertices = [];
        for (var p = 0; p < shapePoints.length; p++) {
            vertices.push(shapePoints[p]);
        }
        myShape.vertices = vertices;
        myShape.closed = true;

        var changed = [];
        var mask;

        if (maskIndex !== undefined && maskIndex !== null) {
            // Modify existing mask
            if (maskIndex > 0 && maskIndex <= layer.property("Masks").numProperties) {
                mask = layer.property("Masks").property(maskIndex);
            } else {
                throw new Error("Mask index out of bounds: " + maskIndex);
            }
            mask.property("Mask Path").setValue(myShape);
            changed.push("maskPath");
        } else {
            // Create new mask
            mask = layer.property("Masks").addProperty("Mask");
            mask.property("Mask Path").setValue(myShape);
            changed.push("newMask");
        }

        // Set mask mode
        var modes = {
            "none": MaskMode.NONE,
            "add": MaskMode.ADD,
            "subtract": MaskMode.SUBTRACT,
            "intersect": MaskMode.INTERSECT,
            "lighten": MaskMode.LIGHTEN,
            "darken": MaskMode.DARKEN,
            "difference": MaskMode.DIFFERENCE
        };
        if (modes[maskMode] !== undefined) {
            mask.maskMode = modes[maskMode];
            changed.push("maskMode");
        }

        if (maskFeather !== undefined && maskFeather !== null) {
            mask.property("Mask Feather").setValue(maskFeather);
            changed.push("maskFeather");
        }
        if (maskOpacity !== undefined && maskOpacity !== null) {
            mask.property("Mask Opacity").setValue(maskOpacity);
            changed.push("maskOpacity");
        }
        if (maskExpansion !== undefined && maskExpansion !== null) {
            mask.property("Mask Expansion").setValue(maskExpansion);
            changed.push("maskExpansion");
        }
        if (maskName) {
            mask.name = maskName;
            changed.push("maskName");
        }

        return JSON.stringify({
            status: "success",
            message: "Mask set successfully",
            layer: { name: layer.name, index: layer.index },
            mask: {
                name: mask.name,
                index: mask.propertyIndex,
                mode: maskMode,
                changedProperties: changed
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createSolidLayer (from createSolidLayer.jsx) ---
function createSolidLayer(args) {
    try {
        var compName = args.compName || "";
        var color = args.color || [1, 1, 1]; 
        var name = args.name || "Solid Layer";
        var position = args.position || [960, 540]; 
        var size = args.size; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var isAdjustment = args.isAdjustment || false; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }
        if (!size) { size = [comp.width, comp.height]; }
        var solidLayer;
        if (isAdjustment) {
            solidLayer = comp.layers.addSolid([0, 0, 0], name, size[0], size[1], 1);
            solidLayer.adjustmentLayer = true;
        } else {
            solidLayer = comp.layers.addSolid(color, name, size[0], size[1], 1);
        }
        solidLayer.property("Position").setValue(position);
        solidLayer.startTime = startTime;
        if (duration > 0) { solidLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: isAdjustment ? "Adjustment layer created successfully" : "Solid layer created successfully",
            layer: { name: solidLayer.name, index: solidLayer.index, type: isAdjustment ? "adjustment" : "solid", inPoint: solidLayer.inPoint, outPoint: solidLayer.outPoint, position: solidLayer.property("Position").value, isAdjustment: solidLayer.adjustmentLayer }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- setLayerProperties (modified to handle text properties) ---
function setLayerProperties(args) {
    try {
        var compName = args.compName || "";
        var layerName = args.layerName || "";
        var layerIndex = args.layerIndex; 
        
        // General Properties
        var position = args.position; 
        var scale = args.scale; 
        var rotation = args.rotation; 
        var opacity = args.opacity; 
        var startTime = args.startTime; 
        var duration = args.duration; 

        // Text Specific Properties
        var textContent = args.text; // New: text content
        var fontFamily = args.fontFamily; // New: font family
        var fontSize = args.fontSize; // New: font size
        var fillColor = args.fillColor; // New: font color
        
        // Find the composition (same logic as before)
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }
        
        // Find the layer (same logic as before)
        var layer = null;
        if (layerIndex !== undefined && layerIndex !== null) {
            if (layerIndex > 0 && layerIndex <= comp.numLayers) { layer = comp.layer(layerIndex); } 
            else { throw new Error("Layer index out of bounds: " + layerIndex); }
        } else if (layerName) {
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === layerName) { layer = comp.layer(j); break; }
            }
        }
        if (!layer) { throw new Error("Layer not found: " + (layerName || "index " + layerIndex)); }
        
        var changedProperties = [];
        var textDocumentChanged = false;
        var textProp = null;
        var textDocument = null;

        // --- Text Property Handling ---
        if (layer instanceof TextLayer && (textContent !== undefined || fontFamily !== undefined || fontSize !== undefined || fillColor !== undefined)) {
            var sourceTextProp = layer.property("Source Text");
            if (sourceTextProp && sourceTextProp.value) {
                var currentTextDocument = sourceTextProp.value; // Get the current value
                var updated = false;

                if (textContent !== undefined && textContent !== null && currentTextDocument.text !== textContent) {
                    currentTextDocument.text = textContent;
                    changedProperties.push("text");
                    updated = true;
                }
                if (fontFamily !== undefined && fontFamily !== null && currentTextDocument.font !== fontFamily) {
                    // Add basic validation/logging for font existence if needed
                    // try { app.fonts.findFont(fontFamily); } catch (e) { logToPanel("Warning: Font '"+fontFamily+"' might not be installed."); }
                    currentTextDocument.font = fontFamily;
                    changedProperties.push("fontFamily");
                    updated = true;
                }
                if (fontSize !== undefined && fontSize !== null && currentTextDocument.fontSize !== fontSize) {
                    currentTextDocument.fontSize = fontSize;
                    changedProperties.push("fontSize");
                    updated = true;
                }
                // Comparing colors needs care due to potential floating point inaccuracies if set via UI
                // Simple comparison for now
                if (fillColor !== undefined && fillColor !== null && 
                    (currentTextDocument.fillColor[0] !== fillColor[0] || 
                     currentTextDocument.fillColor[1] !== fillColor[1] || 
                     currentTextDocument.fillColor[2] !== fillColor[2])) {
                    currentTextDocument.fillColor = fillColor;
                    changedProperties.push("fillColor");
                    updated = true;
                }

                // Only set the value if something actually changed
                if (updated) {
                    try {
                        sourceTextProp.setValue(currentTextDocument);
                        logToPanel("Applied changes to Text Document for layer: " + layer.name);
                    } catch (e) {
                        logToPanel("ERROR applying Text Document changes: " + e.toString());
                        // Decide if we should throw or just log the error for text properties
                        // For now, just log, other properties might still succeed
                    }
                }
                 // Store the potentially updated document for the return value
                 textDocument = currentTextDocument; 

            } else {
                logToPanel("Warning: Could not access Source Text property for layer: " + layer.name);
            }
        }

        // --- Enabled/Visible ---
        var enabled = args.enabled;
        if (enabled !== undefined && enabled !== null) { layer.enabled = !!enabled; changedProperties.push("enabled"); }

        // --- Blend Mode ---
        var blendMode = args.blendMode;
        if (blendMode !== undefined && blendMode !== null) {
            var modes = {
                "normal": BlendingMode.NORMAL,
                "add": BlendingMode.ADD,
                "multiply": BlendingMode.MULTIPLY,
                "screen": BlendingMode.SCREEN,
                "overlay": BlendingMode.OVERLAY,
                "softLight": BlendingMode.SOFT_LIGHT,
                "hardLight": BlendingMode.HARD_LIGHT,
                "colorDodge": BlendingMode.COLOR_DODGE,
                "colorBurn": BlendingMode.COLOR_BURN,
                "darken": BlendingMode.DARKEN,
                "lighten": BlendingMode.LIGHTEN,
                "difference": BlendingMode.DIFFERENCE,
                "exclusion": BlendingMode.EXCLUSION,
                "hue": BlendingMode.HUE,
                "saturation": BlendingMode.SATURATION,
                "color": BlendingMode.COLOR,
                "luminosity": BlendingMode.LUMINOSITY
            };
            if (modes[blendMode] !== undefined) {
                layer.blendingMode = modes[blendMode];
                changedProperties.push("blendMode");
            }
        }

        // --- Track Matte ---
        var trackMatteType = args.trackMatteType;
        if (trackMatteType !== undefined && trackMatteType !== null) {
            // Values: "none", "alpha", "alphaInverted", "luma", "lumaInverted"
            var matteTypes = {
                "none": TrackMatteType.NO_TRACK_MATTE,
                "alpha": TrackMatteType.ALPHA,
                "alphaInverted": TrackMatteType.ALPHA_INVERTED,
                "luma": TrackMatteType.LUMA,
                "lumaInverted": TrackMatteType.LUMA_INVERTED
            };
            if (matteTypes[trackMatteType] !== undefined) {
                layer.trackMatteType = matteTypes[trackMatteType];
                changedProperties.push("trackMatteType");
            }
        }

        // --- General Property Handling ---
        var threeDLayer = args.threeDLayer;
        if (threeDLayer !== undefined && threeDLayer !== null) { layer.threeDLayer = !!threeDLayer; changedProperties.push("threeDLayer"); }
        if (position !== undefined && position !== null) {
            var posProp = layer.property("Position");
            if (posProp.numKeys > 0) { while (posProp.numKeys > 0) { posProp.removeKey(1); } }
            posProp.setValue(position);
            changedProperties.push("position");
        }
        if (scale !== undefined && scale !== null) { layer.property("Scale").setValue(scale); changedProperties.push("scale"); }
        if (rotation !== undefined && rotation !== null) {
            if (layer.threeDLayer) { 
                // For 3D layers, Z rotation is often what's intended by a single value
                layer.property("Z Rotation").setValue(rotation);
            } else { 
                layer.property("Rotation").setValue(rotation); 
            }
            changedProperties.push("rotation");
        }
        if (opacity !== undefined && opacity !== null) { layer.property("Opacity").setValue(opacity); changedProperties.push("opacity"); }
        if (startTime !== undefined && startTime !== null) { layer.startTime = startTime; changedProperties.push("startTime"); }
        if (duration !== undefined && duration !== null && duration > 0) {
            var actualStartTime = (startTime !== undefined && startTime !== null) ? startTime : layer.startTime;
            layer.outPoint = actualStartTime + duration;
            changedProperties.push("duration");
        }

        // Return success with updated layer details (including text if changed)
        var returnLayerInfo = {
            name: layer.name,
            index: layer.index,
            threeDLayer: layer.threeDLayer,
            position: layer.property("Position").value,
            scale: layer.property("Scale").value,
            rotation: layer.threeDLayer ? layer.property("Z Rotation").value : layer.property("Rotation").value, // Return appropriate rotation
            opacity: layer.property("Opacity").value,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            changedProperties: changedProperties
        };
        // Add text properties to the return object if it was a text layer
        if (layer instanceof TextLayer && textDocument) {
            returnLayerInfo.text = textDocument.text;
            returnLayerInfo.fontFamily = textDocument.font;
            returnLayerInfo.fontSize = textDocument.fontSize;
            returnLayerInfo.fillColor = textDocument.fillColor;
        }

        // *** ADDED LOGGING HERE ***
        logToPanel("Final check before return:");
        logToPanel("  Changed Properties: " + changedProperties.join(", "));
        logToPanel("  Return Layer Info Font: " + (returnLayerInfo.fontFamily || "N/A")); 
        logToPanel("  TextDocument Font: " + (textDocument ? textDocument.font : "N/A"));

        return JSON.stringify({
            status: "success", message: "Layer properties updated successfully",
            layer: returnLayerInfo
        }, null, 2);
    } catch (error) {
        // Error handling remains similar, but add more specific checks if needed
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- batchSetLayerProperties: apply properties to multiple layers in one call ---
function batchSetLayerProperties(args) {
    try {
        var compName = args.compName || "";
        var operations = args.operations; // Array of {layerIndex, threeDLayer, position, scale, rotation, opacity, ...}

        if (!operations || !operations.length) {
            throw new Error("No operations provided. Pass an array of {layerIndex, ...properties}");
        }

        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; }
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }

        var results = [];
        for (var o = 0; o < operations.length; o++) {
            var op = operations[o];
            var layer = null;
            if (op.layerIndex !== undefined && op.layerIndex !== null) {
                if (op.layerIndex > 0 && op.layerIndex <= comp.numLayers) { layer = comp.layer(op.layerIndex); }
                else { results.push({ layerIndex: op.layerIndex, status: "error", message: "Layer index out of bounds" }); continue; }
            } else if (op.layerName) {
                for (var j = 1; j <= comp.numLayers; j++) {
                    if (comp.layer(j).name === op.layerName) { layer = comp.layer(j); break; }
                }
            }
            if (!layer) { results.push({ layerIndex: op.layerIndex, layerName: op.layerName, status: "error", message: "Layer not found" }); continue; }

            var changed = [];
            if (op.threeDLayer !== undefined && op.threeDLayer !== null) { layer.threeDLayer = !!op.threeDLayer; changed.push("threeDLayer"); }
            if (op.position !== undefined && op.position !== null) {
                var posProp = layer.property("Position");
                if (posProp.numKeys > 0) {
                    while (posProp.numKeys > 0) { posProp.removeKey(1); }
                }
                posProp.setValue(op.position);
                changed.push("position");
            }
            if (op.scale !== undefined && op.scale !== null) { layer.property("Scale").setValue(op.scale); changed.push("scale"); }
            if (op.rotation !== undefined && op.rotation !== null) {
                if (layer.threeDLayer) { layer.property("Z Rotation").setValue(op.rotation); }
                else { layer.property("Rotation").setValue(op.rotation); }
                changed.push("rotation");
            }
            if (op.opacity !== undefined && op.opacity !== null) { layer.property("Opacity").setValue(op.opacity); changed.push("opacity"); }
            if (op.blendMode !== undefined && op.blendMode !== null) {
                var bModes = {"normal":BlendingMode.NORMAL,"add":BlendingMode.ADD,"multiply":BlendingMode.MULTIPLY,"screen":BlendingMode.SCREEN,"overlay":BlendingMode.OVERLAY,"softLight":BlendingMode.SOFT_LIGHT,"hardLight":BlendingMode.HARD_LIGHT,"darken":BlendingMode.DARKEN,"lighten":BlendingMode.LIGHTEN,"difference":BlendingMode.DIFFERENCE};
                if (bModes[op.blendMode] !== undefined) { layer.blendingMode = bModes[op.blendMode]; changed.push("blendMode"); }
            }
            if (op.startTime !== undefined && op.startTime !== null) { layer.startTime = op.startTime; changed.push("startTime"); }
            if (op.outPoint !== undefined && op.outPoint !== null) { layer.outPoint = op.outPoint; changed.push("outPoint"); }

            results.push({
                layerIndex: layer.index,
                name: layer.name,
                status: "success",
                threeDLayer: layer.threeDLayer,
                position: layer.property("Position").value,
                changedProperties: changed
            });
        }

        return JSON.stringify({ status: "success", results: results }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

/**
 * Sets a keyframe for a specific property on a layer.
 * Indices are 1-based for After Effects collections.
 * @param {number} compIndex - The index of the composition (1-based).
 * @param {number} layerIndex - The index of the layer within the composition (1-based).
 * @param {string} propertyName - The name of the property (e.g., "Position", "Scale", "Rotation", "Opacity").
 * @param {number} timeInSeconds - The time (in seconds) for the keyframe.
 * @param {any} value - The value for the keyframe (e.g., [x, y] for Position, [w, h] for Scale, angle for Rotation, percentage for Opacity).
 * @returns {string} JSON string indicating success or error.
 */
function setLayerKeyframe(args) {
    try {
        var propertyName = args.propertyName, timeInSeconds = args.timeInSeconds, value = args.value;
        var target;
        try { target = resolveTarget(args); }
        catch (e) { return JSON.stringify({ success: false, message: e.message }); }
        var comp = target.comp, layer = target.layer;

        var transformGroup = layer.property("Transform");
        if (!transformGroup) {
             return JSON.stringify({ success: false, message: "Transform properties not found for layer '" + layer.name + "' (type: " + layer.matchName + ")." });
        }

        var property = transformGroup.property(propertyName);
        if (!property) {
            // Check other common property groups if not in Transform
             if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                 property = layer.property("Effects").property(propertyName);
             } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                 property = layer.property("Text").property(propertyName);
            } // Add more groups if needed (e.g., Masks, Shapes)

            if (!property) {
                 return JSON.stringify({ success: false, message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'." });
            }
        }


        // Ensure the property can be keyframed
        if (!property.canVaryOverTime) {
             return JSON.stringify({ success: false, message: "Property '" + propertyName + "' cannot be keyframed." });
        }

        // Make sure the property is enabled for keyframing
        if (property.numKeys === 0 && !property.isTimeVarying) {
             property.setValueAtTime(comp.time, property.value); // Set initial keyframe if none exist
        }


        property.setValueAtTime(timeInSeconds, value);

        return JSON.stringify({ success: true, message: "Keyframe set for '" + propertyName + "' on layer '" + layer.name + "' at " + timeInSeconds + "s." });
    } catch (e) {
        return JSON.stringify({ success: false, message: "Error setting keyframe: " + e.toString() + " (Line: " + e.line + ")" });
    }
}


/**
 * Sets an expression for a specific property on a layer.
 * @param {number} compIndex - The index of the composition (1-based).
 * @param {number} layerIndex - The index of the layer within the composition (1-based).
 * @param {string} propertyName - The name of the property (e.g., "Position", "Scale", "Rotation", "Opacity").
 * @param {string} expressionString - The JavaScript expression string. Use "" to remove expression.
 * @param {string} [effectName] - Optional. If given, only look for the property inside this effect.
 * @returns {string} JSON string indicating success or error.
 */
function setLayerExpression(args) {
    try {
        var propertyName = args.propertyName, expressionString = args.expressionString, effectName = args.effectName;
        var target;
        try { target = resolveTarget(args); }
        catch (e) { return JSON.stringify({ success: false, message: e.message }); }
        var comp = target.comp, layer = target.layer;

        var transformGroup = layer.property("Transform");
         if (!transformGroup) {
             // Allow expressions on non-transformable layers if property exists elsewhere
             // return JSON.stringify({ success: false, message: "Transform properties not found for layer '" + layer.name + "' (type: " + layer.matchName + ")." });
        }

        var property = null;
        if (effectName) {
            // Caller named the effect: look for the property INSIDE that effect only
            var targetEffect = findEffectOnLayer(layer, effectName);
            if (!targetEffect) {
                return JSON.stringify({ success: false, message: "Effect '" + effectName + "' not found on layer '" + layer.name + "'." });
            }
            property = findPropertyInsideGroup(targetEffect, propertyName);
            if (!property) {
                return JSON.stringify({ success: false, message: "Property '" + propertyName + "' not found inside effect '" + effectName + "' on layer '" + layer.name + "'." });
            }
        } else {
            property = transformGroup ? transformGroup.property(propertyName) : null;
            if (!property) {
                // Check other common property groups if not in Transform
                if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                    property = layer.property("Effects").property(propertyName);
                } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                    property = layer.property("Text").property(propertyName);
                }

                // The name matched an effect itself (e.g. the Exposure effect, not its "Exposure" parameter).
                // Fall through to that effect's first matching child property.
                if (property && property.propertyType !== PropertyType.PROPERTY) {
                    property = findPropertyInsideGroup(property, propertyName);
                }

                // Search inside individual effects for sub-properties
                if (!property && layer.property("Effects")) {
                    property = findPropertyInAnyEffect(layer, propertyName);
                }

                if (!property) {
                     return JSON.stringify({ success: false, message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'." });
                }
            }
        }

        if (!property.canSetExpression) {
            return JSON.stringify({ success: false, message: "Property '" + propertyName + "' does not support expressions." });
        }

        property.expression = expressionString;

        var action = expressionString === "" ? "removed" : "set";
        return JSON.stringify({ success: true, message: "Expression " + action + " for '" + propertyName + "' on layer '" + layer.name + "'." });
    } catch (e) {
        return JSON.stringify({ success: false, message: "Error setting expression: " + e.toString() + " (Line: " + e.line + ")" });
    }
}

// --- applyEffect (from applyEffect.jsx) ---
function applyEffect(args) {
    try {
        // Extract parameters
        var compIndex = args.compIndex;
        var effectName = args.effectName; // Name of the effect to apply
        var effectMatchName = args.effectMatchName; // After Effects internal name (more reliable)
        var effectCategory = args.effectCategory || ""; // Optional category for filtering
        var presetPath = args.presetPath; // Optional path to an effect preset
        var effectSettings = args.effectSettings || {}; // Optional effect parameters
        
        if (!effectName && !effectMatchName && !presetPath) {
            throw new Error("You must specify either effectName, effectMatchName, or presetPath");
        }
        
        // Find the comp (compName, compIndex or active comp) and the layer (layerIndex or layerName)
        var target = resolveTarget(args);
        var comp = target.comp;
        var layer = target.layer;
        
        var effectResult;
        
        // Apply preset if a path is provided
        if (presetPath) {
            var presetFile = new File(presetPath);
            if (!presetFile.exists) {
                throw new Error("Effect preset file not found: " + presetPath);
            }
            
            // Apply the preset to the layer
            layer.applyPreset(presetFile);
            effectResult = {
                type: "preset",
                name: presetPath.split('/').pop().split('\\').pop(),
                applied: true
            };
        }
        // Apply effect by match name (more reliable method)
        else if (effectMatchName) {
            var effect = layer.Effects.addProperty(effectMatchName);
            effectResult = {
                type: "effect",
                name: effect.name,
                matchName: effect.matchName,
                index: effect.propertyIndex
            };
            
            // Apply settings if provided
            applyEffectSettings(effect, effectSettings);
        }
        // Apply effect by display name
        else {
            // Get the effect from the Effect menu
            var effect = layer.Effects.addProperty(effectName);
            effectResult = {
                type: "effect",
                name: effect.name,
                matchName: effect.matchName,
                index: effect.propertyIndex
            };
            
            // Apply settings if provided
            applyEffectSettings(effect, effectSettings);
        }
        
        return JSON.stringify({
            status: "success",
            message: "Effect applied successfully",
            effect: effectResult,
            layer: {
                name: layer.name,
                index: layer.index
            },
            composition: {
                name: comp.name,
                index: compIndex
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

// Helper function to apply effect settings
function applyEffectSettings(effect, settings) {
    // Skip if no settings are provided
    if (!settings) return;
    var hasKeys = false;
    for (var k in settings) { if (settings.hasOwnProperty(k)) { hasKeys = true; break; } }
    if (!hasKeys) return;
    
    // Iterate through all provided settings
    for (var propName in settings) {
        if (settings.hasOwnProperty(propName)) {
            try {
                // Find the property in the effect
                var property = null;
                
                // Try direct property access first
                try {
                    property = effect.property(propName);
                } catch (e) {
                    // If direct access fails, search through all properties
                    for (var i = 1; i <= effect.numProperties; i++) {
                        var prop = effect.property(i);
                        if (prop.name === propName) {
                            property = prop;
                            break;
                        }
                    }
                }
                
                // Set the property value if found
                if (property && property.setValue) {
                    property.setValue(settings[propName]);
                }
            } catch (e) {
                // Log error but continue with other properties
                $.writeln("Error setting effect property '" + propName + "': " + e.toString());
            }
        }
    }
}

// --- applyEffectTemplate (from applyEffectTemplate.jsx) ---
function applyEffectTemplate(args) {
    try {
        // Extract parameters
        var compIndex = args.compIndex;
        var templateName = args.templateName; // Name of the template to apply
        var customSettings = args.customSettings || {}; // Optional customizations
        
        if (!templateName) {
            throw new Error("You must specify a templateName");
        }
        
        // Find the comp (compName, compIndex or active comp) and the layer (layerIndex or layerName)
        var target = resolveTarget(args);
        var comp = target.comp;
        var layer = target.layer;
        
        // Template definitions
        var templates = {
            // Blur effects
            "gaussian-blur": {
                effectMatchName: "ADBE Gaussian Blur 2",
                settings: {
                    "Blurriness": customSettings.blurriness || 20
                }
            },
            "directional-blur": {
                effectMatchName: "ADBE Directional Blur",
                settings: {
                    "Direction": customSettings.direction || 0,
                    "Blur Length": customSettings.length || 10
                }
            },
            
            // Color correction effects
            "color-balance": {
                effectMatchName: "ADBE Color Balance (HLS)",
                settings: {
                    "Hue": customSettings.hue || 0,
                    "Lightness": customSettings.lightness || 0,
                    "Saturation": customSettings.saturation || 0
                }
            },
            "brightness-contrast": {
                effectMatchName: "ADBE Brightness & Contrast 2",
                settings: {
                    "Brightness": customSettings.brightness || 0,
                    "Contrast": customSettings.contrast || 0,
                    "Use Legacy": false
                }
            },
            "curves": {
                effectMatchName: "ADBE CurvesCustom",
                // Curves are complex and would need special handling
            },
            
            // Stylistic effects
            "glow": {
                effectMatchName: "ADBE Glow",
                settings: {
                    "Glow Threshold": customSettings.threshold || 50,
                    "Glow Radius": customSettings.radius || 15,
                    "Glow Intensity": customSettings.intensity || 1
                }
            },
            "drop-shadow": {
                effectMatchName: "ADBE Drop Shadow",
                settings: {
                    "Shadow Color": customSettings.color || [0, 0, 0, 1],
                    "Opacity": customSettings.opacity || 50,
                    "Direction": customSettings.direction || 135,
                    "Distance": customSettings.distance || 10,
                    "Softness": customSettings.softness || 10
                }
            },
            
            // Common effect chains
            "cinematic-look": {
                effects: [
                    {
                        effectMatchName: "ADBE CurvesCustom",
                        settings: {}
                    },
                    {
                        effectMatchName: "ADBE Vibrance",
                        settings: {
                            "Vibrance": 15,
                            "Saturation": -5
                        }
                    }
                ]
            },
            "text-pop": {
                effects: [
                    {
                        effectMatchName: "ADBE Drop Shadow",
                        settings: {
                            "Shadow Color": [0, 0, 0, 1],
                            "Opacity": 75,
                            "Distance": 5,
                            "Softness": 10
                        }
                    },
                    {
                        effectMatchName: "ADBE Glow",
                        settings: {
                            "Glow Threshold": 50,
                            "Glow Radius": 10,
                            "Glow Intensity": 1.5
                        }
                    }
                ]
            }
        };
        
        // Check if the requested template exists
        var template = templates[templateName];
        if (!template) {
            var availableTemplates = Object.keys(templates).join(", ");
            throw new Error("Template '" + templateName + "' not found. Available templates: " + availableTemplates);
        }
        
        var appliedEffects = [];
        
        // Apply single effect or multiple effects based on template structure
        if (template.effectMatchName) {
            // Single effect template
            var effect = layer.Effects.addProperty(template.effectMatchName);
            
            // Apply settings
            for (var propName in template.settings) {
                try {
                    var property = effect.property(propName);
                    if (property) {
                        property.setValue(template.settings[propName]);
                    }
                } catch (e) {
                    $.writeln("Warning: Could not set " + propName + " on effect " + effect.name + ": " + e);
                }
            }
            
            appliedEffects.push({
                name: effect.name,
                matchName: effect.matchName
            });
        } else if (template.effects) {
            // Multiple effects template
            for (var i = 0; i < template.effects.length; i++) {
                var effectData = template.effects[i];
                var effect = layer.Effects.addProperty(effectData.effectMatchName);
                
                // Apply settings
                for (var propName in effectData.settings) {
                    try {
                        var property = effect.property(propName);
                        if (property) {
                            property.setValue(effectData.settings[propName]);
                        }
                    } catch (e) {
                        $.writeln("Warning: Could not set " + propName + " on effect " + effect.name + ": " + e);
                    }
                }
                
                appliedEffects.push({
                    name: effect.name,
                    matchName: effect.matchName
                });
            }
        }
        
        return JSON.stringify({
            status: "success",
            message: "Effect template '" + templateName + "' applied successfully",
            appliedEffects: appliedEffects,
            layer: {
                name: layer.name,
                index: layer.index
            },
            composition: {
                name: comp.name,
                index: compIndex
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

// --- Shared helpers for the newer commands (precompose, parenting, import, etc.) ---

// Find a comp by name. Same fallback rule as the older commands: use the active comp if not found.
function resolveComp(compName) {
    // A name that is given must exist; only an empty name means "the active comp".
    if (compName) { return findCompByNameStrict(compName); }
    if (app.project.activeItem instanceof CompItem) { return app.project.activeItem; }
    throw new Error("No compName given and no active composition");
}

// Find a comp by exact name only (no active-comp fallback). Used when a comp is the *subject* of the command.
function findCompByNameStrict(compName) {
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item instanceof CompItem && item.name === compName) { return item; }
    }
    throw new Error("Composition not found: '" + compName + "'");
}

// Resolve the comp and layer a command targets. The comp is chosen by compName (exact, strict), else compIndex
// (project item index), else the active comp. The layer is chosen by layerIndex or layerName.
// Throws if a named/indexed comp does not exist, instead of silently falling back to the active comp.
function resolveTarget(args, needLayer) {
    var comp = null;
    if (args.compName) {
        comp = findCompByNameStrict(args.compName);
    } else if (args.compIndex !== undefined && args.compIndex !== null) {
        comp = app.project.item(args.compIndex);
        if (!comp || !(comp instanceof CompItem)) { throw new Error("Composition not found at project item index " + args.compIndex); }
    } else if (app.project.activeItem instanceof CompItem) {
        comp = app.project.activeItem;
    } else {
        throw new Error("No compName/compIndex given and no active composition");
    }
    var layer = null;
    if (needLayer !== false) { layer = resolveLayer(comp, args.layerIndex, args.layerName || ""); }
    return { comp: comp, layer: layer };
}

// Find a layer by index or name. Throws if it cannot be found.
function resolveLayer(comp, layerIndex, layerName) {
    var layer = null;
    if (layerIndex !== undefined && layerIndex !== null) {
        if (layerIndex > 0 && layerIndex <= comp.numLayers) { layer = comp.layer(layerIndex); }
        else { throw new Error("Layer index out of bounds: " + layerIndex); }
    } else if (layerName) {
        for (var j = 1; j <= comp.numLayers; j++) {
            if (comp.layer(j).name === layerName) { layer = comp.layer(j); break; }
        }
    }
    if (!layer) { throw new Error("Layer not found: " + (layerName || "index " + layerIndex)); }
    return layer;
}

// Find an effect on a layer by name/matchName (string) or 1-based index (number). Returns null if missing.
function findEffectOnLayer(layer, effectNameOrIndex) {
    var effects = layer.property("ADBE Effect Parade");
    if (!effects) { return null; }
    if (typeof effectNameOrIndex === "number") {
        if (effectNameOrIndex >= 1 && effectNameOrIndex <= effects.numProperties) { return effects.property(effectNameOrIndex); }
        return null;
    }
    for (var i = 1; i <= effects.numProperties; i++) {
        var eff = effects.property(i);
        if (eff.name === effectNameOrIndex || eff.matchName === effectNameOrIndex) { return eff; }
    }
    return null;
}

// Search INSIDE a property group (e.g. one effect) for a real property with this name.
// Direct children are checked first, then nested groups. The group itself is never returned.
function findPropertyInsideGroup(group, name) {
    var i, p;
    for (i = 1; i <= group.numProperties; i++) {
        p = group.property(i);
        if (p.propertyType === PropertyType.PROPERTY && (p.name === name || p.matchName === name)) { return p; }
    }
    for (i = 1; i <= group.numProperties; i++) {
        p = group.property(i);
        if (p.propertyType !== PropertyType.PROPERTY) {
            var nested = findPropertyInsideGroup(p, name);
            if (nested) { return nested; }
        }
    }
    return null;
}

// Search every effect on the layer for a real property with this name (first match wins).
function findPropertyInAnyEffect(layer, name) {
    var effects = layer.property("ADBE Effect Parade");
    if (!effects) { return null; }
    for (var i = 1; i <= effects.numProperties; i++) {
        var found = findPropertyInsideGroup(effects.property(i), name);
        if (found) { return found; }
    }
    return null;
}

// Read a property value without letting an odd value type break the JSON result.
function safePropertyValue(prop) {
    try { return prop.value; } catch (e) { return null; }
}

// --- createNullLayer: add a null object (defaults to comp centre) ---
function createNullLayer(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var nullLayer = comp.layers.addNull(args.duration || comp.duration);
        nullLayer.name = args.name || "Null";
        // Name the null's source after the layer too, so it can be found (and removed) in the Project panel
        try { if (args.name) { nullLayer.source.name = args.name; } } catch (sourceNameError) {}
        var pos = args.position || [comp.width / 2, comp.height / 2];
        nullLayer.property("Position").setValue(pos);
        return JSON.stringify({
            status: "success", message: "Null layer created successfully",
            layer: { name: nullLayer.name, index: nullLayer.index, position: pos }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- precomposeLayers: precompose layers into a new comp ---
function precomposeLayers(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var newCompName = args.newCompName;
        if (!newCompName) { throw new Error("newCompName is required"); }
        var moveAll = (args.moveAllAttributes === undefined || args.moveAllAttributes === null) ? true : !!args.moveAllAttributes;

        var indices = [];
        var i, k;
        if (args.layerIndices && args.layerIndices.length) {
            for (i = 0; i < args.layerIndices.length; i++) {
                var idx = args.layerIndices[i];
                if (!(idx > 0 && idx <= comp.numLayers)) { throw new Error("Layer index out of bounds: " + idx); }
                indices.push(idx);
            }
        } else if (args.layerNames && args.layerNames.length) {
            for (i = 0; i < args.layerNames.length; i++) {
                indices.push(resolveLayer(comp, null, args.layerNames[i]).index);
            }
        } else {
            throw new Error("Provide layerIndices (array of numbers) or layerNames (array of names)");
        }

        // Sort ascending and drop duplicates
        indices.sort(function (a, b) { return a - b; });
        var unique = [];
        for (k = 0; k < indices.length; k++) {
            if (k === 0 || indices[k] !== indices[k - 1]) { unique.push(indices[k]); }
        }

        var newComp = comp.layers.precompose(unique, newCompName, moveAll);

        // The new precomp layer is the one in the original comp whose source is the new comp
        var newLayer = null;
        for (var j = 1; j <= comp.numLayers; j++) {
            if (comp.layer(j).source === newComp) { newLayer = comp.layer(j); break; }
        }

        return JSON.stringify({
            status: "success",
            message: "Layers precomposed successfully",
            composition: { name: newComp.name, id: newComp.id, numLayers: newComp.numLayers },
            layer: newLayer ? { name: newLayer.name, index: newLayer.index } : null,
            precomposedCount: unique.length,
            moveAllAttributes: moveAll
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- addCompToComp: add an existing comp as a layer inside another comp ---
function addCompToComp(args) {
    try {
        var comp = resolveComp(args.compName || "");
        if (!args.sourceCompName) { throw new Error("sourceCompName is required"); }
        var sourceComp = findCompByNameStrict(args.sourceCompName);
        if (sourceComp === comp) { throw new Error("Cannot add a composition to itself"); }

        var newLayer = comp.layers.add(sourceComp);
        if (args.opacity !== undefined && args.opacity !== null) { newLayer.property("Opacity").setValue(args.opacity); }
        if (args.position !== undefined && args.position !== null) { newLayer.property("Position").setValue(args.position); }

        return JSON.stringify({
            status: "success",
            message: "Composition added as a layer successfully",
            layer: {
                name: newLayer.name,
                index: newLayer.index,
                source: sourceComp.name,
                opacity: newLayer.property("Opacity").value,
                position: newLayer.property("Position").value
            },
            composition: { name: comp.name }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- setGuideLayer: turn guide layer on/off ---
function setGuideLayer(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var layer = resolveLayer(comp, args.layerIndex, args.layerName || "");
        var guide = (args.guideLayer === undefined || args.guideLayer === null) ? true : !!args.guideLayer;
        layer.guideLayer = guide;
        return JSON.stringify({
            status: "success",
            message: "Guide layer " + (layer.guideLayer ? "enabled" : "disabled"),
            layer: { name: layer.name, index: layer.index, guideLayer: layer.guideLayer }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- setLayerParent: parent a layer to another layer, or clear the parent ---
function setLayerParent(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var layer = resolveLayer(comp, args.layerIndex, args.layerName || "");

        if (args.clearParent) {
            layer.parent = null;
        } else {
            if ((args.parentLayerIndex === undefined || args.parentLayerIndex === null) && !args.parentLayerName) {
                throw new Error("Provide parentLayerIndex or parentLayerName, or set clearParent to true");
            }
            var parentLayer = resolveLayer(comp, args.parentLayerIndex, args.parentLayerName || "");
            if (parentLayer.index === layer.index) { throw new Error("A layer cannot be its own parent"); }
            // keepTransform (default true): the layer stays where it is on screen; its local values are rewritten
            // relative to the parent. keepTransform false keeps the raw values, so the layer may jump.
            if (args.keepTransform === false) { layer.setParentWithJump(parentLayer); }
            else { layer.parent = parentLayer; }
        }

        return JSON.stringify({
            status: "success",
            message: layer.parent ? "Layer parented successfully" : "Parent cleared successfully",
            layer: { name: layer.name, index: layer.index },
            parent: layer.parent ? { name: layer.parent.name, index: layer.parent.index } : null
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- moveLayer: reorder a layer in the stack ---
// Exactly one of: moveTo ("top"/"bottom"), toIndex, aboveLayerIndex/aboveLayerName, belowLayerIndex/belowLayerName
function moveLayer(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var layer = resolveLayer(comp, args.layerIndex, args.layerName || "");
        var oldIndex = layer.index;

        var hasAbove = (args.aboveLayerIndex !== undefined && args.aboveLayerIndex !== null) || !!args.aboveLayerName;
        var hasBelow = (args.belowLayerIndex !== undefined && args.belowLayerIndex !== null) || !!args.belowLayerName;
        var hasToIndex = (args.toIndex !== undefined && args.toIndex !== null);
        var modeCount = (args.moveTo ? 1 : 0) + (hasToIndex ? 1 : 0) + (hasAbove ? 1 : 0) + (hasBelow ? 1 : 0);
        if (modeCount !== 1) {
            throw new Error("Provide exactly one of: moveTo ('top' or 'bottom'), toIndex, aboveLayerIndex/aboveLayerName, belowLayerIndex/belowLayerName");
        }

        if (args.moveTo) {
            if (args.moveTo === "top") { layer.moveToBeginning(); }
            else if (args.moveTo === "bottom") { layer.moveToEnd(); }
            else { throw new Error("moveTo must be 'top' or 'bottom'"); }
        } else if (hasToIndex) {
            if (!(args.toIndex > 0 && args.toIndex <= comp.numLayers)) { throw new Error("toIndex out of bounds: " + args.toIndex); }
            if (args.toIndex < layer.index) { layer.moveBefore(comp.layer(args.toIndex)); }
            else if (args.toIndex > layer.index) { layer.moveAfter(comp.layer(args.toIndex)); }
        } else if (hasAbove) {
            var aboveLayer = resolveLayer(comp, args.aboveLayerIndex, args.aboveLayerName || "");
            if (aboveLayer.index === layer.index) { throw new Error("Cannot move a layer relative to itself"); }
            layer.moveBefore(aboveLayer);
        } else {
            var belowLayer = resolveLayer(comp, args.belowLayerIndex, args.belowLayerName || "");
            if (belowLayer.index === layer.index) { throw new Error("Cannot move a layer relative to itself"); }
            layer.moveAfter(belowLayer);
        }

        return JSON.stringify({
            status: "success",
            message: "Layer moved successfully",
            layer: { name: layer.name, oldIndex: oldIndex, index: layer.index }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- importFile: import a file by absolute path, optionally into a folder and/or a comp ---
function importFile(args) {
    try {
        var filePath = args.filePath;
        if (!filePath) { throw new Error("filePath is required"); }
        if (!/^(\/|~|[A-Za-z]:[\\\/]|\\\\)/.test(filePath)) { throw new Error("filePath must be an absolute path: " + filePath); }
        var file = new File(filePath);
        if (!file.exists) { throw new Error("File not found: " + filePath); }

        var importOptions = new ImportOptions(file);
        var item = app.project.importFile(importOptions);

        var folderInfo = null;
        if (args.folderName) {
            var folder = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                var candidate = app.project.item(i);
                if (candidate instanceof FolderItem && candidate.name === args.folderName) { folder = candidate; break; }
            }
            var created = false;
            if (!folder) { folder = app.project.items.addFolder(args.folderName); created = true; }
            item.parentFolder = folder;
            folderInfo = { name: folder.name, created: created };
        }

        var layerInfo = null;
        if (args.addToComp) {
            var comp = resolveComp(args.compName || "");
            var newLayer = comp.layers.add(item);
            layerInfo = { name: newLayer.name, index: newLayer.index, composition: comp.name };
        }

        return JSON.stringify({
            status: "success",
            message: "File imported successfully",
            item: { name: item.name, id: item.id },
            folder: folderInfo,
            layer: layerInfo
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- renameEffect: rename an effect on a layer ---
function renameEffect(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var layer = resolveLayer(comp, args.layerIndex, args.layerName || "");
        if (!args.newName) { throw new Error("newName is required"); }

        var effectRef = null;
        if (args.effectIndex !== undefined && args.effectIndex !== null) { effectRef = args.effectIndex; }
        else if (args.effectName) { effectRef = args.effectName; }
        else { throw new Error("Provide effectName or effectIndex"); }

        var effect = findEffectOnLayer(layer, effectRef);
        if (!effect) { throw new Error("Effect not found on layer '" + layer.name + "': " + effectRef); }

        var oldName = effect.name;
        effect.name = args.newName;
        return JSON.stringify({
            status: "success", message: "Effect renamed successfully",
            effect: { oldName: oldName, name: effect.name, matchName: effect.matchName, index: effect.propertyIndex },
            layer: { name: layer.name, index: layer.index }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- setEffectProperty: change a parameter on an effect that is already applied ---
// Only searches INSIDE the named effect, so a parameter that shares its effect's name is found correctly.
function setEffectProperty(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var layer = resolveLayer(comp, args.layerIndex, args.layerName || "");
        if (!args.propertyName) { throw new Error("propertyName is required"); }
        if (args.value === undefined) { throw new Error("value is required"); }

        var effectRef = null;
        if (args.effectIndex !== undefined && args.effectIndex !== null) { effectRef = args.effectIndex; }
        else if (args.effectName) { effectRef = args.effectName; }
        else { throw new Error("Provide effectName or effectIndex"); }

        var effect = findEffectOnLayer(layer, effectRef);
        if (!effect) { throw new Error("Effect not found on layer '" + layer.name + "': " + effectRef); }

        var prop = findPropertyInsideGroup(effect, args.propertyName);
        if (!prop) { throw new Error("Property '" + args.propertyName + "' not found inside effect '" + effect.name + "'"); }
        if (prop.numKeys > 0) { throw new Error("Property '" + prop.name + "' has " + prop.numKeys + " keyframes; remove them before setting a static value"); }

        var newValue = args.value;
        if (typeof newValue === "boolean") { newValue = newValue ? 1 : 0; }
        // Colour properties want 4 numbers [r, g, b, a]; accept [r, g, b] and assume alpha 1
        if (prop.propertyValueType === PropertyValueType.COLOR && newValue instanceof Array && newValue.length === 3) {
            newValue = [newValue[0], newValue[1], newValue[2], 1];
        }

        var oldValue = safePropertyValue(prop);
        prop.setValue(newValue);

        return JSON.stringify({
            status: "success",
            message: "Effect property set successfully",
            effect: { name: effect.name, matchName: effect.matchName, index: effect.propertyIndex },
            property: { name: prop.name, oldValue: oldValue, newValue: safePropertyValue(prop) },
            layer: { name: layer.name, index: layer.index }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- addToRenderQueue: queue a comp (does NOT start rendering) ---
function addToRenderQueue(args) {
    try {
        var comp = resolveComp(args.compName || "");
        var rq = app.project.renderQueue;
        var rqItem = rq.items.add(comp);
        var om = rqItem.outputModule(1);

        try {
            if (args.outputModuleTemplate) {
                var templates = om.templates;
                var found = false;
                var available = [];
                for (var t = 0; t < templates.length; t++) {
                    if (templates[t] === args.outputModuleTemplate) { found = true; }
                    if (templates[t].indexOf("_HIDDEN") !== 0) { available.push(templates[t]); }
                }
                if (!found) { throw new Error("Output module template '" + args.outputModuleTemplate + "' not found. Available: " + available.join(", ")); }
                om.applyTemplate(args.outputModuleTemplate);
            }
            if (args.outputPath) {
                om.file = new File(args.outputPath);
            }
        } catch (setupError) {
            // Undo only the queue item we just added so a bad template/path does not leave junk behind
            rqItem.remove();
            throw setupError;
        }

        return JSON.stringify({
            status: "success",
            message: "Composition added to render queue (not rendered)",
            renderQueueItem: {
                index: rq.numItems,
                composition: comp.name,
                outputModuleTemplate: args.outputModuleTemplate || null,
                outputPath: om.file ? om.file.fsName : null
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- End of Function Definitions ---

// --- Bridge test function to verify communication and effects application ---
function bridgeTestEffects(args) {
    try {
        var compIndex = (args && args.compIndex) ? args.compIndex : 1;
        var layerIndex = (args && args.layerIndex) ? args.layerIndex : 1;

        // Apply a light Gaussian Blur
        var blurRes = JSON.parse(applyEffect({
            compIndex: compIndex,
            layerIndex: layerIndex,
            effectMatchName: "ADBE Gaussian Blur 2",
            effectSettings: { "Blurriness": 5 }
        }));

        // Apply a simple drop shadow via template
        var shadowRes = JSON.parse(applyEffectTemplate({
            compIndex: compIndex,
            layerIndex: layerIndex,
            templateName: "drop-shadow"
        }));

        return JSON.stringify({
            status: "success",
            message: "Bridge test effects applied.",
            results: [blurRes, shadowRes]
        }, null, 2);
    } catch (e) {
        return JSON.stringify({ status: "error", message: e.toString() }, null, 2);
    }
}

// JSON polyfill for ExtendScript (when JSON is undefined)
if (typeof JSON === "undefined") {
    JSON = {};
}
if (typeof JSON.parse !== "function") {
    JSON.parse = function (text) {
        // Safe-ish fallback for trusted input (our own command file)
        return eval("(" + text + ")");
    };
}
if (typeof JSON.stringify !== "function") {
    (function () {
        function esc(str) {
            return (str + "")
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\t/g, "\\t");
        }
        function toJSON(val) {
            if (val === null) return "null";
            var t = typeof val;
            if (t === "number" || t === "boolean") return String(val);
            if (t === "string") return '"' + esc(val) + '"';
            if (val instanceof Array) {
                var a = [];
                for (var i = 0; i < val.length; i++) a.push(toJSON(val[i]));
                return "[" + a.join(",") + "]";
            }
            if (t === "object") {
                var props = [];
                for (var k in val) {
                    if (val.hasOwnProperty(k) && typeof val[k] !== "function" && typeof val[k] !== "undefined") {
                        props.push('"' + esc(k) + '":' + toJSON(val[k]));
                    }
                }
                return "{" + props.join(",") + "}";
            }
            return "null";
        }
        JSON.stringify = function (value, _replacer, _space) {
            return toJSON(value);
        };
    })();
}

// Detect AE version (AE 2025 = version 25.x, AE 2026 = version 26.x)
var aeVersion = parseFloat(app.version);
var isAE2025OrLater = aeVersion >= 25.0;

// Always create a floating palette window for AE 2025+
var panel = new Window("palette", "MCP Bridge Auto", undefined);
panel.orientation = "column";
panel.alignChildren = ["fill", "top"];
panel.spacing = 10;
panel.margins = 16;

// Status display
var statusText = panel.add("statictext", undefined, "Waiting for commands...");
statusText.alignment = ["fill", "top"];

// Add log area
var logPanel = panel.add("panel", undefined, "Command Log");
logPanel.orientation = "column";
logPanel.alignChildren = ["fill", "fill"];
var logText = logPanel.add("edittext", undefined, "", {multiline: true, readonly: true});
logText.preferredSize.height = 200;

// AE 2025 warning
if (isAE2025OrLater) {
    var warning = panel.add("statictext", undefined, "AE 2025+: Dockable panels are not supported. Floating window only.");
    warning.graphics.foregroundColor = warning.graphics.newPen(warning.graphics.PenType.SOLID_COLOR, [1,0.3,0,1], 1);
}

// Auto-run checkbox
var autoRunCheckbox = panel.add("checkbox", undefined, "Auto-run commands");
autoRunCheckbox.value = true;

// Check interval (ms)
var initialBridgeSettings = readBridgeSettings();
autoRunCheckbox.value = initialBridgeSettings.autoRun !== false;
var checkInterval = clampNumber(initialBridgeSettings.pollIntervalMs, 250, 30000, 2000);
var isChecking = false;
var lastHeartbeatCommand = null;
var lastHeartbeatStatus = "idle";

// Command file path - use Documents folder for reliable access
function getCommandFilePath() {
    var userFolder = Folder.myDocuments;
    var bridgeFolder = new Folder(userFolder.fsName + "/ae-mcp-bridge");
    if (!bridgeFolder.exists) {
        bridgeFolder.create();
    }
    return bridgeFolder.fsName + "/ae_command.json";
}

// Result file path - use Documents folder for reliable access
function getResultFilePath() {
    var userFolder = Folder.myDocuments;
    var bridgeFolder = new Folder(userFolder.fsName + "/ae-mcp-bridge");
    if (!bridgeFolder.exists) {
        bridgeFolder.create();
    }
    return bridgeFolder.fsName + "/ae_mcp_result.json";
}

// --- Command queue ---
// Each client writes one file per command to queue/ and reads its own result from results/<id>.json, so several
// clients can share the bridge without overwriting each other. The old single ae_command.json /
// ae_mcp_result.json pair still works for clients that have not moved over.
function getBridgeSubfolder(name) {
    var folder = new Folder(getBridgeRootFolder().fsName + "/" + name);
    if (!folder.exists) { folder.create(); }
    return folder;
}
function getQueueFolder() { return getBridgeSubfolder("queue"); }
function getResultsFolder() { return getBridgeSubfolder("results"); }

function getBridgeRootFolder() {
    var folder = new Folder(Folder.myDocuments.fsName + "/ae-mcp-bridge");
    if (!folder.exists) { folder.create(); }
    return folder;
}

function clampNumber(value, min, max, fallback) {
    var number = Number(value);
    return isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function readBridgeSettings() {
    var defaults = {
        safetyMode: "full",
        autoRun: true,
        autoBackupHighImpact: true,
        pollIntervalMs: 2000,
        commandExpiryMs: 600000,
        resultRetention: 100,
        maxCommandsPerTick: 10
    };
    try {
        var file = new File(Folder.myDocuments.fsName + "/ae-mcp-bridge/settings.json");
        if (!file.exists || !file.open("r")) { return defaults; }
        var text = file.read();
        file.close();
        var parsed = JSON.parse(text);
        for (var key in parsed) { if (parsed.hasOwnProperty(key)) { defaults[key] = parsed[key]; } }
    } catch (e) {}
    return defaults;
}

function writeHeartbeat() {
    try {
        var queue = getQueueFolder().getFiles("*.json");
        var payload = {
            timestamp: isoTimestamp(new Date()),
            aeVersion: app.version,
            bridgeVersion: BRIDGE_VERSION,
            autoRun: !!autoRunCheckbox.value,
            queueDepth: queue ? queue.length : 0,
            lastCommand: lastHeartbeatCommand,
            lastStatus: lastHeartbeatStatus,
            safetyMode: readBridgeSettings().safetyMode || "full"
        };
        try { payload.project = projectStatus(); } catch (e1) {}
        writeTextFile(getBridgeRootFolder().fsName + "/status.json", JSON.stringify(payload, null, 2));
    } catch (e) {}
}

function writeTextFile(path, text) {
    var f = new File(path);
    f.encoding = "UTF-8";
    if (!f.open("w")) { throw new Error("Failed to open for writing: " + f.fsName); }
    f.write(text);
    f.close();
}

// Keep only the newest 100 per-command results
function pruneResults() {
    try {
        var retention = clampNumber(readBridgeSettings().resultRetention, 10, 5000, 100);
        var files = getResultsFolder().getFiles("*.json");
        if (!files || files.length <= retention) { return; }
        files.sort(function (a, b) { return a.modified.getTime() - b.modified.getTime(); });
        for (var i = 0; i < files.length - retention; i++) { try { files[i].remove(); } catch (e1) {} }
    } catch (e) {}
}

// Write a command's result: results/<id>.json (written under a temp name then renamed, so a polling client never
// reads half a file) and, for compatibility, ae_mcp_result.json as "the latest result".
function writeResultFiles(resultString, id) {
    if (id) {
        var dir = getResultsFolder().fsName;
        var tmp = dir + "/" + id + ".json.tmp";
        writeTextFile(tmp, resultString);
        var tmpFile = new File(tmp);
        if (!tmpFile.rename(id + ".json")) {
            writeTextFile(dir + "/" + id + ".json", resultString);
            try { tmpFile.remove(); } catch (e) {}
        }
        pruneResults();
    }
    writeTextFile(getResultFilePath(), resultString);
}

// Run queued commands oldest-first (up to 10 per tick). Returns how many ran.
function processQueue() {
    var settings = readBridgeSettings();
    var maxPerTick = clampNumber(settings.maxCommandsPerTick, 1, 100, 10);
    var expiryMs = clampNumber(settings.commandExpiryMs, 10000, 86400000, 600000);
    var files = getQueueFolder().getFiles("*.json");
    if (!files || files.length === 0) { return 0; }
    files.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
    var handled = 0;
    for (var i = 0; i < files.length && handled < maxPerTick; i++) {
        var qf = files[i];
        var data = null;
        try {
            qf.encoding = "UTF-8";
            qf.open("r");
            var content = qf.read();
            qf.close();
            data = JSON.parse(content);
        } catch (parseErr) {
            logToPanel("Discarding unreadable queue file " + qf.name + ": " + parseErr.toString());
            try { qf.remove(); } catch (e0) {}
            continue;
        }
        var id = data ? String(data.id || "") : "";
        // The id becomes a file name, so only allow plain characters
        if (!/^[A-Za-z0-9_\-]{1,80}$/.test(id) || !data.command) {
            logToPanel("Discarding queue file with a missing or invalid id/command: " + qf.name);
            try { qf.remove(); } catch (e1) {}
            continue;
        }
        if (new Date().getTime() - qf.modified.getTime() > expiryMs) {
            writeResultFiles(JSON.stringify({ status: "error", message: "Command expired in the queue before After Effects processed it", _commandId: id, _commandExecuted: data.command }), id);
            try { qf.remove(); } catch (e2) {}
            continue;
        }
        try { executeCommand(data.command, data.args || {}, id); }
        finally { try { qf.remove(); } catch (e3) {} }
        handled++;
    }
    return handled;
}

// --- setCompositionProperties: set duration, frameRate, etc. on active or named comp ---
function setCompositionProperties(args) {
    try {
        var compName = args.compName || "";
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (!compName && app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; }
            else { throw new Error(compName ? "Composition not found: '" + compName + "'" : "No compName given and no active composition"); }
        }
        var changed = [];
        if (args.duration !== undefined && args.duration !== null) { comp.duration = args.duration; changed.push("duration"); }
        if (args.frameRate !== undefined && args.frameRate !== null) { comp.frameRate = args.frameRate; changed.push("frameRate"); }
        if (args.width !== undefined && args.width !== null && args.height !== undefined && args.height !== null) {
            comp.width = args.width; comp.height = args.height; changed.push("dimensions");
        }
        return JSON.stringify({
            status: "success",
            composition: { name: comp.name, duration: comp.duration, frameRate: comp.frameRate, width: comp.width, height: comp.height },
            changedProperties: changed
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// Functions for each script type
function getProjectInfo() {
    var project = app.project;
    var result = {
        projectName: project.file ? project.file.name : "Untitled Project",
        path: project.file ? project.file.fsName : "",
        numItems: project.numItems,
        bitsPerChannel: project.bitsPerChannel,
        timeMode: project.timeDisplayType === TimeDisplayType.FRAMES ? "Frames" : "Timecode",
        items: []
    };

    // Count item types
    var countByType = {
        compositions: 0,
        footage: 0,
        folders: 0,
        solids: 0
    };

    // Get item information (limited for performance)
    for (var i = 1; i <= Math.min(project.numItems, 50); i++) {
        var item = project.item(i);
        var itemType = "";
        
        if (item instanceof CompItem) {
            itemType = "Composition";
            countByType.compositions++;
        } else if (item instanceof FolderItem) {
            itemType = "Folder";
            countByType.folders++;
        } else if (item instanceof FootageItem) {
            if (item.mainSource instanceof SolidSource) {
                itemType = "Solid";
                countByType.solids++;
            } else {
                itemType = "Footage";
                countByType.footage++;
            }
        }
        
        result.items.push({
            id: item.id,
            name: item.name,
            type: itemType
        });
    }
    
    result.itemCounts = countByType;

    // Include active composition metadata if available
    if (app.project.activeItem instanceof CompItem) {
        var ac = app.project.activeItem;
        result.activeComp = {
            id: ac.id,
            name: ac.name,
            width: ac.width,
            height: ac.height,
            duration: ac.duration,
            frameRate: ac.frameRate,
            numLayers: ac.numLayers
        };
    }

    return JSON.stringify(result, null, 2);
}

function listCompositions() {
    var project = app.project;
    var result = {
        compositions: []
    };
    
    // Loop through items in the project
    for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        
        // Check if the item is a composition
        if (item instanceof CompItem) {
            result.compositions.push({
                id: item.id,
                name: item.name,
                duration: item.duration,
                frameRate: item.frameRate,
                width: item.width,
                height: item.height,
                numLayers: item.numLayers
            });
        }
    }
    
    return JSON.stringify(result, null, 2);
}

// Read a transform-style property into {value, expression?, numKeyframes}. Returns null if the layer lacks it.
function describeProperty(layer, group, matchName) {
    try {
        var prop = layer.property(group).property(matchName);
        if (!prop) { return null; }
        var info = { value: safePropertyValue(prop), numKeyframes: prop.numKeys || 0 };
        if (prop.expressionEnabled) { info.expression = prop.expression; }
        return info;
    } catch (e) { return null; }
}

// getLayerInfo: {compName? | compIndex? (default: active comp), layerIndex? | layerName? (default: all layers)}
function getLayerInfo(args) {
    try {
        args = args || {};
        var hasLayer = (args.layerIndex !== undefined && args.layerIndex !== null) || !!args.layerName;
        var comp = resolveTarget(args, false).comp;
        var layers = [];
        if (hasLayer) { layers.push(resolveLayer(comp, args.layerIndex, args.layerName || "")); }
        else { for (var i = 1; i <= comp.numLayers; i++) { layers.push(comp.layer(i)); } }

        var result = { composition: { name: comp.name, id: comp.id, width: comp.width, height: comp.height, duration: comp.duration, frameRate: comp.frameRate }, layers: [] };
        for (var j = 0; j < layers.length; j++) {
            var layer = layers[j];
            var info = {
                index: layer.index,
                name: layer.name,
                type: layerTypeName(layer),
                enabled: layer.enabled,
                locked: layer.locked,
                shy: layer.shy,
                solo: layer.solo,
                label: layer.label,
                threeDLayer: layer.threeDLayer,
                isNull: !!layer.nullLayer,
                guideLayer: !!layer.guideLayer,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint,
                startTime: layer.startTime,
                position: safePropertyValue(layer.property("Position")),
                parent: layer.parent ? { index: layer.parent.index, name: layer.parent.name } : null
            };
            if (layer.source) { info.source = { name: layer.source.name, isComp: layer.source instanceof CompItem }; }
            info.transform = {
                anchorPoint: describeProperty(layer, "Transform", "Anchor Point"),
                position: describeProperty(layer, "Transform", "Position"),
                scale: describeProperty(layer, "Transform", "Scale"),
                rotation: describeProperty(layer, "Transform", layer.threeDLayer ? "Z Rotation" : "Rotation"),
                opacity: describeProperty(layer, "Transform", "Opacity")
            };
            info.effects = [];
            var effects = layer.property("ADBE Effect Parade");
            if (effects) {
                for (var k = 1; k <= effects.numProperties; k++) {
                    var eff = effects.property(k);
                    info.effects.push({ index: k, name: eff.name, matchName: eff.matchName, enabled: eff.enabled });
                }
            }
            result.layers.push(info);
        }
        return JSON.stringify(result, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// Find a layer property by name: inside a named effect, else Transform, else anywhere on the layer.
function findLayerProperty(layer, propertyName, effectName) {
    if (effectName) {
        var eff = findEffectOnLayer(layer, effectName);
        if (!eff) { return null; }
        return findPropertyInsideGroup(eff, propertyName);
    }
    var transform = layer.property("Transform");
    var prop = transform ? transform.property(propertyName) : null;
    if (prop) { return prop; }
    prop = layer.property(propertyName);
    if (prop && prop.propertyType === PropertyType.PROPERTY) { return prop; }
    return findPropertyInsideGroup(layer, propertyName);
}

function interpolationName(type) {
    if (type === KeyframeInterpolationType.LINEAR) { return "linear"; }
    if (type === KeyframeInterpolationType.BEZIER) { return "bezier"; }
    if (type === KeyframeInterpolationType.HOLD) { return "hold"; }
    return "unknown";
}

function easeToArray(eases) {
    var out = [];
    for (var i = 0; i < eases.length; i++) { out.push({ speed: eases[i].speed, influence: eases[i].influence }); }
    return out;
}

// --- getKeyframes: list the keyframes on a property ---
// {compName|compIndex?, layerIndex|layerName, propertyName, effectName?}
function getKeyframes(args) {
    try {
        var target = resolveTarget(args);
        if (!args.propertyName) { throw new Error("propertyName is required"); }
        var prop = findLayerProperty(target.layer, args.propertyName, args.effectName);
        if (!prop) { throw new Error("Property '" + args.propertyName + "' not found on layer '" + target.layer.name + "'"); }

        var keys = [];
        for (var k = 1; k <= prop.numKeys; k++) {
            var keyValue = null;
            try { keyValue = prop.keyValue(k); } catch (e0) {}
            var key = {
                index: k,
                time: prop.keyTime(k),
                value: keyValue,
                inInterpolation: interpolationName(prop.keyInInterpolationType(k)),
                outInterpolation: interpolationName(prop.keyOutInterpolationType(k))
            };
            try { key.inEase = easeToArray(prop.keyInTemporalEase(k)); key.outEase = easeToArray(prop.keyOutTemporalEase(k)); } catch (e1) {}
            keys.push(key);
        }
        return JSON.stringify({
            status: "success",
            layer: { name: target.layer.name, index: target.layer.index },
            property: { name: prop.name, matchName: prop.matchName, numKeyframes: prop.numKeys, value: safePropertyValue(prop), expressionEnabled: prop.expressionEnabled, expression: prop.expressionEnabled ? prop.expression : null },
            keyframes: keys
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- removeKeyframes: delete keyframes from a property ---
// {compName|compIndex?, layerIndex|layerName, propertyName, effectName?} plus ONE of: all (true), keyIndices [..], time (seconds)
function removeKeyframes(args) {
    try {
        var target = resolveTarget(args);
        if (!args.propertyName) { throw new Error("propertyName is required"); }
        var prop = findLayerProperty(target.layer, args.propertyName, args.effectName);
        if (!prop) { throw new Error("Property '" + args.propertyName + "' not found on layer '" + target.layer.name + "'"); }

        var hasTime = args.time !== undefined && args.time !== null;
        var hasIndices = args.keyIndices && args.keyIndices.length > 0;
        if (!args.all && !hasTime && !hasIndices) { throw new Error("Specify one of: all (true), keyIndices, or time"); }

        var before = prop.numKeys;
        var indices = [];
        if (args.all) { for (var a = 1; a <= before; a++) { indices.push(a); } }
        else if (hasTime) {
            if (before === 0) { throw new Error("Property has no keyframes"); }
            var nearest = prop.nearestKeyIndex(args.time);
            var tolerance = target.comp.frameDuration / 2;
            if (Math.abs(prop.keyTime(nearest) - args.time) > tolerance) {
                throw new Error("No keyframe at " + args.time + "s (nearest is #" + nearest + " at " + prop.keyTime(nearest) + "s)");
            }
            indices.push(nearest);
        }
        else { indices = args.keyIndices.slice(0); }

        for (var c = 0; c < indices.length; c++) {
            if (indices[c] < 1 || indices[c] > before) { throw new Error("Keyframe index out of range: " + indices[c] + " (property has " + before + ")"); }
        }
        indices.sort(function (x, y) { return y - x; }); // delete from the end so indices stay valid
        for (var d = 0; d < indices.length; d++) {
            if (d > 0 && indices[d] === indices[d - 1]) { continue; }
            prop.removeKey(indices[d]);
        }
        return JSON.stringify({
            status: "success", message: "Keyframes removed",
            layer: { name: target.layer.name, index: target.layer.index },
            property: { name: prop.name, keyframesBefore: before, keyframesAfter: prop.numKeys }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- removeEffect: delete an effect from a layer ---
// {compName|compIndex?, layerIndex|layerName, effectName|effectIndex}
function removeEffect(args) {
    try {
        var target = resolveTarget(args);
        var effectRef = null;
        if (args.effectIndex !== undefined && args.effectIndex !== null) { effectRef = args.effectIndex; }
        else if (args.effectName) { effectRef = args.effectName; }
        else { throw new Error("Provide effectName or effectIndex"); }
        var effect = findEffectOnLayer(target.layer, effectRef);
        if (!effect) { throw new Error("Effect not found on layer '" + target.layer.name + "': " + effectRef); }
        var name = effect.name, matchName = effect.matchName;
        effect.remove();
        return JSON.stringify({
            status: "success", message: "Effect removed (expressions that referenced it will now error)",
            effect: { name: name, matchName: matchName },
            layer: { name: target.layer.name, index: target.layer.index }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- Project control ---
function projectStatus() {
    var proj = app.project;
    var active = (proj.activeItem instanceof CompItem) ? { name: proj.activeItem.name, id: proj.activeItem.id } : null;
    return {
        name: proj.file ? decodeURI(proj.file.name) : null,
        path: proj.file ? proj.file.fsName : null,
        numItems: proj.numItems,
        activeComp: active
    };
}

function getProjectStatus() {
    try {
        var st = projectStatus();
        st.status = "success";
        st.saved = !!app.project.file;
        return JSON.stringify(st, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// {path?, overwrite?}. Without a path, saves in place. With a path, saves a copy as the current project (Save As).
function saveProject(args) {
    try {
        args = args || {};
        if (args.path) {
            var target = new File(args.path);
            if (!target.parent || !target.parent.exists) { throw new Error("Folder does not exist: " + (target.parent ? target.parent.fsName : args.path)); }
            var isCurrent = app.project.file && app.project.file.fsName === target.fsName;
            if (target.exists && !isCurrent && !args.overwrite) { throw new Error("File already exists: " + target.fsName + " (set overwrite: true to replace it)"); }
            app.project.save(target);
        } else {
            if (!app.project.file) { throw new Error("Project has never been saved; provide a path"); }
            app.project.save();
        }
        return JSON.stringify({ status: "success", message: "Project saved", path: app.project.file ? app.project.file.fsName : null }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// Close the current project. saveCurrent must be an explicit boolean: closing otherwise would prompt (and block the bridge).
function closeCurrentProject(saveCurrent) {
    if (saveCurrent === true) {
        if (!app.project.file) { throw new Error("Current project has never been saved; saveProject with a path first, or pass saveCurrent: false to discard it"); }
        app.project.close(CloseOptions.SAVE_CHANGES);
    } else {
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    }
}

// {path, saveCurrent (required boolean)}. Replaces the open project.
function openProject(args) {
    try {
        if (!args.path) { throw new Error("path is required"); }
        if (typeof args.saveCurrent !== "boolean") { throw new Error("saveCurrent (true/false) is required: opening a project closes the current one"); }
        var file = new File(args.path);
        if (!file.exists) { throw new Error("File not found: " + file.fsName); }
        closeCurrentProject(args.saveCurrent);
        app.open(file);
        var st = projectStatus();
        st.status = "success";
        st.message = "Project opened";
        return JSON.stringify(st, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// {saveCurrent (required boolean)}. Replaces the open project with an empty one.
function newProject(args) {
    try {
        if (typeof args.saveCurrent !== "boolean") { throw new Error("saveCurrent (true/false) is required: a new project closes the current one"); }
        closeCurrentProject(args.saveCurrent);
        app.newProject();
        var st = projectStatus();
        st.status = "success";
        st.message = "New project created";
        return JSON.stringify(st, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// Commands that change the project and run inside an undo group, newest last. Only the bridge's own commands are
// undone, never the user's manual edits. Capped so it cannot grow without bound.
var undoStack = [];
var readOnlyCommands = {
    getProjectInfo: 1, listCompositions: 1, getLayerInfo: 1, getKeyframes: 1, getProjectStatus: 1,
    getRenderStatus: 1, exportFrame: 1, getMarkers: 1, listLayerProperties: 1, getProjectTree: 1, openComp: 1, getCapabilities: 1, getPropertyReference: 1, backupProject: 1, getSelection: 1, setSelection: 1, setCurrentTime: 1, listEffects: 1, listFonts: 1, listRenderTemplates: 1, "test-animation": 1, bridgeTestEffects: 1
};

// Stricter set used by the dashboard's read-only safety mode. Commands that alter selection, write files, or create
// test content are intentionally excluded even when they do not modify the project itself.
var strictReadOnlyCommands = {
    getProjectInfo: 1, listCompositions: 1, getLayerInfo: 1, getKeyframes: 1, getProjectStatus: 1,
    getRenderStatus: 1, getMarkers: 1, listLayerProperties: 1, getProjectTree: 1, getCapabilities: 1,
    getPropertyReference: 1, getSelection: 1, listEffects: 1, listFonts: 1, listRenderTemplates: 1
};
var highImpactCommands = { openProject: 1, newProject: 1, startRender: 1 };
// Commands that can replace project state, remove multiple project items, or commit a render. When enabled,
// preserve the last saved project file before they run. This intentionally does not save unsaved edits in place.
var automaticBackupCommands = { openProject: 1, newProject: 1, deleteProjectItems: 1, startRender: 1 };

function commandPolicyError(command) {
    var mode = String(readBridgeSettings().safetyMode || "full");
    if (mode === "read-only" && !strictReadOnlyCommands[command]) {
        return "Blocked by read-only safety mode. Change the safety mode in the After Effects MCP setup dashboard to run this command.";
    }
    if (mode === "editing" && highImpactCommands[command]) {
        return "Blocked by standard editing safety mode because this command can replace a project or start a render.";
    }
    return null;
}

function resultIsError(resultString) {
    return /"status"\s*:\s*"error"|"success"\s*:\s*false|"error"\s*:/.test(String(resultString));
}

// {steps? (default 1, max 20)}. Undoes the last N bridge commands that changed the project.
function undoCommand(args) {
    try {
        var steps = (args && args.steps) ? parseInt(args.steps, 10) : 1;
        if (!(steps >= 1) || steps > 20) { throw new Error("steps must be between 1 and 20"); }
        if (undoStack.length === 0) { throw new Error("Nothing to undo: no changing bridge commands have run since the panel opened"); }
        var undone = [];
        for (var i = 0; i < steps && undoStack.length > 0; i++) {
            // Command 16 is Edit > Undo and does not depend on the install language. (Looking the menu item up by
            // name returned the wrong command.) Each bridge command ran in one undo group, so one undo reverses it.
            app.executeCommand(16);
            undone.push(undoStack.pop());
        }
        var out = { status: "success", message: "Undid " + undone.length + " command(s)", undone: undone, remaining: undoStack.length };
        return JSON.stringify(out, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- exportFrame: save one frame of a comp as a PNG so it can be looked at ---
// {compName? (default: active comp), time? (seconds, default: the comp's current time), outputPath? (.png),
//  overwrite?, scale? (1 = full size, 2 = half, 4 = quarter)}
// Without outputPath the frame goes to ~/Documents/ae-mcp-bridge/frames/ under a unique name.
function exportFrame(args) {
    var comp = null;
    var savedFactor = null;
    try {
        args = args || {};
        comp = resolveComp(args.compName || "");
        if (typeof comp.saveFrameToPng !== "function") {
            throw new Error("This version of After Effects has no CompItem.saveFrameToPng; frame export is unavailable");
        }
        var time = (args.time !== undefined && args.time !== null) ? Number(args.time) : comp.time;
        if (!(time >= 0) || time > comp.duration) {
            throw new Error("time " + args.time + " is outside the comp (0 to " + comp.duration + " seconds)");
        }
        var scale = args.scale ? parseInt(args.scale, 10) : 1;
        if (!(scale >= 1 && scale <= 16)) { throw new Error("scale must be between 1 (full size) and 16"); }

        var target;
        if (args.outputPath) {
            target = new File(args.outputPath);
            if (!/\.png$/i.test(target.name)) { throw new Error("outputPath must end in .png"); }
            if (!target.parent || !target.parent.exists) { throw new Error("Folder does not exist: " + (target.parent ? target.parent.fsName : args.outputPath)); }
            if (target.exists && !args.overwrite) { throw new Error("File already exists: " + target.fsName + " (set overwrite: true to replace it)"); }
        } else {
            var safeName = comp.name.replace(/[^A-Za-z0-9_\-]+/g, "_");
            target = new File(getBridgeSubfolder("frames").fsName + "/" + safeName + "-" + Math.round(time * 1000) + "ms-" + new Date().getTime() + ".png");
        }

        // Resolution factor is a comp setting; change it only for the export and always put it back
        savedFactor = comp.resolutionFactor;
        if (scale > 1) { comp.resolutionFactor = [scale, scale]; }
        comp.saveFrameToPng(time, target);

        // saveFrameToPng finishes in the background: wait (up to 20s) for the file to appear and stop growing
        var bytes = 0, stableChecks = 0, waited = 0;
        while (waited < 20000) {
            var size = target.exists ? target.length : 0;
            if (size > 0 && size === bytes) { stableChecks++; } else { stableChecks = 0; }
            bytes = size;
            if (stableChecks >= 2) { break; }
            $.sleep(150);
            waited += 150;
        }
        if (!target.exists || bytes === 0) { throw new Error("After Effects did not write a frame to " + target.fsName + " within 20 seconds"); }
        return JSON.stringify({
            status: "success",
            message: "Frame exported",
            path: target.fsName,
            bytes: bytes,
            composition: comp.name,
            time: time,
            scale: scale,
            width: Math.round(comp.width / scale),
            height: Math.round(comp.height / scale)
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    } finally {
        if (comp && savedFactor) { try { comp.resolutionFactor = savedFactor; } catch (restoreError) {} }
    }
}

// ===== Layer, marker, property and project-panel tools =====

function isSet(v) { return v !== undefined && v !== null; }
function hasLayerRef(args) { return isSet(args.layerIndex) || !!args.layerName; }
function fail(error) { return JSON.stringify({ status: "error", message: error.toString() }, null, 2); }

// --- setLayerTiming ---
// {compName?, layerIndex|layerName, stretch? (percent, 100 = normal), startTime?, inPoint?, outPoint?, timeRemap? (bool)}
function setLayerTiming(args) {
    try {
        var layer = resolveTarget(args).layer;
        var changed = [];
        // Stretch first (it moves the in/out points), then start, then the trim points
        if (isSet(args.stretch)) { layer.stretch = Number(args.stretch); changed.push("stretch"); }
        if (isSet(args.startTime)) { layer.startTime = Number(args.startTime); changed.push("startTime"); }
        // Setting inPoint also slides outPoint along with it, so keep the out point where it was (or where it was asked to be)
        var wantedOut = isSet(args.outPoint) ? Number(args.outPoint) : layer.outPoint;
        if (isSet(args.inPoint)) { layer.inPoint = Number(args.inPoint); changed.push("inPoint"); }
        if (isSet(args.outPoint) || isSet(args.inPoint)) {
            layer.outPoint = wantedOut;
            if (isSet(args.outPoint)) { changed.push("outPoint"); }
        }
        if (isSet(args.timeRemap)) { layer.timeRemapEnabled = !!args.timeRemap; changed.push("timeRemap"); }
        if (changed.length === 0) { throw new Error("Nothing to change: give stretch, startTime, inPoint, outPoint or timeRemap"); }
        return JSON.stringify({
            status: "success", message: "Layer timing updated",
            layer: { name: layer.name, index: layer.index, startTime: layer.startTime, inPoint: layer.inPoint, outPoint: layer.outPoint, stretch: layer.stretch, timeRemapEnabled: !!layer.timeRemapEnabled },
            changed: changed
        }, null, 2);
    } catch (error) { return fail(error); }
}

// --- splitLayer: cut a layer in two at a time ---
// {compName?, layerIndex|layerName, time}. The original keeps the first part; the new copy (above it) gets the rest.
function splitLayer(args) {
    try {
        var layer = resolveTarget(args).layer;
        var time = Number(args.time);
        if (!(time > layer.inPoint && time < layer.outPoint)) {
            throw new Error("time " + args.time + " must be inside the layer (between " + layer.inPoint + " and " + layer.outPoint + ")");
        }
        var originalOut = layer.outPoint;
        var copy = layer.duplicate();
        layer.outPoint = time;
        copy.inPoint = time;
        copy.outPoint = originalOut; // setting inPoint slides outPoint too, so put it back
        return JSON.stringify({
            status: "success", message: "Layer split at " + time + "s",
            first: { name: layer.name, index: layer.index, inPoint: layer.inPoint, outPoint: layer.outPoint },
            second: { name: copy.name, index: copy.index, inPoint: copy.inPoint, outPoint: copy.outPoint }
        }, null, 2);
    } catch (error) { return fail(error); }
}

// --- setAnchorPoint ---
// {compName?, layerIndex|layerName, anchorPoint [x,y(,z)] | anchorPreset "center", keepPosition? (default true)}
// keepPosition moves Position so the layer does not shift on screen (accounts for scale and rotation).
function setAnchorPoint(args) {
    try {
        var target = resolveTarget(args);
        var layer = target.layer, comp = target.comp;
        var transform = layer.property("Transform");
        var anchorProp = transform.property("Anchor Point");
        var posProp = transform.property("Position");
        var oldA = anchorProp.value;
        var newA;
        if (args.anchorPreset) {
            if (args.anchorPreset !== "center") { throw new Error("anchorPreset must be \"center\""); }
            var rect = layer.sourceRectAtTime(comp.time, false);
            newA = [rect.left + rect.width / 2, rect.top + rect.height / 2];
        } else if (args.anchorPoint && args.anchorPoint.length >= 2) {
            newA = [Number(args.anchorPoint[0]), Number(args.anchorPoint[1])];
            if (args.anchorPoint.length > 2) { newA.push(Number(args.anchorPoint[2])); }
        } else {
            throw new Error("Give anchorPoint [x, y] or anchorPreset \"center\"");
        }
        if (oldA.length > 2 && newA.length === 2) { newA.push(oldA[2]); }

        if (args.keepPosition !== false) {
            if (layer.threeDLayer) { throw new Error("keepPosition is not supported for 3D layers; pass keepPosition: false"); }
            if (anchorProp.numKeys > 0 || anchorProp.expressionEnabled || posProp.numKeys > 0 || posProp.expressionEnabled) {
                throw new Error("Anchor Point or Position is animated; pass keepPosition: false to set the anchor only");
            }
            var scale = transform.property("Scale").value;
            var rot = transform.property("Rotation").value * Math.PI / 180;
            var dx = (newA[0] - oldA[0]) * scale[0] / 100;
            var dy = (newA[1] - oldA[1]) * scale[1] / 100;
            var pos = posProp.value;
            var moved = [pos[0] + dx * Math.cos(rot) - dy * Math.sin(rot), pos[1] + dx * Math.sin(rot) + dy * Math.cos(rot)];
            if (pos.length > 2) { moved.push(pos[2]); }
            posProp.setValue(moved);
        }
        anchorProp.setValue(newA);
        return JSON.stringify({
            status: "success", message: "Anchor point set",
            layer: { name: layer.name, index: layer.index },
            anchorPoint: anchorProp.value, position: posProp.value
        }, null, 2);
    } catch (error) { return fail(error); }
}

// --- setLayerFlags ---
// {compName?, layerIndex|layerName, locked?, shy?, solo?, guideLayer?, motionBlur?, adjustmentLayer?,
//  collapseTransformation?, preserveTransparency?, label? (0-16)}
function setLayerFlags(args) {
    try {
        var layer = resolveTarget(args).layer;
        var names = ["locked", "shy", "solo", "guideLayer", "motionBlur", "adjustmentLayer", "collapseTransformation", "preserveTransparency", "label"];
        var applied = [], unsupported = [];
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            if (!isSet(args[name])) { continue; }
            try {
                if (name === "label") {
                    var label = parseInt(args.label, 10);
                    if (!(label >= 0 && label <= 16)) { throw new Error("label must be 0-16"); }
                    layer.label = label;
                } else {
                    layer[name] = !!args[name];
                }
                applied.push(name);
            } catch (e) { unsupported.push(name + ": " + e.toString()); }
        }
        if (applied.length === 0 && unsupported.length === 0) { throw new Error("Nothing to change: give one of " + names.join(", ")); }
        var flags = {};
        for (var j = 0; j < names.length; j++) { try { flags[names[j]] = layer[names[j]]; } catch (e2) {} }
        return JSON.stringify({ status: unsupported.length > 0 && applied.length === 0 ? "error" : "success", message: "Layer flags updated", layer: { name: layer.name, index: layer.index }, applied: applied, unsupported: unsupported, flags: flags }, null, 2);
    } catch (error) { return fail(error); }
}

// --- renameLayer ---
function renameLayer(args) {
    try {
        var layer = resolveTarget(args).layer;
        if (!args.newName) { throw new Error("newName is required"); }
        var oldName = layer.name;
        layer.name = String(args.newName);
        return JSON.stringify({ status: "success", message: "Layer renamed", layer: { oldName: oldName, name: layer.name, index: layer.index } }, null, 2);
    } catch (error) { return fail(error); }
}

// --- Markers ---
// A layer marker if layerIndex/layerName is given, otherwise a marker on the comp itself.
function resolveMarkerTarget(args) {
    var t = resolveTarget(args, false);
    var prop = hasLayerRef(args) ? resolveLayer(t.comp, args.layerIndex, args.layerName || "").marker : t.comp.markerProperty;
    return { comp: t.comp, prop: prop, owner: hasLayerRef(args) ? "layer" : "comp" };
}

function markerInfo(prop, k) {
    var mv = prop.keyValue(k);
    var info = { index: k, time: prop.keyTime(k), comment: mv.comment, duration: mv.duration };
    try { info.chapter = mv.chapter; info.url = mv.url; info.label = mv.label; } catch (e) {}
    return info;
}

// {compName?, layerIndex|layerName? (omit for a comp marker), time, comment?, duration?, label? (0-16), chapter?, url?}
function addMarker(args) {
    try {
        var target = resolveMarkerTarget(args);
        if (!isSet(args.time) || !(Number(args.time) >= 0)) { throw new Error("time (seconds, 0 or more) is required"); }
        var mv = new MarkerValue(args.comment ? String(args.comment) : "");
        if (isSet(args.duration)) { mv.duration = Number(args.duration); }
        if (isSet(args.label)) { try { mv.label = parseInt(args.label, 10); } catch (e1) {} }
        if (args.chapter) { mv.chapter = String(args.chapter); }
        if (args.url) { mv.url = String(args.url); }
        target.prop.setValueAtTime(Number(args.time), mv);
        return JSON.stringify({ status: "success", message: "Marker added to the " + target.owner, markers: target.prop.numKeys }, null, 2);
    } catch (error) { return fail(error); }
}

function getMarkers(args) {
    try {
        var target = resolveMarkerTarget(args);
        var markers = [];
        for (var k = 1; k <= target.prop.numKeys; k++) { markers.push(markerInfo(target.prop, k)); }
        return JSON.stringify({ status: "success", owner: target.owner, markers: markers }, null, 2);
    } catch (error) { return fail(error); }
}

// plus ONE of: all (true), indices [..], time (seconds, must hit a marker)
function removeMarkers(args) {
    try {
        var target = resolveMarkerTarget(args);
        var prop = target.prop;
        var before = prop.numKeys;
        var hasIndices = args.indices && args.indices.length > 0;
        if (!args.all && !isSet(args.time) && !hasIndices) { throw new Error("Specify one of: all (true), indices, or time"); }
        var which = [];
        if (args.all) { for (var a = 1; a <= before; a++) { which.push(a); } }
        else if (isSet(args.time)) {
            if (before === 0) { throw new Error("There are no markers"); }
            var nearest = prop.nearestKeyIndex(Number(args.time));
            if (Math.abs(prop.keyTime(nearest) - Number(args.time)) > target.comp.frameDuration / 2) {
                throw new Error("No marker at " + args.time + "s (nearest is #" + nearest + " at " + prop.keyTime(nearest) + "s)");
            }
            which.push(nearest);
        } else { which = args.indices.slice(0); }
        for (var c = 0; c < which.length; c++) { if (which[c] < 1 || which[c] > before) { throw new Error("Marker index out of range: " + which[c] + " (there are " + before + ")"); } }
        which.sort(function (x, y) { return y - x; });
        for (var d = 0; d < which.length; d++) { if (d > 0 && which[d] === which[d - 1]) { continue; } prop.removeKey(which[d]); }
        return JSON.stringify({ status: "success", message: "Markers removed", before: before, after: prop.numKeys }, null, 2);
    } catch (error) { return fail(error); }
}

// --- Generic property access (shapes, text, masks, anything) ---
function propertyKind(p) {
    if (p.propertyType === PropertyType.PROPERTY) { return "property"; }
    if (p.propertyType === PropertyType.INDEXED_GROUP) { return "indexed-group"; }
    return "group";
}

function valueTypeName(p) {
    var t = p.propertyValueType;
    if (t === PropertyValueType.NO_VALUE) { return "none"; }
    if (t === PropertyValueType.ThreeD_SPATIAL) { return "3d-spatial"; }
    if (t === PropertyValueType.ThreeD) { return "3d"; }
    if (t === PropertyValueType.TwoD_SPATIAL) { return "2d-spatial"; }
    if (t === PropertyValueType.TwoD) { return "2d"; }
    if (t === PropertyValueType.OneD) { return "1d"; }
    if (t === PropertyValueType.COLOR) { return "color"; }
    if (t === PropertyValueType.CUSTOM_VALUE) { return "custom"; }
    if (t === PropertyValueType.MARKER) { return "marker"; }
    if (t === PropertyValueType.LAYER_INDEX) { return "layer-index"; }
    if (t === PropertyValueType.MASK_INDEX) { return "mask-index"; }
    if (t === PropertyValueType.SHAPE) { return "shape"; }
    if (t === PropertyValueType.TEXT_DOCUMENT) { return "text-document"; }
    return "unknown";
}

function childNames(node) {
    var names = [];
    try { for (var i = 1; i <= node.numProperties; i++) { names.push(node.property(i).name); } } catch (e) {}
    return names;
}

// Follow a path of property names/matchNames from the layer down, e.g. ["Contents","Group 1","Contents","Fill 1","Color"]
function walkPropertyPath(layer, path) {
    var node = layer;
    for (var i = 0; i < path.length; i++) {
        var next = node.property(path[i]);
        if (!next) {
            throw new Error("Property path step " + (i + 1) + " '" + path[i] + "' not found. Available here: " + childNames(node).join(", "));
        }
        node = next;
    }
    return node;
}

function describeNode(p, index) {
    var info = { index: index, name: p.name, matchName: p.matchName, kind: propertyKind(p) };
    if (info.kind === "property") {
        info.valueType = valueTypeName(p);
        var vt = info.valueType;
        if (vt !== "none" && vt !== "custom" && vt !== "shape" && vt !== "text-document" && vt !== "marker") { info.value = safePropertyValue(p); }
        info.numKeyframes = p.numKeys;
        if (p.expressionEnabled) { info.expression = p.expression; }
    } else {
        info.numChildren = p.numProperties;
    }
    return info;
}

// {compName?, layerIndex|layerName, propertyPath? (names/matchNames from the layer; default: the layer's top level)}
// Lists one level of the property tree so paths for setProperty / addShapeContent can be discovered.
function listLayerProperties(args) {
    try {
        var layer = resolveTarget(args).layer;
        var path = args.propertyPath && args.propertyPath.length ? args.propertyPath : [];
        var node = path.length ? walkPropertyPath(layer, path) : layer;
        var entries = [];
        if (path.length && node.propertyType === PropertyType.PROPERTY) {
            entries.push(describeNode(node, node.propertyIndex));
        } else {
            for (var i = 1; i <= node.numProperties; i++) { try { entries.push(describeNode(node.property(i), i)); } catch (e) {} }
        }
        return JSON.stringify({ status: "success", layer: { name: layer.name, index: layer.index }, path: path, properties: entries }, null, 2);
    } catch (error) { return fail(error); }
}

function normalizeValue(prop, value) {
    if (typeof value === "boolean") { return value ? 1 : 0; }
    if (prop.propertyValueType === PropertyValueType.COLOR && value instanceof Array && value.length === 3) { return [value[0], value[1], value[2], 1]; }
    return value;
}

// {compName?, layerIndex|layerName, propertyPath? | propertyName (+ effectName?), value, time? (set a keyframe at this time)}
function setProperty(args) {
    try {
        var layer = resolveTarget(args).layer;
        var prop;
        if (args.propertyPath && args.propertyPath.length) { prop = walkPropertyPath(layer, args.propertyPath); }
        else if (args.propertyName) {
            prop = findLayerProperty(layer, args.propertyName, args.effectName);
            if (!prop) { throw new Error("Property '" + args.propertyName + "' not found on layer '" + layer.name + "' (use listLayerProperties to find its path)"); }
        } else { throw new Error("Give propertyPath or propertyName"); }
        if (prop.propertyType !== PropertyType.PROPERTY) { throw new Error("'" + prop.name + "' is a group, not a value. Go one level deeper (see listLayerProperties)"); }
        if (args.value === undefined) { throw new Error("value is required"); }
        if (prop.matchName === "ADBE Text Document") { throw new Error("Use setTextDocument for the text itself"); }
        var oldValue = safePropertyValue(prop);
        var value = normalizeValue(prop, args.value);
        if (isSet(args.time)) { prop.setValueAtTime(Number(args.time), value); }
        else {
            if (prop.numKeys > 0) { throw new Error("'" + prop.name + "' has " + prop.numKeys + " keyframes: pass time to add one, or remove them first"); }
            prop.setValue(value);
        }
        return JSON.stringify({
            status: "success", message: "Property set",
            property: { name: prop.name, matchName: prop.matchName, oldValue: oldValue, newValue: safePropertyValue(prop), keyframes: prop.numKeys, expressionEnabled: prop.expressionEnabled }
        }, null, 2);
    } catch (error) { return fail(error); }
}

// --- addShapeContent: add a path, fill, stroke or modifier to a shape layer ---
// {compName?, layerIndex|layerName, type, groupPath? (path to the Contents to add into; default: the layer's Contents),
//  name?, properties? ({"Color": [1,0,0], ...})}
var shapeContentTypes = {
    group: "ADBE Vector Group",
    rectangle: "ADBE Vector Shape - Rect",
    ellipse: "ADBE Vector Shape - Ellipse",
    star: "ADBE Vector Shape - Star",
    polygon: "ADBE Vector Shape - Star",
    fill: "ADBE Vector Graphic - Fill",
    stroke: "ADBE Vector Graphic - Stroke",
    gradientFill: "ADBE Vector Graphic - G-Fill",
    trimPaths: "ADBE Vector Filter - Trim",
    roundCorners: "ADBE Vector Filter - RC",
    repeater: "ADBE Vector Filter - Repeater"
};

function addShapeContent(args) {
    var added = null;
    try {
        var layer = resolveTarget(args).layer;
        var matchName = shapeContentTypes[args.type];
        if (!matchName) {
            var known = [];
            for (var k in shapeContentTypes) { if (shapeContentTypes.hasOwnProperty(k)) { known.push(k); } }
            throw new Error("type must be one of: " + known.join(", "));
        }
        var container = (args.groupPath && args.groupPath.length) ? walkPropertyPath(layer, args.groupPath) : layer.property("Contents");
        if (!container) { throw new Error("Layer '" + layer.name + "' has no Contents: it is not a shape layer"); }
        if (!container.canAddProperty(matchName)) {
            throw new Error("Cannot add a " + args.type + " there. Point groupPath at a group's Contents, e.g. [\"Contents\",\"Group 1\",\"Contents\"] (see listLayerProperties)");
        }
        added = container.addProperty(matchName);
        if (args.type === "polygon") { added.property("Type").setValue(1); }
        else if (args.type === "star") { added.property("Type").setValue(2); }
        if (args.name) { added.name = String(args.name); }
        var set = [];
        if (args.properties) {
            for (var pname in args.properties) {
                if (!args.properties.hasOwnProperty(pname)) { continue; }
                var p = findPropertyInsideGroup(added, pname);
                if (!p) { throw new Error("The new " + args.type + " has no property '" + pname + "'. It has: " + childNames(added).join(", ")); }
                p.setValue(normalizeValue(p, args.properties[pname]));
                set.push(pname);
            }
        }
        return JSON.stringify({
            status: "success", message: "Added " + args.type,
            added: { name: added.name, matchName: added.matchName, index: added.propertyIndex },
            propertiesSet: set
        }, null, 2);
    } catch (error) {
        // Do not leave half-configured content behind
        if (added) { try { added.remove(); } catch (removeError) {} }
        return fail(error);
    }
}

// --- setTextDocument: edit the text, font and paragraph of a text layer ---
// {compName?, layerIndex|layerName, text?, font? (PostScript name), fontSize?, fillColor? [r,g,b], strokeColor?, strokeWidth?,
//  tracking?, leading?, justification? ("left"|"center"|"right"|"justify"), fauxBold?, fauxItalic?, allCaps?, smallCaps?}
function setTextDocument(args) {
    try {
        var layer = resolveTarget(args).layer;
        var textGroup = layer.property("ADBE Text Properties");
        var textProp = textGroup ? textGroup.property("ADBE Text Document") : null;
        if (!textProp) { throw new Error("Layer '" + layer.name + "' is not a text layer"); }
        if (textProp.numKeys > 0) { throw new Error("The text has keyframes; remove them before editing it"); }
        var doc = textProp.value;
        var changed = [];
        if (isSet(args.text)) { doc.text = String(args.text); changed.push("text"); }
        if (args.font) { doc.font = String(args.font); changed.push("font"); }
        if (isSet(args.fontSize)) { doc.fontSize = Number(args.fontSize); changed.push("fontSize"); }
        if (args.fillColor) { doc.fillColor = [Number(args.fillColor[0]), Number(args.fillColor[1]), Number(args.fillColor[2])]; doc.applyFill = true; changed.push("fillColor"); }
        if (args.strokeColor) { doc.strokeColor = [Number(args.strokeColor[0]), Number(args.strokeColor[1]), Number(args.strokeColor[2])]; doc.applyStroke = true; changed.push("strokeColor"); }
        if (isSet(args.strokeWidth)) { doc.strokeWidth = Number(args.strokeWidth); doc.applyStroke = Number(args.strokeWidth) > 0; changed.push("strokeWidth"); }
        if (isSet(args.tracking)) { doc.tracking = Number(args.tracking); changed.push("tracking"); }
        if (isSet(args.leading)) { doc.autoLeading = false; doc.leading = Number(args.leading); changed.push("leading"); }
        if (args.justification) {
            var j = { left: ParagraphJustification.LEFT_JUSTIFY, center: ParagraphJustification.CENTER_JUSTIFY, right: ParagraphJustification.RIGHT_JUSTIFY, justify: ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT }[args.justification];
            if (j === undefined) { throw new Error("justification must be left, center, right or justify"); }
            doc.justification = j;
            changed.push("justification");
        }
        var bools = ["fauxBold", "fauxItalic", "allCaps", "smallCaps"];
        for (var b = 0; b < bools.length; b++) { if (isSet(args[bools[b]])) { doc[bools[b]] = !!args[bools[b]]; changed.push(bools[b]); } }
        if (changed.length === 0) { throw new Error("Nothing to change: give text, font, fontSize, fillColor, strokeColor, strokeWidth, tracking, leading, justification, fauxBold, fauxItalic, allCaps or smallCaps"); }
        textProp.setValue(doc);
        var now = textProp.value;
        return JSON.stringify({
            status: "success", message: "Text updated",
            layer: { name: layer.name, index: layer.index },
            changed: changed,
            text: { text: now.text, font: now.font, fontSize: now.fontSize, fillColor: now.fillColor, tracking: now.tracking }
        }, null, 2);
    } catch (error) { return fail(error); }
}

// --- Project panel ---
function projectItemType(item) {
    if (item instanceof CompItem) { return "composition"; }
    if (item instanceof FolderItem) { return "folder"; }
    if (item instanceof FootageItem && item.mainSource instanceof SolidSource) { return "solid"; }
    return "footage";
}

// Find a project item by id, or by exact name (an error if the name is ambiguous, listing the ids)
function resolveProjectItemRef(id, name, what) {
    var i;
    if (isSet(id)) {
        for (i = 1; i <= app.project.numItems; i++) { if (app.project.item(i).id === Number(id)) { return app.project.item(i); } }
        throw new Error(what + " with id " + id + " not found");
    }
    if (name) {
        var matches = [];
        for (i = 1; i <= app.project.numItems; i++) { if (app.project.item(i).name === name) { matches.push(app.project.item(i)); } }
        if (matches.length === 0) { throw new Error(what + " not found: '" + name + "'"); }
        if (matches.length > 1) {
            var ids = [];
            for (var m = 0; m < matches.length; m++) { ids.push(matches[m].id + " (" + projectItemType(matches[m]) + ")"); }
            throw new Error("More than one item is named '" + name + "': ids " + ids.join(", ") + ". Pass an id (see getProjectTree)");
        }
        return matches[0];
    }
    throw new Error("Provide the " + what + "'s id or name");
}

function resolveFolderOrRoot(id, name) {
    if (!isSet(id) && !name) { return app.project.rootFolder; }
    var folder = resolveProjectItemRef(id, name, "Folder");
    if (!(folder instanceof FolderItem)) { throw new Error("'" + folder.name + "' is not a folder"); }
    return folder;
}

function treeNode(item, depth, maxDepth) {
    var node = { id: item.id, name: item.name, type: projectItemType(item), label: item.label };
    if (item.comment) { node.comment = item.comment; }
    if (item instanceof CompItem) {
        node.width = item.width; node.height = item.height; node.duration = item.duration; node.frameRate = item.frameRate; node.numLayers = item.numLayers;
    } else if (item instanceof FootageItem && !(item.mainSource instanceof SolidSource)) {
        try { if (item.file) { node.path = item.file.fsName; } } catch (e) {}
    }
    if (item instanceof FolderItem) {
        node.numItems = item.numItems;
        if (depth < maxDepth) {
            node.children = [];
            for (var i = 1; i <= item.numItems; i++) { node.children.push(treeNode(item.item(i), depth + 1, maxDepth)); }
        }
    }
    return node;
}

// {folderName|folderId? (default: the project root), maxDepth? (default 20)}
function getProjectTree(args) {
    try {
        args = args || {};
        var folder = resolveFolderOrRoot(args.folderId, args.folderName);
        var tree = treeNode(folder, 0, isSet(args.maxDepth) ? Number(args.maxDepth) : 20);
        if (folder === app.project.rootFolder) { tree.name = "(project root)"; }
        return JSON.stringify({ status: "success", tree: tree }, null, 2);
    } catch (error) { return fail(error); }
}

// {name, parentFolderName|parentFolderId? (default: the project root)}
function createFolder(args) {
    try {
        if (!args.name) { throw new Error("name is required"); }
        var parent = resolveFolderOrRoot(args.parentFolderId, args.parentFolderName);
        var folder = app.project.items.addFolder(String(args.name));
        if (parent !== app.project.rootFolder) { folder.parentFolder = parent; }
        return JSON.stringify({ status: "success", message: "Folder created", folder: { id: folder.id, name: folder.name }, parent: { id: parent.id, name: parent === app.project.rootFolder ? "(project root)" : parent.name } }, null, 2);
    } catch (error) { return fail(error); }
}

// {itemIds? [..] | itemNames? [..] | namePrefix? (min 4 chars), toFolderName|toFolderId? (default: the project root)}
function moveProjectItems(args) {
    try {
        var dest = resolveFolderOrRoot(args.toFolderId, args.toFolderName);
        var items = [], i;
        if (args.itemIds && args.itemIds.length) { for (i = 0; i < args.itemIds.length; i++) { items.push(resolveProjectItemRef(args.itemIds[i], null, "Item")); } }
        else if (args.itemNames && args.itemNames.length) { for (i = 0; i < args.itemNames.length; i++) { items.push(resolveProjectItemRef(null, args.itemNames[i], "Item")); } }
        else if (args.namePrefix) {
            if (String(args.namePrefix).length < 4) { throw new Error("namePrefix must be at least 4 characters"); }
            for (i = 1; i <= app.project.numItems; i++) { if (app.project.item(i).name.indexOf(args.namePrefix) === 0 && app.project.item(i) !== dest) { items.push(app.project.item(i)); } }
            if (items.length === 0) { throw new Error("No items start with '" + args.namePrefix + "'"); }
        } else { throw new Error("Give itemIds, itemNames or namePrefix"); }

        // Check everything before moving anything: a folder cannot go inside itself or one of its own subfolders
        for (i = 0; i < items.length; i++) {
            if (items[i] === dest) { throw new Error("Cannot move folder '" + dest.name + "' into itself"); }
            if (items[i] instanceof FolderItem) {
                var up = dest;
                while (up && up !== app.project.rootFolder) {
                    if (up === items[i]) { throw new Error("Cannot move folder '" + items[i].name + "' into its own subfolder '" + dest.name + "'"); }
                    up = up.parentFolder;
                }
            }
        }
        var moved = [];
        for (i = 0; i < items.length; i++) { items[i].parentFolder = dest; moved.push({ id: items[i].id, name: items[i].name }); }
        return JSON.stringify({ status: "success", message: "Moved " + moved.length + " item(s)", moved: moved, toFolder: { id: dest.id, name: dest === app.project.rootFolder ? "(project root)" : dest.name } }, null, 2);
    } catch (error) { return fail(error); }
}

// {itemId|itemName, newName?, label? (0-16), comment?}
function setProjectItemProperties(args) {
    try {
        var item = resolveProjectItemRef(args.itemId, args.itemName, "Item");
        var changed = [];
        if (isSet(args.newName)) { if (!args.newName) { throw new Error("newName cannot be empty"); } item.name = String(args.newName); changed.push("name"); }
        if (isSet(args.label)) {
            var label = parseInt(args.label, 10);
            if (!(label >= 0 && label <= 16)) { throw new Error("label must be 0-16"); }
            item.label = label; changed.push("label");
        }
        if (isSet(args.comment)) { item.comment = String(args.comment); changed.push("comment"); }
        if (changed.length === 0) { throw new Error("Nothing to change: give newName, label or comment"); }
        return JSON.stringify({ status: "success", message: "Item updated", item: { id: item.id, name: item.name, type: projectItemType(item), label: item.label, comment: item.comment }, changed: changed }, null, 2);
    } catch (error) { return fail(error); }
}

// {compName}. Opens the comp in the Composition panel.
function openComp(args) {
    try {
        var comp = findCompByNameStrict(args.compName || "");
        comp.openInViewer();
        return JSON.stringify({ status: "success", message: "Opened in the Composition panel", composition: { id: comp.id, name: comp.name } }, null, 2);
    } catch (error) { return fail(error); }
}

// {compName?, layerIndex|layerName, sourceItemName|sourceItemId, fixExpressions? (default false)}
function replaceLayerSource(args) {
    try {
        var layer = resolveTarget(args).layer;
        var item = resolveProjectItemRef(args.sourceItemId, args.sourceItemName, "Source item");
        if (!(item instanceof CompItem) && !(item instanceof FootageItem)) { throw new Error("'" + item.name + "' cannot be used as a layer source"); }
        var oldName = layer.source ? layer.source.name : null;
        layer.replaceSource(item, !!args.fixExpressions);
        return JSON.stringify({ status: "success", message: "Layer source replaced", layer: { name: layer.name, index: layer.index }, source: { oldName: oldName, name: layer.source ? layer.source.name : null } }, null, 2);
    } catch (error) { return fail(error); }
}

// --- deleteProjectItems: remove comps and footage/solids whose names start with a prefix ---
// {namePrefix (at least 4 characters), dryRun?, includeFolders?}. Removing an item also removes every layer that uses it.
// Folders are kept unless includeFolders is true, and then only those that are empty once the items are gone.
// Meant for cleaning up scratch items (e.g. the test harness's "MCPTEST_" items).
function deleteProjectItems(args) {
    try {
        var prefix = args.namePrefix ? String(args.namePrefix) : "";
        if (prefix.length < 4) { throw new Error("namePrefix is required and must be at least 4 characters, so this cannot match everything"); }
        var matches = [];
        var folders = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item.name.indexOf(prefix) !== 0) { continue; }
            if (item instanceof FolderItem) { folders.push(item); } else { matches.push(item); }
        }
        var names = [];
        for (var j = 0; j < matches.length; j++) { names.push(matches[j].name); }
        var foldersRemoved = [], foldersKept = [];
        if (!args.dryRun) {
            for (var k = 0; k < matches.length; k++) { try { matches[k].remove(); } catch (removeError) {} }
            if (args.includeFolders) {
                // Repeat so a prefixed folder inside another prefixed folder goes first
                for (var pass = 0; pass < 5 && folders.length > 0; pass++) {
                    var remaining = [];
                    for (var f = 0; f < folders.length; f++) {
                        try {
                            if (folders[f].numItems === 0) { foldersRemoved.push(folders[f].name); folders[f].remove(); }
                            else { remaining.push(folders[f]); }
                        } catch (folderError) { remaining.push(folders[f]); }
                    }
                    folders = remaining;
                }
                for (var r = 0; r < folders.length; r++) { try { foldersKept.push(folders[r].name); } catch (e2) {} }
            }
        } else if (args.includeFolders) {
            for (var d = 0; d < folders.length; d++) { foldersRemoved.push(folders[d].name); }
        }
        return JSON.stringify({
            status: "success",
            message: args.dryRun ? "Dry run: nothing removed" : "Removed " + matches.length + " item(s)",
            items: names,
            foldersRemoved: foldersRemoved,
            foldersKept: foldersKept,
            numItems: app.project.numItems
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- Render queue ---
function renderStatusName(status) {
    if (status === RQItemStatus.WILL_CONTINUE) { return "will-continue"; }
    if (status === RQItemStatus.NEEDS_OUTPUT) { return "needs-output"; }
    if (status === RQItemStatus.UNQUEUED) { return "unqueued"; }
    if (status === RQItemStatus.QUEUED) { return "queued"; }
    if (status === RQItemStatus.RENDERING) { return "rendering"; }
    if (status === RQItemStatus.USER_STOPPED) { return "user-stopped"; }
    if (status === RQItemStatus.ERR_STOPPED) { return "error-stopped"; }
    if (status === RQItemStatus.DONE) { return "done"; }
    return "unknown";
}

function renderQueueItems() {
    var rq = app.project.renderQueue;
    var items = [];
    for (var i = 1; i <= rq.numItems; i++) {
        var it = rq.item(i);
        var info = { index: i, composition: it.comp.name, status: renderStatusName(it.status), render: it.render, outputs: [] };
        try { info.elapsedSeconds = it.elapsedSeconds; } catch (e1) {}
        for (var o = 1; o <= it.numOutputModules; o++) {
            try { info.outputs.push(it.outputModule(o).file ? it.outputModule(o).file.fsName : null); } catch (e2) { info.outputs.push(null); }
        }
        items.push(info);
    }
    return { rendering: rq.rendering, numItems: rq.numItems, items: items };
}

function getRenderStatus() {
    try {
        var st = renderQueueItems();
        st.status = "success";
        return JSON.stringify(st, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// Renders everything queued. This BLOCKS After Effects (and this bridge) until the render finishes; the result is
// written afterwards, so a long render will outlast the MCP server's wait. Check with getRenderStatus / get-results.
function startRender() {
    try {
        var rq = app.project.renderQueue;
        var queued = 0;
        for (var i = 1; i <= rq.numItems; i++) { if (rq.item(i).status === RQItemStatus.QUEUED) { queued++; } }
        if (queued === 0) { throw new Error("Nothing queued to render (use addToRenderQueue first)"); }
        rq.render();
        var st = renderQueueItems();
        st.status = "success";
        st.message = "Render finished (" + queued + " item(s) were queued)";
        return JSON.stringify(st, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// ExtendScript is ES3 and has no Date.prototype.toISOString
function isoTimestamp(d) {
    function pad(n, w) { var t = String(n); while (t.length < w) { t = "0" + t; } return t; }
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1, 2) + "-" + pad(d.getUTCDate(), 2) + "T" +
        pad(d.getUTCHours(), 2) + ":" + pad(d.getUTCMinutes(), 2) + ":" + pad(d.getUTCSeconds(), 2) + "." + pad(d.getUTCMilliseconds(), 3) + "Z";
}

// ===== Bridge version, keyframe easing, context and discovery tools =====

// A fingerprint of this script's own file (FNV-1a over its ASCII characters, ignoring carriage returns). The server
// computes the same value from the script it ships, so a stale installed panel is detected without anyone bumping a
// version number. "unknown" if the file cannot be read.
function computeBridgeVersion() {
    try {
        var f = new File($.fileName);
        f.encoding = "UTF-8";
        if (!f.open("r")) { return "unknown"; }
        var text = f.read();
        f.close();
        var h = 2166136261;
        for (var i = 0; i < text.length; i++) {
            var c = text.charCodeAt(i);
            if (c > 127 || c === 13) { continue; }
            h ^= c;
            h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
        }
        return h.toString(16);
    } catch (e) { return "unknown"; }
}
var BRIDGE_VERSION = computeBridgeVersion();

function getCapabilities() {
    var names = [];
    for (var name in commandTable) { if (commandTable.hasOwnProperty(name)) { names.push(name); } }
    names.sort();
    return JSON.stringify({ status: "success", protocol: 2, bridgeVersion: BRIDGE_VERSION, aeVersion: app.version, commands: names }, null, 2);
}

// --- Keyframe easing, copying and offsetting ---

// Find the property a command refers to: propertyPath, or propertyName (+ effectName)
function resolveProperty(layer, args) {
    if (args.propertyPath && args.propertyPath.length) { return walkPropertyPath(layer, args.propertyPath); }
    if (args.propertyName) {
        var prop = findLayerProperty(layer, args.propertyName, args.effectName);
        if (!prop) { throw new Error("Property '" + args.propertyName + "' not found on layer '" + layer.name + "' (use listLayerProperties to find its path)"); }
        return prop;
    }
    throw new Error("Give propertyPath or propertyName");
}

// Which keyframes a command applies to: all, keyIndices [..], or time (must hit a key). One of them is required.
function selectKeyIndices(prop, args, comp) {
    var n = prop.numKeys;
    if (n === 0) { throw new Error("Property '" + prop.name + "' has no keyframes"); }
    var picked = [], i;
    if (args.all) { for (i = 1; i <= n; i++) { picked.push(i); } }
    else if (args.keyIndices && args.keyIndices.length) {
        for (i = 0; i < args.keyIndices.length; i++) {
            var k = parseInt(args.keyIndices[i], 10);
            if (!(k >= 1 && k <= n)) { throw new Error("Keyframe index out of range: " + args.keyIndices[i] + " (property has " + n + ")"); }
            picked.push(k);
        }
    } else if (isSet(args.time)) {
        var nearest = prop.nearestKeyIndex(Number(args.time));
        if (Math.abs(prop.keyTime(nearest) - Number(args.time)) > comp.frameDuration / 2) {
            throw new Error("No keyframe at " + args.time + "s (nearest is #" + nearest + " at " + prop.keyTime(nearest) + "s)");
        }
        picked.push(nearest);
    } else { throw new Error("Specify which keyframes: all (true), keyIndices, or time"); }
    return picked;
}

function readKeyData(prop, indices) {
    var keys = [];
    for (var i = 0; i < indices.length; i++) {
        var k = indices[i];
        var key = { time: prop.keyTime(k), value: prop.keyValue(k), inType: prop.keyInInterpolationType(k), outType: prop.keyOutInterpolationType(k) };
        try { key.inEase = prop.keyInTemporalEase(k); key.outEase = prop.keyOutTemporalEase(k); } catch (e) {}
        keys.push(key);
    }
    return keys;
}

// Write keys (shifted by offset seconds) into a property, restoring each key's interpolation and ease
function writeKeyData(prop, keys, offset) {
    var i;
    for (i = 0; i < keys.length; i++) { prop.setValueAtTime(keys[i].time + offset, keys[i].value); }
    for (i = 0; i < keys.length; i++) {
        var idx = prop.nearestKeyIndex(keys[i].time + offset);
        // Ease first, interpolation types last: setting an ease turns that side bezier, which would undo hold and linear
        try { if (keys[i].inEase && keys[i].outEase) { prop.setTemporalEaseAtKey(idx, keys[i].inEase, keys[i].outEase); } } catch (e) {}
        try { prop.setInterpolationTypeAtKey(idx, keys[i].inType, keys[i].outType); } catch (e2) {}
    }
}

function easeSummary(eases) {
    var out = [];
    for (var i = 0; i < eases.length; i++) { out.push({ speed: eases[i].speed, influence: eases[i].influence }); }
    return out;
}

function makeEases(count, speed, influence) {
    var eases = [];
    for (var i = 0; i < count; i++) { eases.push(new KeyframeEase(speed, influence)); }
    return eases;
}

// {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?), all | keyIndices | time,
//  preset ("easyEase"|"easyEaseIn"|"easyEaseOut"|"linear"|"hold"|"bezier"), inSpeed?, inInfluence?, outSpeed?, outInfluence?}
// "bezier" with no numbers is the same as easyEase; give speeds/influences (influence 0.1-100) for a custom curve.
function setKeyframeEase(args) {
    try {
        var target = resolveTarget(args);
        var prop = resolveProperty(target.layer, args);
        var presets = { easyEase: 1, easyEaseIn: 1, easyEaseOut: 1, linear: 1, hold: 1, bezier: 1 };
        if (!args.preset || !presets.hasOwnProperty(args.preset)) { throw new Error("preset must be one of: easyEase, easyEaseIn, easyEaseOut, linear, hold, bezier"); }
        if (!prop.canVaryOverTime) { throw new Error("'" + prop.name + "' cannot be keyframed"); }
        var indices = selectKeyIndices(prop, args, target.comp);
        var inSpeed = isSet(args.inSpeed) ? Number(args.inSpeed) : 0, outSpeed = isSet(args.outSpeed) ? Number(args.outSpeed) : 0;
        var inInfl = isSet(args.inInfluence) ? Number(args.inInfluence) : 33.333333, outInfl = isSet(args.outInfluence) ? Number(args.outInfluence) : 33.333333;
        if (!(inInfl >= 0.1 && inInfl <= 100 && outInfl >= 0.1 && outInfl <= 100)) { throw new Error("influence must be between 0.1 and 100"); }

        var done = [];
        for (var i = 0; i < indices.length; i++) {
            var k = indices[i];
            var inType = prop.keyInInterpolationType(k), outType = prop.keyOutInterpolationType(k);
            var dims = prop.keyInTemporalEase(k).length;
            var p = args.preset;
            var setIn = (p === "easyEase" || p === "easyEaseIn" || p === "bezier");
            var setOut = (p === "easyEase" || p === "easyEaseOut" || p === "bezier");
            var useNumbers = (p === "bezier");
            if (p === "linear") { inType = KeyframeInterpolationType.LINEAR; outType = KeyframeInterpolationType.LINEAR; }
            else if (p === "hold") { outType = KeyframeInterpolationType.HOLD; }
            else {
                if (setIn) { inType = KeyframeInterpolationType.BEZIER; }
                if (setOut) { outType = KeyframeInterpolationType.BEZIER; }
            }
            // Setting an ease turns that side bezier, so set the ease first and the interpolation types last
            if (setIn && setOut) { prop.setTemporalEaseAtKey(k, makeEases(dims, useNumbers ? inSpeed : 0, useNumbers ? inInfl : 33.333333), makeEases(dims, useNumbers ? outSpeed : 0, useNumbers ? outInfl : 33.333333)); }
            else if (setIn) { prop.setTemporalEaseAtKey(k, makeEases(dims, 0, 33.333333)); }
            else if (setOut) { prop.setTemporalEaseAtKey(k, prop.keyInTemporalEase(k), makeEases(dims, 0, 33.333333)); }
            prop.setInterpolationTypeAtKey(k, inType, outType);
            done.push({ index: k, time: prop.keyTime(k), inInterpolation: interpolationName(prop.keyInInterpolationType(k)), outInterpolation: interpolationName(prop.keyOutInterpolationType(k)), inEase: easeSummary(prop.keyInTemporalEase(k)), outEase: easeSummary(prop.keyOutTemporalEase(k)) });
        }
        return JSON.stringify({ status: "success", message: "Keyframe ease set (" + args.preset + ")", layer: { name: target.layer.name, index: target.layer.index }, property: { name: prop.name }, keyframes: done }, null, 2);
    } catch (error) { return fail(error); }
}

// {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?), by (seconds, may be negative), all | keyIndices | time}
function offsetKeyframes(args) {
    try {
        var target = resolveTarget(args);
        var prop = resolveProperty(target.layer, args);
        if (!isSet(args.by) || isNaN(Number(args.by))) { throw new Error("by (seconds) is required"); }
        var by = Number(args.by);
        var indices = selectKeyIndices(prop, args, target.comp);
        var keys = readKeyData(prop, indices);
        for (var m = 0; m < keys.length; m++) {
            if (keys[m].time + by < 0) { throw new Error("That would move a keyframe before time 0"); }
        }
        indices.sort(function (x, y) { return y - x; }); // remove from the end so indices stay valid
        for (var r = 0; r < indices.length; r++) { prop.removeKey(indices[r]); }
        writeKeyData(prop, keys, by);
        var times = [];
        for (var k = 1; k <= prop.numKeys; k++) { times.push(prop.keyTime(k)); }
        return JSON.stringify({ status: "success", message: "Moved " + keys.length + " keyframe(s) by " + by + "s", layer: { name: target.layer.name, index: target.layer.index }, property: { name: prop.name, numKeyframes: prop.numKeys, keyTimes: times } }, null, 2);
    } catch (error) { return fail(error); }
}

// {from: {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?)}, to: {same}, timeOffset? (seconds), clear? (remove the target's keys first)}
// Copies every keyframe with its value, interpolation and ease. The two properties must hold the same kind of value.
function copyKeyframes(args) {
    try {
        if (!args.from || !args.to) { throw new Error("from and to are required (each names a comp, layer and property)"); }
        var src = resolveTarget(args.from), dst = resolveTarget(args.to);
        var srcProp = resolveProperty(src.layer, args.from), dstProp = resolveProperty(dst.layer, args.to);
        if (srcProp.numKeys === 0) { throw new Error("The source property has no keyframes"); }
        if (valueTypeName(srcProp) !== valueTypeName(dstProp)) {
            throw new Error("The properties hold different kinds of values (" + valueTypeName(srcProp) + " and " + valueTypeName(dstProp) + ")");
        }
        var offset = isSet(args.timeOffset) ? Number(args.timeOffset) : 0;
        var all = [];
        for (var i = 1; i <= srcProp.numKeys; i++) { all.push(i); }
        var keys = readKeyData(srcProp, all);
        for (var m = 0; m < keys.length; m++) { if (keys[m].time + offset < 0) { throw new Error("That would put a keyframe before time 0"); } }
        if (args.clear) { for (var r = dstProp.numKeys; r >= 1; r--) { dstProp.removeKey(r); } }
        writeKeyData(dstProp, keys, offset);
        return JSON.stringify({ status: "success", message: "Copied " + keys.length + " keyframe(s)", from: { layer: src.layer.name, property: srcProp.name }, to: { layer: dst.layer.name, property: dstProp.name, numKeyframes: dstProp.numKeys } }, null, 2);
    } catch (error) { return fail(error); }
}

// --- Context: what the user is looking at, and the playhead ---
function selectedPropertyInfo(p) {
    var path = [], g = p;
    while (g && g.propertyDepth > 0) { path.unshift(g.name); g = g.parentProperty; }
    var info = { name: p.name, matchName: p.matchName, path: path, kind: propertyKind(p) };
    try { var owner = p.propertyGroup(p.propertyDepth); info.layerIndex = owner.index; info.layerName = owner.name; } catch (e) {}
    try { if (p.propertyType === PropertyType.PROPERTY && p.selectedKeys && p.selectedKeys.length) { info.selectedKeys = p.selectedKeys; } } catch (e2) {}
    return info;
}

// {}. The active comp (with playhead and work area), selected layers, selected properties and selected Project panel items.
function getSelection() {
    try {
        var out = { status: "success", activeComp: null, selectedLayers: [], selectedProperties: [], selectedProjectItems: [] };
        var comp = app.project.activeItem instanceof CompItem ? app.project.activeItem : null;
        var i;
        if (comp) {
            out.activeComp = { name: comp.name, id: comp.id, time: comp.time, frame: Math.round(comp.time / comp.frameDuration), duration: comp.duration, frameRate: comp.frameRate, workAreaStart: comp.workAreaStart, workAreaDuration: comp.workAreaDuration, workAreaEnd: comp.workAreaStart + comp.workAreaDuration };
            var layers = comp.selectedLayers;
            for (i = 0; i < layers.length; i++) { out.selectedLayers.push({ index: layers[i].index, name: layers[i].name }); }
            var props = comp.selectedProperties;
            for (i = 0; i < props.length; i++) { try { out.selectedProperties.push(selectedPropertyInfo(props[i])); } catch (e) {} }
        }
        var items = app.project.selection;
        for (i = 0; i < items.length; i++) { out.selectedProjectItems.push({ id: items[i].id, name: items[i].name, type: projectItemType(items[i]) }); }
        return JSON.stringify(out, null, 2);
    } catch (error) { return fail(error); }
}

// {compName?, layerIndices? [..] | layerNames? [..], additive? (keep the current selection), clear? (just deselect everything)}
function setSelection(args) {
    try {
        var comp = resolveTarget(args, false).comp;
        var i;
        if (!args.additive) { for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; } }
        var picked = [];
        if (args.layerIndices && args.layerIndices.length) {
            for (i = 0; i < args.layerIndices.length; i++) { picked.push(resolveLayer(comp, args.layerIndices[i], "")); }
        } else if (args.layerNames && args.layerNames.length) {
            for (i = 0; i < args.layerNames.length; i++) { picked.push(resolveLayer(comp, null, args.layerNames[i])); }
        } else if (!args.clear) { throw new Error("Give layerIndices or layerNames, or clear: true"); }
        for (i = 0; i < picked.length; i++) { picked[i].selected = true; }
        var now = [];
        for (i = 1; i <= comp.numLayers; i++) { if (comp.layer(i).selected) { now.push({ index: i, name: comp.layer(i).name }); } }
        return JSON.stringify({ status: "success", message: "Selection set", composition: comp.name, selectedLayers: now }, null, 2);
    } catch (error) { return fail(error); }
}

// {compName?, time? (seconds) | frame?}. Moves the playhead.
function setCurrentTime(args) {
    try {
        var comp = resolveTarget(args, false).comp;
        var t;
        if (isSet(args.time)) { t = Number(args.time); }
        else if (isSet(args.frame)) { t = Number(args.frame) * comp.frameDuration; }
        else { throw new Error("Give time (seconds) or frame"); }
        if (!(t >= 0) || t > comp.duration) { throw new Error("That time is outside the comp (0 to " + comp.duration + " seconds)"); }
        comp.time = t;
        return JSON.stringify({ status: "success", message: "Playhead moved", composition: comp.name, time: comp.time, frame: Math.round(comp.time / comp.frameDuration) }, null, 2);
    } catch (error) { return fail(error); }
}

// {compName?, start? (seconds), duration? | end?}. Sets the work area; anything left out stays as it is.
function setWorkArea(args) {
    try {
        var comp = resolveTarget(args, false).comp;
        var start = isSet(args.start) ? Number(args.start) : comp.workAreaStart;
        var duration;
        if (isSet(args.duration)) { duration = Number(args.duration); }
        else if (isSet(args.end)) { duration = Number(args.end) - start; }
        else { duration = comp.workAreaDuration; }
        if (!(start >= 0) || !(duration > 0) || start + duration > comp.duration + comp.frameDuration / 2) {
            throw new Error("The work area must be inside the comp (0 to " + comp.duration + " seconds) and have a positive length");
        }
        // Shorten first when moving later, so the old and new values never overlap illegally
        comp.workAreaDuration = Math.min(duration, comp.duration - comp.workAreaStart);
        comp.workAreaStart = start;
        comp.workAreaDuration = duration;
        return JSON.stringify({ status: "success", message: "Work area set", composition: comp.name, workAreaStart: comp.workAreaStart, workAreaDuration: comp.workAreaDuration, workAreaEnd: comp.workAreaStart + comp.workAreaDuration }, null, 2);
    } catch (error) { return fail(error); }
}

// --- Discovery ---
function matchesQuery(query, parts) {
    if (!query) { return true; }
    var q = String(query).toLowerCase();
    for (var i = 0; i < parts.length; i++) { if (String(parts[i]).toLowerCase().indexOf(q) >= 0) { return true; } }
    return false;
}

// {query? (matches name, match name or category), category?, limit? (default 100, max 500)}
function listEffects(args) {
    try {
        args = args || {};
        var limit = Math.min(isSet(args.limit) ? Number(args.limit) : 100, 500);
        var out = [], total = 0;
        for (var i = 0; i < app.effects.length; i++) {
            var e = app.effects[i];
            if (args.category && String(e.category).toLowerCase() !== String(args.category).toLowerCase()) { continue; }
            if (!matchesQuery(args.query, [e.displayName, e.matchName, e.category])) { continue; }
            total++;
            if (out.length < limit) { out.push({ name: e.displayName, matchName: e.matchName, category: e.category }); }
        }
        return JSON.stringify({ status: "success", total: total, returned: out.length, effects: out }, null, 2);
    } catch (error) { return fail(error); }
}

// {query? (matches font, family, style or PostScript name), limit? (default 100, max 500)}
function listFonts(args) {
    try {
        args = args || {};
        if (!app.fonts || !app.fonts.allFonts) { throw new Error("This version of After Effects cannot list fonts to scripts (needs 24.0 or later)"); }
        var limit = Math.min(isSet(args.limit) ? Number(args.limit) : 100, 500);
        var families = app.fonts.allFonts, out = [], total = 0;
        for (var f = 0; f < families.length; f++) {
            for (var s = 0; s < families[f].length; s++) {
                var font = families[f][s];
                if (!matchesQuery(args.query, [font.postScriptName, font.familyName, font.styleName, font.fullName])) { continue; }
                total++;
                if (out.length < limit) { out.push({ postScriptName: font.postScriptName, family: font.familyName, style: font.styleName }); }
            }
        }
        return JSON.stringify({ status: "success", total: total, returned: out.length, fonts: out }, null, 2);
    } catch (error) { return fail(error); }
}

// {}. Render settings and output module templates, for addToRenderQueue's outputModuleTemplate.
function listRenderTemplates() {
    var temp = null;
    try {
        var rq = app.project.renderQueue;
        var item;
        if (rq.numItems > 0) { item = rq.item(1); }
        else {
            var comp = null;
            for (var i = 1; i <= app.project.numItems && !comp; i++) { if (app.project.item(i) instanceof CompItem) { comp = app.project.item(i); } }
            if (!comp) { throw new Error("The project has no comp, so there is nothing to read the templates through"); }
            temp = rq.items.add(comp); // a queue item is needed to read templates; removed again below
            item = temp;
        }
        var render = [], output = [], t;
        var rt = item.templates, ot = item.outputModule(1).templates;
        for (t = 0; t < rt.length; t++) { if (String(rt[t]).indexOf("_HIDDEN") !== 0) { render.push(rt[t]); } }
        for (t = 0; t < ot.length; t++) { if (String(ot[t]).indexOf("_HIDDEN") !== 0) { output.push(ot[t]); } }
        return JSON.stringify({ status: "success", renderSettingsTemplates: render, outputModuleTemplates: output }, null, 2);
    } catch (error) {
        return fail(error);
    } finally {
        if (temp) { try { temp.remove(); } catch (e) {} }
    }
}

// ===== Expression controls and links, camera and light, project backup =====

function layerTypeName(layer) {
    if (layer instanceof CameraLayer) { return "camera"; }
    if (layer instanceof LightLayer) { return "light"; }
    if (layer instanceof TextLayer) { return "text"; }
    if (layer instanceof ShapeLayer) { return "shape"; }
    if (layer instanceof AVLayer) {
        if (layer.nullLayer) { return "null"; }
        var src = layer.source;
        if (src instanceof CompItem) { return "precomp"; }
        if (src && src.mainSource instanceof SolidSource) { return "solid"; }
        return "footage";
    }
    return "unknown";
}

// --- Property references for expressions ---
function quoteForExpression(text) { return String(text).replace(/\\/g, "\\\\").replace(/"/g, "\\\""); }

// The expression text that reads a property of a layer in the same comp, e.g.
//   thisComp.layer("Controller").effect("Speed")("Slider")
//   thisComp.layer("Box")("ADBE Transform Group")("ADBE Position")
function propertyReference(layer, prop) {
    var chain = [], g = prop;
    while (g && g.propertyDepth > 0) { chain.unshift(g); g = g.parentProperty; }
    var text = 'thisComp.layer("' + quoteForExpression(layer.name) + '")';
    var insideEffect = false;
    for (var i = 0; i < chain.length; i++) {
        var node = chain[i], parent = node.parentProperty;
        if (node.matchName === "ADBE Effect Parade") { continue; } // the .effect("name") form below stands in for this group
        if (parent && parent.matchName === "ADBE Effect Parade") {
            text += '.effect("' + quoteForExpression(node.name) + '")';
            insideEffect = true;
        } else if (insideEffect || (parent && parent.propertyType === PropertyType.INDEXED_GROUP)) {
            text += '("' + quoteForExpression(node.name) + '")';
        } else {
            text += '("' + quoteForExpression(node.matchName) + '")';
        }
    }
    return text;
}

// {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?)}
function getPropertyReference(args) {
    try {
        var target = resolveTarget(args);
        var prop = resolveProperty(target.layer, args);
        return JSON.stringify({ status: "success", layer: { name: target.layer.name, index: target.layer.index }, property: { name: prop.name, matchName: prop.matchName }, reference: propertyReference(target.layer, prop) }, null, 2);
    } catch (error) { return fail(error); }
}

// {from: {compName?, layerIndex|layerName, propertyPath | propertyName (+effectName?)}, to: {same}, factor?, offset?}
// Makes the "to" property follow the "from" property with an expression (like the pick whip). factor and offset
// (single-number properties only) give: from * factor + offset. Both properties must be in the same comp.
function linkProperty(args) {
    var dp = null, oldExpr = "", oldEnabled = false;
    try {
        if (!args.from || !args.to) { throw new Error("from and to are required (each names a layer and property)"); }
        var src = resolveTarget(args.from), dst = resolveTarget(args.to);
        if (src.comp.id !== dst.comp.id) { throw new Error("Both properties must be in the same comp"); }
        var sp = resolveProperty(src.layer, args.from);
        dp = resolveProperty(dst.layer, args.to);
        if (sp.propertyType !== PropertyType.PROPERTY || dp.propertyType !== PropertyType.PROPERTY) { throw new Error("Both ends must be properties with a value, not groups"); }
        var st = valueTypeName(sp), dt = valueTypeName(dp);
        if (st !== dt) { throw new Error("The properties hold different kinds of values (" + st + " and " + dt + ")"); }
        var scaled = isSet(args.factor) || isSet(args.offset);
        if (scaled && st !== "1d") { throw new Error("factor and offset only work on single-number properties"); }
        if (!dp.canSetExpression) { throw new Error("'" + dp.name + "' cannot take an expression"); }
        if (src.layer.index === dst.layer.index && sp === dp) { throw new Error("A property cannot be linked to itself"); }

        var expr = propertyReference(src.layer, sp);
        if (scaled) { expr += " * " + (isSet(args.factor) ? Number(args.factor) : 1) + " + " + (isSet(args.offset) ? Number(args.offset) : 0); }
        oldExpr = dp.expression;
        oldEnabled = dp.expressionEnabled;
        dp.expression = expr;
        var err = "";
        try { err = dp.expressionError; } catch (e) {}
        if (err) { throw new Error("After Effects rejected the expression: " + err); }
        return JSON.stringify({ status: "success", message: "Property linked", from: { layer: src.layer.name, property: sp.name }, to: { layer: dst.layer.name, property: dp.name }, expression: expr, value: safePropertyValue(dp) }, null, 2);
    } catch (error) {
        if (dp) { try { dp.expression = oldExpr; if (!oldEnabled) { dp.expressionEnabled = false; } } catch (restoreError) {} }
        return fail(error);
    }
}

// --- Expression controls ---
var controlTypes = {
    slider: { match: "ADBE Slider Control", param: "Slider" },
    checkbox: { match: "ADBE Checkbox Control", param: "Checkbox" },
    color: { match: "ADBE Color Control", param: "Color" },
    angle: { match: "ADBE Angle Control", param: "Angle" },
    point: { match: "ADBE Point Control", param: "Point" },
    point3d: { match: "ADBE Point3D Control", param: "3D Point" },
    layer: { match: "ADBE Layer Control", param: "Layer" },
    dropdown: { match: "ADBE Dropdown Control", param: "Menu" }
};

// {compName?, layerIndex|layerName, type (slider|checkbox|color|angle|point|point3d|layer|dropdown), name, value?, options? (dropdown items)}
// Adds an Expression Control effect and returns the expression text that reads it.
function addExpressionControl(args) {
    var added = null;
    try {
        var layer = resolveTarget(args).layer;
        var def = controlTypes.hasOwnProperty(args.type) ? controlTypes[args.type] : null;
        if (!def) {
            var kinds = [];
            for (var k in controlTypes) { if (controlTypes.hasOwnProperty(k)) { kinds.push(k); } }
            throw new Error("type must be one of: " + kinds.join(", "));
        }
        if (!args.name) { throw new Error("name is required"); }
        var parade = layer.property("ADBE Effect Parade");
        if (!parade || !parade.canAddProperty(def.match)) { throw new Error("Cannot add a " + args.type + " control to layer '" + layer.name + "'"); }
        added = parade.addProperty(def.match);
        added.name = String(args.name);
        var param = findPropertyInsideGroup(added, def.param) || added.property(1);
        if (args.type === "dropdown") {
            if (!args.options || !args.options.length) { throw new Error("options (a list of menu items) is required for a dropdown"); }
            if (typeof param.setPropertyParameters !== "function") { throw new Error("This version of After Effects cannot set dropdown items from a script"); }
            var items = [];
            for (var i = 0; i < args.options.length; i++) { items.push(String(args.options[i])); }
            var addedIndex = added.propertyIndex;
            param.setPropertyParameters(items);
            // Changing the menu rebuilds the effect and can invalidate every handle in the
            // indexed Effects group. Reacquire the group and effect by the stable index.
            parade = layer.property("ADBE Effect Parade");
            added = parade ? parade.property(addedIndex) : null;
            if (!added) { throw new Error("After Effects rebuilt the dropdown control but it could not be found again"); }
            param = findPropertyInsideGroup(added, def.param) || added.property(1);
            if (!param) { throw new Error("After Effects rebuilt the dropdown control without a menu parameter"); }
        }
        if (isSet(args.value)) { param.setValue(normalizeValue(param, args.value)); }
        return JSON.stringify({
            status: "success", message: "Added a " + args.type + " control",
            control: { name: added.name, type: args.type, parameter: param.name, layer: layer.name },
            value: safePropertyValue(param),
            expressionReference: propertyReference(layer, param)
        }, null, 2);
    } catch (error) {
        if (added) { try { added.remove(); } catch (removeError) {} }
        return fail(error);
    }
}

// --- Camera and light ---
function setNumericOptions(group, map, args, changed, skipped) {
    for (var key in map) {
        if (!map.hasOwnProperty(key) || !isSet(args[key])) { continue; }
        try {
            var prop = group.property(map[key]);
            if (!prop) { throw new Error("no such property"); }
            var v = args[key];
            prop.setValue(typeof v === "boolean" ? (v ? 1 : 0) : normalizeValue(prop, v));
            changed.push(key);
        } catch (e) { skipped.push(key + ": " + e.toString()); }
    }
}

// {compName?, layerIndex|layerName (a camera), cameraType? ("one-node"|"two-node"), zoom?, depthOfField? (bool), focusDistance?,
//  aperture?, blurLevel?, position? [x,y,z], pointOfInterest? [x,y,z]}
function setCameraProperties(args) {
    try {
        var layer = resolveTarget(args).layer;
        if (!(layer instanceof CameraLayer)) { throw new Error("Layer '" + layer.name + "' is not a camera"); }
        var changed = [], skipped = [];
        if (args.cameraType) {
            if (args.cameraType === "one-node") { layer.autoOrient = AutoOrientType.NO_AUTO_ORIENT; }
            else if (args.cameraType === "two-node") { layer.autoOrient = AutoOrientType.CAMERA_OR_POINT_OF_INTEREST; }
            else { throw new Error("cameraType must be one-node or two-node"); }
            changed.push("cameraType");
        }
        setNumericOptions(layer.property("Camera Options"), { zoom: "Zoom", depthOfField: "Depth of Field", focusDistance: "Focus Distance", aperture: "Aperture", blurLevel: "Blur Level" }, args, changed, skipped);
        if (isSet(args.position)) { layer.property("Position").setValue(args.position); changed.push("position"); }
        if (isSet(args.pointOfInterest)) {
            try { layer.property("Point of Interest").setValue(args.pointOfInterest); changed.push("pointOfInterest"); }
            catch (e) { skipped.push("pointOfInterest: a one-node camera has none"); }
        }
        if (changed.length === 0 && skipped.length === 0) { throw new Error("Nothing to change: give cameraType, zoom, depthOfField, focusDistance, aperture, blurLevel, position or pointOfInterest"); }
        var opts = layer.property("Camera Options");
        return JSON.stringify({
            status: "success", message: "Camera updated",
            layer: { name: layer.name, index: layer.index },
            changed: changed, skipped: skipped,
            camera: { oneNode: layer.autoOrient === AutoOrientType.NO_AUTO_ORIENT, zoom: opts.property("Zoom").value, depthOfField: opts.property("Depth of Field").value === 1, focusDistance: opts.property("Focus Distance").value, aperture: opts.property("Aperture").value, blurLevel: opts.property("Blur Level").value, position: layer.property("Position").value }
        }, null, 2);
    } catch (error) { return fail(error); }
}

var lightTypes = { point: "POINT", spot: "SPOT", parallel: "PARALLEL", ambient: "AMBIENT" };

function applyLightOptions(layer, args, changed, skipped) {
    if (args.lightType) {
        if (!lightTypes.hasOwnProperty(args.lightType)) { throw new Error("lightType must be point, spot, parallel or ambient"); }
        layer.lightType = LightType[lightTypes[args.lightType]];
        changed.push("lightType");
    }
    setNumericOptions(layer.property("Light Options"), { intensity: "Intensity", color: "Color", coneAngle: "Cone Angle", coneFeather: "Cone Feather", castsShadows: "Casts Shadows", shadowDarkness: "Shadow Darkness", shadowDiffusion: "Shadow Diffusion" }, args, changed, skipped);
    if (isSet(args.position)) { layer.property("Position").setValue(args.position); changed.push("position"); }
    if (isSet(args.pointOfInterest)) {
        try { layer.property("Point of Interest").setValue(args.pointOfInterest); changed.push("pointOfInterest"); }
        catch (e) { skipped.push("pointOfInterest: this light type has none"); }
    }
}

function lightSummary(layer) {
    var o = layer.property("Light Options");
    var names = { };
    names[LightType.POINT] = "point"; names[LightType.SPOT] = "spot"; names[LightType.PARALLEL] = "parallel"; names[LightType.AMBIENT] = "ambient";
    var info = { lightType: names[layer.lightType], intensity: o.property("Intensity").value, color: o.property("Color").value, position: layer.property("Position").value };
    try { info.coneAngle = o.property("Cone Angle").value; } catch (e) {}
    return info;
}

// {compName?, name?, lightType? ("point"|"spot"|"parallel"|"ambient", default point), intensity?, color? [r,g,b], coneAngle?, coneFeather?,
//  castsShadows?, shadowDarkness?, shadowDiffusion?, position? [x,y,z], pointOfInterest?}
function createLight(args) {
    var layer = null;
    try {
        var comp = resolveComp(args.compName || "");
        layer = comp.layers.addLight(args.name ? String(args.name) : "Light", [comp.width / 2, comp.height / 2]);
        var changed = [], skipped = [];
        applyLightOptions(layer, args, changed, skipped);
        return JSON.stringify({ status: "success", message: "Light created", layer: { name: layer.name, index: layer.index }, changed: changed, skipped: skipped, light: lightSummary(layer) }, null, 2);
    } catch (error) {
        if (layer) { try { layer.remove(); } catch (removeError) {} }
        return fail(error);
    }
}

// {compName?, layerIndex|layerName (a light), lightType?, intensity?, color?, coneAngle?, coneFeather?, castsShadows?,
//  shadowDarkness?, shadowDiffusion?, position?, pointOfInterest?}
function setLightProperties(args) {
    try {
        var layer = resolveTarget(args).layer;
        if (!(layer instanceof LightLayer)) { throw new Error("Layer '" + layer.name + "' is not a light"); }
        var changed = [], skipped = [];
        applyLightOptions(layer, args, changed, skipped);
        if (changed.length === 0 && skipped.length === 0) { throw new Error("Nothing to change: give lightType, intensity, color, coneAngle, coneFeather, castsShadows, shadowDarkness, shadowDiffusion, position or pointOfInterest"); }
        return JSON.stringify({ status: "success", message: "Light updated", layer: { name: layer.name, index: layer.index }, changed: changed, skipped: skipped, light: lightSummary(layer) }, null, 2);
    } catch (error) { return fail(error); }
}

function padTwo(n) { return (n < 10 ? "0" : "") + n; }

// --- backupProject ---
// {folder? (default ~/Documents/ae-mcp-bridge/backups), label?, saveFirst?}
// Copies the project file on disk to a timestamped file. That is the last SAVED state; unsaved changes are not in it,
// unless saveFirst is true, which saves the open project in place first (changing the user's file).
function backupProject(args) {
    try {
        args = args || {};
        var proj = app.project;
        if (!proj.file) { throw new Error("The project has never been saved, so there is no file to copy. Save it first with saveProject and a path"); }
        if (args.saveFirst) { proj.save(); }
        var folder = args.folder ? new Folder(args.folder) : getBridgeSubfolder("backups");
        if (!folder.exists) { throw new Error("Folder does not exist: " + folder.fsName); }
        var d = new Date();
        var millis = String(d.getMilliseconds());
        while (millis.length < 3) { millis = "0" + millis; }
        var stamp = d.getFullYear() + padTwo(d.getMonth() + 1) + padTwo(d.getDate()) + "-" + padTwo(d.getHours()) + padTwo(d.getMinutes()) + padTwo(d.getSeconds()) + "-" + millis;
        var base = decodeURI(proj.file.name).replace(/\.aepx?$/i, "");
        var label = args.label ? "-" + String(args.label).replace(/[^A-Za-z0-9_\-]+/g, "_") : "";
        var ext = /\.aepx$/i.test(proj.file.name) ? ".aepx" : ".aep";
        var target = new File(folder.fsName + "/" + base + "-" + stamp + label + ext);
        if (target.exists) { throw new Error("Backup already exists: " + target.fsName + " (try again)"); }
        if (!proj.file.copy(target.fsName)) { throw new Error("Could not copy the project file to " + target.fsName); }
        return JSON.stringify({ status: "success", message: args.saveFirst ? "Project saved, then backed up" : "Backed up the last saved state (unsaved changes are not included)", path: target.fsName, bytes: target.length, source: proj.file.fsName, savedFirst: !!args.saveFirst }, null, 2);
    } catch (error) { return fail(error); }
}

// Every command the panel runs. This table is the single list of commands: the server forwards any name and
// the panel rejects the ones that are not here.
var commandTable = {
    "getProjectInfo": function (args) { return getProjectInfo(); },
    "listCompositions": function (args) { return listCompositions(); },
    "getLayerInfo": function (args) { return getLayerInfo(args); },
    "createComposition": function (args) { return createComposition(args); },
    "createTextLayer": function (args) { return createTextLayer(args); },
    "createShapeLayer": function (args) { return createShapeLayer(args); },
    "createSolidLayer": function (args) { return createSolidLayer(args); },
    "setLayerProperties": function (args) { return setLayerProperties(args); },
    "setLayerKeyframe": function (args) { return setLayerKeyframe(args); },
    "setLayerExpression": function (args) { return setLayerExpression(args); },
    "applyEffect": function (args) { return applyEffect(args); },
    "applyEffectTemplate": function (args) { return applyEffectTemplate(args); },
    "bridgeTestEffects": function (args) { return bridgeTestEffects(args); },
    "createCamera": function (args) { return createCamera(args); },
    "batchSetLayerProperties": function (args) { return batchSetLayerProperties(args); },
    "setCompositionProperties": function (args) { return setCompositionProperties(args); },
    "duplicateLayer": function (args) { return duplicateLayer(args); },
    "deleteLayer": function (args) { return deleteLayer(args); },
    "setLayerMask": function (args) { return setLayerMask(args); },
    "precomposeLayers": function (args) { return precomposeLayers(args); },
    "addCompToComp": function (args) { return addCompToComp(args); },
    "setGuideLayer": function (args) { return setGuideLayer(args); },
    "createNullLayer": function (args) { return createNullLayer(args); },
    "setLayerParent": function (args) { return setLayerParent(args); },
    "moveLayer": function (args) { return moveLayer(args); },
    "importFile": function (args) { return importFile(args); },
    "renameEffect": function (args) { return renameEffect(args); },
    "setEffectProperty": function (args) { return setEffectProperty(args); },
    "addToRenderQueue": function (args) { return addToRenderQueue(args); },
    "getKeyframes": function (args) { return getKeyframes(args); },
    "removeKeyframes": function (args) { return removeKeyframes(args); },
    "removeEffect": function (args) { return removeEffect(args); },
    "getProjectStatus": function (args) { return getProjectStatus(); },
    "saveProject": function (args) { return saveProject(args); },
    "openProject": function (args) { return openProject(args); },
    "newProject": function (args) { return newProject(args); },
    "undo": function (args) { return undoCommand(args); },
    "setLayerTiming": function (args) { return setLayerTiming(args); },
    "splitLayer": function (args) { return splitLayer(args); },
    "setAnchorPoint": function (args) { return setAnchorPoint(args); },
    "setLayerFlags": function (args) { return setLayerFlags(args); },
    "renameLayer": function (args) { return renameLayer(args); },
    "addMarker": function (args) { return addMarker(args); },
    "getMarkers": function (args) { return getMarkers(args); },
    "removeMarkers": function (args) { return removeMarkers(args); },
    "listLayerProperties": function (args) { return listLayerProperties(args); },
    "setProperty": function (args) { return setProperty(args); },
    "addShapeContent": function (args) { return addShapeContent(args); },
    "setTextDocument": function (args) { return setTextDocument(args); },
    "getProjectTree": function (args) { return getProjectTree(args); },
    "createFolder": function (args) { return createFolder(args); },
    "moveProjectItems": function (args) { return moveProjectItems(args); },
    "setProjectItemProperties": function (args) { return setProjectItemProperties(args); },
    "openComp": function (args) { return openComp(args); },
    "replaceLayerSource": function (args) { return replaceLayerSource(args); },
    "deleteProjectItems": function (args) { return deleteProjectItems(args); },
    "exportFrame": function (args) { return exportFrame(args); },
    "getRenderStatus": function (args) { return getRenderStatus(); },
    "startRender": function (args) { return startRender(); },
    "getCapabilities": function (args) { return getCapabilities(); },
    "setKeyframeEase": function (args) { return setKeyframeEase(args); },
    "offsetKeyframes": function (args) { return offsetKeyframes(args); },
    "copyKeyframes": function (args) { return copyKeyframes(args); },
    "getSelection": function (args) { return getSelection(); },
    "setSelection": function (args) { return setSelection(args); },
    "setCurrentTime": function (args) { return setCurrentTime(args); },
    "setWorkArea": function (args) { return setWorkArea(args); },
    "listEffects": function (args) { return listEffects(args); },
    "listFonts": function (args) { return listFonts(args); },
    "listRenderTemplates": function (args) { return listRenderTemplates(); },
    "getPropertyReference": function (args) { return getPropertyReference(args); },
    "linkProperty": function (args) { return linkProperty(args); },
    "addExpressionControl": function (args) { return addExpressionControl(args); },
    "setCameraProperties": function (args) { return setCameraProperties(args); },
    "createLight": function (args) { return createLight(args); },
    "setLightProperties": function (args) { return setLightProperties(args); },
    "backupProject": function (args) { return backupProject(args); }
};

// Execute command
function executeCommand(command, args, id) {
    var result = "";
    var automaticBackupPath = null;

    logToPanel("Executing command: " + command);
    lastHeartbeatCommand = command;
    lastHeartbeatStatus = "running";
    writeHeartbeat();
    statusText.text = "Running: " + command;
    panel.update();

    try {
        logToPanel("Attempting to execute: " + command); // Log before switch
        var policyError = commandPolicyError(command);
        if (policyError) {
            result = JSON.stringify({ status: "error", error: "Command blocked", message: policyError, safetyMode: readBridgeSettings().safetyMode || "full" });
        } else {
        var bridgeSettings = readBridgeSettings();
        if (bridgeSettings.autoBackupHighImpact !== false && automaticBackupCommands[command]) {
            logToPanel("Creating automatic backup before: " + command);
            var backupResult = backupProject({ label: "auto-before-" + command, saveFirst: false });
            if (resultIsError(backupResult)) {
                var backupMessage = "Automatic backup failed. The command was not run.";
                try {
                    var backupError = JSON.parse(backupResult);
                    backupMessage += " " + (backupError.message || backupError.error || "Save the project first, then retry.");
                } catch (backupParseError) {
                    backupMessage += " " + String(backupResult);
                }
                result = JSON.stringify({ status: "error", error: "Automatic backup failed", message: backupMessage, command: command });
            } else {
                try { automaticBackupPath = JSON.parse(backupResult).path || null; } catch (backupPathError) {}
                logToPanel("Automatic backup created: " + automaticBackupPath);
            }
        }
        if (!result) {
        // One undo step per bridge command, except commands that replace the project, undo, or block on a render
        var noUndoGroup = { undo: 1, openProject: 1, newProject: 1, saveProject: 1, startRender: 1, backupProject: 1 };
        var useUndoGroup = !noUndoGroup[command];
        if (useUndoGroup) { app.beginUndoGroup("MCP: " + command); }
        try {
        var handler = commandTable.hasOwnProperty(command) ? commandTable[command] : null;
        if (handler) {
            logToPanel("Calling " + command + "...");
            result = handler(args);
        } else {
            var available = [];
            for (var name in commandTable) { if (commandTable.hasOwnProperty(name)) { available.push(name); } }
            available.sort();
            result = JSON.stringify({ error: "Unknown command: " + command, availableCommands: available });
        }
        } finally {
            if (useUndoGroup) { app.endUndoGroup(); }
        }
        if (useUndoGroup && !readOnlyCommands[command] && !resultIsError(result)) {
            undoStack.push(command);
            if (undoStack.length > 50) { undoStack.shift(); }
        }
        }
        }
        logToPanel("Execution finished for: " + command); // Log after switch
        
        // Save the result (ensure result is always a string)
        logToPanel("Preparing to write result file...");
        var resultString = (typeof result === 'string') ? result : JSON.stringify(result);
        
        // Try to parse the result as JSON to add a timestamp
        try {
            var resultObj = JSON.parse(resultString);
            // Add a timestamp to help identify if we're getting fresh results
            resultObj._commandExecuted = command;
            if (id) { resultObj._commandId = id; }
            resultObj._bridgeVersion = BRIDGE_VERSION;
            if (automaticBackupPath) { resultObj._automaticBackup = automaticBackupPath; }
            try { resultObj._project = projectStatus(); } catch (ctxError) {}
            resultObj._responseTimestamp = isoTimestamp(new Date());
            resultString = JSON.stringify(resultObj, null, 2);
            lastHeartbeatStatus = resultIsError(resultString) ? "error" : "success";
            logToPanel("Added timestamp to result JSON for tracking freshness.");
        } catch (parseError) {
            // If it's not valid JSON, append the timestamp as a comment
            logToPanel("Could not parse result as JSON to add timestamp: " + parseError.toString());
            // We'll still continue with the original string
        }
        
        writeResultFiles(resultString, id);
        writeHeartbeat();
        logToPanel("Result file write process complete.");
        
        logToPanel("Command completed successfully: " + command); // Changed log message
        statusText.text = "Command completed: " + command;
        
        // Update command file status
        logToPanel("Updating command status to completed...");
        if (!id) { updateCommandStatus("completed"); }
        logToPanel("Command status updated.");
        
    } catch (error) {
        lastHeartbeatStatus = "error";
        var errorMsg = "ERROR in executeCommand for '" + command + "': " + error.toString() + (error.line ? " (line: " + error.line + ")" : "");
        logToPanel(errorMsg); // Log detailed error
        statusText.text = "Error: " + error.toString();
        
        // Write detailed error to result file
        try {
            logToPanel("Attempting to write ERROR to result file...");
            var errorResult = JSON.stringify({ 
                status: "error", 
                command: command,
                message: error.toString(),
                line: error.line,
                fileName: error.fileName,
                _commandId: id || null,
                _commandExecuted: command,
                _bridgeVersion: BRIDGE_VERSION
            });
        writeResultFiles(errorResult, id);
        writeHeartbeat();
            logToPanel("Successfully wrote ERROR to result file.");
        } catch (writeError) {
             logToPanel("CRITICAL ERROR: Failed to write error to result file: " + writeError.toString());
        }
        
        // Update command file status even after error
        logToPanel("Updating command status to error...");
        if (!id) { updateCommandStatus("error"); }
        logToPanel("Command status updated to error.");
    }
}

// Update command file status
function updateCommandStatus(status) {
    try {
        var commandFile = new File(getCommandFilePath());
        if (commandFile.exists) {
            commandFile.open("r");
            var content = commandFile.read();
            commandFile.close();
            
            if (content) {
                var commandData = JSON.parse(content);
                commandData.status = status;
                
                commandFile.open("w");
                commandFile.write(JSON.stringify(commandData, null, 2));
                commandFile.close();
            }
        }
    } catch (e) {
        logToPanel("Error updating command status: " + e.toString());
    }
}

// Log message to panel
function logToPanel(message) {
    var timestamp = new Date().toLocaleTimeString();
    logText.text = timestamp + ": " + message + "\n" + logText.text;
    try {
        var logFile = new File(getBridgeRootFolder().fsName + "/bridge.log");
        logFile.encoding = "UTF-8";
        if (logFile.open("a")) {
            logFile.writeln(isoTimestamp(new Date()) + " " + message);
            logFile.close();
        }
    } catch (e) {}
}

// Check for new commands
function checkForCommands() {
    if (!autoRunCheckbox.value || isChecking) return;
    
    isChecking = true;
    
    try {
        processQueue();

        // Legacy single-file protocol
        var commandFile = new File(getCommandFilePath());
        if (commandFile.exists) {
            commandFile.open("r");
            var content = commandFile.read();
            commandFile.close();
            
            if (content) {
                var commandData = (typeof JSON !== "undefined" && JSON.parse)
                    ? JSON.parse(content)
                    : eval("(" + content + ")");
                
                // Only execute pending commands
                if (commandData.status === "pending") {
                    // Update status to running
                    updateCommandStatus("running");
                    
                    // Execute the command
                    executeCommand(commandData.command, commandData.args || {});
                }
            }
        }
        writeHeartbeat();
    } catch (e) {
        logToPanel("Error checking for commands: " + e.toString());
    }
    
    isChecking = false;
}

// Set up timer to check for commands
function startCommandChecker() {
    app.scheduleTask("checkForCommands()", checkInterval, true);
}

// Add manual check button
var checkButton = panel.add("button", undefined, "Check for Commands Now");
checkButton.onClick = function() {
    logToPanel("Manually checking for commands");
    checkForCommands();
};

// Log startup
logToPanel("MCP Bridge Auto started");
logToPanel("Command file: " + getCommandFilePath());
statusText.text = "Ready - Auto-run is " + (autoRunCheckbox.value ? "ON" : "OFF");
writeHeartbeat();

// Start the command checker
startCommandChecker();

// Show the panel
panel.center();
panel.show();
