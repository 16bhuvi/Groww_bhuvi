import { executeQuery, executeRun } from '../db/database.js';
import { StockNews } from '../types/index.js';

export interface NewsProvider {
  name: string;
  getRecentNews(symbol: string, companyName: string, stockId: string): Promise<StockNews[]>;
}

// In-memory news cache: symbol -> { news: StockNews[], timestamp: number }
const newsCache = new Map<string, { news: StockNews[]; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class MockNewsProvider implements NewsProvider {
  name = 'MockNewsProvider';

  async getRecentNews(symbol: string, companyName: string, stockId: string): Promise<StockNews[]> {
    // Return stored news from database
    const rows = await executeQuery<any>(
      `SELECT * FROM stock_news WHERE stock_id = ? ORDER BY published_at DESC LIMIT 10`,
      [stockId]
    );

    if (rows.length > 0) {
      return rows.map(r => ({
        id: r.id,
        stock_id: r.stock_id,
        title: r.title,
        source: r.source,
        url: r.url,
        published_at: r.published_at,
        retrieved_at: r.retrieved_at,
        provider: r.provider,
        relevance_score: Number(r.relevance_score),
        sentiment: r.sentiment,
        event_category: r.event_category,
      }));
    }

    // Default mock items if none in DB
    const now = new Date().toISOString();
    return [
      {
        id: `news_${symbol}_1`,
        stock_id: stockId,
        title: `${companyName} shows steady institutional interest amid sector rotation`,
        source: 'Livemint',
        url: `https://www.livemint.com/market/${symbol.toLowerCase()}-market-report`,
        published_at: now,
        retrieved_at: now,
        provider: 'mock',
        relevance_score: 0.85,
        sentiment: 'NEUTRAL',
        event_category: 'GENERAL',
      },
    ];
  }
}

export class SerpApiNewsProvider implements NewsProvider {
  name = 'SerpApiNewsProvider';
  private apiKey: string;
  private static circuitBreakerUntil: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getRecentNews(symbol: string, companyName: string, stockId: string): Promise<StockNews[]> {
    const mock = new MockNewsProvider();

    // Check circuit breaker - if recently timed out or failed, silently use local DB
    if (Date.now() < SerpApiNewsProvider.circuitBreakerUntil) {
      return mock.getRecentNews(symbol, companyName, stockId);
    }

    // Check if we already have recent news in DB
    const existingDbNews = await mock.getRecentNews(symbol, companyName, stockId);
    if (existingDbNews.length >= 2) {
      return existingDbNews;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const query = encodeURIComponent(`${companyName} ${symbol} share market news`);
      const url = `https://serpapi.com/search.json?engine=google_news&q=${query}&gl=in&hl=en&api_key=${this.apiKey}`;

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 4000); // 4s limit

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const newsResults = data.news_results || [];

      if (!Array.isArray(newsResults) || newsResults.length === 0) {
        return existingDbNews;
      }

      const normalizedNews: StockNews[] = [];
      const now = new Date().toISOString();

      for (const item of newsResults.slice(0, 8)) {
        const title = item.title || '';
        const link = item.link || '';
        const sourceName = item.source?.name || 'Financial Express';
        const dateStr = item.date || now;

        // Categorize & sentiment analysis
        const { category, sentiment } = analyzeNewsContent(title);

        const newsItem: StockNews = {
          id: `serp_${Buffer.from(link || title).toString('base64').substring(0, 24)}`,
          stock_id: stockId,
          title,
          source: sourceName,
          url: link,
          published_at: dateStr,
          retrieved_at: now,
          provider: 'serpapi',
          relevance_score: 0.9,
          sentiment,
          event_category: category,
        };

        // Save to DB with deduplication
        await executeRun(
          `INSERT OR IGNORE INTO stock_news (
            id, stock_id, title, source, url, published_at, retrieved_at, provider, relevance_score, sentiment, event_category
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newsItem.id, newsItem.stock_id, newsItem.title, newsItem.source, newsItem.url,
            newsItem.published_at, newsItem.retrieved_at, newsItem.provider,
            newsItem.relevance_score, newsItem.sentiment, newsItem.event_category
          ]
        );

        normalizedNews.push(newsItem);
      }

      return normalizedNews.length > 0 ? normalizedNews : existingDbNews;
    } catch {
      // On any timeout, network abort, or rate limit, trip circuit breaker for 10 minutes
      // and seamlessly fall back to local curated news without noisy logs
      SerpApiNewsProvider.circuitBreakerUntil = Date.now() + 10 * 60 * 1000;
      return existingDbNews;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}

function analyzeNewsContent(title: string): { category: StockNews['event_category']; sentiment: StockNews['sentiment'] } {
  const lower = title.toLowerCase();

  let category: StockNews['event_category'] = 'GENERAL';
  if (lower.includes('result') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3') || lower.includes('q4') || lower.includes('profit') || lower.includes('loss') || lower.includes('earnings')) {
    category = 'EARNINGS';
  } else if (lower.includes('sebi') || lower.includes('rbi') || lower.includes('regulat') || lower.includes('probe') || lower.includes('penalty')) {
    category = 'REGULATORY';
  } else if (lower.includes('ceo') || lower.includes('cfo') || lower.includes('management') || lower.includes('resigns') || lower.includes('appointed')) {
    category = 'MANAGEMENT';
  } else if (lower.includes('dividend') || lower.includes('bonus') || lower.includes('split') || lower.includes('buyback')) {
    category = 'CORP_ACTION';
  }

  let sentiment: StockNews['sentiment'] = 'NEUTRAL';
  if (lower.includes('plunge') || lower.includes('slump') || lower.includes('fall') || lower.includes('downgrade') || lower.includes('loss') || lower.includes('weak') || lower.includes('drop')) {
    sentiment = 'NEGATIVE';
  } else if (lower.includes('surge') || lower.includes('rally') || lower.includes('jump') || lower.includes('upgrade') || lower.includes('high') || lower.includes('gain') || lower.includes('record')) {
    sentiment = 'POSITIVE';
  }

  return { category, sentiment };
}

// Global Factory for NewsProvider
export function getNewsProvider(): NewsProvider {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (apiKey && apiKey.trim().length > 0 && apiKey !== 'MY_SERPAPI_API_KEY') {
    return new SerpApiNewsProvider(apiKey);
  }
  return new MockNewsProvider();
}

export async function fetchStockNewsWithCache(symbol: string, companyName: string, stockId: string): Promise<StockNews[]> {
  const cached = newsCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.news;
  }

  const provider = getNewsProvider();
  const news = await provider.getRecentNews(symbol, companyName, stockId);
  newsCache.set(symbol, { news, timestamp: Date.now() });
  return news;
}
