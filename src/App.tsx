import {
  AlertCircle,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Lightbulb,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AddStockModal } from './components/AddStockModal.js';
import { AttentionHeroBanner } from './components/AttentionHeroBanner.js';
import { Navbar } from './components/Navbar.js';
import { SimulatorLabModal } from './components/SimulatorLabModal.js';
import { StockCard } from './components/StockCard.js';
import { StockDetailModal } from './components/StockDetailModal.js';
import { WatchlistSelector } from './components/WatchlistSelector.js';
import {
  FilterView,
  MarketIndex,
  MarketStatus,
  MeaningfulChangeResult,
  Watchlist,
  WatchlistAnalysisState,
} from './types.js';

export default function App() {
  const [data, setData] = useState<WatchlistAnalysisState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | undefined>(undefined);
  const [filterView, setFilterView] = useState<FilterView>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [selectedStock, setSelectedStock] = useState<MeaningfulChangeResult | null>(null);
  const [isAddStockOpen, setIsAddStockOpen] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [markingStockId, setMarkingStockId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  // Fetch Watchlist data
  const fetchData = useCallback(
    async (showLoadingSpinner = false) => {
      if (showLoadingSpinner) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const queryParams = new URLSearchParams();
        if (activeWatchlistId) queryParams.set('watchlist_id', activeWatchlistId);
        if (selectedSector && selectedSector !== 'ALL') queryParams.set('sector', selectedSector);
        if (searchQuery.trim()) queryParams.set('q', searchQuery.trim());

        const res = await fetch(`/api/watchlist?${queryParams.toString()}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json: WatchlistAnalysisState = await res.json();
        setData(json);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load watchlist:', err);
        setError(err.message || 'Failed to connect to market server');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeWatchlistId, selectedSector, searchQuery]
  );

  useEffect(() => {
    fetchData(true);

    // Background refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Extract unique sectors from stocks
  const availableSectors = useMemo(() => {
    if (!data?.results) return [];
    const sectors = new Set<string>();
    data.results.forEach(s => {
      if (s.sector) sectors.add(s.sector);
    });
    return Array.from(sectors).sort();
  }, [data?.results]);

  // Filter stocks by filterView (ALL, MEANINGFUL_ONLY, HIGH_ATTENTION, SIGNIFICANT)
  const displayedStocks = useMemo(() => {
    if (!data?.results) return [];
    let list = data.results;

    if (filterView === 'MEANINGFUL_ONLY') {
      list = list.filter(s => s.is_meaningful);
    } else if (filterView === 'HIGH_ATTENTION') {
      list = list.filter(s => s.attention_level === 'HIGH_ATTENTION');
    } else if (filterView === 'SIGNIFICANT') {
      list = list.filter(s => s.attention_level === 'SIGNIFICANT');
    }

    return list;
  }, [data?.results, filterView]);

  // Key insight generation for the editorial sidebar
  const keyInsight = useMemo(() => {
    if (!data?.results || data.results.length === 0) return null;
    const topUrgent = data.results.find(s => s.attention_level === 'HIGH_ATTENTION');
    if (topUrgent) {
      return {
        title: `${topUrgent.symbol} High Attention Alert`,
        description: topUrgent.why_it_matters[0] || 'Unusual volatility and technical indicators triggered.',
        stock: topUrgent,
      };
    }
    const significant = data.results.find(s => s.attention_level === 'SIGNIFICANT');
    if (significant) {
      return {
        title: `${significant.symbol} Momentum Driver`,
        description: significant.why_it_matters[0] || 'Technical breakout above baseline.',
        stock: significant,
      };
    }
    return {
      title: 'Watchlist Stability',
      description: 'All tracked stocks are moving within normal historical standard deviations.',
      stock: data.results[0],
    };
  }, [data?.results]);

  // Actions
  const handleMarkStockAsSeen = async (stockId: string) => {
    setMarkingStockId(stockId);
    try {
      const res = await fetch(`/api/stocks/${stockId}/mark-seen`, { method: 'POST' });
      if (res.ok) {
        await fetchData(false);
        if (selectedStock && selectedStock.stock_id === stockId) {
          const updated = data?.results.find(s => s.stock_id === stockId);
          if (updated) setSelectedStock(updated);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingStockId(null);
    }
  };

  const handleMarkAllAsSeen = async () => {
    if (!data?.watchlist?.id) return;
    setIsMarkingAll(true);
    try {
      const res = await fetch(`/api/watchlist/${data.watchlist.id}/mark-seen`, { method: 'POST' });
      if (res.ok) {
        await fetchData(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleCreateWatchlist = async (name: string) => {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const newWl = await res.json();
      setActiveWatchlistId(newWl.id);
      await fetchData(true);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    const res = await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setActiveWatchlistId(undefined);
      await fetchData(true);
    }
  };

  const handleRemoveStock = async (stockId: string) => {
    if (!data?.watchlist?.id) return;
    const res = await fetch(`/api/watchlist/${data.watchlist.id}/stocks/${stockId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await fetchData(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#1A1A1A] flex flex-col font-sans antialiased selection:bg-[#00D09C]/20">
      {/* Top Editorial Navigation */}
      <Navbar
        marketStatus={data?.market_status || null}
        indices={data?.indices || []}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onRefresh={() => fetchData(false)}
        isRefreshing={isRefreshing}
      />

      {/* Main Grid Container with Editorial Aesthetic 8:4 column layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grow w-full">
        {/* Error message */}
        {error && (
          <div className="p-4 mb-6 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => fetchData(true)}
              className="ml-auto underline text-xs font-bold hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-24 text-center">
            <div className="inline-block w-8 h-8 border-3 border-[#00D09C] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]">Evaluating multi-signal market changes...</p>
            <p className="text-xs text-gray-400 mt-1">Comparing quotes against your previous visit</p>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Primary Section (8 cols on desktop) */}
            <section className="lg:col-span-8 flex flex-col space-y-6">
              {/* Attention Hero Banner */}
              <AttentionHeroBanner
                summary={data.attention_summary}
                topStocks={data.results}
                filterView={filterView}
                onFilterChange={setFilterView}
                onMarkAllAsSeen={handleMarkAllAsSeen}
                onSelectStock={setSelectedStock}
                isMarkingSeen={isMarkingAll}
              />

              {/* Watchlist Selector Bar */}
              <WatchlistSelector
                watchlists={data.all_watchlists}
                activeWatchlist={data.watchlist}
                onSelectWatchlist={wl => setActiveWatchlistId(wl.id)}
                onCreateWatchlist={handleCreateWatchlist}
                onDeleteWatchlist={handleDeleteWatchlist}
                onOpenAddStock={() => setIsAddStockOpen(true)}
                selectedSector={selectedSector}
                onSelectSector={setSelectedSector}
                sectors={availableSectors}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />

              {/* Priority Attention Center Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-[#1A1A1A]">Watchlist Intelligence Feed</h3>
                  <p className="text-xs text-gray-400 font-medium">Ranked by change magnitude and explainable attention signals</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {displayedStocks.length} of {data.results.length} Stocks
                </span>
              </div>

              {/* Stocks Grid */}
              {displayedStocks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {displayedStocks.map(stock => (
                    <StockCard
                      key={stock.stock_id}
                      stock={stock}
                      onSelect={setSelectedStock}
                      onMarkAsSeen={handleMarkStockAsSeen}
                      onRemove={handleRemoveStock}
                      isMarking={markingStockId === stock.stock_id}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-gray-200/80 p-12 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-[#00D09C]" />
                  </div>
                  <h3 className="text-base font-bold text-[#1A1A1A] mb-1">No stocks match current filter</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                    {filterView !== 'ALL'
                      ? 'None of the stocks in this watchlist currently meet the selected attention threshold.'
                      : 'No stocks found in this watchlist.'}
                  </p>
                  {filterView !== 'ALL' ? (
                    <button
                      onClick={() => setFilterView('ALL')}
                      className="px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-full bg-[#1A1A1A] text-white hover:bg-black transition-colors shadow-xs"
                    >
                      Show All Stocks
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsAddStockOpen(true)}
                      className="px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-full bg-[#00D09C] text-black hover:bg-[#00b889] transition-colors shadow-xs"
                    >
                      Add Stocks Now
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Editorial Aside (4 cols on desktop) */}
            <aside className="lg:col-span-4 flex flex-col space-y-6">
              {/* Dark Watchlist Overview Card (Editorial Aesthetic motif) */}
              <div className="bg-[#1A1A1A] rounded-3xl p-6 text-white shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-xs tracking-widest uppercase text-gray-400">
                      Watchlist • {data.watchlist?.name || 'Default'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Real-time quote snapshot</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" />
                </div>

                {/* Stock rows */}
                <div className="space-y-3.5 divide-y divide-white/10">
                  {data.results.slice(0, 6).map(stk => {
                    const isPos = stk.day_change >= 0;
                    return (
                      <div
                        key={stk.stock_id}
                        onClick={() => setSelectedStock(stk)}
                        className="pt-3.5 first:pt-0 flex items-center justify-between cursor-pointer group hover:opacity-90"
                      >
                        <div>
                          <div className="font-bold text-sm tracking-tight text-white group-hover:text-[#00D09C] transition-colors">
                            {stk.symbol}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                            {(stk.volume / 1000000).toFixed(2)}M Vol • {stk.attention_level.replace('_', ' ')}
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <div className="font-bold text-sm text-white">
                            ₹{stk.current_price.toFixed(2)}
                          </div>
                          <div
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              isPos ? 'text-[#00D09C]' : 'text-red-400'
                            }`}
                          >
                            {isPos ? '+' : ''}{stk.day_change_percent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Manage Watchlist CTA Button */}
                <button
                  id="btn-sidebar-manage-watchlist"
                  onClick={() => setIsAddStockOpen(true)}
                  className="mt-6 w-full py-3 bg-[#00D09C] text-black font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-xs"
                >
                  Manage Watchlist
                </button>
              </div>

              {/* Insider Insight Card */}
              {keyInsight && (
                <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-[#008f6b] shrink-0">
                      <Lightbulb className="w-5 h-5 text-[#00D09C]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                        Market Insight
                      </h4>
                      <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">{keyInsight.title}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed pt-1">
                    {keyInsight.description}
                  </p>
                  <button
                    onClick={() => setSelectedStock(keyInsight.stock)}
                    className="text-xs font-bold uppercase tracking-wider text-[#00D09C] hover:text-[#008f6b] self-start pt-1"
                  >
                    View Breakdown →
                  </button>
                </div>
              )}

              {/* Reliability Lab Quick Card */}
              <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                    Engine Testing Lab
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    99.8% Reliability
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Test simulated out-of-order market ticks, multi-feed price divergence (&gt;1.5%), and quarterly earnings shocks.
                </p>
                <button
                  id="btn-sidebar-open-lab"
                  onClick={() => setIsSimulatorOpen(true)}
                  className="w-full py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#00D09C]" />
                  Launch Reliability Lab
                </button>
              </div>
            </aside>
          </div>
        ) : null}
      </main>

      {/* Editorial Aesthetic Footer */}
      <footer className="px-6 sm:px-8 py-4 bg-white border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400 gap-3 mt-12">
        <div>Groww Market Watch © 2026 • Smart Engine V1.0</div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <span>Data Reliability: 99.8%</span>
          <span>Mock Provider: Active</span>
          <span>Scoring: Deterministic</span>
        </div>
      </footer>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onMarkAsSeen={async id => {
            await handleMarkStockAsSeen(id);
          }}
        />
      )}

      {/* Add Stock Modal */}
      {isAddStockOpen && data?.watchlist && (
        <AddStockModal
          watchlistId={data.watchlist.id}
          existingStocks={data.results}
          onClose={() => setIsAddStockOpen(false)}
          onStockAdded={async () => {
            setIsAddStockOpen(false);
            await fetchData(false);
          }}
        />
      )}

      {/* Simulator Lab Modal */}
      {isSimulatorOpen && (
        <SimulatorLabModal
          onClose={() => setIsSimulatorOpen(false)}
          onRefreshData={() => fetchData(false)}
        />
      )}
    </div>
  );
}
