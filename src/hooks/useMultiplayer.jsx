// src/hooks/useMultiplayer.js
import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/SocketService';
import eventLogService from '../services/EventLogService';
import pako from 'pako';
import { create } from 'jsondiffpatch';

// Crear una instancia de jsondiffpatch para aplicar los deltas
const diffpatcher = create({
  objectHash: (obj) => obj.id,
});

export const useMultiplayer = ({ state, dispatch, usePrevious, fabricCanvas, secondaryFabricCanvas }) => {
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [multiplayerSession, setMultiplayerSession] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [isHost, setIsHost] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const addNotification = useCallback((message, type = 'info', details = null) => {
    const notification = { id: Date.now(), message, type, details };
    setNotifications(prev => [...prev, notification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  const handleCreateMultiplayerSession = useCallback(async (response) => {
    setMultiplayerSession(response.sessionId);
    setIsHost(true);
    setConnectedPlayers(1);
    addNotification(`Sesión multijugador creada: ${response.sessionId}`, 'success');
    eventLogService.setPlayerName(response.playerName);

    const { pdfs, characters, notes, counters } = stateRef.current;
    
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
        eventLog: eventLogService.getEvents() // Sync initial event log
    });
  }, [addNotification]);

  const handleJoinMultiplayerSession = useCallback(async (response) => {
    setMultiplayerSession(response.sessionId || socketService.getSessionInfo().sessionId);
    setIsHost(response.isHost);
    setConnectedPlayers(response.clientCount);
    eventLogService.setPlayerName(response.playerName);
    
    if (response.gameState) {
      const { eventLog, ...restOfGameState } = response.gameState;
      dispatch({ type: 'SET_STATE', payload: restOfGameState });
      eventLogService.loadEvents(eventLog); // Load the synchronized event log

      if (response.gameState.pdfs && response.gameState.pdfs.length > 0) {
        const loadedPdfs = [];
        for (const pdfData of response.gameState.pdfs) {
          try {
            const pdfUrl = socketService.getPdfUrl(pdfData.id);
            const pdfResponse = await fetch(pdfUrl);
            const arrayBuffer = await pdfResponse.arrayBuffer();
            const { default: pdfjsLib } = await import('pdfjs-dist/build/pdf');
            const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            loadedPdfs.push({ ...pdfData, pdfDoc, file: null });
          } catch (error) {
            console.error('Fallo al cargar el PDF de la sesión:', pdfData.fileName, error);
            addNotification(`No se pudo cargar el PDF: ${pdfData.fileName}`, 'error');
          }
        }
        const payload = { pdfs: loadedPdfs };
        if (loadedPdfs.length > 0) payload.activePdfId = loadedPdfs[0].id;
        dispatch({ type: 'SET_STATE', payload });
      }
    }
    
    addNotification(`Te has unido a la sesión como ${response.playerName}`, 'success');
  }, [addNotification, dispatch]);

  const handleLeaveMultiplayerSession = useCallback(() => {
    socketService.disconnect();
    setMultiplayerSession(null);
    setIsHost(false);
    setConnectedPlayers(1);
    addNotification('Has abandonado la sesión', 'info');
    eventLogService.setPlayerName('Player 1'); // Reset to default
  }, [addNotification]);

  useEffect(() => {
    const handlePlayerJoined = (data) => {
      setConnectedPlayers(data.clientCount);
      addNotification(`${data.name} se ha unido`, 'info', `Hay ${data.clientCount} jugadores.`);
    };

    const handlePlayerLeft = (data) => {
      setConnectedPlayers(data.clientCount);
      addNotification(`Un jugador se ha desconectado`, 'info', `Quedan ${data.clientCount} jugadores.`);
    };

    const handleEventLogged = (event) => {
        eventLogService.receiveEvent(event);
    };

    // --- INICIO DE LA FUNCIÓN CORREGIDA ---
    const handleGameStateDelta = ({ delta }) => {
        const currentState = stateRef.current;
        
        // 1. Crear una versión del estado actual que sea "segura" (solo datos JSON)
        //    Esto imita la estructura de datos que tiene el servidor.
        const serializableState = {
            ...currentState,
            pdfs: currentState.pdfs.map(p => {
                const { pdfDoc, file, ...rest } = p; // Quitamos los objetos problemáticos
                return rest;
            })
        };

        // 2. Aplicar el parche a esta versión segura
        const newSerializableState = diffpatcher.patch(serializableState, delta);
        if (!newSerializableState) return; // Si no hay cambios, no hacer nada

        // 3. Reconstruir el estado final, restaurando los objetos pdfDoc del estado original
        const finalPdfs = newSerializableState.pdfs.map(newPdfData => {
            const originalPdf = currentState.pdfs.find(p => p.id === newPdfData.id);
            return {
                ...newPdfData,
                pdfDoc: originalPdf ? originalPdf.pdfDoc : null,
                file: originalPdf ? originalPdf.file : null,
            };
        });
        
        // Don't overwrite the event log from deltas, it's handled separately
        const { eventLog, ...stateFromDelta } = newSerializableState;

        const finalState = {
            ...stateFromDelta,
            pdfs: finalPdfs,
        };
        
        // 4. Actualizar el estado de la aplicación
        dispatch({ type: 'SET_STATE', payload: finalState });
    };
    // --- FIN DE LA FUNCIÓN CORREGIDA ---
    
    const handleLayersUpdate = (compressedData) => {
      try {
        const data = JSON.parse(pako.inflate(compressedData, { to: 'string' }));
        const { pdfId, pageNum, layers } = data;
        
        const currentPdfs = stateRef.current.pdfs;
        const newPdfs = currentPdfs.map(p => {
            if (p.id === pdfId) {
                const updatedPageLayers = { ...p.pageLayers, [pageNum]: layers };
                return { ...p, pageLayers: updatedPageLayers };
            }
            return p;
        });
        dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs } });

        if (stateRef.current.activePdfId === pdfId && fabricCanvas.current) {
            fabricCanvas.current.updateLayersFromMultiplayer(newPdfs.find(p => p.id === pdfId).pageLayers);
        }
        if (stateRef.current.secondaryPdfId === pdfId && secondaryFabricCanvas.current) {
            secondaryFabricCanvas.current.updateLayersFromMultiplayer(newPdfs.find(p => p.id === pdfId).pageLayers);
        }
      } catch (error) {
        console.error("Error al descomprimir datos de capas:", error);
      }
    };
    
    const handlePageNavigated = (data) => {
        const {pdfId, currentPage, scale} = data;
        const newPdfs = stateRef.current.pdfs.map(p => p.id === pdfId ? { ...p, currentPage, scale } : p);
        dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs }});
    };
    
    const handlePointerEvent = (data) => {
        const { pdfId, x, y, color } = data;
        if (stateRef.current.activePdfId === pdfId && fabricCanvas.current) {
            fabricCanvas.current.addPointer(x, y, color);
        }
        if (stateRef.current.secondaryPdfId === pdfId && secondaryFabricCanvas.current) {
            secondaryFabricCanvas.current.addPointer(x, y, color);
        }
    };

    const handlePdfAdded = async (pdfData) => {
        if (stateRef.current.pdfs.some(p => p.id === pdfData.id)) return;
        addNotification(`Recibiendo PDF: ${pdfData.fileName}`, 'info');
        try {
            const pdfUrl = socketService.getPdfUrl(pdfData.id);
            const response = await fetch(pdfUrl);
            const arrayBuffer = await response.arrayBuffer();
            const { default: pdfjsLib } = await import('pdfjs-dist/build/pdf');
            const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            const newPdf = { ...pdfData, pdfDoc, file: null };
            dispatch({ type: 'SET_STATE', payload: { pdfs: [...stateRef.current.pdfs, newPdf] }});
            addNotification(`${pdfData.fileName} cargado correctamente.`, 'success');
        } catch(error) {
            console.error("Error al procesar el PDF recibido:", error);
            addNotification(`Error al cargar ${pdfData.fileName}`, 'error');
        }
    };

    socketService.on('player-joined', handlePlayerJoined);
    socketService.on('player-left', handlePlayerLeft);
    socketService.on('game-state-delta', handleGameStateDelta);
    socketService.on('event-logged', handleEventLogged);
    socketService.on('layers-updated', handleLayersUpdate);
    socketService.on('page-navigated', handlePageNavigated);
    socketService.on('pointer-event', handlePointerEvent);
    socketService.on('pdf-added', handlePdfAdded);

    return () => {
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
      socketService.off('game-state-delta', handleGameStateDelta);
      socketService.off('event-logged', handleEventLogged);
      socketService.off('layers-updated', handleLayersUpdate);
      socketService.off('page-navigated', handlePageNavigated);
      socketService.off('pointer-event', handlePointerEvent);
      socketService.off('pdf-added', handlePdfAdded);
    };
  }, [dispatch, addNotification, fabricCanvas, secondaryFabricCanvas]);

  const { characters, notes, counters } = state;
  const prevCharacters = usePrevious(characters);
  useEffect(() => {
    if (socketService.isMultiplayerActive() && JSON.stringify(prevCharacters) !== JSON.stringify(characters)) {
      socketService.updateGameState({ characters: characters });
    }
  }, [characters, prevCharacters]);

  const prevNotes = usePrevious(notes);
  useEffect(() => {
    if (socketService.isMultiplayerActive() && prevNotes !== notes) {
      socketService.updateGameState({ notes: notes });
    }
  }, [notes, prevNotes]);

  const prevCounters = usePrevious(counters);
  useEffect(() => {
    if (socketService.isMultiplayerActive() && JSON.stringify(prevCounters) !== JSON.stringify(counters)) {
      socketService.updateGameState({ counters: counters });
    }
  }, [counters, prevCounters]);

  return {
    showMultiplayerModal,
    setShowMultiplayerModal,
    multiplayerSession,
    connectedPlayers,
    notifications,
    isHost,
    handleCreateMultiplayerSession,
    handleJoinMultiplayerSession,
    handleLeaveMultiplayerSession,
    addNotification,
  };
};