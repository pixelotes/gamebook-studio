import React, { useState } from 'react';
// Import the new icon and remove ChevronRight
import { PanelLeftOpen } from 'lucide-react';
import Sidebar from './Sidebar';

const SidebarHoverTrigger = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative h-full">
      {/* Hover trigger */}
      <div
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Trigger Icon - Updated Shape and Icon */}
        <div className="w-6 h-10 bg-white/70 backdrop-blur-sm rounded-r-lg border-y border-r border-gray-200/50 shadow-sm dark:bg-gray-800/70 dark:border-gray-700/50 flex items-center justify-center">
          <PanelLeftOpen size={14} className="text-gray-600 dark:text-gray-400" />
        </div>
      </div>

      {/* Expandable Sidebar (no changes needed here) */}
      <div 
        className={`bg-white shadow-lg border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 transition-all duration-300 overflow-hidden ${
          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ 
          position: 'fixed',
          left: 0,
          top: 0,
          width: isExpanded ? '320px' : '0px',
          height: '100vh',
          zIndex: 35
        }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div style={{ width: '320px', height: '100vh' }} className="overflow-y-auto">
          <Sidebar>
            {children}
          </Sidebar>
        </div>
      </div>
    </div>
  );
};

export default SidebarHoverTrigger;