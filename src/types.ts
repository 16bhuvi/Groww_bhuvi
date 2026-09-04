export * from '../server/types/index.js';

export interface WatchlistAnalysisState {
  watchlist: import('../server/types/index.js').Watchlist;
  all_watchlists: import('../server/types/index.js').Watchlist[];
  market_status: import('../server/types/index.js').MarketStatus;
  indices: import('../server/types/index.js').MarketIndex[];
  attention_summary: {
    high_attention_count: number;
    significant_count: number;
    moderate_count: number;
    normal_count: number;
    meaningful_count: number;
    total_tracked: number;
  };
  results: import('../server/types/index.js').MeaningfulChangeResult[];
  last_analyzed_at: string;
}

export type FilterView = 'ALL' | 'MEANINGFUL_ONLY' | 'HIGH_ATTENTION' | 'SIGNIFICANT';
