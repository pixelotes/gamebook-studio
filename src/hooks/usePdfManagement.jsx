// src/hooks/usePdfManagement.js
import { useCallback, useEffect, useRef } from 'react';
import socketService from '../services/SocketService';

export const usePdfManagement = ({
  state,
  dispatch,
  pdfCanvasRef,
  overlayCanvasRef,
  secondaryPdfCanvasRef,
  secondaryOverlayCanvasRef,
  fabricCanvas,
  secondaryFabricCanvas,
}) => {
  const { pdfs, activePdfId, secondaryPdfId, isDualPaneMode } = state;
  const activeRenderTasks = useRef({}); // Ref to hold active render tasks

  const renderPdfPage = useCallback(async (pdfData, pdfCanvas, overlayCanvas, fabricCanvasInstance, paneId) => {
    if (activeRenderTasks.current[paneId]) {
      activeRenderTasks.current[paneId].cancel();
    }

    if (!pdfData || !pdfCanvas.current) {
      // Clear canvas if no PDF is active in this pane
      const canvas = pdfCanvas.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
  
    const { pdfDoc, currentPage, scale, pageLayers } = pdfData;
  
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: scale });
      
      const canvas = pdfCanvas.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      activeRenderTasks.current[paneId] = renderTask; // Store the new task
  
      await renderTask.promise;
  
      const overlay = overlayCanvas.current;
      if (overlay && fabricCanvasInstance.current) {
        overlay.width = viewport.width;
        overlay.height = viewport.height;
        fabricCanvasInstance.current.loadPageLayers(pageLayers);
        fabricCanvasInstance.current.setScale(scale);
        fabricCanvasInstance.current.setCurrentPage(currentPage);
      }
    } catch (error) {
      // Silently ignore cancellation errors, log others
      if (error.name !== 'RenderingCancelledException') {
        console.error(`Error rendering page (${paneId}):`, error);
      }
    } finally {
      // Clean up the task from the ref once it's done or cancelled
      delete activeRenderTasks.current[paneId];
    }
  }, []); // This function is stable and doesn't need dependencies

  const activePdf = pdfs.find(p => p.id === activePdfId);
  const secondaryPdf = pdfs.find(p => p.id === secondaryPdfId);

  // This effect now correctly depends on the PDF objects themselves
  useEffect(() => {
    renderPdfPage(activePdf, pdfCanvasRef, overlayCanvasRef, fabricCanvas, 'primary');
    
    if (isDualPaneMode) {
      renderPdfPage(secondaryPdf, secondaryPdfCanvasRef, secondaryOverlayCanvasRef, secondaryFabricCanvas, 'secondary');
    }

    return () => {
      Object.values(activeRenderTasks.current).forEach(task => task?.cancel());
    };
  }, [
    activePdf?.id, 
    activePdf?.currentPage, 
    activePdf?.scale,
    secondaryPdf?.id,
    secondaryPdf?.currentPage,
    secondaryPdf?.scale,
    isDualPaneMode, 
    renderPdfPage
  ]);

  // --- The rest of the hook remains the same ---
  
  const updatePdf = (pdfId, updates) => {
    const newPdfs = pdfs.map(p => p.id === pdfId ? { ...p, ...updates } : p);
    dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs }});
  };

  const closePdf = (pdfId, addNotification, isHost) => {
    if (socketService.isMultiplayerActive() && !isHost) {
      addNotification("Only the session host can close PDFs", "error");
      return;
    }
    if (socketService.isMultiplayerActive()) {
      socketService.removePdf(pdfId);
    }
    const newPdfs = pdfs.filter(p => p.id !== pdfId);
    let newActivePdfId = activePdfId;
    let newSecondaryPdfId = secondaryPdfId;
    
    if (activePdfId === pdfId) {
        newActivePdfId = newPdfs.length > 0 ? newPdfs[0].id : null;
    }
    if (secondaryPdfId === pdfId) {
        newSecondaryPdfId = null;
    }
    
    dispatch({ type: 'SET_STATE', payload: { 
        pdfs: newPdfs, 
        activePdfId: newActivePdfId,
        secondaryPdfId: newSecondaryPdfId
    }});
  };

  const goToPage = (pdfId, pageNum) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf && pageNum >= 1 && pageNum <= pdf.totalPages) {
      updatePdf(pdfId, { currentPage: pageNum });
      if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(pdf.id, pageNum, pdf.scale);
      }
    }
  };

  const zoomIn = (pdfId) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf) {
      const newScale = Math.min(pdf.scale + 0.25, 3);
      updatePdf(pdfId, { scale: newScale });
       if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(pdf.id, pdf.currentPage, newScale);
      }
    }
  };
  
  const zoomOut = (pdfId) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf) {
      const newScale = Math.max(pdf.scale - 0.25, 0.5);
      updatePdf(pdfId, { scale: newScale });
      if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(pdf.id, pdf.currentPage, newScale);
      }
    }
  };

  const handleBookmarkNavigate = async (dest, pdfId) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (!pdf) return;
    try {
      const pageIndex = await pdf.pdfDoc.getPageIndex(dest[0]);
      goToPage(pdfId, pageIndex + 1); 
    } catch (error) {
      console.error('Error navigating to bookmark:', error);
    }
  };
  
  const handleTabSelect = (pdfId, paneId) => {
    if (paneId === 'primary') {
      dispatch({ type: 'SET_STATE', payload: { activePdfId: pdfId } });
    } else {
      dispatch({ type: 'SET_STATE', payload: { secondaryPdfId: pdfId } });
    }
  };

  const toggleDualPane = () => {
    if (!isDualPaneMode && pdfs.length > 1) {
      dispatch({ type: 'SET_STATE', payload: { 
        isDualPaneMode: true,
        secondaryPdfId: pdfs.find(p => p.id !== activePdfId)?.id || null
      }});
    } else {
      dispatch({ type: 'SET_STATE', payload: { 
        isDualPaneMode: false,
        secondaryPdfId: null
      }});
    }
  };
  
  return {
    activePdf,
    secondaryPdf,
    updatePdf,
    closePdf,
    goToPage,
    zoomIn,
    zoomOut,
    handleBookmarkNavigate,
    handleTabSelect,
    toggleDualPane,
  };
};