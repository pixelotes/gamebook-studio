import React, { useRef, useState } from 'react';
import TabBar from './TabBar';
import PDFViewer from './PDFViewer';

const PDFPane = ({
  pdfCanvasRef,
  pdf,
  paneId = 'primary',
  pdfs,
  activePdfId,
  secondaryPdfId,
  isDualPaneMode,
  closePdf,
  updatePdf,
  // Tab management functions
  onTabSelect,
  onTabClose,
  onBookmarkNavigate,
  onLayerUpdate,
  onFilesDropped,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  // Browsers fire dragenter/leave for every nested child traversal. Track depth
  // so the overlay only disappears when the drag really leaves the pane.
  const dragDepth = useRef(0);

  const hasFiles = (ev) => Array.from(ev.dataTransfer?.types || []).includes('Files');

  const handleDragEnter = (ev) => {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    dragDepth.current += 1;
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragOver = (ev) => {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (ev) => {
    if (!hasFiles(ev)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragOver(false);
  };

  const handleDrop = (ev) => {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    dragDepth.current = 0;
    setIsDragOver(false);
    const files = ev.dataTransfer.files;
    if (files && files.length > 0 && onFilesDropped) {
      onFilesDropped(files);
    }
  };

  return (
    <div
      className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {pdfs.length > 1 && (
        <TabBar
          pdfs={pdfs}
          activePdfId={activePdfId}
          secondaryPdfId={secondaryPdfId}
          paneId={paneId}
          isDualPaneMode={isDualPaneMode}
          onTabSelect={onTabSelect}
          onTabClose={onTabClose}
        />
      )}
      <PDFViewer
        pdfCanvasRef={pdfCanvasRef}
        pdf={pdf}
        paneId={paneId}
        updatePdf={updatePdf}
        onBookmarkNavigate={onBookmarkNavigate}
        onLayerUpdate={onLayerUpdate}
      />
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-blue-500/15 border-4 border-dashed border-blue-500 rounded">
          <div className="px-4 py-2 rounded bg-white/90 dark:bg-gray-800/90 text-blue-700 dark:text-blue-300 font-medium shadow">
            Drop into {paneId} pane
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFPane;