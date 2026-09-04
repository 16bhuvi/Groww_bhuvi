import { describe, expect, it } from 'vitest';
import { calculateMeaningfulChange } from '../server/domain/changeEngine.js';
import { MarketSnapshot, Stock, StockEvent, StockNews, UserStockState } from '../server/types/index.js';

describe('Meaningful Change Engine Unit Tests', () => {
  const sampleStock: Stock = {
    id: 'stock_tatamotors',
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Limited',
    exchange: 'NSE',
    sector: 'Automobile',
    market_cap: 345000,
    pe_ratio: 16.8,
    eps: 42.5,
    div_yield: 0.8,
    is_active: 1,
  };

  const normalSnapshot: MarketSnapshot = {
    id: 'snap_1',
    stock_id: 'stock_tatamotors',
    symbol: 'TATAMOTORS',
    timestamp: new Date().toISOString(),
    price: 750,
    change: 3,
    change_percent: 0.4,
    open_price: 748,
    high_price: 752,
    low_price: 746,
    prev_close: 747,
    week_52_high: 950,
    week_52_low: 580,
    volume: 1200000,
    avg_volume_20d: 1200000,
    volume_ratio: 1.0,
    rsi_14: 52,
    dma_50: 740,
    dma_200: 710,
    macd: 0.2,
    provider: 'NSE_PRIMARY',
    version: 1,
    is_stale: false,
  };

  it('1. Returns NORMAL attention for a quiet, low-movement stock with normal volume', () => {
    const result = calculateMeaningfulChange({
      stock: sampleStock,
      currentSnapshot: normalSnapshot,
      userState: {
        user_id: 'user_1',
        stock_id: 'stock_tatamotors',
        last_seen_at: new Date(Date.now() - 3600000).toISOString(),
        last_seen_price: 749,
        last_seen_volume: 1100000,
        last_seen_rsi: 51,
        last_seen_50_dma: 740,
        last_seen_200_dma: 710,
        last_seen_event_ids: [],
        last_seen_news_ids: [],
        updated_at: new Date().toISOString(),
      },
      events: [],
      news: [],
    });

    expect(result.change_score).toBeLessThanOrEqual(20);
    expect(result.attention_level).toBe('NORMAL');
    expect(result.is_meaningful).toBe(false);
    expect(result.why_it_matters[0]).toContain('normally within historical moving averages');
  });

  it('2. Correctly flags Multi-Signal High Attention (Tata Motors challenge scenario: -6.2%, 2.8x Vol, 50 DMA breached, Q3 Results)', () => {
    const breakdownSnapshot: MarketSnapshot = {
      ...normalSnapshot,
      price: 710.25,
      change: -46.75,
      change_percent: -6.17,
      open_price: 755,
      prev_close: 757,
      volume: 3360000,
      avg_volume_20d: 1200000,
      volume_ratio: 2.8,
      dma_50: 734.5,
      dma_200: 690,
      rsi_14: 31,
    };

    const previousUserState: UserStockState = {
      user_id: 'user_1',
      stock_id: 'stock_tatamotors',
      last_seen_at: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
      last_seen_price: 758.4,
      last_seen_volume: 1200000,
      last_seen_rsi: 54,
      last_seen_50_dma: 734.5, // was above 50 DMA!
      last_seen_200_dma: 690,
      last_seen_event_ids: [],
      last_seen_news_ids: [],
      updated_at: new Date().toISOString(),
    };

    const newEvents: StockEvent[] = [
      {
        id: 'evt_results_1',
        stock_id: 'stock_tatamotors',
        event_type: 'RESULTS',
        title: 'Q3 FY25 Consolidated Net Profit down 12% YoY',
        description: 'EBITDA margins compress by 180 bps on rising input costs',
        event_date: new Date().toISOString(),
        significance_score: 15,
      },
    ];

    const newNews: StockNews[] = [
      {
        id: 'news_1',
        stock_id: 'stock_tatamotors',
        title: 'Tata Motors shares plunge 6% after margin contraction in Q3',
        source: 'Mint',
        url: 'https://livemint.com/market/tata-motors-q3',
        published_at: new Date().toISOString(),
        retrieved_at: new Date().toISOString(),
        provider: 'mock',
        relevance_score: 0.95,
        sentiment: 'NEGATIVE',
        event_category: 'EARNINGS',
      },
      {
        id: 'news_2',
        stock_id: 'stock_tatamotors',
        title: 'Brokerages downgrade Tata Motors target price',
        source: 'Economic Times',
        url: 'https://economictimes.indiatimes.com/tata-motors',
        published_at: new Date().toISOString(),
        retrieved_at: new Date().toISOString(),
        provider: 'mock',
        relevance_score: 0.88,
        sentiment: 'NEGATIVE',
        event_category: 'EARNINGS',
      },
    ];

    const result = calculateMeaningfulChange({
      stock: sampleStock,
      currentSnapshot: breakdownSnapshot,
      userState: previousUserState,
      events: newEvents,
      news: newNews,
    });

    // Must receive HIGH_ATTENTION (score >= 81)
    expect(result.change_score).toBeGreaterThanOrEqual(81);
    expect(result.attention_level).toBe('HIGH_ATTENTION');
    expect(result.is_meaningful).toBe(true);

    // Verify explainability breakdown
    expect(result.why_it_matters.some(w => w.includes('Price declined') || w.includes('6.3%'))).toBe(true);
    expect(result.why_it_matters.some(w => w.includes('2.8x the 20-day average'))).toBe(true);
    expect(result.why_it_matters.some(w => w.includes('50-day moving average'))).toBe(true);
    expect(result.why_it_matters.some(w => w.includes('Quarterly financial results'))).toBe(true);
  });

  it('3. Distinguishes large price move with low volume vs moderate price move with high volume', () => {
    // Stock A: +5% price move, but normal volume (1.0x), no technical or corporate events
    const stockA = calculateMeaningfulChange({
      stock: sampleStock,
      currentSnapshot: {
        ...normalSnapshot,
        price: 787.5,
        change: 37.5,
        change_percent: 5.0,
        volume_ratio: 1.0,
      },
      userState: {
        ...normalSnapshot,
        user_id: 'u1',
        last_seen_at: new Date(Date.now() - 3600000).toISOString(),
        last_seen_price: 750,
        last_seen_volume: 1200000,
        last_seen_rsi: 50,
        last_seen_50_dma: 740,
        last_seen_200_dma: 710,
        last_seen_event_ids: [],
        last_seen_news_ids: [],
        updated_at: new Date().toISOString(),
      },
      events: [],
      news: [],
    });

    // Stock B: +3% price move, BUT 3.0x volume, 200 DMA breakout, quarterly results announced
    const stockB = calculateMeaningfulChange({
      stock: sampleStock,
      currentSnapshot: {
        ...normalSnapshot,
        price: 772.5,
        change: 22.5,
        change_percent: 3.0,
        volume_ratio: 3.1,
        dma_200: 760, // crossed 200 DMA!
      },
      userState: {
        user_id: 'u1',
        stock_id: 'stock_tatamotors',
        last_seen_at: new Date(Date.now() - 3600000).toISOString(),
        last_seen_price: 750, // was below 760 200 DMA
        last_seen_volume: 1200000,
        last_seen_rsi: 48,
        last_seen_50_dma: 740,
        last_seen_200_dma: 760,
        last_seen_event_ids: [],
        last_seen_news_ids: [],
        updated_at: new Date().toISOString(),
      },
      events: [
        {
          id: 'e_q3',
          stock_id: 'stock_tatamotors',
          event_type: 'RESULTS',
          title: 'Strong Q3 EBITDA expansion',
          description: 'Margins up 300 bps',
          event_date: new Date().toISOString(),
          significance_score: 15,
        },
      ],
      news: [],
    });

    // Stock B MUST have a significantly higher attention score than Stock A despite smaller % move!
    expect(stockB.change_score).toBeGreaterThan(stockA.change_score);
    expect(stockB.change_score).toBeGreaterThanOrEqual(61);
    expect(['SIGNIFICANT', 'HIGH_ATTENTION']).toContain(stockB.attention_level);
    expect(['NORMAL', 'LOW']).toContain(stockA.attention_level); // price only, no confirming signals
  });

  it('4. First-time visit handles baseline properly without misleading 0% change', () => {
    const firstVisitResult = calculateMeaningfulChange({
      stock: sampleStock,
      currentSnapshot: normalSnapshot,
      userState: null, // First time visit
      events: [],
      news: [],
    });

    expect(firstVisitResult.is_first_visit).toBe(true);
    expect(firstVisitResult.change_since_last_seen).toBeNull();
    expect(firstVisitResult.change_since_last_seen_percent).toBeNull();
    expect(firstVisitResult.since_last_checked_summary[0]).toContain("You're seeing this stock for the first time");
  });

  it('5. Generates structured Since You Last Checked summary with price, volume, and technical triggers', () => {
    const returningUserResult = calculateMeaningfulChange({
      stock: sampleStock,
      currentSnapshot: {
        ...normalSnapshot,
        price: 780, // +4% change
        volume_ratio: 2.2,
      },
      userState: {
        user_id: 'u1',
        stock_id: 'stock_tatamotors',
        last_seen_at: new Date(Date.now() - 7200000).toISOString(),
        last_seen_price: 750,
        last_seen_volume: 1000000,
        last_seen_rsi: 50,
        last_seen_50_dma: 740,
        last_seen_200_dma: 710,
        last_seen_event_ids: [],
        last_seen_news_ids: [],
        updated_at: new Date().toISOString(),
      },
      events: [],
      news: [],
    });

    expect(returningUserResult.is_first_visit).toBe(false);
    expect(returningUserResult.change_since_last_seen).toBe(30);
    expect(returningUserResult.change_since_last_seen_percent).toBe(4);
    expect(returningUserResult.since_last_checked_summary.some(s => s.includes('+4.0% price'))).toBe(true);
    expect(returningUserResult.since_last_checked_summary.some(s => s.includes('2.2× normal volume'))).toBe(true);
  });
});
