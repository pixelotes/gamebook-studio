import React from 'react';

const Notes = ({ notes, setNotes }) => {
  return (
    <div>
      <h3 className="font-semibold mb-3">Game Notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add your game notes here...&#10;• Track story progress&#10;• Note important clues&#10;• Record decisions made"
        className="w-full h-64 p-3 border border-gray-200 rounded-lg resize-none text-sm"
      />
    </div>
  );
};

export default Notes;