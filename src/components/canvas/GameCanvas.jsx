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

    // Use ref to access latest layers in timeouts
    const layersRef = useRef(layers);
    useEffect(() => {
        layersRef.current = layers;
    }, [layers]);

    // Drop any in-progress text edit when the page or PDF changes
    useEffect(() => {
        setTextEditor(null);
    }, [pdfId, pageId]);

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

    const handleMouseDown = (e) => {
        if (tool === 'select' || tool === 'eraser' || tool === 'token' || tool === 'pointer' || tool === 'text' || tool === 'pan') return;

        isDrawing.current = true;
        const stage = e.target.getStage();
        const pos = getRelativePointerPosition(stage);

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
        }
    };

    const handleMouseUp = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;

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
                                            points={points}
                                            stroke={obj.color}
                                            strokeWidth={obj.width}
                                            tension={0.5}
                                            lineCap="round"
                                            lineJoin="round"
                                            draggable={tool === 'select'}
                                            onDragEnd={(e) => {
                                                // Calculate offset
                                                const dx = e.target.x();
                                                const dy = e.target.y();
                                                // Update points based on offset
                                                const newPoints = obj.points.map(p => ({
                                                    x: p.x + dx,
                                                    y: p.y + dy
                                                }));

                                                // Reset position of the node to 0,0 and update points
                                                e.target.position({ x: 0, y: 0 });

                                                updateObject(layer.id, {
                                                    ...obj,
                                                    points: newPoints
                                                });
                                            }}
                                            onClick={() => tool === 'eraser' && removeObject(layer.id, obj.id)}
                                            onMouseEnter={(e) => handleObjectMouseEnter(e, layer.id, obj.id)}
                                        />
                                    );
                                }
                                if (obj.type === 'rectangle') {
                                    return (
                                        <Rect
                                            key={obj.id}
                                            x={obj.x}
                                            y={obj.y}
                                            width={obj.width}
                                            height={obj.height}
                                            stroke={obj.color}
                                            strokeWidth={3}
                                            draggable={tool === 'select'}
                                            onDragEnd={(e) => {
                                                updateObject(layer.id, {
                                                    ...obj,
                                                    x: e.target.x(),
                                                    y: e.target.y()
                                                });
                                            }}
                                            onClick={() => tool === 'eraser' && removeObject(layer.id, obj.id)}
                                            onMouseEnter={(e) => handleObjectMouseEnter(e, layer.id, obj.id)}
                                        />
                                    );
                                }
                                if (obj.type === 'gameToken') {
                                    return (
                                        <Group
                                            key={obj.id}
                                            x={obj.x}
                                            y={obj.y}
                                            draggable={tool === 'select'}
                                            onDragEnd={(e) => {
                                                updateObject(layer.id, {
                                                    ...obj,
                                                    x: e.target.x(),
                                                    y: e.target.y()
                                                });
                                            }}
                                            onClick={() => {
                                                if (tool === 'eraser') removeObject(layer.id, obj.id);
                                            }}
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
                                            x={obj.x}
                                            y={obj.y}
                                            text={obj.content}
                                            fill={obj.color}
                                            fontSize={parseInt(obj.font) || 16}
                                            draggable={tool === 'select'}
                                            onDragEnd={(e) => {
                                                updateObject(layer.id, {
                                                    ...obj,
                                                    x: e.target.x(),
                                                    y: e.target.y()
                                                });
                                            }}
                                            onClick={() => tool === 'eraser' && removeObject(layer.id, obj.id)}
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
