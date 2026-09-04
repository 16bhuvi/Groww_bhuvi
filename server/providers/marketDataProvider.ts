import { executeQuery, executeRun } from '../db/database.js';
import { SEED_INDICES } from '../db/seedData.js';
import { HistoricalPoint, MarketIndex, MarketSnapshot, MarketStatus, StockEvent } from '../types/index.js';

export interface MarketDataProvider {
  name: string;
  getSnapshot(symbol: string): Promise<MarketSnapshot | null>;
  getHistoricalData(symbol: string, timeframe: string): Promise<HistoricalPoint[]>;
  getEvents(stockId: string): Promise<StockEvent[]>;
  getMarketOverview(): Promise<MarketIndex[]>;
  getMarketStatus(): MarketStatus;
  applyNewSnapshot(snapshot: Partial<MarketSnapshot> & { symbol: string; timestamp: string; price: number }): Promise<{ success: boolean; reason?: string }>;
}

export class MockMarketDataProvider implements MarketDataProvider {
  name = 'NSE_PRIMARY';
  private manualMarketOpenOverride: boolean | null = null;

  setMarketStatusOverride(isOpen: boolean | null): void {
    this.manualMarketOpenOverride = isOpen;
  }

  getMarketStatus(): MarketStatus {
    // Current Indian Standard Time (IST = UTC + 5:30)
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const istTime = new Date(utcTime + 3600000 * 5.5);

    const day = istTime.getDay(); // 0 = Sun, 6 = Sat
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const timeStr = istTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (this.manualMarketOpenOverride !== null) {
      return {
        status: this.manualMarketOpenOverride ? 'OPEN' : 'CLOSED',
        message: this.manualMarketOpenOverride ? 'NSE Live Market Session' : 'Market Closed (Simulation)',
        next_action_time: this.manualMarketOpenOverride ? '3:30 PM IST' : '9:15 AM IST next trading day',
        is_open: this.manualMarketOpenOverride,
        current_time_ist: `${timeStr} IST`,
        exchange: 'NSE',
      };
    }

    // Trading days Monday (1) to Friday (5)
    if (day === 0 || day === 6) {
      return {
        status: 'CLOSED',
        message: 'Market Closed (Weekend)',
        next_action_time: '9:15 AM IST Monday',
        is_open: false,
        current_time_ist: `${timeStr} IST`,
        exchange: 'NSE',
      };
    }

    // 9:00 AM - 9:15 AM: Pre-market
    if (totalMinutes >= 540 && totalMinutes < 555) {
      return {
        status: 'PRE_MARKET',
        message: 'NSE Pre-Open Session',
        next_action_time: '9:15 AM IST (Regular Open)',
        is_open: false,
        current_time_ist: `${timeStr} IST`,
        exchange: 'NSE',
      };
    }

    // 9:15 AM - 3:30 PM: Normal Trading
    if (totalMinutes >= 555 && totalMinutes < 930) {
      return {
        status: 'OPEN',
        message: 'NSE Live Trading Session',
        next_action_time: '3:30 PM IST (Market Close)',
        is_open: true,
        current_time_ist: `${timeStr} IST`,
        exchange: 'NSE',
      };
    }

    // 3:30 PM - 4:00 PM: Post-market
    if (totalMinutes >= 930 && totalMinutes < 960) {
      return {
        status: 'POST_MARKET',
        message: 'NSE Post-Market Session',
        next_action_time: '9:15 AM IST tomorrow',
        is_open: false,
        current_time_ist: `${timeStr} IST`,
        exchange: 'NSE',
      };
    }

    // Regular Closed
    return {
      status: 'CLOSED',
      message: 'Market Closed (Normal Hours 9:15 AM - 3:30 PM IST)',
      next_action_time: '9:15 AM IST next trading day',
      is_open: false,
      current_time_ist: `${timeStr} IST`,
      exchange: 'NSE',
    };
  }

  async getSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    const row = await executeQuery<any>(
      `SELECT ms.*, s.name as company_name 
       FROM market_snapshots ms
       JOIN stocks s ON s.id = ms.stock_id
       WHERE ms.symbol = ?
       ORDER BY ms.timestamp DESC LIMIT 1`,
      [symbol.toUpperCase()]
    );

    if (!row || row.length === 0) return null;
    const r = row[0];

    // Evaluate freshness (if snapshot is older than 20 minutes)
    const snapTime = new Date(r.timestamp).getTime();
    const isStale = (Date.now() - snapTime) > (20 * 60 * 1000);

    return {
      id: r.id,
      stock_id: r.stock_id,
      symbol: r.symbol,
      timestamp: r.timestamp,
      price: Number(r.price),
      change: Number(r.change),
      change_percent: Number(r.change_percent),
      open_price: Number(r.open_price),
      high_price: Number(r.high_price),
      low_price: Number(r.low_price),
      prev_close: Number(r.prev_close),
      week_52_high: Number(r.week_52_high),
      week_52_low: Number(r.week_52_low),
      volume: Number(r.volume),
      avg_volume_20d: Number(r.avg_volume_20d),
      volume_ratio: Number(r.volume_ratio),
      rsi_14: Number(r.rsi_14),
      dma_50: Number(r.dma_50),
      dma_200: Number(r.dma_200),
      macd: Number(r.macd),
      provider: r.provider,
      version: Number(r.version),
      is_stale: Boolean(r.is_stale || isStale),
      data_conflict: Boolean(r.data_conflict),
    };
  }

  async getHistoricalData(symbol: string, timeframe: string): Promise<HistoricalPoint[]> {
    const rows = await executeQuery<any>(
      `SELECT hp.* FROM historical_prices hp
       JOIN stocks s ON s.id = hp.stock_id
       WHERE s.symbol = ? AND hp.timeframe = ?
       ORDER BY hp.timestamp ASC`,
      [symbol.toUpperCase(), timeframe.toUpperCase()]
    );

    return rows.map(r => ({
      timestamp: r.timestamp,
      price: Number(r.close),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    }));
  }

  async getEvents(stockId: string): Promise<StockEvent[]> {
    const rows = await executeQuery<any>(
      `SELECT * FROM stock_events WHERE stock_id = ? ORDER BY event_date DESC LIMIT 5`,
      [stockId]
    );

    return rows.map(r => ({
      id: r.id,
      stock_id: r.stock_id,
      event_type: r.event_type,
      title: r.title,
      description: r.description,
      event_date: r.event_date,
      significance_score: Number(r.significance_score),
    }));
  }

  async getMarketOverview(): Promise<MarketIndex[]> {
    return SEED_INDICES.map(idx => ({
      ...idx,
      updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Out-of-order snapshot protection & Conflict reconciliation.
   * Requirement:
   * "The backend must never allow an older market snapshot to overwrite a newer snapshot.
   * Snapshot A (10:02:00 ₹710) vs Snapshot B (10:01:00 ₹715) -> Snapshot B must not overwrite A."
   */
  async applyNewSnapshot(incoming: Partial<MarketSnapshot> & { symbol: string; timestamp: string; price: number }): Promise<{ success: boolean; reason?: string }> {
    const current = await this.getSnapshot(incoming.symbol);

    if (current) {
      const incomingTime = new Date(incoming.timestamp).getTime();
      const currentTime = new Date(current.timestamp).getTime();

      // Guard: Out-of-order rejection
      if (incomingTime < currentTime) {
        await executeRun(
          `INSERT INTO system_audit_logs (id, event_type, details, timestamp) VALUES (?, ?, ?, ?)`,
          [
            `audit_${Date.now()}`,
            'OUT_OF_ORDER_SNAPSHOT_REJECTED',
            `Rejected snapshot for ${incoming.symbol}: incoming timestamp ${incoming.timestamp} is older than current ${current.timestamp}`,
            new Date().toISOString()
          ]
        );
        return {
          success: false,
          reason: `OUT_OF_ORDER: Incoming snapshot timestamp (${incoming.timestamp}) is earlier than current market state (${current.timestamp})`
        };
      }

      // Check conflicting data (multi-provider discrepancy > 1.5%)
      let dataConflict = Boolean(incoming.data_conflict);
      if (incoming.provider && (incoming.provider !== current.provider || incoming.provider !== 'NSE_PRIMARY')) {
        const diffPercent = Math.abs((incoming.price - current.price) / current.price) * 100;
        if (diffPercent > 1.5) {
          dataConflict = true;
          await executeRun(
            `INSERT INTO system_audit_logs (id, event_type, details, timestamp) VALUES (?, ?, ?, ?)`,
            [
              `audit_${Date.now()}`,
              'PROVIDER_DATA_CONFLICT_DETECTED',
              `Conflict detected for ${incoming.symbol}: Primary=${current.price} (${current.provider}), Incoming=${incoming.price} (${incoming.provider}), discrepancy=${diffPercent.toFixed(2)}%`,
              new Date().toISOString()
            ]
          );
        }
      }

      const snapId = `snap_${incoming.symbol}_${Date.now()}`;
      const change = incoming.price - current.prev_close;
      const changePercent = (change / current.prev_close) * 100;
      const newVersion = (current.version || 1) + 1;

      await executeRun(
        `INSERT INTO market_snapshots (
          id, stock_id, symbol, timestamp, price, change, change_percent, open_price, high_price, low_price,
          prev_close, week_52_high, week_52_low, volume, avg_volume_20d, volume_ratio, rsi_14, dma_50, dma_200,
          macd, provider, version, is_stale, data_conflict, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          snapId,
          current.stock_id,
          incoming.symbol,
          incoming.timestamp,
          incoming.price,
          change,
          changePercent,
          incoming.open_price ?? current.open_price,
          Math.max(current.high_price, incoming.price),
          Math.min(current.low_price, incoming.price),
          current.prev_close,
          current.week_52_high,
          current.week_52_low,
          incoming.volume ?? current.volume,
          current.avg_volume_20d,
          incoming.volume_ratio ?? current.volume_ratio,
          incoming.rsi_14 ?? current.rsi_14,
          incoming.dma_50 ?? current.dma_50,
          incoming.dma_200 ?? current.dma_200,
          incoming.macd ?? current.macd,
          dataConflict ? current.provider : (incoming.provider ?? current.provider),
          newVersion,
          incoming.is_stale ? 1 : 0,
          dataConflict ? 1 : 0,
          new Date().toISOString()
        ]
      );
      return { success: true };
    }

    return { success: false, reason: 'STOCK_NOT_FOUND' };
  }
}

export const defaultMarketProvider = new MockMarketDataProvider();
