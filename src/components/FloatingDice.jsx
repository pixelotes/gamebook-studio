import React, { useState, useEffect, useRef } from 'react';
import { Dice1, Dice6, X } from 'lucide-react';
import DiceParser from '../utils/DiceParser';

// Helper function to chunk an array into smaller arrays of a specific size
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
  arr.slice(i * size, i * size + size)
);

const FloatingDice = () => {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);
  const [isResultVisible, setIsResultVisible] = useState(false);
  const [rollResult, setRollResult] = useState(null);
  const [rollSymbols, setRollSymbols] = useState(null);
  const [diceExpression, setDiceExpression] = useState('4dF');
  const [menuStyle, setMenuStyle] = useState({});
  const [resultStyle, setResultStyle] = useState({});

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
      if (iconRect.top < menuHeight + buffer) {
        newStyle.top = `${iconRect.height + 12}px`;
      } else {
        newStyle.bottom = `${iconRect.height + 12}px`;
      }

      // --- Horizontal Positioning ---
      if (iconRect.left + menuWidth > window.innerWidth) {
        newStyle.right = 0;
      } else {
        newStyle.left = 0;
      }

      setMenuStyle(newStyle);
    }
  }, [isSelectorVisible]);

  // This effect calculates the result popup's optimal position
  useEffect(() => {
    if (isResultVisible && nodeRef.current) {
        const iconRect = nodeRef.current.getBoundingClientRect();
        const resultWidth = 180; // Estimated width
        const resultHeight = 100;  // Estimated height
        const buffer = 15;

        const newStyle = {};

        // Position above if possible, else below
        if (iconRect.top < resultHeight + buffer) {
            newStyle.top = `${iconRect.height + 12}px`;
        } else {
            newStyle.bottom = `${iconRect.height + 12}px`;
        }

        // Center it horizontally relative to the icon
        newStyle.left = `50%`;
        newStyle.transform = 'translateX(-50%)';

        setResultStyle(newStyle);
    }
}, [isResultVisible]);


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
    if (e.target.closest('.dice-selector-popup') || e.target.closest('.dice-result-popup')) return;
    
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
    setRollSymbols(result.symbolicBreakdown);
    setIsSelectorVisible(false);

    // If it's a fate roll, use the popup for a few seconds
    if (result.symbolicBreakdown) {
        setIsResultVisible(true);
        setTimeout(() => {
            setIsResultVisible(false);
            setRollResult(null);
            setRollSymbols(null);
        }, 5000); // 5 seconds for the result popup
    } else {
        // For normal rolls, show result on the button and clear after 30s
        setTimeout(() => {
            setRollResult(null);
        }, 30000);
    }
  };

  const quickDice = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100', '4dF'];

  return (
    <div
      ref={nodeRef}
      className="fixed z-50 flex items-center justify-center bg-purple-600 text-white rounded-full shadow-lg select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '60px',
        height: '60px',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Conditionally display result inside button OR default icon */}
      {rollResult !== null && !isResultVisible ? (
        <span className="text-2xl font-bold animate-pulse">{rollResult}</span>
      ) : (
        <Dice6 size={32} />
      )}

      {/* The popup for Fate results */}
        {isResultVisible && rollSymbols && (
            <div
                className="dice-result-popup absolute bg-white text-gray-800 rounded-lg shadow-2xl p-3 flex flex-col items-center min-w-[160px] cursor-default"
                style={resultStyle}
            >
                {chunk(rollSymbols.trim().split(/\s+/), 4).map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center gap-2 mb-2">
                        {row.map((symbol, colIndex) => (
                            <span key={colIndex} className="text-xl font-mono font-bold w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded shadow-sm">
                                {symbol.replace(/[\[\]]/g, '')}
                            </span>
                        ))}
                    </div>
                ))}
                <div className="text-3xl font-bold mt-2 border-t pt-2 w-full text-center">
                    {rollResult > 0 ? `+${rollResult}` : rollResult}
                </div>
            </div>
        )}

      {/* The selector menu */}
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
          <div className="grid grid-cols-4 gap-1">
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