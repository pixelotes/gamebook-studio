import React, { useContext, useRef, useEffect } from 'react';
import { AppContext } from '../state/appState';
import { FileText } from 'lucide-react';
import PDFControlsBar from './PDFControlsBar';

const PDFViewer = ({
  pdfCanvasRef,
  overlayCanvasRef,
  pdf,
  paneId = 'primary',
  updatePdf,
  onBookmarkNavigate
}) => {
  const { state, fabricCanvas, secondaryFabricCanvas, goToPage, zoomIn, zoomOut } = useContext(AppContext);
  const { selectedTool, isDualPaneMode } = state;
  const scrollContainerRef = useRef(null);

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

  // Get the appropriate canvas
  const canvas = paneId === 'primary' ? fabricCanvas.current : secondaryFabricCanvas.current;

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

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col h-full relative">
      <div ref={scrollContainerRef} className="flex-1" style={{ overflow: 'auto' }}>
        {pdf ? (
          <div className="relative">
            <div
              className="relative"
              style={{
                width: pdfCanvasRef.current ? pdfCanvasRef.current.width : 'auto',
                height: pdfCanvasRef.current ? pdfCanvasRef.current.height : 'auto',
              }}
            >
              <canvas
                ref={pdfCanvasRef}
                className="block shadow-lg border border-gray-300 rounded"
                style={{ background: 'white' }}
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 pointer-events-auto rounded"
                style={{
                  zIndex: 10,
                  cursor: selectedTool === 'select' ? 'default' : 'crosshair'
                }}
              />
            </div>
          </div>
        ) : (
          renderEmptyState()
        )}
      </div>
      
      <PDFControlsBar
        pdf={pdf}
        paneId={paneId}
        canvas={canvas}
        onGoToPage={handleGoToPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onBookmarkNavigate={onBookmarkNavigate}
      />
    </div>
  );
};

export default PDFViewer;
