import React, { useContext } from 'react';
import { AppContext } from '../state/appState';
import {
  PanelLeft, ChevronLeft, ChevronRight, ZoomOut, ZoomIn, Layers, ChevronDown, Eye, EyeOff, Trash2,
  Move, Stamp, Square, Type, Pen, Eraser, Circle, MousePointerClick, Ruler, Signal
} from 'lucide-react';
import { TOKEN_SHAPES } from '../data/Shapes';
import { TOKEN_COLORS } from '../data/Colors';

const Toolbar = () => {
  const { state, dispatch, fabricCanvas, goToPage, zoomIn, zoomOut, activePdf } = useContext(AppContext);
  const {
    isSidebarVisible, activeDropdown, selectedTool, selectedColor,
    selectedTokenShape, selectedTokenColor, tokenSize, lineWidth
  } = state;

  const setIsSidebarVisible = (isVisible) => {
    dispatch({ type: 'SET_STATE', payload: { isSidebarVisible: isVisible } });
  };

  const setActiveDropdown = (dropdown) => {
    dispatch({ type: 'SET_STATE', payload: { activeDropdown: dropdown } });
  };

  const setSelectedTool = (tool) => {
    dispatch({ type: 'SET_STATE', payload: { selectedTool: tool } });
  };

  const setSelectedColor = (color) => {
    dispatch({ type: 'SET_STATE', payload: { selectedColor: color } });
  };

  const setSelectedTokenShape = (shape) => {
    dispatch({ type: 'SET_STATE', payload: { selectedTokenShape: shape } });
  };

  const setSelectedTokenColor = (color) => {
    dispatch({ type: 'SET_STATE', payload: { selectedTokenColor: color } });
  };

  const setTokenSize = (size) => {
    dispatch({ type: 'SET_STATE', payload: { tokenSize: size } });
  };

  const handleToggleVisibility = (layerId) => {
    fabricCanvas.current?.toggleLayerVisibility(layerId);
    dispatch({ type: 'SET_STATE', payload: { layerStateKey: state.layerStateKey + 1 } });
  };

  const handleSetActiveLayer = (layerId) => {
    fabricCanvas.current?.setActiveLayer(layerId);
    dispatch({ type: 'SET_STATE', payload: { layerStateKey: state.layerStateKey + 1 } });
    setActiveDropdown(null);
  };

  const handleClearLayer = (layerId) => {
    if (window.confirm('Are you sure you want to clear all items from this layer? This action cannot be undone.')) {
      fabricCanvas.current?.clearLayer(layerId);
      dispatch({ type: 'SET_STATE', payload: { layerStateKey: state.layerStateKey + 1 } });
    }
  };

  const setLineWidth = (width) => {
    dispatch({ type: 'SET_STATE', payload: { lineWidth: width } });
  };
  
  const lineWidths = [
    { value: 1, label: 'Thin' },
    { value: 3, label: 'Normal' },
    { value: 8, label: 'Thick' },
    { value: 15, label: 'Heavy' },
  ];

  const tools = [
    { id: 'select', icon: Move, label: 'Select' },
    { id: 'token', icon: Stamp, label: 'Token' },
    { id: 'pointer', icon: MousePointerClick, label: 'Pointer' },
    { id: 'ruler', icon: Ruler, label: 'Ruler' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'draw', icon: Pen, label: 'Draw' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-1 flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          className="p-2 rounded-md hover:bg-gray-100"
          title={isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          <PanelLeft size={16} />
        </button>
        <div className="h-6 w-px bg-gray-200"></div>

        {activePdf && (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(activePdf.currentPage - 1)}
                disabled={activePdf.currentPage <= 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">
                {activePdf.currentPage} / {activePdf.totalPages}
              </span>
              <button
                onClick={() => goToPage(activePdf.currentPage + 1)}
                disabled={activePdf.currentPage >= activePdf.totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={zoomOut} className="p-1 rounded hover:bg-gray-100" title="Zoom out">
                <ZoomOut size={16} />
              </button>
              <span className="text-sm font-medium w-12 text-center">
                {Math.round(activePdf.scale * 100)}%
              </span>
              <button onClick={zoomIn} className="p-1 rounded hover:bg-gray-100" title="Zoom in">
                <ZoomIn size={16} />
              </button>
            </div>
          </>
        )}

        <div className="h-6 w-px bg-gray-300"></div>

        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'layers' ? null : 'layers')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
            title="Manage Layers"
            disabled={!activePdf}
          >
            <Layers size={16} />
            <ChevronDown size={14} className="text-gray-500" />
          </button>
          {activeDropdown === 'layers' && fabricCanvas.current && (
            <div className="absolute top-full mt-2 w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2 space-y-1">
              <div className="px-2 py-1 text-xs font-bold text-gray-500 border-b -mx-2 mb-1 pb-2">
                Active Layer: <span className="text-blue-600">{fabricCanvas.current.layers.find(l => l.id === fabricCanvas.current.activeLayer)?.name}</span>
              </div>
              {fabricCanvas.current.layers.map(layer => (
                <div key={layer.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleVisibility(layer.id)}
                      className={`p-1 rounded ${layer.visible ? 'text-blue-500' : 'text-gray-400'}`}
                      title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                    >
                      {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={() => handleSetActiveLayer(layer.id)}
                      className={`text-sm text-left ${fabricCanvas.current.activeLayer === layer.id ? 'font-bold' : 'text-gray-700'}`}
                    >
                      {layer.name} ({layer.objects.length})
                    </button>
                  </div>
                  <button
                    onClick={() => handleClearLayer(layer.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Clear all objects from this layer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-300"></div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'tools' ? null : 'tools')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
            >
              <span className="flex-shrink-0">
                {(() => {
                  const Icon = tools.find(t => t.id === selectedTool)?.icon;
                  return Icon ? <Icon size={16} /> : null;
                })()}
              </span>
              <span className="font-medium capitalize">{selectedTool}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            {activeDropdown === 'tools' && (
              <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                {tools.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setSelectedTool(tool.id);
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <tool.icon size={16} />
                    {tool.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!['select', 'eraser', 'token'].includes(selectedTool) && (
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
                title="Select color"
              >
                <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: selectedColor }} />
                <ChevronDown size={14} className="text-gray-500" />
              </button>
              {activeDropdown === 'color' && (
                <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                  {TOKEN_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => {
                        setSelectedColor(color.value);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: color.value }}/>
                      {color.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

                    {selectedTool === 'draw' && (
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'lineWidth' ? null : 'lineWidth')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm dark:hover:bg-gray-700 dark:border-gray-600"
                title="Select line width"
              >
                <Signal size={16} />
                <span className="font-medium">{lineWidth}px</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>
              {activeDropdown === 'lineWidth' && (
                <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                  {lineWidths.map(width => (
                    <button
                      key={width.value}
                      onClick={() => {
                        setLineWidth(width.value);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <span>{width.label}</span>
                      <span className="text-xs text-gray-500">{width.value}px</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedTool === 'token' && (
            <>
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'tokenShape' ? null : 'tokenShape')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm w-32 justify-between"
                  title="Select token shape"
                >
                  <span className="text-lg">{TOKEN_SHAPES[selectedTokenShape].icon}</span>
                  <span className="font-medium capitalize">{TOKEN_SHAPES[selectedTokenShape].name}</span>
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
                {activeDropdown === 'tokenShape' && (
                  <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 max-h-[70vh] overflow-y-auto">
                    {Object.entries(TOKEN_SHAPES).map(([key, shape]) => (
                      <button 
                        key={key} 
                        onClick={() => { setSelectedTokenShape(key); setActiveDropdown(null); }} 
                        className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <span className="text-lg w-5 text-center">{shape.icon}</span>
                        {shape.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'tokenColor' ? null : 'tokenColor')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
                  title="Select token color"
                >
                  <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: selectedTokenColor }} />
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
                {activeDropdown === 'tokenColor' && (
                  <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                    {TOKEN_COLORS.map(color => (
                      <button 
                        key={color.value} 
                        onClick={() => { setSelectedTokenColor(color.value); setActiveDropdown(null); }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: color.value }} />
                        {color.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Circle size={14} className="text-gray-500" />
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={tokenSize}
                  onChange={(e) => setTokenSize(parseInt(e.target.value))}
                  className="w-24"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;