// src/components/MainMenu.jsx
import React from 'react';
import {
  Upload,
  RotateCcw,
  Save,
  Menu,
  FilePlus,
  Wifi,
  Moon,
  Sun,
  Columns,
  Settings
} from 'lucide-react';

const MainMenu = ({
  menuOpen,
  toggleMenu,
  multiplayerSession,
  isDualPaneMode,
  theme,
  pdfs,
  handleNewSession,
  handleSaveSession,
  handleExportGBS,
  handleLoadFiles,
  handleToggleTheme,
  handleToggleDualPane,
  handleClearAnnotations,
  handleShowDebugModal,
  handleShowMultiplayerModal,
  handleLeaveMultiplayerSession,
}) => {
  return (
    <div className="absolute top-2 right-3 z-30">
      <button
        onClick={toggleMenu}
        className="p-2 rounded hover:bg-gray-100 bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 dark:hover:bg-gray-700"
      >
        <Menu size={16} />
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 dark:bg-gray-800 dark:border dark:border-gray-700">
          {!multiplayerSession ? (
            <button
              onClick={handleShowMultiplayerModal}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Wifi size={14} /> Multiplayer
            </button>
          ) : (
            <button
              onClick={handleLeaveMultiplayerSession}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50"
            >
              <Wifi size={14} /> Disconnect
            </button>
          )}
          {pdfs.length > 1 && (
            <button
              onClick={handleToggleDualPane}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Columns size={14} />
              {isDualPaneMode ? 'Single Pane' : 'Dual Pane'}
            </button>
          )}
          <button
            onClick={handleToggleTheme}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            Toggle Theme
          </button>
          <button
            onClick={handleNewSession}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <FilePlus size={14} /> New Session
          </button>
          <button
            onClick={handleLoadFiles}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Upload size={14} /> Load Files
          </button>
          <button
            onClick={handleSaveSession}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Save size={14} /> Save Session
          </button>
          <button
            onClick={handleExportGBS}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Save size={14} /> Export as .gbs
          </button>
          <button
            onClick={handleClearAnnotations}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RotateCcw size={14} /> Clear Page Annotations
          </button>
          <button
            onClick={handleShowDebugModal}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Settings size={14} /> Debug State
          </button>
        </div>
      )}
    </div>
  );
};

export default MainMenu;