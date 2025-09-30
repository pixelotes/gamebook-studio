import React, { useState, useEffect, useRef } from 'react';
import { Dice1, Dice6, X } from 'lucide-react';
import DiceParser from '../utils/DiceParser';
import eventLogService from '../services/EventLogService';

// Helper function to chunk an array into smaller arrays of a specific size
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
  arr.slice(i * size, i * size + size)
);

// SVG Icon for "Heads"
const HeadsCoin = () => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#feca57" stroke="#e6a22e" strokeWidth="4"/>
        <path d="M50 25 a15 15 0 0 1 0 30 a15 15 0 0 1 0 -30" fill="#fde0a3"/>
        <circle cx="50" cy="65" r="20" fill="#feca57"/>
        <path d="M30 85 Q 50 70 70 85" fill="none" stroke="#e6a22e" strokeWidth="4" strokeLinecap="round"/>
    </svg>
);

// SVG Icon for "Tails"
const TailsCoin = () => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#d1d5db" stroke="#9ca3af" strokeWidth="4"/>
        <path d="M50 20 L50 80 M25 50 L75 50 M35 35 L65 65 M35 65 L65 35" stroke="#9ca3af" strokeWidth="6" strokeLinecap="round"/>
    </svg>
);

const Die = ({ value, sides }) => {
  const baseClasses = "w-10 h-10 flex items-center justify-center text-white font-bold text-lg";

  if (sides <= 4) {
    // Triangle
    return (
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon points="50,10 95,85 5,85" fill="#8b5cf6" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
          {value}
        </div>
      </div>
    );
  } else if (sides <= 6) {
    // Square
    return (
      <div className={`bg-purple-500 rounded ${baseClasses}`}>
        {value}
      </div>
    );
  } else {
    // Hexagon
    return (
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="#6d28d9" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
          {value}
        </div>
      </div>
    );
  }
};


const FloatingDice = () => {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);
  const [isResultVisible, setIsResultVisible] = useState(false);
  const [rollResult, setRollResult] = useState(null);
  const [rollSymbols, setRollSymbols] = useState(null);
  const [rollType, setRollType] = useState('standard');
  const [diceExpression, setDiceExpression] = useState('4dF+2');
  const [menuStyle, setMenuStyle] = useState({});
  const [resultStyle, setResultStyle] = useState({});
  const [detailedRolls, setDetailedRolls] = useState([]);
  const [modifier, setModifier] = useState(0);

  const nodeRef = useRef(null);
  const dragStartPosRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isSelectorVisible && nodeRef.current) {
      const iconRect = nodeRef.current.getBoundingClientRect();
      const menuWidth = 224; // w-56
      const menuHeight = 150;
      const buffer = 15;
      const newStyle = {};
      if (iconRect.top < menuHeight + buffer) {
        newStyle.top = `${iconRect.height + 12}px`;
      } else {
        newStyle.bottom = `${iconRect.height + 12}px`;
      }
      if (iconRect.left + menuWidth > window.innerWidth) {
        newStyle.right = 0;
      } else {
        newStyle.left = 0;
      }
      setMenuStyle(newStyle);
    }
  }, [isSelectorVisible]);

  useEffect(() => {
    if (isResultVisible && nodeRef.current) {
        const iconRect = nodeRef.current.getBoundingClientRect();
        const resultWidth = 180;
        const resultHeight = 100;
        const buffer = 15;
        const newStyle = {};
        if (iconRect.top < resultHeight + buffer) {
            newStyle.top = `${iconRect.height + 12}px`;
        } else {
            newStyle.bottom = `${iconRect.height + 12}px`;
        }
        if (iconRect.left + resultWidth > window.innerWidth) {
            newStyle.right = 0;
        } else {
            newStyle.left = 0;
        }
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

    const handleMouseUp = (e) => {
        if (isDragging) {
            // Check if it was a drag or a click
            if (dragStartPosRef.current) {
                const dist = Math.hypot(e.clientX - dragStartPosRef.current.x, e.clientY - dragStartPosRef.current.y);
                if (dist < 5) { // If distance is small, it's a click
                    setIsSelectorVisible(prev => !prev);
                }
            }
            setIsDragging(false);
            dragStartPosRef.current = null;
        }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

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

  const handleRoll = (expression) => {
    const result = DiceParser.roll(expression);
    if (result.error) {
      alert(result.error);
      return;
    }

    // Log the dice roll
    eventLogService.logDiceRoll(
      expression,
      result.type === 'coin' ? result.symbolicBreakdown : result.results.map(r => r.value),
      result.finalTotal
    );

    setRollResult(result.finalTotal);
    setRollSymbols(result.symbolicBreakdown);
    setRollType(result.type);
    setDetailedRolls(result.results);
    setModifier(result.modifier);
    setIsSelectorVisible(false);

    setIsResultVisible(true);
    setTimeout(() => {
        setIsResultVisible(false);
        setRollResult(null);
        setRollSymbols(null);
        setDetailedRolls([]);
        setModifier(0);
    }, 5000);
  };

  const quickDice = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '4dF', '1cT'];

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
    >
      {rollResult !== null && rollType !== 'coin' ? (
        <span className="text-2xl font-bold animate-pulse">{rollResult}</span>
      ) : (
        <Dice6 size={32} />
      )}

      {isResultVisible && (
        <div
            className="dice-result-popup absolute bg-white text-gray-800 rounded-lg shadow-2xl p-4 flex flex-col items-center min-w-[180px] cursor-default"
            style={resultStyle}
        >
          <div className="flex flex-wrap justify-center items-center gap-2">
            {rollType === 'standard' && detailedRolls.length > 0 && (
                detailedRolls.map((roll, index) => (
                    <Die key={index} value={roll.value} sides={roll.sides} />
                ))
            )}
            {rollType === 'fate' && rollSymbols && (
              chunk(rollSymbols, 4).map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-2">
                  {row.map((symbol, colIndex) => (
                    <span key={colIndex} className="text-xl font-mono font-bold w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded shadow-sm">
                      {symbol}
                    </span>
                  ))}
                </div>
              ))
            )}
            {rollType === 'coin' && rollSymbols && (
              chunk(rollSymbols, 4).map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-2">
                  {row.map((symbol, colIndex) => (
                    <div key={colIndex} className="w-10 h-10">
                      {symbol === 'Heads' ? <HeadsCoin /> : <TailsCoin />}
                    </div>
                  ))}
                </div>
              ))
            )}
            {modifier !== 0 && (
                <div className="flex items-center">
                    <span className="text-2xl font-bold mx-2">{modifier > 0 ? '+' : ''}</span>
                    <span className="text-3xl font-bold">{modifier}</span>
                </div>
            )}
          </div>
          {rollType === 'coin' && (
            <div className="text-lg font-bold mt-2 border-t pt-2 w-full text-center">
              {rollResult}
            </div>
          )}
        </div>
      )}

      {isSelectorVisible && (
        <div
          className="dice-selector-popup absolute w-56 bg-white text-gray-800 rounded-lg shadow-2xl p-3 cursor-default"
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
          <div className="grid grid-cols-4 gap-2">
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