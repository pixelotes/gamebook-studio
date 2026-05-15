import React, { useState, useContext, useMemo } from 'react';
import { CorePack } from '../data/CorePack';
import { AppContext } from '../state/appState';
import { X, Upload, Search, Package } from 'lucide-react';
import { loadGBTKPack } from '../services/GBTKLoader';

const TokenBrowser = ({ onClose }) => {
    const { state, dispatch, addNotification } = useContext(AppContext);
    const { tokenPacks, embeddedTokens, selectedTokenShape } = state;
    const [activeTab, setActiveTab] = useState('library'); // 'library' or 'project'
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Combine Internal Core Pack + Loaded External Packs
    const libraryPacks = useMemo(() => {
        return [CorePack, ...tokenPacks];
    }, [tokenPacks]);

    const handleImportPack = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const pack = await loadGBTKPack(file);
            dispatch({ type: 'REGISTER_PACK', payload: pack });
            // Switch to the new pack? Just keep in library view for now
        } catch (error) {
            addNotification("Failed to load pack: " + error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectToken = (token) => {
        // If it's a library token, selecting it implies we might want to use it.
        // For now, we just set the ID as the selected shape.
        // The GameCanvas will handle "Embedding" it on first use, 
        // OR we can embed it right now to be safe.
        // Let's just set the ID. The canvas needs to know where to find it.
        // Actually, if we set 'selectedTokenShape' to 'packname_tokenid',
        // GameCanvas needs a lookup.

        // Strategy: 
        // When clicking a token in Library, we essentially 'pick' it.
        // We update 'selectedTokenShape' in global state to this Token ID.
        // We also need to ensure the details of this token can be found by GameCanvas.
        // GameCanvas will look in 'embeddedTokens' OR 'tokenPacks'.

        dispatch({
            type: 'SET_STATE',
            payload: { selectedTokenShape: token.id }
        });

        // Also ensure tool is set to token
        dispatch({
            type: 'SET_STATE',
            payload: { selectedTool: 'token', activeDropdown: null }
        });

        onClose();
    };

    // Filter tokens based on search
    const getFilteredTokens = (pack) => {
        if (!searchTerm) return pack.tokens;
        return pack.tokens.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Package /> Token Library
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>
                </div>

                {/* Controls */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-4 items-center">
                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'library'
                                    ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                        >
                            Library
                        </button>
                        <button
                            onClick={() => setActiveTab('project')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'project'
                                    ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                        >
                            Project Assets
                        </button>
                    </div>

                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search tokens..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-gray-100"
                        />
                    </div>

                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                        <Upload size={18} />
                        <span>Import .gbtk</span>
                        <input
                            type="file"
                            accept=".gbtk,.zip"
                            className="hidden"
                            onChange={handleImportPack}
                            disabled={isLoading}
                        />
                    </label>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900/50">
                    {activeTab === 'library' ? (
                        <div className="space-y-8">
                            {libraryPacks.map(pack => {
                                const visibleTokens = getFilteredTokens(pack);
                                if (visibleTokens.length === 0) return null;

                                return (
                                    <div key={pack.name} className="space-y-3">
                                        <div className="flex items-center gap-2 text-gray-400 uppercase text-xs font-bold tracking-wider">
                                            {pack.isInternal ? "Internal" : "Imported"}
                                            <span className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                                            <span className="text-gray-900 dark:text-gray-100">{pack.name}</span>
                                        </div>
                                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                                            {visibleTokens.map(token => (
                                                <button
                                                    key={token.id}
                                                    onClick={() => handleSelectToken(token)}
                                                    className={`
                                                        aspect-square p-2 bg-white dark:bg-gray-800 rounded-lg border 
                                                        hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-center justify-center gap-1
                                                        ${selectedTokenShape === token.id
                                                            ? 'border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900'
                                                            : 'border-gray-200 dark:border-gray-700'
                                                        }
                                                    `}
                                                    title={token.name}
                                                >
                                                    <div
                                                        className="w-full h-full text-gray-800 dark:text-gray-200"
                                                        dangerouslySetInnerHTML={{ __html: token.svgContent }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                            {/* Project Assets View */}
                            {embeddedTokens.length === 0 ? (
                                <div className="col-span-full text-center text-gray-400 py-12">
                                    No custom tokens embedded in this project yet.
                                    <br />Select tokens from the Library to use them.
                                </div>
                            ) : (
                                embeddedTokens
                                    .filter(t => !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(token => (
                                        <button
                                            key={token.id}
                                            onClick={() => handleSelectToken(token)}
                                            className={`
                                            aspect-square p-2 bg-white dark:bg-gray-800 rounded-lg border 
                                            hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-center justify-center gap-1
                                            ${selectedTokenShape === token.id
                                                    ? 'border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900'
                                                    : 'border-gray-200 dark:border-gray-700'
                                                }
                                        `}
                                            title={token.name}
                                        >
                                            <div
                                                className="w-full h-full text-gray-800 dark:text-gray-200"
                                                dangerouslySetInnerHTML={{ __html: token.svgContent }}
                                            />
                                        </button>
                                    ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TokenBrowser;
