import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, Dice1, Plus, Minus, RotateCcw, Save, Users, StickyNote, Settings, Move, Square, Circle, Type, Pen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Layers, Eye, EyeOff, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Token Palette Data
const TOKEN_SHAPES = {
  circle: { name: 'Circle', icon: '●' },
  square: { name: 'Square', icon: '■' },
  triangle: { name: 'Triangle', icon: '▲' },
  diamond: { name: 'Diamond', icon: '♦' },
  heart: { name: 'Heart', icon: '♥' },
  star: { name: 'Star', icon: '★' }
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
  },
  custom: {
    name: 'Custom',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' }
    ]
  }
};

// Enhanced Mock Fabric.js Canvas
class MockFabricCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.layers = [
      { id: 'tokens', name: 'Game Tokens', objects: [], visible: true, locked: false },
      { id: 'drawings', name: 'Drawings', objects: [], visible: true, locked: false },
      { id: 'text', name: 'Text & Notes', objects: [], visible: true, locked: false }
    ];
    this.activeLayer = 'tokens';
    this.isDrawing = false;
    this.isDragging = false;
    this.dragTarget = null;
    this.dragOffset = { x: 0, y: 0 };
    this.tool = 'select';
    this.selectedColor = '#ff6b6b';
    this.selectedToken = null;
    this.setupEvents();
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
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
        this.dragOffset = { x: x - clickedToken.x, y: y - clickedToken.y };
        return;
      }
    }

    const activeLayerObj = this.layers.find(l => l.id === this.activeLayer);
    if (!activeLayerObj || activeLayerObj.locked) return;

    if (this.tool === 'token' && this.selectedToken) {
      this.addObject('tokens', {
        type: 'gameToken',
        shape: this.selectedToken.shape,
        x: x,
        y: y,
        size: 20,
        color: this.selectedToken.color,
        strokeColor: this.selectedToken.color === '#ffffff' ? '#000000' : '#ffffff',
        id: Date.now()
      });
    } else if (this.tool === 'draw') {
      this.isDrawing = true;
      this.startPath(x, y);
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isDragging && this.dragTarget) {
      this.dragTarget.x = x - this.dragOffset.x;
      this.dragTarget.y = y - this.dragOffset.y;
      this.render();
    } else if (this.isDrawing && this.tool === 'draw') {
      this.continuePath(x, y);
    }
  }

  handleMouseUp() {
    this.isDragging = false;
    this.dragTarget = null;
    this.isDrawing = false;
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
        const distance = Math.sqrt((x - token.x) ** 2 + (y - token.y) ** 2);
        if (distance <= token.size) {
          return token;
        }
      }
    }
    return null;
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
      points: [{ x: x, y: y }],
      color: this.selectedColor,
      id: Date.now()
    });
  }

  continuePath(x, y) {
    const drawingsLayer = this.layers.find(l => l.id === 'drawings');
    if (drawingsLayer && drawingsLayer.objects.length > 0) {
      const lastObj = drawingsLayer.objects[drawingsLayer.objects.length - 1];
      if (lastObj && lastObj.type === 'path') {
        lastObj.points.push({ x: x, y: y });
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
        }
        
        this.ctx.restore();
      });
    });
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

// Advanced Dice Parser
class DiceParser {
  static parse(expression) {
    const cleanExpr = expression.replace(/\s/g, '').toLowerCase();
    const match = cleanExpr.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
    
    if (!match) {
      const num = parseInt(cleanExpr);
      if (!isNaN(num)) {
        return { count: 1, sides: num, modifier: 0, valid: true };
      }
      return { valid: false, error: 'Invalid dice expression' };
    }

    const count = parseInt(match[1] || '1');
    const sides = parseInt(match[2]);
    const modifierStr = match[3] || '+0';
    const modifier = parseInt(modifierStr);

    if (count > 100 || sides > 1000 || count < 1 || sides < 2) {
      return { valid: false, error: 'Invalid dice parameters' };
    }

    return { count: count, sides: sides, modifier: modifier, valid: true };
  }

  static roll(expression) {
    const parsed = this.parse(expression);
    if (!parsed.valid) {
      return { error: parsed.error };
    }

    const results = [];
    for (let i = 0; i < parsed.count; i++) {
      results.push(Math.floor(Math.random() * parsed.sides) + 1);
    }
    
    const diceTotal = results.reduce((sum, roll) => sum + roll, 0);
    const finalTotal = diceTotal + parsed.modifier;

    return {
      results: results,
      diceTotal: diceTotal,
      modifier: parsed.modifier,
      finalTotal: finalTotal,
      expression: `${parsed.count}d${parsed.sides}${parsed.modifier !== 0 ? (parsed.modifier > 0 ? '+' + parsed.modifier : parsed.modifier) : ''}`,
      breakdown: `(${results.join('+')})${parsed.modifier !== 0 ? ' ' + (parsed.modifier > 0 ? '+' : '') + parsed.modifier : ''} = ${finalTotal}`
    };
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
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [activeTab, setActiveTab] = useState('sheets');
  const [characters, setCharacters] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('basic');
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

  const [openSections, setOpenSections] = useState({
    pdf: true,
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
  const fabricCanvas = useRef(null);

  // Initialize Fabric canvas
  useEffect(() => {
    if (overlayCanvasRef.current && !fabricCanvas.current) {
      fabricCanvas.current = new MockFabricCanvas(overlayCanvasRef.current);
    }
  }, []);

  // Update tool and color when changed
  useEffect(() => {
    if (fabricCanvas.current) {
      fabricCanvas.current.setTool(selectedTool);
      fabricCanvas.current.setColor(selectedColor);
      if (selectedTool === 'token') {
        fabricCanvas.current.setSelectedToken(selectedTokenShape, selectedTokenColor);
      }
    }
  }, [selectedTool, selectedColor, selectedTokenShape, selectedTokenColor]);

  // Handle PDF file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF file');
      }
    }
  };

  const renderPdfPage = useCallback(async () => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
  
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
          fabricCanvas.current.render();
        }
      }
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }, [pdfDoc, currentPage, scale]);
  
  useEffect(() => {
    renderPdfPage();
  }, [renderPdfPage]);

  // Navigation functions
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  // Dice rolling
  const rollDiceExpression = () => {
    const result = DiceParser.roll(diceExpression);
    setDiceResult(result);
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

  const tools = [
    { id: 'select', icon: Move, label: 'Select' },
    { id: 'token', icon: Circle, label: 'Token' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'draw', icon: Pen, label: 'Draw' }
  ];

  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#333333'];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Gamebook Studio</h1>
          <p className="text-sm text-gray-600">Digital tabletop companion</p>
        </div>

        {/* File Upload */}
        <CollapsibleSection title="Load PDF" isOpen={openSections.pdf} onToggle={() => toggleSection('pdf')}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Upload size={16} />
            Load PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          {pdfFile && (
            <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
              <FileText size={14} />
              {pdfFile.name}
            </p>
          )}
        </CollapsibleSection>

        {/* Tools & Token Palette */}
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

          {/* Token Palette */}
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

          {/* Color Palette for Drawing Tools */}
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

          {/* Layers Panel */}
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
        
        <CollapsibleSection title="Game Session" isOpen={openSections.session} onToggle={() => toggleSection('session')}>
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            {[
              { id: 'sheets', icon: Users, label: 'Characters' },
              { id: 'notes', icon: StickyNote, label: 'Notes' },
              { id: 'counters', icon: Settings, label: 'Counters' }
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
                  placeholder="Add your game notes here...&#10;&#10;• Track story progress&#10;• Note important clues&#10;• Record decisions made"
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
          </div>
        </CollapsibleSection>

        {/* Enhanced Dice Section */}
        <CollapsibleSection title="Advanced Dice Roller" isOpen={openSections.dice} onToggle={() => toggleSection('dice')}>
          {/* Dice Expression Input */}
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={diceExpression}
                onChange={(e) => setDiceExpression(e.target.value)}
                placeholder="e.g., 2d6+3, 1d20, 4d8-1"
                className="flex-1 p-2 border border-gray-200 rounded text-sm"
              />
              <button
                onClick={rollDiceExpression}
                className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1"
              >
                <Dice1 size={14} />
                Roll
              </button>
            </div>
          </div>

          {/* Quick Dice Buttons */}
          <div className="grid grid-cols-3 gap-1 mb-3">
            {['1d4', '1d6', '1d8', '1d10', '1d12', '1d20'].map(dice => (
              <button
                key={dice}
                onClick={() => {
                  setDiceExpression(dice);
                  const result = DiceParser.roll(dice);
                  setDiceResult(result);
                }}
                className="py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs font-medium"
              >
                {dice}
              </button>
            ))}
          </div>
          
          {/* Dice Result Display */}
          {diceResult && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              {diceResult.error ? (
                <div className="text-center">
                  <div className="text-red-600 font-medium">{diceResult.error}</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{diceResult.finalTotal}</div>
                  <div className="text-xs text-purple-800 font-medium">{diceResult.expression}</div>
                  <div className="text-xs text-purple-600 mt-1">
                    {diceResult.breakdown}
                  </div>
                  {diceResult.results.length > 1 && (
                    <div className="flex justify-center gap-1 mt-2">
                      {diceResult.results.map((roll, index) => (
                        <span 
                          key={index} 
                          className="inline-block w-6 h-6 bg-purple-200 text-purple-800 rounded text-xs leading-6 font-bold"
                        >
                          {roll}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* PDF Navigation */}
            {pdfDoc && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            {pdfDoc && (
              <div className="flex items-center gap-2">
                <button
                  onClick={zoomOut}
                  className="p-1 rounded hover:bg-gray-100"
                  title="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-sm font-medium w-12 text-center">
                  {Math.round(scale * 100)}%
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

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Tool:</span>
              <span className="font-medium capitalize text-sm">{selectedTool}</span>
              {selectedTool === 'token' ? (
                <div className="flex items-center gap-1">
                  <span className="text-lg" style={{ color: selectedTokenColor }}>
                    {TOKEN_SHAPES[selectedTokenShape]?.icon}
                  </span>
                  <span className="text-xs text-gray-500">
                    {TOKEN_SHAPES[selectedTokenShape]?.name}
                  </span>
                </div>
              ) : (
                <div 
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: selectedColor }}
                  title={`Color: ${selectedColor}`}
                />
              )}
            </div>

            {fabricCanvas.current && (
              <div className="text-sm text-gray-600">
                Layer: <span className="font-medium">{fabricCanvas.current.layers.find(l => l.id === fabricCanvas.current.activeLayer)?.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
              <Save size={14} />
              Save Session
            </button>
            <button 
              onClick={() => fabricCanvas.current?.clear()}
              className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
            >
              <RotateCcw size={14} />
              Clear All
            </button>
          </div>
        </div>

        {/* PDF Viewer / Canvas Area */}
        <div className="flex-1 bg-gray-50 relative overflow-auto p-4">
          {pdfDoc ? (
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