import {
  AttentionLevel,
  MarketSnapshot,
  MeaningfulChangeResult,
  SignalBreakdown,
  Stock,
  StockEvent,
  StockNews,
  UserStockState,
} from '../types/index.js';

export interface ChangeEngineInput {
  stock: Stock;
  currentSnapshot: MarketSnapshot;
  userState: UserStockState | null;
  events: StockEvent[];
  news: StockNews[];
  referenceTime?: Date;
}

/**
 * Weights configuration for the Change Score algorithm.
 * Total theoretical maximum = 100 points.
 */
export const SCORING_WEIGHTS = {
  MAX_PRICE: 30,
  MAX_VOLUME: 20,
  MAX_TECHNICAL: 20,
  MAX_CORPORATE: 15,
  MAX_NEWS: 15,
};

/**
 * Meaningful Change Engine
 * A deterministic, rule-based multi-signal scoring system designed to answer:
 * "What meaningfully changed in this stock since the user last checked, and why does it deserve attention?"
 */
export function calculateMeaningfulChange(input: ChangeEngineInput): MeaningfulChangeResult {
  const { stock, currentSnapshot, userState, events, news } = input;
  const now = input.referenceTime || new Date();

  const signals: SignalBreakdown[] = [];
  const whyItMatters: string[] = [];
  const tags: string[] = [];

  // ==========================================
  // 1. PRICE MOVEMENT EVALUATION (Max 30 pts)
  // ==========================================
  let pricePoints = 0;
  const priceExplanations: string[] = [];

  // Calculate change since last visit (if available) or day change
  let changeSinceLastSeen: number | null = null;
  let changeSinceLastSeenPercent: number | null = null;
  let timeSinceLastSeenSeconds = 0;

  if (userState && userState.last_seen_price > 0) {
    changeSinceLastSeen = currentSnapshot.price - userState.last_seen_price;
    changeSinceLastSeenPercent = (changeSinceLastSeen / userState.last_seen_price) * 100;
    const lastSeenTime = new Date(userState.last_seen_at).getTime();
    timeSinceLastSeenSeconds = Math.max(0, Math.floor((now.getTime() - lastSeenTime) / 1000));
  } else {
    // First time user: baseline against prev_close
    changeSinceLastSeen = currentSnapshot.change;
    changeSinceLastSeenPercent = currentSnapshot.change_percent;
  }

  const effectiveChangePercent = Math.abs(changeSinceLastSeenPercent ?? currentSnapshot.change_percent);

  // Movement since user's last visit thresholding
  if (effectiveChangePercent >= 6.0) {
    pricePoints += 24;
    const dir = (changeSinceLastSeenPercent ?? currentSnapshot.change_percent) >= 0 ? 'gained' : 'declined';
    priceExplanations.push(`Price ${dir} ${effectiveChangePercent.toFixed(1)}% since your previous visit`);
    tags.push(`${effectiveChangePercent >= 0 ? '+' : ''}${effectiveChangePercent.toFixed(1)}% Move`);
  } else if (effectiveChangePercent >= 4.0) {
    pricePoints += 18;
    const dir = (changeSinceLastSeenPercent ?? currentSnapshot.change_percent) >= 0 ? 'gained' : 'declined';
    priceExplanations.push(`Price ${dir} ${effectiveChangePercent.toFixed(1)}% since your previous visit`);
    tags.push(`${effectiveChangePercent >= 0 ? '+' : ''}${effectiveChangePercent.toFixed(1)}% Move`);
  } else if (effectiveChangePercent >= 2.0) {
    pricePoints += 10;
    const dir = (changeSinceLastSeenPercent ?? currentSnapshot.change_percent) >= 0 ? 'gained' : 'declined';
    priceExplanations.push(`Price ${dir} ${effectiveChangePercent.toFixed(1)}% since your previous visit`);
  } else if (effectiveChangePercent >= 1.0) {
    pricePoints += 5;
  }

  // Significant Gap from previous close (Gap up / Gap down)
  const gapPercent = Math.abs((currentSnapshot.open_price - currentSnapshot.prev_close) / currentSnapshot.prev_close) * 100;
  if (gapPercent >= 1.5) {
    pricePoints += 6;
    const gapType = currentSnapshot.open_price > currentSnapshot.prev_close ? 'Gap-up' : 'Gap-down';
    priceExplanations.push(`Opened with a significant ${gapType} of ${gapPercent.toFixed(1)}% from previous close`);
    tags.push(gapType);
  }

  // 52-Week High / Low proximity or breakout
  if (currentSnapshot.week_52_high > 0 && currentSnapshot.price >= currentSnapshot.week_52_high * 0.99) {
    pricePoints += 10;
    priceExplanations.push(`Trading at or within 1% of its 52-week high (₹${currentSnapshot.week_52_high.toLocaleString('en-IN')})`);
    tags.push('52W High');
  } else if (currentSnapshot.week_52_low > 0 && currentSnapshot.price <= currentSnapshot.week_52_low * 1.01) {
    pricePoints += 10;
    priceExplanations.push(`Trading at or within 1% of its 52-week low (₹${currentSnapshot.week_52_low.toLocaleString('en-IN')})`);
    tags.push('52W Low');
  }

  pricePoints = Math.min(pricePoints, SCORING_WEIGHTS.MAX_PRICE);
  signals.push({
    category: 'PRICE',
    points: pricePoints,
    max_points: SCORING_WEIGHTS.MAX_PRICE,
    label: 'Price Action',
    details: priceExplanations.join('; ') || 'Price movement within standard volatility',
  });
  if (priceExplanations.length > 0) {
    whyItMatters.push(...priceExplanations);
  }

  // ==========================================
  // 2. VOLUME ANOMALY EVALUATION (Max 20 pts)
  // ==========================================
  let volumePoints = 0;
  const volumeExplanations: string[] = [];
  const volRatio = currentSnapshot.volume_ratio > 0 
    ? currentSnapshot.volume_ratio 
    : (currentSnapshot.avg_volume_20d > 0 ? currentSnapshot.volume / currentSnapshot.avg_volume_20d : 1.0);

  if (volRatio >= 2.5) {
    volumePoints = 20;
    volumeExplanations.push(`Unusual volume spike: ${volRatio.toFixed(1)}x the 20-day average indicating heavy institutional activity`);
    tags.push(`${volRatio.toFixed(1)}x Vol Surge`);
  } else if (volRatio >= 1.8) {
    volumePoints = 14;
    volumeExplanations.push(`Volume is ${volRatio.toFixed(1)}x the 20-day average (elevated turnover)`);
    tags.push(`${volRatio.toFixed(1)}x Volume`);
  } else if (volRatio >= 1.4) {
    volumePoints = 8;
    volumeExplanations.push(`Volume above normal: ${volRatio.toFixed(1)}x the 20-day average`);
  }

  volumePoints = Math.min(volumePoints, SCORING_WEIGHTS.MAX_VOLUME);
  signals.push({
    category: 'VOLUME',
    points: volumePoints,
    max_points: SCORING_WEIGHTS.MAX_VOLUME,
    label: 'Volume Anomaly',
    details: volumeExplanations.join('; ') || 'Trading volume within normal daily average',
  });
  if (volumeExplanations.length > 0) {
    whyItMatters.push(...volumeExplanations);
  }

  // ==========================================
  // 3. TECHNICAL EVENTS EVALUATION (Max 20 pts)
  // ==========================================
  let technicalPoints = 0;
  const techExplanations: string[] = [];

  // 50 DMA Crossover / Breach detection
  const prevPrice = userState?.last_seen_price ?? currentSnapshot.prev_close;
  const wasBelow50 = prevPrice < currentSnapshot.dma_50;
  const isAbove50 = currentSnapshot.price >= currentSnapshot.dma_50;
  const wasAbove50 = prevPrice > currentSnapshot.dma_50;
  const isBelow50 = currentSnapshot.price < currentSnapshot.dma_50;

  if (wasBelow50 && isAbove50) {
    technicalPoints += 10;
    techExplanations.push(`Bullish 50 DMA breakout: Price crossed above 50-day moving average (₹${currentSnapshot.dma_50.toFixed(2)})`);
    tags.push('50 DMA Breakout');
  } else if (wasAbove50 && isBelow50) {
    technicalPoints += 12;
    techExplanations.push(`Critical support breached: Price crossed below 50-day moving average (₹${currentSnapshot.dma_50.toFixed(2)})`);
    tags.push('50 DMA Breached');
  }

  // 200 DMA Major Trend Reversal Crossover
  const wasBelow200 = prevPrice < currentSnapshot.dma_200;
  const isAbove200 = currentSnapshot.price >= currentSnapshot.dma_200;
  const wasAbove200 = prevPrice > currentSnapshot.dma_200;
  const isBelow200 = currentSnapshot.price < currentSnapshot.dma_200;

  if (wasBelow200 && isAbove200) {
    technicalPoints += 18;
    techExplanations.push(`Major long-term breakout: Price crossed above 200-day moving average (₹${currentSnapshot.dma_200.toFixed(2)})`);
    tags.push('200 DMA Breakout');
  } else if (wasAbove200 && isBelow200) {
    technicalPoints += 18;
    techExplanations.push(`Major trend breakdown: Price dropped below 200-day moving average (₹${currentSnapshot.dma_200.toFixed(2)})`);
    tags.push('200 DMA Breakdown');
  }

  // RSI Extreme Movements (<30 oversold, >70 overbought)
  if (currentSnapshot.rsi_14 >= 75) {
    technicalPoints += 6;
    techExplanations.push(`RSI reached extreme overbought territory (${currentSnapshot.rsi_14.toFixed(1)})`);
    tags.push('RSI Overbought');
  } else if (currentSnapshot.rsi_14 <= 28) {
    technicalPoints += 6;
    techExplanations.push(`RSI reached extreme oversold territory (${currentSnapshot.rsi_14.toFixed(1)})`);
    tags.push('RSI Oversold');
  }

  // MACD Bullish / Bearish signal
  if (currentSnapshot.macd > 1.5 && (!userState || userState.last_seen_rsi < 50)) {
    technicalPoints += 4;
  }

  technicalPoints = Math.min(technicalPoints, SCORING_WEIGHTS.MAX_TECHNICAL);
  signals.push({
    category: 'TECHNICAL',
    points: technicalPoints,
    max_points: SCORING_WEIGHTS.MAX_TECHNICAL,
    label: 'Technical Indicators',
    details: techExplanations.join('; ') || 'No critical moving average or oscillator breaches',
  });
  if (techExplanations.length > 0) {
    whyItMatters.push(...techExplanations);
  }

  // ==========================================
  // 4. CORPORATE EVENTS EVALUATION (Max 15 pts)
  // ==========================================
  let corpPoints = 0;
  const corpExplanations: string[] = [];
  const seenEventIds = new Set(userState?.last_seen_event_ids || []);
  const newEvents = events.filter(e => !seenEventIds.has(e.id));

  for (const event of newEvents) {
    if (event.event_type === 'RESULTS') {
      corpPoints += 15;
      corpExplanations.push(`Quarterly financial results announced: ${event.title}`);
      tags.push('Q3 Results');
    } else if (event.event_type === 'SPLIT' || event.event_type === 'BONUS') {
      corpPoints += 12;
      corpExplanations.push(`Corporate action: ${event.title}`);
      tags.push(event.event_type === 'SPLIT' ? 'Stock Split' : 'Bonus Issue');
    } else if (event.event_type === 'DIVIDEND') {
      corpPoints += 8;
      corpExplanations.push(`Dividend declaration: ${event.title}`);
      tags.push('Dividend');
    } else if (event.event_type === 'ANNOUNCEMENT') {
      corpPoints += 10;
      corpExplanations.push(`Major corporate announcement: ${event.title}`);
      tags.push('Corporate Notice');
    }
  }

  corpPoints = Math.min(corpPoints, SCORING_WEIGHTS.MAX_CORPORATE);
  signals.push({
    category: 'CORPORATE',
    points: corpPoints,
    max_points: SCORING_WEIGHTS.MAX_CORPORATE,
    label: 'Corporate Actions',
    details: corpExplanations.join('; ') || 'No new corporate events or earnings filed',
  });
  if (corpExplanations.length > 0) {
    whyItMatters.push(...corpExplanations);
  }

  // ==========================================
  // 5. NEWS IMPACT EVALUATION (Max 15 pts)
  // ==========================================
  let newsPoints = 0;
  const newsExplanations: string[] = [];
  const seenNewsIds = new Set(userState?.last_seen_news_ids || []);
  const newNews = news.filter(n => !seenNewsIds.has(n.id));

  const highImpactNews = newNews.filter(n => 
    n.event_category === 'EARNINGS' || 
    n.event_category === 'REGULATORY' || 
    n.event_category === 'MANAGEMENT'
  );

  if (highImpactNews.length > 0) {
    newsPoints += 12;
    newsExplanations.push(`${highImpactNews.length} high-significance news report(s) (${highImpactNews[0].title})`);
    tags.push('Major News');
  } else if (newNews.length >= 2) {
    newsPoints += 8;
    newsExplanations.push(`${newNews.length} new news articles published since last check`);
  } else if (newNews.length === 1) {
    newsPoints += 4;
    newsExplanations.push(`Recent news coverage: ${newNews[0].title}`);
  }

  // Sentiment bonus
  const negativeNews = newNews.filter(n => n.sentiment === 'NEGATIVE');
  const positiveNews = newNews.filter(n => n.sentiment === 'POSITIVE');
  if (negativeNews.length >= 2) {
    newsPoints += 3;
    newsExplanations.push(`Significant negative news sentiment detected`);
  } else if (positiveNews.length >= 2) {
    newsPoints += 3;
    newsExplanations.push(`Strong positive market commentary detected`);
  }

  newsPoints = Math.min(newsPoints, SCORING_WEIGHTS.MAX_NEWS);
  signals.push({
    category: 'NEWS',
    points: newsPoints,
    max_points: SCORING_WEIGHTS.MAX_NEWS,
    label: 'Market News & Sentiment',
    details: newsExplanations.join('; ') || 'No major news developments or unusual sentiment shift',
  });
  if (newsExplanations.length > 0) {
    whyItMatters.push(...newsExplanations);
  }

  // ==========================================
  // 6. TOTAL SCORE & ATTENTION CLASSIFICATION
  // ==========================================
  const totalScore = Math.min(100, pricePoints + volumePoints + technicalPoints + corpPoints + newsPoints);

  let attentionLevel: AttentionLevel;
  if (totalScore >= 81) {
    attentionLevel = 'HIGH_ATTENTION';
  } else if (totalScore >= 61) {
    attentionLevel = 'SIGNIFICANT';
  } else if (totalScore >= 41) {
    attentionLevel = 'MODERATE';
  } else if (totalScore >= 21) {
    attentionLevel = 'LOW';
  } else {
    attentionLevel = 'NORMAL';
  }

  const isMeaningful = totalScore >= 40;

  // Fallback explanation if score is normal
  if (whyItMatters.length === 0) {
    whyItMatters.push('Asset is trading normally within historical moving averages, volume bounds, and volatility bands.');
  }

  return {
    stock_id: stock.id,
    symbol: stock.symbol,
    company_name: stock.name,
    sector: stock.sector,
    current_price: currentSnapshot.price,
    day_change: currentSnapshot.change,
    day_change_percent: currentSnapshot.change_percent,

    last_seen_at: userState?.last_seen_at || null,
    last_seen_price: userState?.last_seen_price || null,
    change_since_last_seen: changeSinceLastSeen,
    change_since_last_seen_percent: changeSinceLastSeenPercent,
    time_since_last_seen_seconds: timeSinceLastSeenSeconds,

    change_score: totalScore,
    attention_level: attentionLevel,
    is_meaningful: isMeaningful,

    signals,
    why_it_matters: whyItMatters,
    tags: Array.from(new Set(tags)),

    volume_ratio: Number(volRatio.toFixed(2)),
    rsi_14: currentSnapshot.rsi_14,
    dma_50: currentSnapshot.dma_50,
    dma_200: currentSnapshot.dma_200,
    is_stale: currentSnapshot.is_stale,
    data_conflict: currentSnapshot.data_conflict || false,
    updated_at: currentSnapshot.timestamp,

    new_events: newEvents,
    new_news: newNews,
  };
}
