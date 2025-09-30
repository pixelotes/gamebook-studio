import React, { useState } from 'react';
import { X } from 'lucide-react';

const GameMetadataModal = ({ isOpen, onClose, onSave, initialData = {} }) => {
  const [metadata, setMetadata] = useState({
    name: initialData.name || '',
    year: initialData.year || '',
    author: initialData.author || '',
    description: initialData.description || '',
    players: initialData.players || '',
    length: initialData.length || ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(metadata);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold">Game Information</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Game Name *</label>
            <input
              type="text"
              value={metadata.name}
              onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <input
                type="text"
                value={metadata.year}
                onChange={(e) => setMetadata({ ...metadata, year: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Author</label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={metadata.description}
              onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="A brief description of the game..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Number of Players</label>
              <input
                type="text"
                value={metadata.players}
                onChange={(e) => setMetadata({ ...metadata, players: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="1-4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Game Length</label>
              <input
                type="text"
                value={metadata.length}
                onChange={(e) => setMetadata({ ...metadata, length: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="2-3 hours"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save & Export
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GameMetadataModal;