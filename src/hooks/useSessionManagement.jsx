// src/hooks/useSessionManagement.js
import { useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import JSZip from 'jszip';
import { initialState } from '../state/appState';
import socketService from '../services/SocketService';

export const useSessionManagement = ({
  state,
  dispatch,
  addNotification,
  isHost,
  multiplayerSession,
  handleLeaveMultiplayerSession,
}) => {
  const fileInputRef = useRef(null);
  const { pdfs, characters, notes, counters, sessionToRestore, activePdfId, secondaryPdfId, isDualPaneMode } = state;

  const handleNewSession = () => {
    const hasContent = pdfs.length > 0 || characters.length > 0 || notes || counters.length > 0;
    if (hasContent && !window.confirm('Are you sure you want to start a new session? This will reset all game data.')) {
      return;
    }
    if (socketService.isMultiplayerActive()) {
      handleLeaveMultiplayerSession();
    }
    dispatch({ type: 'SET_STATE', payload: initialState });
    addNotification('New session started', 'success');
  };

  const handleSaveSession = () => {
    const sessionData = {
      pdfs: pdfs.map(p => ({
        id: p.id, fileName: p.fileName, currentPage: p.currentPage, scale: p.scale,
        pageLayers: p.pageLayers, totalPages: p.totalPages, bookmarks: p.bookmarks,
      })),
      activePdfId, secondaryPdfId, isDualPaneMode, characters, notes, counters,
      version: state.gameStateVersion || 0
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gamebook-session.json';
    a.click();
    URL.revokeObjectURL(url);
    addNotification('Session saved successfully', 'success');
  };

  const handleExportGBS = async (metadata) => {
    const zip = new JSZip();
    zip.file('game.json', JSON.stringify(metadata, null, 2));
    const sessionData = {
      pdfs: pdfs.map(p => ({
        id: p.id, fileName: p.fileName, currentPage: p.currentPage, scale: p.scale,
        pageLayers: p.pageLayers, totalPages: p.totalPages, bookmarks: p.bookmarks,
      })),
      activePdfId, secondaryPdfId, isDualPaneMode, characters, notes, counters,
      version: state.gameStateVersion || 0
    };
    zip.file('session.json', JSON.stringify(sessionData, null, 2));
    const pdfFolder = zip.folder('pdfs');
    for (const pdf of pdfs) {
      if (pdf.file) pdfFolder.file(pdf.fileName, pdf.file);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = metadata.name ? `${metadata.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gbs` : 'session.gbs';
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: 'SET_STATE', payload: { gameMetadata: metadata } });
    addNotification(`Game exported as ${fileName}`, 'success');
  };

  const handleLoadSession = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sessionData = JSON.parse(e.target.result);
        dispatch({ type: 'SET_STATE', payload: { sessionToRestore: sessionData } });
        alert(`Session loaded. Please select the following PDF files: ${sessionData.pdfs.map(p => p.fileName).join(', ')}`);
        fileInputRef.current?.click();
      } catch (error) {
        addNotification('Could not load session file. It may be corrupt.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadGBS = async (file) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const gameJsonFile = zip.file('game.json');
      let gameMetadata = {};
      if (gameJsonFile) gameMetadata = JSON.parse(await gameJsonFile.async('string'));

      const sessionJson = await zip.file('session.json').async('string');
      const sessionData = JSON.parse(sessionJson);

      const pdfFolder = zip.folder('pdfs');
      const loadedPdfs = [];
      for (const pdfInfo of sessionData.pdfs) {
        const pdfFile = pdfFolder.file(pdfInfo.fileName);
        if (pdfFile) {
          const pdfBlob = await pdfFile.async('blob');
          const pdfDoc = await pdfjsLib.getDocument(URL.createObjectURL(pdfBlob)).promise;
          loadedPdfs.push({
            ...pdfInfo,
            pdfDoc,
            file: new File([pdfBlob], pdfInfo.fileName, { type: 'application/pdf' })
          });
        }
      }
      dispatch({ type: 'SET_STATE', payload: { ...sessionData, pdfs: loadedPdfs, gameMetadata } });
      addNotification(`Game "${gameMetadata.name || 'session'}" loaded successfully`, 'success');
    } catch (error) {
      addNotification('Failed to load .gbs file. It may be corrupt.', 'error');
    }
  };

  const handleFileUpload = async (files) => {
    if (multiplayerSession && !isHost) {
      addNotification("Only the session host can open PDFs", "error");
      return;
    }
    const newPdfsData = [];
    for (const file of files) {
      try {
        const url = URL.createObjectURL(file);
        const pdfDoc = await pdfjsLib.getDocument(url).promise;
        const bookmarks = await pdfDoc.getOutline().catch(() => []) || [];
        const pdfData = {
          // Usamos un ID más robusto basado en el nombre y tamaño para evitar colisiones
          id: `${file.name}-${file.size}`,
          fileName: file.name,
          file,
          pdfDoc,
          totalPages: pdfDoc.numPages,
          currentPage: 1,
          scale: 1,
          initialScaleSet: false,
          pageLayers: {},
          bookmarks,
        };
        newPdfsData.push(pdfData);
      } catch (error) {
        addNotification(`Error loading PDF: ${file.name}`, 'error');
      }
    }

    if (newPdfsData.length > 0) {
      const updatedPdfs = [...pdfs, ...newPdfsData];
      dispatch({ type: 'SET_STATE', payload: { pdfs: updatedPdfs, activePdfId: newPdfsData[0].id } });

      // --- INICIO DEL CAMBIO IMPORTANTE ---
      if (socketService.isMultiplayerActive()) {
        // 1. Subir los archivos PDF al servidor
        for (const pdfData of newPdfsData) {
          await socketService.uploadPdfToSession(pdfData.file, pdfData);
        }

        // 2. Notificar a todos los clientes del nuevo estado de la lista de PDFs
        //    (sin los objetos pesados como pdfDoc o file)
        const pdfsForStateUpdate = updatedPdfs.map(p => {
          const { file, pdfDoc, ...rest } = p;
          return rest;
        });

        socketService.updateGameState({ pdfs: pdfsForStateUpdate });
        // --- FIN DEL CAMBIO IMPORTANTE ---
      }
    }
  };

  const handleUnifiedLoad = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    const gbsFile = files.find(f => f.name.endsWith('.gbs'));
    const jsonFile = files.find(f => f.name.endsWith('.json'));
    const pdfFiles = files.filter(f => f.name.endsWith('.pdf'));

    if (gbsFile) await handleLoadGBS(gbsFile);
    else if (jsonFile) handleLoadSession(jsonFile);
    else if (pdfFiles.length > 0) await handleFileUpload(pdfFiles);
    event.target.value = '';
  };

  return {
    fileInputRef,
    handleNewSession,
    handleSaveSession,
    handleExportGBS,
    handleUnifiedLoad,
    triggerLoadFiles: () => fileInputRef.current?.click(),
  };
};