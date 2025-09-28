import React from 'react';
import TabBar from './TabBar';
import PDFViewer from './PDFViewer';

const PDFPane = ({
  pdfCanvasRef,
  overlayCanvasRef,
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
  onTabClose
}) => {
  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col h-full relative">
      {pdfs.length > 0 && (
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
        overlayCanvasRef={overlayCanvasRef}
        pdf={pdf}
        paneId={paneId}
        updatePdf={updatePdf}
      />
    </div>
  );
};

export default PDFPane;