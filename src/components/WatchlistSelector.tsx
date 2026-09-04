import { Filter, FolderPlus, Plus, Search, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { Watchlist } from '../types.js';

interface WatchlistSelectorProps {
  watchlists: Watchlist[];
  activeWatchlist: Watchlist | null;
  onSelectWatchlist: (wl: Watchlist) => void;
  onCreateWatchlist: (name: string) => Promise<void>;
  onDeleteWatchlist: (id: string) => Promise<void>;
  onOpenAddStock: () => void;
  selectedSector: string;
  onSelectSector: (sector: string) => void;
  sectors: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const WatchlistSelector: React.FC<WatchlistSelectorProps> = ({
  watchlists,
  activeWatchlist,
  onSelectWatchlist,
  onCreateWatchlist,
  onDeleteWatchlist,
  onOpenAddStock,
  selectedSector,
  onSelectSector,
  sectors,
  searchQuery,
  onSearchChange,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newWlName, setNewWlName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWlName.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateWatchlist(newWlName.trim());
      setNewWlName('');
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-4 mb-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Watchlist Tabs in Editorial Pill Style */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {watchlists.map(wl => {
            const isActive = activeWatchlist?.id === wl.id;
            return (
              <div key={wl.id} className="relative group shrink-0">
                <button
                  onClick={() => onSelectWatchlist(wl)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-[#1A1A1A] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {wl.name}
                  {wl.is_default && <span className="ml-1 text-[10px] text-[#00D09C]">★</span>}
                </button>

                {/* Delete button */}
                {!wl.is_default && watchlists.length > 1 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Delete watchlist "${wl.name}"?`)) {
                        onDeleteWatchlist(wl.id);
                      }
                    }}
                    title="Delete watchlist"
                    className="hidden group-hover:inline-flex absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* Create New Watchlist Button */}
          {isCreating ? (
            <form onSubmit={handleCreateSubmit} className="flex items-center gap-1.5 shrink-0">
              <input
                type="text"
                autoFocus
                placeholder="Watchlist name..."
                value={newWlName}
                onChange={e => setNewWlName(e.target.value)}
                className="px-3 py-1 text-xs border border-gray-300 rounded-full focus:outline-hidden focus:border-[#00D09C]"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-[#00D09C] text-black rounded-full hover:bg-[#00b889]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-black hover:bg-gray-100 border border-dashed border-gray-300 transition-colors shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New
            </button>
          )}
        </div>

        {/* Right side: Search & Sector filter & Add Stock */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search with rounded-full editorial look */}
          <div className="relative min-w-[200px] grow sm:grow-0">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search stocks (e.g. Tata)..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-hidden focus:bg-white focus:border-[#00D09C]"
            />
          </div>

          {/* Sector filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-600">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedSector}
              onChange={e => onSelectSector(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Sectors</option>
              {sectors.map(sec => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Add Stock to Watchlist Button */}
          <button
            id="btn-add-stock-modal"
            onClick={onOpenAddStock}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#00D09C] hover:bg-[#00b889] text-black rounded-full shadow-xs transition-transform active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Stock
          </button>
        </div>
      </div>
    </div>
  );
};
