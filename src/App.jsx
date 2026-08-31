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
import ConfirmModal from './components/ConfirmModal';
import socketService from './services/SocketService';
import eventLogService from './services/EventLogService';
import { create } from 'jsondiffpatch';

const diffpatcher = create();

// Mirrors server.jsx's stableStringify — recursively sorts object keys so
// two structurally identical objects hash the same regardless of property
// insertion order (session.gameState accumulates keys across many separate
// updateGameState() calls over a session's life, in whatever order those
// happened to arrive).
function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(v => stableStringify(v) ?? 'null').join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
import ResizeHandle from './components/ResizeHandle';
import * as pako from 'pako'
import { crc32 } from 'crc';
import DebugModal from './components/DebugModal';
import GameMetadataModal from './components/GameMetadataModal';
import { Settings, Menu, Wifi, Columns, Moon, Sun, FilePlus, Upload, Save, RotateCcw } from 'lucide-react';
import { CorePack } from './data/CorePack';
import { LAYER_TOKENS, LAYER_DRAWINGS, LAYER_TEXT } from './data/LayerIds';

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
    tokenSize, lineWidth,
    secondaryPdfId, activePdfId, sessionToRestore
  } = state;

  // --- Refs ---
  const pdfCanvasRef = useRef(null);
  const secondaryPdfCanvasRef = useRef(null);
  const confirmModalRef = useRef(null);
  const confirm = useCallback((options) => {
    if (!confirmModalRef.current) return Promise.resolve(false);
    return confirmModalRef.current.confirm(options);
  }, []);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const goToPageRef = useRef(null);

  // Initialize GBTK - Register Core Pack
  useEffect(() => {
    if (state.tokenPacks && !state.tokenPacks.some(p => p.name === CorePack.name)) {
      dispatch({ type: 'REGISTER_PACK', payload: CorePack });
    }
  }, [state.tokenPacks]);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [gameStateVersion, setGameStateVersion] = useState(0);
  // Remote players' pointer-tool clicks, keyed by pdfId — ephemeral, never
  // persisted to pageLayers/pdfs, unlike drawings/tokens/text.
  const [remotePointers, setRemotePointers] = useState({});
  // --- UI State ---
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(state.sidebarWidth);
  const [primaryPaneWidth, setPrimaryPaneWidth] = useState(null);

  // Layout constants
  const maxSidebarWidth = Math.min(600, window.innerWidth * 0.4);
  const availableWidth = isSidebarVisible ? window.innerWidth - sidebarWidth : window.innerWidth;
  const maxPrimaryPaneWidth = availableWidth - 200; // 200px minimum for secondary pane
  
  // --- Logic Hooks ---
  const {
    showMultiplayerModal, setShowMultiplayerModal, multiplayerSession, connectedPlayers,
    setConnectedPlayers, notifications, isHost, addNotification, handleLeaveMultiplayerSession,
    handleCreateMultiplayerSession, handleJoinMultiplayerSession
  } = useMultiplayer({ state, dispatch, usePrevious });

  const {
    activePdf, secondaryPdf, updatePdf, closePdf, goToPage, zoomIn, zoomOut,
    handleBookmarkNavigate, handleTabSelect, toggleDualPane,
  } = usePdfManagement({
    state, dispatch, pdfCanvasRef, secondaryPdfCanvasRef,
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
      // Debounce multiplayer updates
      if (handleLayerUpdate.timeoutId) {
        clearTimeout(handleLayerUpdate.timeoutId);
      }
      handleLayerUpdate.timeoutId = setTimeout(() => {
        socketService.updateLayers(pdfId, pageNum, layers);
      }, 100);
    }
  }, []);

  // Broadcast a pointer-tool click immediately, bypassing the debounced
  // layers sync above — that debounce is shared with drawings/tokens/text
  // and can coalesce a pointer's add+auto-remove into nothing before it
  // ever reaches other players.
  const handleSendPointer = useCallback((pdfId, x, y, color) => {
    if (socketService.isMultiplayerActive()) {
      socketService.sendPointer({ pdfId, x, y, color });
    }
  }, []);

  // Multiplayer effect handlers
  useEffect(() => {
    const handleGameStateDelta = async (data) => {
      if (data.fromVersion !== gameStateVersion) {
        const response = await socketService.requestMissingUpdates(gameStateVersion);
        if (response.fullState) {
          dispatch({ type: 'SET_STATE', payload: response.fullState });
          setGameStateVersion(response.version);
        } else if (response.deltas) {
          let currentState = { ...stateRef.current };
          response.deltas.forEach(d => {
            currentState = diffpatcher.patch(currentState, d.delta);
          });
          dispatch({ type: 'SET_STATE', payload: currentState });
          setGameStateVersion(response.deltas[response.deltas.length - 1].version);
        }
        return;
      }

      const newState = diffpatcher.patch({ ...stateRef.current }, data.delta);

      const serverCrc = data.crc;
      // session.gameState.pageLayers lives at the top level on the server
      // (pdfId -> pageNum -> layers, kept live by the separate layers-updated
      // path), not nested per-pdf — pdfs[i].pageLayers is only ever a stale
      // snapshot from whichever updateGameState() call last replaced the
      // pdfs array wholesale, so it's excluded below rather than compared.
      const pageLayersForCrc = {};
      newState.pdfs.forEach(p => {
        if (p.pageLayers && Object.keys(p.pageLayers).length > 0) {
          pageLayersForCrc[p.id] = p.pageLayers;
        }
      });

      // Keep this shape in sync with server.jsx's buildCrcState():
      // - pdfs' currentPage/scale and activePdfId are never actually synced
      //   via update-game-state (page navigation and active-pdf selection go
      //   through their own separate socket events).
      // - eventLog isn't part of this either — it's synced via its own
      //   'event-logged' broadcast into eventLogService, never through
      //   dispatch/state at all.
      const finalClientStateForCrc = {
        pdfs: newState.pdfs.map(p => ({
          id: p.id,
          fileName: p.fileName,
          totalPages: p.totalPages,
          bookmarks: p.bookmarks || [],
          filePath: p.filePath,
        })),
        characters: newState.characters || [],
        notes: newState.notes || '',
        counters: newState.counters || [],
        pdfViewState: newState.pdfViewState || {},
        pageLayers: pageLayersForCrc,
      };

      const clientCrc = crc32(stableStringify(finalClientStateForCrc)).toString(16);

      if (clientCrc === serverCrc) {
        console.log('%cCRC Match!', 'color: green; font-weight: bold;');
      } else {
        console.error('%cCRC Mismatch!', 'color: red; font-weight: bold;');
      }

      dispatch({ type: 'SET_STATE', payload: newState });
      setGameStateVersion(data.version);
      socketService.sendAcknowledgement(data.version);
    };

    const handlePageNavigated = (data) => {
      const currentPdfs = stateRef.current.pdfs;
      const newPdfs = currentPdfs.map(pdf =>
        pdf.id === data.pdfId
          ? { ...pdf, currentPage: data.currentPage, scale: data.scale }
          : pdf
      );
      dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs } });
    };

    const handleLayersUpdated = (data) => {
      // socket.io-client delivers binary payloads as a raw ArrayBuffer (pako
      // needs a Uint8Array view), and pako v3 dropped the `{ to: 'string' }`
      // option — inflate() always returns bytes now, so decode explicitly.
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const decompressedData = JSON.parse(new TextDecoder().decode(pako.inflate(bytes)));

      /* Imperative Canvas Update Removed - State Only */
      const currentPdfs = stateRef.current.pdfs;
      const newPdfs = currentPdfs.map(pdf => {
        if (pdf.id === decompressedData.pdfId) {
          const updatedPageLayers = { ...pdf.pageLayers, [decompressedData.pageNum]: decompressedData.layers };
          return { ...pdf, pageLayers: updatedPageLayers };
        }
        return pdf;
      });
      dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs } });
    };

    const handlePointerEvent = (data) => {
      const { pdfId, x, y, color } = data;
      if (pdfId == null) return;
      const pointerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setRemotePointers(prev => ({
        ...prev,
        [pdfId]: [...(prev[pdfId] || []), { id: pointerId, x, y, color }],
      }));
      // Mirrors GameCanvas's own local pointer lifetime (see GameCanvas.jsx's
      // 'pointer' tool handler) so a remote pointer fades at the same time
      // the sender's own copy does.
      setTimeout(() => {
        setRemotePointers(prev => ({
          ...prev,
          [pdfId]: (prev[pdfId] || []).filter(p => p.id !== pointerId),
        }));
      }, 3000);
    };

    const handlePdfAdded = async (pdfData) => {
      if (stateRef.current.pdfs.some(p => p.id === pdfData.id)) return;

      try {
        const pdfUrl = socketService.getPdfUrl(pdfData.id);
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`PDF not found on server (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const newPdf = {
          ...pdfData,
          pdfDoc,
          file: null
        };

        const currentPdfs = [...stateRef.current.pdfs];
        const existingPdfIndex = currentPdfs.findIndex(p => p.fileName === pdfData.fileName);

        if (existingPdfIndex !== -1) {
          const oldPdfId = currentPdfs[existingPdfIndex].id;
          currentPdfs[existingPdfIndex] = newPdf;

          dispatch({
            type: 'SET_STATE',
            payload: {
              pdfs: currentPdfs,
              activePdfId: stateRef.current.activePdfId === oldPdfId
                ? newPdf.id
                : stateRef.current.activePdfId
            }
          });
        } else {
          dispatch({
            type: 'SET_STATE',
            payload: {
              pdfs: [...currentPdfs, newPdf],
              activePdfId: newPdf.id
            }
          });
        }

        addNotification(`PDF "${pdfData.fileName}" was added to the session`, 'success');
        eventLogService.logPdfOpen(pdfData.fileName);
      } catch (error) {
        console.error('Failed to load PDF from session:', error);
        addNotification('Failed to load PDF from session', 'error');
      }
    };

    const handlePdfRemoved = (pdfId) => {
      const currentPdfs = stateRef.current.pdfs;
      const newPdfs = currentPdfs.filter(p => p.id !== pdfId);
      let newActivePdfId = stateRef.current.activePdfId;
      let newSecondaryPdfId = stateRef.current.secondaryPdfId;

      if (newActivePdfId === pdfId) {
        newActivePdfId = newPdfs.length > 0 ? newPdfs[0].id : null;
      }
      if (newSecondaryPdfId === pdfId) {
        newSecondaryPdfId = null;
      }

      dispatch({
        type: 'SET_STATE', payload: {
          pdfs: newPdfs,
          activePdfId: newActivePdfId,
          secondaryPdfId: newSecondaryPdfId
        }
      });
      addNotification('A PDF was removed from the session', 'info');
    };

    const handleDiceRolled = (data) => {
      const { expression, result, rolledBy, playerName } = data;
      if (!result) return;

      const resolvedPlayer = playerName || `Player ${(rolledBy || '').slice(0, 6)}`;
      const breakdown = result.type === 'coin'
        ? result.symbolicBreakdown
        : (result.results || []).map(r => r.value);

      eventLogService.logDiceRoll(expression, breakdown, result.finalTotal, resolvedPlayer);

      // Toast only for OTHER players — we already see our own result in the dice modal
      if (rolledBy && rolledBy !== socketService.getSocketId()) {
        addNotification(`${resolvedPlayer} rolled ${expression}: ${result.finalTotal}`, 'info');
      }
    };

    const handlePlayerJoined = (data) => {
      const { socketId, clientCount } = data || {};
      const label = `Player ${(socketId || '').slice(0, 6) || 'unknown'}`;
      eventLogService.logPlayerJoin(label);
      if (typeof clientCount === 'number') setConnectedPlayers(clientCount);
    };

    const handlePlayerLeft = (data) => {
      const { socketId, clientCount } = data || {};
      const label = `Player ${(socketId || '').slice(0, 6) || 'unknown'}`;
      eventLogService.logPlayerLeave(label);
      if (typeof clientCount === 'number') setConnectedPlayers(clientCount);
    };

    socketService.on('game-state-delta', handleGameStateDelta);
    socketService.on('page-navigated', handlePageNavigated);
    socketService.on('layers-updated', handleLayersUpdated);
    socketService.on('pdf-added', handlePdfAdded);
    socketService.on('pdf-removed', handlePdfRemoved);
    socketService.on('pointer-event', handlePointerEvent);
    socketService.on('dice-rolled', handleDiceRolled);
    socketService.on('player-joined', handlePlayerJoined);
    socketService.on('player-left', handlePlayerLeft);

    return () => {
      socketService.off('game-state-delta', handleGameStateDelta);
      socketService.off('page-navigated', handlePageNavigated);
      socketService.off('layers-updated', handleLayersUpdated);
      socketService.off('pdf-added', handlePdfAdded);
      socketService.off('pdf-removed', handlePdfRemoved);
      socketService.off('pointer-event', handlePointerEvent);
      socketService.off('dice-rolled', handleDiceRolled);
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
    };
  }, [gameStateVersion]);

  // Keyboard shortcuts for tools (V/H/T/R/P/E) + Space for temporary pan
  useEffect(() => {
    let toolBeforePan = null;

    const isTypingTarget = (target) => {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const setTool = (toolId) => {
      dispatch({ type: 'SET_STATE', payload: { selectedTool: toolId } });
    };

    const SHORTCUTS = {
      v: 'select',
      h: 'pan',
      t: 'text',
      r: 'rectangle',
      p: 'draw',
      e: 'eraser',
    };

    const handleKeyDown = (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (isTypingTarget(ev.target)) return;

      if (ev.code === 'Space' && !ev.repeat) {
        const current = stateRef.current.selectedTool;
        if (current !== 'pan') {
          toolBeforePan = current;
          setTool('pan');
        }
        ev.preventDefault();
        return;
      }

      // Page navigation on the active (primary) PDF
      if (ev.key === 'ArrowLeft' || ev.key === 'PageUp' || ev.key === 'ArrowRight' || ev.key === 'PageDown') {
        const { activePdfId: activeId, pdfs: currentPdfs } = stateRef.current;
        const activePdfState = currentPdfs.find(p => p.id === activeId);
        if (!activePdfState || !goToPageRef.current) return;
        const delta = (ev.key === 'ArrowLeft' || ev.key === 'PageUp') ? -1 : 1;
        ev.preventDefault();
        goToPageRef.current(activeId, activePdfState.currentPage + delta);
        return;
      }

      const tool = SHORTCUTS[ev.key.toLowerCase()];
      if (tool) {
        ev.preventDefault();
        setTool(tool);
      }
    };

    const handleKeyUp = (ev) => {
      if (ev.code === 'Space' && toolBeforePan !== null) {
        setTool(toolBeforePan);
        toolBeforePan = null;
        ev.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);





  const handleFileUpload = async (event, targetPane = 'primary') => {
    const files = event.target.files;
    if (files.length === 0) return;

    if (multiplayerSession && !isHost) {
      addNotification("Only the session host can open PDFs", "error");
      event.target.value = '';
      return;
    }

    const newPdfsData = [];
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        console.warn(`[File Upload] Ignored file ${file.name} because it is not a PDF.`);
        continue;
      }

      if (pdfs.some(p => p.fileName === file.name)) {
        console.warn(`Skipping duplicate file: ${file.name}`);
        continue;
      }

      if (sessionToRestore) {
        const matchingPdfInSession = sessionToRestore.pdfs.find(p => p.fileName === file.name);
        if (matchingPdfInSession) {
          try {
            const url = URL.createObjectURL(file);
            const pdfDoc = await pdfjsLib.getDocument({ url }).promise;
            newPdfsData.push({
              ...matchingPdfInSession,
              file,
              pdfDoc,
              totalPages: pdfDoc.numPages,
              bookmarks: matchingPdfInSession.bookmarks || await pdfDoc.getOutline() || [],
            });
          } catch (error) {
            console.error('Error loading PDF for session restore:', file.name, error);
            addNotification(`Error loading PDF: ${error.message}`, 'error');
          }
        } else {
          const expectedNames = sessionToRestore.pdfs.map(p => p.fileName).join(', ');
          console.warn(`[Session Restore] Rejected PDF "${file.name}". The loaded session is expecting exactly these files: [${expectedNames}]`);
        }
      } else {
        try {
          const url = URL.createObjectURL(file);
          const pdfDoc = await pdfjsLib.getDocument({ url }).promise;
          const pdfData = {
            id: file.name,
            fileName: file.name,
            file,
            pdfDoc,
            totalPages: pdfDoc.numPages,
            currentPage: 1,
            scale: 1,
            initialScaleSet: false,
            pageLayers: {},
            bookmarks: await pdfjsLib.getDocument({ url }).promise.then(doc => doc.getOutline()).catch(() => []) || [],
          };
          newPdfsData.push(pdfData);
        } catch (error) {
          console.error('Error loading PDF:', file.name, error);
          addNotification(`Failed to load ${file.name}: ${error.message}`, 'error');
        }
      }
    }

    if (sessionToRestore) {
      if (newPdfsData.length === sessionToRestore.pdfs.length) {
        dispatch({
          type: 'SET_STATE', payload: {
            pdfs: newPdfsData,
            activePdfId: sessionToRestore.activePdfId,
            secondaryPdfId: sessionToRestore.secondaryPdfId,
            isDualPaneMode: sessionToRestore.isDualPaneMode,
            characters: sessionToRestore.characters,
            notes: sessionToRestore.notes,
            counters: sessionToRestore.counters,
            sessionToRestore: null,
          }
        });
      } else {
        const expectedNames = sessionToRestore.pdfs.map(p => p.fileName).join(', ');
        const uploadedNames = newPdfsData.map(p => p.fileName).join(', ');
        console.error(`[Session Restore] Failed to restore session. Expected [${expectedNames}], but got [${uploadedNames}]`);
        addNotification('Could not restore session. Filenames must match exactly. Check browser console for details.', 'error');
        dispatch({ type: 'SET_STATE', payload: { sessionToRestore: null } });
      }
    } else {
      if (newPdfsData.length > 0) {
        const paneIdKey = targetPane === 'secondary' ? 'secondaryPdfId' : 'activePdfId';
        dispatch({
          type: 'SET_STATE', payload: {
            pdfs: [...pdfs, ...newPdfsData],
            [paneIdKey]: newPdfsData[0].id,
          }
        });
        newPdfsData.forEach(p => eventLogService.logPdfOpen(p.fileName));

        if (socketService.isMultiplayerActive()) {
          for (const pdfData of newPdfsData) {
            try {
              await socketService.uploadPdfToSession(pdfData.file, pdfData);
            } catch (error) {
              console.error('Failed to upload PDF to multiplayer session:', error);
              addNotification('Failed to share PDF with other players', 'error');
            }
          }
        }
      }
    }
  };

  

  

  const handleLoadGBS = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.gbs')) {
      addNotification('Please select a valid .gbs file', 'error');
      return;
    }

    try {
      const zip = await JSZip.loadAsync(file);

      // Read game metadata
      let gameMetadata = {
        name: '',
        year: '',
        author: '',
        description: '',
        players: '',
        length: ''
      };

      const gameJsonFile = zip.file('game.json');
      if (gameJsonFile) {
        const gameJson = await gameJsonFile.async('string');
        gameMetadata = JSON.parse(gameJson);
      }

      // Read session.json
      const sessionJson = await zip.file('session.json').async('string');
      const sessionData = JSON.parse(sessionJson);

      // Load PDFs
      const pdfFolder = zip.folder('pdfs');
      const loadedPdfs = [];

      for (const pdfInfo of sessionData.pdfs) {
        const pdfFile = pdfFolder.file(pdfInfo.fileName);
        if (pdfFile) {
          const pdfBlob = await pdfFile.async('blob');
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const pdfDoc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;

          loadedPdfs.push({
            ...pdfInfo,
            pdfDoc,
            file: new File([pdfBlob], pdfInfo.fileName, { type: 'application/pdf' })
          });
        } else {
          console.warn(`PDF not found in archive: ${pdfInfo.fileName}`);
        }
      }

      // Restore full state including metadata
      dispatch({
        type: 'SET_STATE',
        payload: {
          pdfs: loadedPdfs,
          activePdfId: sessionData.activePdfId,
          secondaryPdfId: sessionData.secondaryPdfId,
          isDualPaneMode: sessionData.isDualPaneMode,
          characters: sessionData.characters,
          notes: sessionData.notes,
          counters: sessionData.counters,
          gameMetadata: gameMetadata
        }
      });

      setGameStateVersion(sessionData.version || 0);

      const gameName = gameMetadata.name ? ` "${gameMetadata.name}"` : '';
      addNotification(`Game${gameName} loaded successfully`, 'success');

    } catch (error) {
      console.error('Error loading .gbs file:', error);
      addNotification('Failed to load .gbs file. It may be corrupt or invalid.', 'error');
    }
  };

  const handleLoadSession = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const sessionData = JSON.parse(e.target.result);
          setGameStateVersion(sessionData.version || 0);
          dispatch({ type: 'SET_STATE', payload: { sessionToRestore: sessionData } });
          addNotification(`Session loaded. Please select the following PDF files: ${sessionData.pdfs.map(p => p.fileName).join(', ')}`, 'info');
          fileInputRef.current.click();
        } catch (error) {
          console.error('Error parsing session file:', error);
          addNotification('Could not load session file. It may be corrupt.', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  

  

  

  
  goToPageRef.current = goToPage;

  

  

  

  const handleSidebarResize = useCallback((newWidth) => {
    setSidebarWidth(newWidth);
    dispatch({ type: 'SET_STATE', payload: { sidebarWidth: newWidth } });
  }, [dispatch]);

  const handlePaneResize = useCallback((newWidth) => setPrimaryPaneWidth(newWidth), []);

  

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      handleBookmarkNavigate,
      activePdf,
      secondaryPdf,
      goToPage: (pageNum, pdfId = activePdfId) => goToPage(pdfId, pageNum),
      zoomIn: (pdfId = activePdfId) => zoomIn(pdfId),
      zoomOut: (pdfId = activePdfId) => zoomOut(pdfId),
      addNotification,
      confirm,
    }}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300" style={{ width: '100vw', overflow: 'hidden' }}>
        <ConfirmModal ref={confirmModalRef} />
        <MultiplayerNotifications notifications={notifications} />

        <MultiplayerModal
          isOpen={showMultiplayerModal}
          onClose={() => setShowMultiplayerModal(false)}
          onSessionCreated={handleCreateMultiplayerSession}
          onSessionJoined={handleJoinMultiplayerSession}
        />

        <GameMetadataModal
          isOpen={showMetadataModal}
          onClose={() => setShowMetadataModal(false)}
          onSave={handleExportGBS}
          initialData={state.gameMetadata}
        />

        <DebugModal
          isOpen={showDebugModal}
          onClose={() => setShowDebugModal(false)}
          gameState={state}
          gameStateVersion={gameStateVersion}
        />

        <FloatingDice />

        {isSidebarVisible ? (
          <div className="flex h-full">
            <div style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: `${Math.min(600, window.innerWidth * 0.4)}px`, height: '100%' }}>
              <Sidebar>
                {multiplayerSession && (
                  <div className="p-4 border-b">
                    <MultiplayerStatus
                      sessionId={multiplayerSession}
                      isHost={isHost}
                      connectedPlayers={connectedPlayers}
                      onLeaveSession={handleLeaveMultiplayerSession}
                      onCopySessionId={() => addNotification('Session ID copied to clipboard', 'success')}
                    />
                  </div>
                )}
              </Sidebar>
            </div>
            <ResizeHandle
              direction="horizontal"
              onResize={handleSidebarResize}
              minSize={200}
              maxSize={maxSidebarWidth}
              initialSize={sidebarWidth}
            />
          </div>
        ) : (
          <SidebarHoverTrigger>
            {multiplayerSession && (
              <div className="p-4 border-b">
                <MultiplayerStatus
                  sessionId={multiplayerSession}
                  isHost={isHost}
                  connectedPlayers={connectedPlayers}
                  onLeaveSession={handleLeaveMultiplayerSession}
                  onCopySessionId={() => addNotification('Session ID copied to clipboard', 'success')}
                />
              </div>
            )}
          </SidebarHoverTrigger>
        )}

        <div className="flex-1 flex flex-col relative" style={{
          width: isSidebarVisible ? `${window.innerWidth - sidebarWidth - 2}px` : '100vw',
          overflow: 'hidden'
        }}>
          <Toolbar />

          <div className="absolute top-2 right-3 z-30">
            <button
              onClick={() => dispatch({ type: 'SET_STATE', payload: { menuOpen: !menuOpen } })}
              className="p-2 rounded hover:bg-gray-100 bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 dark:hover:bg-gray-700"
            >
              <Menu size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 dark:bg-gray-800 dark:border dark:border-gray-700">
                {!multiplayerSession ? (
                  <button
                    onClick={() => {
                      setShowMultiplayerModal(true);
                      dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                    }}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Wifi size={14} /> Multiplayer
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleLeaveMultiplayerSession();
                      dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                    }}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    <Wifi size={14} /> Disconnect
                  </button>
                )}
                {pdfs.length >= 1 && (
                  <button
                    onClick={() => {
                      toggleDualPane();
                      dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                    }}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Columns size={14} />
                    {isDualPaneMode ? 'Single Pane' : 'Dual Pane'}
                  </button>
                )}
                <button
                  onClick={() => { dispatch({ type: 'TOGGLE_THEME' }); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                  Toggle Theme
                </button>
                <button
                  onClick={() => { handleNewSession(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <FilePlus size={14} /> New Session
                </button>
                <button
                  onClick={() => { fileInputRef.current?.click(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Upload size={14} /> Load Files
                </button>
                <button
                  onClick={() => { handleSaveSession(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Save size={14} /> Save Session
                </button>
                <button
                  onClick={() => {
                    setShowMetadataModal(true);
                    dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                  }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Save size={14} /> Export as .gbs
                </button>
                <button
                  onClick={() => {
                    /* Clear logic to be re-implemented via state */
                    if (activePdfId && activePdf) {
                      handleLayerUpdate(activePdfId, activePdf.currentPage, [
                        { id: LAYER_TOKENS, name: 'Game Tokens', objects: [], visible: true, locked: false },
                        { id: LAYER_DRAWINGS, name: 'Drawings', objects: [], visible: true, locked: false },
                        { id: LAYER_TEXT, name: 'Text & Notes', objects: [], visible: true, locked: false }
                      ]);
                    }
                    dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                  }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <RotateCcw size={14} /> Clear Page Annotations
                </button>
                <button
                  onClick={() => {
                    setShowDebugModal(true);
                    dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                  }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Settings size={14} /> Debug State
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.json,.gbs"
              onChange={handleUnifiedLoad}
              className="hidden"
              multiple
            />
          </div>

          <div className="flex-1 flex" style={{ overflow: 'hidden' }}>
            <div
              className={`${isDualPaneMode ? '' : 'w-full'} flex flex-col overflow-hidden`}
              style={{
                width: isDualPaneMode
                  ? `${primaryPaneWidth || Math.floor(availableWidth * 0.5)}px`
                  : '100%'
              }}
            >
              <PDFPane
                pdfCanvasRef={pdfCanvasRef}
                pdf={activePdf}
                paneId="primary"
                pdfs={pdfs}
                activePdfId={activePdfId}
                secondaryPdfId={secondaryPdfId}
                isDualPaneMode={isDualPaneMode}
                closePdf={closePdf}
                updatePdf={updatePdf}
                onTabSelect={(pdfId) => handleTabSelect(pdfId, 'primary')}
                onTabClose={closePdf}
                onBookmarkNavigate={handleBookmarkNavigate}
                onLayerUpdate={handleLayerUpdate}
                onSendPointer={handleSendPointer}
                remotePointers={activePdf ? (remotePointers[activePdf.id] || []) : []}
                onFilesDropped={(files) => handleUnifiedLoad({ target: { files } }, 'primary')}
              />
            </div>

            {isDualPaneMode && (
              <ResizeHandle
                direction="horizontal"
                onResize={handlePaneResize}
                minSize={200}
                maxSize={maxPrimaryPaneWidth}
                initialSize={Math.floor(availableWidth * 0.5)}
                className="z-50 relative"
              />
            )}

            {isDualPaneMode && (
              <div
                className="flex-1 flex flex-col overflow-hidden"
                style={{
                  width: primaryPaneWidth
                    ? `${availableWidth - primaryPaneWidth - 2}px`
                    : `${Math.floor(availableWidth * 0.5)}px`
                }}
              >
                <PDFPane
                  pdfCanvasRef={secondaryPdfCanvasRef}
                  pdf={secondaryPdf}
                  paneId="secondary"
                  pdfs={pdfs}
                  activePdfId={activePdfId}
                  secondaryPdfId={secondaryPdfId}
                  isDualPaneMode={isDualPaneMode}
                  closePdf={closePdf}
                  updatePdf={updatePdf}
                  onTabSelect={(pdfId) => handleTabSelect(pdfId, 'secondary')}
                  onTabClose={closePdf}
                  onBookmarkNavigate={handleBookmarkNavigate}
                  onLayerUpdate={handleLayerUpdate}
                  onSendPointer={handleSendPointer}
                  remotePointers={secondaryPdf ? (remotePointers[secondaryPdf.id] || []) : []}
                  onFilesDropped={(files) => handleUnifiedLoad({ target: { files } }, 'secondary')}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
};

export default GamebookApp;