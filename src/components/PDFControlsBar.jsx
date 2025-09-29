import React, { useState, useRef, useEffect, useContext } from 'react';
import { ChevronLeft, ChevronRight, ZoomOut, ZoomIn, Layers, Eye, EyeOff, Trash2, X, Settings, BookOpen } from 'lucide-react';
import { AppContext } from '../state/appState';

const PDFControlsBar = ({
  pdf,
  paneId,
  canvas,
  onGoToPage,
  onZoomIn,
  onZoomOut,
  onBookmarkNavigate
}) => {
  const { state, dispatch } = useContext(AppContext);
  const { isDualPaneMode } = state;

  const [localDropdownOpen, setLocalDropdownOpen] = useState(false);
  const [tocDropdownOpen, setTocDropdownOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [layersMenuStyle, setLayersMenuStyle] = useState({});
  const [tocMenuStyle, setTocMenuStyle] = useState({});
  const controlsRef = useRef(null);

  // Calculate optimal position for popups based on controls position
  const calculateMenuPosition = (menuWidth = 256, menuHeight = 200) => {
    if (!controlsRef.current) return {};

    const controlsRect = controlsRef.current.getBoundingClientRect();
    const newStyle = {};

    // Always position below the controls since they're at the top
    newStyle.top = `${controlsRect.height + 8}px`;
    newStyle.left = 0;

    // Adjust if would go off right edge
    if (controlsRect.left + menuWidth > window.innerWidth) {
      newStyle.right = 0;
      newStyle.left = 'auto';
    }

    return newStyle;
  };

  useEffect(() => {
    if (localDropdownOpen) {
      setLayersMenuStyle(calculateMenuPosition(256, 200));
    }
  }, [localDropdownOpen]);

  useEffect(() => {
    if (tocDropdownOpen) {
      setTocMenuStyle(calculateMenuPosition(320, 300));
    }
  }, [tocDropdownOpen]);

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

  const handleBookmarkClick = async (bookmark) => {
    if (bookmark.dest && onBookmarkNavigate) {
      await onBookmarkNavigate(bookmark.dest, pdf.id);
    }
    setTocDropdownOpen(false);
    // Only force collapse if not pinned
    if (!isPinned) {
      setIsExpanded(false);
    }
  };

  const handleGearClick = () => {
    setIsPinned(!isPinned);
    if (!isPinned) {
      // Pinning - ensure expanded
      setIsExpanded(true);
    }
  };

  const renderBookmarkItem = (bookmark, level = 0) => {
    const indent = level * 16;

    return (
      <div key={bookmark.title + level}>
        <button
          onClick={() => handleBookmarkClick(bookmark)}
          className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-start gap-2"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className="flex-1 break-words leading-tight">
            {bookmark.title}
          </span>
        </button>

        {bookmark.items && bookmark.items.map(child =>
          renderBookmarkItem(child, level + 1)
        )}
      </div>
    );
  };

  if (!pdf) return null;

  return (
    <div
      ref={controlsRef}
      className="absolute top-4 left-4 z-20"
    >
        <div
            className="flex items-center"
            onMouseEnter={() => !isPinned && setIsExpanded(true)}
            onMouseLeave={() => {
                if (!isPinned && !localDropdownOpen && !tocDropdownOpen) {
                    setIsExpanded(false);
                }
            }}
        >
        {/* Gear Icon (always visible) - now clickable with hover */}
        <button
          onClick={handleGearClick}
          className={`flex items-center backdrop-blur-sm rounded-lg border p-2 shadow-sm transition-colors ${
            isPinned
              ? 'bg-blue-100/70 border-blue-300/50 dark:bg-blue-900/30 dark:border-blue-600/50'
              : 'bg-white/30 border-gray-200/30 dark:bg-gray-800/30 dark:border-gray-700/30'
          }`}
          title={isPinned ? "Unpin controls" : "Pin controls"}
        >
          <Settings size={16} className={`transition-colors ${
            isPinned
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-300'
          }`} />
        </button>

        {/* Expandable Controls */}
        <div
          className={`flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-lg border border-gray-200/50 ml-2 px-2 py-1 shadow-sm transition-all duration-300 dark:bg-gray-800/70 dark:border-gray-700/50 ${
            isExpanded || isPinned ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
          }`}
        >
          {/* Table of Contents */}
          {pdf.bookmarks && pdf.bookmarks.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setTocDropdownOpen(!tocDropdownOpen)}
                className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-200/80 dark:hover:bg-gray-600/80"
                title="Table of Contents"
              >
                <BookOpen size={16} />
              </button>

              {tocDropdownOpen && (
                <div
                  className="absolute w-80 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg z-30 border border-gray-200 dark:bg-gray-800/95 dark:border-gray-700"
                  style={tocMenuStyle}
                  onClick={e => e.stopPropagation()}
                  onMouseEnter={() => setIsExpanded(true)}
                  onMouseLeave={() => {
                    setTocDropdownOpen(false);
                    setIsExpanded(false);
                  }}
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      Table of Contents
                    </h4>
                    <button
                      onClick={() => setTocDropdownOpen(false)}
                      className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white"
                      aria-label="Close table of contents"
                    >
                      <X size={14}/>
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {pdf.bookmarks.map((bookmark, index) =>
                      renderBookmarkItem(bookmark, 0)
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
                style={layersMenuStyle}
                onClick={e => e.stopPropagation()}
                onMouseEnter={() => setIsExpanded(true)}
                onMouseLeave={() => {
                  setLocalDropdownOpen(false);
                  setIsExpanded(false);
                }}
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
              onClick={() => onGoToPage(pdf.currentPage - 1)}
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
              onClick={() => onGoToPage(pdf.currentPage + 1)}
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
              onClick={onZoomOut}
              className="p-1 rounded-r-none hover:bg-gray-200/80 dark:hover:bg-gray-600/80"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-medium px-2 py-1 min-w-[45px] text-center border-x border-gray-300 dark:border-gray-600">
              {Math.round(pdf.scale * 100)}%
            </span>
            <button
              onClick={onZoomIn}
              className="p-1 rounded-l-none hover:bg-gray-200/80 dark:hover:bg-gray-600/80"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFControlsBar;