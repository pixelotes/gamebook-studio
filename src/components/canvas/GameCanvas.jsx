import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Group, Label, Tag, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { TOKEN_SHAPES } from '../../data/Shapes'; // Keeping for fallback if needed, or remove?
// We need access to the token data. It is passed via props or we need to look it up.
// Actually, GameCanvas receives 'layers'. The objects in layers HAVE the data?
// No, the objects have `shape: "some_id"`.
// We need the ACTUAL SVG content.
// The objects should probably store the SVG content if we want them to be self-contained?
// OR GameCanvas needs a lookup dictionary passed to it.

const Pointer = memo(({ x, y, color }) => {
    // Simple rotating crosshair
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        let animId;
        const animate = () => {
            setRotation(r => (r + 2) % 360);
            animId = requestAnimationFrame(animate);
        };
        animId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animId);
    }, []);

    return (
        <Group x={x} y={y} rotation={rotation}>
            <Line
                points={[-15, 0, 15, 0]}
                stroke={color}
                strokeWidth={3}
            />
            <Line
                points={[0, -15, 0, 15]}
                stroke={color}
                strokeWidth={3}
            />
            <Circle
                radius={8}
                stroke={color}
                strokeWidth={2}
            />
        </Group>
    );
});
Pointer.displayName = 'Pointer';

// SVG Token Renderer - MUST be outside GameCanvas to prevent remounting on every render
const SvgToken = memo(({ token, size, color, strokeColor }) => {
    const coloredUrl = React.useMemo(() => {
        if (!token?.svgContent) return null;
        let svg = token.svgContent;
        // Replace currentColor with actual color
        svg = svg.replace(/currentColor/g, color);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }, [token?.svgContent, color]);

    const [img] = useImage(coloredUrl || '');

    return (
        <KonvaImage
            image={img}
            width={size * 2}
            height={size * 2}
            offsetX={size}
            offsetY={size}
            opacity={token?.opacity || 1}
        />
    );
});
SvgToken.displayName = 'SvgToken';

const GameCanvas = memo(({
    layers = [],
    width,
    height,
    scale,
    tool,
    selectedColor,
    selectedTokenShape,
    selectedTokenColor,
    tokenSize,
    lineWidth,
    onUpdate,
    pdfId,
    pageId,
    tokenPacks = [], // NEW
    embeddedTokens = [] // NEW
}) => {
    // Merge all available tokens for lookup
    // Memoize this lookup map
    const tokenLookup = React.useMemo(() => {
        const map = new Map();
        tokenPacks.forEach(pack => pack.tokens.forEach(t => map.set(t.id, t)));
        embeddedTokens.forEach(t => map.set(t.id, t));
        return map;
    }, [tokenPacks, embeddedTokens]);

    const isDrawing = useRef(false);
    const [tempPath, setTempPath] = useState([]);
    const [tempRect, setTempRect] = useState(null);
    const [rulerStart, setRulerStart] = useState(null);
    const [rulerCurrent, setRulerCurrent] = useState(null);
    const [mousePos, setMousePos] = useState(null); // Track mouse for ghost token / eraser
    const [textEditor, setTextEditor] = useState(null);
    const [eraserTrail, setEraserTrail] = useState([]); // [{x, y, ts}]
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [selectionRect, setSelectionRect] = useState(null);

    // Use ref to access latest layers in timeouts
    const layersRef = useRef(layers);
    useEffect(() => {
        layersRef.current = layers;
    }, [layers]);

    // Drop any in-progress text edit / selection when the page or PDF changes
    useEffect(() => {
        setTextEditor(null);
        setSelectedIds(new Set());
        setSelectionRect(null);
    }, [pdfId, pageId]);

    // Clear selection when switching away from the select tool
    useEffect(() => {
        if (tool !== 'select') {
            setSelectedIds(new Set());
            setSelectionRect(null);
        }
    }, [tool]);

    // Delete/Backspace removes selected objects
    useEffect(() => {
        if (selectedIds.size === 0) return;
        const handleKeyDown = (ev) => {
            if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
            if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
            const t = ev.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            ev.preventDefault();
            const currentLayers = layersRef.current;
            const newLayers = currentLayers.map(l => ({
                ...l,
                objects: l.objects.filter(o => !selectedIds.has(o.id)),
            }));
            onUpdate(pdfId, pageId, newLayers);
            setSelectedIds(new Set());
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, pdfId, pageId, onUpdate]);

    // Eraser trail fade-out: while tool is eraser, drop old points each frame
    useEffect(() => {
        if (tool !== 'eraser') {
            setEraserTrail([]);
            return;
        }
        let rafId;
        const tick = () => {
            const now = Date.now();
            setEraserTrail(prev => {
                if (prev.length === 0) return prev;
                const next = prev.filter(p => now - p.ts < 350);
                return next.length === prev.length ? prev : next;
            });
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [tool]);

    // Helper to get relative pointer position
    const getRelativePointerPosition = (stage) => {
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        return transform.point(stage.getPointerPosition());
    };

    // Axis-aligned bounding box for a layer object, in canvas (unscaled) coordinates.
    const getObjectBBox = (obj) => {
        if (obj.type === 'path' && obj.points?.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of obj.points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }
        if (obj.type === 'rectangle') {
            return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
        }
        if (obj.type === 'gameToken') {
            const s = obj.size || 0;
            return { x: obj.x - s, y: obj.y - s, width: s * 2, height: s * 2 };
        }
        if (obj.type === 'text') {
            const fontSize = Number.parseInt(obj.font, 10) || 16;
            const longestLine = (obj.content || '').split('\n').reduce((m, l) => Math.max(m, l.length), 1);
            const lineCount = (obj.content || '').split('\n').length || 1;
            return {
                x: obj.x,
                y: obj.y,
                width: Math.max(longestLine, 1) * fontSize * 0.6,
                height: lineCount * fontSize * 1.2,
            };
        }
        if (obj.type === 'pointer') {
            return { x: obj.x - 15, y: obj.y - 15, width: 30, height: 30 };
        }
        return null;
    };

    const findObjectById = (id) => {
        for (const layer of layers) {
            const found = layer.objects.find(o => o.id === id);
            if (found) return { obj: found, layerId: layer.id };
        }
        return null;
    };

    const handleShapeClick = (e, layerId, objId) => {
        if (tool === 'eraser') {
            removeObject(layerId, objId);
            return;
        }
        if (tool === 'select') {
            e.cancelBubble = true;
            const shift = e.evt?.shiftKey;
            setSelectedIds(prev => {
                const next = new Set(prev);
                if (shift) {
                    if (next.has(objId)) next.delete(objId);
                    else next.add(objId);
                } else {
                    next.clear();
                    next.add(objId);
                }
                return next;
            });
        }
    };

    const applyDragDeltaToObject = (obj, dx, dy) => {
        if (obj.type === 'path') {
            return { ...obj, points: obj.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        if (obj.type === 'rectangle' || obj.type === 'gameToken' || obj.type === 'text') {
            return { ...obj, x: obj.x + dx, y: obj.y + dy };
        }
        return obj;
    };

    const dragGroupRef = useRef(null);

    const handleShapeDragStart = (e, objId) => {
        if (tool !== 'select') return;

        let selection = selectedIds;
        if (!selection.has(objId)) {
            selection = new Set([objId]);
            setSelectedIds(selection);
        }

        const leader = e.target;
        const stage = leader.getStage();
        const others = [];
        const outlines = [];
        selection.forEach(id => {
            if (id !== objId) {
                const node = stage.findOne(`#obj-${id}`);
                if (node) {
                    others.push({ id, node, startX: node.x(), startY: node.y() });
                }
            }
            const outline = stage.findOne(`#sel-${id}`);
            if (outline) {
                outlines.push({ id, node: outline, startX: outline.x(), startY: outline.y() });
            }
        });

        dragGroupRef.current = {
            leaderId: objId,
            leaderStartX: leader.x(),
            leaderStartY: leader.y(),
            others,
            outlines,
        };
    };

    const handleShapeDragMove = (e, objId) => {
        const group = dragGroupRef.current;
        if (!group || group.leaderId !== objId) return;
        const dx = e.target.x() - group.leaderStartX;
        const dy = e.target.y() - group.leaderStartY;
        for (const o of group.others) {
            o.node.position({ x: o.startX + dx, y: o.startY + dy });
        }
        for (const o of group.outlines) {
            o.node.position({ x: o.startX + dx, y: o.startY + dy });
        }
        e.target.getStage().batchDraw();
    };

    const handleShapeDragEnd = (e, objId) => {
        const group = dragGroupRef.current;
        if (!group) {
            // Defensive fallback: treat as single-object drag using the leader's offset
            const found = findObjectById(objId);
            if (!found) return;
            if (found.obj.type === 'path') {
                const dx = e.target.x();
                const dy = e.target.y();
                e.target.position({ x: 0, y: 0 });
                updateObject(found.layerId, applyDragDeltaToObject(found.obj, dx, dy));
            } else {
                updateObject(found.layerId, { ...found.obj, x: e.target.x(), y: e.target.y() });
            }
            return;
        }

        const dx = e.target.x() - group.leaderStartX;
        const dy = e.target.y() - group.leaderStartY;
        const ids = new Set([group.leaderId, ...group.others.map(o => o.id)]);

        // Path nodes carry the drag offset on the Konva node; since the offset will be
        // baked into the points in state, we have to reset the node position to (0,0)
        // for paths to avoid double-offsetting on the next render.
        const stage = e.target.getStage();
        ids.forEach(id => {
            const found = findObjectById(id);
            if (found?.obj.type !== 'path') return;
            const node = id === group.leaderId ? e.target : stage.findOne(`#obj-${id}`);
            if (node) node.position({ x: 0, y: 0 });
        });

        const currentLayers = layersRef.current;
        const newLayers = currentLayers.map(l => ({
            ...l,
            objects: l.objects.map(o => ids.has(o.id) ? applyDragDeltaToObject(o, dx, dy) : o),
        }));
        onUpdate(pdfId, pageId, newLayers);

        dragGroupRef.current = null;
    };

    const handleMouseDown = (e) => {
        if (tool === 'eraser' || tool === 'token' || tool === 'pointer' || tool === 'text' || tool === 'pan') return;

        const stage = e.target.getStage();
        const pos = getRelativePointerPosition(stage);

        if (tool === 'select') {
            // Lasso starts only on empty stage clicks; shape clicks are handled by the shape itself
            if (e.target !== stage) return;
            isDrawing.current = true;
            setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
            return;
        }

        isDrawing.current = true;

        if (tool === 'draw') {
            setTempPath([pos.x, pos.y]);
        } else if (tool === 'rectangle') {
            setTempRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
        } else if (tool === 'ruler') {
            setRulerStart(pos);
            setRulerCurrent(pos);
        }
    };

    const handleMouseMove = (e) => {
        const stage = e.target.getStage();
        const pos = getRelativePointerPosition(stage);

        // Track mouse for ghost previews (token, eraser)
        if (tool === 'token' || tool === 'eraser') {
            setMousePos(pos);
        } else if (mousePos) {
            setMousePos(null);
        }

        // Push to eraser trail only while primary button is held
        if (tool === 'eraser' && e.evt.buttons === 1) {
            const now = Date.now();
            setEraserTrail(prev => {
                const appended = [...prev, { x: pos.x, y: pos.y, ts: now }];
                const trimmed = appended.filter(p => now - p.ts < 350);
                return trimmed.length > 15 ? trimmed.slice(-15) : trimmed;
            });
        }

        if (!isDrawing.current) return;

        if (tool === 'draw') {
            setTempPath(prev => [...prev, pos.x, pos.y]);
        } else if (tool === 'rectangle' && tempRect) {
            setTempRect(prev => ({
                ...prev,
                width: pos.x - prev.x,
                height: pos.y - prev.y
            }));
        } else if (tool === 'ruler') {
            setRulerCurrent(pos);
        } else if (tool === 'select' && selectionRect) {
            setSelectionRect(prev => ({
                ...prev,
                width: pos.x - prev.x,
                height: pos.y - prev.y,
            }));
        }
    };

    const handleMouseUp = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;

        if (tool === 'select' && selectionRect) {
            const w = Math.abs(selectionRect.width);
            const h = Math.abs(selectionRect.height);
            if (w < 3 && h < 3) {
                // Click on empty area → clear selection
                setSelectedIds(new Set());
            } else {
                const x = Math.min(selectionRect.x, selectionRect.x + selectionRect.width);
                const y = Math.min(selectionRect.y, selectionRect.y + selectionRect.height);
                const inside = new Set();
                for (const layer of layersRef.current) {
                    if (!layer.visible) continue;
                    for (const obj of layer.objects) {
                        const bbox = getObjectBBox(obj);
                        if (!bbox) continue;
                        if (bbox.x < x + w && bbox.x + bbox.width > x &&
                            bbox.y < y + h && bbox.y + bbox.height > y) {
                            inside.add(obj.id);
                        }
                    }
                }
                setSelectedIds(inside);
            }
            setSelectionRect(null);
            return;
        }

        if (tool === 'draw') {
            if (tempPath.length > 2) {
                const points = [];
                for (let i = 0; i < tempPath.length; i += 2) {
                    points.push({ x: tempPath[i], y: tempPath[i + 1] });
                }

                const newObj = {
                    type: 'path',
                    id: Date.now(),
                    points: points,
                    color: selectedColor,
                    width: lineWidth || 3
                };
                addObject('drawings', newObj);
            }
            setTempPath([]);
        } else if (tool === 'rectangle' && tempRect) {
            const x = tempRect.width < 0 ? tempRect.x + tempRect.width : tempRect.x;
            const y = tempRect.height < 0 ? tempRect.y + tempRect.height : tempRect.y;
            const width = Math.abs(tempRect.width);
            const height = Math.abs(tempRect.height);

            if (width > 2 && height > 2) {
                const newObj = {
                    type: 'rectangle',
                    id: Date.now(),
                    x, y, width, height,
                    color: selectedColor
                };
                addObject('drawings', newObj);
            }
            setTempRect(null);
        } else if (tool === 'ruler') {
            if (rulerStart && rulerCurrent) {
                const dx = rulerCurrent.x - rulerStart.x;
                const dy = rulerCurrent.y - rulerStart.y;
                if (Math.sqrt(dx * dx + dy * dy) > 1) {
                    const rulerObjId = Date.now();
                    const newObj = {
                        type: 'ruler',
                        id: rulerObjId,
                        x1: rulerStart.x,
                        y1: rulerStart.y,
                        x2: rulerCurrent.x,
                        y2: rulerCurrent.y,
                        color: selectedColor,
                    };
                    addObject('drawings', newObj);

                    // Auto-destroy after 5 seconds (mirrors the pointer pattern)
                    setTimeout(() => {
                        const currentLayers = layersRef.current;
                        const newLayers = currentLayers.map(l => {
                            if (l.id === 'drawings') {
                                return {
                                    ...l,
                                    objects: l.objects.filter(o => o.id !== rulerObjId),
                                };
                            }
                            return l;
                        });
                        onUpdate(pdfId, pageId, newLayers);
                    }, 5000);
                }
            }
            setRulerStart(null);
            setRulerCurrent(null);
        }
    };

    const handleStageClick = (e) => {
        // Handle Token Placement
        if (tool === 'token') {
            const stage = e.target.getStage();
            const pos = getRelativePointerPosition(stage);

            // If it's a new GBTK token, we might need to Embed it now if it's from a pack?
            // The object will store the ID.

            // Auto-embed logic:
            // If the selectedTokenShape is NOT in embeddedTokens, but IS in tokenPacks, we should trigger an 'EMBED_TOKEN' action?
            // But we are inside GameCanvas, we typically only call onUpdate (layer update).
            // Parent App should handle embedding?
            // For now, let's assume the Object just stores the ID and we look it up at render time.
            // PRO: Smaller JSON. CON: Need the pack loaded or embedded.
            // The GBTK plan said: "When assigned... Copy into embeddedTokens".
            // Since we can't easily dispatch to AppState from here without passing dispatch... 
            // We can rely on App.jsx to check added objects? Or just pass dispatch?
            // OR: Just store the ID for now, and rely on the fact that if it's selected, it must be available.
            // We'll fix persistence later.

            const newObj = {
                type: 'gameToken',
                id: Date.now(),
                x: pos.x,
                y: pos.y,
                shape: selectedTokenShape, // This is now the Token ID (e.g. 'core_meeple')
                color: selectedTokenColor,
                strokeColor: selectedTokenColor === '#ffffff' ? '#000000' : '#ffffff',
                size: tokenSize
            };
            addObject('tokens', newObj);
        } else if (tool === 'text') {
            const stage = e.target.getStage();
            const pos = getRelativePointerPosition(stage);

            setTextEditor({
                mode: 'create',
                x: pos.x,
                y: pos.y,
                content: '',
                color: selectedColor,
                fontSize: 16,
            });
        } else if (tool === 'pointer') {
            const stage = e.target.getStage();
            const pos = getRelativePointerPosition(stage);

            const pointerId = Date.now();
            const newObj = {
                type: 'pointer',
                id: pointerId,
                x: pos.x,
                y: pos.y,
                color: selectedColor
            };

            // Add pointer object to 'drawings' layer (or create a specific one if needed)
            addObject('drawings', newObj);

            // Auto destroy after 3 seconds
            setTimeout(() => {
                // Must use ref to get LATEST layers, otherwise we revert state
                const currentLayers = layersRef.current;

                // Manually implement removeObject logic with currentLayers
                const newLayers = currentLayers.map(l => {
                    if (l.id === 'drawings') {
                        return {
                            ...l,
                            objects: l.objects.filter(o => o.id !== pointerId)
                        };
                    }
                    return l;
                });
                onUpdate(pdfId, pageId, newLayers);
            }, 3000);
        }
    };


    const handleObjectMouseEnter = (e, layerId, objId) => {
        // Check if eraser tool is active and primary mouse button is down (drag)
        if (tool === 'eraser' && e.evt.buttons === 1) {
            removeObject(layerId, objId);
        }
    };

    const addObject = useCallback((layerId, obj) => {
        const currentLayers = layersRef.current;
        const newLayers = currentLayers.map(l => {
            if (l.id === layerId) {
                return { ...l, objects: [...l.objects, obj] };
            }
            return l;
        });
        onUpdate(pdfId, pageId, newLayers);
    }, [onUpdate, pdfId, pageId]);

    const updateObject = useCallback((layerId, updatedObj) => {
        const currentLayers = layersRef.current;
        const newLayers = currentLayers.map(l => {
            if (l.id === layerId) {
                return {
                    ...l,
                    objects: l.objects.map(o => o.id === updatedObj.id ? updatedObj : o)
                };
            }
            return l;
        });
        onUpdate(pdfId, pageId, newLayers);
    }, [onUpdate, pdfId, pageId]);

    const removeObject = useCallback((layerId, objId) => {
        const currentLayers = layersRef.current;
        const newLayers = currentLayers.map(l => {
            if (l.id === layerId) {
                return {
                    ...l,
                    objects: l.objects.filter(o => o.id !== objId)
                };
            }
            return l;
        });
        onUpdate(pdfId, pageId, newLayers);
    }, [onUpdate, pdfId, pageId]);

    // Render Helpers - SvgToken is now defined OUTSIDE GameCanvas for performance

    const renderTokenShape = (tokenObj, opacity = 1) => {
        const { shape, size, color, strokeColor } = tokenObj;

        // 1. Try to find GBTK Token
        const gbtkToken = tokenLookup.get(shape);
        if (gbtkToken) {
            // Pass opacity via prop or context? 
            // SvgToken needs to accept opacity or we hack it into the object.
            // Let's modify SvgToken prop.
            // But SvgToken component above takes `token`.
            // We can wrap it. Or pass a modified token object?
            // Cleanest: Pass opacity to SvgToken. Done above.
            return <SvgToken token={{ ...gbtkToken, opacity }} size={size} color={color} strokeColor={strokeColor} />;
        }

        // 2. Fallback to Legacy Shapes (if any remain)
        const commonProps = {
            fill: color,
            stroke: strokeColor,
            strokeWidth: 2,
            radius: size,
            width: size * 2,
            height: size * 2,
            offsetX: size,
            offsetY: size,
            opacity: opacity
        };

        if (shape === 'circle') return <Circle {...commonProps} />;
        if (shape === 'square') return <Rect {...commonProps} />;

        // Legacy Icon fallback
        const icon = TOKEN_SHAPES[shape]?.icon;
        if (icon) {
            return (
                <Group>
                    <Circle {...commonProps} radius={size * 1.2} />
                    <Text
                        text={icon}
                        fontSize={size * 1.8}
                        fill={strokeColor}
                        align="center"
                        verticalAlign="middle"
                        offsetX={size}
                        offsetY={size}
                        width={size * 2}
                        height={size * 2}
                    />
                </Group>
            );
        }

        // Default
        return <Circle {...commonProps} />;
    };

    const commitTextEditor = () => {
        if (!textEditor) return;
        const { mode, content, x, y, color, fontSize, objId } = textEditor;
        const trimmed = content.trim();

        if (mode === 'create') {
            if (trimmed) {
                addObject('text', {
                    type: 'text',
                    id: Date.now(),
                    x, y,
                    content,
                    color,
                    font: `${fontSize}px Arial`,
                });
            }
        } else if (mode === 'edit' && objId != null) {
            const currentLayers = layersRef.current;
            const textLayer = currentLayers.find(l => l.id === 'text');
            const existingObj = textLayer?.objects.find(o => o.id === objId);
            if (existingObj) {
                if (trimmed) {
                    updateObject('text', { ...existingObj, content });
                } else {
                    removeObject('text', objId);
                }
            }
        }
        setTextEditor(null);
    };

    return (
        <>
        <Stage
            width={width}
            height={height}
            scale={{ x: scale, y: scale }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleStageClick}
            onMouseLeave={() => {
                setMousePos(null);
                setEraserTrail([]);
            }}
            style={{ position: 'absolute', top: 0, left: 0 }}
        >
            {/* STATIC LAYER: Persistent objects - only redraws when layers prop changes */}
            <Layer>
                {layers.map((layer) => {
                    if (!layer.visible) return null;
                    return (
                        <Group key={layer.id}>
                            {layer.objects.map((obj) => {
                                if (obj.type === 'path') {
                                    // Flatten points for Konva Line
                                    const points = obj.points.flatMap(p => [p.x, p.y]);
                                    return (
                                        <Line
                                            key={obj.id}
                                            id={`obj-${obj.id}`}
                                            points={points}
                                            stroke={obj.color}
                                            strokeWidth={obj.width}
                                            tension={0.5}
                                            lineCap="round"
                                            lineJoin="round"
                                            draggable={tool === 'select'}
                                            onDragStart={(ev) => handleShapeDragStart(ev, obj.id)}
                                            onDragMove={(ev) => handleShapeDragMove(ev, obj.id)}
                                            onDragEnd={(ev) => handleShapeDragEnd(ev, obj.id)}
                                            onClick={(ev) => handleShapeClick(ev, layer.id, obj.id)}
                                            onMouseEnter={(e) => handleObjectMouseEnter(e, layer.id, obj.id)}
                                        />
                                    );
                                }
                                if (obj.type === 'rectangle') {
                                    return (
                                        <Rect
                                            key={obj.id}
                                            id={`obj-${obj.id}`}
                                            x={obj.x}
                                            y={obj.y}
                                            width={obj.width}
                                            height={obj.height}
                                            stroke={obj.color}
                                            strokeWidth={3}
                                            draggable={tool === 'select'}
                                            onDragStart={(ev) => handleShapeDragStart(ev, obj.id)}
                                            onDragMove={(ev) => handleShapeDragMove(ev, obj.id)}
                                            onDragEnd={(ev) => handleShapeDragEnd(ev, obj.id)}
                                            onClick={(ev) => handleShapeClick(ev, layer.id, obj.id)}
                                            onMouseEnter={(e) => handleObjectMouseEnter(e, layer.id, obj.id)}
                                        />
                                    );
                                }
                                if (obj.type === 'gameToken') {
                                    return (
                                        <Group
                                            key={obj.id}
                                            id={`obj-${obj.id}`}
                                            x={obj.x}
                                            y={obj.y}
                                            draggable={tool === 'select'}
                                            onDragStart={(ev) => handleShapeDragStart(ev, obj.id)}
                                            onDragMove={(ev) => handleShapeDragMove(ev, obj.id)}
                                            onDragEnd={(ev) => handleShapeDragEnd(ev, obj.id)}
                                            onClick={(ev) => handleShapeClick(ev, layer.id, obj.id)}
                                            onMouseEnter={(e) => handleObjectMouseEnter(e, layer.id, obj.id)}
                                        >
                                            {renderTokenShape(obj)}
                                        </Group>
                                    );
                                }
                                if (obj.type === 'text') {
                                    const isBeingEdited = textEditor?.mode === 'edit' && textEditor.objId === obj.id;
                                    if (isBeingEdited) return null;
                                    return (
                                        <Text
                                            key={obj.id}
                                            id={`obj-${obj.id}`}
                                            x={obj.x}
                                            y={obj.y}
                                            text={obj.content}
                                            fill={obj.color}
                                            fontSize={parseInt(obj.font) || 16}
                                            draggable={tool === 'select'}
                                            onDragStart={(ev) => handleShapeDragStart(ev, obj.id)}
                                            onDragMove={(ev) => handleShapeDragMove(ev, obj.id)}
                                            onDragEnd={(ev) => handleShapeDragEnd(ev, obj.id)}
                                            onClick={(ev) => handleShapeClick(ev, layer.id, obj.id)}
                                            onDblClick={() => {
                                                if (tool !== 'select') return;
                                                setTextEditor({
                                                    mode: 'edit',
                                                    objId: obj.id,
                                                    x: obj.x,
                                                    y: obj.y,
                                                    content: obj.content,
                                                    color: obj.color,
                                                    fontSize: parseInt(obj.font) || 16,
                                                });
                                            }}
                                            onMouseEnter={(e) => handleObjectMouseEnter(e, layer.id, obj.id)}
                                        />
                                    );
                                }
                                if (obj.type === 'pointer') {
                                    return (
                                        <Pointer
                                            key={obj.id}
                                            x={obj.x}
                                            y={obj.y}
                                            color={obj.color}
                                        />
                                    );
                                }
                                if (obj.type === 'ruler') {
                                    const distance = Math.round(Math.sqrt(Math.pow(obj.x2 - obj.x1, 2) + Math.pow(obj.y2 - obj.y1, 2)));
                                    return (
                                        <Group key={obj.id} listening={false}>
                                            <Line
                                                points={[obj.x1, obj.y1, obj.x2, obj.y2]}
                                                stroke={obj.color || 'red'}
                                                strokeWidth={2}
                                                dash={[10, 5]}
                                            />
                                            <Label x={(obj.x1 + obj.x2) / 2} y={(obj.y1 + obj.y2) / 2}>
                                                <Tag
                                                    fill="black"
                                                    opacity={0.7}
                                                    pointerDirection="down"
                                                    pointerWidth={10}
                                                    pointerHeight={10}
                                                    lineJoin="round"
                                                    cornerRadius={5}
                                                />
                                                <Text
                                                    text={`${distance} px`}
                                                    fill="white"
                                                    padding={5}
                                                    fontSize={14}
                                                />
                                            </Label>
                                        </Group>
                                    );
                                }
                                return null;
                            })}
                        </Group>
                    );
                })}
            </Layer>

            {/* DYNAMIC LAYER: Temporary elements - updates frequently on mouse move without affecting static layer */}
            <Layer listening={false}>
                {/* Render Temp Path while drawing */}
                {isDrawing.current && tool === 'draw' && (
                    <Line
                        points={tempPath}
                        stroke={selectedColor}
                        strokeWidth={lineWidth || 3}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}
                {/* Render Temp Rect while drawing */}
                {tempRect && tool === 'rectangle' && (
                    <Rect
                        x={tempRect.x}
                        y={tempRect.y}
                        width={tempRect.width}
                        height={tempRect.height}
                        stroke={selectedColor}
                        strokeWidth={3}
                    />
                )}
                {/* Render Ruler */}
                {rulerStart && rulerCurrent && tool === 'ruler' && (
                    <Group>
                        <Line
                            points={[rulerStart.x, rulerStart.y, rulerCurrent.x, rulerCurrent.y]}
                            stroke="red"
                            strokeWidth={2}
                            dash={[10, 5]}
                        />
                        <Label
                            x={(rulerStart.x + rulerCurrent.x) / 2}
                            y={(rulerStart.y + rulerCurrent.y) / 2}
                        >
                            <Tag
                                fill="black"
                                opacity={0.7}
                                pointerDirection="down"
                                pointerWidth={10}
                                pointerHeight={10}
                                lineJoin="round"
                                cornerRadius={5}
                            />
                            <Text
                                text={`${Math.round(Math.sqrt(Math.pow(rulerCurrent.x - rulerStart.x, 2) + Math.pow(rulerCurrent.y - rulerStart.y, 2)))} px`}
                                fill="white"
                                padding={5}
                                fontSize={14}
                            />
                        </Label>
                    </Group>
                )}
                {/* Ghost Token Preview */}
                {tool === 'token' && mousePos && (
                    <Group x={mousePos.x} y={mousePos.y}>
                        {renderTokenShape({
                            shape: selectedTokenShape,
                            color: selectedTokenColor,
                            strokeColor: selectedTokenColor === '#ffffff' ? '#000000' : '#ffffff',
                            size: tokenSize
                        }, 0.5)}
                    </Group>
                )}
                {/* Eraser trail (estelita) — segments with fading opacity from tail to head */}
                {tool === 'eraser' && eraserTrail.length > 1 && eraserTrail.slice(0, -1).map((from, i) => {
                    const to = eraserTrail[i + 1];
                    const t = (i + 1) / eraserTrail.length; // newer segment → higher t
                    return (
                        <Line
                            key={from.ts}
                            points={[from.x, from.y, to.x, to.y]}
                            stroke="#ec4899"
                            strokeWidth={3}
                            opacity={t * 0.85}
                            lineCap="round"
                            strokeScaleEnabled={false}
                        />
                    );
                })}
                {/* Selection outlines (dashed bbox around each selected object) */}
                {tool === 'select' && selectedIds.size > 0 && Array.from(selectedIds).map(id => {
                    const found = findObjectById(id);
                    if (!found) return null;
                    const bbox = getObjectBBox(found.obj);
                    if (!bbox) return null;
                    return (
                        <Rect
                            key={`sel-${id}`}
                            id={`sel-${id}`}
                            x={bbox.x - 3}
                            y={bbox.y - 3}
                            width={bbox.width + 6}
                            height={bbox.height + 6}
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            dash={[5, 3]}
                            strokeScaleEnabled={false}
                            listening={false}
                        />
                    );
                })}
                {/* Lasso (rubber-band) selection rectangle while dragging */}
                {tool === 'select' && selectionRect && (
                    <Rect
                        x={Math.min(selectionRect.x, selectionRect.x + selectionRect.width)}
                        y={Math.min(selectionRect.y, selectionRect.y + selectionRect.height)}
                        width={Math.abs(selectionRect.width)}
                        height={Math.abs(selectionRect.height)}
                        stroke="#3b82f6"
                        strokeWidth={1}
                        dash={[5, 3]}
                        fill="rgba(59, 130, 246, 0.1)"
                        strokeScaleEnabled={false}
                        listening={false}
                    />
                )}
                {/* Eraser cursor (gomita) — invariant size at any zoom */}
                {tool === 'eraser' && mousePos && (
                    <Group x={mousePos.x} y={mousePos.y} scaleX={1 / scale} scaleY={1 / scale} listening={false}>
                        <Rect
                            x={-12}
                            y={-7}
                            width={24}
                            height={10}
                            cornerRadius={3}
                            fill="#fbcfe8"
                            stroke="#831843"
                            strokeWidth={1.2}
                        />
                        <Rect
                            x={-12}
                            y={3}
                            width={24}
                            height={4}
                            cornerRadius={1.5}
                            fill="#831843"
                        />
                    </Group>
                )}
            </Layer>
        </Stage>
        {textEditor && (
            <textarea
                autoFocus
                value={textEditor.content}
                onChange={(e) => setTextEditor(prev => prev && ({ ...prev, content: e.target.value }))}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setTextEditor(null);
                    }
                }}
                onBlur={commitTextEditor}
                style={{
                    position: 'absolute',
                    left: `${textEditor.x * scale}px`,
                    top: `${textEditor.y * scale}px`,
                    fontSize: `${textEditor.fontSize * scale}px`,
                    fontFamily: 'Arial',
                    lineHeight: 1.2,
                    color: textEditor.color,
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #3b82f6',
                    outline: 'none',
                    resize: 'none',
                    padding: '2px 4px',
                    margin: 0,
                    minWidth: '60px',
                    zIndex: 20,
                    overflow: 'hidden',
                }}
            />
        )}
        </>
    );
});
GameCanvas.displayName = 'GameCanvas';

export default GameCanvas;
