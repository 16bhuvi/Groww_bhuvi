import { Activity, AlertTriangle, CheckCircle2, Clock, Globe, RefreshCw, Sliders, Wifi, WifiOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MarketIndex, MarketStatus } from '../types.js';

interface NavbarProps {
  marketStatus: MarketStatus | null;
  indices: MarketIndex[];
  onOpenSimulator: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  marketStatus,
  indices,
  onOpenSimulator,
  onRefresh,
  isRefreshing,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusBadge = () => {
    if (!marketStatus) return null;
    switch (marketStatus.status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-[#00D09C] border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" />
            NSE Live
          </span>
        );
      case 'PRE_MARKET':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Pre-Market
          </span>
        );
      case 'POST_MARKET':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Post-Market
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Market Closed
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
      {/* Top Main Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo & Editorial Wordmark */}
          <div className="flex items-center space-x-6 sm:space-x-8">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl sm:text-3xl font-black tracking-tighter text-[#00D09C]">GROWW</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] px-2.5 py-0.5 rounded-full bg-[#00D09C]/10 text-[#008f6b] border border-[#00D09C]/20 hidden sm:inline-block">
                Smart Watchlist
              </span>
            </div>

            {/* Desktop Top Inline Indices Preview */}
            <div className="hidden lg:flex items-center space-x-6 text-xs font-bold uppercase tracking-widest text-gray-400">
              {indices.slice(0, 2).map(idx => {
                const isPositive = idx.change >= 0;
                return (
                  <div key={idx.symbol} className="flex items-center space-x-2">
                    <span>{idx.name}</span>
                    <span className="text-[#1A1A1A] font-mono">{idx.current_value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    <span className={`font-mono text-[11px] ${isPositive ? 'text-[#00D09C]' : 'text-red-500'}`}>
                      {isPositive ? '+' : ''}{idx.change_percent.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center / Right controls */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Market Status with IST clock */}
            <div className="hidden md:flex items-center gap-2.5 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600">
              {getStatusBadge()}
              <div className="flex items-center gap-1 text-gray-500 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{marketStatus?.current_time_ist || 'IST'}</span>
              </div>
            </div>

            {/* Offline Status */}
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            )}

            {/* Manual Refresh button */}
            <button
              id="btn-refresh-market"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Watchlist & Recalculate Signals"
              className="p-2 text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00D09C]' : ''}`} />
            </button>

            {/* Simulator & Reliability Lab */}
            <button
              id="btn-open-simulator"
              onClick={onOpenSimulator}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-[#1A1A1A] hover:bg-black text-white rounded-full shadow-xs transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-[#00D09C]" />
              <span className="hidden sm:inline">Reliability Lab</span>
              <span className="sm:hidden">Simulate</span>
            </button>

            {/* Editorial User Badge */}
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-[#1A1A1A] border border-gray-300 select-none">
              GW
            </div>
          </div>
        </div>
      </div>

      {/* Indices Ticker Bar */}
      <div className="bg-gray-50 border-t border-gray-200 py-2 px-4 sm:px-6 lg:px-8 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center gap-6 text-xs whitespace-nowrap">
          <span className="text-gray-400 uppercase font-bold text-[10px] tracking-[0.2em]">Market Indices</span>
          {indices.map(idx => {
            const isPositive = idx.change >= 0;
            return (
              <div key={idx.symbol} className="flex items-center space-x-2">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px]">{idx.name}</span>
                <span className="font-mono text-[#1A1A1A] font-semibold">{idx.current_value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    isPositive ? 'text-[#00D09C]' : 'text-red-500'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {idx.change_percent.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
};
