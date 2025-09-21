import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, Dice1, Plus, Minus, RotateCcw, Save, Users, StickyNote, Settings, Move, Square, Circle, Type, Pen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Layers, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Eraser, X, Menu, FilePlus, PanelLeft, Stamp, Bookmark, Tally5 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import DiceParser from './utils/DiceParser';
import BookmarkItem from './components/BookmarkItem';
import FloatingDice from './components/FloatingDice';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Token Palette Data
const TOKEN_SHAPES = {
  circle: { name: 'Circle', icon: '●' },
  square: { name: 'Square', icon: '■' },
  triangle: { name: 'Triangle', icon: '▲' },
  diamond: { name: 'Diamond', icon: '♦' },
  heart: { name: 'Heart', icon: '♥' },
  star: { name: 'Star', icon: '★' },
  check: { name: 'Check', icon: '✔' },
  cross: { name: 'Cross', icon: '✘' },
  skull: { name: 'Skull', icon: '☠' },
  shield: { name: 'Shield', icon: '⛨' },
  arrow: { name: 'Arrow', icon: '→' },
  coin: { name: 'Coin', icon: '◎' },
  meeple: { name: 'Meeple', icon: '👤' },
  house: { name: 'House', icon: '⌂' },
  dice1: { name: 'Dice 1', icon: '⚀' },
  dice2: { name: 'Dice 2', icon: '⚁' },
  dice3: { name: 'Dice 3', icon: '⚂' },
  dice4: { name: 'Dice 4', icon: '⚃' },
  dice5: { name: 'Dice 5', icon: '⚄' },
  dice6: { name: 'Dice 6', icon: '⚅' }
};

const TOKEN_COLORS = [
  { name: 'Red', value: '#ff6b6b' },
  { name: 'Blue', value: '#4ecdc4' },
  { name: 'Green', value: '#96ceb4' },
  { name: 'Yellow', value: '#feca57' },
  { name: 'Purple', value: '#ff9ff3' },
  { name: 'Orange', value: '#ff9500' },
  { name: 'Pink', value: '#ff6b9d' },
  { name: 'Teal', value: '#00d2d3' },
  { name: 'Black', value: '#2c2c54' },
  { name: 'White', value: '#ffffff' }
];

// Character Sheet Templates
const CHARACTER_TEMPLATES = {
  custom: {
    name: 'Custom',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' }
    ]
  },
  basic: {
    name: 'Basic RPG',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' },
      { name: 'level', label: 'Level', type: 'number', default: 1 },
      { name: 'health', label: 'Health', type: 'number', default: 10 },
      { name: 'maxHealth', label: 'Max Health', type: 'number', default: 10 },
      { name: 'strength', label: 'Strength', type: 'number', default: 10 },
      { name: 'dexterity', label: 'Dexterity', type: 'number', default: 10 },
      { name: 'intelligence', label: 'Intelligence', type: 'number', default: 10 },
      { name: 'armor', label: 'Armor Class', type: 'number', default: 10 }
    ]
  },
  dnd5e: {
    name: 'D&D 5e',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' },
      { name: 'class', label: 'Class', type: 'text', default: 'Fighter' },
      { name: 'level', label: 'Level', type: 'number', default: 1 },
      { name: 'ac', label: 'Armor Class', type: 'number', default: 10 },
      { name: 'hp', label: 'Hit Points', type: 'number', default: 8 },
      { name: 'maxHp', label: 'Max HP', type: 'number', default: 8 }
    ]
  }
};

// Enhanced Mock Fabric.js Canvas
class MockFabricCanvas {
  constructor(canvasElement) {
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
    this.setupEvents();
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
    if (this.isDrawing && this.tool === 'rectangle') {
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
    for (const layer of this.layers) {
      if (!layer.visible || layer.locked) continue;

      layer.objects = layer.objects.filter(obj => {
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
    }
    this.render();
  }

  removeToken(tokenId) {
    const tokensLayer = this.layers.find(l => l.id === 'tokens');
    if (tokensLayer) {
      tokensLayer.objects = tokensLayer.objects.filter(obj => obj.id !== tokenId);
      this.render();
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
      layer.objects.push(obj);
      this.render();
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
      layer.objects = [];
      this.render();
    }
  }

  clear() {
    this.layers.forEach(layer => {
      layer.objects = [];
    });
    this.render();
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
      // --- Fallback for any new icon-based shapes ---
      const icon = TOKEN_SHAPES[shape]?.icon;
      if (icon) {
        // Draw a circular background for consistent clicking and style
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.2, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.stroke();

        // Render the icon character in the center
        this.ctx.fillStyle = strokeColor; // Use stroke color for high contrast
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

const CollapsibleSection = ({ title, children, isOpen, onToggle }) => (
  <div className="border-b border-gray-200">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left font-semibold"
    >
      {title}
      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    {isOpen && <div className="p-4 pt-0">{children}</div>}
  </div>
);

const GamebookApp = () => {
  const [pdfs, setPdfs] = useState([]);
  const [activePdfId, setActivePdfId] = useState(null);
  const [activeTab, setActiveTab] = useState('sheets');
  const [characters, setCharacters] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [notes, setNotes] = useState('');
  const [counters, setCounters] = useState([]);
  const [diceResult, setDiceResult] = useState(null);
  const [diceExpression, setDiceExpression] = useState('1d20');
  const [selectedTool, setSelectedTool] = useState('select');
  const [showLayers, setShowLayers] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#ff6b6b');
  const [showTokenPalette, setShowTokenPalette] = useState(false);
  const [selectedTokenShape, setSelectedTokenShape] = useState('circle');
  const [selectedTokenColor, setSelectedTokenColor] = useState('#ff6b6b');
  const [tokenSize, setTokenSize] = useState(20);
  const [sessionToRestore, setSessionToRestore] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [layerStateKey, setLayerStateKey] = useState(0);

  const [openSections, setOpenSections] = useState({
    tools: true,
    dice: true,
    session: true,
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const pdfCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const sessionFileInputRef = useRef(null);
  const fabricCanvas = useRef(null);
  
  const activePdf = pdfs.find(p => p.id === activePdfId);

  // Initialize Fabric canvas
  useEffect(() => {
    if (overlayCanvasRef.current && !fabricCanvas.current) {
      fabricCanvas.current = new MockFabricCanvas(overlayCanvasRef.current);
      fabricCanvas.current.setTokenSize(tokenSize);
    }
    if (activePdf && fabricCanvas.current) {
      fabricCanvas.current.loadPageLayers(activePdf.pageLayers);
      fabricCanvas.current.setScale(activePdf.scale);
      fabricCanvas.current.setCurrentPage(activePdf.currentPage);
    }
  }, [activePdf, tokenSize]);

  // Update tool and color when changed
  useEffect(() => {
    if (fabricCanvas.current) {
      fabricCanvas.current.setTool(selectedTool);
      fabricCanvas.current.setColor(selectedColor);
      if (selectedTool === 'token') {
        fabricCanvas.current.setSelectedToken(selectedTokenShape, selectedTokenColor);
        fabricCanvas.current.setTokenSize(tokenSize);
      }
    }
  }, [selectedTool, selectedColor, selectedTokenShape, selectedTokenColor, tokenSize]);

  // Handle PDF file upload
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;
  
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
            newPdfsData.push({ ...matchingPdfInSession, file, pdfDoc });
          } catch (error) {
            console.error('Error loading PDF for session restore:', file.name, error);
          }
        }
      } else {
        try {
          const url = URL.createObjectURL(file);
          const pdfDoc = await pdfjsLib.getDocument(url).promise;
          newPdfsData.push({
            id: Date.now() + file.name,
            fileName: file.name,
            file,
            pdfDoc,
            totalPages: pdfDoc.numPages,
            currentPage: 1,
            scale: 1,
            pageLayers: {},
            bookmarks: await pdfDoc.getOutline() || [],
          });
        } catch (error) {
          console.error('Error loading PDF:', file.name, error);
        }
      }
    }
  
    if (sessionToRestore) {
      if (newPdfsData.length === sessionToRestore.pdfs.length) {
        setPdfs(newPdfsData);
        setActivePdfId(sessionToRestore.activePdfId);
        setCharacters(sessionToRestore.characters);
        setNotes(sessionToRestore.notes);
        setCounters(sessionToRestore.counters);
        setSessionToRestore(null); 
      } else {
        alert('Could not restore session. Please select all the correct PDF files.');
        setSessionToRestore(null);
      }
    } else {
      if (newPdfsData.length > 0) {
        setPdfs(prevPdfs => [...prevPdfs, ...newPdfsData]);
        setActivePdfId(newPdfsData[0].id);
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
      })),
      activePdfId,
      characters,
      notes,
      counters,
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
          setSessionToRestore(sessionData);
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
    setPdfs([]);
    setActivePdfId(null);
    setCharacters([]);
    setNotes('');
    setCounters([]);
  };

  const closePdf = (pdfId) => {
    const newPdfs = pdfs.filter(p => p.id !== pdfId);
    setPdfs(newPdfs);
  
    if (activePdfId === pdfId) {
      if (newPdfs.length > 0) {
        setActivePdfId(newPdfs[0].id);
      } else {
        setActivePdfId(null);
      }
    }
  };

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
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
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
    renderPdfPage();
  }, [renderPdfPage]);
  
  const updateActivePdf = (updates) => {
    setPdfs(pdfs.map(p => p.id === activePdfId ? { ...p, ...updates } : p));
  };

  // Navigation functions
  const goToPage = (pageNum) => {
    if (activePdf && pageNum >= 1 && pageNum <= activePdf.totalPages) {
      updateActivePdf({ currentPage: pageNum });
    }
  };

  const zoomIn = () => {
    if (activePdf) {
      updateActivePdf({ scale: Math.min(activePdf.scale + 0.25, 3) });
    }
  };
  
  const zoomOut = () => {
    if (activePdf) {
      updateActivePdf({ scale: Math.max(activePdf.scale - 0.25, 0.5) });
    }
  };

  // Dice rolling
  const rollDiceExpression = () => {
    const result = DiceParser.roll(diceExpression);
    setDiceResult(result);
  };

  // Bookmark handling
  const handleBookmarkNavigate = async (dest) => {
    // 1. Find the currently active PDF using activePdfId
    const activePdf = pdfs.find(p => p.id === activePdfId);

    // 2. If there's no active PDF, do nothing
    if (!activePdf) return;
    
    // 3. Resolve the bookmark's destination to a page index (0-based)
    const pageIndex = await activePdf.pdfDoc.getPageIndex(dest[0]);
    
    // 4. Navigate to the correct page (your function is 1-based)
    goToPage(pageIndex + 1); 
  };

  // Character management
  const addCharacter = () => {
    const template = CHARACTER_TEMPLATES[selectedTemplate];
    const newChar = {
      id: Date.now(),
      template: selectedTemplate,
      data: {
        customFields: []
      }
    };

    template.fields.forEach(field => {
      newChar.data[field.name] = field.default;
    });

    setCharacters([...characters, newChar]);
  };

  const updateCharacter = (id, field, value) => {
    setCharacters(characters.map(char => 
      char.id === id ? { 
        ...char, 
        data: { ...char.data, [field]: value }
      } : char
    ));
  };
  
  const updateCustomField = (charId, fieldId, fieldProp, value) => {
    setCharacters(characters.map(char => {
      if (char.id === charId) {
        const updatedFields = char.data.customFields.map(field => 
          field.id === fieldId ? { ...field, [fieldProp]: value } : field
        );
        return { ...char, data: { ...char.data, customFields: updatedFields } };
      }
      return char;
    }));
  };

  const addCustomField = (charId) => {
    setCharacters(characters.map(char => {
      if (char.id === charId) {
        const newField = { id: Date.now(), name: 'New Stat', value: 0 };
        const customFields = char.data.customFields || [];
        return { ...char, data: { ...char.data, customFields: [...customFields, newField] } };
      }
      return char;
    }));
  };
  
  const removeCustomField = (charId, fieldId) => {
    setCharacters(characters.map(char => {
      if (char.id === charId) {
        const updatedFields = char.data.customFields.filter(field => field.id !== fieldId);
        return { ...char, data: { ...char.data, customFields: updatedFields } };
      }
      return char;
    }));
  };

  const removeCharacter = (id) => {
    setCharacters(characters.filter(char => char.id !== id));
  };

  // Counter management
  const addCounter = () => {
    setCounters([...counters, { 
      id: Date.now(), 
      name: `Counter ${counters.length + 1}`, 
      value: 0,
      color: '#3b82f6'
    }]);
  };

  const updateCounter = (id, field, value) => {
    setCounters(counters.map(counter => 
      counter.id === id ? { ...counter, [field]: value } : counter
    ));
  };

  const removeCounter = (id) => {
    setCounters(counters.filter(counter => counter.id !== id));
  };

  const handleToggleVisibility = (layerId) => {
    fabricCanvas.current?.toggleLayerVisibility(layerId);
    setLayerStateKey(prev => prev + 1); // Force UI update
  };

  const handleSetActiveLayer = (layerId) => {
    fabricCanvas.current?.setActiveLayer(layerId);
    setLayerStateKey(prev => prev + 1); // Force UI update
    setActiveDropdown(null); // Close dropdown on selection
  };

  const handleClearLayer = (layerId) => {
    // Add a confirmation dialog for a better user experience
    if (window.confirm('Are you sure you want to clear all items from this layer? This action cannot be undone.')) {
      fabricCanvas.current?.clearLayer(layerId);
      setLayerStateKey(prev => prev + 1); // Force UI update
    }
  };

  // Layer management
  const toggleLayerVisibility = (layerId) => {
    if (fabricCanvas.current) {
      fabricCanvas.current.toggleLayerVisibility(layerId);
    }
  };

  const clearLayer = (layerId) => {
    if (fabricCanvas.current) {
      fabricCanvas.current.clearLayer(layerId);
    }
  };

  const setActiveLayer = (layerId) => {
    if (fabricCanvas.current) {
      fabricCanvas.current.setActiveLayer(layerId);
    }
  };
  
  const truncateFileName = (name) => {
    if (name.length > 27) {
      return name.substring(0, 25) + '...';
    }
    return name;
  };

  const tools = [
    { id: 'select', icon: Move, label: 'Select' },
    { id: 'token', icon: Stamp, label: 'Token' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'draw', icon: Pen, label: 'Draw' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#333333'];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* The floating dice wisget */}
      <FloatingDice />
      {/* Sidebar */}
      {isSidebarVisible && (
        <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-800">Gamebook Studio</h1>
            <p className="text-sm text-gray-600">Digital tabletop companion</p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {/* Tools & Token Palette - HIDDEN
            <CollapsibleSection title="Drawing Tools" isOpen={openSections.tools} onToggle={() => toggleSection('tools')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowTokenPalette(!showTokenPalette)}
                    className={`p-1 rounded ${showTokenPalette ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                    title="Toggle token palette"
                  >
                    <Circle size={16} />
                  </button>
                  <button
                    onClick={() => setShowLayers(!showLayers)}
                    className={`p-1 rounded ${showLayers ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                    title="Toggle layers panel"
                  >
                    <Layers size={16} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-2 mb-3">
                {tools.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    className={`p-2 rounded-lg border transition-colors ${
                      selectedTool === tool.id 
                        ? 'bg-blue-500 text-white border-blue-500' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    title={tool.label}
                  >
                    <tool.icon size={16} />
                  </button>
                ))}
              </div>

              {showTokenPalette && (
                <div className="mb-3 p-3 border border-green-200 rounded-lg bg-green-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm text-green-800">Game Tokens</h4>
                    <span className="text-xs text-green-600">Click to select, place on PDF</span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">Shapes</p>
                    <div className="grid grid-cols-6 gap-2">
                      {Object.entries(TOKEN_SHAPES).map(([key, shape]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedTokenShape(key);
                            setSelectedTool('token');
                          }}
                          className={`p-2 rounded border text-lg flex items-center justify-center transition-colors ${
                            selectedTokenShape === key && selectedTool === 'token'
                              ? 'bg-green-500 text-white border-green-500'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                          title={shape.name}
                        >
                          {shape.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Colors</p>
                    <div className="grid grid-cols-5 gap-1">
                      {TOKEN_COLORS.map(color => (
                        <button
                          key={color.value}
                          onClick={() => {
                            setSelectedTokenColor(color.value);
                            setSelectedTool('token');
                          }}
                          className={`w-8 h-8 rounded border-2 transition-all ${
                            selectedTokenColor === color.value && selectedTool === 'token'
                              ? 'border-green-600 scale-110'
                              : color.value === '#ffffff' 
                                ? 'border-gray-400'
                                : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        >
                          {color.value === '#ffffff' && <span className="text-gray-400 text-xs">○</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">Size</p>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={tokenSize}
                      onChange={(e) => setTokenSize(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="mt-3 p-2 bg-white rounded border border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Preview:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg" style={{ color: selectedTokenColor }}>
                          {TOKEN_SHAPES[selectedTokenShape]?.icon}
                        </span>
                        <span className="text-xs text-gray-500">
                          {TOKEN_SHAPES[selectedTokenShape]?.name} • {TOKEN_COLORS.find(c => c.value === selectedTokenColor)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!showTokenPalette && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Colors</p>
                  <div className="grid grid-cols-8 gap-1">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded border-2 ${
                          selectedColor === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {showLayers && fabricCanvas.current && (
                <div className="border border-gray-200 rounded-lg p-2">
                  <p className="text-xs font-medium text-gray-600 mb-2">Layers</p>
                  {fabricCanvas.current.layers.map(layer => (
                    <div key={layer.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleLayerVisibility(layer.id)}
                          className={`p-1 rounded ${layer.visible ? 'text-blue-500' : 'text-gray-400'}`}
                        >
                          {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button
                          onClick={() => setActiveLayer(layer.id)}
                          className={`text-xs ${fabricCanvas.current.activeLayer === layer.id ? 'font-bold' : ''}`}
                        >
                          {layer.name} ({layer.objects.length})
                        </button>
                      </div>
                      <button
                        onClick={() => clearLayer(layer.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Clear layer"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                    <p>💡 <strong>Select tool:</strong> Drag tokens around</p>
                    <p>💡 <strong>Double-click:</strong> Remove tokens</p>
                  </div>
                </div>
              )}
            </CollapsibleSection>
            */}
            
            <CollapsibleSection title="Game Session" isOpen={openSections.session} onToggle={() => toggleSection('session')}>
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200">
                {[
                  { id: 'sheets', icon: Users, label: '' },
                  { id: 'counters', icon: Tally5, label: '' },
                  { id: 'notes', icon: StickyNote, label: '' },
                  { id: 'bookmarks', icon: Bookmark, label: '' },             
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 text-sm transition-colors ${
                      activeTab === tab.id 
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'sheets' && (
                  <div>
                    {/* Template Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Character Template
                      </label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                      >
                        {Object.entries(CHARACTER_TEMPLATES).map(([key, template]) => (
                          <option key={key} value={key}>{template.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Add Character Button */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Character Sheets</h3>
                      <button
                        onClick={addCharacter}
                        className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>
                    
                    {/* Character List */}
                    {characters.map(char => {
                      const template = CHARACTER_TEMPLATES[char.template];
                      return (
                        <div key={char.id} className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <input
                              type="text"
                              value={char.data.name || 'Unnamed Character'}
                              onChange={(e) => updateCharacter(char.id, 'name', e.target.value)}
                              className="flex-1 p-2 border border-gray-200 rounded font-semibold mr-2"
                            />
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeCharacter(char.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove character"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-500 mb-2">Template: {template.name}</div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            {template.fields.slice(1).map(field => (
                              <div key={field.name} className="flex items-center justify-between">
                                <span className="text-xs font-medium">{field.label}:</span>
                                <input
                                  type={field.type}
                                  value={char.data[field.name] || field.default}
                                  onChange={(e) => updateCharacter(char.id, field.name, field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                                  className="w-16 p-1 border border-gray-200 rounded text-center text-xs"
                                />
                              </div>
                            ))}
                          </div>
                          {char.template === 'custom' && (
                            <div className="mt-4">
                              {char.data.customFields && char.data.customFields.map(field => (
                                <div key={field.id} className="flex items-center gap-2 mb-2">
                                  <input
                                    type="text"
                                    value={field.name}
                                    onChange={(e) => updateCustomField(char.id, field.id, 'name', e.target.value)}
                                    className="flex-1 p-1 border border-gray-200 rounded text-xs"
                                  />
                                  <button onClick={() => updateCustomField(char.id, field.id, 'value', field.value - 1)} className="w-6 h-6 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center">
                                    <Minus size={12} />
                                  </button>
                                  <input
                                    type="number"
                                    value={field.value}
                                    onChange={(e) => updateCustomField(char.id, field.id, 'value', parseInt(e.target.value) || 0)}
                                    className="w-12 p-1 border border-gray-200 rounded text-center text-xs"
                                  />
                                  <button onClick={() => updateCustomField(char.id, field.id, 'value', field.value + 1)} className="w-6 h-6 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center">
                                    <Plus size={12} />
                                  </button>
                                  <button onClick={() => removeCustomField(char.id, field.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                              <button onClick={() => addCustomField(char.id)} className="mt-2 flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                                <Plus size={14} />
                                Add Stat
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {characters.length === 0 && (
                      <p className="text-gray-500 text-center py-8">No characters created yet.</p>
                    )}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div>
                    <h3 className="font-semibold mb-3">Game Notes</h3>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add your game notes here...&#10;• Track story progress&#10;• Note important clues&#10;• Record decisions made"
                      className="w-full h-64 p-3 border border-gray-200 rounded-lg resize-none text-sm"
                    />
                  </div>
                )}

                {activeTab === 'counters' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Counters</h3>
                      <button
                        onClick={addCounter}
                        className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>

                    {counters.map(counter => (
                      <div key={counter.id} className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <input
                            type="text"
                            value={counter.name}
                            onChange={(e) => updateCounter(counter.id, 'name', e.target.value)}
                            className="flex-1 p-1 border border-gray-200 rounded text-sm font-medium mr-2"
                          />
                          <button
                            onClick={() => removeCounter(counter.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => updateCounter(counter.id, 'value', (counter.value || 0) - 1)}
                            className="w-8 h-8 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xl font-bold" style={{ color: counter.color }}>
                            {counter.value}
                          </span>
                          <button
                            onClick={() => updateCounter(counter.id, 'value', (counter.value || 0) + 1)}
                            className="w-8 h-8 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {counters.length === 0 && (
                      <p className="text-gray-500 text-center py-8">No counters created yet.</p>
                    )}
                  </div>
                )}
                {/* Tab Content */}

                {activeTab === 'bookmarks' && (
                  <div key={activePdf?.id}>
                    <h3 className="font-semibold mb-3">Contents</h3>
                    {activePdf?.bookmarks.length > 0 ? (
                      activePdf.bookmarks.map(bookmark => (
                        <BookmarkItem key={bookmark.title} bookmark={bookmark} onNavigate={handleBookmarkNavigate} />
                      ))
                    ) : (
                      <p className="text-gray-500">No bookmarks found in this PDF.</p>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-3 py-1  flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className="p-2 rounded-md hover:bg-gray-100"
              title={isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
            >
              <PanelLeft size={16} />
            </button>
            <div className="h-6 w-px bg-gray-200"></div>

            {/* PDF Navigation */}
            {activePdf && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(activePdf.currentPage - 1)}
                  disabled={activePdf.currentPage <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium">
                  {activePdf.currentPage} / {activePdf.totalPages}
                </span>
                <button
                  onClick={() => goToPage(activePdf.currentPage + 1)}
                  disabled={activePdf.currentPage >= activePdf.totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            {activePdf && (
              <div className="flex items-center gap-2">
                <button
                  onClick={zoomOut}
                  className="p-1 rounded hover:bg-gray-100"
                  title="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-sm font-medium w-12 text-center">
                  {Math.round(activePdf.scale * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1 rounded hover:bg-gray-100"
                  title="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-gray-300"></div>

            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'layers' ? null : 'layers')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
                title="Manage Layers"
                disabled={!activePdf}
              >
                <Layers size={16} />
                <ChevronDown size={14} className="text-gray-500" />
              </button>
              {activeDropdown === 'layers' && fabricCanvas.current && (
                <div className="absolute top-full mt-2 w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2 space-y-1">
                  <div className="px-2 py-1 text-xs font-bold text-gray-500 border-b -mx-2 mb-1 pb-2">
                    Active Layer: <span className="text-blue-600">{fabricCanvas.current.layers.find(l => l.id === fabricCanvas.current.activeLayer)?.name}</span>
                  </div>
                  {fabricCanvas.current.layers.map(layer => (
                    <div key={layer.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleVisibility(layer.id)}
                          className={`p-1 rounded ${layer.visible ? 'text-blue-500' : 'text-gray-400'}`}
                          title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                        >
                          {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          onClick={() => handleSetActiveLayer(layer.id)}
                          className={`text-sm text-left ${fabricCanvas.current.activeLayer === layer.id ? 'font-bold' : 'text-gray-700'}`}
                        >
                          {layer.name} ({layer.objects.length})
                        </button>
                      </div>
                      <button
                        onClick={() => handleClearLayer(layer.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Clear all objects from this layer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            {/* Tool Selector, Color, and Token Controls Container */}
            <div className="flex items-center gap-2"> 
              {/* Tool Selector Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'tools' ? null : 'tools')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
                >
                  <span className="flex-shrink-0">
                    {(() => {
                      const Icon = tools.find(t => t.id === selectedTool)?.icon;
                      return Icon ? <Icon size={16} /> : null;
                    })()}
                  </span>
                  <span className="font-medium capitalize">{selectedTool}</span>
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
                {activeDropdown === 'tools' && (
                  <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                    {tools.map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setSelectedTool(tool.id);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <tool.icon size={16} />
                        {tool.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Conditional Color Picker */}
              {!['select', 'eraser', 'token'].includes(selectedTool) && (
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
                    title="Select color"
                  >
                    <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: selectedColor }} />
                    <ChevronDown size={14} className="text-gray-500" />
                  </button>
                  {activeDropdown === 'color' && (
                    <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                      {TOKEN_COLORS.map(color => (
                        <button
                          key={color.value}
                          onClick={() => {
                            setSelectedColor(color.value);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: color.value }}/>
                          {color.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Conditional Token Controls */}
              {selectedTool === 'token' && (
                <>
                  {/* Token Shape */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === 'tokenShape' ? null : 'tokenShape')}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm w-32 justify-between"
                      title="Select token shape"
                    >
                      <span className="text-lg">{TOKEN_SHAPES[selectedTokenShape].icon}</span>
                      <span className="font-medium capitalize">{TOKEN_SHAPES[selectedTokenShape].name}</span>
                      <ChevronDown size={14} className="text-gray-500" />
                    </button>
                    {activeDropdown === 'tokenShape' && (
                      <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 max-h-[70vh] overflow-y-auto">
                        {Object.entries(TOKEN_SHAPES).map(([key, shape]) => (
                          <button 
                            key={key} 
                            onClick={() => { setSelectedTokenShape(key); setActiveDropdown(null); }} 
                            className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <span className="text-lg w-5 text-center">{shape.icon}</span>
                            {shape.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Token Color */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === 'tokenColor' ? null : 'tokenColor')}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-sm"
                      title="Select token color"
                    >
                      <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: selectedTokenColor }} />
                      <ChevronDown size={14} className="text-gray-500" />
                    </button>
                    {activeDropdown === 'tokenColor' && (
                      <div className="absolute top-full mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                        {TOKEN_COLORS.map(color => (
                          <button 
                            key={color.value} 
                            onClick={() => { setSelectedTokenColor(color.value); setActiveDropdown(null); }}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: color.value }} />
                            {color.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Token Size */}
                  <div className="flex items-center gap-2">
                    <Circle size={14} className="text-gray-500" />
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={tokenSize}
                      onChange={(e) => setTokenSize(parseInt(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="absolute top-2 right-3 z-30">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded hover:bg-gray-100 bg-white/80 backdrop-blur-sm"
          >
            <Menu size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20">
              <button
                onClick={() => {
                  handleNewSession();
                  setMenuOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <FilePlus size={14} /> New Session
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setMenuOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Upload size={14} /> Load PDFs
              </button>
              <button
                onClick={() => {
                  sessionFileInputRef.current?.click();
                  setMenuOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Upload size={14} /> Load Session
              </button>
              <button
                onClick={() => {
                  handleSaveSession();
                  setMenuOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Save size={14} /> Save Session
              </button>
              <button
                onClick={() => {
                  fabricCanvas.current?.clear();
                  setMenuOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <RotateCcw size={14} /> Clear Page Annotations
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            multiple
          />
          <input
            ref={sessionFileInputRef}
            type="file"
            accept=".json"
            onChange={handleLoadSession}
            className="hidden"
          />
        </div>
        
        {/* PDF Tabs */}
        {pdfs.length > 1 && (
          <div className="bg-gray-200 flex items-center">
            {pdfs.map(pdf => (
              <div
                key={pdf.id}
                onClick={() => setActivePdfId(pdf.id)}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer ${
                  pdf.id === activePdfId ? 'bg-white' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <span className="text-sm">{truncateFileName(pdf.file.name)}</span>
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

        {/* PDF Viewer / Canvas Area */}
        <div className="flex-1 bg-gray-50 relative overflow-auto p-4">
          {activePdf ? (
            <div className="relative inline-block mx-auto">
              <canvas
                ref={pdfCanvasRef}
                className="block shadow-lg border border-gray-300 rounded"
                style={{ background: 'white' }}
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 pointer-events-auto rounded"
                style={{ 
                  zIndex: 10,
                  cursor: selectedTool === 'select' ? 'default' : 'crosshair'
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <FileText size={64} className="mx-auto mb-4 text-gray-300" />
                <h2 className="text-xl font-semibold mb-2">No PDF Loaded</h2>
                <p className="mb-2">Upload a PDF file to get started with your gamebook or print-and-play game.</p>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>✓ Draggable game tokens (circles, squares, hearts, etc.)</p>
                  <p>✓ Custom character sheet templates</p>
                  <p>✓ Advanced dice expressions (2d6+3, 1d20, etc.)</p>
                  <p>✓ Layer-based annotations and drawings</p>
                  <p>✓ Real PDF rendering with PDF.js</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GamebookApp;
