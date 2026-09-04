export type AttentionLevel = 'NORMAL' | 'LOW' | 'MODERATE' | 'SIGNIFICANT' | 'HIGH_ATTENTION';

export type MarketStatusType = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'HOLIDAY';

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  sector: string;
  market_cap: number;
  pe_ratio: number;
  eps: number;
  div_yield: number;
  is_active: number;
}

export interface MarketSnapshot {
  id: string;
  stock_id: string;
  symbol: string;
  timestamp: string; // ISO
  price: number;
  change: number;
  change_percent: number;
  open_price: number;
  high_price: number;
  low_price: number;
  prev_close: number;
  week_52_high: number;
  week_52_low: number;
  volume: number;
  avg_volume_20d: number;
  volume_ratio: number;
  rsi_14: number;
  dma_50: number;
  dma_200: number;
  macd: number;
  provider: string;
  version: number;
  is_stale: boolean;
  data_conflict?: boolean;
}

export interface HistoricalPoint {
  timestamp: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockEvent {
  id: string;
  stock_id: string;
  event_type: 'RESULTS' | 'DIVIDEND' | 'SPLIT' | 'BONUS' | 'ANNOUNCEMENT';
  title: string;
  description: string;
  event_date: string;
  significance_score: number; // 1-15
}

export interface StockNews {
  id: string;
  stock_id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  retrieved_at: string;
  provider: 'serpapi' | 'mock' | 'custom';
  relevance_score: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  event_category: 'EARNINGS' | 'REGULATORY' | 'MANAGEMENT' | 'CORP_ACTION' | 'GENERAL';
}

export interface UserStockState {
  user_id: string;
  stock_id: string;
  last_seen_at: string;
  last_seen_price: number;
  last_seen_volume: number;
  last_seen_rsi: number;
  last_seen_50_dma: number;
  last_seen_200_dma: number;
  last_seen_event_ids: string[];
  last_seen_news_ids: string[];
  updated_at: string;
}

export interface SignalBreakdown {
  category: 'PRICE' | 'VOLUME' | 'TECHNICAL' | 'CORPORATE' | 'NEWS';
  points: number;
  max_points: number;
  label: string;
  details: string;
}

export interface MeaningfulChangeResult {
  stock_id: string;
  symbol: string;
  company_name: string;
  sector: string;
  current_price: number;
  day_change: number;
  day_change_percent: number;
  
  // Last seen comparison
  last_seen_at: string | null;
  last_seen_price: number | null;
  change_since_last_seen: number | null;
  change_since_last_seen_percent: number | null;
  time_since_last_seen_seconds: number;
  
  // Score & Classification
  change_score: number; // 0 - 100
  attention_level: AttentionLevel;
  is_meaningful: boolean; // score >= 40
  
  // Explainability
  signals: SignalBreakdown[];
  why_it_matters: string[];
  tags: string[]; // e.g. ["50 DMA Breached", "2.8x Vol", "Q3 Results"]
  
  // Snapshot metrics
  volume_ratio: number;
  rsi_14: number;
  dma_50: number;
  dma_200: number;
  is_stale: boolean;
  data_conflict: boolean;
  updated_at: string;
  
  // New items
  new_events: StockEvent[];
  new_news: StockNews[];
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stocks_count?: number;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  current_value: number;
  change: number;
  change_percent: number;
  day_high: number;
  day_low: number;
  updated_at: string;
}

export interface MarketStatus {
  status: MarketStatusType;
  message: string;
  next_action_time: string;
  is_open: boolean;
  current_time_ist: string;
  exchange: 'NSE';
}
