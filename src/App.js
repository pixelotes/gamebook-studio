import React, { useReducer, useRef, useEffect, useCallback, useState } from 'react';
import { Upload, RotateCcw, Save, Menu, FilePlus, X, Wifi, Moon, Sun } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import FloatingDice from './components/FloatingDice';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import PDFViewer from './components/PDFViewer';
import { AppContext, initialState, reducer } from './state/appState';
import { TOKEN_SHAPES } from './data/Shapes';
import { MultiplayerModal, MultiplayerStatus, MultiplayerNotifications } from './components/MultiplayerModal';
import socketService from './services/SocketService';
import { create } from 'jsondiffpatch';
import pako from 'pako';
import { crc32 } from 'crc';

const diffpatcher = create({
  objectHash: (obj) => obj.id,
});


//pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
// Configure PDF.js for better compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Disable some problematic features for better compatibility
pdfjsLib.getDocument.GlobalWorkerOptions = {
  workerSrc: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`,
};

// Custom hook to get the previous value of a prop or state
const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

// Enhanced Mock Fabric.js Canvas
class MockFabricCanvas {
  constructor(canvasElement, onLayerUpdate) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.pageLayers = {};
    this.currentPage = 1;
    this.activeLayer = 'tokens';
    this.isDrawing = false;
    this.isDragging = false;
    this.dragTarget = null;
    this.dragOffset = { x: 0, y: 0 };
    this.tool = 'select';
    this.selectedColor = '#ff6b6b';
    this.selectedToken = null;
    this.tokenSize = 20;
    this.scale = 1;
    this.startPos = { x: 0, y: 0 };
    this.onLayerUpdate = onLayerUpdate;
    this.currentPdfId = null;
    this.setupEvents();
  }

  setCurrentPdf(pdfId) {
    this.currentPdfId = pdfId;
  }

  updateLayersFromMultiplayer(layers) {
    this.pageLayers[this.currentPage] = layers;
    this.render();
  }
  
  get layers() {
    return this.pageLayers[this.currentPage] || [];
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
  }
  
  loadPageLayers(pageLayers) {
    this.pageLayers = pageLayers;
  }

  setCurrentPage(pageNum) {
    if (!this.pageLayers[pageNum]) {
      this.pageLayers[pageNum] = [
        { id: 'tokens', name: 'Game Tokens', objects: [], visible: true, locked: false },
        { id: 'drawings', name: 'Drawings', objects: [], visible: true, locked: false },
        { id: 'text', name: 'Text & Notes', objects: [], visible: true, locked: false }
      ];
    }
    this.currentPage = pageNum;
    this.render();
  }

  setScale(scale) {
    this.scale = scale;
    this.render();
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.tool === 'select') {
      const clickedToken = this.findTokenAt(x, y);
      if (clickedToken) {
        this.isDragging = true;
        this.dragTarget = clickedToken;
        this.dragOffset = { x: x - clickedToken.x * this.scale, y: y - clickedToken.y * this.scale };
        return;
      }
    } else if (this.tool === 'eraser') {
      this.removeObjectAt(x, y);
      return;
    }

    const activeLayerObj = this.layers.find(l => l.id === this.activeLayer);
    if (!activeLayerObj || activeLayerObj.locked) return;

    if (this.tool === 'token' && this.selectedToken) {
      this.addObject('tokens', {
        type: 'gameToken',
        shape: this.selectedToken.shape,
        x: x / this.scale,
        y: y / this.scale,
        size: this.tokenSize,
        color: this.selectedToken.color,
        strokeColor: this.selectedToken.color === '#ffffff' ? '#000000' : '#ffffff',
        id: Date.now()
      });
    } else if (this.tool === 'draw') {
      this.isDrawing = true;
      this.startPath(x / this.scale, y / this.scale);
    } else if (this.tool === 'rectangle') {
      this.isDrawing = true;
      this.startPos = { x: x / this.scale, y: y / this.scale };
    } else if (this.tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        this.addObject('text', {
          type: 'text',
          x: x / this.scale,
          y: y / this.scale,
          content: text,
          color: this.selectedColor,
          font: '16px Arial',
          id: Date.now()
        });
      }
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isDragging && this.dragTarget) {
      this.dragTarget.x = (x - this.dragOffset.x) / this.scale;
      this.dragTarget.y = (y - this.dragOffset.y) / this.scale;
      this.render();
    } else if (this.isDrawing && this.tool === 'draw') {
      this.continuePath(x / this.scale, y / this.scale);
    }
  }

  handleMouseUp(e) {
    if (this.isDrawing) {
        if (this.tool === 'rectangle') {
            const rect = this.canvas.getBoundingClientRect();
            const endX = (e.clientX - rect.left) / this.scale;
            const endY = (e.clientY - rect.top) / this.scale;

            const x = Math.min(this.startPos.x, endX);
            const y = Math.min(this.startPos.y, endY);
            const width = Math.abs(this.startPos.x - endX);
            const height = Math.abs(this.startPos.y - endY);

            if (width > 2 && height > 2) { 
                this.addObject('drawings', {
                    type: 'rectangle',
                    x, y, width, height,
                    color: this.selectedColor,
                    id: Date.now()
                });
            }
        }
        
        const newLayers = JSON.parse(JSON.stringify(this.layers));
        if (this.onLayerUpdate && this.currentPdfId) {
            this.onLayerUpdate(this.currentPdfId, this.currentPage, newLayers);
        }
    }


    if (this.isDragging && this.dragTarget) {
      const newLayers = JSON.parse(JSON.stringify(this.layers));
      if (this.onLayerUpdate && this.currentPdfId) {
        this.onLayerUpdate(this.currentPdfId, this.currentPage, newLayers);
      }
    }

    this.isDragging = false;
    this.dragTarget = null;
    this.isDrawing = false;
    this.startPos = null;
  }

  handleDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedToken = this.findTokenAt(x, y);
    if (clickedToken) {
      this.removeToken(clickedToken.id);
    }
  }

  findTokenAt(x, y) {
    const tokensLayer = this.layers.find(l => l.id === 'tokens');
    if (!tokensLayer || !tokensLayer.visible) return null;

    for (let i = tokensLayer.objects.length - 1; i >= 0; i--) {
      const token = tokensLayer.objects[i];
      if (token.type === 'gameToken') {
        const distance = Math.sqrt((x - token.x * this.scale) ** 2 + (y - token.y * this.scale) ** 2);
        if (distance <= token.size * this.scale) {
          return token;
        }
      }
    }
    return null;
  }
  
  removeObjectAt(x, y) {
    let changed = false;
    const newLayers = this.layers.map(layer => {
        if (!layer.visible || layer.locked) return layer;
        const originalLength = layer.objects.length;
        const newObjects = layer.objects.filter(obj => {
            if (obj.type === 'gameToken') {
                const distance = Math.sqrt((x - obj.x * this.scale) ** 2 + (y - obj.y * this.scale) ** 2);
                return distance > obj.size * this.scale;
            }
            if (obj.type === 'path') {
                return !obj.points.some(p => {
                    const distance = Math.sqrt((x - p.x * this.scale) ** 2 + (y - p.y * this.scale) ** 2);
                    return distance < 10;
                });
            }
            return true;
        });
        if (newObjects.length !== originalLength) {
            changed = true;
        }
        return { ...layer, objects: newObjects };
    });

    if (changed) {
        this.pageLayers[this.currentPage] = newLayers;
        this.render();
        if (this.onLayerUpdate && this.currentPdfId) {
            this.onLayerUpdate(this.currentPdfId, this.currentPage, newLayers);
        }
    }
  }

  removeToken(tokenId) {
    const tokensLayer = this.layers.find(l => l.id === 'tokens');
    if (tokensLayer) {
        const newObjects = tokensLayer.objects.filter(obj => obj.id !== tokenId);
        const newLayers = this.layers.map(l =>
            l.id === 'tokens' ? { ...l, objects: newObjects } : l
        );
        this.pageLayers[this.currentPage] = newLayers;
        this.render();
        if (this.onLayerUpdate && this.currentPdfId) {
            this.onLayerUpdate(this.currentPdfId, this.currentPage, newLayers);
        }
    }
  }

  setSelectedToken(shape, color) {
    this.selectedToken = { shape: shape, color: color };
    this.setTool('token');
  }
  
  setTokenSize(size) {
    this.tokenSize = size;
  }

  addObject(layerId, obj) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
        const newObjects = [...layer.objects, obj];
        const newLayers = this.layers.map(l =>
            l.id === layerId ? { ...l, objects: newObjects } : l
        );
        this.pageLayers[this.currentPage] = newLayers;
        this.render();
        if (this.onLayerUpdate && this.currentPdfId) {
            this.onLayerUpdate(this.currentPdfId, this.currentPage, newLayers);
        }
    }
  }

  startPath(x, y) {
    this.addObject('drawings', {
      type: 'path',
      points: [{ x, y }],
      color: this.selectedColor,
      id: Date.now()
    });
  }

  continuePath(x, y) {
    const drawingsLayer = this.layers.find(l => l.id === 'drawings');
    if (drawingsLayer && drawingsLayer.objects.length > 0) {
      const lastObj = drawingsLayer.objects[drawingsLayer.objects.length - 1];
      if (lastObj && lastObj.type === 'path') {
        lastObj.points.push({ x, y });
        this.render();
      }
    }
  }

  toggleLayerVisibility(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      this.render();
    }
  }

  clearLayer(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
        const newLayers = this.layers.map(l =>
            l.id === layerId ? { ...l, objects: [] } : l
        );
        this.pageLayers[this.currentPage] = newLayers;
        this.render();
        if (this.onLayerUpdate && this.currentPdfId) {
            this.onLayerUpdate(this.currentPdfId, this.currentPage, newLayers);
        }
    }
  }

  clear() {
    const newLayers = this.layers.map(layer => ({ ...layer, objects: [] }));
    this.pageLayers[this.currentPage] = newLayers;
    this.render();
    if (this.onLayerUpdate && this.currentPdfId) {
        this.onLayerUpdate(this.currentPdfId, this.currentPage, newLayers);
    }
  }

  setTool(tool) {
    this.tool = tool;
  }

  setActiveLayer(layerId) {
    this.activeLayer = layerId;
  }

  setColor(color) {
    this.selectedColor = color;
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);
    
    this.layers.forEach(layer => {
      if (!layer.visible) return;
      
      layer.objects.forEach(obj => {
        this.ctx.save();
        
        if (obj.type === 'gameToken') {
          this.renderGameToken(obj);
        } else if (obj.type === 'path') {
          this.ctx.beginPath();
          this.ctx.strokeStyle = obj.color;
          this.ctx.lineWidth = 3;
          this.ctx.lineCap = 'round';
          this.ctx.lineJoin = 'round';
          
          if (obj.points && obj.points.length > 1) {
            this.ctx.moveTo(obj.points[0].x, obj.points[0].y);
            for (let i = 1; i < obj.points.length; i++) {
              this.ctx.lineTo(obj.points[i].x, obj.points[i].y);
            }
          }
          this.ctx.stroke();
        } else if (obj.type === 'rectangle') {
            this.ctx.strokeStyle = obj.color;
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        } else if (obj.type === 'text') {
            this.ctx.fillStyle = obj.color;
            this.ctx.font = obj.font || '16px Arial';
            this.ctx.fillText(obj.content, obj.x, obj.y);
        }
        
        this.ctx.restore();
      });
    });
    this.ctx.restore();
  }

  renderGameToken(token) {
    const x = token.x;
    const y = token.y;
    const size = token.size;
    const color = token.color;
    const strokeColor = token.strokeColor;
    const shape = token.shape;
    
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2;
    
    if (shape === 'circle') {
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (shape === 'square') {
      this.ctx.fillRect(x - size, y - size, size * 2, size * 2);
      this.ctx.strokeRect(x - size, y - size, size * 2, size * 2);
    } else if (shape === 'triangle') {
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - size);
      this.ctx.lineTo(x - size, y + size);
      this.ctx.lineTo(x + size, y + size);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (shape === 'diamond') {
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - size);
      this.ctx.lineTo(x + size, y);
      this.ctx.lineTo(x, y + size);
      this.ctx.lineTo(x - size, y);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (shape === 'heart') {
      this.renderHeart(x, y, size);
    } else if (shape === 'star') {
      this.renderStar(x, y, size);
    } else {
      const icon = TOKEN_SHAPES[shape]?.icon;
      if (icon) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.2, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.stroke();

        this.ctx.fillStyle = strokeColor;
        this.ctx.font = `${size * 1.8}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(icon, x, y);
      }
    }
  }

  renderHeart(x, y, size) {
    const scale = size / 20;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + 5 * scale);
    this.ctx.bezierCurveTo(x, y + 2 * scale, x - 5 * scale, y - 2 * scale, x - 10 * scale, y + 2 * scale);
    this.ctx.bezierCurveTo(x - 15 * scale, y + 7 * scale, x - 15 * scale, y + 12 * scale, x - 10 * scale, y + 12 * scale);
    this.ctx.bezierCurveTo(x - 5 * scale, y + 17 * scale, x, y + 22 * scale, x, y + 22 * scale);
    this.ctx.bezierCurveTo(x, y + 22 * scale, x + 5 * scale, y + 17 * scale, x + 10 * scale, y + 12 * scale);
    this.ctx.bezierCurveTo(x + 15 * scale, y + 12 * scale, x + 15 * scale, y + 7 * scale, x + 10 * scale, y + 2 * scale);
    this.ctx.bezierCurveTo(x + 5 * scale, y - 2 * scale, x, y + 2 * scale, x, y + 5 * scale);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  renderStar(x, y, size) {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y - outerRadius);

    for (let i = 0; i < spikes; i++) {
      const xOuter = x + Math.cos(rot) * outerRadius;
      const yOuter = y + Math.sin(rot) * outerRadius;
      this.ctx.lineTo(xOuter, yOuter);
      rot += step;

      const xInner = x + Math.cos(rot) * innerRadius;
      const yInner = y + Math.sin(rot) * innerRadius;
      this.ctx.lineTo(xInner, yInner);
      rot += step;
    }

    this.ctx.lineTo(x, y - outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
}

const GamebookApp = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    pdfs, activePdfId, characters, notes, counters, selectedTool, selectedColor,
    selectedTokenShape, selectedTokenColor, tokenSize, sessionToRestore,
    isSidebarVisible, menuOpen, theme
  } = state;

  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [multiplayerSession, setMultiplayerSession] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStateVersion, setGameStateVersion] = useState(0);

  const pdfCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const sessionFileInputRef = useRef(null);
  const fabricCanvas = useRef(null);
  
  const activePdf = pdfs.find(p => p.id === activePdfId);

  const stateRef = useRef(state);
  stateRef.current = state;

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
        socketService.updateLayers(pdfId, pageNum, layers);
    }
  }, []);

  const renderPdfPage = useCallback(async () => {
    if (!activePdf || !pdfCanvasRef.current) return;
  
    const { pdfDoc, currentPage, scale, pageLayers } = activePdf;
  
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: scale });
      
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear the canvas first
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        background: 'white',
        transform: null
      };
  
      await page.render(renderContext).promise;
  
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = viewport.width;
        overlayCanvasRef.current.height = viewport.height;
        if (fabricCanvas.current) {
          fabricCanvas.current.loadPageLayers(pageLayers);
          fabricCanvas.current.setScale(scale);
          fabricCanvas.current.setCurrentPage(currentPage);
        }
      }
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }, [activePdf]);
  
  useEffect(() => {
    if (overlayCanvasRef.current && !fabricCanvas.current) {
      fabricCanvas.current = new MockFabricCanvas(overlayCanvasRef.current, handleLayerUpdate);
    }
    if (fabricCanvas.current) {
      fabricCanvas.current.setTokenSize(tokenSize);
      fabricCanvas.current.setTool(selectedTool);
      fabricCanvas.current.setColor(selectedColor);
      if (activePdf) {
        fabricCanvas.current.setCurrentPdf(activePdf.id);
      }
      if (selectedTool === 'token') {
        fabricCanvas.current.setSelectedToken(selectedTokenShape, selectedTokenColor);
      }
    }
    renderPdfPage();
  }, [activePdf, tokenSize, selectedTool, selectedColor, selectedTokenShape, selectedTokenColor, renderPdfPage, handleLayerUpdate]);

  useEffect(() => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, [theme]);

  useEffect(() => {
    const handleGameStateDelta = async (data) => {
        if (data.fromVersion !== gameStateVersion) {
            // We've missed an update, request a catch-up from the server
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
        
        // --- CRC Validation Start ---
        const serverCrc = data.crc;
        console.log(`Received CRC from server: ${serverCrc}`);

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
        console.log(`Calculated Client CRC: ${clientCrc}`);

        if (clientCrc === serverCrc) {
            console.log('%cCRC Match!', 'color: green; font-weight: bold;');
        } else {
            console.error('%cCRC Mismatch!', 'color: red; font-weight: bold;');
        }
        // --- CRC Validation End ---

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
        // Check if data is wrapped in an object and extract it
        const compressedData = data.data ? data.data : data;

        // Decompress the incoming data
        const decompressedData = JSON.parse(pako.inflate(compressedData, { to: 'string' }));

        if (fabricCanvas.current && decompressedData.pdfId === stateRef.current.activePdfId && decompressedData.pageNum === stateRef.current.pdfs.find(p=>p.id === decompressedData.pdfId)?.currentPage) {
            fabricCanvas.current.updateLayersFromMultiplayer(decompressedData.layers);
        }
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

const handlePdfAdded = async (pdfData) => {
    // If a PDF with the same ID already exists, do nothing.
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
            // If a PDF with the same name exists, replace it.
            const oldPdfId = currentPdfs[existingPdfIndex].id;
            currentPdfs[existingPdfIndex] = newPdf;

            dispatch({
                type: 'SET_STATE',
                payload: {
                    pdfs: currentPdfs,
                    // If the replaced PDF was the active one, keep the new one active.
                    activePdfId: stateRef.current.activePdfId === oldPdfId
                        ? newPdf.id
                        : stateRef.current.activePdfId
                }
            });
        } else {
            // Otherwise, add the new PDF and make it active
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
        if (newActivePdfId === pdfId) {
            newActivePdfId = newPdfs.length > 0 ? newPdfs[0].id : null;
        }
        dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs, activePdfId: newActivePdfId } });
        addNotification('A PDF was removed from the session', 'info');
    };

    socketService.on('game-state-delta', handleGameStateDelta);
    socketService.on('page-navigated', handlePageNavigated);
    socketService.on('layers-updated', handleLayersUpdated);
    socketService.on('pdf-added', handlePdfAdded);
    socketService.on('pdf-removed', handlePdfRemoved);

    return () => {
        socketService.off('game-state-delta', handleGameStateDelta);
        socketService.off('page-navigated', handlePageNavigated);
        socketService.off('layers-updated', handleLayersUpdated);
        socketService.off('pdf-added', handlePdfAdded);
        socketService.off('pdf-removed', handlePdfRemoved);
    };
  }, [gameStateVersion]);

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
      socketService.updateGameState({ counters: counters }, 'characters'); // Using 'characters' urgency for counters as well
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

    // Prevent non-host from uploading PDFs in multiplayer
    if (multiplayerSession && !isHost) {
      addNotification("Only the session host can open PDFs", "error");
      event.target.value = ''; // Reset file input
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
            id: Date.now() + file.name,
            fileName: file.name,
            file,
            pdfDoc,
            totalPages: pdfDoc.numPages,
            currentPage: 1,
            scale: 1,
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
        dispatch({ type: 'SET_STATE', payload: {
          pdfs: newPdfsData,
          activePdfId: sessionToRestore.activePdfId,
          characters: sessionToRestore.characters,
          notes: sessionToRestore.notes,
          counters: sessionToRestore.counters,
          sessionToRestore: null,
        }});
      } else {
        alert('Could not restore session. Please select all the correct PDF files.');
        dispatch({ type: 'SET_STATE', payload: { sessionToRestore: null } });
      }
    } else {
      if (newPdfsData.length > 0) { //change to 1 to hide tabs with a single pdf
        // First, update the local state with the new PDFs.
        dispatch({ type: 'SET_STATE', payload: {
          pdfs: [...pdfs, ...newPdfsData],
          activePdfId: newPdfsData[0].id,
        }});
        
        // Then, if in a multiplayer session, upload the new PDFs.
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
    if (activePdfId === pdfId) {
        newActivePdfId = newPdfs.length > 0 ? newPdfs[0].id : null;
    }
    dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs, activePdfId: newActivePdfId } });
  };
  
  const updateActivePdf = (updates) => {
    const newPdfs = pdfs.map(p => p.id === activePdfId ? { ...p, ...updates } : p);
    dispatch({ type: 'SET_STATE', payload: { pdfs: newPdfs }});
  };

  const goToPage = (pageNum) => {
    if (activePdf && pageNum >= 1 && pageNum <= activePdf.totalPages) {
      updateActivePdf({ currentPage: pageNum });
      if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(activePdf.id, pageNum, activePdf.scale);
      }
    }
  };

  const zoomIn = () => {
    if (activePdf) {
      const newScale = Math.min(activePdf.scale + 0.25, 3);
      updateActivePdf({ scale: newScale });
       if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(activePdf.id, activePdf.currentPage, newScale);
      }
    }
  };
  
  const zoomOut = () => {
    if (activePdf) {
      const newScale = Math.max(activePdf.scale - 0.25, 0.5);
      updateActivePdf({ scale: newScale });
      if (socketService.isMultiplayerActive()) {
        socketService.navigatePage(activePdf.id, activePdf.currentPage, newScale);
      }
    }
  };

  const handleBookmarkNavigate = async (dest) => {
    if (!activePdf) return;
    const pageIndex = await activePdf.pdfDoc.getPageIndex(dest[0]);
    goToPage(pageIndex + 1); 
  };
  
  const truncateFileName = (name) => {
    if (name.length > 27) {
      return name.substring(0, 25) + '...';
    }
    return name;
  };

  return (
    <AppContext.Provider value={{ state, dispatch, fabricCanvas, handleBookmarkNavigate, activePdf, goToPage, zoomIn, zoomOut }}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <MultiplayerNotifications notifications={notifications} />
        
        <MultiplayerModal
          isOpen={showMultiplayerModal}
          onClose={() => setShowMultiplayerModal(false)}
          onSessionCreated={handleCreateMultiplayerSession}
          onSessionJoined={handleJoinMultiplayerSession}
        />
        <FloatingDice />
        
        {isSidebarVisible && (
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
        )}

        <div className="flex-1 flex flex-col relative">
          <Toolbar />

          <div className="absolute top-2 right-3 z-30">
            <button
              onClick={() => dispatch({ type: 'SET_STATE', payload: { menuOpen: !menuOpen } })}
              className="p-2 rounded hover:bg-gray-100 bg-white/80 backdrop-blur-sm"
            >
              <Menu size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20">
                 {!multiplayerSession ? (
                  <button
                    onClick={() => {
                      setShowMultiplayerModal(true);
                      dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                    }}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Wifi size={14} /> Multiplayer
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleLeaveMultiplayerSession();
                      dispatch({ type: 'SET_STATE', payload: { menuOpen: false } });
                    }}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Wifi size={14} /> Disconnect
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
                ></button>
                <button
                  onClick={() => { handleNewSession(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FilePlus size={14} /> New Session
                </button>
                <button
                  onClick={() => { fileInputRef.current?.click(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Upload size={14} /> Load PDFs
                </button>
                <button
                  onClick={() => { sessionFileInputRef.current?.click(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Upload size={14} /> Load Session
                </button>
                <button
                  onClick={() => { handleSaveSession(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Save size={14} /> Save Session
                </button>
                <button
                  onClick={() => { fabricCanvas.current?.clear(); dispatch({ type: 'SET_STATE', payload: { menuOpen: false } }); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <RotateCcw size={14} /> Clear Page Annotations
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" multiple />
            <input ref={sessionFileInputRef} type="file" accept=".json" onChange={handleLoadSession} className="hidden" />
          </div>
          
          {pdfs.length > 0 && (
            <div className="bg-gray-200 flex items-center">
              {pdfs.map(pdf => (
                <div
                  key={pdf.id}
                  onClick={() => dispatch({ type: 'SET_STATE', payload: { activePdfId: pdf.id } })}
                  className={`flex items-center gap-2 px-4 py-2 cursor-pointer ${
                    pdf.id === activePdfId ? 'bg-white' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  <span className="text-sm">{truncateFileName(pdf.fileName)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closePdf(pdf.id);
                    }}
                    className="p-1 rounded-full hover:bg-red-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <PDFViewer 
            pdfCanvasRef={pdfCanvasRef}
            overlayCanvasRef={overlayCanvasRef}
          />
        </div>
      </div>
    </AppContext.Provider>
  );
};

export default GamebookApp;