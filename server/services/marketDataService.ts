import { executeQuery, executeQueryOne, executeRun } from '../db/database.js';
import { calculateMeaningfulChange } from '../domain/changeEngine.js';
import { defaultMarketProvider } from '../providers/marketDataProvider.js';
import { fetchStockNewsWithCache } from '../providers/newsProvider.js';
import {
  HistoricalPoint,
  MarketIndex,
  MarketSnapshot,
  MarketStatus,
  MeaningfulChangeResult,
  Stock,
  StockEvent,
  StockNews,
  UserStockState,
  Watchlist,
} from '../types/index.js';

export interface WatchlistAnalysisResponse {
  watchlist: Watchlist;
  all_watchlists: Watchlist[];
  market_status: MarketStatus;
  indices: MarketIndex[];
  attention_summary: {
    high_attention_count: number;
    significant_count: number;
    moderate_count: number;
    normal_count: number;
    meaningful_count: number;
    total_tracked: number;
  };
  results: MeaningfulChangeResult[];
  last_analyzed_at: string;
}

export class MarketDataService {
  async getWatchlists(userId: string): Promise<Watchlist[]> {
    const rows = await executeQuery<any>(
      `SELECT * FROM watchlists WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );

    return rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      is_default: Boolean(r.is_default),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  async getWatchlistAnalysis(
    userId: string,
    watchlistId?: string,
    filterOptions?: { sector?: string; attentionLevel?: string; minScore?: number; searchQuery?: string }
  ): Promise<WatchlistAnalysisResponse> {
    const watchlists = await this.getWatchlists(userId);
    let selectedWl = watchlists.find(w => w.id === watchlistId) || watchlists.find(w => w.is_default) || watchlists[0];

    if (!selectedWl) {
      // Create a default watchlist if none exists
      const newId = `wl_${Date.now()}`;
      const now = new Date().toISOString();
      await executeRun(
        `INSERT INTO watchlists (id, user_id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
        [newId, userId, 'My First Watchlist', now, now]
      );
      selectedWl = {
        id: newId,
        user_id: userId,
        name: 'My First Watchlist',
        is_default: true,
        created_at: now,
        updated_at: now,
      };
      watchlists.push(selectedWl);
    }

    // Fetch stocks in this watchlist
    const stockRows = await executeQuery<any>(
      `SELECT s.*, ws.display_order, ws.added_at 
       FROM watchlist_stocks ws
       JOIN stocks s ON s.id = ws.stock_id
       WHERE ws.watchlist_id = ?
       ORDER BY ws.display_order ASC, ws.added_at ASC`,
      [selectedWl.id]
    );

    const results = (
      await Promise.all(
        stockRows.map(async s => {
          const stock: Stock = {
            id: s.id,
            symbol: s.symbol,
            name: s.name,
            exchange: s.exchange,
            sector: s.sector,
            market_cap: Number(s.market_cap),
            pe_ratio: Number(s.pe_ratio),
            eps: Number(s.eps),
            div_yield: Number(s.div_yield),
            is_active: s.is_active,
          };

          const snapshot = await defaultMarketProvider.getSnapshot(stock.symbol);
          if (!snapshot) return null;

          // Get user last seen state
          const userStateRow = await executeQueryOne<any>(
            `SELECT * FROM user_stock_state WHERE user_id = ? AND stock_id = ?`,
            [userId, stock.id]
          );

          let userState: UserStockState | null = null;
          if (userStateRow) {
            let eventIds: string[] = [];
            let newsIds: string[] = [];
            try {
              eventIds = JSON.parse(userStateRow.last_seen_event_ids || '[]');
              newsIds = JSON.parse(userStateRow.last_seen_news_ids || '[]');
            } catch {}

            userState = {
              user_id: userStateRow.user_id,
              stock_id: userStateRow.stock_id,
              last_seen_at: userStateRow.last_seen_at,
              last_seen_price: Number(userStateRow.last_seen_price),
              last_seen_volume: Number(userStateRow.last_seen_volume),
              last_seen_rsi: Number(userStateRow.last_seen_rsi),
              last_seen_50_dma: Number(userStateRow.last_seen_50_dma),
              last_seen_200_dma: Number(userStateRow.last_seen_200_dma),
              last_seen_event_ids: eventIds,
              last_seen_news_ids: newsIds,
              updated_at: userStateRow.updated_at,
            };
          }

          // Fetch corporate events and news
          const events = await defaultMarketProvider.getEvents(stock.id);
          const news = await fetchStockNewsWithCache(stock.symbol, stock.name, stock.id);

          // Run Change Detection Engine
          return calculateMeaningfulChange({
            stock,
            currentSnapshot: snapshot,
            userState,
            events,
            news,
          });
        })
      )
    ).filter((r): r is MeaningfulChangeResult => r !== null);

    // Sort by change score descending (highest priority attention on top!)
    results.sort((a, b) => b.change_score - a.change_score);

    // Apply optional filters
    let filteredResults = results;
    if (filterOptions?.sector && filterOptions.sector !== 'ALL') {
      filteredResults = filteredResults.filter(r => r.sector.toLowerCase() === filterOptions.sector?.toLowerCase());
    }
    if (filterOptions?.attentionLevel && filterOptions.attentionLevel !== 'ALL') {
      filteredResults = filteredResults.filter(r => r.attention_level === filterOptions.attentionLevel);
    }
    if (filterOptions?.minScore !== undefined && filterOptions.minScore > 0) {
      filteredResults = filteredResults.filter(r => r.change_score >= (filterOptions.minScore ?? 0));
    }
    if (filterOptions?.searchQuery && filterOptions.searchQuery.trim().length > 0) {
      const q = filterOptions.searchQuery.toLowerCase();
      filteredResults = filteredResults.filter(
        r => r.symbol.toLowerCase().includes(q) || r.company_name.toLowerCase().includes(q)
      );
    }

    const marketStatus = defaultMarketProvider.getMarketStatus();
    const indices = await defaultMarketProvider.getMarketOverview();

    const summary = {
      high_attention_count: results.filter(r => r.attention_level === 'HIGH_ATTENTION').length,
      significant_count: results.filter(r => r.attention_level === 'SIGNIFICANT').length,
      moderate_count: results.filter(r => r.attention_level === 'MODERATE').length,
      normal_count: results.filter(r => r.attention_level === 'NORMAL' || r.attention_level === 'LOW').length,
      meaningful_count: results.filter(r => r.is_meaningful).length,
      total_tracked: results.length,
    };

    return {
      watchlist: selectedWl,
      all_watchlists: watchlists,
      market_status: marketStatus,
      indices,
      attention_summary: summary,
      results: filteredResults,
      last_analyzed_at: new Date().toISOString(),
    };
  }

  /**
   * Updates last-seen state for a stock.
   * Requirement:
   * "State update should happen explicitly (e.g., when the user opens the detail page
   * or clicks 'Mark as seen'), NOT automatically on initial page load."
   */
  async markStockAsSeen(userId: string, stockId: string): Promise<UserStockState> {
    const stock = await executeQueryOne<any>(`SELECT * FROM stocks WHERE id = ?`, [stockId]);
    if (!stock) throw new Error('Stock not found');

    const snapshot = await defaultMarketProvider.getSnapshot(stock.symbol);
    if (!snapshot) throw new Error('Snapshot not found');

    const events = await defaultMarketProvider.getEvents(stockId);
    const news = await fetchStockNewsWithCache(stock.symbol, stock.name, stockId);
    const eventIds = JSON.stringify(events.map(e => e.id));
    const newsIds = JSON.stringify(news.map(n => n.id));
    const now = new Date().toISOString();

    await executeRun(
      `INSERT INTO user_stock_state (
        id, user_id, stock_id, last_seen_at, last_seen_price, last_seen_volume,
        last_seen_rsi, last_seen_50_dma, last_seen_200_dma, last_seen_event_ids, last_seen_news_ids, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, stock_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        last_seen_price = excluded.last_seen_price,
        last_seen_volume = excluded.last_seen_volume,
        last_seen_rsi = excluded.last_seen_rsi,
        last_seen_50_dma = excluded.last_seen_50_dma,
        last_seen_200_dma = excluded.last_seen_200_dma,
        last_seen_event_ids = excluded.last_seen_event_ids,
        last_seen_news_ids = excluded.last_seen_news_ids,
        updated_at = excluded.updated_at`,
      [
        `uss_${userId}_${stockId}`,
        userId,
        stockId,
        now,
        snapshot.price,
        snapshot.volume,
        snapshot.rsi_14,
        snapshot.dma_50,
        snapshot.dma_200,
        eventIds,
        newsIds,
        now,
      ]
    );

    return {
      user_id: userId,
      stock_id: stockId,
      last_seen_at: now,
      last_seen_price: snapshot.price,
      last_seen_volume: snapshot.volume,
      last_seen_rsi: snapshot.rsi_14,
      last_seen_50_dma: snapshot.dma_50,
      last_seen_200_dma: snapshot.dma_200,
      last_seen_event_ids: events.map(e => e.id),
      last_seen_news_ids: news.map(n => n.id),
      updated_at: now,
    };
  }

  async markAllWatchlistAsSeen(userId: string, watchlistId: string): Promise<void> {
    const stocks = await executeQuery<any>(
      `SELECT stock_id FROM watchlist_stocks WHERE watchlist_id = ?`,
      [watchlistId]
    );
    for (const s of stocks) {
      await this.markStockAsSeen(userId, s.stock_id);
    }
  }

  async getStockDetail(userId: string, symbol: string, timeframe = '1D') {
    const stock = await executeQueryOne<any>(`SELECT * FROM stocks WHERE symbol = ?`, [symbol.toUpperCase()]);
    if (!stock) return null;

    const snapshot = await defaultMarketProvider.getSnapshot(stock.symbol);
    if (!snapshot) return null;

    const userStateRow = await executeQueryOne<any>(
      `SELECT * FROM user_stock_state WHERE user_id = ? AND stock_id = ?`,
      [userId, stock.id]
    );

    let userState: UserStockState | null = null;
    if (userStateRow) {
      userState = {
        user_id: userStateRow.user_id,
        stock_id: userStateRow.stock_id,
        last_seen_at: userStateRow.last_seen_at,
        last_seen_price: Number(userStateRow.last_seen_price),
        last_seen_volume: Number(userStateRow.last_seen_volume),
        last_seen_rsi: Number(userStateRow.last_seen_rsi),
        last_seen_50_dma: Number(userStateRow.last_seen_50_dma),
        last_seen_200_dma: Number(userStateRow.last_seen_200_dma),
        last_seen_event_ids: JSON.parse(userStateRow.last_seen_event_ids || '[]'),
        last_seen_news_ids: JSON.parse(userStateRow.last_seen_news_ids || '[]'),
        updated_at: userStateRow.updated_at,
      };
    }

    const events = await defaultMarketProvider.getEvents(stock.id);
    const news = await fetchStockNewsWithCache(stock.symbol, stock.name, stock.id);
    const historical = await defaultMarketProvider.getHistoricalData(stock.symbol, timeframe);

    const changeAnalysis = calculateMeaningfulChange({
      stock,
      currentSnapshot: snapshot,
      userState,
      events,
      news,
    });

    // Peers in same sector
    const peers = await executeQuery<any>(
      `SELECT s.symbol, s.name, ms.price, ms.change_percent 
       FROM stocks s
       JOIN market_snapshots ms ON ms.stock_id = s.id
       WHERE s.sector = ? AND s.id != ?
       LIMIT 4`,
      [stock.sector, stock.id]
    );

    return {
      stock,
      snapshot,
      userState,
      changeAnalysis,
      historical,
      events,
      news,
      peers,
      marketStatus: defaultMarketProvider.getMarketStatus(),
    };
  }

  async searchStocks(query: string): Promise<Stock[]> {
    const q = `%${query.trim()}%`;
    const rows = await executeQuery<any>(
      `SELECT * FROM stocks WHERE symbol LIKE ? OR name LIKE ? OR sector LIKE ? LIMIT 15`,
      [q, q, q]
    );

    return rows.map(r => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      exchange: r.exchange,
      sector: r.sector,
      market_cap: Number(r.market_cap),
      pe_ratio: Number(r.pe_ratio),
      eps: Number(r.eps),
      div_yield: Number(r.div_yield),
      is_active: r.is_active,
    }));
  }

  async addStockToWatchlist(watchlistId: string, stockId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const countRow = await executeQueryOne<any>(
        `SELECT COUNT(*) as count FROM watchlist_stocks WHERE watchlist_id = ?`,
        [watchlistId]
      );
      const displayOrder = (countRow?.count || 0) + 1;
      const now = new Date().toISOString();

      await executeRun(
        `INSERT INTO watchlist_stocks (watchlist_id, stock_id, display_order, added_at) VALUES (?, ?, ?, ?)`,
        [watchlistId, stockId, displayOrder, now]
      );
      return { success: true };
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('unique') || err.message?.toLowerCase().includes('primary')) {
        return { success: false, message: 'This stock is already in this watchlist' };
      }
      throw err;
    }
  }

  async removeStockFromWatchlist(watchlistId: string, stockId: string): Promise<void> {
    await executeRun(
      `DELETE FROM watchlist_stocks WHERE watchlist_id = ? AND stock_id = ?`,
      [watchlistId, stockId]
    );
  }

  async reorderWatchlist(watchlistId: string, orderedStockIds: string[]): Promise<void> {
    for (let i = 0; i < orderedStockIds.length; i++) {
      await executeRun(
        `UPDATE watchlist_stocks SET display_order = ? WHERE watchlist_id = ? AND stock_id = ?`,
        [i, watchlistId, orderedStockIds[i]]
      );
    }
  }

  async createWatchlist(userId: string, name: string): Promise<Watchlist> {
    const id = `wl_${Date.now()}`;
    const now = new Date().toISOString();
    await executeRun(
      `INSERT INTO watchlists (id, user_id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
      [id, userId, name, now, now]
    );
    return {
      id,
      user_id: userId,
      name,
      is_default: false,
      created_at: now,
      updated_at: now,
    };
  }

  async deleteWatchlist(userId: string, watchlistId: string): Promise<void> {
    await executeRun(`DELETE FROM watchlists WHERE id = ? AND user_id = ?`, [watchlistId, userId]);
  }
}

export const marketDataService = new MarketDataService();
