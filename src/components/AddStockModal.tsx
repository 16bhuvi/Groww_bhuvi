import { Check, Plus, Search, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MeaningfulChangeResult, Stock } from '../types.js';

interface AddStockModalProps {
  watchlistId: string;
  existingStocks: MeaningfulChangeResult[];
  onClose: () => void;
  onStockAdded: () => void;
}

export const AddStockModal: React.FC<AddStockModalProps> = ({
  watchlistId,
  existingStocks,
  onClose,
  onStockAdded,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const existingStockIds = new Set(existingStocks.map(s => s.stock_id));

  useEffect(() => {
    fetchSearchResults('');
  }, []);

  const fetchSearchResults = async (q: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    fetchSearchResults(val);
  };

  const handleAddStock = async (stock: Stock) => {
    setAddingId(stock.id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/watchlist/${watchlistId}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stock.id }),
      });

      if (res.ok) {
        onStockAdded();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to add stock');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black tracking-tight text-[#1A1A1A]">Add Stock to Watchlist</h3>
            <p className="text-xs text-gray-400">Search from 35+ major Indian stocks across sectors</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search stocks (e.g. Reliance, Zomato)..."
              value={query}
              onChange={handleSearchInput}
              className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-full focus:outline-hidden focus:border-[#00D09C] shadow-xs"
            />
          </div>
          {errorMsg && (
            <p className="text-xs font-bold text-red-600 mt-2 bg-red-50 p-2.5 rounded-xl border border-red-200">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-2 grow">
          {isSearching ? (
            <div className="py-8 text-center text-xs text-gray-400 font-bold uppercase tracking-wider">Searching stocks...</div>
          ) : results.length > 0 ? (
            results.map(stk => {
              const isAlreadyIn = existingStockIds.has(stk.id);
              const isAdding = addingId === stk.id;

              return (
                <div
                  key={stk.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs">
                      {stk.symbol.substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-[#1A1A1A]">{stk.symbol}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {stk.sector}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate max-w-[200px]">{stk.name}</p>
                    </div>
                  </div>

                  {isAlreadyIn ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      <Check className="w-3.5 h-3.5 text-gray-400" />
                      In List
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddStock(stk)}
                      disabled={isAdding}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#00D09C] hover:bg-[#00b889] text-black rounded-full transition-colors disabled:opacity-50 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAdding ? 'Adding...' : 'Add'}</span>
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-gray-400">No stocks matching query</div>
          )}
        </div>
      </div>
    </div>
  );
};
