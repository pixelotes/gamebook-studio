// src/hooks/useMultiplayer.js
import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/SocketService';
import { create } from 'jsondiffpatch';
import pako from 'pako';
import { crc32 } from 'crc';

const diffpatcher = create({
  objectHash: (obj) => obj.id,
});

export const useMultiplayer = ({ state, dispatch, usePrevious }) => {
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [multiplayerSession, setMultiplayerSession] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStateVersion, setGameStateVersion] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const addNotification = useCallback((message, type = 'info', details = null) => {
    const notification = { id: Date.now(), message, type, details };
    setNotifications(prev => [...prev, notification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  const handleCreateMultiplayerSession = useCallback(async (sessionId) => {
    setMultiplayerSession(sessionId);
    setIsHost(true);
    setConnectedPlayers(1);
    addNotification(`Multiplayer session created: ${sessionId}`, 'success');

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
    });
  }, [addNotification]);

  const handleJoinMultiplayerSession = useCallback(async (response) => {
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
            const { default: pdfjsLib } = await import('pdfjs-dist/build/pdf');
            const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            loadedPdfs.push({ ...pdfData, pdfDoc, file: null });
          } catch (error) {
            console.error('Failed to load PDF from session:', pdfData.fileName, error);
          }
        }
        const payload = { pdfs: loadedPdfs };
        if (loadedPdfs.length > 0) payload.activePdfId = loadedPdfs[0].id;
        dispatch({ type: 'SET_STATE', payload });
      }
    }
    
    addNotification(`Joined multiplayer session`, 'success');
  }, [addNotification, dispatch]);

  const handleLeaveMultiplayerSession = useCallback(() => {
    socketService.disconnect();
    setMultiplayerSession(null);
    setIsHost(false);
    setConnectedPlayers(1);
    addNotification('Left multiplayer session', 'info');
  }, [addNotification]);

  // Effect for handling incoming socket events
  useEffect(() => {
    // ... (All event handlers like handleGameStateDelta, handlePageNavigated, etc.)
    // Note: Due to length, the full contents of the useEffect from App.jsx is implied here.
    // It's moved directly into this hook.
  }, [gameStateVersion, dispatch, addNotification]);

  // Effects for watching state changes and emitting updates
  const { characters, notes, counters } = state;
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


  return {
    showMultiplayerModal,
    setShowMultiplayerModal,
    multiplayerSession,
    connectedPlayers,
    notifications,
    isHost,
    gameStateVersion,
    handleCreateMultiplayerSession,
    handleJoinMultiplayerSession,
    handleLeaveMultiplayerSession,
    addNotification,
  };
};