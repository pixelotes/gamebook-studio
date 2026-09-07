import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../state/appState';
import {
  PanelLeft, ChevronDown,
  Move, Stamp, Square, Type, Pen, Eraser, Circle, MousePointerClick, Ruler, Signal, Package, Hand
} from 'lucide-react';
import { TOKEN_SHAPES } from '../data/Shapes';
import { SHORTCUT_FOR_TOOL } from '../data/ToolShortcuts';
import { TOKEN_COLORS } from '../data/Colors';
import TokenBrowser from './TokenBrowser';

const Toolbar = () => {
  const { state, dispatch } = useContext(AppContext);
  const {
    isSidebarVisible, activeDropdown, selectedTool, selectedColor,
    selectedTokenShape, selectedTokenColor, tokenSize, lineWidth
  } = state;

  const [tokenSearch, setTokenSearch] = useState('');
  const [showTokenBrowser, setShowTokenBrowser] = useState(false);
  const searchInputRef = useRef(null);
  const toolbarRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!activeDropdown) return;

    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        dispatch({ type: 'SET_STATE', payload: { activeDropdown: null } });
        setTokenSearch('');
      }
    };

    // Use mousedown for faster response
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown, dispatch]);

  // This effect reliably focuses the search input when the dropdown is opened
  useEffect(() => {
    if (activeDropdown === 'tokenShape' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 0);
    }
  }, [activeDropdown]);

  const setIsSidebarVisible = (isVisible) => {
    dispatch({ type: 'SET_STATE', payload: { isSidebarVisible: isVisible } });
  };

  const setActiveDropdown = (dropdown) => {
    const newDropdown = dropdown === activeDropdown ? null : dropdown;
    dispatch({ type: 'SET_STATE', payload: { activeDropdown: newDropdown } });
    if (newDropdown !== 'tokenShape') {
      setTokenSearch('');
    }
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
    { id: 'select', icon: Move, label: 'Drag' },
    { id: 'pan', icon: Hand, label: 'Pan' },
    { id: 'token', icon: Stamp, label: 'Token' },
    { id: 'pointer', icon: MousePointerClick, label: 'Pointer' },
    { id: 'ruler', icon: Ruler, label: 'Ruler' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'draw', icon: Pen, label: 'Draw' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  const filteredTokenShapes = Object.entries(TOKEN_SHAPES).filter(([key, shape]) =>
    shape.name.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  return (
    <>
      <div ref={toolbarRef} className="bg-white border-b border-gray-200 px-3 py-1 flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title={isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
          >
            <PanelLeft size={16} />
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

          <div className="flex items-center gap-2">
            {/* Tool Selection */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown('tools')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm dark:hover:bg-gray-700 dark:border-gray-600"
              >
                <span className="flex-shrink-0">
                  {(() => {
                    const Icon = tools.find(t => t.id === selectedTool)?.icon;
                    return Icon ? <Icon size={16} /> : null;
                  })()}
                </span>
                <span className="font-medium">{tools.find(t => t.id === selectedTool)?.label ?? selectedTool}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>
              {activeDropdown === 'tools' && (
                <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                  {tools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setSelectedTool(tool.id);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <tool.icon size={16} />
                      <span className="flex-1">{tool.label}</span>
                      {SHORTCUT_FOR_TOOL[tool.id] && (
                        <kbd className="px-1.5 py-0.5 text-xs rounded border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400">
                          {SHORTCUT_FOR_TOOL[tool.id]}
                        </kbd>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color Selection for non-token tools */}
            {!['select', 'eraser', 'token', 'pan'].includes(selectedTool) && (
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown('color')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm dark:hover:bg-gray-700 dark:border-gray-600"
                  title="Select color"
                >
                  <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: selectedColor }} />
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
                {activeDropdown === 'color' && (
                  <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                    {TOKEN_COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => {
                          setSelectedColor(color.value);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: color.value }} />
                        {color.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Line Width for Draw Tool */}
            {selectedTool === 'draw' && (
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown('lineWidth')}
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

            {/* Token Controls */}
            {selectedTool === 'token' && (
              <>
                {/* Token Shape */}
                {/* Token Browser Trigger */}
                <button
                  onClick={() => setShowTokenBrowser(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm dark:hover:bg-gray-700 dark:border-gray-600"
                  title="Select Token"
                >
                  <Package size={16} />
                  <span className="font-medium">Token Library</span>
                </button>

                {/* Token Color */}
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown('tokenColor')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm dark:hover:bg-gray-700 dark:border-gray-600"
                    title="Select token color"
                  >
                    <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: selectedTokenColor }} />
                    <ChevronDown size={14} className="text-gray-500" />
                  </button>
                  {activeDropdown === 'tokenColor' && (
                    <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                      {TOKEN_COLORS.map(color => (
                        <button
                          key={color.value}
                          onClick={() => { setSelectedTokenColor(color.value); setActiveDropdown(null); }}
                          className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: color.value }} />
                          {color.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Token Size Slider */}
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
      {showTokenBrowser && <TokenBrowser onClose={() => setShowTokenBrowser(false)} />}
    </>
  );
};

export default Toolbar;