import React, { useState, useMemo } from 'react';
import { X, Search, ChevronRight, ChevronDown, Copy } from 'lucide-react';
import { crc32 } from 'crc';

// Helper function to create a serializable copy of the game state
const getSerializableState = (state) => {
  if (!state) return null;
  const { pdfs, ...restOfState } = state;
  const serializablePdfs = pdfs?.map(p => {
    const { pdfDoc, file, ...restOfPdf } = p; // Exclude pdfDoc and file
    return restOfPdf;
  });
  return { ...restOfState, pdfs: serializablePdfs };
};


const DebugModal = ({ isOpen, onClose, gameState, gameStateVersion }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [copiedKey, setCopiedKey] = useState(null);

  // Create a serializable version of the state for display and CRC calculation
  const serializableGameState = useMemo(() => getSerializableState(gameState), [gameState]);


  // Calculate CRCs for different state slices
  const debugInfo = useMemo(() => {
    if (!serializableGameState) return {};
    const fullStateCrc = crc32(JSON.stringify(serializableGameState)).toString(16);

    // PDF-only state for partial CRC
    const pdfState = serializableGameState.pdfs || [];
    const pdfStateCrc = crc32(JSON.stringify(pdfState)).toString(16);

    // Layer-specific state
    const layerState = {};
    serializableGameState.pdfs?.forEach(p => {
      if (p.pageLayers && Object.keys(p.pageLayers).length > 0) {
        layerState[p.id] = p.pageLayers;
      }
    });
    const layerStateCrc = crc32(JSON.stringify(layerState)).toString(16);

    return {
      fullStateCrc,
      pdfStateCrc,
      layerStateCrc,
      timestamp: new Date().toISOString(),
      version: gameStateVersion || 0,
      totalPdfs: serializableGameState.pdfs?.length || 0,
      totalCharacters: serializableGameState.characters?.length || 0,
      totalCounters: serializableGameState.counters?.length || 0,
      activePdfId: serializableGameState.activePdfId,
      secondaryPdfId: serializableGameState.secondaryPdfId,
      isDualPaneMode: serializableGameState.isDualPaneMode,
    };
  }, [serializableGameState, gameStateVersion]);

  const toggleNode = (path) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const renderValue = (value, path = '', depth = 0) => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;

    const matchesSearch = searchTerm === '' ||
      JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase()) ||
      path.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch && searchTerm !== '') return null;

    const isExpanded = expandedNodes.has(path);

    if (typeof value === 'object' && value !== null) {
      const isArray = Array.isArray(value);
      const entries = isArray ? value : Object.entries(value);
      const isEmpty = entries.length === 0;

      if (isEmpty) {
        return (
          <span className="text-gray-600">
            {isArray ? '[]' : '{}'}
          </span>
        );
      }

      return (
        <div className="select-none">
          <button
            onClick={() => toggleNode(path)}
            className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -ml-1"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="text-gray-600">
              {isArray ? `Array(${entries.length})` : `Object`}
              <span className="text-xs ml-1 text-gray-400">
                {isArray ? `[${entries.length} items]` : `{${entries.length} keys}`}
              </span>
            </span>
          </button>

          {isExpanded && (
            <div className="ml-4 border-l border-gray-200 dark:border-gray-600 pl-2 mt-1">
              {isArray
                ? entries.map((item, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-purple-600 dark:text-purple-400 text-sm mr-2">
                        [{index}]:
                      </span>
                      {renderValue(item, `${path}[${index}]`, depth + 1)}
                    </div>
                  ))
                : entries.map(([key, val]) => (
                    <div key={key} className="mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                          {key}:
                        </span>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(val, null, 2), `${path}.${key}`)}
                          className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded"
                          title="Copy value"
                        >
                          <Copy size={10} />
                          {copiedKey === `${path}.${key}` && (
                            <span className="text-xs text-green-600 ml-1">✓</span>
                          )}
                        </button>
                      </div>
                      <div className="ml-2">
                        {renderValue(val, `${path}.${key}`, depth + 1)}
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      );
    }

    // Primitive values
    if (typeof value === 'string') {
      return <span className="text-green-600 dark:text-green-400">"{value}"</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-orange-600 dark:text-orange-400">{value}</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="text-red-600 dark:text-red-400">{value.toString()}</span>;
    }

    return <span className="text-gray-600">{String(value)}</span>;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Game State Debug Inspector
            </h2>
            <div className="text-sm text-gray-500">
              v{debugInfo.version} | {debugInfo.timestamp}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search keys and values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Debug Info Summary */}
        <div className="p-4 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Full State CRC</div>
              <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{debugInfo.fullStateCrc}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">PDF State CRC</div>
              <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{debugInfo.pdfStateCrc}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Layer State CRC</div>
              <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{debugInfo.layerStateCrc}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Resources</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {debugInfo.totalPdfs} PDFs, {debugInfo.totalCharacters} chars, {debugInfo.totalCounters} counters
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="font-mono text-sm group">
            {renderValue(serializableGameState, 'gameState')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugModal;