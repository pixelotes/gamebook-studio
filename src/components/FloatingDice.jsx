import React, { useState, useEffect, useRef } from 'react';
import { Dice1, Dice6, X } from 'lucide-react';
import DiceParser from '../utils/DiceParser';

const FloatingDice = () => {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);
  const [rollResult, setRollResult] = useState(null);
  const [diceExpression, setDiceExpression] = useState('1d20');
  const [menuStyle, setMenuStyle] = useState({});

  const nodeRef = useRef(null);
  const menuRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef(null);

  // This effect calculates the menu's optimal position when it's opened.
  useEffect(() => {
    if (isSelectorVisible && nodeRef.current) {
      const iconRect = nodeRef.current.getBoundingClientRect();
      const menuWidth = 192; // Corresponds to Tailwind's 'w-48' class
      const menuHeight = 150; // An estimated height for the menu
      const buffer = 15; // A small buffer from the window edges

      const newStyle = {};

      // --- Vertical Positioning ---
      // If there isn't enough space above the icon, place the menu below it.
      if (iconRect.top < menuHeight + buffer) {
        newStyle.top = `${iconRect.height + 12}px`; // 12px margin
      } else {
        // Otherwise, place it above (the default).
        newStyle.bottom = `${iconRect.height + 12}px`;
      }

      // --- Horizontal Positioning ---
      // If the icon is too close to the right edge, align the menu's right side with the icon's right side.
      if (iconRect.left + menuWidth > window.innerWidth) {
        newStyle.right = 0;
      } else {
        // Otherwise, align their left sides (the default).
        newStyle.left = 0;
      }

      setMenuStyle(newStyle);
    }
  }, [isSelectorVisible]);


  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      setPosition({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setTimeout(() => {
        dragStartPosRef.current = null;
      }, 0);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.dice-selector-popup')) return;
    
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    
    const rect = nodeRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleClick = (e) => {
    if (dragStartPosRef.current) {
      const dist = Math.hypot(e.clientX - dragStartPosRef.current.x, e.clientY - dragStartPosRef.current.y);
      if (dist > 5) return;
    }
    setIsSelectorVisible(prev => !prev);
  };

  const handleRoll = (expression) => {
    const result = DiceParser.roll(expression);
    if (result.error) {
      alert(result.error);
      return;
    }
    
    setRollResult(result.finalTotal);
    setIsSelectorVisible(false);
    
    setTimeout(() => {
      setRollResult(null);
    }, 30000); // Results stay onscreen for 30 seconds
  };

  const quickDice = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20'];

  return (
    <div
      ref={nodeRef}
      className="fixed z-50 flex items-center justify-center bg-purple-600 text-white rounded-full shadow-lg select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '60px',
        height: '60px',
        cursor: isDragging ? 'grabbing' : 'grabbing'
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {rollResult !== null ? (
        <span className="text-2xl font-bold animate-pulse">{rollResult}</span>
      ) : (
        <Dice6 size={32} />
      )}

      {isSelectorVisible && (
        <div 
          ref={menuRef}
          className="dice-selector-popup absolute w-48 bg-white text-gray-800 rounded-lg shadow-2xl p-3 cursor-default"
          style={menuStyle}
          onClick={e => e.stopPropagation()}
        >
          <h4 className="text-sm font-bold mb-2 text-center">Dice Roller</h4>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={diceExpression}
              onChange={(e) => setDiceExpression(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRoll(diceExpression)}
              className="w-full p-1 border border-gray-300 rounded text-sm text-center"
              onClick={e => e.target.select()}
            />
            <button
              onClick={() => handleRoll(diceExpression)}
              className="px-3 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              <Dice1 size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {quickDice.map(dice => (
              <button
                key={dice}
                onClick={() => {
                  setDiceExpression(dice);
                  handleRoll(dice);
                }}
                className="py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs font-medium"
              >
                {dice}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsSelectorVisible(false)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white"
            aria-label="Close dice selector"
          >
            <X size={14}/>
          </button>
        </div>
      )}
    </div>
  );
};

export default FloatingDice;