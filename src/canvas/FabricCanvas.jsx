// src/canvas/FabricCanvas.js
import { TOKEN_SHAPES } from '../data/Shapes';
import socketService from '../services/SocketService';

class FabricCanvas {
  constructor(canvasElement, onLayerUpdate, paneId = 'primary') {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.pageLayers = {};
    this.isMeasuring = false;
    this.rulerStart = null;
    this.rulerEnd = null;
    this.currentPage = 1;
    this.activeLayer = 'tokens';
    this.isDrawing = false;
    this.isDragging = false;
    this.previewRect = null;
    this.previewToken = null;
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
    this.animationFrameId = null;
    this.lineWidth = 3;
    this.paneId = paneId;
    this.pendingRender = false;
    this.setupEvents();
    this.startAnimationLoop();
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
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
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
  
  addPointer(x, y, color) {
    const pointer = {
      type: 'pointer',
      id: Date.now() + Math.random(),
      createdAt: Date.now(),
      x: x / this.scale,
      y: y / this.scale,
      color: color || this.selectedColor,
    };
    this.addObject('drawings', pointer);
    
    // Start animation loop if not running
    this.startAnimationLoop();
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.tool === 'ruler') {
      this.isMeasuring = true;
      this.rulerStart = { x, y };
      this.rulerEnd = { x, y };
      this.render();
      return;
    }
    if (this.tool === 'pointer') {
      this.addPointer(x, y, this.selectedColor);
      if (socketService.isMultiplayerActive()) {
        socketService.sendPointer({
          pdfId: this.currentPdfId,
          pageNum: this.currentPage,
          x,
          y,
          color: this.selectedColor,
        });
      }
      return;
    }

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
        const tokenData = this.previewToken || {
          type: 'gameToken',
          shape: this.selectedToken.shape,
          x: (e.clientX - rect.left) / this.scale,
          y: (e.clientY - rect.top) / this.scale,
          size: this.tokenSize,
          color: this.selectedToken.color,
          strokeColor: this.selectedToken.color === '#ffffff' ? '#000000' : '#ffffff',
      };
      this.addObject('tokens', { ...tokenData, id: Date.now() });
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

  handleMouseLeave(e) {
    this.previewToken = null;
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.tool === 'token' && this.selectedToken) {
      this.previewToken = {
        type: 'gameToken',
        shape: this.selectedToken.shape,
        x: x / this.scale,
        y: y / this.scale,
        size: this.tokenSize,
        color: this.selectedToken.color,
        strokeColor: this.selectedToken.color === '#ffffff' ? '#000000' : '#ffffff',
      };
      return;
    } else {
      this.previewToken = null;
    }

    if (this.isMeasuring) {
      this.rulerEnd = { x, y };
      this.render();
      return;
    }

    if (this.isDrawing && this.tool === 'rectangle' && this.startPos) {
        const endX = (e.clientX - rect.left) / this.scale;
        const endY = (e.clientY - rect.top) / this.scale;
        
        this.previewRect = {
            x: Math.min(this.startPos.x, endX),
            y: Math.min(this.startPos.y, endY),
            width: Math.abs(this.startPos.x - endX),
            height: Math.abs(this.startPos.y - endY)
        };
        return;
    }

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
        if (this.previewRect && this.previewRect.width > 2 && this.previewRect.height > 2) { 
            this.addObject('drawings', {
                type: 'rectangle',
                ...this.previewRect,
                color: this.selectedColor,
                id: Date.now()
            });
        }
        this.previewRect = null;
    }

    if (this.isMeasuring) {
      this.isMeasuring = false;
      this.rulerStart = null;
      this.rulerEnd = null;
      this.render();
    }

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
            if (obj.type === 'text') {
                const font = obj.font || '16px Arial';
                this.ctx.font = font;
                const textWidth = this.ctx.measureText(obj.content).width;
                const fontSize = parseInt(font.match(/\d+/)[0] || '16');

                const scaledX = obj.x * this.scale;
                const scaledY = obj.y * this.scale;
                const scaledWidth = textWidth * this.scale;
                const scaledHeight = fontSize * this.scale;

                return (
                    x < scaledX ||
                    x > scaledX + scaledWidth ||
                    y > scaledY ||
                    y < scaledY - scaledHeight
                );
            }
            if (obj.type === 'rectangle') {
                const scaledX = obj.x * this.scale;
                const scaledY = obj.y * this.scale;
                const scaledWidth = obj.width * this.scale;
                const scaledHeight = obj.height * this.scale;
                
                return (
                    x < scaledX ||
                    x > scaledX + scaledWidth ||
                    y < scaledY ||
                    y > scaledY + scaledHeight
                );
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

  setLineWidth(width) {
    this.lineWidth = width;
  }

  startPath(x, y) {
    this.addObject('drawings', {
      type: 'path',
      points: [{ x, y }],
      color: this.selectedColor,
      width: this.lineWidth,
      id: Date.now()
    });
  }

  continuePath(x, y) {
    const drawingsLayer = this.layers.find(l => l.id === 'drawings');
    if (drawingsLayer && drawingsLayer.objects.length > 0) {
      const lastObj = drawingsLayer.objects[drawingsLayer.objects.length - 1];
      if (lastObj && lastObj.type === 'path') {
        lastObj.points.push({ x, y });
        
        if (!this.pendingRender) {
          this.pendingRender = true;
          requestAnimationFrame(() => {
            this.render();
            this.pendingRender = false;
          });
        }
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
        if (obj.type === 'gameToken') this.renderGameToken(obj);
        else if (obj.type === 'pointer') this.renderPointer(obj);
        else if (obj.type === 'path') {
          this.ctx.beginPath();
          this.ctx.strokeStyle = obj.color;
          this.ctx.lineWidth = obj.width || 3;
          this.ctx.lineCap = 'round';
          this.ctx.lineJoin = 'round';
          if (obj.points && obj.points.length > 1) {
            this.ctx.moveTo(obj.points[0].x, obj.points[0].y);
            for (let i = 1; i < obj.points.length; i++) this.ctx.lineTo(obj.points[i].x, obj.points[i].y);
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

    if (this.previewRect) {
        this.ctx.save();
        this.ctx.strokeStyle = this.selectedColor;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.previewRect.x, this.previewRect.y, this.previewRect.width, this.previewRect.height);
        this.ctx.restore();
    }
    
    if (this.previewToken) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.6;
        this.renderGameToken(this.previewToken);
        this.ctx.restore();
    }
    
    this.ctx.restore();

    if (this.isMeasuring && this.rulerStart && this.rulerEnd) {
      this.ctx.save();
      const start = this.rulerStart, end = this.rulerEnd;
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.strokeStyle = this.selectedColor;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      const distance = Math.hypot(end.x - start.x, end.y - start.y), text = `${(distance / this.scale).toFixed(0)} px`;
      const textPadding = 5, textX = end.x + 10, textY = end.y;
      this.ctx.font = '12px Arial';
      const textWidth = this.ctx.measureText(text).width;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(textX - textPadding, textY - 12 - textPadding, textWidth + textPadding * 2, 12 + textPadding * 2);
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(text, textX, textY);
      this.ctx.restore();
    }
  }
  
  renderPointer(pointer) {
    const life = (Date.now() - pointer.createdAt) / 1000;
    if (life > 10) return;
    const x = pointer.x, y = pointer.y;
    const pulse = Math.sin(life * Math.PI * 2), scale = 1 + pulse * 0.2, rotation = life * 90, size = 20;
    this.ctx.strokeStyle = pointer.color;
    this.ctx.lineWidth = 3;
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation * Math.PI / 180);
    this.ctx.scale(scale, scale);
    this.ctx.beginPath();
    this.ctx.moveTo(-size, 0);
    this.ctx.lineTo(size, 0);
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(0, size);
    this.ctx.stroke();
  }

  startAnimationLoop() {
    const loop = () => {
      let hasPointers = false;
      this.layers.forEach(layer => {
        const filtered = layer.objects.filter(obj => {
          if (obj.type === 'pointer') {
            const alive = (Date.now() - obj.createdAt) < 10000;
            if (alive) hasPointers = true;
            return alive;
          }
          return true;
        });
        if (filtered.length !== layer.objects.length) layer.objects = filtered;
      });
      this.render();
      if (hasPointers) this.animationFrameId = requestAnimationFrame(loop);
      else this.animationFrameId = null;
    };
    if (!this.animationFrameId) this.animationFrameId = requestAnimationFrame(loop);
  }

  stopAnimationLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  renderGameToken(token) {
    const x = token.x, y = token.y, size = token.size, color = token.color, strokeColor = token.strokeColor, shape = token.shape;
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
    } else if (shape === 'heart') this.renderHeart(x, y, size);
    else if (shape === 'star') this.renderStar(x, y, size);
    else if (shape === 'meeple') this.renderMeeple(x, y, size);
    else {
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
    const w = size * 2, h = w * 1.1, topCurveHeight = h * 0.3, bottomCurveHeight = h * 0.7;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + bottomCurveHeight / 2);
    this.ctx.bezierCurveTo(x, y + (bottomCurveHeight - topCurveHeight) / 2, x - w / 2, y + (bottomCurveHeight - topCurveHeight) / 2, x - w / 2, y - topCurveHeight / 2);
    this.ctx.bezierCurveTo(x - w / 2, y - (topCurveHeight + bottomCurveHeight) / 2, x, y - (topCurveHeight + bottomCurveHeight) / 2, x, y - topCurveHeight / 2);
    this.ctx.bezierCurveTo(x, y - (topCurveHeight + bottomCurveHeight) / 2, x + w / 2, y - (topCurveHeight + bottomCurveHeight) / 2, x + w / 2, y - topCurveHeight / 2);
    this.ctx.bezierCurveTo(x + w / 2, y + (bottomCurveHeight - topCurveHeight) / 2, x, y + (bottomCurveHeight - topCurveHeight) / 2, x, y + bottomCurveHeight / 2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  renderStar(x, y, size) {
    const spikes = 5, outerRadius = size, innerRadius = size * 0.4;
    let rot = Math.PI / 2 * 3, step = Math.PI / spikes;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - outerRadius);
    for (let i = 0; i < spikes; i++) {
      const xOuter = x + Math.cos(rot) * outerRadius, yOuter = y + Math.sin(rot) * outerRadius;
      this.ctx.lineTo(xOuter, yOuter);
      rot += step;
      const xInner = x + Math.cos(rot) * innerRadius, yInner = y + Math.sin(rot) * innerRadius;
      this.ctx.lineTo(xInner, yInner);
      rot += step;
    }
    this.ctx.lineTo(x, y - outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
  
  renderMeeple(x, y, size) {
    const scale = size / 25;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-25, -25);
    this.ctx.beginPath();
    this.ctx.arc(25, 10, 6, 0, Math.PI * 2);
    this.ctx.moveTo(19, 16);
    this.ctx.lineTo(10, 25);
    this.ctx.lineTo(15, 32);
    this.ctx.lineTo(15, 45);
    this.ctx.lineTo(22, 45);
    this.ctx.lineTo(22, 38);
    this.ctx.lineTo(28, 38);
    this.ctx.lineTo(28, 45);
    this.ctx.lineTo(35, 45);
    this.ctx.lineTo(35, 32);
    this.ctx.lineTo(40, 25);
    this.ctx.lineTo(31, 16);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }
}

export default FabricCanvas;