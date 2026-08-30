import React, { useContext, useRef, useEffect, useState } from 'react';
import { AppContext } from '../state/appState';
import { FileText } from 'lucide-react';
import PDFControlsBar from './PDFControlsBar';
import GameCanvas from './canvas/GameCanvas';
import { LAYER_TOKENS, LAYER_DRAWINGS, LAYER_TEXT } from '../data/LayerIds';

// Pencil cursor SVG — tip at (1, 23) is the hotspot, so strokes start exactly there.
const DRAW_CURSOR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M 1 23 L 5 19 L 7 21 L 3 23 Z" fill="#111827" stroke="#fff" stroke-width="0.5"/><path d="M 5 19 L 16 8 L 19 11 L 8 22 Z" fill="#fbbf24" stroke="#111827" stroke-width="0.5"/><path d="M 16 8 L 20 4 L 23 7 L 19 11 Z" fill="#ef4444" stroke="#111827" stroke-width="0.5"/></svg>';
const DRAW_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(DRAW_CURSOR_SVG)}") 1 23, crosshair`;

const PDFViewer = ({
  pdfCanvasRef,
  // overlayCanvasRef, // No longer needed
  pdf,
  paneId = 'primary',
  updatePdf,
  onBookmarkNavigate,
  onLayerUpdate // Passed from App -> PDFPane -> PDFViewer
}) => {
  const { state, goToPage, zoomIn, zoomOut } = useContext(AppContext);
  const { selectedTool, selectedColor, selectedTokenShape, selectedTokenColor, tokenSize, isDualPaneMode } = state;
  const scrollContainerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!pdf || pdf.initialScaleSet !== false) return;
    let cancelled = false;
    let rafId = null;

    const calc = async () => {
      if (cancelled || !scrollContainerRef.current) return;
      const viewerHeight = scrollContainerRef.current.clientHeight;
      if (viewerHeight <= 0) {
        // Layout not ready yet; retry next frame (typically resolves immediately)
        rafId = requestAnimationFrame(calc);
        return;
      }
      try {
        const page = await pdf.pdfDoc.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const verticalPadding = 32;
        const newScale = Math.min(2, (viewerHeight - verticalPadding) / viewport.height);
        updatePdf(pdf.id, { scale: newScale, initialScaleSet: true });
      } catch (error) {
        if (cancelled) return;
        console.error("Error calculating initial PDF scale:", error);
        updatePdf(pdf.id, { initialScaleSet: true });
      }
    };

    calc();
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [pdf, updatePdf]);

  // Ctrl/Cmd + wheel → zoom centered on the cursor.
  // After scale updates, the canvas re-renders at the new size; we restore the
  // scroll position so the same PDF point stays under the cursor.
  const pendingZoomFocusRef = useRef(null);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onWheel = (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      if (!pdf) return;
      ev.preventDefault();

      const rect = el.getBoundingClientRect();
      const mouseInContainer = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      const mouseInCanvas = {
        x: mouseInContainer.x + el.scrollLeft,
        y: mouseInContainer.y + el.scrollTop,
      };
      const oldScale = pdf.scale;
      const mouseInPdf = { x: mouseInCanvas.x / oldScale, y: mouseInCanvas.y / oldScale };

      const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.min(3, Math.max(0.25, oldScale * factor));
      if (newScale === oldScale) return;

      pendingZoomFocusRef.current = { mouseInPdf, mouseInContainer };
      updatePdf(pdf.id, { scale: newScale });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pdf, updatePdf]);

  // After a wheel-zoom causes a re-render, restore scroll so the cursor stays anchored.
  useEffect(() => {
    if (!pendingZoomFocusRef.current || !scrollContainerRef.current || !pdf) return;
    const { mouseInPdf, mouseInContainer } = pendingZoomFocusRef.current;
    const s = pdf.scale;
    scrollContainerRef.current.scrollLeft = mouseInPdf.x * s - mouseInContainer.x;
    scrollContainerRef.current.scrollTop = mouseInPdf.y * s - mouseInContainer.y;
    pendingZoomFocusRef.current = null;
  }, [dimensions, pdf?.scale]);

  // Monitor PDF Canvas size changes to update GameCanvas size
  useEffect(() => {
    if (!pdfCanvasRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(pdfCanvasRef.current);

    // Initial check
    if (pdfCanvasRef.current.width !== dimensions.width || pdfCanvasRef.current.height !== dimensions.height) {
      setDimensions({
        width: pdfCanvasRef.current.width,
        height: pdfCanvasRef.current.height
      });
    }

    return () => observer.disconnect();
  }, [pdfCanvasRef, pdf]); // Re-run if pdf changes (might trigger re-render of canvas)

  const calculateHeight = (canvas) => {
    if (!canvas) {
      console.log('Canvas not available yet');
      return 'auto';
    }

    // Get browser window height
    const windowHeight = window.innerHeight;
    //console.log('Window height:', windowHeight);
    
    // Set scroll container max height to window height minus some offset (e.g., for header)
    if (scrollContainerRef.current) {
      const offset = 0; // In case I ever need it
      const maxHeight = windowHeight - offset;
      scrollContainerRef.current.style.maxHeight = `${maxHeight}px`;
      //console.log('Setting scroll container max height to:', maxHeight);
    }

    // If the canvas height is less than the container height, use '100%' to fill the space
    if (scrollContainerRef.current && canvas.height < scrollContainerRef.current.clientHeight) {
      //console.log('Using 100% height to fill container');
      //console.log('Container height:', scrollContainerRef.current.clientHeight, " Canvas height:", canvas.height);
      return '100%';
    }
    //console.log('Using canvas height:', canvas.height);
    //console.log('Container height:', scrollContainerRef.current.clientHeight, " Canvas height:", canvas.height);
    return canvas.height;
  }


  const renderEmptyState = () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-gray-500">
        <FileText size={48} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold mb-2">
          {isDualPaneMode
            ? `No PDF in ${paneId} pane`
            : 'No PDF Loaded'
          }
        </h3>
        {!isDualPaneMode && (
          <>
            <p className="mb-2">Upload a PDF file to get started.</p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>✓ Draggable game tokens</p>
              <p>✓ Custom character sheets</p>
              <p>✓ Advanced dice expressions</p>
              <p>✓ Layer-based annotations</p>
            </div>
          </>
        )}
        {isDualPaneMode && paneId === 'secondary' && (
          <p className="text-sm">Click on a PDF tab to display it here</p>
        )}
      </div>
    </div>
  );

  const handleGoToPage = (pageNum) => {
    goToPage(pageNum, pdf.id);
  };

  const handleZoomIn = () => {
    zoomIn(pdf.id);
  };

  const handleZoomOut = () => {
    zoomOut(pdf.id);
  };

  const cursorForTool = (tool) => {
    if (tool === 'text') return 'text';
    if (tool === 'select' || tool === 'pan') return 'default';
    if (tool === 'eraser') return 'none';
    if (tool === 'draw') return DRAW_CURSOR;
    return 'crosshair';
  };

  const handlePanMouseDown = (e) => {
    if (selectedTool !== 'pan' || !scrollContainerRef.current) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startScrollLeft = scrollContainerRef.current.scrollLeft;
    const startScrollTop = scrollContainerRef.current.scrollTop;

    const handleMove = (moveEvent) => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.scrollLeft = startScrollLeft - (moveEvent.clientX - startX);
      scrollContainerRef.current.scrollTop = startScrollTop - (moveEvent.clientY - startY);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    e.preventDefault();
  };

  // Get current layers
  const currentLayers = pdf && pdf.pageLayers && pdf.pageLayers[pdf.currentPage]
    ? pdf.pageLayers[pdf.currentPage]
    : [
      { id: LAYER_TOKENS, name: 'Game Tokens', objects: [], visible: true, locked: false },
      { id: LAYER_DRAWINGS, name: 'Drawings', objects: [], visible: true, locked: false },
      { id: LAYER_TEXT, name: 'Text & Notes', objects: [], visible: true, locked: false }
    ];

  // If we modify currentLayers, `onLayerUpdate` should handle saving it back to state.

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col h-full relative">
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0"
        style={{ overflow: 'auto' }}
      >
        {pdf ? (
          <div className="relative">
            <div
              className="relative"
              style={{
                width: dimensions.width || 'auto',
                height: dimensions.height || 'auto',
                cursor: cursorForTool(selectedTool),
              }}
            >
              <canvas
                ref={pdfCanvasRef}
                className="block shadow-lg border border-gray-300 rounded"
                style={{ background: 'white' }}
              />
              {dimensions.width > 0 && (
                <GameCanvas
                  layers={currentLayers}
                  width={dimensions.width}
                  height={dimensions.height}
                  scale={pdf.scale}
                  tool={selectedTool}
                  selectedColor={selectedColor}
                  selectedTokenShape={selectedTokenShape}
                  selectedTokenColor={selectedTokenColor}
                  tokenSize={tokenSize}
                  lineWidth={state.lineWidth}
                  onUpdate={onLayerUpdate}
                  pdfId={pdf.id}
                  pageId={pdf.currentPage}
                  tokenPacks={state.tokenPacks}
                  embeddedTokens={state.embeddedTokens}
                />
              )}
              {selectedTool === 'pan' && (
                <div
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  style={{ zIndex: 10 }}
                  onMouseDown={handlePanMouseDown}
                />
              )}
            </div>
          </div>
        ) : (
          renderEmptyState()
        )}
      </div>

      <PDFControlsBar
        pdf={pdf}
        paneId={paneId}
        layers={currentLayers}
        onLayerUpdate={onLayerUpdate}
        pdfId={pdf?.id}
        pageId={pdf?.currentPage}
        onGoToPage={handleGoToPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onBookmarkNavigate={onBookmarkNavigate}
      />
    </div>
  );
};

export default PDFViewer;