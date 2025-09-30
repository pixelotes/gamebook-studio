import React, { useEffect, useRef, useState } from 'react';

const ResizeHandle = ({
  direction = 'horizontal',
  onResize,
  className = '',
  minSize = 200,
  maxSize = 600,
  initialSize = 320
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [currentSize, setCurrentSize] = useState(initialSize);
  const handleRef = useRef(null);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(initialSize);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const delta = direction === 'horizontal'
        ? e.clientX - startPosRef.current
        : e.clientY - startPosRef.current;

      const newSize = Math.min(maxSize, Math.max(minSize, startSizeRef.current + delta));
      setCurrentSize(newSize);
      onResize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, direction, onResize, minSize, maxSize]);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSizeRef.current = currentSize;
    e.preventDefault();
  };

  return (
    <div
      ref={handleRef}
      className={`${
        direction === 'horizontal'
          ? 'w-1 cursor-col-resize hover:bg-blue-400 transition-colors'
          : 'h-1 cursor-row-resize hover:bg-blue-400 transition-colors'
      } bg-gray-400 dark:bg-gray-700 ${className} ${isResizing ? 'bg-blue-500' : ''}`}
      style={{ zIndex: 50 }}
      onMouseDown={handleMouseDown}
    />
  );
};

export default ResizeHandle;