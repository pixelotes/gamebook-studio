import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../state/appState';
import { FileText, ChevronLeft, ChevronRight, ZoomOut, ZoomIn, Layers, Eye, EyeOff, Trash2, X, GripVertical } from 'lucide-react';

const PDFViewer = ({
  pdfCanvasRef,
  overlayCanvasRef,
  pdf,
  paneId = 'primary',
  // New props for tabs
  pdfs,
  activePdfId,
  secondaryPdfId,
  closePdf,
  movePdfToPane,
  updatePdf
}) => {
  const { state, dispatch, fabricCanvas, secondaryFabricCanvas, goToPage, zoomIn, zoomOut } = useContext(AppContext);
  const { selectedTool, isDualPaneMode } = state;
  const [localDropdownOpen, setLocalDropdownOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [menuStyle, setMenuStyle] = useState({});
  const dragOffset = useRef({ x: 0, y: 0 });
  const controlsRef = useRef(null);

  // Calculate optimal position for layers dropdown based on controls position
  useEffect(() => {
    if (localDropdownOpen && controlsRef.current) {
      const controlsRect = controlsRef.current.getBoundingClientRect();
      const menuWidth = 256; // w-64 = 16rem = 256px
      const menuHeight = 200; // Estimated height for the menu
      const buffer = 16; // Buffer from window edges

      const newStyle = {};

      // --- Vertical Positioning ---
      // If there isn't enough space above the controls, place the menu below
      if (controlsRect.top < menuHeight + buffer) {
        newStyle.top = `${controlsRect.height + 8}px`; // 8px margin
      } else {
        // Otherwise, place it above
        newStyle.bottom = `${controlsRect.height + 8}px`;
      }

      // --- Horizontal Positioning ---
      // If the controls are too close to the right edge, align menu's right side with controls' right side
      if (controlsRect.left + menuWidth > window.innerWidth) {
        newStyle.right = 0;
      } else {
        // Otherwise, align their left sides
        newStyle.left = 0;
      }

      setMenuStyle(newStyle);
    }
  }, [localDropdownOpen, position]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      // Simple position update based on mouse position and drag offset
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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

  const truncateFileName = (name) => {
    if (name.length > 20) {
      return name.substring(0, 18) + '...';
    }
    return name;
  };

  const handleToggleVisibility = (layerId) => {
    canvas?.toggleLayerVisibility(layerId);
    dispatch({ type: 'SET_STATE', payload: { layerStateKey: state.layerStateKey + 1 } });
  };

  const handleSetActiveLayer = (layerId) => {
    canvas?.setActiveLayer(layerId);
    dispatch({ type: 'SET_STATE', payload: { layerStateKey: state.layerStateKey + 1 } });
    setLocalDropdownOpen(false);
  };

  const handleClearLayer = (layerId) => {
    if (window.confirm('Are you sure you want to clear all items from this layer? This action cannot be undone.')) {
      canvas?.clearLayer(layerId);
      dispatch({ type: 'SET_STATE', payload: { layerStateKey: state.layerStateKey + 1 } });
    }
  };

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

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const rect = controlsRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const renderPdfControls = () => (
    <div
      ref={controlsRef}
      className={`absolute z-20 flex items-center gap-2 transition-opacity duration-200 ${
        isHovering || isDragging || localDropdownOpen ? 'opacity-100' : 'opacity-30'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Main Controls */}
      <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-lg border border-gray-200/50 px-2 py-1 shadow-sm transition-all duration-200 hover:bg-white/90 hover:border-gray-200 dark:bg-gray-800/70 dark:border-gray-700/50 dark:hover:bg-gray-800/90 dark:hover:border-gray-700">
        <GripVertical size={16} className="text-gray-400" />
        {/* Layer Controls */}
        <div className="relative">
          <button
            onClick={() => setLocalDropdownOpen(!localDropdownOpen)}
            className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-200/80 dark:hover:bg-gray-600/80"
            title={`Manage ${paneId} layers`}
          >
            <Layers size={16} />
          </button>

          {localDropdownOpen && canvas && (
            <div 
              className="absolute w-64 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg z-30 border border-gray-200 p-2 space-y-1 dark:bg-gray-800/95 dark:border-gray-700"
              style={menuStyle}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-2 py-1 text-xs font-bold text-gray-500 border-b -mx-2 mb-1 pb-2 dark:text-gray-400 dark:border-gray-600">
                {isDualPaneMode && `${paneId.charAt(0).toUpperCase() + paneId.slice(1)} - `}
                Active: <span className="text-blue-600 dark:text-blue-400">{canvas.layers.find(l => l.id === canvas.activeLayer)?.name}</span>
              </div>
              {canvas.layers.map(layer => (
                <div key={layer.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleVisibility(layer.id)}
                      className={`p-1 rounded ${layer.visible ? 'text-blue-500' : 'text-gray-400'}`}
                      title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                    >
                      {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={() => handleSetActiveLayer(layer.id)}
                      className={`text-sm text-left ${canvas.activeLayer === layer.id ? 'font-bold' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {layer.name} ({layer.objects.length})
                    </button>
                  </div>
                  <button
                    onClick={() => handleClearLayer(layer.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Clear all objects from this layer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setLocalDropdownOpen(false)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white"
                aria-label="Close layers panel"
              >
                <X size={14}/>
              </button>
            </div>
          )}
        </div>
        {/* Page Navigation */}
        <div className="flex items-center rounded bg-gray-50/80 dark:bg-gray-700/80">
          <button
            onClick={() => goToPage(pdf.currentPage - 1, pdf.id)}
            disabled={pdf.currentPage <= 1}
            className="p-1 rounded-r-none hover:bg-gray-200/80 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-600/80"
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium px-2 py-1 min-w-[60px] text-center border-x border-gray-300 dark:border-gray-600">
            {pdf.currentPage} / {pdf.totalPages}
          </span>
          <button
            onClick={() => goToPage(pdf.currentPage + 1, pdf.id)}
            disabled={pdf.currentPage >= pdf.totalPages}
            className="p-1 rounded-l-none hover:bg-gray-200/80 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-600/80"
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center rounded bg-gray-50/80 dark:bg-gray-700/80">
          <button
            onClick={() => zoomOut(pdf.id)}
            className="p-1 rounded-r-none hover:bg-gray-200/80 dark:hover:bg-gray-600/80"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-medium px-2 py-1 min-w-[45px] text-center border-x border-gray-300 dark:border-gray-600">
            {Math.round(pdf.scale * 100)}%
          </span>
          <button
            onClick={() => zoomIn(pdf.id)}
            className="p-1 rounded-l-none hover:bg-gray-200/80 dark:hover:bg-gray-600/80"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderTabs = () => (
    <div className="bg-gray-200 flex items-center dark:bg-gray-800">
      {!isDualPaneMode ? (
        // Single pane tabs
        pdfs.map(p => (
          <div
            key={p.id}
            onClick={() => dispatch({ type: 'SET_STATE', payload: { activePdfId: p.id } })}
            className={`flex items-center gap-2 px-4 py-2 cursor-pointer ${p.id === activePdfId ? 'bg-white dark:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
          >
            <span className="text-sm">{truncateFileName(p.fileName)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closePdf(p.id);
              }}
              className="p-1 rounded-full hover:bg-red-500 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        ))
      ) : (
        // Dual pane tabs
        <>
          {/* Primary pane tabs */}
          {pdfs.map(p => (
            <div
              key={`primary-${p.id}`}
              onClick={() => dispatch({ type: 'SET_STATE', payload: { activePdfId: p.id } })}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${p.id === activePdfId ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              <span>{truncateFileName(p.fileName)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closePdf(p.id);
                }}
                className="p-1 rounded-full hover:bg-red-500 hover:text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderSecondaryTabs = () => (
    <div className="bg-gray-200 flex items-center dark:bg-gray-800">
      {pdfs.map(p => (
        <div
          key={`secondary-${p.id}`}
          onClick={() => dispatch({ type: 'SET_STATE', payload: { secondaryPdfId: p.id } })}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${p.id === secondaryPdfId ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
          <span>{truncateFileName(p.fileName)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col h-full relative">
      {pdfs.length > 0 && (
        paneId === 'primary' ? renderTabs() : renderSecondaryTabs()
      )}
      <div ref={scrollContainerRef} className="flex-1 flex justify-center" style={{ overflow: 'auto' }}>
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
      {pdf && renderPdfControls()}
    </div>
  );
};

export default PDFViewer;