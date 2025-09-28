import React from 'react';
import { X } from 'lucide-react';

const TabBar = ({
  pdfs,
  activePdfId,
  secondaryPdfId,
  paneId,
  isDualPaneMode,
  onTabSelect,
  onTabClose
}) => {
  const truncateFileName = (name) => {
    if (name.length > 20) {
      return name.substring(0, 18) + '...';
    }
    return name;
  };

  const getTabStyle = (pdfId) => {
    if (!isDualPaneMode) {
      return pdfId === activePdfId 
        ? 'bg-white dark:bg-gray-700' 
        : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700';
    }

    // Dual pane mode
    if (paneId === 'primary') {
      return pdfId === activePdfId
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
        : 'hover:bg-gray-100 dark:hover:bg-gray-700';
    } else {
      return pdfId === secondaryPdfId
        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
        : 'hover:bg-gray-100 dark:hover:bg-gray-700';
    }
  };

  const getTabSize = () => {
    return isDualPaneMode ? 'px-3 py-2 text-sm' : 'px-4 py-2';
  };

  const getCloseButtonSize = () => {
    return isDualPaneMode ? 10 : 12;
  };

  return (
    <div className="bg-gray-200 flex items-center dark:bg-gray-800">
      {pdfs.map(pdf => (
        <div
          key={`${paneId}-${pdf.id}`}
          onClick={() => onTabSelect(pdf.id)}
          className={`flex items-center gap-2 cursor-pointer ${getTabSize()} ${getTabStyle(pdf.id)}`}
        >
          <span className={isDualPaneMode ? 'text-sm' : ''}>{truncateFileName(pdf.fileName)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(pdf.id);
            }}
            className="p-1 rounded-full hover:bg-red-500 hover:text-white"
            title={`Close ${pdf.fileName}`}
          >
            <X size={getCloseButtonSize()} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default TabBar;