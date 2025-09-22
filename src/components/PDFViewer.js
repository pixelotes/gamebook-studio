import React from 'react';
import { FileText } from 'lucide-react';

const PDFViewer = ({ activePdf, pdfCanvasRef, overlayCanvasRef, selectedTool }) => {
  return (
    <div className="flex-1 bg-gray-50 relative overflow-auto p-4">
      {activePdf ? (
        <div className="relative inline-block mx-auto">
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
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <FileText size={64} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold mb-2">No PDF Loaded</h2>
            <p className="mb-2">Upload a PDF file to get started with your gamebook or print-and-play game.</p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>✓ Draggable game tokens</p>
              <p>✓ Custom character sheets</p>
              <p>✓ Advanced dice expressions</p>
              <p>✓ Layer-based annotations</p>
              <p>✓ Real PDF rendering</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;