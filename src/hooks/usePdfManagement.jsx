import { useCallback, useEffect, useRef } from 'react';
import socketService from '../services/SocketService';

export const usePdfManagement = ({
  state,
  dispatch,
  pdfCanvasRef,
  secondaryPdfCanvasRef,
}) => {
  const { pdfs, activePdfId, secondaryPdfId, isDualPaneMode, pdfViewState } = state;
  const activeRenderTasks = useRef({});

  const renderPdfPage = useCallback(async (pdfData, pdfCanvas, paneId) => {
    if (activeRenderTasks.current[paneId]) {
      activeRenderTasks.current[paneId].cancel();
      try {
        await activeRenderTasks.current[paneId].promise;
      } catch (e) {
        // ignore cancellation error
      }
    }

    if (!pdfData || !pdfCanvas.current) {
      const canvas = pdfCanvas.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const { pdfDoc, currentPage, scale } = pdfData;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: scale });

      const canvas = pdfCanvas.current;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Reset transform to ensure clean slate
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      activeRenderTasks.current[paneId] = renderTask;

      await renderTask.promise;
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') {
        console.error(`Error rendering page (${paneId}):`, error);
      }
    } finally {
      delete activeRenderTasks.current[paneId];
    }
  }, []);

  const defaultViewState = { scale: 1, initialScaleSet: false, currentPage: 1 };

  const activePdf = pdfs.find(p => p.id === activePdfId)
    ? { ...pdfs.find(p => p.id === activePdfId), ...(pdfViewState[activePdfId] || defaultViewState) }
    : null;

  const secondaryPdf = pdfs.find(p => p.id === secondaryPdfId)
    ? { ...pdfs.find(p => p.id === secondaryPdfId), ...(pdfViewState[secondaryPdfId] || defaultViewState) }
    : null;

  useEffect(() => {
    renderPdfPage(activePdf, pdfCanvasRef, 'primary');

    if (isDualPaneMode) {
      renderPdfPage(secondaryPdf, secondaryPdfCanvasRef, 'secondary');
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

  const updatePdf = (pdfId, updates) => {
    const newViewState = {
      ...pdfViewState,
      [pdfId]: {
        ...(pdfViewState[pdfId] || defaultViewState),
        ...updates,
      },
    };
    dispatch({ type: 'SET_STATE', payload: { pdfViewState: newViewState } });
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

    const newViewState = { ...pdfViewState };
    delete newViewState[pdfId];

    dispatch({ type: 'SET_STATE', payload: {
        pdfs: newPdfs,
        activePdfId: newActivePdfId,
        secondaryPdfId: newSecondaryPdfId,
        pdfViewState: newViewState
    }});
  };

  const goToPage = (pdfId, pageNum) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf && pageNum >= 1 && pageNum <= pdf.totalPages) {
      updatePdf(pdfId, { currentPage: pageNum });
      if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(pdf.id, pageNum, pdfViewState[pdfId]?.scale || 1);
      }
    }
  };

  const zoomIn = (pdfId) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf) {
      const currentScale = pdfViewState[pdfId]?.scale || 1;
      const newScale = Math.min(currentScale + 0.25, 3);
      updatePdf(pdfId, { scale: newScale });
       if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(pdf.id, pdfViewState[pdfId]?.currentPage || 1, newScale);
      }
    }
  };

  const zoomOut = (pdfId) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf) {
      const currentScale = pdfViewState[pdfId]?.scale || 1;
      const newScale = Math.max(currentScale - 0.25, 0.5);
      updatePdf(pdfId, { scale: newScale });
      if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(pdf.id, pdfViewState[pdfId]?.currentPage || 1, newScale);
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