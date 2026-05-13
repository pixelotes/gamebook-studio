import React, { useContext, useRef, useEffect, useState } from 'react';
import { AppContext } from '../state/appState';
import { FileText } from 'lucide-react';
import PDFControlsBar from './PDFControlsBar';
import GameCanvas from './canvas/GameCanvas';

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
    const calculateInitialScale = async () => {
      // Check if pdf exists, initial scale hasn't been set, and the container is rendered
      if (pdf && pdf.initialScaleSet === false && scrollContainerRef.current) {
        const viewerHeight = scrollContainerRef.current.clientHeight;

        // Ensure we have a valid height to prevent division by zero
        if (viewerHeight > 0) {
          try {
            const page = await pdf.pdfDoc.getPage(1); // Get page 1 for dimensions
            const viewport = page.getViewport({ scale: 1 });
            const verticalPadding = 32; // Add some padding so it's not edge-to-edge

            // Calculate scale and ensure it's not excessively large
            const newScale = Math.min(2, (viewerHeight - verticalPadding) / viewport.height);

            updatePdf(pdf.id, { scale: newScale, initialScaleSet: true });
          } catch (error) {
            console.error("Error calculating initial PDF scale:", error);
            // If something goes wrong, mark it as set to avoid loops
            updatePdf(pdf.id, { initialScaleSet: true });
          }
        }
      }
    };

    // Delay calculation to ensure DOM has settled, then clear timeout
    const timerId = setTimeout(calculateInitialScale, 100);
    return () => clearTimeout(timerId);

  }, [pdf, updatePdf]);

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
      { id: 'tokens', name: 'Game Tokens', objects: [], visible: true, locked: false },
      { id: 'drawings', name: 'Drawings', objects: [], visible: true, locked: false },
      { id: 'text', name: 'Text & Notes', objects: [], visible: true, locked: false }
    ];

  // We actually need to ensure the structure exists if it's undefined, similar to MockFabricCanvas logic
  // But passing it as default value above is safer for declarative rendering.
  // If we modify it, `onLayerUpdate` should handle saving it back to state.

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
