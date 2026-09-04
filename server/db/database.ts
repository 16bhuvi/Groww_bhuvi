import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { SEED_STOCKS } from './seedData.js';

let dbInstance: Database | null = null;
const DB_DIR = path.join(process.cwd(), 'server', 'data');
const DB_PATH = path.join(DB_DIR, 'market.db');

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  seedInitialData(dbInstance);
  persistDatabase();

  return dbInstance;
}

export function persistDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database:', err);
  }
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stocks (
      id TEXT PRIMARY KEY,
      symbol TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      exchange TEXT NOT NULL,
      sector TEXT NOT NULL,
      market_cap REAL NOT NULL,
      pe_ratio REAL NOT NULL,
      eps REAL NOT NULL,
      div_yield REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- Strict database-level uniqueness constraint: UNIQUE(watchlist_id, stock_id)
    CREATE TABLE IF NOT EXISTS watchlist_stocks (
      watchlist_id TEXT NOT NULL,
      stock_id TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL,
      PRIMARY KEY (watchlist_id, stock_id),
      FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS market_snapshots (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      price REAL NOT NULL,
      change REAL NOT NULL,
      change_percent REAL NOT NULL,
      open_price REAL NOT NULL,
      high_price REAL NOT NULL,
      low_price REAL NOT NULL,
      prev_close REAL NOT NULL,
      week_52_high REAL NOT NULL,
      week_52_low REAL NOT NULL,
      volume REAL NOT NULL,
      avg_volume_20d REAL NOT NULL,
      volume_ratio REAL NOT NULL,
      rsi_14 REAL NOT NULL,
      dma_50 REAL NOT NULL,
      dma_200 REAL NOT NULL,
      macd REAL NOT NULL,
      provider TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_stale INTEGER NOT NULL DEFAULT 0,
      data_conflict INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS historical_prices (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS stock_events (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_date TEXT NOT NULL,
      significance_score INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL,
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS stock_news (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT NOT NULL,
      published_at TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      provider TEXT NOT NULL,
      relevance_score REAL NOT NULL,
      sentiment TEXT NOT NULL,
      event_category TEXT NOT NULL,
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    -- Concurrency & multi-device resilient user-stock last-seen state
    CREATE TABLE IF NOT EXISTS user_stock_state (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stock_id TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_seen_price REAL NOT NULL,
      last_seen_volume REAL NOT NULL,
      last_seen_rsi REAL NOT NULL,
      last_seen_50_dma REAL NOT NULL,
      last_seen_200_dma REAL NOT NULL,
      last_seen_event_ids TEXT NOT NULL,
      last_seen_news_ids TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, stock_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stock_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      change_score INTEGER NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_audit_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);
}

function seedInitialData(db: Database): void {
  // Check if stocks exist
  const res = db.exec('SELECT COUNT(*) as count FROM stocks;');
  const count = res[0]?.values[0]?.[0] as number;
  if (count > 0) return;

  console.log('Seeding initial stock universe and demo state...');

  // 1. Seed Demo User
  const userId = 'user_demo_1';
  const passwordHash = bcrypt.hashSync('Demo1234!', 10);
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
    [userId, 'demo@groww.in', passwordHash, 'Groww Investor', now]
  );

  // 2. Seed Default Watchlist
  const watchlistId = 'wl_default_1';
  db.run(
    `INSERT INTO watchlists (id, user_id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [watchlistId, userId, 'Nifty Core Leaders', 1, now, now]
  );

  // Secondary Watchlist
  const techWatchlistId = 'wl_tech_2';
  db.run(
    `INSERT INTO watchlists (id, user_id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [techWatchlistId, userId, 'High Growth & Tech', 0, now, now]
  );

  // 3. Seed Stocks and Current Snapshots
  const defaultWatchlistSymbols = ['TATAMOTORS', 'INFY', 'HDFCBANK', 'RELIANCE', 'TCS', 'ICICIBANK', 'BHARTIARTL', 'ITC'];
  const techWatchlistSymbols = ['INFY', 'TCS', 'WIPRO', 'ZOMATO', 'TATAPOWER'];

  let order = 0;
  for (const s of SEED_STOCKS) {
    db.run(
      `INSERT INTO stocks (id, symbol, name, exchange, sector, market_cap, pe_ratio, eps, div_yield, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.symbol, s.name, s.exchange, s.sector, s.marketCap, s.peRatio, s.eps, s.divYield, 1]
    );

    // Initial snapshot
    const snapId = `snap_${s.symbol}_${Date.now()}`;
    const change = s.price - s.prevClose;
    const changePercent = (change / s.prevClose) * 100;
    const volRatio = Number((s.volume / s.avgVolume20d).toFixed(2));

    db.run(
      `INSERT INTO market_snapshots (
        id, stock_id, symbol, timestamp, price, change, change_percent, open_price, high_price, low_price,
        prev_close, week_52_high, week_52_low, volume, avg_volume_20d, volume_ratio, rsi_14, dma_50, dma_200,
        macd, provider, version, is_stale, data_conflict, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapId, s.id, s.symbol, now, s.price, change, changePercent, s.open, s.dayHigh, s.dayLow,
        s.prevClose, s.week52High, s.week52Low, s.volume, s.avgVolume20d, volRatio, s.rsi, s.dma50, s.dma200,
        s.macd, 'NSE_PRIMARY', 1, 0, 0, now
      ]
    );

    // Add to default watchlist
    if (defaultWatchlistSymbols.includes(s.symbol)) {
      db.run(
        `INSERT INTO watchlist_stocks (watchlist_id, stock_id, display_order, added_at) VALUES (?, ?, ?, ?)`,
        [watchlistId, s.id, order++, now]
      );

      // Seed realistic "last seen state" from 4 hours ago for returning user experience!
      // This is crucial for answering: "What meaningfully changed since you last checked?"
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      let lastSeenPrice = s.price;
      let lastSeenVol = s.avgVolume20d;
      let lastSeenRsi = s.rsi;
      let lastSeen50 = s.dma50;
      let lastSeen200 = s.dma200;

      if (s.symbol === 'TATAMOTORS') {
        // Tata Motors was at 758.40 (above 50 DMA 734.50), normal volume
        lastSeenPrice = 758.40;
        lastSeenVol = 12000000;
        lastSeenRsi = 54.0;
        lastSeen50 = 734.50;
      } else if (s.symbol === 'INFY') {
        // Infosys was at 1836.80, below 1900 level
        lastSeenPrice = 1836.80;
        lastSeenVol = 11000000;
        lastSeenRsi = 52.0;
      } else if (s.symbol === 'HDFCBANK') {
        // HDFC Bank was at 1695.40
        lastSeenPrice = 1695.40;
        lastSeenVol = 16500000;
      }

      db.run(
        `INSERT INTO user_stock_state (
          id, user_id, stock_id, last_seen_at, last_seen_price, last_seen_volume,
          last_seen_rsi, last_seen_50_dma, last_seen_200_dma, last_seen_event_ids, last_seen_news_ids, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `uss_${userId}_${s.id}`,
          userId,
          s.id,
          fourHoursAgo,
          lastSeenPrice,
          lastSeenVol,
          lastSeenRsi,
          lastSeen50,
          lastSeen200,
          '[]',
          '[]',
          fourHoursAgo
        ]
      );
    }

    // Add to tech watchlist
    if (techWatchlistSymbols.includes(s.symbol)) {
      db.run(
        `INSERT OR IGNORE INTO watchlist_stocks (watchlist_id, stock_id, display_order, added_at) VALUES (?, ?, ?, ?)`,
        [techWatchlistId, s.id, order++, now]
      );
    }

    // Seed historical intraday / weekly points for charts
    seedHistoricalChartData(db, s.id, s.price, s.prevClose);
  }

  // 4. Seed Corporate Events
  db.run(
    `INSERT INTO stock_events (id, stock_id, event_type, title, description, event_date, significance_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'evt_tatamotors_1',
      'stock_tatamotors',
      'RESULTS',
      'Q3 FY25 Financial Results Announced',
      'Consolidated net profit dropped 12% YoY; EBITDA margins contracted to 11.2% due to promotional spending in JLR.',
      now,
      15,
      now
    ]
  );

  db.run(
    `INSERT INTO stock_events (id, stock_id, event_type, title, description, event_date, significance_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'evt_infosys_1',
      'stock_infosys',
      'ANNOUNCEMENT',
      'Strategic GenAI Multi-Year Partnership with European Banking Consortium',
      'Secures $450M enterprise transformation deal across 5 years.',
      now,
      12,
      now
    ]
  );

  db.run(
    `INSERT INTO stock_events (id, stock_id, event_type, title, description, event_date, significance_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'evt_hdfc_1',
      'stock_hdfcbank',
      'DIVIDEND',
      'Interim Dividend Declaration of ₹19.50 per share',
      'Record date set for 14 days from board approval.',
      now,
      8,
      now
    ]
  );

  // 5. Seed Stock News
  db.run(
    `INSERT INTO stock_news (id, stock_id, title, source, url, published_at, retrieved_at, provider, relevance_score, sentiment, event_category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'news_tm_1',
      'stock_tatamotors',
      'Tata Motors slides 6.2% as commercial vehicle demand cools in domestic market',
      'Mint',
      'https://www.livemint.com/market/tata-motors-slump',
      now,
      now,
      'mock',
      0.96,
      'NEGATIVE',
      'EARNINGS'
    ]
  );

  db.run(
    `INSERT INTO stock_news (id, stock_id, title, source, url, published_at, retrieved_at, provider, relevance_score, sentiment, event_category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'news_tm_2',
      'stock_tatamotors',
      'Nomura lowers target price for Tata Motors post Q3 result call',
      'Economic Times',
      'https://economictimes.indiatimes.com/tata-motors-target',
      now,
      now,
      'mock',
      0.91,
      'NEGATIVE',
      'EARNINGS'
    ]
  );

  db.run(
    `INSERT INTO stock_news (id, stock_id, title, source, url, published_at, retrieved_at, provider, relevance_score, sentiment, event_category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'news_infy_1',
      'stock_infosys',
      'Infosys surges past ₹1,900 after raising FY25 constant currency revenue guidance',
      'Moneycontrol',
      'https://www.moneycontrol.com/news/infosys-rally',
      now,
      now,
      'mock',
      0.95,
      'POSITIVE',
      'EARNINGS'
    ]
  );

  // Seed Notifications
  db.run(
    `INSERT INTO notifications (id, user_id, stock_id, category, title, message, change_score, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'notif_1',
      userId,
      'stock_tatamotors',
      'HIGH_ATTENTION',
      'Tata Motors breached 50 DMA on 2.8x Volume',
      'Price dropped 6.2% following Q3 earnings announcement. Attention Score: 87/100.',
      87,
      0,
      now
    ]
  );

  db.run(
    `INSERT INTO notifications (id, user_id, stock_id, category, title, message, change_score, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'notif_2',
      userId,
      'stock_infosys',
      'SIGNIFICANT',
      'Infosys breaks out to new 30-day high (+4.1%)',
      'Strong institutional buying volume with positive quarterly commentary. Attention Score: 68/100.',
      68,
      0,
      now
    ]
  );

  console.log('Database seeded successfully!');
}

function seedHistoricalChartData(db: Database, stockId: string, currentPrice: number, prevClose: number): void {
  // Generate realistic intraday and multi-day points
  const timeframes = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'];
  const now = Date.now();

  for (const tf of timeframes) {
    let count = 24;
    let stepMs = 15 * 60 * 1000; // 15 min for 1D
    let volatility = 0.004;

    if (tf === '1W') {
      count = 35;
      stepMs = 60 * 60 * 1000;
      volatility = 0.008;
    } else if (tf === '1M') {
      count = 30;
      stepMs = 24 * 60 * 60 * 1000;
      volatility = 0.015;
    } else if (tf === '1Y') {
      count = 52;
      stepMs = 7 * 24 * 60 * 60 * 1000;
      volatility = 0.03;
    } else if (tf === '5Y') {
      count = 60;
      stepMs = 30 * 24 * 60 * 60 * 1000;
      volatility = 0.06;
    }

    let p = prevClose;
    for (let i = count; i >= 0; i--) {
      const t = new Date(now - i * stepMs).toISOString();
      const drift = (Math.random() - 0.49) * volatility * p;
      p = Math.max(10, p + drift);
      if (i === 0) p = currentPrice;

      const open = Number((p * (1 - 0.002)).toFixed(2));
      const high = Number((p * (1 + 0.004)).toFixed(2));
      const low = Number((p * (1 - 0.004)).toFixed(2));
      const close = Number(p.toFixed(2));
      const volume = Math.floor(50000 + Math.random() * 400000);

      db.run(
        `INSERT INTO historical_prices (id, stock_id, timestamp, timeframe, open, high, low, close, volume)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`hist_${stockId}_${tf}_${i}`, stockId, t, tf, open, high, low, close, volume]
      );
    }
  }
}

// Database helper utilities
export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export async function executeQueryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await executeQuery<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function executeRun(sql: string, params: any[] = []): Promise<void> {
  const db = await getDatabase();
  db.run(sql, params);
  persistDatabase();
}
