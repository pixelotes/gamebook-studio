import React, { useReducer, useRef, useEffect, useCallback, useState } from 'react';
import { Upload, RotateCcw, Save, Menu, FilePlus, Wifi, Moon, Sun, Columns } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import JSZip from 'jszip';
import FloatingDice from './components/FloatingDice';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import PDFPane from './components/PDFPane';
import SidebarHoverTrigger from './components/SidebarHoverTrigger';
import { AppContext, initialState, reducer } from './state/appState';
import { TOKEN_SHAPES } from './data/Shapes';
import { MultiplayerModal, MultiplayerStatus, MultiplayerNotifications } from './components/MultiplayerModal';
import socketService from './services/SocketService';
import { create } from 'jsondiffpatch';
import ResizeHandle from './components/ResizeHandle';
import pako from 'pako';
import { crc32 } from 'crc';
import DebugModal from './components/DebugModal';
import GameMetadataModal from './components/GameMetadataModal';
import { Settings } from 'lucide-react';
import { CorePack } from './data/CorePack';

const diffpatcher = create({
  objectHash: (obj) => obj.id,
});

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Custom hook to get the previous value of a prop or state
const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

// MockFabricCanvas removed

const GamebookApp = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    pdfs, activePdfId, secondaryPdfId, isDualPaneMode, characters, notes, counters, selectedTool, selectedColor,
    selectedTokenShape, selectedTokenColor, tokenSize, sessionToRestore,
    isSidebarVisible, menuOpen, theme, lineWidth
  } = state;

  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [multiplayerSession, setMultiplayerSession] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStateVersion, setGameStateVersion] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(state.sidebarWidth);
  const [primaryPaneWidth, setPrimaryPaneWidth] = useState(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  const pdfCanvasRef = useRef(null);
  const secondaryPdfCanvasRef = useRef(null);
  // Track active PDF render tasks to prevent race conditions (flipped PDF bug)
  const renderTaskRef = useRef({ primary: null, secondary: null });
  const fileInputRef = useRef(null);

  const [showDebugModal, setShowDebugModal] = useState(false);

  const activePdf = pdfs.find(p => p.id === activePdfId);
  const secondaryPdf = pdfs.find(p => p.id === secondaryPdfId);

  const stateRef = useRef(state);
  stateRef.current = state;

  const goToPageRef = useRef(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initialize GBTK - Register Core Pack
  useEffect(() => {
    if (state.tokenPacks && !state.tokenPacks.some(p => p.name === CorePack.name)) {
      dispatch({ type: 'REGISTER_PACK', payload: CorePack });
    }
  }, [state.tokenPacks]);

  const handleTabSelect = (pdfId, paneId) => {
    if (paneId === 'primary') {
      dispatch({ type: 'SET_STATE', payload: { activePdfId: pdfId } });
    } else {
      dispatch({ type: 'SET_STATE', payload: { secondaryPdfId: pdfId } });
    }
  };

  const handleTabClose = (pdfId) => {
    closePdf(pdfId);
  };

  const addNotification = (message, type = 'info', details = null) => {
    const notification = {
      id: Date.now(),
      message,
      type,
      details
    };
    setNotifications(prev => [...prev, notification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const handleLayerUpdate = useCallback((pdfId, pageNum, layers) => {
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

  const handleUnifiedLoad = async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    const pdfFiles = [];
    let jsonFile = null;
    let gbsFile = null;

    // Categorize files by type
    for (const file of files) {
      if (file.name.endsWith('.pdf')) {
        pdfFiles.push(file);
      } else if (file.name.endsWith('.json')) {
        jsonFile = file;
      } else if (file.name.endsWith('.gbs')) {
        gbsFile = file;
      }
    }

    // Priority: GBS > JSON > PDFs
    // GBS files are complete packages, so they take precedence
    if (gbsFile) {
      await handleLoadGBS({ target: { files: [gbsFile] } });
      return;
    }

    // JSON session files need PDFs to be loaded separately
    if (jsonFile) {
      handleLoadSession({ target: { files: [jsonFile] } });
      // If PDFs were also selected, they'll be loaded as part of session restoration
      return;
    }

    // Just PDFs - regular file upload
    if (pdfFiles.length > 0) {
      const dt = new DataTransfer();
      pdfFiles.forEach(f => dt.items.add(f));
      await handleFileUpload({ target: { files: dt.files } });
    }

    // Reset the input
    event.target.value = '';
  };

  const renderPdfPage = useCallback(async (pdfData, canvasRef, paneId = 'primary') => {
    if (!pdfData || !canvasRef.current) return;

    // CANCEL previous task if it exists to prevent race condition (flipped PDF bug)
    if (renderTaskRef.current[paneId]) {
      renderTaskRef.current[paneId].cancel();
      renderTaskRef.current[paneId] = null;
    }

    const { pdfDoc, currentPage, scale, pageLayers } = pdfData;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Reset transform to ensure clean slate
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        background: 'white',
      };

      // Store the task so we can cancel it if needed
      const renderTask = page.render(renderContext);
      renderTaskRef.current[paneId] = renderTask;

      await renderTask.promise;

      // Clear the ref after successful completion
      renderTaskRef.current[paneId] = null;
    } catch (error) {
      // Ignore cancelled errors - they are expected when rapidly switching pages
      if (error.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', error);
      }
    }
  }, []);

  /* Legacy Canvas Encapsulation Removed */
  // Update canvas tool settings (NO PDF re-render)
  /* Legacy Canvas Tool Effects Removed */
  // Render PDFs only when they actually change
  useEffect(() => {
    renderPdfPage(activePdf, pdfCanvasRef, 'primary');
    if (isDualPaneMode) {
      renderPdfPage(secondaryPdf, secondaryPdfCanvasRef, 'secondary');
    }
  }, [activePdf?.id, activePdf?.currentPage, activePdf?.scale,
  secondaryPdf?.id, secondaryPdf?.currentPage, secondaryPdf?.scale,
    isDualPaneMode, renderPdfPage]);

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
      const pageLayersForCrc = {};
      newState.pdfs.forEach(p => {
        if (p.pageLayers && Object.keys(p.pageLayers).length > 0) {
          pageLayersForCrc[p.id] = p.pageLayers;
        }
      });

      const pdfsForCrc = newState.pdfs.map(p => ({
        id: p.id,
        fileName: p.fileName,
        totalPages: p.totalPages,
        currentPage: p.currentPage,
        scale: p.scale,
        bookmarks: p.bookmarks || [],
        pageLayers: p.pageLayers || {},
      }));

      const finalClientStateForCrc = {
        pdfs: pdfsForCrc,
        activePdfId: newState.activePdfId,
        characters: newState.characters,
        notes: newState.notes,
        counters: newState.counters,
        pageLayers: pageLayersForCrc
      };

      const clientCrc = crc32(JSON.stringify(finalClientStateForCrc)).toString(16);

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
      const decompressedData = JSON.parse(pako.inflate(data, { to: 'string' }));

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
      const activePdf = stateRef.current.pdfs.find(p => p.id === stateRef.current.activePdfId);
      const secondaryPdf = stateRef.current.pdfs.find(p => p.id === stateRef.current.secondaryPdfId);

      /* Pointer Events Disabled for now (requires GameCanvas implementation) */
    };

    const handlePdfAdded = async (pdfData) => {
      if (stateRef.current.pdfs.some(p => p.id === pdfData.id)) return;

      try {
        const pdfUrl = socketService.getPdfUrl(pdfData.id);
        const response = await fetch(pdfUrl);
        const arrayBuffer = await response.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

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

    socketService.on('game-state-delta', handleGameStateDelta);
    socketService.on('page-navigated', handlePageNavigated);
    socketService.on('layers-updated', handleLayersUpdated);
    socketService.on('pdf-added', handlePdfAdded);
    socketService.on('pdf-removed', handlePdfRemoved);
    socketService.on('pointer-event', handlePointerEvent);

    return () => {
      socketService.off('game-state-delta', handleGameStateDelta);
      socketService.off('page-navigated', handlePageNavigated);
      socketService.off('layers-updated', handleLayersUpdated);
      socketService.off('pdf-added', handlePdfAdded);
      socketService.off('pdf-removed', handlePdfRemoved);
      socketService.off('pointer-event', handlePointerEvent);
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

  const prevCharacters = usePrevious(characters);
  useEffect(() => {
    if (socketService.isMultiplayerActive() && JSON.stringify(prevCharacters) !== JSON.stringify(characters)) {
      socketService.updateGameState({ characters: characters }, 'characters');
    }
  }, [characters, prevCharacters]);

  const prevNotes = usePrevious(notes);
  useEffect(() => {
    if (socketService.isMultiplayerActive() && prevNotes !== notes) {
      socketService.updateGameState({ notes: notes }, 'notes');
    }
  }, [notes, prevNotes]);

  const prevCounters = usePrevious(counters);
  useEffect(() => {
    if (socketService.isMultiplayerActive() && JSON.stringify(prevCounters) !== JSON.stringify(counters)) {
      socketService.updateGameState({ counters: counters }, 'characters');
    }
  }, [counters, prevCounters]);

  const handleCreateMultiplayerSession = async (sessionId) => {
    setMultiplayerSession(sessionId);
    setIsHost(true);
    setConnectedPlayers(1);
    addNotification(`Multiplayer session created: ${sessionId}`, 'success');

    const uploadPromises = pdfs
      .filter(pdf => pdf.file)
      .map(pdf => socketService.uploadPdfToSession(pdf.file, {
        id: pdf.id,
        fileName: pdf.fileName,
        totalPages: pdf.totalPages,
        bookmarks: pdf.bookmarks || []
      }));

    await Promise.all(uploadPromises);

    const pdfsForSession = pdfs.map(p => ({
      id: p.id,
      fileName: p.fileName,
      totalPages: p.totalPages,
      bookmarks: p.bookmarks,
      pageLayers: p.pageLayers,
    }));

    socketService.updateGameState({
      pdfs: pdfsForSession,
      characters,
      notes,
      counters,
    });
  };

  const handleJoinMultiplayerSession = async (response) => {
    setMultiplayerSession(response.sessionId || socketService.getSessionInfo().sessionId);
    setIsHost(response.isHost);
    setConnectedPlayers(response.clientCount);

    if (response.gameState) {
      setGameStateVersion(response.version);
      const { activePdfId, ...restOfGameState } = response.gameState;
      dispatch({ type: 'SET_STATE', payload: restOfGameState });

      if (response.gameState.pdfs && response.gameState.pdfs.length > 0) {
        const loadedPdfs = [];
        for (const pdfData of response.gameState.pdfs) {
          try {
            const pdfUrl = socketService.getPdfUrl(pdfData.id);
            const pdfResponse = await fetch(pdfUrl);
            const arrayBuffer = await pdfResponse.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

            loadedPdfs.push({
              ...pdfData,
              pdfDoc,
              file: null
            });
          } catch (error) {
            console.error('Failed to load PDF from session:', pdfData.fileName, error);
          }
        }
        const payload = { pdfs: loadedPdfs };
        if (loadedPdfs.length > 0) {
          payload.activePdfId = loadedPdfs[0].id;
        }
        dispatch({ type: 'SET_STATE', payload });
      }
    }

    addNotification(`Joined multiplayer session`, 'success');
  };

  const handleLeaveMultiplayerSession = () => {
    socketService.disconnect();
    setMultiplayerSession(null);
    setIsHost(false);
    setConnectedPlayers(1);
    addNotification('Left multiplayer session', 'info');
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    if (multiplayerSession && !isHost) {
      addNotification("Only the session host can open PDFs", "error");
      event.target.value = '';
      return;
    }

    const newPdfsData = [];
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;

      if (pdfs.some(p => p.fileName === file.name)) {
        console.warn(`Skipping duplicate file: ${file.name}`);
        continue;
      }

      if (sessionToRestore) {
        const matchingPdfInSession = sessionToRestore.pdfs.find(p => p.fileName === file.name);
        if (matchingPdfInSession) {
          try {
            const url = URL.createObjectURL(file);
            const pdfDoc = await pdfjsLib.getDocument(url).promise;
            newPdfsData.push({
              ...matchingPdfInSession,
              file,
              pdfDoc,
              totalPages: pdfDoc.numPages,
              bookmarks: matchingPdfInSession.bookmarks || await pdfDoc.getOutline() || [],
            });
          } catch (error) {
            console.error('Error loading PDF for session restore:', file.name, error);
          }
        }
      } else {
        try {
          const url = URL.createObjectURL(file);
          const pdfDoc = await pdfjsLib.getDocument(url).promise;
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
            bookmarks: await pdfjsLib.getDocument(url).promise.then(doc => doc.getOutline()).catch(() => []) || [],
          };
          newPdfsData.push(pdfData);
        } catch (error) {
          console.error('Error loading PDF:', file.name, error);
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
        alert('Could not restore session. Please select all the correct PDF files.');
        dispatch({ type: 'SET_STATE', payload: { sessionToRestore: null } });
      }
    } else {
      if (newPdfsData.length > 0) {
        dispatch({
          type: 'SET_STATE', payload: {
            pdfs: [...pdfs, ...newPdfsData],
            activePdfId: newPdfsData[0].id,
          }
        });

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

  const handleSaveSession = () => {
    const sessionData = {
      pdfs: pdfs.map(p => ({
        id: p.id,
        fileName: p.fileName,
        currentPage: p.currentPage,
        scale: p.scale,
        pageLayers: p.pageLayers,
        totalPages: p.totalPages,
        bookmarks: p.bookmarks,
      })),
      activePdfId,
      secondaryPdfId,
      isDualPaneMode,
      characters,
      notes,
      counters,
      version: gameStateVersion
    };

    const jsonString = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gamebook-session.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportGBS = async (metadata) => {
    const zip = new JSZip();

    // Add game metadata
    zip.file('game.json', JSON.stringify(metadata, null, 2));

    // Add session data
    const sessionData = {
      pdfs: pdfs.map(p => ({
        id: p.id,
        fileName: p.fileName,
        currentPage: p.currentPage,
        scale: p.scale,
        pageLayers: p.pageLayers,
        totalPages: p.totalPages,
        bookmarks: p.bookmarks,
      })),
      activePdfId,
      secondaryPdfId,
      isDualPaneMode,
      characters,
      notes,
      counters,
      version: gameStateVersion
    };

    zip.file('session.json', JSON.stringify(sessionData, null, 2));

    // Add PDFs
    const pdfFolder = zip.folder('pdfs');
    for (const pdf of pdfs) {
      if (pdf.file) {
        pdfFolder.file(pdf.fileName, pdf.file);
      } else {
        console.warn(`Skipping PDF without file: ${pdf.fileName}`);
      }
    }

    // Generate and download with game name
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = metadata.name
      ? `${metadata.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gbs`
      : 'session.gbs';
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Store metadata in state
    dispatch({ type: 'SET_STATE', payload: { gameMetadata: metadata } });

    addNotification(`Game exported as ${fileName}`, 'success');
  };

  const handleLoadGBS = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.gbs')) {
      alert('Please select a valid .gbs file');
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
          const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;

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
      alert('Failed to load .gbs file. It may be corrupt or invalid.');
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
          alert(`Session loaded. Please select the following PDF files: ${sessionData.pdfs.map(p => p.fileName).join(', ')}`);
          fileInputRef.current.click();
        } catch (error) {
          console.error('Error parsing session file:', error);
          alert('Could not load session file. It may be corrupt.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleNewSession = () => {
    const hasContent = pdfs.length > 0 || characters.length > 0 || notes || counters.length > 0;

    if (hasContent) {
      const confirmed = window.confirm(
        'Are you sure you want to start a new session?\n\n' +
        'This will close all PDFs and reset all game state including:\n' +
        '• All open PDFs\n' +
        '• Character sheets\n' +
        '• Notes\n' +
        '• Counters\n' +
        '• All annotations\n\n' +
        'This action cannot be undone.'
      );

      if (!confirmed) {
        return;
      }
    }
    if (socketService.isMultiplayerActive()) {
      handleLeaveMultiplayerSession();
    }
    dispatch({ type: 'SET_STATE', payload: initialState });
  };

  const closePdf = (pdfId) => {
    if (multiplayerSession && !isHost) {
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

    dispatch({
      type: 'SET_STATE', payload: {
        pdfs: newPdfs,
        activePdfId: newActivePdfId,
        secondaryPdfId: newSecondaryPdfId
      }
    });
  };

  const updatePdf = (pdfId, updates) => {
    const newPdfs = pdfs.map(p => p.id === pdfId ? { ...p, ...updates } : p);
    dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs } });
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
  goToPageRef.current = goToPage;

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

  const handleSidebarResize = useCallback((newWidth) => {
    setSidebarWidth(newWidth);
    dispatch({ type: 'SET_STATE', payload: { sidebarWidth: newWidth } });
  }, []);

  const handlePaneResize = useCallback((newWidth) => {
    setPrimaryPaneWidth(newWidth);
  }, []);

  const maxSidebarWidth = Math.min(600, window.innerWidth * 0.4);
  const availableWidth = window.innerWidth - sidebarWidth - 2;
  const maxPrimaryPaneWidth = isDualPaneMode ? availableWidth * 0.8 : availableWidth;

  const toggleDualPane = () => {
    if (!isDualPaneMode && pdfs.length > 1) {
      dispatch({
        type: 'SET_STATE', payload: {
          isDualPaneMode: true,
          secondaryPdfId: pdfs.find(p => p.id !== activePdfId)?.id || null
        }
      });
    } else {
      dispatch({
        type: 'SET_STATE', payload: {
          isDualPaneMode: false,
          secondaryPdfId: null
        }
      });
    }
  };

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      handleBookmarkNavigate,
      activePdf,
      secondaryPdf,
      goToPage: (pageNum, pdfId = activePdfId) => goToPage(pdfId, pageNum),
      zoomIn: (pdfId = activePdfId) => zoomIn(pdfId),
      zoomOut: (pdfId = activePdfId) => zoomOut(pdfId)
    }}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300" style={{ width: '100vw', overflow: 'hidden' }}>
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
            <div style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: `${maxSidebarWidth}px`, height: '100%' }}>
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
                {pdfs.length > 1 && (
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
                        { id: 'tokens', name: 'Game Tokens', objects: [], visible: true, locked: false },
                        { id: 'drawings', name: 'Drawings', objects: [], visible: true, locked: false },
                        { id: 'text', name: 'Text & Notes', objects: [], visible: true, locked: false }
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
                onTabClose={handleTabClose}
                onBookmarkNavigate={handleBookmarkNavigate}
                onLayerUpdate={handleLayerUpdate}
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
                  onTabClose={handleTabClose}
                  onBookmarkNavigate={handleBookmarkNavigate}
                  onLayerUpdate={handleLayerUpdate}
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