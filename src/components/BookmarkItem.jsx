import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

const BookmarkItem = ({ bookmark, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = bookmark.items && bookmark.items.length > 0;

  return (
    <div style={{ marginLeft: '20px' }}>
      <div className="flex items-center">
        {hasChildren && (
          <button onClick={() => setIsOpen(!isOpen)} className="mr-1">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <button onClick={() => onNavigate(bookmark.dest)} className="flex-1 text-left hover:underline">
          {bookmark.title}
        </button>
      </div>
      {hasChildren && isOpen && (
        <div>
          {bookmark.items.map(child => (
            <BookmarkItem key={child.title} bookmark={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};

// This is the critical line that solves the error
export default BookmarkItem;