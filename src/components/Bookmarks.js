import React, { useContext } from 'react';
import { AppContext } from '../state/appState';
import BookmarkItem from './BookmarkItem';

const Bookmarks = () => {
  const { activePdf, handleBookmarkNavigate } = useContext(AppContext);

  return (
    <div key={activePdf?.id}>
      <h3 className="font-semibold mb-3">Contents</h3>
      {/* --- FIX: Use optional chaining to prevent crash if bookmarks is undefined --- */}
      {activePdf?.bookmarks?.length > 0 ? (
        activePdf.bookmarks.map(bookmark => (
          <BookmarkItem key={bookmark.title} bookmark={bookmark} onNavigate={handleBookmarkNavigate} />
        ))
      ) : (
        <p className="text-gray-500">No bookmarks found in this PDF.</p>
      )}
    </div>
  );
};

export default Bookmarks;