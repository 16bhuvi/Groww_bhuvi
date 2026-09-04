import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  Newspaper,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HistoricalPoint, MeaningfulChangeResult, Stock, StockEvent, StockNews } from '../types.js';

interface StockDetailModalProps {
  stock: MeaningfulChangeResult;
  onClose: () => void;
  onMarkAsSeen: (stockId: string) => Promise<void>;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  stock,
  onClose,
  onMarkAsSeen,
}) => {
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [chartData, setChartData] = useState<HistoricalPoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(true);
  const [peers, setPeers] = useState<any[]>([]);
  const [isMarking, setIsMarking] = useState<boolean>(false);
  const [justMarked, setJustMarked] = useState<boolean>(false);

  useEffect(() => {
    fetchStockChart(timeframe);
  }, [stock.symbol, timeframe]);

  const fetchStockChart = async (tf: string) => {
    setIsLoadingChart(true);
    try {
      const res = await fetch(`/api/stocks/${stock.symbol}?timeframe=${tf}`);
      if (res.ok) {
        const data = await res.json();
        setChartData(data.historical || []);
        setPeers(data.peers || []);
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const handleMarkSeenClick = async () => {
    setIsMarking(true);
    try {
      await onMarkAsSeen(stock.stock_id);
      setJustMarked(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsMarking(false);
    }
  };

  const isPositive = stock.day_change >= 0;
  const isPositiveVisit = (stock.change_since_last_seen ?? stock.day_change) >= 0;

  // Format chart time labels
  const formatChartDate = (isoStr: string) => {
    const d = new Date(isoStr);
    if (timeframe === '1D') {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-start justify-between bg-white">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-lg">
                {stock.symbol.substring(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">{stock.symbol}</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {stock.sector}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">NSE</span>
                </div>
                <p className="text-xs text-gray-500 font-medium">{stock.company_name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mark as seen button */}
            <button
              id="btn-modal-mark-seen"
              onClick={handleMarkSeenClick}
              disabled={isMarking || justMarked}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                justMarked
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-[#00D09C] hover:bg-[#00b889] text-black shadow-xs'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{justMarked ? 'State Synced' : isMarking ? 'Saving...' : 'Mark as Seen'}</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Price & Delta Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-200">
            <div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-[#1A1A1A]">
                ₹{stock.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2 text-sm font-mono font-bold mt-1">
                <span className={isPositive ? 'text-[#00D09C]' : 'text-red-600'}>
                  {isPositive ? '+' : ''}₹{stock.day_change.toFixed(2)} ({isPositive ? '+' : ''}{stock.day_change_percent.toFixed(2)}%)
                </span>
                <span className="text-gray-400 text-xs font-normal font-sans">today</span>
              </div>
            </div>

            {/* Delta Since Last Visit */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs sm:text-right">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1 sm:justify-end">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Change Since Last Visit
              </div>
              <div
                className={`text-lg font-mono font-bold mt-0.5 flex items-center gap-1 sm:justify-end ${
                  isPositiveVisit ? 'text-[#00D09C]' : 'text-red-600'
                }`}
              >
                {isPositiveVisit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {isPositiveVisit ? '+' : ''}
                {(stock.change_since_last_seen_percent ?? stock.day_change_percent).toFixed(2)}%
                <span className="text-xs text-gray-400 font-normal">
                  (₹{(stock.change_since_last_seen ?? stock.day_change).toFixed(2)})
                </span>
              </div>
              <p className="text-[11px] text-gray-400 italic mt-0.5">
                Baseline:{' '}
                {stock.last_seen_price
                  ? `₹${stock.last_seen_price.toFixed(2)}`
                  : 'Day Open'}
              </p>
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Price Performance</h3>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full">
                {['1D', '1W', '1M', '1Y', '5Y'].map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 text-xs font-bold uppercase rounded-full transition-colors ${
                      timeframe === tf ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-gray-500 hover:text-black'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full">
              {isLoadingChart ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositive ? '#00D09C' : '#ef4444'} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={isPositive ? '#00D09C' : '#ef4444'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatChartDate}
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={v => `₹${v}`}
                    />
                    <Tooltip
                      labelFormatter={formatChartDate}
                      formatter={(v: any) => [`₹${Number(v).toFixed(2)}`, 'Price']}
                      contentStyle={{ backgroundColor: '#1A1A1A', color: '#fff', borderRadius: '12px', border: 'none', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={isPositive ? '#00D09C' : '#ef4444'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#chartGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">No chart data</div>
              )}
            </div>
          </div>

          {/* Change Engine Score Breakdown */}
          <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50/70">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
                  <span>Change Score Breakdown</span>
                  <span className="text-xs font-mono font-bold text-black bg-[#00D09C] px-2.5 py-0.5 rounded-full">
                    {stock.change_score}/100
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Deterministic, multi-signal scoring model explaining what changed
                </p>
              </div>

              <span
                className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full ${
                  stock.attention_level === 'HIGH_ATTENTION'
                    ? 'bg-red-100 text-red-800'
                    : stock.attention_level === 'SIGNIFICANT'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {stock.attention_level}
              </span>
            </div>

            {/* Signal Categories */}
            <div className="space-y-3">
              {stock.signals.map(sig => {
                const pct = (sig.points / sig.max_points) * 100;
                return (
                  <div key={sig.category} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-[#1A1A1A]">{sig.label}</span>
                      <span className="font-mono font-bold text-gray-700">
                        {sig.points} / {sig.max_points} pts
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 70 ? 'bg-red-600' : pct >= 40 ? 'bg-orange-500' : 'bg-[#00D09C]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">{sig.details}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Corporate Events & News Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Corporate Actions */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400" />
                Corporate Events & Actions
              </h4>
              {stock.new_events.length > 0 ? (
                <div className="space-y-2.5">
                  {stock.new_events.map(ev => (
                    <div key={ev.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[#1A1A1A]">{ev.event_type}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(ev.event_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-medium text-gray-800">{ev.title}</p>
                      <p className="text-gray-500 text-[11px] mt-0.5">{ev.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-3 text-center">No new corporate events filed</p>
              )}
            </div>

            {/* News & Sentiment */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                <Newspaper className="w-4 h-4 text-gray-400" />
                Market News & Sentiment
              </h4>
              {stock.new_news.length > 0 ? (
                <div className="space-y-2.5">
                  {stock.new_news.map(n => (
                    <div key={n.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">{n.source}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            n.sentiment === 'POSITIVE'
                              ? 'bg-emerald-100 text-[#008f6b]'
                              : n.sentiment === 'NEGATIVE'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {n.sentiment}
                        </span>
                      </div>
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#1A1A1A] hover:text-[#00D09C] flex items-start gap-1 group mt-1"
                      >
                        <span className="group-hover:underline">{n.title}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-3 text-center">No major news updates</p>
              )}
            </div>
          </div>

          {/* Sector Peers */}
          {peers.length > 0 && (
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">
                Sector Peers ({stock.sector})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {peers.map(p => (
                  <div key={p.symbol} className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                    <span className="font-black text-[#1A1A1A]">{p.symbol}</span>
                    <div className="font-mono font-bold text-[#1A1A1A] mt-0.5">₹{Number(p.price).toFixed(2)}</div>
                    <div
                      className={`text-[11px] font-mono font-bold ${
                        Number(p.change_percent) >= 0 ? 'text-[#00D09C]' : 'text-red-600'
                      }`}
                    >
                      {Number(p.change_percent) >= 0 ? '+' : ''}
                      {Number(p.change_percent).toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
