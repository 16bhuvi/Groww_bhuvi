import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCheck, Clock, Eye, Info, Sparkles } from 'lucide-react';
import React from 'react';
import { FilterView, MeaningfulChangeResult } from '../types.js';

interface AttentionHeroBannerProps {
  summary: {
    high_attention_count: number;
    significant_count: number;
    moderate_count: number;
    normal_count: number;
    meaningful_count: number;
    total_tracked: number;
  };
  topStocks: MeaningfulChangeResult[];
  filterView: FilterView;
  onFilterChange: (view: FilterView) => void;
  onMarkAllAsSeen: () => void;
  onSelectStock: (stock: MeaningfulChangeResult) => void;
  isMarkingSeen: boolean;
}

export const AttentionHeroBanner: React.FC<AttentionHeroBannerProps> = ({
  summary,
  topStocks,
  filterView,
  onFilterChange,
  onMarkAllAsSeen,
  onSelectStock,
  isMarkingSeen,
}) => {
  // Find top attention stock
  const urgentStock = topStocks.find(s => s.attention_level === 'HIGH_ATTENTION') || topStocks[0];
  const significantStocks = topStocks.filter(s => s.attention_level === 'SIGNIFICANT');

  const getWatermarkHours = () => {
    if (!urgentStock?.time_since_last_seen_seconds) return '18H';
    const h = Math.floor(urgentStock.time_since_last_seen_seconds / 3600);
    if (h > 0) return `${h}H`;
    const m = Math.floor(urgentStock.time_since_last_seen_seconds / 60);
    return `${m > 0 ? m : 1}M`;
  };

  const formatLastSeenTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'first visit today';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins > 0 ? `${mins}m ` : ''}ago`;
  };

  const primaryLastSeen = urgentStock?.time_since_last_seen_seconds 
    ? formatLastSeenTime(urgentStock.time_since_last_seen_seconds)
    : '4h ago';

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs relative overflow-hidden mb-6">
      {/* Giant Editorial Watermark (Hours elapsed) */}
      <div className="absolute top-0 right-0 p-6 sm:p-8 pointer-events-none select-none">
        <span className="text-[72px] sm:text-[100px] font-black text-gray-100 leading-none select-none">
          {getWatermarkHours()}
        </span>
      </div>

      <div className="relative z-10">
        {/* Editorial Eyebrow */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-gray-400">
            Since You Last Checked • {primaryLastSeen}
          </h2>

          <button
            id="btn-mark-all-seen"
            onClick={onMarkAllAsSeen}
            disabled={isMarkingSeen || summary.meaningful_count === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full bg-gray-100 hover:bg-gray-200 text-[#1A1A1A] transition-colors self-start sm:self-auto disabled:opacity-50 shadow-xs"
            title="Update last-seen baseline for all stocks"
          >
            <CheckCheck className={`w-3.5 h-3.5 ${isMarkingSeen ? 'animate-pulse' : ''}`} />
            <span>Mark Watchlist Seen</span>
          </button>
        </div>

        {/* Editorial Headline */}
        <h1 className="text-2xl sm:text-4xl font-light leading-tight mb-4 text-[#1A1A1A] max-w-2xl">
          {summary.meaningful_count > 0 ? (
            <>
              While you were away,{' '}
              <span className="font-bold italic text-black underline decoration-[#00D09C] underline-offset-8">
                {summary.meaningful_count} {summary.meaningful_count === 1 ? 'stock' : 'stocks'}
              </span>{' '}
              moved meaningfully.
            </>
          ) : (
            <>
              Your watchlist is{' '}
              <span className="font-bold italic text-black underline decoration-[#00D09C] underline-offset-8">
                steady
              </span>{' '}
              with no unusual market deviations.
            </>
          )}
        </h1>

        {/* Summary Badges in Editorial Pill Style */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {summary.high_attention_count > 0 && (
            <div className="px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider border border-red-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {summary.high_attention_count} High Attention
            </div>
          )}
          {summary.significant_count > 0 && (
            <div className="px-4 py-1.5 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider border border-orange-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {summary.significant_count} Significant
            </div>
          )}
          {summary.moderate_count > 0 && (
            <div className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
              {summary.moderate_count} Moderate
            </div>
          )}
          <div className="text-xs text-gray-400 font-medium">
            Threshold: Multi-signal score ≥ 40/100 triggers attention
          </div>
        </div>

        {/* Priority Highlight Cards (Editorial Aesthetic with left thick border) */}
        {urgentStock && urgentStock.is_meaningful && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Urgent / High Attention Card */}
            <div
              onClick={() => onSelectStock(urgentStock)}
              className="bg-white border-l-4 border-red-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer border-t border-r border-b border-gray-100 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-black text-lg text-[#1A1A1A] tracking-tight">{urgentStock.symbol}</span>
                      <span className="text-xs font-bold px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                        HIGH: {urgentStock.change_score}/100
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{urgentStock.company_name}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600 font-mono">
                      ₹{urgentStock.current_price.toFixed(2)}
                    </div>
                    <div className="text-[11px] font-medium text-gray-400 italic underline decoration-dotted">
                      Compare with last seen (₹{(urgentStock.last_seen_price || urgentStock.current_price).toFixed(2)})
                    </div>
                  </div>
                </div>

                {/* Explainability bullets */}
                <p className="text-xs text-gray-600 mt-3 pt-2.5 border-t border-gray-100 leading-relaxed">
                  {urgentStock.why_it_matters.join(' • ')}
                </p>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-1.5 pt-2">
                {urgentStock.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Significant Highlight Card */}
            {significantStocks.length > 0 && significantStocks[0].stock_id !== urgentStock.stock_id ? (
              <div
                onClick={() => onSelectStock(significantStocks[0])}
                className="bg-white border-l-4 border-orange-400 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer border-t border-r border-b border-gray-100 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="font-black text-lg text-[#1A1A1A] tracking-tight">{significantStocks[0].symbol}</span>
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                          MODERATE: {significantStocks[0].change_score}/100
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">{significantStocks[0].company_name}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold text-[#00D09C] font-mono">
                        ₹{significantStocks[0].current_price.toFixed(2)}
                      </div>
                      <div className="text-[11px] font-medium text-gray-400 italic">
                        Compare with last seen (₹{(significantStocks[0].last_seen_price || significantStocks[0].current_price).toFixed(2)})
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mt-3 pt-2.5 border-t border-gray-100 leading-relaxed">
                    {significantStocks[0].why_it_matters.join(' • ')}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 pt-2">
                  {significantStocks[0].tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white border-l-4 border-gray-300 rounded-2xl p-5 shadow-xs border-t border-r border-b border-gray-100 flex items-center justify-center text-center">
                <p className="text-xs text-gray-400 font-medium max-w-xs">
                  All remaining stocks in this watchlist are trading within normal baseline volatility.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Navigation Tabs in Editorial Aesthetic */}
      <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="tab-all-stocks"
            onClick={() => onFilterChange('ALL')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              filterView === 'ALL'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            All Stocks ({summary.total_tracked})
          </button>
          <button
            id="tab-meaningful-only"
            onClick={() => onFilterChange('MEANINGFUL_ONLY')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              filterView === 'MEANINGFUL_ONLY'
                ? 'bg-[#00D09C] text-black shadow-xs'
                : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Meaningful Only ({summary.meaningful_count})
          </button>
          <button
            id="tab-high-attention"
            onClick={() => onFilterChange('HIGH_ATTENTION')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              filterView === 'HIGH_ATTENTION'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            High Attention ({summary.high_attention_count})
          </button>
          <button
            id="tab-significant"
            onClick={() => onFilterChange('SIGNIFICANT')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              filterView === 'SIGNIFICANT'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            Significant ({summary.significant_count})
          </button>
        </div>

        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Ranked by Attention Score
        </span>
      </div>
    </div>
  );
};
