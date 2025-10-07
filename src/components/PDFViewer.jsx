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
        if (pdf && pdf.initialScaleSet !== true && scrollContainerRef.current) {
          const viewerHeight = scrollContainerRef.current.clientHeight;

          if (viewerHeight > 0) {
            try {
              const page = await pdf.pdfDoc.getPage(1);
              const viewport = page.getViewport({ scale: 1 });
              const verticalPadding = 32;
              
              const newScale = Math.min(2, (viewerHeight - verticalPadding) / viewport.height);

              updatePdf(pdf.id, { scale: newScale, initialScaleSet: true });
            } catch (error) {
              console.error("Error calculating initial PDF scale:", error);
              updatePdf(pdf.id, { initialScaleSet: true });
            }
          }
        }
      };

      const timerId = setTimeout(calculateInitialScale, 100);
      return () => clearTimeout(timerId);

    }, [pdf?.id, pdf?.initialScaleSet, updatePdf]);

  // Get the appropriate canvas
  const canvas = paneId === 'primary' ? fabricCanvas.current : secondaryFabricCanvas.current;

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

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col h-full relative">
      <div ref={scrollContainerRef} className="flex-1" style={{ overflow: 'auto' }}>
        {pdf ? (
          <div className="relative">
            <div
              className="relative"
              style={{
                width: pdfCanvasRef.current ? pdfCanvasRef.current.width : 'auto',
                height: calculateHeight(pdfCanvasRef.current),
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