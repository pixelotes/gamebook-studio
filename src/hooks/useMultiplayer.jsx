// src/hooks/useMultiplayer.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/SocketService';
import eventLogService from '../services/EventLogService';

import { runClientWorkerTask } from '../workers/workerClient';


export const useMultiplayer = ({ state, dispatch, usePrevious }) => {
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

    const uploadResults = await Promise.all(uploadPromises);
    // uploadPdfToSession() returns the server's stored pdfData, which carries
    // filePath (where the file actually landed in uploads/). Keep it so a
    // later joiner's PDF fetch can resolve the file — otherwise the plain
    // updateGameState() below would overwrite the server's filePath-bearing
    // entry (set by addPdf() during upload) with one that has no filePath,
    // and every join-time PDF load would 404 and fail to parse.
    const filePathById = new Map(uploadResults.map(r => [r.pdfData.id, r.pdfData.filePath]));

    const pdfsForSession = pdfs.map(p => ({
        id: p.id,
        fileName: p.fileName,
        totalPages: p.totalPages,
        bookmarks: p.bookmarks,
        pageLayers: p.pageLayers,
        ...(filePathById.has(p.id) ? { filePath: filePathById.get(p.id) } : {}),
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
            if (!pdfResponse.ok) {
              throw new Error(`PDF not found on server (${pdfResponse.status})`);
            }
            const arrayBuffer = await pdfResponse.arrayBuffer();

            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
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
    const handleGameStateDelta = async ({ delta }) => {
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
        const newSerializableState = await runClientWorkerTask('patch', { state: serializableState, delta });
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
    
    // 'layers-updated' is handled solely by App.jsx's listener — this hook's
    // older version decoded the payload through a different (client-worker
    // 'inflate') path than the one the server/sender actually produces,
    // which threw a JSON parse error on every drawing/token update.
    const handlePageNavigated = (data) => {
        const {pdfId, currentPage, scale} = data;
        const newPdfs = stateRef.current.pdfs.map(p => p.id === pdfId ? { ...p, currentPage, scale } : p);
        dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs }});
    };
    
    const handlePointerEvent = (data) => {
        // Handled by App.jsx's own 'pointer-event' listener.
    };

    // 'pdf-added' is handled solely by App.jsx's listener — it dedupes by
    // fileName (not just id) and sets activePdfId, which this hook's older
    // version didn't; registering both raced and left the PDF invisible on
    // joining clients while duplicating it for the uploading host.
    socketService.on('player-joined', handlePlayerJoined);
    socketService.on('player-left', handlePlayerLeft);
    socketService.on('game-state-delta', handleGameStateDelta);
    socketService.on('event-logged', handleEventLogged);
    socketService.on('page-navigated', handlePageNavigated);
    socketService.on('pointer-event', handlePointerEvent);

    return () => {
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
      socketService.off('game-state-delta', handleGameStateDelta);
      socketService.off('event-logged', handleEventLogged);
      socketService.off('page-navigated', handlePageNavigated);
      socketService.off('pointer-event', handlePointerEvent);
    };
  }, [dispatch, addNotification]);

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
    setConnectedPlayers,
    notifications,
    isHost,
    handleCreateMultiplayerSession,
    handleJoinMultiplayerSession,
    handleLeaveMultiplayerSession,
    addNotification,
  };
};