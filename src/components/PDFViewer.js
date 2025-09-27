import React, { useContext, useState } from 'react';
import { AppContext } from '../state/appState';
import { FileText, ChevronLeft, ChevronRight, ZoomOut, ZoomIn, Layers, ChevronDown, Eye, EyeOff, Trash2 } from 'lucide-react';

// Add state for dropdown
const PDFViewer = ({ pdfCanvasRef, overlayCanvasRef, pdf, paneId = 'primary' }) => {
  const { state, dispatch, fabricCanvas, secondaryFabricCanvas, goToPage, zoomIn, zoomOut } = useContext(AppContext);
  const { selectedTool, isDualPaneMode } = state;
  const [localDropdownOpen, setLocalDropdownOpen] = useState(false);

  // Get the appropriate canvas
  const canvas = paneId === 'primary' ? fabricCanvas.current : secondaryFabricCanvas.current;

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
            <p className="mb-2">Upload a PDF file to get started with your gamebook or print-and-play game.</p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>✓ Draggable game tokens</p>
              <p>✓ Custom character sheets</p>
              <p>✓ Advanced dice expressions</p>
              <p>✓ Layer-based annotations</p>
              <p>✓ Real PDF rendering</p>
              <p>✓ Dual pane for reference materials</p>
            </div>
          </>
        )}
        {isDualPaneMode && paneId === 'secondary' && (
          <p className="text-sm">Click on a PDF tab above to display it here</p>
        )}
      </div>
    </div>
  );

const renderPdfControls = () => (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-1">
      {/* Main Controls */}
      <div className="flex items-center gap-0.5 bg-white/70 backdrop-blur-sm rounded-lg border border-gray-200/50 px-2 py-1 shadow-sm transition-all duration-200 hover:bg-white/90 hover:border-gray-200 dark:bg-gray-800/70 dark:border-gray-700/50 dark:hover:bg-gray-800/90 dark:hover:border-gray-700">
        {/* Pane Indicator */}
        {isDualPaneMode && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded mr-1 ${
            paneId === 'primary' 
              ? 'bg-blue-100/80 text-blue-700 dark:bg-blue-900/80 dark:text-blue-300'
              : 'bg-green-100/80 text-green-700 dark:bg-green-900/80 dark:text-green-300'
          }`}>
            {paneId === 'primary' ? 'P' : 'S'}
          </span>
        )}
        
        {/* Page Navigation */}
        <button
          onClick={() => goToPage(pdf.currentPage - 1, pdf.id)}
          disabled={pdf.currentPage <= 1}
          className="p-1 rounded hover:bg-gray-100/80 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700/80"
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        
        <span className="text-xs font-medium px-2 py-1 min-w-[60px] text-center bg-gray-50/80 rounded dark:bg-gray-700/80">
          {pdf.currentPage} / {pdf.totalPages}
        </span>
        
        <button
          onClick={() => goToPage(pdf.currentPage + 1, pdf.id)}
          disabled={pdf.currentPage >= pdf.totalPages}
          className="p-1 rounded hover:bg-gray-100/80 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700/80"
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>
        
        {/* Divider */}
        <div className="w-px h-4 bg-gray-300/60 mx-1 dark:bg-gray-600/60" />
        
        {/* Zoom Controls */}
        <button 
          onClick={() => zoomOut(pdf.id)} 
          className="p-1 rounded hover:bg-gray-100/80 dark:hover:bg-gray-700/80" 
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        
        <span className="text-xs font-medium px-2 py-1 min-w-[45px] text-center bg-gray-50/80 rounded dark:bg-gray-700/80">
          {Math.round(pdf.scale * 100)}%
        </span>
        
        <button 
          onClick={() => zoomIn(pdf.id)} 
          className="p-1 rounded hover:bg-gray-100/80 dark:hover:bg-gray-700/80" 
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-gray-300/60 mx-1 dark:bg-gray-600/60" />

        {/* Layer Controls */}
        <div className="relative">
          <button
            onClick={() => setLocalDropdownOpen(!localDropdownOpen)}
            className="flex items-center gap-1 p-1 rounded hover:bg-gray-100/80 dark:hover:bg-gray-700/80"
            title={`Manage ${paneId} layers`}
          >
            <Layers size={16} />
            <ChevronDown size={12} className="text-gray-500" />
          </button>
          
          {localDropdownOpen && canvas && (
            <div className="absolute bottom-full mb-2 right-0 w-64 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg z-30 border border-gray-200 p-2 space-y-1 dark:bg-gray-800/95 dark:border-gray-700">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 relative p-4" style={{ maxHeight: '100vh', overflow: 'auto' }}>
      {pdf ? (
        <div className="relative">
          {/* PDF Controls Overlay */}
          {renderPdfControls()}
          
          {/* PDF Canvas Container - with height constraint */}
          <div 
            className="relative inline-block mx-auto" 
            style={{ 
              maxHeight: 'calc(100vh - 120px)', // Account for padding and controls
              overflow: 'auto'
            }}
          >
            <canvas
              ref={pdfCanvasRef}
              className="block shadow-lg border border-gray-300 rounded"
              style={{ background: 'white' }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 right-0 pointer-events-auto rounded"
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
  );
};

export default PDFViewer;