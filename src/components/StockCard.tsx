import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Info,
  Layers,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React from 'react';
import { MeaningfulChangeResult } from '../types.js';

interface StockCardProps {
  stock: MeaningfulChangeResult;
  onSelect: (stock: MeaningfulChangeResult) => void;
  onMarkAsSeen: (stockId: string) => void;
  onRemove: (stockId: string) => void;
  isMarking: boolean;
}

export const StockCard: React.FC<StockCardProps> = ({
  stock,
  onSelect,
  onMarkAsSeen,
  onRemove,
  isMarking,
}) => {
  const isPositiveDay = stock.day_change >= 0;
  const isPositiveVisit = (stock.change_since_last_seen ?? stock.day_change) >= 0;

  // Visual styling based on attention level (Editorial Aesthetic)
  const getAttentionTheme = () => {
    switch (stock.attention_level) {
      case 'HIGH_ATTENTION':
        return {
          leftBorder: 'border-l-4 border-l-red-500',
          badgeBg: 'bg-red-50 text-red-700 border border-red-200',
          scoreColor: 'text-red-700',
          scoreBadge: 'bg-red-100 text-red-800',
          label: 'HIGH ATTENTION',
        };
      case 'SIGNIFICANT':
        return {
          leftBorder: 'border-l-4 border-l-orange-400',
          badgeBg: 'bg-orange-50 text-orange-700 border border-orange-200',
          scoreColor: 'text-orange-700',
          scoreBadge: 'bg-orange-100 text-orange-800',
          label: 'SIGNIFICANT',
        };
      case 'MODERATE':
        return {
          leftBorder: 'border-l-4 border-l-blue-400',
          badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200',
          scoreColor: 'text-blue-700',
          scoreBadge: 'bg-blue-100 text-blue-800',
          label: 'MODERATE',
        };
      default:
        return {
          leftBorder: 'border-l-4 border-l-gray-300',
          badgeBg: 'bg-gray-100 text-gray-600 border border-gray-200',
          scoreColor: 'text-gray-600',
          scoreBadge: 'bg-gray-100 text-gray-700',
          label: 'NORMAL',
        };
    }
  };

  const theme = getAttentionTheme();

  return (
    <div
      onClick={() => onSelect(stock)}
      className={`bg-white rounded-2xl ${theme.leftBorder} border-t border-r border-b border-gray-100 p-5 shadow-xs transition-all hover:shadow-md cursor-pointer relative group flex flex-col justify-between`}
    >
      <div>
        {/* Top Header: Symbol, Name, Badges, and Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-sm select-none">
              {stock.symbol.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-[#1A1A1A] tracking-tight">{stock.symbol}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {stock.sector}
                </span>
                {stock.is_stale && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" /> Stale
                  </span>
                )}
                {stock.data_conflict && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800 flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> Feed Conflict
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium truncate max-w-[210px]">{stock.company_name}</p>
            </div>
          </div>

          {/* Attention Score & Remove action */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${theme.badgeBg}`}>
                {stock.attention_level === 'HIGH_ATTENTION' && <AlertCircle className="w-3 h-3 text-red-600" />}
                {stock.attention_level === 'SIGNIFICANT' && <Sparkles className="w-3 h-3 text-orange-500" />}
                {theme.label}: {stock.change_score}/100
              </span>
            </div>

            {/* Remove button (visible on hover) */}
            <button
              onClick={e => {
                e.stopPropagation();
                if (confirm(`Remove ${stock.symbol} from watchlist?`)) {
                  onRemove(stock.stock_id);
                }
              }}
              title="Remove from watchlist"
              className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Price & Delta Row */}
        <div className="mt-4 pt-3.5 border-t border-gray-100 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-bold font-mono tracking-tight text-[#1A1A1A]">
              ₹{stock.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold mt-0.5">
              <span className={isPositiveDay ? 'text-[#00D09C]' : 'text-red-600'}>
                {isPositiveDay ? '+' : ''}₹{stock.day_change.toFixed(2)} ({isPositiveDay ? '+' : ''}{stock.day_change_percent.toFixed(2)}%)
              </span>
              <span className="text-gray-400 font-normal font-sans">today</span>
            </div>
          </div>

          {/* DELTA SINCE LAST VISIT: Editorial compare */}
          {stock.is_first_visit ? (
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                First observation
              </span>
              <div className="text-[11px] font-medium text-gray-400 mt-0.5">
                Baseline set at current price
              </div>
            </div>
          ) : stock.change_since_last_seen_percent !== null ? (
            <div className="text-right">
              <div
                className={`text-xs font-mono font-bold flex items-center justify-end gap-0.5 ${
                  isPositiveVisit ? 'text-[#00D09C]' : 'text-red-600'
                }`}
              >
                {isPositiveVisit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {isPositiveVisit ? '+' : ''}
                {stock.change_since_last_seen_percent.toFixed(2)}%
                <span className="text-[11px] text-gray-500 font-normal">
                  ({isPositiveVisit ? '+' : ''}₹{Math.abs(stock.change_since_last_seen ?? 0).toFixed(2)})
                </span>
              </div>
              <div className="text-[11px] font-medium text-gray-400 italic mt-0.5">
                vs last checked (₹{(stock.last_seen_price || stock.current_price).toFixed(2)})
              </div>
            </div>
          ) : null}
        </div>

        {/* SINCE YOU LAST CHECKED: Structured Summary Bullets (Section 2 & 4) */}
        {stock.since_last_checked_summary && stock.since_last_checked_summary.length > 0 && (
          <div className="mt-3.5 p-3 rounded-xl bg-gray-50/90 border border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400" />
              Since you last checked:
            </p>
            <ul className="space-y-1">
              {stock.since_last_checked_summary.slice(0, 3).map((bullet, idx) => (
                <li key={idx} className="text-xs text-[#1A1A1A] flex items-start gap-1.5 font-medium leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D09C] shrink-0 mt-1.5" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Meaningful Tags */}
        {stock.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stock.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700"
              >
                {tag}
              </span>
            ))}
            {stock.volume_ratio >= 1.5 && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-600" />
                {stock.volume_ratio}x Vol
              </span>
            )}
          </div>
        )}

        {/* EXPLAINABILITY DRAWER: "Why this matters" (Section 5) */}
        <div className="mt-3.5 pt-3 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1">
            <Info className="w-3 h-3 text-gray-400" />
            Why this matters:
          </p>
          <ul className="space-y-1">
            {stock.why_it_matters.slice(0, 3).map((item, idx) => (
              <li key={idx} className="text-xs text-gray-600 flex items-start gap-1.5 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 mt-1.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom row: Mark as Seen & Full Analysis */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={e => {
            e.stopPropagation();
            onMarkAsSeen(stock.stock_id);
          }}
          disabled={isMarking}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-gray-600 hover:text-black hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Mark this stock as reviewed to update baseline"
        >
          <Check className="w-3.5 h-3.5 text-[#00D09C]" />
          <span>Mark Seen</span>
        </button>

        <div className="text-xs font-bold uppercase tracking-wider text-[#00D09C] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
          <span>Full Analysis</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
