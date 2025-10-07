import React, { useReducer, useRef, useEffect, useCallback, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// State and Context
import { AppContext, initialState, reducer } from './state/appState';

// Custom Hooks for Logic
import { useMultiplayer } from './hooks/useMultiplayer';
import { usePdfManagement } from './hooks/usePdfManagement';
import { useSessionManagement } from './hooks/useSessionManagement';

// Core Components
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import PDFPane from './components/PDFPane';
import MainMenu from './components/MainMenu';
import FloatingDice from './components/FloatingDice';

// UI Components
import { MultiplayerModal, MultiplayerStatus, MultiplayerNotifications } from './components/MultiplayerModal';
import GameMetadataModal from './components/GameMetadataModal';
import DebugModal from './components/DebugModal';
import SidebarHoverTrigger from './components/SidebarHoverTrigger';
import ResizeHandle from './components/ResizeHandle';

// Services and Classes
import FabricCanvas from './canvas/FabricCanvas';
import socketService from './services/SocketService';

// PDF worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Custom hook to get the previous value of a prop or state
const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

const GamebookApp = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    menuOpen, isDualPaneMode, theme, pdfs, isSidebarVisible,
    selectedTool, selectedColor, selectedTokenShape, selectedTokenColor,
    tokenSize, lineWidth,
    secondaryPdfId
  } = state;

  // --- Refs ---
  const pdfCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const secondaryPdfCanvasRef = useRef(null);
  const secondaryOverlayCanvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const secondaryFabricCanvas = useRef(null);
  
  // FIX: Add a ref to always hold the latest state
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });


  // --- UI State ---
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(state.sidebarWidth);
  const [primaryPaneWidth, setPrimaryPaneWidth] = useState(null);
  
  // --- Logic Hooks ---
  const {
    showMultiplayerModal, setShowMultiplayerModal, multiplayerSession, connectedPlayers,
    notifications, isHost, addNotification, handleLeaveMultiplayerSession,
    handleCreateMultiplayerSession, handleJoinMultiplayerSession
  } = useMultiplayer({ state, dispatch, usePrevious, fabricCanvas, secondaryFabricCanvas });

  const {
    activePdf, secondaryPdf, updatePdf, closePdf, goToPage, zoomIn, zoomOut,
    handleBookmarkNavigate, handleTabSelect, toggleDualPane,
  } = usePdfManagement({
    state, dispatch, pdfCanvasRef, overlayCanvasRef, secondaryPdfCanvasRef,
    secondaryOverlayCanvasRef, fabricCanvas, secondaryFabricCanvas
  });

  const {
    fileInputRef, handleNewSession, handleSaveSession, handleExportGBS,
    handleUnifiedLoad, triggerLoadFiles,
  } = useSessionManagement({
    state, dispatch, addNotification, isHost, multiplayerSession, handleLeaveMultiplayerSession
  });

  // --- Glue Logic ---
  const handleLayerUpdate = useCallback((pdfId, pageNum, layers) => {
    // FIX: Use the ref to get the CURRENT state, not the stale one from the closure
    const currentPdfs = stateRef.current.pdfs;
    const newPdfs = currentPdfs.map(p => {
        if (p.id === pdfId) {
            const updatedPageLayers = { ...p.pageLayers, [pageNum]: layers };
            return { ...p, pageLayers: updatedPageLayers };
        }
        return p;
    });
    dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs } });

    if (socketService.isMultiplayerActive()) {
      socketService.updateLayers(pdfId, pageNum, layers);
    }
    // FIX: Remove state.pdfs from dependency array to prevent creating a stale closure
  }, [dispatch]);

  const handleTabClose = (pdfId) => closePdf(pdfId, addNotification, isHost);

  // --- Effects ---
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (overlayCanvasRef.current && !fabricCanvas.current) {
      fabricCanvas.current = new FabricCanvas(overlayCanvasRef.current, handleLayerUpdate, 'primary');
    }
    if (isDualPaneMode && secondaryOverlayCanvasRef.current && !secondaryFabricCanvas.current) {
      secondaryFabricCanvas.current = new FabricCanvas(secondaryOverlayCanvasRef.current, handleLayerUpdate, 'secondary');
    }
  }, [isDualPaneMode, handleLayerUpdate]);

  useEffect(() => {
    const canvases = [fabricCanvas.current, secondaryFabricCanvas.current];
    canvases.forEach((canvas, index) => {
      if (canvas) {
        const pdf = index === 0 ? activePdf : secondaryPdf;
        canvas.setTokenSize(tokenSize);
        canvas.setTool(selectedTool);
        canvas.setColor(selectedColor);
        canvas.setLineWidth(lineWidth);
        if (pdf) canvas.setCurrentPdf(pdf.id);
        if (selectedTool === 'token') canvas.setSelectedToken(selectedTokenShape, selectedTokenColor);
      }
    });
  }, [tokenSize, selectedTool, selectedColor, selectedTokenShape, selectedTokenColor, lineWidth, activePdf, secondaryPdf]);

  const handleSidebarResize = useCallback((newWidth) => {
    setSidebarWidth(newWidth);
    dispatch({ type: 'SET_STATE', payload: { sidebarWidth: newWidth } });
  }, [dispatch]);

  const handlePaneResize = useCallback((newWidth) => setPrimaryPaneWidth(newWidth), []);

  const availableWidth = window.innerWidth - (isSidebarVisible ? sidebarWidth : 0) - 2;

  return (
    <AppContext.Provider value={{
      state, dispatch, fabricCanvas, secondaryFabricCanvas, handleBookmarkNavigate,
      activePdf, secondaryPdf,
      goToPage: (pageNum, pdfId) => goToPage(pdfId || state.activePdfId, pageNum),
      zoomIn: (pdfId) => zoomIn(pdfId || state.activePdfId),
      zoomOut: (pdfId) => zoomOut(pdfId || state.activePdfId),
    }}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300" style={{ width: '100vw', overflow: 'hidden' }}>
        <MultiplayerNotifications notifications={notifications} />
        <MultiplayerModal isOpen={showMultiplayerModal} onClose={() => setShowMultiplayerModal(false)} onSessionCreated={handleCreateMultiplayerSession} onSessionJoined={handleJoinMultiplayerSession} />
        <GameMetadataModal isOpen={showMetadataModal} onClose={() => setShowMetadataModal(false)} onSave={handleExportGBS} initialData={state.gameMetadata} />
        <DebugModal isOpen={showDebugModal} onClose={() => setShowDebugModal(false)} gameState={state} gameStateVersion={state.gameStateVersion} />
        <FloatingDice />
        
        {isSidebarVisible ? (
          <div className="flex h-full">
            <div style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: `${Math.min(600, window.innerWidth * 0.4)}px`, height: '100%' }}>
              <Sidebar>
                {multiplayerSession && <MultiplayerStatus sessionId={multiplayerSession} isHost={isHost} connectedPlayers={connectedPlayers} onLeaveSession={handleLeaveMultiplayerSession} onCopySessionId={() => addNotification('Session ID copied', 'success')} />}
              </Sidebar>
            </div>
            <ResizeHandle direction="horizontal" onResize={handleSidebarResize} minSize={200} maxSize={Math.min(600, window.innerWidth * 0.4)} initialSize={sidebarWidth} />
          </div>
        ) : (
          <SidebarHoverTrigger>
            {multiplayerSession && <MultiplayerStatus sessionId={multiplayerSession} isHost={isHost} connectedPlayers={connectedPlayers} onLeaveSession={handleLeaveMultiplayerSession} onCopySessionId={() => addNotification('Session ID copied', 'success')} />}
          </SidebarHoverTrigger>
        )}

        <div className="flex-1 flex flex-col relative" style={{ width: isSidebarVisible ? `${availableWidth}px` : '100vw', overflow: 'hidden' }}>
          <Toolbar />
          <MainMenu
            menuOpen={menuOpen}
            toggleMenu={() => dispatch({ type: 'SET_STATE', payload: { menuOpen: !menuOpen } })}
            multiplayerSession={multiplayerSession}
            isDualPaneMode={isDualPaneMode}
            theme={theme}
            pdfs={pdfs}
            handleNewSession={() => { handleNewSession(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleSaveSession={() => { handleSaveSession(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleExportGBS={() => { setShowMetadataModal(true); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleLoadFiles={() => { triggerLoadFiles(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleToggleTheme={() => { dispatch({ type: 'TOGGLE_THEME' }); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleToggleDualPane={() => { toggleDualPane(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleClearAnnotations={() => { fabricCanvas.current?.clear(); if (isDualPaneMode) secondaryFabricCanvas.current?.clear(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleShowDebugModal={() => { setShowDebugModal(true); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleShowMultiplayerModal={() => { setShowMultiplayerModal(true); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
            handleLeaveMultiplayerSession={() => { handleLeaveMultiplayerSession(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
          />
          <input ref={fileInputRef} type="file" accept=".pdf,.json,.gbs" onChange={handleUnifiedLoad} className="hidden" multiple />

          <div className={`flex-1 ${isDualPaneMode ? 'flex' : ''}`} style={{ overflow: 'hidden' }}>
            <div className={`${isDualPaneMode ? '' : 'w-full'} flex flex-col overflow-hidden`} style={{ width: isDualPaneMode ? `${primaryPaneWidth || Math.floor(availableWidth * 0.5)}px` : '100%' }}>
              <PDFPane pdfCanvasRef={pdfCanvasRef} overlayCanvasRef={overlayCanvasRef} pdf={activePdf} paneId="primary" pdfs={pdfs} activePdfId={state.activePdfId} secondaryPdfId={secondaryPdfId} isDualPaneMode={isDualPaneMode} closePdf={handleTabClose} updatePdf={updatePdf} onTabSelect={handleTabSelect} onTabClose={handleTabClose} onBookmarkNavigate={handleBookmarkNavigate} />
            </div>
            {isDualPaneMode && <ResizeHandle direction="horizontal" onResize={handlePaneResize} minSize={200} maxSize={availableWidth * 0.8} initialSize={Math.floor(availableWidth * 0.5)} className="z-50 relative" />}
            {isDualPaneMode && (
              <div className="flex-1 flex flex-col overflow-hidden" style={{ width: primaryPaneWidth ? `${availableWidth - primaryPaneWidth - 2}px` : `${Math.floor(availableWidth * 0.5)}px` }}> 
                <PDFPane pdfCanvasRef={secondaryPdfCanvasRef} overlayCanvasRef={secondaryOverlayCanvasRef} pdf={secondaryPdf} paneId="secondary" pdfs={pdfs} activePdfId={state.activePdfId} secondaryPdfId={secondaryPdfId} isDualPaneMode={isDualPaneMode} closePdf={handleTabClose} updatePdf={updatePdf} onTabSelect={handleTabSelect} onTabClose={handleTabClose} onBookmarkNavigate={handleBookmarkNavigate} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
};

export default GamebookApp;